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
  const { id, name, email, phone, address, contact_person } = req.body;
  const stmt = db.prepare(`
    INSERT INTO customers (id, name, email, phone, address, contact_person)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, name, email, phone, address, contact_person);
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
  if (updates.contact_person !== undefined) { fields.push('contact_person = ?'); values.push(updates.contact_person); }
  if (updates.shopware_url !== undefined) { fields.push('shopware_url = ?'); values.push(updates.shopware_url); }
  if (updates.shopware_version !== undefined) { fields.push('shopware_version = ?'); values.push(updates.shopware_version); }
  if (updates.shopware_access_key !== undefined) { fields.push('shopware_access_key = ?'); values.push(updates.shopware_access_key); }
  if (updates.shopware_secret_key !== undefined) { fields.push('shopware_secret_key = ?'); values.push(updates.shopware_secret_key); }

  if (fields.length === 0) return res.json({ success: true, message: 'No changes' });

  values.push(id);
  const stmt = db.prepare(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);

  res.json({ success: true, message: 'Customer updated' });
});

// GET customer files
router.get('/:id/files', (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const files = db.prepare('SELECT * FROM files WHERE customer_id = ? ORDER BY created_at DESC').all(id);
    res.json({ success: true, data: files });
  } catch (error: any) {
    console.error('Error fetching customer files:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE customer file (from archive)
router.delete('/:customerId/files/:fileId', (req: Request, res: Response) => {
  const { fileId } = req.params;
  try {
    const result = db.prepare('DELETE FROM files WHERE id = ?').run(fileId);
    if (result.changes > 0) {
      res.json({ success: true, message: 'File deleted from archive' });
    } else {
      res.status(404).json({ success: false, error: 'File not found' });
    }
  } catch (error: any) {
    console.error('Error deleting customer file:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
