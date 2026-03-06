

const Database = require('better-sqlite3');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const dbPath = path.join(DATA_DIR, 'database.sqlite');
console.log('Using database at:', dbPath);

const db = new Database(dbPath);


console.log('Running robust migration for global_shop_content...');

try {
    // Check if table exists
    const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='global_shop_content'").get();
    
    if (!tableInfo) {
        console.log('Table global_shop_content does NOT exist. Creating it now...');
        db.exec(`
          CREATE TABLE global_shop_content (
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
        console.log('Table created successfully.');
    } else {
        console.log('Table global_shop_content already exists.');
    }

    // Ensure default row exists
    const row = db.prepare("SELECT id FROM global_shop_content WHERE id = 'main'").get();
    if (!row) {
        console.log('Default row "main" does not exist. Inserting...');
        db.prepare("INSERT INTO global_shop_content (id) VALUES ('main')").run();
        console.log('Default row created.');
    } else {
        console.log('Default row "main" exists.');
    }

    console.log('Migration completed successfully.');

} catch (error) {
    console.error('Migration FAILED:', error.message);
}
