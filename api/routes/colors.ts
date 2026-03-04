
import { Router } from 'express';
import db from '../db.js';
import crypto from 'crypto';

const router = Router();

// GET all color codes
router.get('/', (req, res) => {
  try {
    const colors = db.prepare('SELECT * FROM color_codes ORDER BY created_at DESC').all();
    res.json({ success: true, data: colors });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST new color code
router.post('/', (req, res) => {
  try {
    const { title, hex_code } = req.body;
    
    if (!title || !hex_code) {
      return res.status(400).json({ success: false, error: 'Title and HEX code are required' });
    }

    const id = crypto.randomUUID();
    db.prepare('INSERT INTO color_codes (id, title, hex_code) VALUES (?, ?, ?)').run(id, title, hex_code);
    
    const newColor = db.prepare('SELECT * FROM color_codes WHERE id = ?').get(id);
    res.json({ success: true, data: newColor });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update color code
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, hex_code } = req.body;

    if (!title || !hex_code) {
      return res.status(400).json({ success: false, error: 'Title and HEX code are required' });
    }

    db.prepare('UPDATE color_codes SET title = ?, hex_code = ? WHERE id = ?').run(title, hex_code, id);
    
    const updatedColor = db.prepare('SELECT * FROM color_codes WHERE id = ?').get(id);
    res.json({ success: true, data: updatedColor });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE color code
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM color_codes WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
