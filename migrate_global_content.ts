
import db from './api/db.ts';

console.log('Migrating database: Creating global_shop_content table...');

db.exec(`
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

// Insert default row if not exists
const row = db.prepare("SELECT id FROM global_shop_content WHERE id = 'main'").get();
if (!row) {
    db.prepare("INSERT INTO global_shop_content (id) VALUES ('main')").run();
    console.log('Created default global content row.');
}

console.log('Migration complete.');
