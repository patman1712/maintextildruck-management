
import { Router } from 'express';
import db from '../db.js';
import crypto from 'crypto';

const router = Router();

// Get all personalization options
router.get('/', (req, res) => {
  try {
    const options = db.prepare('SELECT * FROM personalization_options ORDER BY created_at DESC').all();
    res.json({ success: true, data: options });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create personalization option
router.post('/', (req, res) => {
  try {
    const { name, type, price_adjustment } = req.body;
    
    if (!name || !type) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const id = crypto.randomUUID();
    
    db.prepare(`
      INSERT INTO personalization_options (id, name, type, price_adjustment)
      VALUES (?, ?, ?, ?)
    `).run(id, name, type, price_adjustment || 0);

    const option = db.prepare('SELECT * FROM personalization_options WHERE id = ?').get(id);
    res.json({ success: true, data: option });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update personalization option
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, price_adjustment } = req.body;

    db.prepare(`
      UPDATE personalization_options 
      SET name = ?, type = ?, price_adjustment = ?
      WHERE id = ?
    `).run(name, type, price_adjustment, id);

    const option = db.prepare('SELECT * FROM personalization_options WHERE id = ?').get(id);
    res.json({ success: true, data: option });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete personalization option
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM personalization_options WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
