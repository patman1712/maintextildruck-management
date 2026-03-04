
import { Router } from 'express';
import db from '../db.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const router = Router();

// Register a new customer for a shop
router.post('/:shopId/register', async (req, res) => {
  try {
    const { shopId: rawShopId } = req.params;
    let shopId = rawShopId;

    // Resolve slug to UUID if needed
    if (!rawShopId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/)) {
        const shop = db.prepare('SELECT id FROM shops WHERE domain_slug = ?').get(rawShopId) as { id: string } | undefined;
        if (!shop) return res.status(404).json({ success: false, error: 'Shop nicht gefunden.' });
        shopId = shop.id;
    }

    const { 
      email, password, first_name, last_name, 
      company, street, zip, city, phone, 
      data_privacy_accepted 
    } = req.body;

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
    res.status(500).json({ success: false, error: error.message });
  }
});

// Login for a shop customer
router.post('/:shopId/login', async (req, res) => {
  try {
    const { shopId: rawShopId } = req.params;
    let shopId = rawShopId;

    // Resolve slug to UUID if needed
    if (!rawShopId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/)) {
        const shop = db.prepare('SELECT id FROM shops WHERE domain_slug = ?').get(rawShopId) as { id: string } | undefined;
        if (!shop) return res.status(404).json({ success: false, error: 'Shop nicht gefunden.' });
        shopId = shop.id;
    }

    const { email, password } = req.body;

    const customer = db.prepare('SELECT * FROM shop_customers WHERE shop_id = ? AND email = ?').get(shopId, email) as any;
    
    if (!customer || !bcrypt.compareSync(password, customer.password)) {
      return res.status(401).json({ success: false, error: 'Ungültige E-Mail oder Passwort.' });
    }

    const { password: _, ...customerInfo } = customer;
    res.json({ success: true, data: customerInfo });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get all customers for a specific shop
router.get('/:shopId/admin/list', (req, res) => {
  try {
    const { shopId: rawShopId } = req.params;
    let shopId = rawShopId;

    // Resolve slug to UUID if needed
    if (!rawShopId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/)) {
        const shop = db.prepare('SELECT id FROM shops WHERE domain_slug = ?').get(rawShopId) as { id: string } | undefined;
        if (!shop) return res.status(404).json({ success: false, error: 'Shop nicht gefunden.' });
        shopId = shop.id;
    }

    const customers = db.prepare('SELECT id, email, first_name, last_name, company, street, zip, city, phone, created_at FROM shop_customers WHERE shop_id = ? ORDER BY created_at DESC').all(shopId);
    res.json({ success: true, data: customers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
