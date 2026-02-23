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
    
    // Shopware 5 uses Basic Auth (Digest is default but Basic often supported)
    const authString = Buffer.from(`${username}:${apiKey}`).toString('base64');
    
    try {
        const response = await fetch(`${url}/api/articles?limit=100`, {
            headers: {
                'Authorization': `Basic ${authString}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Shopware 5 Request failed (${response.status}): ${text.substring(0, 100)}`);
        }

        const data = await response.json();
        // Shopware 5 API returns { data: [...], success: true }
        if (!data.success && !Array.isArray(data.data)) {
             throw new Error('Invalid Shopware 5 response format');
        }
        return data.data; 
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
            await getShopware5Products(url, accessKey, secretKey);
        } else {
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
            
            products = rawProducts.map((p: any) => ({
                id: String(p.id),
                name: p.name,
                productNumber: p.mainDetail?.number || p.mainDetail?.ordernumber || '',
                active: p.active,
                stock: p.mainDetail?.inStock
            }));

        } else {
            // Shopware 6 Logic
            const token = await getShopware6Token(baseUrl, customer.shopware_access_key, customer.shopware_secret_key);
            
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
            
            products = data.data.map((p: any) => ({
                id: p.id,
                name: p.name,
                productNumber: p.productNumber,
                active: p.active,
                stock: p.stock
            }));
        }

        // Sync with local DB (upsert)
        const existingProducts = db.prepare("SELECT id, shopware_product_id FROM customer_products WHERE customer_id = ? AND source = 'shopware'").all(customerId) as any[];
        
        const upsertTransaction = db.transaction((productsToSync: any[]) => {
            for (const p of productsToSync) {
                const existing = existingProducts.find(ep => ep.shopware_product_id === p.id);
                
                if (existing) {
                    // User requested NOT to overwrite existing products so local edits are preserved.
                    // If the user wants to update/reset a product, they should delete it locally and re-sync.
                    continue;
                } else {
                    const newId = Math.random().toString(36).substr(2, 9);
                    db.prepare("INSERT INTO customer_products (id, customer_id, name, product_number, source, shopware_product_id) VALUES (?, ?, ?, ?, 'shopware', ?)")
                      .run(newId, customerId, p.name, p.productNumber, p.id);
                }
            }
        });

        upsertTransaction(products);

        res.json({ success: true, data: products });

    } catch (error: any) {
        console.error('Shopware Product Fetch Error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to fetch products' });
    }
});

export default router;
