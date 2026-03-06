
const Database = require('better-sqlite3');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const dbPath = path.join(DATA_DIR, 'database.sqlite');
console.log('Using database at:', dbPath);

const db = new Database(dbPath);

console.log('Migrating shops table for footer fields...');

const columns = [
    { name: 'footer_logo_url', type: 'TEXT' },
    { name: 'contact_phone', type: 'TEXT' },
    { name: 'contact_email', type: 'TEXT' },
    { name: 'contact_address', type: 'TEXT' },
    { name: 'opening_hours', type: 'TEXT' },
    { name: 'social_instagram', type: 'TEXT' },
    { name: 'social_tiktok', type: 'TEXT' },
    { name: 'social_whatsapp', type: 'TEXT' },
    { name: 'impressum_text', type: 'TEXT' },
    { name: 'privacy_text', type: 'TEXT' },
    { name: 'agb_text', type: 'TEXT' },
    { name: 'revocation_text', type: 'TEXT' },
    { name: 'shipping_info_text', type: 'TEXT' },
    { name: 'about_us_text', type: 'TEXT' },
    { name: 'contact_text', type: 'TEXT' }
];

for (const col of columns) {
    try {
        db.prepare(`ALTER TABLE shops ADD COLUMN ${col.name} ${col.type}`).run();
        console.log(`Added column ${col.name}`);
    } catch (e) {
        if (e.message.includes('duplicate column name')) {
            console.log(`Column ${col.name} already exists`);
        } else {
            console.error(`Error adding column ${col.name}:`, e.message);
        }
    }
}

console.log('Migration complete.');
