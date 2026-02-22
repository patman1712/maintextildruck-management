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

export default router;
