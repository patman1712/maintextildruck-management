import db from '../api/db.js';

console.log('--- Checking for Order #35 ---');

// Search by title or order_number
const orders = db.prepare(`
    SELECT id, title, order_number, status, shopware_order_id, description 
    FROM orders 
    WHERE shopware_order_id LIKE '%88%'
`).all() as any[];

if (orders.length > 0) {
    console.log(`Found ${orders.length} potential matches for #35:`);
    orders.forEach(o => {
        console.log(`- ID: ${o.id}, Title: ${o.title}, Status: ${o.status}, SW-ID: ${o.shopware_order_id}`);
    });

    console.log('\n--- DELETING Order #35 ---');
    
    const ids = orders.map(o => o.id);
    
    // Delete Items
    const delItems = db.prepare(`DELETE FROM order_items WHERE order_id IN (${ids.map(() => '?').join(',')})`).run(...ids);
    console.log(`Deleted ${delItems.changes} items.`);

    // Delete Files
    const delFiles = db.prepare(`DELETE FROM files WHERE order_id IN (${ids.map(() => '?').join(',')})`).run(...ids);
    console.log(`Deleted ${delFiles.changes} files.`);

    // Delete Orders
    const delOrders = db.prepare(`DELETE FROM orders WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
    console.log(`Deleted ${delOrders.changes} orders.`);

} else {
    console.log('No order #35 found in local database.');
}

console.log('--- Check Complete ---');
