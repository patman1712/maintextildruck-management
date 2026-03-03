/**
 * This is a API server
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env BEFORE ANY IMPORTS with multiple fallbacks
const envPaths = [
    path.join(__dirname, '../.env'), // From api/ folder
    path.join(__dirname, '.env'),    // In api/ folder
    path.join(process.cwd(), '.env'), // Current working directory
    path.join(process.cwd(), '../.env') // Parent of CWD
];

let envLoaded = false;
for (const p of envPaths) {
    if (fs.existsSync(p)) {
        dotenv.config({ path: p });
        console.log(`[ENV] Loaded from: ${p}`);
        envLoaded = true;
        break;
    }
}

if (!envLoaded) {
    console.warn('[ENV] No .env file found in checked locations:', envPaths);
} else {
    // Double check key
    if (!process.env.VITE_VAPID_PUBLIC_KEY) {
        console.error('[ENV] .env file loaded but VITE_VAPID_PUBLIC_KEY is missing!');
    } else {
        console.log('[ENV] VITE_VAPID_PUBLIC_KEY is present.');
    }
}

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import db from './db.js'
import authRoutes from './routes/auth.js'
import orderRoutes from './routes/orders.js'
import customerRoutes from './routes/customers.js'
import uploadRoutes, { UPLOAD_DIR } from './routes/upload.js'
import dtfRoutes from './routes/dtf.js'
import userRoutes from './routes/users.js'
import supplierRoutes from './routes/suppliers.js'
import shopwareRoutes from './routes/shopware.js'
import productRoutes from './routes/products.js'
import settingsRoutes from './routes/settings.js'
import vectorRoutes from './routes/vector.js'
import faqRoutes from './routes/faqs.js'
import downloadsRoutes, { DOWNLOADS_DIR } from './routes/downloads.js'
import backupRoutes from './routes/backup.js'
import adminRoutes from './routes/admin.js'
import shopRoutes from './routes/shops.js'
import shopManagementRoutes from './routes/shop_management.js'
import variableRoutes from './routes/variables.js'


const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/customers', customerRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/dtf', dtfRoutes)
app.use('/api/users', userRoutes)
app.use('/api/suppliers', supplierRoutes)
app.use('/api/shopware', shopwareRoutes)
app.use('/api/products', productRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/vector', vectorRoutes)
app.use('/api/faqs', faqRoutes)
app.use('/api/downloads', downloadsRoutes)
app.use('/api/backup', backupRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/shops', shopRoutes)
app.use('/api/shop-management', shopManagementRoutes)
app.use('/api/variables', variableRoutes)

// --- DEBUG ROUTE (Temporary) ---
app.get('/api/debug/shopware-orders', (req, res) => {
    try {
        const orders = db.prepare(`
            SELECT id, title, status, shopware_order_id, description, order_number 
            FROM orders 
            WHERE title LIKE 'Shopware Order #%' OR description LIKE '%Importiert aus Shopware%'
            ORDER BY created_at DESC
            LIMIT 50
        `).all();
        res.json({ count: orders.length, orders });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/debug/shopware-orders', (req, res) => {
    try {
        const deleteItems = db.prepare(`
            DELETE FROM order_items 
            WHERE order_id IN (
                SELECT id FROM orders 
                WHERE title LIKE 'Shopware Order #%' OR description LIKE '%Importiert aus Shopware%' OR shopware_order_id IS NOT NULL
            )
        `).run();

        const deleteFiles = db.prepare(`
            DELETE FROM files 
            WHERE order_id IN (
                SELECT id FROM orders 
                WHERE title LIKE 'Shopware Order #%' OR description LIKE '%Importiert aus Shopware%' OR shopware_order_id IS NOT NULL
            )
        `).run();

        const deleteOrders = db.prepare(`
            DELETE FROM orders 
            WHERE title LIKE 'Shopware Order #%' OR description LIKE '%Importiert aus Shopware%' OR shopware_order_id IS NOT NULL
        `).run();

        res.json({ 
            success: true, 
            deleted: {
                orders: deleteOrders.changes,
                items: deleteItems.changes,
                files: deleteFiles.changes
            }
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// DEBUG: Fetch single order from Shopware API directly to check availability
app.get('/api/debug/shopware-check/:orderNumber', async (req, res) => {
    try {
        const orderNumber = req.params.orderNumber;
        const customer = db.prepare("SELECT * FROM customers WHERE shopware_url IS NOT NULL LIMIT 1").get() as any;
        
        if (!customer) return res.status(404).json({ error: 'No Shopware customer found' });

        const baseUrl = customer.shopware_url;
        const version = customer.shopware_version || '6';

        if (version === '5') {
            const url = baseUrl.replace(/\/$/, '');
            const authString = Buffer.from(`${customer.shopware_access_key}:${customer.shopware_secret_key}`).toString('base64');
            
            // Try to find by number
            const response = await fetch(`${url}/api/orders?filter[0][property]=number&filter[0][value]=${orderNumber}`, {
                headers: { 'Authorization': `Basic ${authString}`, 'Accept': 'application/json' }
            });
            const json = await response.json();
            return res.json({ version: '5', found: json.data?.length > 0, data: json.data });
        } else {
             // SW6
             // We need to fetch token first
             // Note: importing internal functions is hacky, better to move logic to shared helper or copy-paste for debug
             // For now, let's try to replicate the token fetch manually to avoid export issues if they are not exported
             
             const tokenRes = await fetch(`${baseUrl}/api/oauth/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grant_type: 'client_credentials',
                    client_id: customer.shopware_access_key,
                    client_secret: customer.shopware_secret_key
                })
            });
            const tokenData = await tokenRes.json();
            const token = tokenData.access_token;

            const body = {
                filter: [{ type: 'equals', field: 'orderNumber', value: orderNumber }],
                associations: { stateMachineState: {}, transactions: { associations: { stateMachineState: {} } } }
            };

            const searchRes = await fetch(`${baseUrl}/api/search/order`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`, 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json' 
                },
                body: JSON.stringify(body)
            });
            const searchData = await searchRes.json();
            return res.json({ version: '6', found: searchData.total > 0, data: searchData });
        }
    } catch (e: any) {
        res.status(500).json({ error: e.message, stack: e.stack });
    }
});
// DEBUG: List ALL orders from Shopware (to check if #35 is in the list)
app.get('/api/debug/shopware-list', async (req, res) => {
    try {
        const customers = db.prepare("SELECT * FROM customers WHERE shopware_url IS NOT NULL").all() as any[];
        const results = [];

        for (const customer of customers) {
            const baseUrl = customer.shopware_url;
            const version = customer.shopware_version || '6';
            const authString = Buffer.from(`${customer.shopware_access_key}:${customer.shopware_secret_key}`).toString('base64');
            const url = baseUrl.replace(/\/$/, '');

            if (version === '5') {
                const params = new URLSearchParams();
                params.append('limit', '100'); // Same as Sync
                // No Sort
                
                const response = await fetch(`${url}/api/orders?${params.toString()}`, {
                    headers: { 'Authorization': `Basic ${authString}`, 'Accept': 'application/json' }
                });
                const json = await response.json();
                
                if (json.data) {
                    results.push({
                        customer: customer.name,
                        count: json.data.length,
                        orders: json.data.map((o: any) => ({ 
                            id: o.id, 
                            number: o.number, 
                            time: o.orderTime 
                        }))
                    });
                }
            }
        }
        res.json(results);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});
// -------------------------------

// Serve uploads
app.use('/uploads', express.static(UPLOAD_DIR))
app.use('/downloads', express.static(DOWNLOADS_DIR))

const START_TIME = Date.now();

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
      startTime: START_TIME
    })
  },
)

// Handle 404 for API routes
app.use('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

// Custom favicon/logo override
app.get(['/favicon.ico', '/favicon.png', '/apple-touch-icon.png', '/logo.png'], (req: Request, res: Response, next: NextFunction) => {
    try {
        const key = req.path === '/logo.png' ? 'logo' : 'favicon';
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as {value: string} | undefined;
        
        if (row && row.value) {
            const relativePath = row.value.replace(/^\/uploads\//, '');
            const filePath = path.join(UPLOAD_DIR, relativePath);
            
            if (fs.existsSync(filePath)) {
                const ext = path.extname(filePath).toLowerCase();
                if (ext === '.svg') res.type('image/svg+xml');
                else if (ext === '.png') res.type('image/png');
                else if (ext === '.ico') res.type('image/x-icon');
                
                return res.sendFile(filePath);
            }
        }
    } catch (e) {
        console.error("Error serving custom icon:", e);
    }
    next();
});

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, '../dist')))

// Handle client-side routing by serving index.html for all non-API routes
app.get('*', (req: Request, res: Response) => {
  const indexPath = path.join(__dirname, '../dist/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.error(`Frontend index.html not found at ${indexPath}. Ensure 'npm run build' executed successfully.`);
    res.status(500).send('Frontend build not found. Please check server logs.');
  }
})

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

export default app
