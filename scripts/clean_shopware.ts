import db from '../api/db.js';

console.log('--- Cleaning Shopware Orders ---');

// Count orders before
const countBefore = db.prepare(`SELECT COUNT(*) as count FROM orders WHERE description LIKE '%Importiert%'`).get() as any;
console.log(`Found ${countBefore.count} orders to delete.`);

// Delete items
const deleteItems = db.prepare(`
    DELETE FROM order_items 
    WHERE order_id IN (
        SELECT id FROM orders 
        WHERE description LIKE '%Importiert%'
    )
`).run();
console.log(`Deleted ${deleteItems.changes} order items.`);

// Delete files
const deleteFiles = db.prepare(`
    DELETE FROM files 
    WHERE order_id IN (
        SELECT id FROM orders 
        WHERE description LIKE '%Importiert%'
    )
`).run();
console.log(`Deleted ${deleteFiles.changes} files.`);

// Delete orders
const deleteOrders = db.prepare(`
    DELETE FROM orders 
    WHERE description LIKE '%Importiert%'
`).run();
console.log(`Deleted ${deleteOrders.changes} orders.`);

console.log('--- Cleanup Complete ---');
