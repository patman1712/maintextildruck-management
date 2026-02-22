import { Router, type Request, type Response } from 'express';
import db from '../db.js';

const router = Router();

// GET all customers
router.get('/', (req: Request, res: Response) => {
  const stmt = db.prepare('SELECT * FROM customers ORDER BY created_at DESC');
  const customers = stmt.all();
  res.json({ success: true, data: customers });
});

// POST new customer
router.post('/', (req: Request, res: Response) => {
  const { id, name, email, phone, address } = req.body;
  const stmt = db.prepare(`
    INSERT INTO customers (id, name, email, phone, address)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, name, email, phone, address);
  res.json({ success: true, message: 'Customer added' });
});

// PUT update customer
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as any;
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Customer not found' });
  }

  const fields = [];
  const values = [];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.email !== undefined) { fields.push('email = ?'); values.push(updates.email); }
  if (updates.phone !== undefined) { fields.push('phone = ?'); values.push(updates.phone); }
  if (updates.address !== undefined) { fields.push('address = ?'); values.push(updates.address); }

  if (fields.length === 0) return res.json({ success: true, message: 'No changes' });

  values.push(id);
  const stmt = db.prepare(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);

  res.json({ success: true, message: 'Customer updated' });
});

export default router;
