
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
        cp.weight,
        sc.name as category_name,
        sc.slug as category_slug
      FROM shop_product_assignments spa
      JOIN customer_products cp ON spa.product_id = cp.id
      LEFT JOIN shop_categories sc ON spa.category_id = sc.id
      WHERE spa.shop_id = ? AND (spa.is_active = 1 OR spa.is_active IS NULL)
      ORDER BY spa.sort_order ASC, cp.name ASC
    `).all(shopId) as any[];

    console.log(`Fetched ${products.length} active products for shop ${shopId}`);

    // Fetch files for these products.
    // Logic: Use shop_product_images if available, otherwise fallback to customer_product_files.
    // To do this efficiently in one query is tricky, so we iterate or do a complex join.
    // For now, we iterate, as we did in the management API.
    
    // 1. Get all assigned images for these shop products
    const assignmentIds = products.map((p: any) => p.assignment_id);
    if (assignmentIds.length > 0) {
        const placeholders = assignmentIds.map(() => '?').join(',');
        const assignedImages = db.prepare(`
            SELECT cpf.*, spi.shop_product_assignment_id, spi.sort_order, spi.personalization_option_id, spi.personalization_option_ids
            FROM shop_product_images spi
            JOIN customer_product_files cpf ON spi.customer_product_file_id = cpf.id
            WHERE spi.shop_product_assignment_id IN (${placeholders})
            ORDER BY spi.sort_order ASC, spi.created_at ASC
        `).all(...assignmentIds) as any[];

        // Parse JSON for option_ids
        assignedImages.forEach((img: any) => {
             try {
                 img.personalization_option_ids = img.personalization_option_ids ? JSON.parse(img.personalization_option_ids) : [];
                 // Fallback for migration
                 if (img.personalization_option_ids.length === 0 && img.personalization_option_id) {
                     img.personalization_option_ids = [img.personalization_option_id];
                 }
             } catch (e) {
                 img.personalization_option_ids = [];
             }
        });

        // 2. Get all fallback images (if no assigned images)
        // We only need this for assignments that have NO entries in assignedImages
        const assignmentsWithImages = new Set(assignedImages.map((img: any) => img.shop_product_assignment_id));
        
        const productIdsNeedingFallback = products
            .filter((p: any) => !assignmentsWithImages.has(p.assignment_id))
            .map((p: any) => p.product_id);
            
        let fallbackImages: any[] = [];
        if (productIdsNeedingFallback.length > 0) {
            const productPlaceholders = productIdsNeedingFallback.map(() => '?').join(',');
            fallbackImages = db.prepare(`
                SELECT * FROM customer_product_files 
                WHERE product_id IN (${productPlaceholders}) 
                ORDER BY created_at DESC
            `).all(...productIdsNeedingFallback);
        }

        // 3. Attach images to products
        products.forEach((p: any) => {
            if (assignmentsWithImages.has(p.assignment_id)) {
                p.files = assignedImages.filter((img: any) => img.shop_product_assignment_id === p.assignment_id);
            } else {
                p.files = fallbackImages.filter((img: any) => img.product_id === p.product_id);
            }
        });
    } else {
        products.forEach((p: any) => p.files = []);
    }

    res.json({ success: true, data: products });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get shipping config for a shop (public)
router.get('/:id/shipping-config', (req, res) => {
  try {
    const { id } = req.params;
    let shopId = id;

    // Resolve slug if needed
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/)) {
        const shop = db.prepare('SELECT id FROM shops WHERE domain_slug = ?').get(id) as { id: string } | undefined;
        if (!shop) return res.status(404).json({ success: false, error: 'Shop not found' });
        shopId = shop.id;
    }

    const config = db.prepare('SELECT packaging_weight, shipping_tiers FROM shop_shipping_config WHERE shop_id = ?').get(shopId) as any;
    
    // Parse shop tiers
    let shopTiers = [];
    if (config && config.shipping_tiers) {
        try {
            shopTiers = JSON.parse(config.shipping_tiers);
        } catch (e) {
            shopTiers = [];
        }
    }

    // Get global config
    const globalConfig = db.prepare("SELECT shipping_tiers, packaging_weight FROM global_shipping_config WHERE id = 'main'").get() as any;
    let globalTiers = [];
    if (globalConfig && globalConfig.shipping_tiers) {
        try {
            globalTiers = JSON.parse(globalConfig.shipping_tiers);
        } catch (e) {
            globalTiers = [];
        }
    }

    // Determine final tiers: Shop tiers take precedence if they exist and are not empty.
    // However, if shop tiers are empty, we fallback to global tiers.
    const finalTiers = (shopTiers.length > 0) ? shopTiers : globalTiers;

    // Also determine packaging weight: if shop has 0, fallback to global?
    // Current logic in create-label: if shop > 0 use shop, else global.
    let packagingWeight = 0;
    if (config && config.packaging_weight && parseFloat(config.packaging_weight) > 0) {
        packagingWeight = parseFloat(config.packaging_weight);
    } else if (globalConfig && globalConfig.packaging_weight) {
        packagingWeight = parseFloat(globalConfig.packaging_weight);
    }

    res.json({ 
        success: true, 
        data: {
            packaging_weight: packagingWeight,
            shipping_tiers: finalTiers
        } 
    });
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
