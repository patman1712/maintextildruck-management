
import db from '../api/db.js';

const orders = db.prepare('SELECT id, order_number, title, files FROM orders ORDER BY created_at DESC LIMIT 5').all();

console.log('Last 5 orders:');
orders.forEach((o: any) => {
    console.log(`ID: ${o.id}, Number: ${o.order_number}, Title: ${o.title}`);
    try {
        const files = JSON.parse(o.files || '[]');
        console.log(`  Files: ${files.length}`);
        files.forEach((f: any, i: number) => {
            console.log(`    ${i + 1}. ${f.name} (${f.type}) - URL: ${f.url || f.path}`);
        });
    } catch (e) {
        console.log(`  Files: Error parsing JSON`);
    }
});
