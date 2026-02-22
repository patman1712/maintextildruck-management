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

export default router;