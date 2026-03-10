
import { Router } from 'express';
import db from '../db.js';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { DATA_DIR } from '../db.js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { DhlClient } from '../services/dhl.js';

const router = Router();

// Ensure labels directory exists
const LABELS_DIR = path.join(DATA_DIR, 'shipping_labels');
fs.ensureDirSync(LABELS_DIR);

// Helper to escape XML special characters
const escapeXml = (unsafe: string) => {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&"']/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '"': return '&quot;';
            case "'": return '&apos;';
            default: return c;
        }
    });
};

// --- Shop Categories ---

router.get('/:shopId/categories', (req, res) => {
  try {
    const { shopId } = req.params;
    const categories = db.prepare('SELECT * FROM shop_categories WHERE shop_id = ? ORDER BY sort_order ASC').all(shopId);
    res.json({ success: true, data: categories });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:shopId/categories', (req, res) => {
  try {
    const { shopId } = req.params;
    const { name, slug, description, image_url, sort_order, parent_id } = req.body;
    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO shop_categories (id, shop_id, name, slug, description, image_url, sort_order, parent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, shopId, name, slug, description, image_url, sort_order || 0, parent_id || null);

    const category = db.prepare('SELECT * FROM shop_categories WHERE id = ?').get(id);
    res.json({ success: true, data: category });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:shopId/categories/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, image_url, sort_order, parent_id } = req.body;

    db.prepare(`
      UPDATE shop_categories 
      SET name = ?, slug = ?, description = ?, image_url = ?, sort_order = ?, parent_id = ?
      WHERE id = ?
    `).run(name, slug, description, image_url, sort_order, parent_id || null, id);

    const category = db.prepare('SELECT * FROM shop_categories WHERE id = ?').get(id);
    res.json({ success: true, data: category });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:shopId/categories/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM shop_categories WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Shop Products ---

router.get('/:shopId/products', (req, res) => {
  try {
    const { shopId } = req.params;
    const products = db.prepare(`
      SELECT spa.*, cp.name as product_name, cp.product_number, cp.manufacturer_info, cp.description, cp.size, cp.weight, cp.color, sc.name as category_name, sc.slug as category_slug
      FROM shop_product_assignments spa
      JOIN customer_products cp ON spa.product_id = cp.id
      LEFT JOIN shop_categories sc ON spa.category_id = sc.id
      WHERE spa.shop_id = ?
      ORDER BY spa.sort_order ASC
    `).all(shopId) as any[];

    // Fetch files for each product. 
    // Logic: If there are entries in shop_product_images, use ONLY those.
    // If NO entries in shop_product_images, fallback to ALL customer_product_files (legacy behavior).
    const productsWithFiles = products.map(p => {
        const assignedImages = db.prepare(`
            SELECT cpf.* 
            FROM shop_product_images spi
            JOIN customer_product_files cpf ON spi.customer_product_file_id = cpf.id
            WHERE spi.shop_product_assignment_id = ?
            ORDER BY spi.sort_order ASC, spi.created_at ASC
        `).all(p.id) as any[];

        let files = [];
        if (assignedImages.length > 0) {
            files = assignedImages;
        } else {
            // Fallback: Get all files from the base product
            files = db.prepare('SELECT * FROM customer_product_files WHERE product_id = ? ORDER BY created_at DESC').all(p.product_id);
        }

        if (p.variants) {
            try {
                p.variants = JSON.parse(p.variants);
            } catch (e) {
                p.variants = null;
            }
        }
        return { ...p, files };
    });

    res.json({ success: true, data: productsWithFiles });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:shopId/products', (req, res) => {
  try {
    const { shopId } = req.params;
    const { product_id, category_id, price, is_featured, sort_order } = req.body;
    const id = crypto.randomUUID();

    // Check if already assigned
    const exists = db.prepare('SELECT id FROM shop_product_assignments WHERE shop_id = ? AND product_id = ?').get(shopId, product_id);
    if (exists) {
      return res.status(400).json({ success: false, error: 'Product already assigned to this shop' });
    }

    db.prepare(`
      INSERT INTO shop_product_assignments (id, shop_id, product_id, category_id, price, is_featured, personalization_enabled, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, shopId, product_id, category_id, price, is_featured ? 1 : 0, 0, sort_order || 0);

    const assignment = db.prepare('SELECT * FROM shop_product_assignments WHERE id = ?').get(id);
    res.json({ success: true, data: assignment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:shopId/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, price, is_featured, personalization_enabled, sort_order, manufacturer_info, description, size, variants, personalization_options, weight } = req.body;

    // Update assignment
    db.prepare(`
      UPDATE shop_product_assignments 
      SET category_id = ?, price = ?, is_featured = ?, personalization_enabled = ?, sort_order = ?, variants = ?, personalization_options = ?, is_active = ?, supplier_id = ?
      WHERE id = ?
    `).run(
        category_id, 
        price, 
        is_featured ? 1 : 0, 
        personalization_enabled ? 1 : 0, 
        sort_order, 
        variants ? JSON.stringify(variants) : null, 
        personalization_options ? JSON.stringify(personalization_options) : null,
        req.body.is_active === false || req.body.is_active === 0 ? 0 : 1, // Default to true if undefined
        req.body.supplier_id || null,
        id
    );

    console.log(`Updated product assignment ${id}: is_active=${req.body.is_active === false || req.body.is_active === 0 ? 0 : 1}`);

    // Update product details (manufacturer_info, description, size, weight)
    const assignment = db.prepare('SELECT product_id FROM shop_product_assignments WHERE id = ?').get(id) as { product_id: string };
    if (assignment) {
        db.prepare(`
            UPDATE customer_products 
            SET manufacturer_info = ?, description = ?, size = ?, weight = ?
            WHERE id = ?
        `).run(manufacturer_info || null, description || null, size || null, weight || 0, assignment.product_id);
    }

    const updatedAssignment = db.prepare('SELECT * FROM shop_product_assignments WHERE id = ?').get(id);
    
    // Parse variants and personalization_options back to JSON
    if (updatedAssignment) {
        if ((updatedAssignment as any).variants) {
            (updatedAssignment as any).variants = JSON.parse((updatedAssignment as any).variants);
        }
        if ((updatedAssignment as any).personalization_options) {
            (updatedAssignment as any).personalization_options = JSON.parse((updatedAssignment as any).personalization_options);
        }
    }
    
    res.json({ success: true, data: updatedAssignment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:shopId/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM shop_product_assignments WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:shopId/products/import', (req, res) => {
  try {
    const { shopId } = req.params; // Target Shop
    const { source_assignment_id } = req.body; // Source Assignment ID
    
    // 1. Fetch Source Assignment & Product Data
    const sourceAssignment = db.prepare(`
        SELECT spa.*, cp.*, 
               spa.supplier_id as spa_supplier_id,
               cp.supplier_id as cp_supplier_id,
               cp.id as real_product_id
        FROM shop_product_assignments spa
        JOIN customer_products cp ON spa.product_id = cp.id
        WHERE spa.id = ?
    `).get(source_assignment_id) as any;

    if (!sourceAssignment) {
        return res.status(404).json({ success: false, error: 'Source product not found' });
    }

    // 2. Duplicate Customer Product (Base Article)
    const newProductId = crypto.randomUUID();
    const newProductNumber = `${sourceAssignment.product_number}-COPY-${Date.now().toString().slice(-4)}`;
    
    // Check if target shop has a different customer_id? 
    // Usually one user owns multiple shops, so customer_id should be the same.
    // We should fetch the target shop to get its customer_id.
    const targetShop = db.prepare('SELECT customer_id FROM shops WHERE id = ?').get(shopId) as { customer_id: string };
    
    db.prepare(`
        INSERT INTO customer_products (
            id, customer_id, product_number, name, manufacturer_info, description, 
            size, color, weight, created_at, supplier_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `).run(
        newProductId, 
        targetShop.customer_id, 
        newProductNumber, 
        `${sourceAssignment.name} (Kopie)`, // Add (Kopie) to name? Or keep exact name? User said "eigenständiges produkt". Let's keep exact name but maybe distinct number.
        sourceAssignment.manufacturer_info, 
        sourceAssignment.description, 
        sourceAssignment.size, 
        sourceAssignment.color, 
        sourceAssignment.weight,
        sourceAssignment.cp_supplier_id // supplier_id from customer_products
    );

    // 3. Duplicate Files (References)
    const sourceFiles = db.prepare('SELECT * FROM customer_product_files WHERE product_id = ?').all(sourceAssignment.real_product_id) as any[];
    const insertFile = db.prepare(`
        INSERT INTO customer_product_files (
            id, product_id, file_url, file_name, thumbnail_url, type, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    // Map old file IDs to new file IDs to update assignments later if needed
    const fileIdMap = new Map<string, string>();

    for (const file of sourceFiles) {
        const newFileId = crypto.randomUUID();
        insertFile.run(
            newFileId,
            newProductId,
            file.file_url,
            file.file_name,
            file.thumbnail_url,
            file.type
        );
        fileIdMap.set(file.id, newFileId);
    }

    // 4. Create New Assignment for Target Shop
    const newAssignmentId = crypto.randomUUID();
    
    // If source assignment had variants, we need to deep copy them if they reference file IDs?
    // Variants usually just string JSON.
    // However, shop_product_images might reference file IDs.
    
    db.prepare(`
      INSERT INTO shop_product_assignments (
        id, shop_id, product_id, category_id, price, is_featured, 
        personalization_enabled, sort_order, variants, personalization_options, is_active, supplier_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        newAssignmentId,
        shopId,
        newProductId,
        null, // Reset category, as target shop might have different categories
        sourceAssignment.price, // Sales price
        sourceAssignment.is_featured,
        sourceAssignment.personalization_enabled,
        0, // Reset sort order
        sourceAssignment.variants,
        sourceAssignment.personalization_options,
        1, // Active by default
        sourceAssignment.spa_supplier_id
    );

    // 5. Duplicate Shop Product Images (Assignments)
    // These link assignments to files. We need to link NEW assignment to NEW files (using map)
    const sourceImages = db.prepare('SELECT * FROM shop_product_images WHERE shop_product_assignment_id = ?').all(source_assignment_id) as any[];
    const insertImage = db.prepare(`
        INSERT INTO shop_product_images (
            id, shop_product_assignment_id, customer_product_file_id, sort_order, personalization_option_ids
        ) VALUES (?, ?, ?, ?, ?)
    `);

    for (const img of sourceImages) {
        const newFileId = fileIdMap.get(img.customer_product_file_id);
        if (newFileId) {
            insertImage.run(
                crypto.randomUUID(),
                newAssignmentId,
                newFileId,
                img.sort_order,
                img.personalization_option_ids || '[]'
            );
        }
    }

    // 6. Ensure Variables used in Variants are assigned to Target Shop
    // If the source product uses variables (e.g. Sizes) that are not yet enabled in the target shop, enable them.
    if (sourceAssignment.variants) {
        let variants: any = {};
        try {
            variants = typeof sourceAssignment.variants === 'string' ? JSON.parse(sourceAssignment.variants) : sourceAssignment.variants;
        } catch (e) {
            console.warn('Failed to parse variants during import', e);
        }

        const usedVariableIds = Object.keys(variants);
        if (usedVariableIds.length > 0) {
            const checkAssignment = db.prepare('SELECT id FROM shop_variable_assignments WHERE shop_id = ? AND variable_id = ?');
            const insertAssignment = db.prepare('INSERT INTO shop_variable_assignments (id, shop_id, variable_id, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)');

            for (const varId of usedVariableIds) {
                const exists = checkAssignment.get(shopId, varId);
                if (!exists) {
                    // Check if variable actually exists in global table first (safety)
                    const varExists = db.prepare('SELECT id FROM product_variables WHERE id = ?').get(varId);
                    if (varExists) {
                        console.log(`Auto-assigning variable ${varId} to shop ${shopId} due to product import.`);
                        insertAssignment.run(crypto.randomUUID(), shopId, varId);
                    }
                }
            }
        }
    }

    res.json({ success: true, message: 'Product duplicated successfully', newId: newAssignmentId });

  } catch (error: any) {
    console.error('Import Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Shop Product Images ---

router.get('/:shopId/products/:assignmentId/images', (req, res) => {
    try {
        const { assignmentId } = req.params;
        
        // Get currently assigned images
        const assignedImages = db.prepare(`
            SELECT cpf.*, spi.id as assignment_image_id, spi.sort_order, spi.personalization_option_id, spi.personalization_option_ids, spi.variant_ids, spi.size_restrictions, spi.attribute_restrictions
            FROM shop_product_images spi
            JOIN customer_product_files cpf ON spi.customer_product_file_id = cpf.id
            WHERE spi.shop_product_assignment_id = ?
            ORDER BY spi.sort_order ASC
        `).all(assignmentId);

        // Parse JSON for option_ids, variant_ids, and size_restrictions
        const assignedImagesParsed = assignedImages.map((img: any) => {
             try {
                 img.personalization_option_ids = img.personalization_option_ids ? JSON.parse(img.personalization_option_ids) : [];
                 // Fallback for migration: If single ID exists but array is empty, populate array
                 if (img.personalization_option_ids.length === 0 && img.personalization_option_id) {
                     img.personalization_option_ids = [img.personalization_option_id];
                 }
             } catch (e) {
                 img.personalization_option_ids = [];
             }
             try {
                 img.variant_ids = img.variant_ids ? JSON.parse(img.variant_ids) : [];
             } catch (e) {
                 img.variant_ids = [];
             }
             try {
                 img.size_restrictions = img.size_restrictions ? JSON.parse(img.size_restrictions) : [];
             } catch (e) {
                 img.size_restrictions = [];
             }
             try {
                 img.attribute_restrictions = img.attribute_restrictions ? JSON.parse(img.attribute_restrictions) : {};
             } catch (e) {
                 img.attribute_restrictions = {};
             }
             return img;
        });

        // Get all available images for the customer (across all their products)
        const assignment = db.prepare('SELECT product_id FROM shop_product_assignments WHERE id = ?').get(assignmentId) as { product_id: string };
        if (!assignment) return res.status(404).json({ success: false, error: 'Assignment not found' });

        const product = db.prepare('SELECT customer_id FROM customer_products WHERE id = ?').get(assignment.product_id) as { customer_id: string };

        let allImages = [];
        if (product && product.customer_id) {
             // 1. Get files from customer_product_files (associated with products)
             const productFiles = db.prepare(`
                SELECT cpf.id, cpf.file_url, cpf.file_name, cpf.thumbnail_url, cpf.type, cpf.created_at, cp.name as product_origin_name
                FROM customer_product_files cpf
                JOIN customer_products cp ON cpf.product_id = cp.id
                WHERE cp.customer_id = ?
             `).all(product.customer_id) as any[];

             // 2. Get files from files table (direct uploads / orders)
             const directFiles = db.prepare(`
                SELECT id, path as file_url, name as file_name, thumbnail as thumbnail_url, type, created_at
                FROM files
                WHERE customer_id = ?
             `).all(product.customer_id) as any[];

             // Add origin context for direct files
             const directFilesWithOrigin = directFiles.map(f => ({
                 ...f,
                 product_origin_name: 'Direkter Upload / Auftrag'
             }));

             // Combine both sources
             allImages = [...productFiles, ...directFilesWithOrigin].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        } else {
             allImages = db.prepare('SELECT * FROM customer_product_files WHERE product_id = ? ORDER BY created_at DESC').all(assignment.product_id);
        }

        res.json({ success: true, data: { assigned: assignedImagesParsed, available: allImages } });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/:shopId/products/:assignmentId/images', (req, res) => {
    try {
        const { assignmentId } = req.params;
        const { file_id } = req.body;
        const id = crypto.randomUUID();

        // Check if already assigned - REMOVED to allow multiple assignments of the same file (e.g. for different variants)
        // const exists = db.prepare('SELECT id FROM shop_product_images WHERE shop_product_assignment_id = ? AND customer_product_file_id = ?').get(assignmentId, file_id);
        // if (exists) return res.json({ success: true, message: 'Already assigned', data: exists }); // Return existing if found

        // Verify existence of foreign keys manually to provide better error messages
        const assignmentExists = db.prepare('SELECT id FROM shop_product_assignments WHERE id = ?').get(assignmentId);
        if (!assignmentExists) {
            return res.status(404).json({ success: false, error: 'Product assignment not found' });
        }

        let fileExists = db.prepare('SELECT id FROM customer_product_files WHERE id = ?').get(file_id);
        
        // If not in customer_product_files, check if it's in global files and migrate it
        if (!fileExists) {
            const globalFile = db.prepare('SELECT * FROM files WHERE id = ?').get(file_id) as any;
            if (globalFile) {
                // Migrate global file to customer_product_file
                // We need the product_id from the assignment
                const assignment = db.prepare('SELECT product_id FROM shop_product_assignments WHERE id = ?').get(assignmentId) as any;
                
                if (assignment) {
                    try {
                        db.prepare(`
                            INSERT INTO customer_product_files (id, product_id, file_url, file_name, thumbnail_url, type, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        `).run(
                            globalFile.id, 
                            assignment.product_id, 
                            globalFile.path, 
                            globalFile.name, 
                            globalFile.thumbnail, 
                            globalFile.type || 'print',
                            globalFile.created_at
                        );
                        fileExists = { id: globalFile.id };
                    } catch (err) {
                        console.error("Migration failed:", err);
                        // If insertion failed, check if it exists now (maybe race condition or ID collision)
                        fileExists = db.prepare('SELECT id FROM customer_product_files WHERE id = ?').get(file_id);
                    }
                }
            }
        }

        if (!fileExists) {
            return res.status(404).json({ success: false, error: 'File not found in product files or global files' });
        }

        // Insert new assignment
        db.prepare(`
            INSERT INTO shop_product_images (id, shop_product_assignment_id, customer_product_file_id, sort_order, personalization_option_ids)
            VALUES (?, ?, ?, 0, '[]')
        `).run(id, assignmentId, file_id);
        
        // Return the newly created assignment object so frontend can add it
        // We need to fetch the file details to return a complete object similar to what GET returns
        const fileDetails = db.prepare('SELECT * FROM customer_product_files WHERE id = ?').get(file_id) as any;
        
        const newAssignment = {
            id: id, // The ID of the LINK
            shop_product_assignment_id: assignmentId,
            customer_product_file_id: file_id,
            sort_order: 0,
            personalization_option_ids: [], // default
            variant_ids: [],
            size_restrictions: [],
            attribute_restrictions: {}, // default
            ...(fileDetails || {}) // Merge file details (url, name, etc.)
        };

        res.json({ success: true, data: newAssignment });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/:shopId/products/:assignmentId/images/:fileId', (req, res) => {
    try {
        const { assignmentId, fileId } = req.params;
        const { personalization_option_ids, variant_ids, size_restrictions, attribute_restrictions } = req.body; // Expect arrays

        // Also update the legacy single column with the first ID or null, just in case
        const legacyId = (personalization_option_ids && personalization_option_ids.length > 0) ? personalization_option_ids[0] : null;

        // Build update query dynamically or just update both
        let updates = [];
        let params = [];
        
        if (personalization_option_ids !== undefined) {
             updates.push('personalization_option_ids = ?');
             params.push(JSON.stringify(personalization_option_ids));
             updates.push('personalization_option_id = ?');
             params.push(legacyId);
        }
        
        if (variant_ids !== undefined) {
             updates.push('variant_ids = ?');
             params.push(JSON.stringify(variant_ids));
        }

        if (size_restrictions !== undefined) {
             updates.push('size_restrictions = ?');
             params.push(JSON.stringify(size_restrictions));
        }
        
        if (attribute_restrictions !== undefined) {
             updates.push('attribute_restrictions = ?');
             params.push(JSON.stringify(attribute_restrictions));
        }
        
        if (updates.length > 0) {
            // Check if fileId is actually a link ID (UUID) or a customer_product_file_id (Integer/String)
            // The frontend sends `img.id` which is now the LINK ID (UUID).
            // But the query below uses `customer_product_file_id = ?`.
            // This is wrong if we want to update a SPECIFIC assignment (link).
            // We should check if we can update by `id` (PK) first.
            
            // Try updating by Primary Key `id` first (assuming fileId is the link ID)
            const result = db.prepare(`
                UPDATE shop_product_images 
                SET ${updates.join(', ')}
                WHERE id = ? AND shop_product_assignment_id = ?
            `).run(...params, fileId, assignmentId);
            
            if (result.changes === 0) {
                 // Fallback: Update by customer_product_file_id (legacy behavior)
                 // This updates ALL assignments of this file for this product
                 db.prepare(`
                    UPDATE shop_product_images 
                    SET ${updates.join(', ')}
                    WHERE shop_product_assignment_id = ? AND customer_product_file_id = ?
                 `).run(...params, assignmentId, fileId);
            }
        }

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/:shopId/products/:assignmentId/images/:linkId', (req, res) => {
    try {
        const { assignmentId, linkId } = req.params;
        // Delete the assignment link by its specific ID (not file ID, to support multi-assign)
        // If the frontend sends the file ID (old behavior), this will fail to delete specific row, 
        // so we must ensure frontend sends the link ID.
        // However, we can also support deleting by file_id as fallback if linkId doesn't match a UUID format or isn't found?
        // No, let's stick to link ID. The table primary key is `id`.
        
        const result = db.prepare('DELETE FROM shop_product_images WHERE id = ? AND shop_product_assignment_id = ?').run(linkId, assignmentId);
        
        if (result.changes === 0) {
            // Fallback: Try to delete by customer_product_file_id (legacy behavior) just in case
            // This is risky for multi-assign, but might be needed if frontend sends file ID
             db.prepare('DELETE FROM shop_product_images WHERE customer_product_file_id = ? AND shop_product_assignment_id = ?').run(linkId, assignmentId);
        }

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Shop Shipping ---

router.get('/shipping/global-config', (req, res) => {
  try {
    const config = db.prepare("SELECT * FROM global_shipping_config WHERE id = 'main'").get() as any;
    
    if (config && config.shipping_tiers) {
        try {
            config.shipping_tiers = JSON.parse(config.shipping_tiers);
        } catch (e) {
            config.shipping_tiers = [];
        }
    }

    res.json({ success: true, data: config || null });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/shipping/global-config', (req, res) => {
  try {
    const { dhl_user, dhl_signature, dhl_ekp, dhl_api_key, dhl_sandbox, dhl_participation, sender_name, sender_street, sender_house_number, sender_zip, sender_city, sender_country, packaging_weight, shipping_tiers } = req.body;

    // Check if record exists
    const existing = db.prepare("SELECT id FROM global_shipping_config WHERE id = 'main'").get();

    if (existing) {
      db.prepare(`
        UPDATE global_shipping_config 
        SET dhl_user = ?, dhl_signature = ?, dhl_ekp = ?, dhl_api_key = ?, dhl_sandbox = ?, dhl_participation = ?, 
            sender_name = ?, sender_street = ?, sender_house_number = ?, 
            sender_zip = ?, sender_city = ?, sender_country = ?, packaging_weight = ?,
            shipping_tiers = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 'main'
      `).run(dhl_user, dhl_signature, dhl_ekp, dhl_api_key, dhl_sandbox ? 1 : 0, dhl_participation || '01', sender_name, sender_street, sender_house_number, sender_zip, sender_city, sender_country || 'DEU', packaging_weight || 0, shipping_tiers ? JSON.stringify(shipping_tiers) : '[]');
    } else {
      db.prepare(`
        INSERT INTO global_shipping_config (id, dhl_user, dhl_signature, dhl_ekp, dhl_api_key, dhl_sandbox, dhl_participation, sender_name, sender_street, sender_house_number, sender_zip, sender_city, sender_country, packaging_weight, shipping_tiers)
        VALUES ('main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(dhl_user, dhl_signature, dhl_ekp, dhl_api_key, dhl_sandbox ? 1 : 0, dhl_participation || '01', sender_name, sender_street, sender_house_number, sender_zip, sender_city, sender_country || 'DEU', packaging_weight || 0, shipping_tiers ? JSON.stringify(shipping_tiers) : '[]');
    }

    const updatedConfig = db.prepare("SELECT * FROM global_shipping_config WHERE id = 'main'").get();
    res.json({ success: true, data: updatedConfig });
  } catch (error: any) {
    console.error('Error saving global shipping config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Global Payment Config
router.get('/payment/global-config', (req, res) => {
    try {
        const config = db.prepare("SELECT * FROM global_payment_config WHERE id = 'main'").get();
        res.json({ success: true, data: config || null });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/payment/global-config', (req, res) => {
    try {
        const { paypal_client_id, paypal_client_secret, paypal_mode } = req.body;

        const existing = db.prepare("SELECT id FROM global_payment_config WHERE id = 'main'").get();
        
        if (existing) {
            db.prepare(`
                UPDATE global_payment_config
                SET paypal_client_id = ?, paypal_client_secret = ?, paypal_mode = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = 'main'
            `).run(paypal_client_id, paypal_client_secret, paypal_mode || 'sandbox');
        } else {
            db.prepare(`
                INSERT INTO global_payment_config (id, paypal_client_id, paypal_client_secret, paypal_mode)
                VALUES ('main', ?, ?, ?)
            `).run(paypal_client_id, paypal_client_secret, paypal_mode || 'sandbox');
        }

        res.json({ success: true });
    } catch (error: any) {
        console.error('Error saving global payment config:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Global Content Config (Footer & Legal)
router.get('/content/global-config', (req, res) => {
    try {
        const config = db.prepare("SELECT * FROM global_shop_content WHERE id = 'main'").get();
        res.json({ success: true, data: config || null });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/content/global-config', (req, res) => {
    try {
        const { 
            footer_logo_url, contact_phone, contact_email, contact_address, opening_hours,
            social_instagram, social_tiktok, social_whatsapp,
            impressum_text, privacy_text, agb_text, revocation_text, shipping_info_text, about_us_text, contact_text
        } = req.body;

        const existing = db.prepare("SELECT id FROM global_shop_content WHERE id = 'main'").get();
        
        if (existing) {
            db.prepare(`
                UPDATE global_shop_content
                SET footer_logo_url = ?, contact_phone = ?, contact_email = ?, contact_address = ?, opening_hours = ?,
                    social_instagram = ?, social_tiktok = ?, social_whatsapp = ?,
                    impressum_text = ?, privacy_text = ?, agb_text = ?, revocation_text = ?, shipping_info_text = ?, about_us_text = ?, contact_text = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = 'main'
            `).run(
                footer_logo_url, contact_phone, contact_email, contact_address, opening_hours,
                social_instagram, social_tiktok, social_whatsapp,
                impressum_text, privacy_text, agb_text, revocation_text, shipping_info_text, about_us_text, contact_text
            );
        } else {
            db.prepare(`
                INSERT INTO global_shop_content (
                    id, footer_logo_url, contact_phone, contact_email, contact_address, opening_hours,
                    social_instagram, social_tiktok, social_whatsapp,
                    impressum_text, privacy_text, agb_text, revocation_text, shipping_info_text, about_us_text, contact_text
                )
                VALUES ('main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                footer_logo_url, contact_phone, contact_email, contact_address, opening_hours,
                social_instagram, social_tiktok, social_whatsapp,
                impressum_text, privacy_text, agb_text, revocation_text, shipping_info_text, about_us_text, contact_text
            );
        }

        res.json({ success: true });
    } catch (error: any) {
        console.error('Error saving global content config:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/shipping/test-config', async (req, res) => {
  try {
    const { dhl_user, dhl_signature, dhl_ekp, dhl_api_key, dhl_sandbox } = req.body;

    if (!dhl_user || !dhl_signature || !dhl_ekp) {
        return res.status(400).json({ success: false, error: 'Unvollständige Daten für den Test. Benutzer, Passwort und EKP sind erforderlich.' });
    }

    // Pass apiKey to client
    const client = new DhlClient(dhl_user, dhl_signature, dhl_ekp, dhl_api_key, !!dhl_sandbox);
    const result = await client.checkConnection();
    res.json(result);

  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:shopId/shipping-config', (req, res) => {
  try {
    const { shopId } = req.params;
    const config = db.prepare('SELECT * FROM shop_shipping_config WHERE shop_id = ?').get(shopId) as any;
    
    if (config && config.shipping_tiers) {
        try {
            config.shipping_tiers = JSON.parse(config.shipping_tiers);
        } catch (e) {
            config.shipping_tiers = [];
        }
    }

    res.json({ success: true, data: config || null });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:shopId/shipping-config', (req, res) => {
  try {
    const { shopId } = req.params;
    const { dhl_user, dhl_signature, dhl_ekp, dhl_api_key, dhl_sandbox, dhl_participation, sender_name, sender_street, sender_house_number, sender_zip, sender_city, sender_country, packaging_weight, shipping_tiers } = req.body;

    db.prepare(`
      INSERT INTO shop_shipping_config (shop_id, dhl_user, dhl_signature, dhl_ekp, dhl_api_key, dhl_sandbox, dhl_participation, sender_name, sender_street, sender_house_number, sender_zip, sender_city, sender_country, packaging_weight, shipping_tiers)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(shop_id) DO UPDATE SET
        dhl_user = excluded.dhl_user,
        dhl_signature = excluded.dhl_signature,
        dhl_ekp = excluded.dhl_ekp,
        dhl_api_key = excluded.dhl_api_key,
        dhl_sandbox = excluded.dhl_sandbox,
        dhl_participation = excluded.dhl_participation,
        sender_name = excluded.sender_name,
        sender_street = excluded.sender_street,
        sender_house_number = excluded.sender_house_number,
        sender_zip = excluded.sender_zip,
        sender_city = excluded.sender_city,
        sender_country = excluded.sender_country,
        packaging_weight = excluded.packaging_weight,
        shipping_tiers = excluded.shipping_tiers
    `).run(
        shopId, 
        dhl_user, 
        dhl_signature, 
        dhl_ekp, 
        dhl_api_key, 
        dhl_sandbox ? 1 : 0, 
        dhl_participation, 
        sender_name, 
        sender_street, 
        sender_house_number, 
        sender_zip, 
        sender_city, 
        sender_country, 
        packaging_weight || 0,
        shipping_tiers ? JSON.stringify(shipping_tiers) : '[]'
    );

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:shopId/shipping/create-label', async (req, res) => {
  try {
    const { shopId } = req.params;
    const { orderId, manualWeight } = req.body; // Receive manualWeight from frontend

    // 1. Get Order Details
    const order = db.prepare(`
        SELECT o.*, sc.first_name, sc.last_name, sc.street, sc.zip, sc.city, sc.phone, sc.email
        FROM orders o
        LEFT JOIN shop_customers sc ON o.shop_customer_id = sc.id
        WHERE o.id = ?
    `).get(orderId) as any;

    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    // 1.1 Cleanup old label/error files for this order
    try {
        const files = await fs.readdir(LABELS_DIR);
        for (const file of files) {
            if (file.includes(`_${order.order_number}_`)) {
                await fs.remove(path.join(LABELS_DIR, file));
            }
        }
    } catch (cleanupErr) {
        console.warn('Cleanup of old labels failed:', cleanupErr);
    }

    // 2. Get Shipping Config (Merge Shop & Global)
    const globalConfig = db.prepare("SELECT * FROM global_shipping_config WHERE id = 'main'").get() as any || {};
    const shopConfig = db.prepare('SELECT * FROM shop_shipping_config WHERE shop_id = ?').get(shopId) as any || {};
    
    // Merge: Use shop value if present (not null/empty), else global
    const config: any = {};
    const keys = [
        'dhl_user', 'dhl_signature', 'dhl_ekp', 'dhl_api_key', 'dhl_sandbox', 'dhl_participation',
        'sender_name', 'sender_street', 'sender_house_number', 'sender_zip', 'sender_city', 'sender_country',
        'packaging_weight'
    ];

    keys.forEach(key => {
        // Special handling for packaging_weight: 0 should inherit from global
        if (key === 'packaging_weight') {
             if (shopConfig[key] && parseFloat(shopConfig[key]) > 0) {
                 config[key] = shopConfig[key];
             } else {
                 config[key] = globalConfig[key];
             }
        } else {
            // Use shop config if it has a value (and not an empty string for text fields)
            if (shopConfig[key] !== null && shopConfig[key] !== undefined && shopConfig[key] !== '') {
                config[key] = shopConfig[key];
            } else {
                config[key] = globalConfig[key];
            }
        }
    });

    if (!config.dhl_user || !config.dhl_signature || !config.dhl_ekp || !config.dhl_api_key) {
        return res.status(400).json({ success: false, error: 'DHL Zugangsdaten unvollständig (User, Pass, EKP, API-Key fehlen).' });
    }

    // 3. Calculate Total Weight
    let totalWeight = 0;
    
    // Check if manual weight is provided
    if (manualWeight && parseFloat(manualWeight) > 0) {
        totalWeight = parseFloat(manualWeight);
        console.log(`Using MANUAL Weight override: ${totalWeight}kg`);
    } else {
        // ... (Original logic) ...
        // Get Order Items
        const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];
        
        console.log(`Calculating weight for Order ${order.order_number} (${orderItems.length} items)...`);
    
        for (const item of orderItems) {
            let itemWeight = 0;
            let product = null;
            
            // 1. Try to find product via item_number (SKU)
            if (item.item_number) {
                // Find product belonging to the shop's owner (customer)
                // First try strict match with customer_id
                product = db.prepare(`
                    SELECT weight, name
                    FROM customer_products 
                    WHERE product_number = ? AND customer_id = ?
                `).get(item.item_number, order.customer_id) as any;
                
                // If not found, try finding ANY product with this SKU (fallback for shared products or wrong customer mapping)
                if (!product) {
                     console.log(`- Strict lookup failed for SKU "${item.item_number}". Trying global lookup...`);
                     product = db.prepare(`
                        SELECT weight, name
                        FROM customer_products 
                        WHERE product_number = ?
                     `).get(item.item_number) as any;
                }
            } else {
                 console.log(`- Item "${item.item_name}": No SKU provided in order.`);
            }
    
            // 2. Fallback: Try to find product by NAME if SKU lookup failed or SKU was missing
            if (!product && item.item_name) {
                 const cleanName = item.item_name.trim();
                 console.log(`- Fallback: Looking up product by Name "${cleanName}" (fuzzy)...`);
                 
                 // Try strict match by name & customer (Case Insensitive)
                 product = db.prepare(`
                    SELECT weight, name
                    FROM customer_products 
                    WHERE LOWER(name) = LOWER(?) AND customer_id = ?
                 `).get(cleanName, order.customer_id) as any;
    
                 if (!product) {
                     // Try global name match (Case Insensitive)
                     console.log(`- Strict name lookup failed. Trying global name lookup (fuzzy)...`);
                     product = db.prepare(`
                        SELECT weight, name
                        FROM customer_products 
                        WHERE LOWER(name) = LOWER(?)
                     `).get(cleanName) as any;
                 }
            }
            
            if (product) {
                // Check if weight is set (allow 0, but log it)
                if (product.weight !== undefined && product.weight !== null) {
                    itemWeight = parseFloat(String(product.weight).replace(',', '.'));
                    console.log(`- Item "${item.item_name}": Found product "${product.name}" with weight ${itemWeight}kg`);
                } else {
                    console.log(`- Item "${item.item_name}": Product found but has no weight property.`);
                }
            } else {
                 console.log(`- Item "${item.item_name}": Product lookup FAILED (SKU: ${item.item_number || 'none'}).`);
            }
            
            totalWeight += (itemWeight * item.quantity);
        }
        
        console.log(`Total Item Weight: ${totalWeight}kg`);
    
        // Add packaging weight from config
        if (config.packaging_weight) {
            const pkgWeight = parseFloat(String(config.packaging_weight).replace(',', '.'));
            console.log(`Adding Packaging Weight: ${pkgWeight}kg`);
            totalWeight += pkgWeight;
        } else {
            console.log('No Packaging Weight configured (or 0).');
        }
    }
    
    console.log(`Final Calculated Weight: ${totalWeight}kg`);

    // Fallback if weight is still 0 (e.g. no products matched or weights not set)
    
    // Fallback if weight is still 0 (e.g. no products matched or weights not set)
    // Use a default minimum or the manually set weight if we had one (but we don't store manual weight yet)
    if (totalWeight <= 0) {
        totalWeight = 1.0; // Default fallback
    }
    
    // Assign calculated weight to order object for DHL Client
    order.weight = totalWeight;

    try {
        const client = new DhlClient(config.dhl_user, config.dhl_signature, config.dhl_ekp, config.dhl_api_key, !!config.dhl_sandbox, config.dhl_participation);
        
        // Prepare Sender Address
        const sender = {
            company: config.sender_name,
            street: config.sender_street,
            street_number: config.sender_house_number,
            zip: config.sender_zip,
            city: config.sender_city,
            country: config.sender_country
        };

        // Create Label
        const result = await client.createLabel(order, sender);
        
        // Update order status
        const labelPath = path.join(LABELS_DIR, `label_${order.order_number}_${Date.now()}.pdf`);
        
        // In a real scenario, we would download the PDF from the URL provided by DHL
        // For now, we store the URL or try to fetch it
        // Since createLabel returns a URL or Data URI, we can try to download/save it
        if (result.labelUrl) {
            try {
                let pdfBuffer;
                
                if (result.labelUrl.startsWith('data:')) {
                    // Handle Data URI (Base64)
                    const base64Data = result.labelUrl.split(',')[1];
                    pdfBuffer = Buffer.from(base64Data, 'base64');
                } else {
                    // Handle HTTP URL
                    const pdfRes = await fetch(result.labelUrl);
                    const arrayBuffer = await pdfRes.arrayBuffer();
                    pdfBuffer = Buffer.from(arrayBuffer);
                }

                await fs.writeFile(labelPath, pdfBuffer);
                
                // Return local URL
                const localUrl = `/labels/${path.basename(labelPath)}`;
                
                // Update Order
                db.prepare(`
                    UPDATE orders 
                    SET status = 'shipped', 
                        tracking_number = ?, 
                        label_url = ?, 
                        shipped_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(result.trackingNumber, localUrl, orderId);

                res.json({ 
                    success: true, 
                    trackingNumber: result.trackingNumber, 
                    labelUrl: localUrl 
                });
            } catch (downloadErr) {
                console.error('Failed to save label PDF:', downloadErr);
                // Fallback: Return the DHL URL/DataURI directly
                res.json({ 
                    success: true, 
                    trackingNumber: result.trackingNumber, 
                    labelUrl: result.labelUrl 
                });
            }
        } else {
            throw new Error('Keine Label-URL von DHL erhalten.');
        }

    } catch (dhlError: any) {
        console.error('DHL Creation Error:', dhlError);
        
        // Generate Error PDF
        const errorDoc = await PDFDocument.create();
        const page = errorDoc.addPage([595, 842]); // A4 size
        const font = await errorDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await errorDoc.embedFont(StandardFonts.HelveticaBold);
        
        page.drawText('DHL FEHLER-PROTOKOLL', { x: 50, y: 800, size: 18, font: fontBold, color: rgb(0.8, 0, 0) });
        
        page.drawText(`Fehler: ${dhlError.message}`, { 
            x: 50, 
            y: 770, 
            size: 12, 
            font, 
            maxWidth: 500,
            lineHeight: 14,
            color: rgb(0, 0, 0)
        });

        if (dhlError.payload) {
            page.drawText('Gesendete Daten (Payload):', { x: 50, y: 700, size: 10, font: fontBold });
            const payloadStr = JSON.stringify(dhlError.payload, null, 2);
            
            // Simple poor man's text wrapping / pagination for payload
            page.drawText(payloadStr.substring(0, 3000), { 
                x: 50, 
                y: 680, 
                size: 8, 
                font, 
                maxWidth: 500,
                lineHeight: 10,
                color: rgb(0.2, 0.2, 0.2)
            });
        }
        
        const pdfBytes = await errorDoc.save();
        const errorFilename = `error_${order.order_number}_${Date.now()}.pdf`;
        await fs.writeFile(path.join(LABELS_DIR, errorFilename), pdfBytes);
        
        // Return success=false but include labelUrl (which points to error PDF)
        // Frontend handles this by offering to open the protocol
        res.json({ 
            success: false, 
            error: dhlError.message,
            labelUrl: `/labels/${errorFilename}`
        });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
