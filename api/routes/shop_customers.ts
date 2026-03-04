
import { Router } from 'express';
import db from '../db.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const router = Router();

// Helper to resolve shopId from either ID or Slug
const resolveShopId = (idOrSlug: string): string | null => {
    // Try finding by ID first
    let shop = db.prepare('SELECT id FROM shops WHERE id = ?').get(idOrSlug) as { id: string } | undefined;
    if (shop) return shop.id;

    // Try finding by Slug
    shop = db.prepare('SELECT id FROM shops WHERE domain_slug = ?').get(idOrSlug) as { id: string } | undefined;
    if (shop) return shop.id;

    return null;
};

// Register a new customer for a shop
router.post('/:shopId/register', async (req, res) => {
  try {
    const { shopId: rawShopId } = req.params;
    const shopId = resolveShopId(rawShopId);
    
    console.log(`[Register] Resolving ShopID: ${rawShopId} -> ${shopId}`);

    if (!shopId) {
        console.error(`[Register] Shop not found for: ${rawShopId}`);
        return res.status(404).json({ success: false, error: 'Shop nicht gefunden.' });
    }

    const { 
      email: rawEmail, password, first_name, last_name, 
      company, street, zip, city, phone, 
      data_privacy_accepted 
    } = req.body;

    const email = rawEmail?.toLowerCase().trim();

    if (!email || !password || !data_privacy_accepted) {
      return res.status(400).json({ success: false, error: 'E-Mail, Passwort und Datenschutz-Zustimmung sind erforderlich.' });
    }

    // Check if customer already exists for this shop
    const existing = db.prepare('SELECT id FROM shop_customers WHERE shop_id = ? AND email = ?').get(shopId, email);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Ein Konto mit dieser E-Mail existiert bereits in diesem Shop.' });
    }

    const id = crypto.randomUUID();
    const hashedPassword = bcrypt.hashSync(password, 10);

    console.log(`[Register] Creating customer: ${email} for shop: ${shopId}`);

    db.prepare(`
      INSERT INTO shop_customers (
        id, shop_id, email, password, first_name, last_name, 
        company, street, zip, city, phone, data_privacy_accepted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, shopId, email, hashedPassword, first_name, last_name, 
      company, street, zip, city, phone, data_privacy_accepted ? 1 : 0
    );

    const customer = db.prepare('SELECT id, shop_id, email, first_name, last_name, company, street, zip, city, phone FROM shop_customers WHERE id = ?').get(id);
    res.json({ success: true, data: customer });
  } catch (error: any) {
    console.error(`[Register] Error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Login for a shop customer
router.post('/:shopId/login', async (req, res) => {
  try {
    const { shopId: rawShopId } = req.params;
    const shopId = resolveShopId(rawShopId);

    console.log(`[Login] Resolving ShopID: ${rawShopId} -> ${shopId}`);

    if (!shopId) {
        console.error(`[Login] Shop not found for: ${rawShopId}`);
        return res.status(404).json({ success: false, error: 'Shop nicht gefunden.' });
    }

    const { email: rawEmail, password } = req.body;
    const email = rawEmail?.toLowerCase().trim();

    console.log(`[Login] Attempt for email: ${email} in shop: ${shopId}`);

    const customer = db.prepare('SELECT * FROM shop_customers WHERE shop_id = ? AND email = ?').get(shopId, email) as any;
    
    if (!customer) {
      console.warn(`[Login] Customer not found: ${email}`);
      return res.status(401).json({ success: false, error: 'Ungültige E-Mail oder Passwort.' });
    }

    if (!bcrypt.compareSync(password, customer.password)) {
      console.warn(`[Login] Password mismatch: ${email}`);
      return res.status(401).json({ success: false, error: 'Ungültige E-Mail oder Passwort.' });
    }

    console.log(`[Login] Success: ${email}`);
    const { password: _, ...customerInfo } = customer;
    res.json({ success: true, data: customerInfo });
  } catch (error: any) {
    console.error(`[Login] Error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get all customers for a specific shop
router.get('/:shopId/admin/list', (req, res) => {
  try {
    const { shopId: rawShopId } = req.params;
    const shopId = resolveShopId(rawShopId);

    if (!shopId) {
        return res.status(404).json({ success: false, error: 'Shop nicht gefunden.' });
    }

    const customers = db.prepare('SELECT id, email, first_name, last_name, company, street, zip, city, phone, created_at FROM shop_customers WHERE shop_id = ? ORDER BY created_at DESC').all(shopId);
    res.json({ success: true, data: customers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update shop customer profile
router.put('/:shopId/profile/:customerId', async (req, res) => {
  try {
    const { shopId: rawShopId, customerId } = req.params;
    const shopId = resolveShopId(rawShopId);

    if (!shopId) {
        return res.status(404).json({ success: false, error: 'Shop nicht gefunden.' });
    }

    // Check if customer exists
    const existing = db.prepare('SELECT id FROM shop_customers WHERE id = ?').get(customerId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Kunde nicht gefunden.' });
    }

    // Update basic info
    let query = `
      UPDATE shop_customers 
      SET email = ?, first_name = ?, last_name = ?, company = ?, 
          street = ?, zip = ?, city = ?, phone = ?
    `;
    const params = [email, first_name, last_name, company, street, zip, city, phone];

    // Update password if provided
    if (password && password.trim() !== '') {
      const hashedPassword = bcrypt.hashSync(password, 10);
      query += `, password = ?`;
      params.push(hashedPassword);
    }

    query += ` WHERE id = ?`;
    params.push(customerId);

    db.prepare(query).run(...params);

    const updated = db.prepare('SELECT id, shop_id, email, first_name, last_name, company, street, zip, city, phone FROM shop_customers WHERE id = ?').get(customerId);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
