
import { Router } from 'express';
import db from '../db.js';
import crypto from 'crypto';

const router = Router();

// List all shops
router.get('/', (req, res) => {
  try {
    const shops = db.prepare('SELECT * FROM shops ORDER BY created_at DESC').all();
    res.json({ success: true, data: shops });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get shop by ID or Slug
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    let shop;
    if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/)) {
        // Assume UUID/ID
        shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(id);
    } else {
        // Assume slug
        shop = db.prepare('SELECT * FROM shops WHERE domain_slug = ?').get(id);
    }

    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }
    
    // Parse JSON fields
    if (shop.dhl_config) shop.dhl_config = JSON.parse(shop.dhl_config);
    if (shop.paypal_config) shop.paypal_config = JSON.parse(shop.paypal_config);

    res.json({ success: true, data: shop });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get public categories for a shop
router.get('/:id/categories', (req, res) => {
  try {
    const { id } = req.params;
    let shopId = id;
    
    // Resolve slug if needed
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/)) {
        const shop = db.prepare('SELECT id FROM shops WHERE domain_slug = ?').get(id) as { id: string } | undefined;
        if (!shop) return res.status(404).json({ success: false, error: 'Shop not found' });
        shopId = shop.id;
    }

    const categories = db.prepare('SELECT * FROM shop_categories WHERE shop_id = ? ORDER BY sort_order ASC').all(shopId);
    res.json({ success: true, data: categories });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get public products for a shop
router.get('/:id/products', (req, res) => {
  try {
    const { id } = req.params;
    let shopId = id;

    // Resolve slug if needed
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/)) {
        const shop = db.prepare('SELECT id FROM shops WHERE domain_slug = ?').get(id) as { id: string } | undefined;
        if (!shop) return res.status(404).json({ success: false, error: 'Shop not found' });
        shopId = shop.id;
    }

    // Join with customer_products to get details, and shop_categories for filtering
    const products = db.prepare(`
      SELECT 
        spa.id as assignment_id,
        spa.price,
        spa.is_featured,
        spa.personalization_enabled,
        spa.category_id,
        spa.sort_order,
        spa.variants,
        spa.personalization_options,
        cp.id as product_id,
        cp.name,
        cp.product_number,
        cp.description,
        cp.manufacturer_info,
        cp.color,
        cp.size,
        sc.name as category_name,
        sc.slug as category_slug
      FROM shop_product_assignments spa
      JOIN customer_products cp ON spa.product_id = cp.id
      LEFT JOIN shop_categories sc ON spa.category_id = sc.id
      WHERE spa.shop_id = ?
      ORDER BY spa.sort_order ASC, cp.name ASC
    `).all(shopId) as any[];

    // Fetch files for these products
    const productIds = products.map((p: any) => p.product_id);
    if (productIds.length > 0) {
        const placeholders = productIds.map(() => '?').join(',');
        const files = db.prepare(`SELECT * FROM customer_product_files WHERE product_id IN (${placeholders}) ORDER BY created_at DESC`).all(...productIds);
        
        // Attach files to products
        products.forEach((p: any) => {
            p.files = files.filter((f: any) => f.product_id === p.product_id);
        });
    } else {
        products.forEach((p: any) => p.files = []);
    }

    res.json({ success: true, data: products });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new shop
router.post('/', (req, res) => {
  try {
    const { customer_id, name, domain_slug, logo_url, primary_color, secondary_color, template, dhl_config, paypal_config } = req.body;
    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO shops (id, customer_id, name, domain_slug, logo_url, primary_color, secondary_color, template, dhl_config, paypal_config)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      customer_id,
      name,
      domain_slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      logo_url,
      primary_color || '#000000',
      secondary_color || '#ffffff',
      template || 'standard',
      dhl_config ? JSON.stringify(dhl_config) : null,
      paypal_config ? JSON.stringify(paypal_config) : null
    );

    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(id);
    res.json({ success: true, data: shop });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update shop
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, domain_slug, logo_url, primary_color, secondary_color, template, dhl_config, paypal_config } = req.body;

    db.prepare(`
      UPDATE shops 
      SET name = ?, domain_slug = ?, logo_url = ?, primary_color = ?, secondary_color = ?, template = ?, dhl_config = ?, paypal_config = ?
      WHERE id = ?
    `).run(
      name,
      domain_slug,
      logo_url,
      primary_color,
      secondary_color,
      template,
      dhl_config ? JSON.stringify(dhl_config) : null,
      paypal_config ? JSON.stringify(paypal_config) : null,
      id
    );

    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(id);
    res.json({ success: true, data: shop });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete shop
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM shops WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
