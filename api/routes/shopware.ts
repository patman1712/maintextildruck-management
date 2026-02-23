import { Router, type Request, type Response } from 'express';
import db from '../db.js';

const router = Router();

// --- Helper Functions ---

async function getShopware6Token(baseUrl: string, accessKey: string, secretKey: string) {
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
        console.error('Shopware 6 Auth Error:', error);
        throw error;
    }
}

async function getShopware5Products(baseUrl: string, username: string, apiKey: string) {
    const url = baseUrl.replace(/\/$/, '');
    
    // Shopware 5 uses Basic Auth or Digest Auth
    // Standard is Digest, but often Basic is enabled or handled via middleware
    // Actually SW5 API uses Digest Auth by default, which is tricky with fetch.
    // However, many plugins or configs allow Basic Auth.
    // Let's try Basic Auth first as it's simpler.
    // Format: Authorization: Basic base64(username:apiKey)
    
    const authString = Buffer.from(`${username}:${apiKey}`).toString('base64');
    
    try {
        const response = await fetch(`${url}/api/articles?limit=100`, {
            headers: {
                'Authorization': `Basic ${authString}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            // Try to provide helpful error message
            const text = await response.text();
            throw new Error(`Shopware 5 Request failed (${response.status}): ${text.substring(0, 100)}`);
        }

        const data = await response.json();
        return data.data; // Shopware 5 returns { data: [...], success: true }
    } catch (error) {
        console.error('Shopware 5 Product Fetch Error:', error);
        throw error;
    }
}

// --- Routes ---

// Test connection
router.post('/test-connection', async (req: Request, res: Response) => {
    const { url, version, accessKey, secretKey } = req.body;

    if (!url || !accessKey || !secretKey) {
        return res.status(400).json({ success: false, error: 'Missing credentials' });
    }

    try {
        if (version === '5') {
            // For SW5, we test by fetching 1 product
            await getShopware5Products(url, accessKey, secretKey);
        } else {
            // For SW6, we test by getting a token
            await getShopware6Token(url, accessKey, secretKey);
        }
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

    const version = customer.shopware_version || '6';

    try {
        let products = [];
        const baseUrl = customer.shopware_url.replace(/\/$/, '');

        if (version === '5') {
            // Shopware 5 Logic
            const rawProducts = await getShopware5Products(baseUrl, customer.shopware_access_key, customer.shopware_secret_key);
            
            // Map SW5 products to common format
            products = rawProducts.map((p: any) => ({
                id: p.id, // SW5 uses numeric IDs mostly, but we treat as string/any
                name: p.name,
                productNumber: p.mainDetail?.number || p.mainDetail?.ordernumber || '',
                active: p.active,
                stock: p.mainDetail?.inStock
            }));

        } else {
            // Shopware 6 Logic
            const token = await getShopware6Token(baseUrl, customer.shopware_access_key, customer.shopware_secret_key);
            
            // Fetch products with basic info
            const response = await fetch(`${baseUrl}/api/product?limit=100`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch products: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Map SW6 products to common format
            products = data.data.map((p: any) => ({
                id: p.id,
                name: p.name,
                productNumber: p.productNumber,
                active: p.active,
                stock: p.stock
            }));
        }

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
