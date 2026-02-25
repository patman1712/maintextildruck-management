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
import pushRoutes from './routes/push.js'


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
app.use('/api/push', pushRoutes)

// Serve uploads
app.use('/uploads', express.static(UPLOAD_DIR))
app.use('/downloads', express.static(DOWNLOADS_DIR))

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
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
  res.sendFile(path.join(__dirname, '../dist/index.html'))
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
