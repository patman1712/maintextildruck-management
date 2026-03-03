
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
    const { name, slug, description, image_url, sort_order } = req.body;
    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO shop_categories (id, shop_id, name, slug, description, image_url, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, shopId, name, slug, description, image_url, sort_order || 0);

    const category = db.prepare('SELECT * FROM shop_categories WHERE id = ?').get(id);
    res.json({ success: true, data: category });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:shopId/categories/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, image_url, sort_order } = req.body;

    db.prepare(`
      UPDATE shop_categories 
      SET name = ?, slug = ?, description = ?, image_url = ?, sort_order = ?
      WHERE id = ?
    `).run(name, slug, description, image_url, sort_order, id);

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
      SELECT spa.*, cp.name as product_name, cp.product_number, sc.name as category_name
      FROM shop_product_assignments spa
      JOIN customer_products cp ON spa.product_id = cp.id
      LEFT JOIN shop_categories sc ON spa.category_id = sc.id
      WHERE spa.shop_id = ?
      ORDER BY spa.sort_order ASC
    `).all(shopId);
    res.json({ success: true, data: products });
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
      INSERT INTO shop_product_assignments (id, shop_id, product_id, category_id, price, is_featured, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, shopId, product_id, category_id, price, is_featured ? 1 : 0, sort_order || 0);

    const assignment = db.prepare('SELECT * FROM shop_product_assignments WHERE id = ?').get(id);
    res.json({ success: true, data: assignment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:shopId/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, price, is_featured, sort_order } = req.body;

    db.prepare(`
      UPDATE shop_product_assignments 
      SET category_id = ?, price = ?, is_featured = ?, sort_order = ?
      WHERE id = ?
    `).run(category_id, price, is_featured ? 1 : 0, sort_order, id);

    const assignment = db.prepare('SELECT * FROM shop_product_assignments WHERE id = ?').get(id);
    res.json({ success: true, data: assignment });
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

export default router;
