import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import bcrypt from 'bcryptjs';

const router = Router();

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;
  
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      res.status(401).json({ success: false, error: 'Ungültige Anmeldedaten' });
      return;
    }
    
    // Return user info (excluding password)
    const { password: _, ...userInfo } = user;
    res.json({ success: true, user: userInfo });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login fehlgeschlagen' });
  }
});

// 🔐 Shop-Betreiber Login: nur User mit Rolle 'shop_operator'
router.post('/shop-login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;

    if (!user || !bcrypt.compareSync(password, user.password)) {
      res.status(401).json({ success: false, error: 'Ungültige Anmeldedaten' });
      return;
    }

    if (user.role !== 'shop_operator') {
      res.status(403).json({ success: false, error: 'Dieser Zugang ist nur für Shop-Betreiber vorgesehen.' });
      return;
    }

    // Shop-Zuordnungen + Permissions laden
    const assignments = db.prepare(`
      SELECT so.shop_id, so.permissions_json, s.name AS shop_name, s.domain_slug, s.custom_domain,
             s.primary_color, s.secondary_color, s.template
      FROM shop_operators so
      JOIN shops s ON s.id = so.shop_id
      WHERE so.user_id = ?
      ORDER BY s.name
    `).all(user.id) as any[];

    const shops = assignments.map((a: any) => ({
      id: a.shop_id,
      name: a.shop_name,
      domain_slug: a.domain_slug,
      custom_domain: a.custom_domain,
      primary_color: a.primary_color,
      secondary_color: a.secondary_color,
      template: a.template,
      permissions: (() => {
        try { return JSON.parse(a.permissions_json || '{}'); } catch { return {}; }
      })(),
    }));

    const { password: _, ...userInfo } = user;
    res.json({ success: true, user: userInfo, shops });
  } catch (error) {
    console.error('Shop-login error:', error);
    res.status(500).json({ success: false, error: 'Login fehlgeschlagen' });
  }
});

export default router;