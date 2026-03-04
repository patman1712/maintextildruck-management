
import { Router } from 'express';
import db from '../db.js';
import crypto from 'crypto';

const router = Router();

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
      SELECT spa.*, cp.name as product_name, cp.product_number, cp.manufacturer_info, cp.description, cp.size, cp.color, sc.name as category_name
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
    const { category_id, price, is_featured, personalization_enabled, sort_order, manufacturer_info, description, size, variants, personalization_options } = req.body;

    // Update assignment
    db.prepare(`
      UPDATE shop_product_assignments 
      SET category_id = ?, price = ?, is_featured = ?, personalization_enabled = ?, sort_order = ?, variants = ?, personalization_options = ?
      WHERE id = ?
    `).run(
        category_id, 
        price, 
        is_featured ? 1 : 0, 
        personalization_enabled ? 1 : 0, 
        sort_order, 
        variants ? JSON.stringify(variants) : null, 
        personalization_options ? JSON.stringify(personalization_options) : null,
        id
    );

    // Update product details (manufacturer_info, description, size)
    const assignment = db.prepare('SELECT product_id FROM shop_product_assignments WHERE id = ?').get(id) as { product_id: string };
    if (assignment) {
        db.prepare(`
            UPDATE customer_products 
            SET manufacturer_info = ?, description = ?, size = ?
            WHERE id = ?
        `).run(manufacturer_info || null, description || null, size || null, assignment.product_id);
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

// --- Shop Product Images ---

router.get('/:shopId/products/:assignmentId/images', (req, res) => {
    try {
        const { assignmentId } = req.params;
        
        // Get currently assigned images
        const assignedImages = db.prepare(`
            SELECT cpf.*, spi.id as assignment_image_id, spi.sort_order, spi.personalization_option_id, spi.personalization_option_ids
            FROM shop_product_images spi
            JOIN customer_product_files cpf ON spi.customer_product_file_id = cpf.id
            WHERE spi.shop_product_assignment_id = ?
            ORDER BY spi.sort_order ASC
        `).all(assignmentId);

        // Parse JSON for option_ids
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

        // Check if already assigned
        const exists = db.prepare('SELECT id FROM shop_product_images WHERE shop_product_assignment_id = ? AND customer_product_file_id = ?').get(assignmentId, file_id);
        if (exists) return res.json({ success: true, message: 'Already assigned' });

        db.prepare(`
            INSERT INTO shop_product_images (id, shop_product_assignment_id, customer_product_file_id, sort_order, personalization_option_ids)
            VALUES (?, ?, ?, 0, '[]')
        `).run(id, assignmentId, file_id);

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/:shopId/products/:assignmentId/images/:fileId', (req, res) => {
    try {
        const { assignmentId, fileId } = req.params;
        const { personalization_option_ids } = req.body; // Expect array of IDs

        // Also update the legacy single column with the first ID or null, just in case
        const legacyId = (personalization_option_ids && personalization_option_ids.length > 0) ? personalization_option_ids[0] : null;

        db.prepare(`
            UPDATE shop_product_images 
            SET personalization_option_ids = ?, personalization_option_id = ?
            WHERE shop_product_assignment_id = ? AND customer_product_file_id = ?
        `).run(JSON.stringify(personalization_option_ids || []), legacyId, assignmentId, fileId);

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/:shopId/products/:assignmentId/images/:fileId', (req, res) => {
    try {
        const { assignmentId, fileId } = req.params;
        // Delete the assignment link, NOT the file itself
        db.prepare('DELETE FROM shop_product_images WHERE shop_product_assignment_id = ? AND customer_product_file_id = ?').run(assignmentId, fileId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
