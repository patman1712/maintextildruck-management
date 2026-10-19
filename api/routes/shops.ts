
import { Router } from 'express';
import db from '../db.js';
import crypto from 'crypto';
import { sendShopContactMessage, DEFAULT_SHOP_CONTACT_RECIPIENT } from '../services/email.js';
import { validateVoucherForShop } from '../services/vouchers.js';

const router = Router();

// 🔧 Helper: Normalisiert hero_images (Backward-Compat für alte String-Arrays)
// Altes Format: ["url1", "url2"] → Neues Format: [{url, link_type, link_target, sort_order}, ...]
function normalizeHeroImages(raw: any): any[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map((item: any, idx: number) => {
    if (typeof item === 'string') {
      return { url: item, link_type: 'none', link_target: null, sort_order: idx };
    }
    if (item && typeof item === 'object') {
      return {
        url: item.url || '',
        link_type: item.link_type || 'none',
        link_target: item.link_target ?? null,
        sort_order: item.sort_order ?? idx,
      };
    }
    return { url: '', link_type: 'none', link_target: null, sort_order: idx };
  }).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

// List all shops
router.get('/', (req, res) => {
  try {
    const shops = db.prepare('SELECT * FROM shops ORDER BY created_at DESC').all() as any[];
    
    // Parse JSON fields for all shops
    shops.forEach(shop => {
        if (shop.dhl_config) shop.dhl_config = JSON.parse(shop.dhl_config);
        if (shop.paypal_config) shop.paypal_config = JSON.parse(shop.paypal_config);
        if (shop.hero_images) shop.hero_images = normalizeHeroImages(JSON.parse(shop.hero_images));
    });

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
        shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(id) as any;
    } else {
        // Assume slug OR custom domain
        // First check by domain_slug
        shop = db.prepare('SELECT * FROM shops WHERE domain_slug = ?').get(id) as any;
        
        // If not found, check by custom_domain
        if (!shop) {
             shop = db.prepare('SELECT * FROM shops WHERE custom_domain = ?').get(id) as any;
        }
    }

    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }
    
    // Parse JSON fields
    if (shop.dhl_config) shop.dhl_config = JSON.parse(shop.dhl_config);
    if (shop.paypal_config) shop.paypal_config = JSON.parse(shop.paypal_config);
    if (shop.hero_images) shop.hero_images = JSON.parse(shop.hero_images);

    // Merge Global Content (Footer/Legal)
    try {
        const globalContent = db.prepare("SELECT * FROM global_shop_content WHERE id = 'main'").get() as any;
        if (globalContent) {
            // List of fields to overwrite
            const contentFields = [
                'footer_logo_url', 'contact_phone', 'contact_email', 'contact_address', 'opening_hours',
                'social_instagram', 'social_tiktok', 'social_whatsapp',
                'impressum_text', 'privacy_text', 'agb_text', 'revocation_text', 'shipping_info_text', 'about_us_text', 'contact_text'
            ];
            
            contentFields.forEach(field => {
                // Only use global content if shop content is empty/null
                if (!shop[field] && globalContent[field]) {
                    shop[field] = globalContent[field];
                }
            });
        }
    } catch (e) {
        console.error('Error fetching global content:', e);
        // Continue without global content if table is missing or error occurs
    }

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
        const shop = db.prepare('SELECT id FROM shops WHERE domain_slug = ? OR custom_domain = ?').get(id, id) as { id: string } | undefined;
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
    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');
    const { id } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : null;
    const featuredOnly = req.query.featured_only === 'true';
    let shopId = id;

    // Resolve slug if needed
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/)) {
        const shop = db.prepare('SELECT id FROM shops WHERE domain_slug = ? OR custom_domain = ?').get(id, id) as { id: string } | undefined;
        if (!shop) return res.status(404).json({ success: false, error: 'Shop not found' });
        shopId = shop.id;
    }

    // Join with customer_products to get details, and shop_categories for filtering
    let query = `
      SELECT 
        spa.id as assignment_id,
        spa.price,
        spa.is_featured,
        spa.personalization_enabled,
        spa.category_id,
        spa.sort_order,
        spa.variants,
        spa.personalization_options,
        spa.stock_enabled,
        spa.stock_quantity,
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
      ${featuredOnly ? 'AND spa.is_featured = 1' : ''}
      ORDER BY spa.sort_order ASC, cp.name ASC
    `;

    if (limit) {
        query += ` LIMIT ${limit}`;
    }

    const products = db.prepare(query).all(shopId) as any[];

    console.log(`Fetched ${products.length} active products for shop ${shopId}`);

    // Fetch files for these products.
    // Logic: Use shop_product_images if available, otherwise fallback to customer_product_files.
    // To do this efficiently in one query is tricky, so we iterate or do a complex join.
    // For now, we iterate, as we did in the management API.
    
    // 1. Get all assigned images for these shop products
    const assignmentIds = products.map((p: any) => p.assignment_id);
    
    // NEW: Fetch all category assignments for these products
    let categoryMappings: any[] = [];
    if (assignmentIds.length > 0) {
        const placeholders = assignmentIds.map(() => '?').join(',');
        categoryMappings = db.prepare(`
            SELECT spac.shop_product_assignment_id, spac.category_id, sc.slug
            FROM shop_product_assignment_categories spac
            JOIN shop_categories sc ON spac.category_id = sc.id
            WHERE spac.shop_product_assignment_id IN (${placeholders})
        `).all(...assignmentIds);
    }

    if (assignmentIds.length > 0) {
        const placeholders = assignmentIds.map(() => '?').join(',');
        const assignedImages = db.prepare(`
            SELECT cpf.*, spi.shop_product_assignment_id, spi.sort_order, spi.personalization_option_id, spi.personalization_option_ids, spi.variant_ids, spi.size_restrictions, spi.attribute_restrictions
            FROM shop_product_images spi
            JOIN customer_product_files cpf ON spi.customer_product_file_id = cpf.id
            WHERE spi.shop_product_assignment_id IN (${placeholders})
            ORDER BY spi.sort_order ASC, spi.created_at ASC
        `).all(...assignmentIds) as any[];

        // Parse JSON for option_ids, variant_ids, and size_restrictions
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

        // 3. Attach images AND categories to products
        products.forEach((p: any) => {
            // Attach images
            if (assignmentsWithImages.has(p.assignment_id)) {
                p.files = assignedImages.filter((img: any) => img.shop_product_assignment_id === p.assignment_id);
            } else {
                p.files = fallbackImages.filter((img: any) => img.product_id === p.product_id);
            }
            
            // Attach extra categories
            const myCategories = categoryMappings.filter((m: any) => m.shop_product_assignment_id === p.assignment_id);
            p.category_ids = myCategories.map((m: any) => m.category_id);
            p.category_slugs = myCategories.map((m: any) => m.slug);
            
            // Ensure the primary category is included if not already (legacy fallback)
            if (p.category_id && !p.category_ids.includes(p.category_id)) {
                p.category_ids.push(p.category_id);
                if (p.category_slug && !p.category_slugs.includes(p.category_slug)) {
                    p.category_slugs.push(p.category_slug);
                }
            }

            // 🔴 KRITISCHER FIX: Wenn Junction-Tabelle leer ist (myCategories.length === 0)
            // ODER category_slugs trotzdem leer bleiben, dann Fallback aus spa.category_slug!
            if (p.category_slugs.length === 0 && p.category_slug) {
                p.category_slugs = [p.category_slug];
            }
            if (p.category_ids.length === 0 && p.category_id) {
                p.category_ids = [p.category_id];
            }
        });
    } else {
        products.forEach((p: any) => {
            p.files = [];
            p.category_ids = p.category_id ? [p.category_id] : [];
            p.category_slugs = p.category_slug ? [p.category_slug] : [];
        });
    }

    res.json({ success: true, data: products });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search public products for a shop
router.get('/:id/search', (req, res) => {
  try {
    const { id } = req.params;
    const query = req.query.q as string;
    let shopId = id;

    if (!query || query.length < 2) {
        return res.json({ success: true, data: [] });
    }

    // Resolve slug if needed
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/)) {
        const shop = db.prepare('SELECT id FROM shops WHERE domain_slug = ? OR custom_domain = ?').get(id, id) as { id: string } | undefined;
        if (!shop) return res.status(404).json({ success: false, error: 'Shop not found' });
        shopId = shop.id;
    }

    // Search query
    const sql = `
      SELECT 
        spa.id as assignment_id,
        spa.price,
        spa.is_featured,
        spa.personalization_enabled,
        spa.category_id,
        spa.stock_enabled,
        spa.stock_quantity,
        cp.id as product_id,
        cp.name,
        cp.product_number,
        cp.description,
        cp.color,
        cp.size
      FROM shop_product_assignments spa
      JOIN customer_products cp ON spa.product_id = cp.id
      WHERE spa.shop_id = ? 
      AND (spa.is_active = 1 OR spa.is_active IS NULL)
      AND (
          cp.name LIKE ? OR 
          cp.product_number LIKE ? OR
          cp.description LIKE ?
      )
      ORDER BY cp.name ASC
      LIMIT 20
    `;

    const searchTerm = `%${query}%`;
    const products = db.prepare(sql).all(shopId, searchTerm, searchTerm, searchTerm) as any[];

    // Fetch images for these products (simplified for search results)
    const productIds = products.map((p: any) => p.product_id);
    if (productIds.length > 0) {
        const placeholders = productIds.map(() => '?').join(',');
        
        // Try to get one image per product
        const images = db.prepare(`
            SELECT product_id, file_url, thumbnail_url 
            FROM customer_product_files 
            WHERE product_id IN (${placeholders})
            GROUP BY product_id
        `).all(...productIds) as any[];

        products.forEach((p: any) => {
            const img = images.find((i: any) => i.product_id === p.product_id);
            if (img) {
                p.files = [{
                    file_url: img.file_url,
                    thumbnail_url: img.thumbnail_url
                }];
            } else {
                p.files = [];
            }
        });
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
        const shop = db.prepare('SELECT id FROM shops WHERE domain_slug = ? OR custom_domain = ?').get(id, id) as { id: string } | undefined;
        if (!shop) return res.status(404).json({ success: false, error: 'Shop not found' });
        shopId = shop.id;
    }

    const config = db.prepare('SELECT packaging_weight, shipping_tiers, pickup_enabled, pickup_fee FROM shop_shipping_config WHERE shop_id = ?').get(shopId) as any;
    
    // 🚚 Eigene Versandkosten für diesen Shop? Dann keine Standardpreise verwenden.
    const shippingSettings = db.prepare('SELECT custom_shipping_enabled, free_shipping_threshold FROM shops WHERE id = ?').get(shopId) as any;
    const customShippingEnabled = Number(shippingSettings?.custom_shipping_enabled || 0) === 1;
    const freeShippingThreshold = (shippingSettings?.free_shipping_threshold === null || shippingSettings?.free_shipping_threshold === undefined)
        ? null
        : Number(shippingSettings.free_shipping_threshold);

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
    const globalConfig = db.prepare("SELECT shipping_tiers, packaging_weight, pickup_enabled, pickup_fee, pickup_email_template FROM global_shipping_config WHERE id = 'main'").get() as any;
    let globalTiers = [];
    if (globalConfig && globalConfig.shipping_tiers) {
        try {
            globalTiers = JSON.parse(globalConfig.shipping_tiers);
        } catch (e) {
            globalTiers = [];
        }
    }

    // Determine final tiers.
    // Eigene Versandkosten aktiv → ausschließlich die Shop-Staffel (kein Fallback auf Standard).
    // Sonst: Shop-Staffel hat Vorrang, ansonsten gelten die globalen Standardpreise.
    const finalTiers = customShippingEnabled
        ? shopTiers
        : ((shopTiers.length > 0) ? shopTiers : globalTiers);

    let packagingWeight = 0;
    if (customShippingEnabled) {
        packagingWeight = config && config.packaging_weight ? (parseFloat(config.packaging_weight) || 0) : 0;
    } else if (config && config.packaging_weight && parseFloat(config.packaging_weight) > 0) {
        packagingWeight = parseFloat(config.packaging_weight);
    } else if (globalConfig && globalConfig.packaging_weight) {
        packagingWeight = parseFloat(globalConfig.packaging_weight);
    }

    const shopPickupOn = !!(config && (config.pickup_enabled === true || config.pickup_enabled === 1 || Number(config.pickup_enabled) > 0));
    const globalPickupOn = !!(globalConfig && (globalConfig.pickup_enabled === true || globalConfig.pickup_enabled === 1 || Number(globalConfig.pickup_enabled) > 0));

    let pickupEnabled = false;
    let pickupFee = 0;
    if (shopPickupOn) {
        pickupEnabled = true;
        pickupFee = Number(config.pickup_fee || (customShippingEnabled ? 0 : globalConfig?.pickup_fee) || 0);
    } else if (!customShippingEnabled && globalPickupOn) {
        pickupEnabled = true;
        pickupFee = Number(globalConfig.pickup_fee || 0);
    }

    res.json({ 
        success: true, 
        data: {
            packaging_weight: packagingWeight,
            shipping_tiers: finalTiers,
            pickup_enabled: pickupEnabled,
            pickup_fee: pickupFee,
            custom_shipping_enabled: customShippingEnabled,
            free_shipping_threshold: freeShippingThreshold
        } 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🎟️ Gutscheincode prüfen (öffentlich, für Warenkorb/Checkout).
// Der Rabatt bezieht sich nur auf den Warenwert (subtotal), nie auf die Versandkosten.
router.post('/:id/voucher/validate', (req, res) => {
  try {
    const { id } = req.params;
    const shopRow = id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/)
      ? db.prepare('SELECT id FROM shops WHERE id = ?').get(id)
      : db.prepare('SELECT id FROM shops WHERE domain_slug = ? OR custom_domain = ?').get(id, id);
    const shop = shopRow as any;
    if (!shop) return res.status(404).json({ success: false, valid: false, error: 'Shop nicht gefunden.' });

    const subtotal = Math.max(0, Number(req.body?.subtotal) || 0);
    const result = validateVoucherForShop({
      shopId: shop.id,
      code: String(req.body?.code || ''),
      subtotal,
      customerEmail: req.body?.email || null,
      customerId: req.body?.customerId || null,
    });

    if (!result.ok) {
      return res.json({ success: true, valid: false, error: result.error });
    }

    res.json({
      success: true,
      valid: true,
      code: result.voucher.code,
      discount_type: result.voucher.discount_type === 'fixed' ? 'fixed' : 'percent',
      discount_value: Number(result.voucher.discount_value || 0),
      discount: Math.min(result.discount, subtotal),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, valid: false, error: error.message });
  }
});

// Kontaktformular: sendet eine Nachricht an die Shop-E-Mail (Fallback: Firmenadresse)
const contactRateLimit = new Map<string, number>();
const CONTACT_RATE_LIMIT_MS = 30 * 1000;

router.post('/:id/contact', async (req, res) => {
  try {
    const { id } = req.params;

    const shopId = id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/)
      ? db.prepare('SELECT id, name, notification_email FROM shops WHERE id = ?').get(id)
      : db.prepare('SELECT id, name, notification_email FROM shops WHERE domain_slug = ? OR custom_domain = ?').get(id, id);

    const shop = shopId as any;
    if (!shop) return res.status(404).json({ success: false, error: 'Shop nicht gefunden.' });

    const body = req.body as any;
    const firstName = String(body?.firstName || '').trim().slice(0, 100);
    const lastName = String(body?.lastName || '').trim().slice(0, 100);
    const email = String(body?.email || '').trim().slice(0, 200);
    const subject = String(body?.subject || '').trim().slice(0, 200);
    const message = String(body?.message || '').trim().slice(0, 5000);

    if (!message) {
      return res.status(400).json({ success: false, error: 'Bitte gib eine Nachricht ein.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Bitte gib eine gültige E-Mail-Adresse ein.' });
    }

    // Einfaches Rate-Limit gegen Spam (pro IP)
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const lastSent = contactRateLimit.get(ip) || 0;
    if (Date.now() - lastSent < CONTACT_RATE_LIMIT_MS) {
      return res.status(429).json({ success: false, error: 'Bitte warte einen Moment, bevor du erneut sendest.' });
    }

    // Empfänger: Shop-eigene E-Mail → globale Shop-Kontaktadresse → Firmen-Fallback
    const globalContent = db.prepare("SELECT contact_email, order_notification_email FROM global_shop_content WHERE id = 'main'").get() as any;
    const recipient =
      (shop.notification_email || '').trim() ||
      (globalContent?.contact_email || '').trim() ||
      (globalContent?.order_notification_email || '').trim() ||
      DEFAULT_SHOP_CONTACT_RECIPIENT;

    const sent = await sendShopContactMessage({
      to: recipient,
      shopName: shop.name || 'Onlineshop',
      firstName,
      lastName,
      email,
      subject,
      message,
    });

    if (!sent) {
      return res.status(500).json({ success: false, error: 'Die Nachricht konnte nicht versendet werden. Bitte später erneut versuchen.' });
    }

    contactRateLimit.set(ip, Date.now());
    res.json({ success: true, data: { recipient } });
  } catch (error: any) {
    console.error('Shop contact form error:', error);
    res.status(500).json({ success: false, error: 'Die Nachricht konnte nicht versendet werden.' });
  }
});

// Create new shop
router.post('/', (req, res) => {
  try {
    const body = req.body as any;
    const { customer_id, name, domain_slug, custom_domain, logo_url, primary_color, secondary_color, template, dhl_config, paypal_config } = body;
    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO shops (id, customer_id, name, domain_slug, custom_domain, logo_url, primary_color, secondary_color, template, dhl_config, paypal_config)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      customer_id,
      name,
      domain_slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      custom_domain || null,
      logo_url,
      primary_color || '#000000',
      secondary_color || '#ffffff',
      template || 'standard',
      dhl_config ? JSON.stringify(dhl_config) : null,
      paypal_config ? JSON.stringify(paypal_config) : null
    );

    const shop: any = db.prepare('SELECT * FROM shops WHERE id = ?').get(id);
    
    // Parse JSON fields before returning
    if (shop) {
        if (shop.dhl_config) shop.dhl_config = JSON.parse(shop.dhl_config);
        if (shop.paypal_config) shop.paypal_config = JSON.parse(shop.paypal_config);
        if (shop.hero_images) shop.hero_images = normalizeHeroImages(JSON.parse(shop.hero_images));
    }

    res.json({ success: true, data: shop });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update shop
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body as any;
    const { 
        name, domain_slug, custom_domain, logo_url, email_logo_url,
        notification_email,
        primary_color, secondary_color, template, 
        dhl_config, paypal_config,
        donations_enabled,
        vouchers_enabled,
        custom_shipping_enabled,
        free_shipping_threshold,
        order_number_circle, next_order_number,
        invoice_number_circle, next_invoice_number,
        hero_enabled,
        guest_checkout_enabled,
        hero_images,
        welcome_text,
        footer_logo_url, contact_phone, contact_email, contact_address, opening_hours,
        social_instagram, social_tiktok, social_whatsapp,
        impressum_text, privacy_text, agb_text, revocation_text, shipping_info_text, about_us_text, contact_text
    } = body;

    // 🎟️ Gutschein-Freigabe darf NUR ein Administrator ändern.
    // Ohne x-user-id Header (internes Admin-Frontend) bleibt die Änderung erlaubt.
    const voucherRequesterId = req.headers['x-user-id'] as string | undefined;
    let canEditVouchers = true;
    if (voucherRequesterId) {
        const requester = db.prepare('SELECT role FROM users WHERE id = ?').get(voucherRequesterId) as any;
        canEditVouchers = !!requester && requester.role === 'admin';
    }
    const existingShop = db.prepare('SELECT vouchers_enabled, custom_shipping_enabled, free_shipping_threshold FROM shops WHERE id = ?').get(id) as any;
    const resolvedVouchersEnabled = canEditVouchers
        ? (vouchers_enabled ? 1 : 0)
        : Number(existingShop?.vouchers_enabled || 0);

    // 🚚 Eigene Versandkosten + "versandkostenfrei ab" darf ebenfalls NUR ein Administrator ändern.
    const resolvedCustomShipping = canEditVouchers
        ? (custom_shipping_enabled ? 1 : 0)
        : Number(existingShop?.custom_shipping_enabled || 0);
    const resolvedFreeShippingThreshold = canEditVouchers
        ? (free_shipping_threshold === null || free_shipping_threshold === undefined || free_shipping_threshold === ''
            ? null
            : Number(free_shipping_threshold))
        : (existingShop?.free_shipping_threshold ?? null);

    const query = `
      UPDATE shops 
      SET name = ?, domain_slug = ?, custom_domain = ?, logo_url = ?, email_logo_url = ?,
          notification_email = ?,
          primary_color = ?, secondary_color = ?, template = ?, 
          dhl_config = ?, paypal_config = ?,
          donations_enabled = ?,
          vouchers_enabled = ?,
          custom_shipping_enabled = ?,
          free_shipping_threshold = ?,
          order_number_circle = ?, next_order_number = ?,
          invoice_number_circle = ?, next_invoice_number = ?,
          hero_enabled = ?,
          guest_checkout_enabled = ?,
          hero_images = ?,
          welcome_text = ?
      WHERE id = ?
    `;

    const stmt = db.prepare(query);
    stmt.run(
      name,
      domain_slug,
      custom_domain || null,
      logo_url,
      email_logo_url || null,
      notification_email || null,
      primary_color,
      secondary_color,
      template,
      dhl_config ? JSON.stringify(dhl_config) : null,
      paypal_config ? JSON.stringify(paypal_config) : null,
      donations_enabled ? 1 : 0,
      resolvedVouchersEnabled,
      resolvedCustomShipping,
      resolvedFreeShippingThreshold,
      order_number_circle || null,
      next_order_number || 1,
      invoice_number_circle || null,
      next_invoice_number || 1,
      hero_enabled === false || hero_enabled === 0 ? 0 : 1,
      guest_checkout_enabled === false || guest_checkout_enabled === 0 ? 0 : 1,
      hero_images ? JSON.stringify(hero_images) : null,
      welcome_text || null,
      id
    );

    const shop: any = db.prepare('SELECT * FROM shops WHERE id = ?').get(id);

    // Parse JSON fields before returning
    if (shop) {
        if (shop.dhl_config) shop.dhl_config = JSON.parse(shop.dhl_config);
        if (shop.paypal_config) shop.paypal_config = JSON.parse(shop.paypal_config);
        if (shop.hero_images) shop.hero_images = normalizeHeroImages(JSON.parse(shop.hero_images));
    }

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
