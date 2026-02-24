import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET all FAQs
router.get('/', (req, res) => {
  try {
    const faqs = db.prepare('SELECT * FROM faqs ORDER BY sort_order ASC, created_at DESC').all();
    res.json({ success: true, data: faqs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Failed to fetch FAQs' });
  }
});

// POST new FAQ
router.post('/', (req, res) => {
  const { question, answer } = req.body;
  if (!question || !answer) return res.status(400).json({ success: false, error: 'Missing fields' });
  
  try {
    const id = Math.random().toString(36).substr(2, 9);
    // Get max sort order
    const maxSort = db.prepare('SELECT MAX(sort_order) as max FROM faqs').get() as { max: number };
    const nextSort = (maxSort.max || 0) + 1;
    
    db.prepare('INSERT INTO faqs (id, question, answer, sort_order) VALUES (?, ?, ?, ?)').run(id, question, answer, nextSort);
    res.json({ success: true, id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Failed to create FAQ' });
  }
});

// PUT update FAQ
router.put('/:id', (req, res) => {
    const { question, answer } = req.body;
    try {
        db.prepare('UPDATE faqs SET question = ?, answer = ? WHERE id = ?').run(question, answer, req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Failed to update FAQ' });
    }
});

// DELETE FAQ
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM faqs WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Failed to delete FAQ' });
  }
});

export default router;
