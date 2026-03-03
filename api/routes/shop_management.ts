
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
            SELECT cpf.*, spi.id as assignment_image_id, spi.sort_order
            FROM shop_product_images spi
            JOIN customer_product_files cpf ON spi.customer_product_file_id = cpf.id
            WHERE spi.shop_product_assignment_id = ?
            ORDER BY spi.sort_order ASC
        `).all(assignmentId);

        // Get all available images for the base product
        const assignment = db.prepare('SELECT product_id FROM shop_product_assignments WHERE id = ?').get(assignmentId) as { product_id: string };
        if (!assignment) return res.status(404).json({ success: false, error: 'Assignment not found' });

        const allImages = db.prepare('SELECT * FROM customer_product_files WHERE product_id = ? ORDER BY created_at DESC').all(assignment.product_id);

        res.json({ success: true, data: { assigned: assignedImages, available: allImages } });
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
            INSERT INTO shop_product_images (id, shop_product_assignment_id, customer_product_file_id, sort_order)
            VALUES (?, ?, ?, 0)
        `).run(id, assignmentId, file_id);

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
