import { Router, type Request, type Response } from 'express';
import db from '../db.js';

const router = Router();

async function getShopwareToken(baseUrl: string, accessKey: string, secretKey: string) {
    // Ensure baseUrl doesn't end with slash
    const url = baseUrl.replace(/\/$/, '');
    
    try {
        const response = await fetch(`${url}/api/oauth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                grant_type: 'client_credentials',
                client_id: accessKey,
                client_secret: secretKey,
            }),
        });

        if (!response.ok) {
            throw new Error(`Authentication failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error('Shopware Auth Error:', error);
        throw error;
    }
}

// Test connection
router.post('/test-connection', async (req: Request, res: Response) => {
    const { url, accessKey, secretKey } = req.body;

    if (!url || !accessKey || !secretKey) {
        return res.status(400).json({ success: false, error: 'Missing credentials' });
    }

    try {
        await getShopwareToken(url, accessKey, secretKey);
        res.json({ success: true, message: 'Connection successful' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message || 'Connection failed' });
    }
});

// Get products for a customer
router.get('/products/:customerId', async (req: Request, res: Response) => {
    const { customerId } = req.params;
    
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;
    
    if (!customer) {
        return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    if (!customer.shopware_url || !customer.shopware_access_key || !customer.shopware_secret_key) {
        return res.status(400).json({ success: false, error: 'Shopware not configured for this customer' });
    }

    try {
        const token = await getShopwareToken(customer.shopware_url, customer.shopware_access_key, customer.shopware_secret_key);
        const baseUrl = customer.shopware_url.replace(/\/$/, '');
        
        // Fetch products with basic info
        // We select name, productNumber, id
        const response = await fetch(`${baseUrl}/api/product?limit=100`, { // Limit 100 for now, maybe add pagination later
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch products: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Transform data if needed
        const products = data.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            productNumber: p.productNumber,
            active: p.active,
            stock: p.stock
        }));

        res.json({ success: true, data: products });

    } catch (error: any) {
        console.error('Shopware Product Fetch Error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to fetch products' });
    }
});

// Mappings CRUD

// GET mappings for customer
router.get('/mappings/:customerId', (req: Request, res: Response) => {
    const { customerId } = req.params;
    const mappings = db.prepare('SELECT * FROM shopware_product_mappings WHERE customer_id = ?').all(customerId);
    res.json({ success: true, data: mappings });
});

// POST create mapping
router.post('/mappings', (req: Request, res: Response) => {
    const { customerId, shopwareProductId, shopwareProductNumber, shopwareProductName, fileUrl, fileName } = req.body;
    
    if (!customerId || !shopwareProductId || !fileUrl) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    try {
        const id = Math.random().toString(36).substr(2, 9);
        db.prepare(`
            INSERT INTO shopware_product_mappings (id, customer_id, shopware_product_id, shopware_product_number, shopware_product_name, file_url, file_name)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, customerId, shopwareProductId, shopwareProductNumber, shopwareProductName, fileUrl, fileName);
        
        res.json({ success: true, message: 'Mapping created', id });
    } catch (error: any) {
        console.error('Create Mapping Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE mapping
router.delete('/mappings/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        db.prepare('DELETE FROM shopware_product_mappings WHERE id = ?').run(id);
        res.json({ success: true, message: 'Mapping deleted' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
