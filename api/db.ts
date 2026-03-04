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
db.pragma('temp_store = MEMORY');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    shopware_url TEXT,
    shopware_version TEXT DEFAULT '6',
    shopware_access_key TEXT,
    shopware_secret_key TEXT,
    contact_person TEXT,
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
    customer_contact_person TEXT,
    deadline TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    order_number TEXT, -- Format: YYYY-XXXX
    processing INTEGER DEFAULT 0,
    produced INTEGER DEFAULT 0,
    invoiced INTEGER DEFAULT 0,
    steps TEXT,     -- stored as JSON string { processing: boolean, produced: boolean, invoiced: boolean }
    print_status TEXT DEFAULT 'pending', -- pending, ordered
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
    thumbnail TEXT,
    print_status TEXT DEFAULT 'pending', -- pending, ordered, completed
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
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    item_number TEXT,     -- Artikelnummer
    manual_order_number TEXT, -- Optional manual order reference
    color TEXT,
    size TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    status TEXT DEFAULT 'pending', -- pending, ordered, received
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS faqs (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS downloads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_id TEXT,
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

db.exec(`
  CREATE TABLE IF NOT EXISTS shopware_product_mappings (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    shopware_product_id TEXT NOT NULL,
    shopware_product_number TEXT,
    shopware_product_name TEXT,
    file_url TEXT NOT NULL,
    file_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS customer_products (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    name TEXT NOT NULL,
    product_number TEXT,
    source TEXT DEFAULT 'manual', -- 'manual' or 'shopware'
    shopware_product_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS customer_product_files (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT,
    thumbnail_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES customer_products(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS shops (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    name TEXT NOT NULL,
    domain_slug TEXT UNIQUE,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#000000',
    secondary_color TEXT DEFAULT '#ffffff',
    template TEXT DEFAULT 'standard',
    dhl_config TEXT, -- JSON
    paypal_config TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS shop_categories (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    parent_id TEXT, -- For nested categories
    FOREIGN KEY(shop_id) REFERENCES shops(id) ON DELETE CASCADE,
    FOREIGN KEY(parent_id) REFERENCES shop_categories(id) ON DELETE SET NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS product_variables (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'size' or 'color'
    variable_values TEXT NOT NULL, -- JSON string or comma-separated
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS shop_variable_assignments (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    variable_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(shop_id) REFERENCES shops(id) ON DELETE CASCADE,
    FOREIGN KEY(variable_id) REFERENCES product_variables(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS personalization_options (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'text', 'number', 'logo'
    price_adjustment DECIMAL(10, 2) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS shop_product_assignments (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    category_id TEXT,
    price DECIMAL(10, 2),
    is_featured BOOLEAN DEFAULT 0,
    personalization_enabled BOOLEAN DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(shop_id) REFERENCES shops(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES customer_products(id) ON DELETE CASCADE,
    FOREIGN KEY(category_id) REFERENCES shop_categories(id) ON DELETE SET NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS shop_product_images (
    id TEXT PRIMARY KEY,
    shop_product_assignment_id TEXT NOT NULL,
    customer_product_file_id TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(shop_product_assignment_id) REFERENCES shop_product_assignments(id) ON DELETE CASCADE,
    FOREIGN KEY(customer_product_file_id) REFERENCES customer_product_files(id) ON DELETE CASCADE
  )
`);

// Add variants column to shop_product_assignments
try {
  const shopProductImageCols = db.prepare("PRAGMA table_info(shop_product_images)").all() as any[];
  const hasPersonalizationOptionId = shopProductImageCols.some(col => col.name === 'personalization_option_id');
  if (!hasPersonalizationOptionId) {
    console.log('Migrating database: Adding personalization_option_id to shop_product_images table');
    db.exec('ALTER TABLE shop_product_images ADD COLUMN personalization_option_id TEXT');
  }

  const hasPersonalizationOptionIds = shopProductImageCols.some(col => col.name === 'personalization_option_ids');
  if (!hasPersonalizationOptionIds) {
    console.log('Migrating database: Adding personalization_option_ids to shop_product_images table');
    db.exec('ALTER TABLE shop_product_images ADD COLUMN personalization_option_ids TEXT');
    // Migrate existing data: Copy single ID to array if exists
    db.exec(`UPDATE shop_product_images SET personalization_option_ids = '["' || personalization_option_id || '"]' WHERE personalization_option_id IS NOT NULL`);
  }

  const shopProductAssignmentCols = db.prepare("PRAGMA table_info(shop_product_assignments)").all() as any[];
  const hasVariants = shopProductAssignmentCols.some(col => col.name === 'variants');
  if (!hasVariants) {
    console.log('Migrating database: Adding variants to shop_product_assignments table');
    db.exec('ALTER TABLE shop_product_assignments ADD COLUMN variants TEXT');
  }
  
  const hasPersonalizationOptions = shopProductAssignmentCols.some(col => col.name === 'personalization_options');
  if (!hasPersonalizationOptions) {
    console.log('Migrating database: Adding personalization_options to shop_product_assignments table');
    db.exec('ALTER TABLE shop_product_assignments ADD COLUMN personalization_options TEXT'); // JSON array of selected option IDs
  }
} catch (error) {
  console.error('Migration error (variants/personalization):', error);
}

// Migration: Add customer_id if it doesn't exist (for existing databases)
try {
  const columns = db.prepare("PRAGMA table_info(orders)").all() as any[];
  const hasCustomerId = columns.some(col => col.name === 'customer_id');
  if (!hasCustomerId) {
    console.log('Migrating database: Adding customer_id to orders table');
    db.exec('ALTER TABLE orders ADD COLUMN customer_id TEXT');
  }

  const hasCustomerContact = columns.some(col => col.name === 'customer_contact_person');
  if (!hasCustomerContact) {
    console.log('Migrating database: Adding customer_contact_person to orders table');
    db.exec('ALTER TABLE orders ADD COLUMN customer_contact_person TEXT');
  }

  const hasOrderNumber = columns.some(col => col.name === 'order_number');
  if (!hasOrderNumber) {
    console.log('Migrating database: Adding order_number to orders table');
    db.exec('ALTER TABLE orders ADD COLUMN order_number TEXT');
  }

  const hasPrintStatus = columns.some(col => col.name === 'print_status');
  if (!hasPrintStatus) {
    console.log('Migrating database: Adding print_status to orders table');
    db.exec("ALTER TABLE orders ADD COLUMN print_status TEXT DEFAULT 'pending'");
  }

  const orderItemColumns = db.prepare("PRAGMA table_info(order_items)").all() as any[];
  const hasItemNumber = orderItemColumns.some(col => col.name === 'item_number');
  if (!hasItemNumber) {
    console.log('Migrating database: Adding item_number to order_items table');
    db.exec('ALTER TABLE order_items ADD COLUMN item_number TEXT');
  }

  const hasManualOrderNumber = orderItemColumns.some(col => col.name === 'manual_order_number');
  if (!hasManualOrderNumber) {
    console.log('Migrating database: Adding manual_order_number to order_items table');
    db.exec('ALTER TABLE order_items ADD COLUMN manual_order_number TEXT');
  }

  console.log('Checking database schema for missing columns...');
  const customerColumns = db.prepare("PRAGMA table_info(customers)").all() as any[];
  const hasShopwareUrl = customerColumns.some(col => col.name === 'shopware_url');
  if (!hasShopwareUrl) {
    console.log('Migrating database: Adding shopware columns to customers table');
    db.exec('ALTER TABLE customers ADD COLUMN shopware_url TEXT');
    db.exec("ALTER TABLE customers ADD COLUMN shopware_version TEXT DEFAULT '6'");
    db.exec('ALTER TABLE customers ADD COLUMN shopware_access_key TEXT');
    db.exec('ALTER TABLE customers ADD COLUMN shopware_secret_key TEXT');
  } else {
    // Check if shopware_version exists
    const hasShopwareVersion = customerColumns.some(col => col.name === 'shopware_version');
    if (!hasShopwareVersion) {
        console.log('Migrating database: Adding shopware_version to customers table');
        db.exec("ALTER TABLE customers ADD COLUMN shopware_version TEXT DEFAULT '6'");
    }
  }

  const hasContactPerson = customerColumns.some(col => col.name === 'contact_person');
  if (!hasContactPerson) {
    console.log('Migrating database: Adding contact_person to customers table');
    db.exec('ALTER TABLE customers ADD COLUMN contact_person TEXT');
  }

  const customerProductColumns = db.prepare("PRAGMA table_info(customer_products)").all() as any[];
  const hasSupplierId = customerProductColumns.some(col => col.name === 'supplier_id');
  if (!hasSupplierId) {
    console.log('Migrating database: Adding supplier_id to customer_products table');
    db.exec('ALTER TABLE customer_products ADD COLUMN supplier_id TEXT');
  }

  const customerProductFileColumns = db.prepare("PRAGMA table_info(customer_product_files)").all() as any[];
  const hasType = customerProductFileColumns.some(col => col.name === 'type');
  if (!hasType) {
    console.log('Migrating database: Adding type to customer_product_files table');
    db.exec("ALTER TABLE customer_product_files ADD COLUMN type TEXT DEFAULT 'print'");
  }

  const hasQuantity = customerProductFileColumns.some(col => col.name === 'quantity');
  if (!hasQuantity) {
    console.log('Migrating database: Adding quantity to customer_product_files table');
    db.exec("ALTER TABLE customer_product_files ADD COLUMN quantity INTEGER DEFAULT 1");
  }

  const hasApprovalToken = columns.some(col => col.name === 'approval_token');
  if (!hasApprovalToken) {
    console.log('Migrating database: Adding approval columns to orders table');
    db.exec('ALTER TABLE orders ADD COLUMN approval_token TEXT');
    db.exec("ALTER TABLE orders ADD COLUMN approval_status TEXT DEFAULT 'pending'");
    db.exec('ALTER TABLE orders ADD COLUMN approved_by TEXT');
    db.exec('ALTER TABLE orders ADD COLUMN approved_at DATETIME');
    db.exec('ALTER TABLE orders ADD COLUMN rejection_reason TEXT');
  }

  const hasApprovalComment = columns.some(col => col.name === 'approval_comment');
  if (!hasApprovalComment) {
    console.log('Migrating database: Adding approval_comment to orders table');
    db.exec('ALTER TABLE orders ADD COLUMN approval_comment TEXT');
  }

  const hasShopwareOrderId = columns.some(col => col.name === 'shopware_order_id');
  if (!hasShopwareOrderId) {
    console.log('Migrating database: Adding shopware_order_id to orders table');
    db.exec('ALTER TABLE orders ADD COLUMN shopware_order_id TEXT');
  }

  const hasSteps = columns.some(col => col.name === 'steps');
  if (!hasSteps) {
      console.log('Migrating database: Adding steps to orders table');
      db.exec('ALTER TABLE orders ADD COLUMN steps TEXT'); // JSON string for { processing: boolean, produced: boolean, invoiced: boolean }
  }

  const fileColumns = db.prepare("PRAGMA table_info(files)").all() as any[];
  const hasPrintStatusFile = fileColumns.some(col => col.name === 'print_status');
  if (!hasPrintStatusFile) {
      console.log('Migrating database: Adding print_status to files table');
      db.exec("ALTER TABLE files ADD COLUMN print_status TEXT DEFAULT 'pending'");
  }

  const hasThumbnailFile = fileColumns.some(col => col.name === 'thumbnail');
  if (!hasThumbnailFile) {
      console.log('Migrating database: Adding thumbnail to files table');
      db.exec("ALTER TABLE files ADD COLUMN thumbnail TEXT");
  }

  const customerProductCols = db.prepare("PRAGMA table_info(customer_products)").all() as any[];
  const hasColor = customerProductCols.some(col => col.name === 'color');
  if (!hasColor) {
    console.log('Migrating database: Adding color/size to customer_products table');
    db.exec('ALTER TABLE customer_products ADD COLUMN color TEXT');
    db.exec('ALTER TABLE customer_products ADD COLUMN size TEXT');
  }

  const hasDescription = customerProductCols.some(col => col.name === 'description');
  if (!hasDescription) {
    console.log('Migrating database: Adding description to customer_products table');
    db.exec('ALTER TABLE customer_products ADD COLUMN description TEXT');
  }

  const shopCategoryCols = db.prepare("PRAGMA table_info(shop_categories)").all() as any[];
  const hasParentId = shopCategoryCols.some(col => col.name === 'parent_id');
  if (!hasParentId) {
    console.log('Migrating database: Adding parent_id to shop_categories table');
    db.exec('ALTER TABLE shop_categories ADD COLUMN parent_id TEXT');
  }

  const shopProductAssignmentCols = db.prepare("PRAGMA table_info(shop_product_assignments)").all() as any[];
  const hasPersonalizationEnabled = shopProductAssignmentCols.some(col => col.name === 'personalization_enabled');
  if (!hasPersonalizationEnabled) {
    console.log('Migrating database: Adding personalization_enabled to shop_product_assignments table');
    db.exec('ALTER TABLE shop_product_assignments ADD COLUMN personalization_enabled BOOLEAN DEFAULT 0');
  }

  const hasManufacturerInfo = customerProductCols.some(col => col.name === 'manufacturer_info');
  if (!hasManufacturerInfo) {
    console.log('Migrating database: Adding manufacturer_info to customer_products table');
    db.exec('ALTER TABLE customer_products ADD COLUMN manufacturer_info TEXT');
  }

  // Migration: Fix file types for shop images
  // Previously all files were 'print'. We want shop images to be 'view'.
  // We assume all files currently assigned to shops are images.
  try {
      // Check if we have any 'view' types yet. If not, this might be the first run of this migration.
      const viewTypeExists = db.prepare("SELECT count(*) as count FROM customer_product_files WHERE type = 'view'").get() as any;
      if (viewTypeExists.count === 0) {
          console.log('Migrating database: Updating Shop Images to type="view"');
          db.exec(`
            UPDATE customer_product_files 
            SET type = 'view' 
            WHERE id IN (SELECT customer_product_file_id FROM shop_product_images)
          `);
      }
  } catch (e) {
      console.error('Migration error (view type):', e);
  }

  // Create new tables that depend on others
  db.exec(`
    CREATE TABLE IF NOT EXISTS color_codes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      hex_code TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shop_customers (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      email TEXT NOT NULL,
      password TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      company TEXT,
      street TEXT,
      zip TEXT,
      city TEXT,
      phone TEXT,
      data_privacy_accepted BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(shop_id) REFERENCES shops(id) ON DELETE CASCADE,
      UNIQUE(shop_id, email)
    );
  `);

} catch (error) {
  console.error('Migration error:', error);
}

export default db;
export { DATA_DIR };
