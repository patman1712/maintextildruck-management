import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
// In production (Railway), this should be a mounted volume path if persistence is needed across deployments
// e.g. /app/data
// Default to 'data' directory in project root if not specified
// CRITICAL: On Railway, we must use the absolute path /app/data if DATA_DIR is not set, 
// because process.cwd() might be /app but we want to be explicit about the volume mount point.
const DATA_DIR = process.env.DATA_DIR || (process.env.RAILWAY_ENVIRONMENT ? '/app/data' : path.join(process.cwd(), 'data'));
fs.ensureDirSync(DATA_DIR);

const dbPath = path.join(DATA_DIR, 'database.sqlite');
console.log(`Using database at: ${dbPath}`);

const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    customer_id TEXT, -- Link to customers table
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    deadline TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    processing INTEGER DEFAULT 0,
    produced INTEGER DEFAULT 0,
    invoiced INTEGER DEFAULT 0,
    description TEXT,
    employees TEXT, -- stored as JSON string
    files TEXT,     -- stored as JSON string
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    order_id TEXT,
    name TEXT NOT NULL,       -- Display name / Custom name
    original_name TEXT,       -- Original filename
    path TEXT NOT NULL,       -- URL/Path
    type TEXT NOT NULL,       -- print, vector, preview
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee', -- 'admin' or 'employee'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    website TEXT,
    customer_number TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed initial admin user if no users exist
const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
if (userCount === 0) {
  console.log('Seeding initial admin user...');
  const adminId = Math.random().toString(36).substr(2, 9);
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  
  db.prepare(`
    INSERT INTO users (id, username, password, name, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(adminId, 'admin', hashedPassword, 'Administrator', 'admin');
  
  console.log('Admin user created. Username: admin, Password: admin123');
}

// Migration: Add customer_id if it doesn't exist (for existing databases)
try {
  const columns = db.prepare("PRAGMA table_info(orders)").all() as any[];
  const hasCustomerId = columns.some(col => col.name === 'customer_id');
  if (!hasCustomerId) {
    console.log('Migrating database: Adding customer_id to orders table');
    db.exec('ALTER TABLE orders ADD COLUMN customer_id TEXT');
  }
} catch (error) {
  console.error('Migration error:', error);
}

export default db;
export { DATA_DIR };
