import { Router, type Request, type Response } from 'express';
import db from '../db.js';

const router = Router();

// GET all orders
router.get('/', (req: Request, res: Response) => {
  const stmt = db.prepare('SELECT * FROM orders ORDER BY created_at DESC');
  const rows = stmt.all();
  
  const orders = rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    customerId: row.customer_id,
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    customer_phone: row.customer_phone,
    customer_address: row.customer_address,
    deadline: row.deadline,
    status: row.status,
    processing: !!row.processing,
    produced: !!row.produced,
    invoiced: !!row.invoiced,
    description: row.description,
    employees: row.employees ? JSON.parse(row.employees) : [],
    files: row.files ? JSON.parse(row.files) : [],
    created_at: row.created_at
  }));
  
  res.json({ success: true, data: orders });
});

// POST new order
router.post('/', (req: Request, res: Response) => {
  const { 
    id, title, customer_id, customer_name, customer_email, customer_phone, customer_address, 
    deadline, status, processing, produced, invoiced, description, employees, files 
  } = req.body;

  console.log('Received order payload:', req.body);
  
  try {
    const stmt = db.prepare(`
      INSERT INTO orders (
        id, title, customer_id, customer_name, customer_email, customer_phone, customer_address,
        deadline, status, processing, produced, invoiced, description, employees, files
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id, title, customer_id, customer_name, customer_email, customer_phone, customer_address,
      deadline, status, processing ? 1 : 0, produced ? 1 : 0, invoiced ? 1 : 0, 
      description, JSON.stringify(employees || []), JSON.stringify(files || [])
    );
    
    console.log('Order added successfully:', id);
    res.json({ success: true, message: 'Order added' });
  } catch (error) {
    console.error('Error adding order to database:', error);
    res.status(500).json({ success: false, error: 'Failed to add order', details: error.message });
  }
});

// PUT update order
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  // Construct dynamic update query
  const fields = [];
  const values = [];

  if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
  if (updates.customer_id !== undefined) { fields.push('customer_id = ?'); values.push(updates.customer_id); }
  if (updates.customer_name !== undefined) { fields.push('customer_name = ?'); values.push(updates.customer_name); }
  if (updates.customer_email !== undefined) { fields.push('customer_email = ?'); values.push(updates.customer_email); }
  if (updates.customer_phone !== undefined) { fields.push('customer_phone = ?'); values.push(updates.customer_phone); }
  if (updates.customer_address !== undefined) { fields.push('customer_address = ?'); values.push(updates.customer_address); }
  if (updates.deadline !== undefined) { fields.push('deadline = ?'); values.push(updates.deadline); }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.processing !== undefined) { fields.push('processing = ?'); values.push(updates.processing ? 1 : 0); }
  if (updates.produced !== undefined) { fields.push('produced = ?'); values.push(updates.produced ? 1 : 0); }
  if (updates.invoiced !== undefined) { fields.push('invoiced = ?'); values.push(updates.invoiced ? 1 : 0); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.employees !== undefined) { fields.push('employees = ?'); values.push(JSON.stringify(updates.employees)); }
  if (updates.files !== undefined) { fields.push('files = ?'); values.push(JSON.stringify(updates.files)); }

  if (fields.length === 0) return res.json({ success: true, message: 'No changes' });

  values.push(id);
  const stmt = db.prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);

  res.json({ success: true, message: 'Order updated' });
});

export default router;
