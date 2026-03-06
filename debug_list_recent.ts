
import db from './api/db.ts';

console.log('Listing last 10 orders to find the correct number...');
const orders = db.prepare('SELECT id, order_number, title, customer_name, created_at FROM orders ORDER BY created_at DESC LIMIT 10').all();
console.table(orders);
