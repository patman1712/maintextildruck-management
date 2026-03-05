
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
const db = new Database(dbPath);

try {
    const columns = db.prepare("PRAGMA table_info(orders)").all();
    
    const hasTracking = columns.some(col => col.name === 'tracking_number');
    if (!hasTracking) {
        console.log('Adding tracking_number column...');
        db.exec('ALTER TABLE orders ADD COLUMN tracking_number TEXT');
    } else {
        console.log('tracking_number column already exists.');
    }

    const hasLabelUrl = columns.some(col => col.name === 'label_url');
    if (!hasLabelUrl) {
        console.log('Adding label_url column...');
        db.exec('ALTER TABLE orders ADD COLUMN label_url TEXT');
    } else {
        console.log('label_url column already exists.');
    }

    const hasShippedAt = columns.some(col => col.name === 'shipped_at');
    if (!hasShippedAt) {
        console.log('Adding shipped_at column...');
        db.exec('ALTER TABLE orders ADD COLUMN shipped_at DATETIME');
    } else {
        console.log('shipped_at column already exists.');
    }
    
    console.log('Migration completed successfully.');
} catch (error) {
    console.error('Migration failed:', error);
}
