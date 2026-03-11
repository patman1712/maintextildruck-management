import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import { generateInvoice } from '../services/invoice.js';
import { sendOrderConfirmation } from '../services/email.js';

const router = Router();

// GET all orders
router.get('/', (req: Request, res: Response) => {
  const stmt = db.prepare('SELECT * FROM orders ORDER BY created_at DESC');
  const rows = stmt.all();
  
  const orders = rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    orderNumber: row.order_number,
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
    printStatus: row.print_status,
    description: row.description,
    employees: row.employees ? JSON.parse(row.employees) : [],
    files: row.files ? JSON.parse(row.files) : [],
    created_at: row.created_at,
    approvalStatus: row.approval_status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectionReason: row.rejection_reason,
    approvalToken: row.approval_token,
    approvalComment: row.approval_comment,
    shopwareOrderId: row.shopware_order_id, // Map DB column to frontend property
    steps: row.steps ? JSON.parse(row.steps) : { processing: !!row.processing, produced: !!row.produced, invoiced: !!row.invoiced } // Map steps JSON or fallback
  }));
  
  res.json({ success: true, data: orders });
});

// POST new order
router.post('/', async (req: Request, res: Response) => {
  const { 
    id, title, order_number, customer_id, customer_name, customer_email, customer_phone, customer_address, customer_contact_person, 
    deadline, status, processing, produced, invoiced, print_status, description, employees, files, shop_id 
  } = req.body;

  console.log('Received order payload:', req.body);
  
  try {
    const stmt = db.prepare(`
      INSERT INTO orders (
        id, title, order_number, customer_id, customer_name, customer_email, customer_phone, customer_address, customer_contact_person,
        deadline, status, processing, produced, invoiced, print_status, description, employees, files, shop_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id, title, order_number, customer_id, customer_name, customer_email, customer_phone, customer_address, customer_contact_person,
      deadline, status, processing ? 1 : 0, produced ? 1 : 0, invoiced ? 1 : 0, 
      print_status || 'pending',
      description, JSON.stringify(employees || []), JSON.stringify(files || []), shop_id
    );
    
    // Also save files to the dedicated 'files' table for independent persistence
    if (files && Array.isArray(files)) {
      const checkFile = db.prepare('SELECT id FROM files WHERE path = ?');
      const insertFile = db.prepare(`
        INSERT INTO files (id, customer_id, order_id, name, original_name, path, type, quantity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
              file.type,
              file.quantity || 1
            );
          }
        }
      });
    }

    console.log('Order added successfully:', id);

    // AUTO-INVOICE & EMAIL
    // Generate invoice and send confirmation email immediately
    try {
        console.log(`Auto-generating invoice for new order ${id}...`);
        
        // Wait briefly for database to settle
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const invoicePath = await generateInvoice(id);
        if (invoicePath) {
            console.log(`Invoice generated at: ${invoicePath}`);
            console.log(`Sending confirmation email to customer...`);
            
            // Retry mechanism for email sending
            let emailSent = false;
            let attempts = 0;
            while (!emailSent && attempts < 2) {
                try {
                    emailSent = await sendOrderConfirmation(id, invoicePath);
                    if (emailSent) break;
                } catch (err) {
                    console.error(`Email attempt ${attempts + 1} failed:`, err);
                }
                attempts++;
                if (!emailSent) await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            if (emailSent) {
                 console.log('✅ Order Confirmation Email sent successfully.');
            } else {
                 console.error('❌ Failed to send Order Confirmation Email after retries.');
            }
        } else {
            console.error('❌ Invoice generation failed, cannot send email.');
        }
    } catch (e) {
        console.error('Error in auto-invoice workflow:', e);
    }

    res.json({ success: true, message: 'Order added' });
  } catch (error) {
    console.error('Error adding order to database:', error);
    res.status(500).json({ success: false, error: 'Failed to add order', details: error.message });
  }
});

// PUT update order
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  console.log(`PUT /orders/${id} updates:`, Object.keys(updates));
  if (updates.files) console.log(`PUT /orders/${id} files count:`, updates.files.length);
  
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  // Construct dynamic update query
  const fields = [];
  const values = [];

  if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
  if (updates.order_number !== undefined) { fields.push('order_number = ?'); values.push(updates.order_number); }
  if (updates.customer_id !== undefined) { fields.push('customer_id = ?'); values.push(updates.customer_id); }
  if (updates.customer_name !== undefined) { fields.push('customer_name = ?'); values.push(updates.customer_name); }
  if (updates.customer_email !== undefined) { fields.push('customer_email = ?'); values.push(updates.customer_email); }
  if (updates.customer_phone !== undefined) { fields.push('customer_phone = ?'); values.push(updates.customer_phone); }
  if (updates.customer_address !== undefined) { fields.push('customer_address = ?'); values.push(updates.customer_address); }
  if (updates.customer_contact_person !== undefined) { fields.push('customer_contact_person = ?'); values.push(updates.customer_contact_person); }
  if (updates.deadline !== undefined) { fields.push('deadline = ?'); values.push(updates.deadline); }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.processing !== undefined) { fields.push('processing = ?'); values.push(updates.processing ? 1 : 0); }
  if (updates.produced !== undefined) { fields.push('produced = ?'); values.push(updates.produced ? 1 : 0); }
  if (updates.invoiced !== undefined) { fields.push('invoiced = ?'); values.push(updates.invoiced ? 1 : 0); }
  if (updates.print_status !== undefined) { fields.push('print_status = ?'); values.push(updates.print_status); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.employees !== undefined) { fields.push('employees = ?'); values.push(JSON.stringify(updates.employees)); }
  if (updates.files !== undefined) { fields.push('files = ?'); values.push(JSON.stringify(updates.files)); }

  // Check if invoice needs to be generated (if invoiced flag changed to true)
  const shouldGenerateInvoice = updates.invoiced === true && !existing.invoiced;

  if (fields.length > 0) {
      values.push(id);
      const stmt = db.prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`);
      stmt.run(...values);
  }

  // Handle Invoice Generation & Email
  if (shouldGenerateInvoice) {
      try {
          console.log(`Generating invoice for order ${id}...`);
          const invoicePath = await generateInvoice(id);
          if (invoicePath) {
              console.log(`Invoice generated at: ${invoicePath}`);
              
              // Send Email with Invoice
              console.log(`Sending invoice email to customer...`);
              const emailSent = await sendOrderConfirmation(id, invoicePath);
              if (emailSent) {
                  console.log('Invoice email sent successfully.');
              } else {
                  console.warn('Failed to send invoice email.');
              }
          }
      } catch (e) {
          console.error('Error in invoice workflow:', e);
      }
  }

  // Also update files table if files are in the update payload
  if (updates.files && Array.isArray(updates.files)) {
    const checkFile = db.prepare('SELECT id FROM files WHERE path = ?');
    const insertFile = db.prepare(`
      INSERT INTO files (id, customer_id, order_id, name, original_name, path, type, quantity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    updates.files.forEach((file: any) => {
      if (file.url) {
        const existingFile = checkFile.get(file.url) as any;
        if (!existingFile) {
          const fileId = Math.random().toString(36).substr(2, 9);
          // Use outer 'existing' (order) for customer_id fallback
          const customerId = updates.customer_id || existing.customer_id;
          
          insertFile.run(
            fileId, 
            customerId, 
            id, 
            file.customName || file.name, 
            file.name, 
            file.url, 
            file.type,
            file.quantity || 1
          );
        } else {
              // Update quantity for existing file
              db.prepare('UPDATE files SET quantity = ? WHERE id = ?').run(file.quantity || 1, existingFile.id);
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

// --- Public Digital Proof Routes ---

// POST generate public token
router.post('/:id/generate-token', (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const existing = db.prepare('SELECT approval_token FROM orders WHERE id = ?').get(id) as any;
    if (existing && existing.approval_token) {
      return res.json({ success: true, token: existing.approval_token });
    }

    const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    db.prepare('UPDATE orders SET approval_token = ? WHERE id = ?').run(token, id);
    res.json({ success: true, token });
  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).json({ success: false, error: 'Failed to generate token' });
  }
});

// GET public order details
router.get('/public/:token', (req: Request, res: Response) => {
  const { token } = req.params;
  try {
    const order = db.prepare('SELECT * FROM orders WHERE approval_token = ?').get(token) as any;
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found or invalid token' });
    }

    // Parse necessary fields
    const safeOrder = {
      id: order.id,
      title: order.title,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      deadline: order.deadline,
      description: order.description,
      files: order.files ? JSON.parse(order.files) : [],
      approvalStatus: order.approval_status,
      approvedBy: order.approved_by,
      approvedAt: order.approved_at,
      rejectionReason: order.rejection_reason,
      approvalComment: order.approval_comment
    };

    // Also fetch items
    const items = db.prepare(`
      SELECT oi.*, s.name as supplier_name 
      FROM order_items oi
      LEFT JOIN suppliers s ON oi.supplier_id = s.id
      WHERE oi.order_id = ?
    `).all(order.id);

    res.json({ success: true, order: safeOrder, items });
  } catch (error) {
    console.error('Error fetching public order:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
});

// POST approve order
router.post('/public/:token/approve', (req: Request, res: Response) => {
  const { token } = req.params;
  const { name, comment } = req.body;
  
  if (!name) return res.status(400).json({ success: false, error: 'Name required' });

  try {
    const result = db.prepare(`
      UPDATE orders 
      SET approval_status = 'approved', approved_by = ?, approved_at = ?, approval_comment = ?
      WHERE approval_token = ?
    `).run(name, new Date().toISOString(), comment || '', token);

    if (result.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Order not found' });
    }
  } catch (error) {
    console.error('Error approving order:', error);
    res.status(500).json({ success: false, error: 'Failed to approve' });
  }
});

// POST reject order
router.post('/public/:token/reject', (req: Request, res: Response) => {
  const { token } = req.params;
  const { reason } = req.body;

  try {
    const result = db.prepare(`
      UPDATE orders 
      SET approval_status = 'rejected', rejection_reason = ?, approved_at = NULL, approved_by = NULL 
      WHERE approval_token = ?
    `).run(reason || '', token);

    if (result.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Order not found' });
    }
  } catch (error) {
    console.error('Error rejecting order:', error);
    res.status(500).json({ success: false, error: 'Failed to reject' });
  }
});

// GET order items (all or specific order)
router.get('/items/all', (req: Request, res: Response) => {
  try {
    const items = db.prepare(`
      SELECT oi.*, s.name as supplier_name 
      FROM order_items oi
      LEFT JOIN suppliers s ON oi.supplier_id = s.id
      ORDER BY oi.created_at DESC
    `).all();
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching order items:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch items' });
  }
});

// POST order item
router.post('/:orderId/items', (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { supplier_id, item_name, item_number, manual_order_number, color, size, quantity, notes, price } = req.body;
  
  if (!supplier_id || !item_name) {
    res.status(400).json({ success: false, error: 'Missing required fields' });
    return;
  }

  try {
    const id = Math.random().toString(36).substr(2, 9);
    
    db.prepare(`
      INSERT INTO order_items (id, order_id, supplier_id, item_name, item_number, manual_order_number, color, size, quantity, notes, price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, orderId, supplier_id, item_name, item_number, manual_order_number, color, size, quantity || 1, notes, price || null);
    
    res.json({ success: true, message: 'Item added', id });
  } catch (error) {
    console.error('Error adding order item:', error);
    res.status(500).json({ success: false, error: 'Failed to add item' });
  }
});

// PUT update order item
router.put('/:orderId/items/:itemId', (req: Request, res: Response) => {
  const { itemId } = req.params;
  const updates = req.body;
  
  try {
    const fields = [];
    const values = [];
    
    if (updates.supplier_id !== undefined) { fields.push('supplier_id = ?'); values.push(updates.supplier_id); }
    if (updates.item_name !== undefined) { fields.push('item_name = ?'); values.push(updates.item_name); }
    if (updates.item_number !== undefined) { fields.push('item_number = ?'); values.push(updates.item_number); }
    if (updates.manual_order_number !== undefined) { fields.push('manual_order_number = ?'); values.push(updates.manual_order_number); }
    if (updates.color !== undefined) { fields.push('color = ?'); values.push(updates.color); }
    if (updates.size !== undefined) { fields.push('size = ?'); values.push(updates.size); }
    if (updates.quantity !== undefined) { fields.push('quantity = ?'); values.push(updates.quantity); }
    if (updates.price !== undefined) { fields.push('price = ?'); values.push(updates.price); }
    if (updates.notes !== undefined) { fields.push('notes = ?'); values.push(updates.notes); }
    if (updates.status !== undefined) { 
        fields.push('status = ?'); 
        values.push(updates.status);

        // Tracking Logic
        if (updates.status === 'ordered') {
            fields.push('ordered_at = ?');
            values.push(new Date().toISOString());
            if (updates.updatedBy) {
                fields.push('ordered_by = ?');
                values.push(updates.updatedBy);
            }
        } else if (updates.status === 'received') {
            fields.push('received_at = ?');
            values.push(new Date().toISOString());
            if (updates.updatedBy) {
                fields.push('received_by = ?');
                values.push(updates.updatedBy);
            }
        }
    }
    
    if (fields.length === 0) return res.json({ success: true, message: 'No changes' });
    
    values.push(itemId);
    db.prepare(`UPDATE order_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    
    res.json({ success: true, message: 'Item updated' });
  } catch (error) {
    console.error('Error updating order item:', error);
    res.status(500).json({ success: false, error: 'Failed to update item' });
  }
});

// DELETE order item
router.delete('/:orderId/items/:itemId', (req: Request, res: Response) => {
  const { itemId } = req.params;
  try {
    db.prepare('DELETE FROM order_items WHERE id = ?').run(itemId);
    res.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    console.error('Error deleting order item:', error);
    res.status(500).json({ success: false, error: 'Failed to delete item' });
  }
});

export default router;
