import { Router, type Request, type Response } from 'express';
import db from '../db.js';

const router = Router();

// GET all products for a customer
router.get('/:customerId', (req: Request, res: Response) => {
    const { customerId } = req.params;
    try {
        const products = db.prepare(`
            SELECT p.*, 
            (SELECT json_group_array(json_object(
                'id', f.id, 
                'file_url', f.file_url, 
                'file_name', f.file_name, 
                'thumbnail_url', f.thumbnail_url
            )) FROM customer_product_files f WHERE f.product_id = p.id) as files
            FROM customer_products p 
            WHERE p.customer_id = ? 
            ORDER BY p.created_at DESC
        `).all(customerId);

        // Parse JSON files field
        const parsedProducts = products.map((p: any) => ({
            ...p,
            files: JSON.parse(p.files || '[]')
        }));

        res.json({ success: true, data: parsedProducts });
    } catch (error: any) {
        console.error('Error fetching customer products:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST create manual product
router.post('/:customerId', (req: Request, res: Response) => {
    const { customerId } = req.params;
    const { name, productNumber, supplierId } = req.body;

    if (!name) {
        return res.status(400).json({ success: false, error: 'Name is required' });
    }

    try {
        const id = Math.random().toString(36).substr(2, 9);
        db.prepare(`
            INSERT INTO customer_products (id, customer_id, name, product_number, source, supplier_id)
            VALUES (?, ?, ?, ?, 'manual', ?)
        `).run(id, customerId, name, productNumber || '', supplierId || null);

        res.json({ success: true, message: 'Product created', id });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT update product
router.put('/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, productNumber, supplierId } = req.body;

    try {
        db.prepare(`
            UPDATE customer_products 
            SET name = ?, product_number = ?, supplier_id = ?
            WHERE id = ?
        `).run(name, productNumber, supplierId || null, id);

        res.json({ success: true, message: 'Product updated' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE product
router.delete('/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        db.prepare('DELETE FROM customer_products WHERE id = ?').run(id);
        res.json({ success: true, message: 'Product deleted' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST assign file to product
router.post('/:productId/files', (req: Request, res: Response) => {
    const { productId } = req.params;
    const { fileUrl, fileName, thumbnailUrl } = req.body;

    if (!fileUrl) {
        return res.status(400).json({ success: false, error: 'File URL is required' });
    }

    try {
        const id = Math.random().toString(36).substr(2, 9);
        db.prepare(`
            INSERT INTO customer_product_files (id, product_id, file_url, file_name, thumbnail_url)
            VALUES (?, ?, ?, ?, ?)
        `).run(id, productId, fileUrl, fileName, thumbnailUrl);

        res.json({ success: true, message: 'File assigned', id });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE remove file from product
router.delete('/:productId/files/:fileId', (req: Request, res: Response) => {
    const { fileId } = req.params;
    try {
        db.prepare('DELETE FROM customer_product_files WHERE id = ?').run(fileId);
        res.json({ success: true, message: 'File removed' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
