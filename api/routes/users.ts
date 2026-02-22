import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import bcrypt from 'bcryptjs';

const router = Router();

// GET all users
router.get('/', (req: Request, res: Response) => {
  const users = db.prepare('SELECT id, username, name, role, created_at FROM users').all();
  res.json({ success: true, data: users });
});

// POST new user
router.post('/', (req: Request, res: Response) => {
  const { username, password, name, role } = req.body;
  
  if (!username || !password || !name) {
    res.status(400).json({ success: false, error: 'Fehlende Felder' });
    return;
  }

  try {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      res.status(409).json({ success: false, error: 'Benutzername bereits vergeben' });
      return;
    }

    const id = Math.random().toString(36).substr(2, 9);
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    db.prepare(`
      INSERT INTO users (id, username, password, name, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, username, hashedPassword, name, role || 'employee');
    
    res.json({ success: true, message: 'Benutzer erstellt', user: { id, username, name, role } });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, error: 'Erstellung fehlgeschlagen' });
  }
});

// PUT update user (password change, name change)
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, password, username, role } = req.body;
  
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      res.status(404).json({ success: false, error: 'Benutzer nicht gefunden' });
      return;
    }

    const updates = [];
    const values = [];

    if (name) { updates.push('name = ?'); values.push(name); }
    if (username) { updates.push('username = ?'); values.push(username); }
    if (role) { updates.push('role = ?'); values.push(role); }
    if (password) { 
      updates.push('password = ?'); 
      values.push(bcrypt.hashSync(password, 10)); 
    }

    if (updates.length > 0) {
      values.push(id);
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    res.json({ success: true, message: 'Benutzer aktualisiert' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, error: 'Aktualisierung fehlgeschlagen' });
  }
});

// DELETE user
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ success: true, message: 'Benutzer gelöscht' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: 'Löschen fehlgeschlagen' });
  }
});

export default router;