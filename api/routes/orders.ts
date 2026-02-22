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
    
    // Also save files to the dedicated 'files' table for independent persistence
    if (files && Array.isArray(files)) {
      const checkFile = db.prepare('SELECT id FROM files WHERE path = ?');
      const insertFile = db.prepare(`
        INSERT INTO files (id, customer_id, order_id, name, original_name, path, type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      files.forEach((file: any) => {
        if (file.url) {
          const existing = checkFile.get(file.url);
          if (!existing) {
            const fileId = Math.random().toString(36).substr(2, 9);
            insertFile.run(
              fileId, 
              customer_id, 
              id, 
              file.customName || file.name, 
              file.name, 
              file.url, 
              file.type
            );
          }
        }
      });
    }

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

  // Also update files table if files are in the update payload
  if (updates.files && Array.isArray(updates.files)) {
    const checkFile = db.prepare('SELECT id FROM files WHERE path = ?');
    const insertFile = db.prepare(`
      INSERT INTO files (id, customer_id, order_id, name, original_name, path, type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    updates.files.forEach((file: any) => {
      if (file.url) {
        const existing = checkFile.get(file.url);
        if (!existing) {
          const fileId = Math.random().toString(36).substr(2, 9);
          // Need to get customer_id from existing order if not in updates
          // But here we can just use updates.customer_id if present or existing.customer_id
          const customerId = updates.customer_id || (existing as any).customer_id;
          
          insertFile.run(
            fileId, 
            customerId, 
            id, 
            file.customName || file.name, 
            file.name, 
            file.url, 
            file.type
          );
        }
      }
    });
  }

  res.json({ success: true, message: 'Order updated' });
});

// DELETE order
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    // Unlink files first (keep them, but remove order reference)
    db.prepare('UPDATE files SET order_id = NULL WHERE order_id = ?').run(id);

    const result = db.prepare('DELETE FROM orders WHERE id = ?').run(id);
    
    if (result.changes > 0) {
      res.json({ success: true, message: 'Order deleted' });
    } else {
      res.status(404).json({ success: false, error: 'Order not found' });
    }
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ success: false, error: 'Failed to delete order' });
  }
});

export default router;
