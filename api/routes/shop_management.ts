
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
    const { category_id, price, is_featured, personalization_enabled, sort_order, manufacturer_info, description, size, variants, personalization_options, weight } = req.body;

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

// --- Shop Shipping ---

router.get('/shipping/global-config', (req, res) => {
  try {
    const config = db.prepare("SELECT * FROM global_shipping_config WHERE id = 'main'").get();
    res.json({ success: true, data: config || null });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/shipping/global-config', (req, res) => {
  try {
    const { dhl_user, dhl_signature, dhl_ekp, dhl_api_key, dhl_participation, sender_name, sender_street, sender_house_number, sender_zip, sender_city, sender_country } = req.body;

    // Check if record exists
    const existing = db.prepare("SELECT id FROM global_shipping_config WHERE id = 'main'").get();

    if (existing) {
      db.prepare(`
        UPDATE global_shipping_config 
        SET dhl_user = ?, dhl_signature = ?, dhl_ekp = ?, dhl_api_key = ?, dhl_participation = ?, 
            sender_name = ?, sender_street = ?, sender_house_number = ?, 
            sender_zip = ?, sender_city = ?, sender_country = ?, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 'main'
      `).run(dhl_user, dhl_signature, dhl_ekp, dhl_api_key, dhl_participation || '01', sender_name, sender_street, sender_house_number, sender_zip, sender_city, sender_country || 'DEU');
    } else {
      db.prepare(`
        INSERT INTO global_shipping_config (id, dhl_user, dhl_signature, dhl_ekp, dhl_api_key, dhl_participation, sender_name, sender_street, sender_house_number, sender_zip, sender_city, sender_country)
        VALUES ('main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(dhl_user, dhl_signature, dhl_ekp, dhl_api_key, dhl_participation || '01', sender_name, sender_street, sender_house_number, sender_zip, sender_city, sender_country || 'DEU');
    }

    const updatedConfig = db.prepare("SELECT * FROM global_shipping_config WHERE id = 'main'").get();
    res.json({ success: true, data: updatedConfig });
  } catch (error: any) {
    console.error('Error saving global shipping config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/shipping/test-config', async (req, res) => {
  try {
    const { dhl_user, dhl_signature, dhl_ekp, dhl_api_key } = req.body;

    if (!dhl_user || !dhl_signature || !dhl_ekp) {
        return res.status(400).json({ success: false, error: 'Unvollständige Daten für den Test. Benutzer, Passwort und EKP sind erforderlich.' });
    }

    // Pass apiKey to client
    const client = new DhlClient(dhl_user, dhl_signature, dhl_ekp, dhl_api_key);
    const result = await client.checkConnection();
    res.json(result);

  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:shopId/shipping-config', (req, res) => {
  try {
    const { shopId } = req.params;
    const config = db.prepare('SELECT * FROM shop_shipping_config WHERE shop_id = ?').get(shopId);
    res.json({ success: true, data: config || null });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:shopId/shipping-config', (req, res) => {
  try {
    const { shopId } = req.params;
    const { dhl_user, dhl_signature, dhl_ekp, dhl_api_key, dhl_participation, sender_name, sender_street, sender_house_number, sender_zip, sender_city, sender_country } = req.body;

    db.prepare(`
      INSERT INTO shop_shipping_config (shop_id, dhl_user, dhl_signature, dhl_ekp, dhl_api_key, dhl_participation, sender_name, sender_street, sender_house_number, sender_zip, sender_city, sender_country)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(shop_id) DO UPDATE SET
        dhl_user = excluded.dhl_user,
        dhl_signature = excluded.dhl_signature,
        dhl_ekp = excluded.dhl_ekp,
        dhl_api_key = excluded.dhl_api_key,
        dhl_participation = excluded.dhl_participation,
        sender_name = excluded.sender_name,
        sender_street = excluded.sender_street,
        sender_house_number = excluded.sender_house_number,
        sender_zip = excluded.sender_zip,
        sender_city = excluded.sender_city,
        sender_country = excluded.sender_country
    `).run(shopId, dhl_user, dhl_signature, dhl_ekp, dhl_api_key, dhl_participation, sender_name, sender_street, sender_house_number, sender_zip, sender_city, sender_country);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:shopId/shipping/create-label', async (req, res) => {
  try {
    const { shopId } = req.params;
    const { orderId } = req.body;

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

    // 2. Get Shipping Config (Check Shop-specific first, then Global)
    let config = db.prepare('SELECT * FROM shop_shipping_config WHERE shop_id = ?').get(shopId) as any;
    
    if (!config || !config.dhl_user) {
        // Fallback to Global Config
        config = db.prepare("SELECT * FROM global_shipping_config WHERE id = 'main'").get() as any;
    }

    if (!config.dhl_user || !config.dhl_signature || !config.dhl_ekp) {
        return res.status(400).json({ success: false, error: 'DHL Zugangsdaten unvollständig.' });
    }

    try {
        const client = new DhlClient(config.dhl_user, config.dhl_signature, config.dhl_ekp, config.dhl_api_key);
        
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
        // Since createLabel returns a URL, we can try to download it
        if (result.labelUrl) {
            try {
                const pdfRes = await fetch(result.labelUrl);
                const pdfBuffer = await pdfRes.arrayBuffer();
                await fs.writeFile(labelPath, Buffer.from(pdfBuffer));
                
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
                console.error('Failed to download label PDF:', downloadErr);
                // Fallback: Return the DHL URL directly
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
        const page = errorDoc.addPage([400, 600]);
        const font = await errorDoc.embedFont(StandardFonts.Helvetica);
        
        page.drawText('DHL FEHLER-PROTOKOLL', { x: 50, y: 550, size: 18, font, color: rgb(0.8, 0, 0) });
        page.drawText(`Fehler: ${dhlError.message}`, { x: 50, y: 500, size: 10, font, maxWidth: 300 });
        
        const pdfBytes = await errorDoc.save();
        const errorFilename = `error_${order.order_number}_${Date.now()}.pdf`;
        await fs.writeFile(path.join(LABELS_DIR, errorFilename), pdfBytes);
        
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
