
import db from '../api/db.js';

const orderNumber = '2026-0002';
const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber);

if (order) {
    console.log('Order found:', order.id);
    console.log('Files raw:', order.files);
    try {
        const files = JSON.parse(order.files);
        console.log('Files parsed:', JSON.stringify(files, null, 2));
        console.log('File count:', files.length);
    } catch (e) {
        console.error('Error parsing files JSON:', e);
    }
} else {
    console.log('Order not found');
}
