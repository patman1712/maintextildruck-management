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

        const checkFileStmt = db.prepare(`
            SELECT id FROM customer_product_files 
            WHERE product_id = ? AND file_name = ?
        `);

        const updateFileStmt = db.prepare(`
            UPDATE customer_product_files 
            SET file_url = ?, thumbnail_url = ?, type = ?, quantity = ?
            WHERE id = ?
        `);

        const updateSupplierStmt = db.prepare(`
            UPDATE customer_products 
            SET supplier_id = ?
            WHERE id = ?
        `);

        const transaction = db.transaction((ids: string[]) => {
            for (const productId of ids) {
                console.log(`Processing product ${productId}`);
                
                // Insert or Update files for this product
                for (const file of filesToProcess) {
                    const fName = file.fileName || file.name;
                    const fUrl = file.fileUrl || file.url;
                    const fThumb = file.thumbnailUrl || file.thumbnail;
                    const fType = file.type || type || 'print';
                    const fQty = file.quantity || quantity || 1;

                    // Check if file with same name exists for this product
                    const existingFile = checkFileStmt.get(productId, fName) as any;

                    if (existingFile) {
                        // Update existing file (User wants "newer" one)
                        updateFileStmt.run(fUrl, fThumb, fType, fQty, existingFile.id);
                        console.log(`Updated existing file ${fName} for product ${productId}`);
                    } else {
                        // Insert new file
                        const id = Math.random().toString(36).substr(2, 9);
                        insertFileStmt.run(
                            id, 
                            productId, 
                            fUrl, 
                            fName, 
                            fThumb, 
                            fType, 
                            fQty
                        );
                    }
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

// POST duplicate product (Online -> Manual)
router.post('/:productId/duplicate', (req: Request, res: Response) => {
    const { productId } = req.params;
    const { name, productNumber } = req.body;

    try {
        const product = db.prepare('SELECT * FROM customer_products WHERE id = ?').get(productId) as any;
        
        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }

        const newId = Math.random().toString(36).substr(2, 9);
        const newName = name || `${product.name} (Kopie)`;
        const newProductNumber = productNumber || (product.product_number ? `${product.product_number}-COPY` : '');

        // Create new manual product
        db.prepare(`
            INSERT INTO customer_products (id, customer_id, name, product_number, source, supplier_id, size, color)
            VALUES (?, ?, ?, ?, 'manual', ?, ?, ?)
        `).run(newId, product.customer_id, newName, newProductNumber, product.supplier_id, product.size, product.color);

        // Copy files
        const files = db.prepare('SELECT * FROM customer_product_files WHERE product_id = ?').all(productId) as any[];
        
        const insertFileStmt = db.prepare(`
            INSERT INTO customer_product_files (id, product_id, file_url, file_name, thumbnail_url, type, quantity)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const file of files) {
            const fileId = Math.random().toString(36).substr(2, 9);
            insertFileStmt.run(fileId, newId, file.file_url, file.file_name, file.thumbnail_url, file.type, file.quantity);
        }

        res.json({ success: true, message: 'Product duplicated', id: newId });
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
        const checkFileStmt = db.prepare(`
            SELECT id FROM customer_product_files 
            WHERE product_id = ? AND file_name = ?
        `);

        const existing = checkFileStmt.get(productId, fileName) as any;

        if (existing) {
            db.prepare(`
                UPDATE customer_product_files 
                SET file_url = ?, thumbnail_url = ?, type = ?, quantity = ? 
                WHERE id = ?
            `).run(fileUrl, thumbnailUrl, type || 'print', quantity || 1, existing.id);
            res.json({ success: true, message: 'File updated', id: existing.id });
        } else {
            const id = Math.random().toString(36).substr(2, 9);
            db.prepare(`
                INSERT INTO customer_product_files (id, product_id, file_url, file_name, thumbnail_url, type, quantity)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(id, productId, fileUrl, fileName, thumbnailUrl, type || 'print', quantity || 1);

            res.json({ success: true, message: 'File assigned', id });
        }
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
