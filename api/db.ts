import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
// In production (Railway), this should be a mounted volume path if persistence is needed across deployments
// e.g. /app/data
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
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
`);

export default db;
export { DATA_DIR };
