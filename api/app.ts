/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
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

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

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
