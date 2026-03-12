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
db.pragma('foreign_keys = ON'); // Enable foreign key constraints

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
    status TEXT DEFAULT 'active', -- NEW: status column
    print_status TEXT DEFAULT 'pending', -- pending, ordered, completed
    quantity INTEGER DEFAULT 1, -- NEW: quantity of prints needed
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
    weight DECIMAL(10, 3) DEFAULT 0,
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
  CREATE TABLE IF NOT EXISTS shop_product_assignment_categories (
    id TEXT PRIMARY KEY,
    shop_product_assignment_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(shop_product_assignment_id) REFERENCES shop_product_assignments(id) ON DELETE CASCADE,
    FOREIGN KEY(category_id) REFERENCES shop_categories(id) ON DELETE CASCADE,
    UNIQUE(shop_product_assignment_id, category_id)
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

// Migration for is_active and supplier_id
try {
    const shopProductAssignmentCols = db.prepare("PRAGMA table_info(shop_product_assignments)").all() as any[];
    const hasIsActive = shopProductAssignmentCols.some(col => col.name === 'is_active');
    if (!hasIsActive) {
        console.log('Migrating database: Adding is_active to shop_product_assignments table');
        db.exec('ALTER TABLE shop_product_assignments ADD COLUMN is_active BOOLEAN DEFAULT 1');
    }

    const hasSupplierId = shopProductAssignmentCols.some(col => col.name === 'supplier_id');
    if (!hasSupplierId) {
        console.log('Migrating database: Adding supplier_id to shop_product_assignments table');
        db.exec('ALTER TABLE shop_product_assignments ADD COLUMN supplier_id TEXT');
    }
} catch (error) {
    console.error('Migration error (is_active/supplier_id):', error);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS shop_product_images (
    id TEXT PRIMARY KEY,
    shop_product_assignment_id TEXT NOT NULL,
    customer_product_file_id TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    personalization_option_ids TEXT, -- JSON array of option IDs
    variant_ids TEXT, -- JSON array of variant IDs (global variables)
    size_restrictions TEXT, -- JSON array of sizes
    attribute_restrictions TEXT, -- JSON object { [varId]: ["Value A", "Value B"] }
    FOREIGN KEY(shop_product_assignment_id) REFERENCES shop_product_assignments(id) ON DELETE CASCADE,
    FOREIGN KEY(customer_product_file_id) REFERENCES customer_product_files(id) ON DELETE CASCADE
  )
`);

// Migration for existing tables
try {
    const columns = db.prepare("PRAGMA table_info(shop_product_images)").all() as any[];
    if (!columns.some(c => c.name === 'attribute_restrictions')) {
        db.prepare("ALTER TABLE shop_product_images ADD COLUMN attribute_restrictions TEXT").run();
    }
} catch (e) {
    console.error("Migration failed:", e);
}

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

  const hasVariantIds = shopProductImageCols.some(col => col.name === 'variant_ids');
  if (!hasVariantIds) {
    console.log('Migrating database: Adding variant_ids to shop_product_images table');
    db.exec('ALTER TABLE shop_product_images ADD COLUMN variant_ids TEXT'); // JSON array of assigned variable IDs
  }

  const hasSizeRestrictions = shopProductImageCols.some(col => col.name === 'size_restrictions');
  if (!hasSizeRestrictions) {
    console.log('Migrating database: Adding size_restrictions to shop_product_images table');
    db.exec('ALTER TABLE shop_product_images ADD COLUMN size_restrictions TEXT'); // JSON array of allowed size strings
  }
  // Migration: Fix missing customer_id for shop orders
  try {
      const ordersWithMissingCustomer = db.prepare("SELECT count(*) as count FROM orders WHERE shop_id IS NOT NULL AND customer_id IS NULL").get() as any;
      if (ordersWithMissingCustomer.count > 0) {
          console.log(`Migrating database: Fixing ${ordersWithMissingCustomer.count} shop orders with missing customer_id`);
          const updates = db.prepare(`
              UPDATE orders 
              SET customer_id = (SELECT customer_id FROM shops WHERE shops.id = orders.shop_id)
              WHERE shop_id IS NOT NULL AND customer_id IS NULL
          `).run();
          console.log(`Fixed ${updates.changes} orders.`);
      }
  } catch (e) {
      console.error('Migration error (fix shop orders):', e);
  }

  // Migration: Populate shop_product_assignment_categories from existing category_id
  try {
      const assignmentCategoriesCount = db.prepare("SELECT count(*) as count FROM shop_product_assignment_categories").get() as any;
      if (assignmentCategoriesCount.count === 0) {
          console.log('Migrating database: Moving existing categories to shop_product_assignment_categories table');
          db.exec(`
              INSERT OR IGNORE INTO shop_product_assignment_categories (id, shop_product_assignment_id, category_id)
              SELECT 
                  lower(hex(randomblob(16))), -- generate UUID
                  id, 
                  category_id 
              FROM shop_product_assignments 
              WHERE category_id IS NOT NULL
          `);
      }
  } catch (e) {
      console.error('Migration error (category junction):', e);
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

  const hasStatusFile = fileColumns.some(col => col.name === 'status');
  if (!hasStatusFile) {
      console.log('Migrating database: Adding status to files table');
      db.exec("ALTER TABLE files ADD COLUMN status TEXT DEFAULT 'active'");
  }

  const hasQuantityFile = fileColumns.some(col => col.name === 'quantity');
  if (!hasQuantityFile) {
      console.log('Migrating database: Adding quantity to files table');
      db.exec("ALTER TABLE files ADD COLUMN quantity INTEGER DEFAULT 1");
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

  const hasWeight = customerProductCols.some(col => col.name === 'weight');
  if (!hasWeight) {
    console.log('Migrating database: Adding weight to customer_products table');
    db.exec('ALTER TABLE customer_products ADD COLUMN weight DECIMAL(10, 3) DEFAULT 0');
  }

  const hasDescriptionShopware = customerProductCols.some(col => col.name === 'shopware_description');
  if (!hasDescriptionShopware) {
    console.log('Migrating database: Adding shopware_description to customer_products table');
    db.exec('ALTER TABLE customer_products ADD COLUMN shopware_description TEXT');
  }

  const hasManufacturerShopware = customerProductCols.some(col => col.name === 'shopware_manufacturer');
  if (!hasManufacturerShopware) {
    console.log('Migrating database: Adding shopware_manufacturer to customer_products table');
    db.exec('ALTER TABLE customer_products ADD COLUMN shopware_manufacturer TEXT');
  }

  const hasShopwareImages = customerProductCols.some(col => col.name === 'shopware_images');
  if (!hasShopwareImages) {
      console.log('Migrating database: Adding shopware_images to customer_products table');
      db.exec('ALTER TABLE customer_products ADD COLUMN shopware_images TEXT'); // JSON array of image URLs
  }

  // Migration for Shop Orders
  const orderCols = db.prepare("PRAGMA table_info(orders)").all() as any[];
  const hasShopId = orderCols.some(col => col.name === 'shop_id');
  if (!hasShopId) {
    console.log('Migrating database: Adding shop_id and shop_customer_id to orders table');
    db.exec('ALTER TABLE orders ADD COLUMN shop_id TEXT');
    db.exec('ALTER TABLE orders ADD COLUMN shop_customer_id TEXT');
    db.exec('ALTER TABLE orders ADD COLUMN total_amount DECIMAL(10, 2)');
    db.exec('ALTER TABLE orders ADD COLUMN shipping_costs DECIMAL(10, 2)');
    db.exec('ALTER TABLE orders ADD COLUMN payment_method TEXT');
    db.exec('ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT "pending"');
  }

  const hasTransactionId = orderCols.some(col => col.name === 'transaction_id');
  if (!hasTransactionId) {
      console.log('Migrating database: Adding transaction_id to orders table');
      db.exec('ALTER TABLE orders ADD COLUMN transaction_id TEXT');
  }

  const hasTrackingNumber = orderCols.some(col => col.name === 'tracking_number');
  if (!hasTrackingNumber) {
    console.log('Migrating database: Adding tracking_number, label_url and shipped_at to orders table');
    db.exec('ALTER TABLE orders ADD COLUMN tracking_number TEXT');
    db.exec('ALTER TABLE orders ADD COLUMN label_url TEXT');
    db.exec('ALTER TABLE orders ADD COLUMN shipped_at DATETIME');
  } else {
    // Check for shipped_at specifically as it might be missing even if tracking_number exists
    const hasShippedAt = orderCols.some(col => col.name === 'shipped_at');
    if (!hasShippedAt) {
         console.log('Migrating database: Adding shipped_at to orders table');
         db.exec('ALTER TABLE orders ADD COLUMN shipped_at DATETIME');
    }
  }

  // Migration: Add API Key to shipping configs
  try {
    const shopShippingCols = db.prepare("PRAGMA table_info(shop_shipping_config)").all() as any[];
    if (shopShippingCols.length > 0) { // Table exists
        const hasApiKey = shopShippingCols.some(col => col.name === 'dhl_api_key');
        if (!hasApiKey) {
            console.log('Migrating database: Adding dhl_api_key to shop_shipping_config table');
            db.exec('ALTER TABLE shop_shipping_config ADD COLUMN dhl_api_key TEXT');
        }
        
        const hasSandbox = shopShippingCols.some(col => col.name === 'dhl_sandbox');
        if (!hasSandbox) {
            console.log('Migrating database: Adding dhl_sandbox to shop_shipping_config table');
            db.exec('ALTER TABLE shop_shipping_config ADD COLUMN dhl_sandbox BOOLEAN DEFAULT 0');
        }
    }
    
    const globalShippingCols = db.prepare("PRAGMA table_info(global_shipping_config)").all() as any[];
    if (globalShippingCols.length > 0) { // Table exists
        const hasGlobalApiKey = globalShippingCols.some(col => col.name === 'dhl_api_key');
        if (!hasGlobalApiKey) {
            console.log('Migrating database: Adding dhl_api_key to global_shipping_config table');
            db.exec('ALTER TABLE global_shipping_config ADD COLUMN dhl_api_key TEXT');
        }

        const hasGlobalSandbox = globalShippingCols.some(col => col.name === 'dhl_sandbox');
        if (!hasGlobalSandbox) {
            console.log('Migrating database: Adding dhl_sandbox to global_shipping_config table');
            db.exec('ALTER TABLE global_shipping_config ADD COLUMN dhl_sandbox BOOLEAN DEFAULT 0');
        }
    }
  } catch (e) {
    console.error('Migration error (api key):', e);
  }

  // Migration: Add packaging_weight to shipping configs
  try {
    const shopShippingCols = db.prepare("PRAGMA table_info(shop_shipping_config)").all() as any[];
    if (shopShippingCols.length > 0) {
        const hasWeight = shopShippingCols.some(col => col.name === 'packaging_weight');
        if (!hasWeight) {
            console.log('Migrating database: Adding packaging_weight to shop_shipping_config table');
            db.exec('ALTER TABLE shop_shipping_config ADD COLUMN packaging_weight DECIMAL(10, 3) DEFAULT 0');
        }

        const hasTiers = shopShippingCols.some(col => col.name === 'shipping_tiers');
        if (!hasTiers) {
            console.log('Migrating database: Adding shipping_tiers to shop_shipping_config table');
            db.exec('ALTER TABLE shop_shipping_config ADD COLUMN shipping_tiers TEXT'); // JSON array
        }
    }
    
    const globalShippingCols = db.prepare("PRAGMA table_info(global_shipping_config)").all() as any[];
    if (globalShippingCols.length > 0) {
        const hasWeight = globalShippingCols.some(col => col.name === 'packaging_weight');
        if (!hasWeight) {
            console.log('Migrating database: Adding packaging_weight to global_shipping_config table');
            db.exec('ALTER TABLE global_shipping_config ADD COLUMN packaging_weight DECIMAL(10, 3) DEFAULT 0');
        }

        const hasTiers = globalShippingCols.some(col => col.name === 'shipping_tiers');
        if (!hasTiers) {
            console.log('Migrating database: Adding shipping_tiers to global_shipping_config table');
            db.exec('ALTER TABLE global_shipping_config ADD COLUMN shipping_tiers TEXT'); // JSON array
        }
    }
  } catch (e) {
    console.error('Migration error (packaging_weight):', e);
  }

  // New table for shipping configuration
  db.exec(`
    CREATE TABLE IF NOT EXISTS shop_shipping_config (
      shop_id TEXT PRIMARY KEY,
      dhl_user TEXT,
      dhl_signature TEXT,
      dhl_ekp TEXT,
      dhl_api_key TEXT,
      dhl_sandbox BOOLEAN DEFAULT 0,
      dhl_participation TEXT DEFAULT '01',
      sender_name TEXT,
      sender_street TEXT,
      sender_house_number TEXT,
      sender_zip TEXT,
      sender_city TEXT,
      sender_country TEXT DEFAULT 'DEU',
      packaging_weight DECIMAL(10, 3) DEFAULT 0,
      shipping_tiers TEXT, -- JSON array of {min: number, max: number, price: number}
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(shop_id) REFERENCES shops(id) ON DELETE CASCADE
    )
  `);

  // Migration for Order Number Circles
  const shopCols = db.prepare("PRAGMA table_info(shops)").all() as any[];
  const hasOrderCircle = shopCols.some(col => col.name === 'order_number_circle');
  if (!hasOrderCircle) {
    console.log('Migrating database: Adding order_number_circle to shops table');
    db.exec('ALTER TABLE shops ADD COLUMN order_number_circle TEXT'); // e.g. "RE-{YYYY}-"
    db.exec('ALTER TABLE shops ADD COLUMN next_order_number INTEGER DEFAULT 1');
  }

  // Migration for Order Items price
  const orderItemCols = db.prepare("PRAGMA table_info(order_items)").all() as any[];
  const hasPrice = orderItemCols.some(col => col.name === 'price');
  if (!hasPrice) {
    console.log('Migrating database: Adding price to order_items table');
    db.exec('ALTER TABLE order_items ADD COLUMN price DECIMAL(10, 2)');
  }

  // Migration for Shop Hero Images (Slider)
  const shopColsHero = db.prepare("PRAGMA table_info(shops)").all() as any[];
  const hasHeroImages = shopColsHero.some(col => col.name === 'hero_images');
  if (!hasHeroImages) {
    console.log('Migrating database: Adding hero_images to shops table');
    db.exec('ALTER TABLE shops ADD COLUMN hero_images TEXT'); // JSON array of image URLs
  }

  // Migration for Welcome Text
  const shopColsWelcome = db.prepare("PRAGMA table_info(shops)").all() as any[];
  const hasWelcomeText = shopColsWelcome.some(col => col.name === 'welcome_text');
  if (!hasWelcomeText) {
    console.log('Migrating database: Adding welcome_text to shops table');
    db.exec('ALTER TABLE shops ADD COLUMN welcome_text TEXT');
  }

  // Migration for Customer Numbers
  try {
    const shopCustomerCols = db.prepare("PRAGMA table_info(shop_customers)").all() as any[];
    const hasCustomerNumber = shopCustomerCols.some(col => col.name === 'customer_number');
    if (!hasCustomerNumber) {
        console.log('Migrating database: Adding customer_number to shop_customers table');
        db.exec('ALTER TABLE shop_customers ADD COLUMN customer_number TEXT');
    }

    const shopColsNextCustomer = db.prepare("PRAGMA table_info(shops)").all() as any[];
    const hasNextCustomerNumber = shopColsNextCustomer.some(col => col.name === 'next_customer_number');
    if (!hasNextCustomerNumber) {
        console.log('Migrating database: Adding next_customer_number to shops table');
        db.exec('ALTER TABLE shops ADD COLUMN next_customer_number INTEGER DEFAULT 10000');
    }

    // Backfill customer numbers if missing
    const customersWithoutNumber = db.prepare('SELECT count(*) as count FROM shop_customers WHERE customer_number IS NULL').get() as { count: number };
    if (customersWithoutNumber.count > 0) {
        console.log(`Backfilling ${customersWithoutNumber.count} customers with numbers...`);
        const shops = db.prepare('SELECT id, next_customer_number FROM shops').all() as any[];
        
        const updateCustomer = db.prepare('UPDATE shop_customers SET customer_number = ? WHERE id = ?');
        const updateShop = db.prepare('UPDATE shops SET next_customer_number = ? WHERE id = ?');

        for (const shop of shops) {
            let nextNr = shop.next_customer_number || 10000;
            const customers = db.prepare('SELECT id FROM shop_customers WHERE shop_id = ? AND customer_number IS NULL ORDER BY created_at ASC').all(shop.id) as any[];
            
            if (customers.length > 0) {
                const transaction = db.transaction(() => {
                    for (const cust of customers) {
                        const nr = 'KD-' + nextNr;
                        updateCustomer.run(nr, cust.id);
                        nextNr++;
                    }
                    updateShop.run(nextNr, shop.id);
                });
                transaction();
                console.log(`Assigned numbers for shop ${shop.id}: ${customers.length} customers.`);
            }
        }
    }
  } catch (e) {
      console.error('Migration error (customer numbers):', e);
  }

  // Migration: Add is_blocked to shop_customers
  try {
      const shopCustomerCols = db.prepare("PRAGMA table_info(shop_customers)").all() as any[];
      const hasIsBlocked = shopCustomerCols.some(col => col.name === 'is_blocked');
      if (!hasIsBlocked) {
          console.log('Migrating database: Adding is_blocked to shop_customers table');
          db.exec('ALTER TABLE shop_customers ADD COLUMN is_blocked BOOLEAN DEFAULT 0');
      }
  } catch (e) {
      console.error('Migration error (is_blocked):', e);
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

    CREATE TABLE IF NOT EXISTS global_shipping_config (
      id TEXT PRIMARY KEY,
      dhl_user TEXT,
      dhl_signature TEXT,
      dhl_ekp TEXT,
      dhl_api_key TEXT,
      dhl_sandbox BOOLEAN DEFAULT 0,
      dhl_participation TEXT DEFAULT '01',
      sender_name TEXT,
      sender_street TEXT,
      sender_house_number TEXT,
      sender_zip TEXT,
      sender_city TEXT,
      sender_country TEXT DEFAULT 'DEU',
      packaging_weight DECIMAL(10, 3) DEFAULT 0,
      shipping_tiers TEXT, -- JSON array of {min: number, max: number, price: number}
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Global Payment Config Table
    CREATE TABLE IF NOT EXISTS global_payment_config (
      id TEXT PRIMARY KEY DEFAULT 'main',
      paypal_client_id TEXT,
      paypal_client_secret TEXT,
      paypal_mode TEXT DEFAULT 'sandbox', -- 'sandbox' or 'live'
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Global Shop Content (Footer & Legal)
    CREATE TABLE IF NOT EXISTS global_shop_content (
      id TEXT PRIMARY KEY DEFAULT 'main',
      footer_logo_url TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      contact_address TEXT,
      opening_hours TEXT,
      social_instagram TEXT,
      social_tiktok TEXT,
      social_whatsapp TEXT,
      impressum_text TEXT,
      privacy_text TEXT,
      agb_text TEXT,
      revocation_text TEXT,
      shipping_info_text TEXT,
      about_us_text TEXT,
      contact_text TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration: Add Company Details to Global Content
  try {
      const globalContentCols = db.prepare("PRAGMA table_info(global_shop_content)").all() as any[];
      const hasCompanyName = globalContentCols.some(col => col.name === 'company_name');
      if (!hasCompanyName) {
          console.log('Migrating database: Adding company details to global_shop_content table');
          db.exec('ALTER TABLE global_shop_content ADD COLUMN company_name TEXT');
          db.exec('ALTER TABLE global_shop_content ADD COLUMN company_address TEXT');
          db.exec('ALTER TABLE global_shop_content ADD COLUMN ceo_name TEXT');
          db.exec('ALTER TABLE global_shop_content ADD COLUMN bank_name TEXT');
          db.exec('ALTER TABLE global_shop_content ADD COLUMN bank_iban TEXT');
          db.exec('ALTER TABLE global_shop_content ADD COLUMN bank_bic TEXT');
          db.exec('ALTER TABLE global_shop_content ADD COLUMN tax_number TEXT');
          db.exec('ALTER TABLE global_shop_content ADD COLUMN vat_id TEXT');
          db.exec('ALTER TABLE global_shop_content ADD COLUMN commercial_register TEXT');
      }
  } catch (e) {
      console.error('Migration error (global content details):', e);
  }

  // New table for Email Configuration
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_config (
      id TEXT PRIMARY KEY DEFAULT 'main',
      smtp_host TEXT,
      smtp_port INTEGER DEFAULT 587,
      smtp_user TEXT,
      smtp_pass TEXT,
      smtp_secure BOOLEAN DEFAULT 0,
      sender_name TEXT,
      sender_email TEXT,
      ignore_certs BOOLEAN DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration: Add ignore_certs to email_config
  try {
      const emailConfigCols = db.prepare("PRAGMA table_info(email_config)").all() as any[];
      const hasIgnoreCerts = emailConfigCols.some(col => col.name === 'ignore_certs');
      if (!hasIgnoreCerts) {
          console.log('Migrating database: Adding ignore_certs to email_config table');
          db.exec('ALTER TABLE email_config ADD COLUMN ignore_certs BOOLEAN DEFAULT 0');
      }

      const hasResendApiKey = emailConfigCols.some(col => col.name === 'resend_api_key');
      if (!hasResendApiKey) {
          console.log('Migrating database: Adding resend_api_key to email_config table');
          db.exec('ALTER TABLE email_config ADD COLUMN resend_api_key TEXT');
      }
  } catch (e) {
      console.error('Migration error (email_config):', e);
  }

  // Ensure default row for email config
  try {
      const row = db.prepare("SELECT id FROM email_config WHERE id = 'main'").get();
      if (!row) {
          db.prepare("INSERT INTO email_config (id) VALUES ('main')").run();
      }
  } catch (e) {
      console.error('Error ensuring default email config row:', e);
  }

  // Migration: Add Invoice Number Circle to Shops
  try {
      const shopCols = db.prepare("PRAGMA table_info(shops)").all() as any[];
      const hasInvoiceCircle = shopCols.some(col => col.name === 'invoice_number_circle');
      if (!hasInvoiceCircle) {
          console.log('Migrating database: Adding invoice_number_circle to shops table');
          db.exec('ALTER TABLE shops ADD COLUMN invoice_number_circle TEXT'); // e.g. "RE-{YYYY}-"
          db.exec('ALTER TABLE shops ADD COLUMN next_invoice_number INTEGER DEFAULT 1');
      }

      const hasEmailLogo = shopCols.some(col => col.name === 'email_logo_url');
      if (!hasEmailLogo) {
          console.log('Migrating database: Adding email_logo_url to shops table');
          db.exec('ALTER TABLE shops ADD COLUMN email_logo_url TEXT');
      }
  } catch (e) {
      console.error('Migration error (invoice circle/email logo):', e);
  }

  // Migration: Add Invoice details to Orders
  try {
      const orderCols = db.prepare("PRAGMA table_info(orders)").all() as any[];
      const hasInvoiceNumber = orderCols.some(col => col.name === 'invoice_number');
      if (!hasInvoiceNumber) {
          console.log('Migrating database: Adding invoice details to orders table');
          db.exec('ALTER TABLE orders ADD COLUMN invoice_number TEXT');
          db.exec('ALTER TABLE orders ADD COLUMN invoice_date DATETIME');
          db.exec('ALTER TABLE orders ADD COLUMN invoice_path TEXT'); // Path to stored PDF
      }
  } catch (e) {
      console.error('Migration error (invoice details):', e);
  }

  // Migration for Custom Domain
  try {
      const shopCols = db.prepare("PRAGMA table_info(shops)").all() as any[];
      const hasCustomDomain = shopCols.some(col => col.name === 'custom_domain');
      if (!hasCustomDomain) {
        console.log('Migrating database: Adding custom_domain to shops table');
        db.exec('ALTER TABLE shops ADD COLUMN custom_domain TEXT');
        try {
            db.exec('CREATE UNIQUE INDEX idx_shops_custom_domain ON shops(custom_domain)');
        } catch (e) {
            console.log('Index might already exist or error creating index:', e);
        }
      }
  } catch (e) {
      console.error('Migration error (custom_domain):', e);
  }

  // Migration: Add tracking columns to order_items
  try {
      const orderItemCols = db.prepare("PRAGMA table_info(order_items)").all() as any[];
      const hasOrderedBy = orderItemCols.some(col => col.name === 'ordered_by');
      if (!hasOrderedBy) {
          console.log('Migrating database: Adding tracking columns to order_items table');
          db.exec('ALTER TABLE order_items ADD COLUMN ordered_by TEXT');
          db.exec('ALTER TABLE order_items ADD COLUMN ordered_at DATETIME');
          db.exec('ALTER TABLE order_items ADD COLUMN received_by TEXT');
          db.exec('ALTER TABLE order_items ADD COLUMN received_at DATETIME');
      }
  } catch (e) {
      console.error('Migration error (order_items tracking):', e);
  }

  // Migration: Add price_per_value to product_variables
  try {
      const variableCols = db.prepare("PRAGMA table_info(product_variables)").all() as any[];
      const hasPricePerValue = variableCols.some(col => col.name === 'price_per_value');
      if (!hasPricePerValue) {
          console.log('Migrating database: Adding price_per_value to product_variables table');
          db.exec('ALTER TABLE product_variables ADD COLUMN price_per_value BOOLEAN DEFAULT 0');
          db.exec('ALTER TABLE product_variables ADD COLUMN variable_prices TEXT'); // JSON object { "Value": Price }
      }
  } catch (e) {
      console.error('Migration error (product_variables prices):', e);
  }

  // Ensure default row for global content
  try {
      const row = db.prepare("SELECT id FROM global_shop_content WHERE id = 'main'").get();
      if (!row) {
          db.prepare("INSERT INTO global_shop_content (id) VALUES ('main')").run();
      }
  } catch (e) {
      console.error('Error ensuring default global content row:', e);
  }
} catch (error) {
  console.error('Migration error:', error);
}

export default db;
export { DATA_DIR };
