import { Router, type Request, type Response } from 'express';
import db from '../db.js';

const router = Router();

// GET all suppliers
router.get('/', (req: Request, res: Response) => {
  try {
    const suppliers = db.prepare('SELECT * FROM suppliers ORDER BY name ASC').all();
    res.json({ success: true, data: suppliers });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch suppliers' });
  }
});

// POST new supplier
router.post('/', (req: Request, res: Response) => {
  const { id, name, website, customerNumber, notes, email } = req.body;
  
  if (!name) {
    res.status(400).json({ success: false, error: 'Name is required' });
    return;
  }

  try {
    const supplierId = id || Math.random().toString(36).substr(2, 9);
    
    db.prepare(`
      INSERT INTO suppliers (id, name, website, customer_number, notes, email)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(supplierId, name, website, customerNumber, notes, email);
    
    res.json({ success: true, message: 'Supplier added', supplier: { id: supplierId, name, website, customerNumber, notes, email } });
  } catch (error) {
    console.error('Error adding supplier:', error);
    res.status(500).json({ success: false, error: 'Failed to add supplier' });
  }
});

// PUT update supplier
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, website, customerNumber, notes, email } = req.body;
  
  try {
    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (website !== undefined) { updates.push('website = ?'); values.push(website); }
    if (customerNumber !== undefined) { updates.push('customer_number = ?'); values.push(customerNumber); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email); }

    if (updates.length === 0) return res.json({ success: true, message: 'No changes' });

    values.push(id);
    db.prepare(`UPDATE suppliers SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ success: true, message: 'Supplier updated' });
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ success: false, error: 'Failed to update supplier' });
  }
});

// DELETE supplier
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
    res.json({ success: true, message: 'Supplier deleted' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ success: false, error: 'Failed to delete supplier' });
  }
});

export default router;