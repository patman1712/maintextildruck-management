
import db from './api/db.ts';

console.log('Starting shipping config migration fix...');

// 1. Ensure global_shipping_config has dhl_api_key and packaging_weight
try {
  const tableInfo = db.prepare("PRAGMA table_info(global_shipping_config)").all();
  const hasApiKey = tableInfo.some((col: any) => col.name === 'dhl_api_key');
  const hasWeight = tableInfo.some((col: any) => col.name === 'packaging_weight');

  if (!hasApiKey) {
    console.log('Adding dhl_api_key to global_shipping_config...');
    db.prepare("ALTER TABLE global_shipping_config ADD COLUMN dhl_api_key TEXT").run();
  }

  if (!hasWeight) {
    console.log('Adding packaging_weight to global_shipping_config...');
    db.prepare("ALTER TABLE global_shipping_config ADD COLUMN packaging_weight REAL DEFAULT 0").run();
  }
} catch (error) {
  console.error('Error migrating global_shipping_config:', error);
}

// 2. Ensure shop_shipping_config has dhl_api_key and packaging_weight
try {
  // Create table if not exists (just in case)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS shop_shipping_config (
      shop_id TEXT PRIMARY KEY,
      dhl_user TEXT,
      dhl_signature TEXT,
      dhl_ekp TEXT,
      dhl_participation TEXT,
      dhl_sandbox INTEGER DEFAULT 0,
      sender_name TEXT,
      sender_street TEXT,
      sender_house_number TEXT,
      sender_zip TEXT,
      sender_city TEXT,
      sender_country TEXT DEFAULT 'DEU',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const tableInfo = db.prepare("PRAGMA table_info(shop_shipping_config)").all();
  const hasApiKey = tableInfo.some((col: any) => col.name === 'dhl_api_key');
  const hasWeight = tableInfo.some((col: any) => col.name === 'packaging_weight');

  if (!hasApiKey) {
    console.log('Adding dhl_api_key to shop_shipping_config...');
    db.prepare("ALTER TABLE shop_shipping_config ADD COLUMN dhl_api_key TEXT").run();
  }

  if (!hasWeight) {
    console.log('Adding packaging_weight to shop_shipping_config...');
    db.prepare("ALTER TABLE shop_shipping_config ADD COLUMN packaging_weight REAL DEFAULT 0").run();
  }
} catch (error) {
  console.error('Error migrating shop_shipping_config:', error);
}

console.log('Migration completed successfully.');
