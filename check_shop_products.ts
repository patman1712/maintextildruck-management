
import db from './api/db';

const slug = 'sgwiking';
const shop = db.prepare('SELECT * FROM shops WHERE domain_slug = ?').get(slug) as any;

if (!shop) {
    console.error(`Shop with slug "${slug}" not found.`);
    process.exit(1);
}

console.log(`Found Shop: ${shop.name} (${shop.id})`);

const products = db.prepare(`
    SELECT spa.id, spa.is_active, cp.name, spa.product_id
    FROM shop_product_assignments spa
    JOIN customer_products cp ON spa.product_id = cp.id
    WHERE spa.shop_id = ?
`).all(shop.id) as any[];

console.log(`Found ${products.length} products assigned to this shop.`);
console.log('------------------------------------------------');
console.log('ID | Active? | Name');
console.log('------------------------------------------------');
products.forEach(p => {
    console.log(`${p.id} | ${p.is_active} | ${p.name}`);
});
console.log('------------------------------------------------');
