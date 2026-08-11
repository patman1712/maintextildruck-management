import { Router, type Request, type Response } from 'express';
import db, { DATA_DIR } from '../db.js';
import path from 'path';
import fs from 'fs-extra';

const router = Router();
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const INVOICE_DIR = path.join(DATA_DIR, 'invoices');

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

// ============= CUSTOMER PHOTOS (Produktfotos Galerie) =============
// GET all customer photos
router.get('/:id/photos', (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const photos = db.prepare('SELECT * FROM customer_photos WHERE customer_id = ? ORDER BY created_at DESC').all(id);
    res.json({ success: true, data: photos });
  } catch (error: any) {
    console.error('Error fetching customer photos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST new customer photo
router.post('/:id/photos', (req: Request, res: Response) => {
  const { id } = req.params;
  const { id: photoId, file_url, file_name, thumbnail_url, note } = req.body;
  
  if (!file_url) {
    return res.status(400).json({ success: false, error: 'file_url is required' });
  }

  try {
    const newId = photoId || Math.random().toString(36).substr(2, 9);
    const stmt = db.prepare(`
      INSERT INTO customer_photos (id, customer_id, file_url, file_name, thumbnail_url, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(newId, id, file_url, file_name || null, thumbnail_url || null, note || null);
    const photo = db.prepare('SELECT * FROM customer_photos WHERE id = ?').get(newId);
    res.json({ success: true, data: photo });
  } catch (error: any) {
    console.error('Error creating customer photo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update customer photo (note / metadata)
router.put('/photos/:photoId', (req: Request, res: Response) => {
  const { photoId } = req.params;
  const { note, file_name } = req.body;

  try {
    const existing = db.prepare('SELECT * FROM customer_photos WHERE id = ?').get(photoId) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    const fields = [];
    const values = [];
    if (note !== undefined) { fields.push('note = ?'); values.push(note); }
    if (file_name !== undefined) { fields.push('file_name = ?'); values.push(file_name); }

    if (fields.length === 0) {
      return res.json({ success: true, data: existing, message: 'No changes' });
    }

    values.push(photoId);
    const stmt = db.prepare(`UPDATE customer_photos SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    const updated = db.prepare('SELECT * FROM customer_photos WHERE id = ?').get(photoId);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error updating customer photo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE customer photo
router.delete('/photos/:photoId', async (req: Request, res: Response) => {
  const { photoId } = req.params;
  try {
    const photo = db.prepare('SELECT * FROM customer_photos WHERE id = ?').get(photoId) as any;
    if (!photo) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    // Delete files from disk
    if (photo.file_url && typeof photo.file_url === 'string' && photo.file_url.startsWith('/uploads/')) {
      try {
        const relative = photo.file_url.replace(/^\/uploads\//, '');
        const fullPath = path.join(UPLOAD_DIR, relative);
        if (fullPath.startsWith(UPLOAD_DIR) && await fs.pathExists(fullPath)) {
          await fs.remove(fullPath);
        }
      } catch (e) {
        console.warn('Could not delete photo file from disk:', e);
      }
    }
    if (photo.thumbnail_url && typeof photo.thumbnail_url === 'string' && photo.thumbnail_url.startsWith('/uploads/')) {
      try {
        const relative = photo.thumbnail_url.replace(/^\/uploads\//, '');
        const fullPath = path.join(UPLOAD_DIR, relative);
        if (fullPath.startsWith(UPLOAD_DIR) && await fs.pathExists(fullPath)) {
          await fs.remove(fullPath);
        }
      } catch (e) {
        console.warn('Could not delete photo thumbnail from disk:', e);
      }
    }

    const result = db.prepare('DELETE FROM customer_photos WHERE id = ?').run(photoId);
    if (result.changes > 0) {
      res.json({ success: true, message: 'Photo deleted' });
    } else {
      res.status(404).json({ success: false, error: 'Photo not found' });
    }
  } catch (error: any) {
    console.error('Error deleting customer photo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as any;
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    const shopIds = (db.prepare('SELECT id FROM shops WHERE customer_id = ?').all(id) as any[]).map(r => String(r.id));
    const shopIdPlaceholders = shopIds.map(() => '?').join(',');

    const orderRows = shopIds.length
      ? (db.prepare(`SELECT id, files, invoice_path FROM orders WHERE customer_id = ? OR shop_id IN (${shopIdPlaceholders})`).all(id, ...shopIds) as any[])
      : (db.prepare('SELECT id, files, invoice_path FROM orders WHERE customer_id = ?').all(id) as any[]);
    const orderIds = orderRows.map(r => String(r.id));

    const urlSet = new Set<string>();
    const invoiceFiles = new Set<string>();

    for (const row of orderRows) {
      if (row.invoice_path) invoiceFiles.add(String(row.invoice_path));
      try {
        const files = JSON.parse(row.files || '[]');
        if (Array.isArray(files)) {
          for (const f of files) {
            if (f?.url && typeof f.url === 'string') urlSet.add(f.url);
          }
        }
      } catch {}
    }

    const fileRows = orderIds.length
      ? (db.prepare(`SELECT path, thumbnail FROM files WHERE customer_id = ? OR order_id IN (${orderIds.map(() => '?').join(',')})`).all(id, ...orderIds) as any[])
      : (db.prepare('SELECT path, thumbnail FROM files WHERE customer_id = ?').all(id) as any[]);
    for (const r of fileRows) {
      if (r?.path && typeof r.path === 'string') urlSet.add(r.path);
      if (r?.thumbnail && typeof r.thumbnail === 'string') urlSet.add(r.thumbnail);
    }

    const productRows = db.prepare('SELECT id FROM customer_products WHERE customer_id = ?').all(id) as any[];
    const productIds = productRows.map(r => String(r.id));
    if (productIds.length) {
      const cpfRows = db.prepare(`SELECT file_url, thumbnail_url FROM customer_product_files WHERE product_id IN (${productIds.map(() => '?').join(',')})`).all(...productIds) as any[];
      for (const r of cpfRows) {
        if (r?.file_url && typeof r.file_url === 'string') urlSet.add(r.file_url);
        if (r?.thumbnail_url && typeof r.thumbnail_url === 'string') urlSet.add(r.thumbnail_url);
      }
    }

    const deleteUploads = async () => {
      for (const url of Array.from(urlSet)) {
        if (!url || typeof url !== 'string') continue;
        if (!url.startsWith('/uploads/')) continue;
        const relative = url.replace(/^\/uploads\//, '');
        const fullPath = path.join(UPLOAD_DIR, relative);
        if (fullPath.startsWith(UPLOAD_DIR) && await fs.pathExists(fullPath)) {
          try { await fs.remove(fullPath); } catch {}
        }
        const thumbPath = path.join(UPLOAD_DIR, `${relative}_thumb.png`);
        if (thumbPath.startsWith(UPLOAD_DIR) && await fs.pathExists(thumbPath)) {
          try { await fs.remove(thumbPath); } catch {}
        }
        const thumbLgPath = path.join(UPLOAD_DIR, `${relative}_thumb_lg.png`);
        if (thumbLgPath.startsWith(UPLOAD_DIR) && await fs.pathExists(thumbLgPath)) {
          try { await fs.remove(thumbLgPath); } catch {}
        }
      }

      for (const inv of Array.from(invoiceFiles)) {
        const p = path.join(INVOICE_DIR, inv);
        if (p.startsWith(INVOICE_DIR) && await fs.pathExists(p)) {
          try { await fs.remove(p); } catch {}
        }
      }

      const cacheDir = path.join(UPLOAD_DIR, 'shopware_cache', id);
      if (cacheDir.startsWith(UPLOAD_DIR) && await fs.pathExists(cacheDir)) {
        try { await fs.remove(cacheDir); } catch {}
      }
    };

    const tx = db.transaction(() => {
      if (orderIds.length) {
        db.prepare(`DELETE FROM order_items WHERE order_id IN (${orderIds.map(() => '?').join(',')})`).run(...orderIds);
        db.prepare(`DELETE FROM files WHERE order_id IN (${orderIds.map(() => '?').join(',')})`).run(...orderIds);
        db.prepare(`DELETE FROM orders WHERE id IN (${orderIds.map(() => '?').join(',')})`).run(...orderIds);
      }

      db.prepare('DELETE FROM files WHERE customer_id = ?').run(id);

      if (productIds.length) {
        db.prepare(`DELETE FROM customer_products WHERE id IN (${productIds.map(() => '?').join(',')})`).run(...productIds);
      }

      if (shopIds.length) {
        db.prepare(`DELETE FROM shops WHERE id IN (${shopIds.map(() => '?').join(',')})`).run(...shopIds);
      }

      db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    });

    tx();
    await deleteUploads();

    res.json({
      success: true,
      data: {
        deletedOrders: orderIds.length,
        deletedShops: shopIds.length,
        deletedProductCount: productIds.length,
        deletedUrls: urlSet.size,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
