import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import fs from 'fs';
import path from 'path';

const router = Router();

// POST Bulk assign file to multiple products (MUST be defined before /:customerId)
router.post('/bulk-files', (req: Request, res: Response) => {
    const { productIds, fileUrl, fileName, thumbnailUrl, type, quantity, supplierId, files } = req.body;

    // Normalize files input to array
    let filesToProcess: any[] = [];
    if (files && Array.isArray(files)) {
        filesToProcess = files;
    } else if (fileUrl) {
        filesToProcess = [{ fileUrl, fileName, thumbnailUrl, type, quantity }];
    }

    console.log('Received bulk-files request:', { 
        productIdsCount: productIds?.length, 
        productIds, 
        filesCount: filesToProcess.length,
        supplierId 
    });

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ success: false, error: 'Product IDs are required' });
    }
    if (filesToProcess.length === 0) {
        return res.status(400).json({ success: false, error: 'At least one file is required' });
    }

    try {
        const insertFileStmt = db.prepare(`
            INSERT INTO customer_product_files (id, product_id, file_url, file_name, thumbnail_url, type, quantity)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const updateSupplierStmt = db.prepare(`
            UPDATE customer_products 
            SET supplier_id = ?
            WHERE id = ?
        `);

        const transaction = db.transaction((ids: string[]) => {
            for (const productId of ids) {
                console.log(`Processing product ${productId}`);
                
                // Insert all files for this product
                for (const file of filesToProcess) {
                    const id = Math.random().toString(36).substr(2, 9);
                    insertFileStmt.run(
                        id, 
                        productId, 
                        file.fileUrl || file.url, // Handle both key variations
                        file.fileName || file.name, 
                        file.thumbnailUrl || file.thumbnail, 
                        file.type || type || 'print', 
                        file.quantity || quantity || 1
                    );
                }

                // Update supplier if provided
                if (supplierId) {
                    const result = updateSupplierStmt.run(supplierId, productId);
                    console.log(`Supplier update result for ${productId}:`, result);
                }
            }
        });

        transaction(productIds);

        res.json({ success: true, message: `${filesToProcess.length} file(s) assigned to ${productIds.length} products${supplierId ? ' and supplier updated' : ''}` });
    } catch (error: any) {
        console.error('Bulk assign error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET all products (Global list)
router.get('/all', (req: Request, res: Response) => {
    try {
        const stmt = db.prepare(`
            SELECT p.*, 
            (SELECT json_group_array(json_object(
                'id', f.id, 
                'file_url', f.file_url, 
                'file_name', f.file_name, 
                'thumbnail_url', f.thumbnail_url,
                'type', f.type,
                'quantity', f.quantity
            )) FROM customer_product_files f WHERE f.product_id = p.id) as files
            FROM customer_products p 
            ORDER BY p.created_at DESC
        `);
        const products = stmt.all();

        // Parse JSON files field
        const parsedProducts = products.map((p: any) => ({
            ...p,
            files: JSON.parse(p.files || '[]')
        }));

        res.json({ success: true, data: parsedProducts });
    } catch (error: any) {
        console.error('Error fetching all products:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

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
                'thumbnail_url', f.thumbnail_url,
                'type', f.type,
                'quantity', f.quantity
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

// DELETE ALL products for a customer (Admin only function)
router.delete('/customer/:customerId/all', (req: Request, res: Response) => {
    const { customerId } = req.params;
    try {
        // Only delete the product entries from the database
        // Do NOT delete the physical files from the filesystem
        // Files should only be deleted when explicitly requested or via a garbage collection process
        
        // With ON DELETE CASCADE on the foreign key, this removes all related entries in customer_product_files
        const result = db.prepare('DELETE FROM customer_products WHERE customer_id = ?').run(customerId);
        res.json({ success: true, message: 'All products deleted (files preserved)', changes: result.changes });
    } catch (error: any) {
        console.error('Error deleting all products:', error);
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
    const { fileUrl, fileName, thumbnailUrl, type, quantity } = req.body;

    if (!fileUrl) {
        return res.status(400).json({ success: false, error: 'File URL is required' });
    }

    try {
        const id = Math.random().toString(36).substr(2, 9);
        db.prepare(`
            INSERT INTO customer_product_files (id, product_id, file_url, file_name, thumbnail_url, type, quantity)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, productId, fileUrl, fileName, thumbnailUrl, type || 'print', quantity || 1);

        res.json({ success: true, message: 'File assigned', id });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT update file quantity (or other details)
router.put('/:productId/files/:fileId', (req: Request, res: Response) => {
    const { fileId } = req.params;
    const { quantity } = req.body;

    try {
        db.prepare(`
            UPDATE customer_product_files 
            SET quantity = ? 
            WHERE id = ?
        `).run(quantity || 1, fileId);

        res.json({ success: true, message: 'File updated' });
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
