
import db from '../api/db.js';

console.log('Running migration: Fix missing customer_id for shop orders...');

// 1. Find orders with missing customer_id but having shop_id
const orders = db.prepare(`
    SELECT id, shop_id, order_number 
    FROM orders 
    WHERE shop_id IS NOT NULL AND customer_id IS NULL
`).all() as { id: string, shop_id: string, order_number: string }[];

console.log(`Found ${orders.length} orders to fix.`);

let updatedCount = 0;

const updateStmt = db.prepare('UPDATE orders SET customer_id = ? WHERE id = ?');
const shopStmt = db.prepare('SELECT customer_id FROM shops WHERE id = ?');

for (const order of orders) {
    const shop = shopStmt.get(order.shop_id) as { customer_id: string } | undefined;
    
    if (shop && shop.customer_id) {
        updateStmt.run(shop.customer_id, order.id);
        updatedCount++;
        // console.log(`- Fixed Order #${order.order_number} (Customer ID: ${shop.customer_id})`);
    } else {
        console.warn(`- Could not find shop owner for Shop ID: ${order.shop_id} (Order #${order.order_number})`);
    }
}

console.log(`Migration complete. Updated ${updatedCount} orders.`);
