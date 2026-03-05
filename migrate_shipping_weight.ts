
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
const db = new Database(dbPath);

try {
    // Ensure table exists first
    db.exec(`
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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

    // 1. Global Config
    const globalCols = db.prepare("PRAGMA table_info(global_shipping_config)").all();
    const hasPackagingWeightGlobal = globalCols.some((col: any) => col.name === 'packaging_weight');
    
    if (!hasPackagingWeightGlobal) {
        console.log('Adding packaging_weight to global_shipping_config...');
        db.exec('ALTER TABLE global_shipping_config ADD COLUMN packaging_weight DECIMAL(10, 3) DEFAULT 0.0');
    } else {
        console.log('packaging_weight already exists in global_shipping_config.');
    }

    // Ensure shop_shipping_config exists
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(shop_id) REFERENCES shops(id) ON DELETE CASCADE
    )
  `);

    // 2. Shop Config
    const shopCols = db.prepare("PRAGMA table_info(shop_shipping_config)").all();
    const hasPackagingWeightShop = shopCols.some((col: any) => col.name === 'packaging_weight');
    
    if (!hasPackagingWeightShop) {
        console.log('Adding packaging_weight to shop_shipping_config...');
        db.exec('ALTER TABLE shop_shipping_config ADD COLUMN packaging_weight DECIMAL(10, 3) DEFAULT 0.0');
    } else {
        console.log('packaging_weight already exists in shop_shipping_config.');
    }

    console.log('Migration completed successfully.');
} catch (error) {
    console.error('Migration failed:', error);
}
