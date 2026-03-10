
import Database from 'better-sqlite3';

const db = new Database('data/database.sqlite');

// 1. Create Test Data
const customerId = 'test-customer-filter-v3';
const shopId = 'test-shop-filter-v3';
const slug = 'test-shop-v3';

try {
    console.log('--- Setting up Test Data ---');
    // Clean up
    db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);
    db.prepare('DELETE FROM shops WHERE id = ?').run(shopId);
    db.prepare('DELETE FROM shops WHERE domain_slug = ?').run(slug);
    db.prepare('DELETE FROM customer_products WHERE customer_id = ?').run(customerId);

    // Insert Customer
    db.prepare("INSERT INTO customers (id, name, email) VALUES (?, 'Test Customer', 'test@example.com')").run(customerId);

    // Insert Shop
    db.prepare("INSERT INTO shops (id, customer_id, name, domain_slug) VALUES (?, ?, 'Test Shop', ?)").run(shopId, customerId, slug);

    // Insert P1: Manual
    const p1 = 'p1-manual';
    db.prepare("INSERT INTO customer_products (id, customer_id, name, source) VALUES (?, ?, 'P1 Manual', 'manual')").run(p1, customerId);

    // Insert P2: Shopware Unassigned
    const p2 = 'p2-shopware-unassigned';
    db.prepare("INSERT INTO customer_products (id, customer_id, name, source) VALUES (?, ?, 'P2 Shopware Unassigned', 'shopware')").run(p2, customerId);

    // Insert P3: Shopware Assigned
    const p3 = 'p3-shopware-assigned';
    db.prepare("INSERT INTO customer_products (id, customer_id, name, source) VALUES (?, ?, 'P3 Shopware Assigned', 'shopware')").run(p3, customerId);
    
    // Assign P3
    db.prepare("INSERT INTO shop_product_assignments (id, shop_id, product_id, price) VALUES ('assign-1', ?, ?, 10.00)").run(shopId, p3);

    // 2. Run Query (Simulation of API)
    const products = db.prepare(`
        SELECT p.id, p.name, p.source,
        (SELECT price FROM shop_product_assignments spa WHERE spa.product_id = p.id ORDER BY spa.created_at DESC LIMIT 1) as price,
        (SELECT count(*) FROM shop_product_assignments spa WHERE spa.product_id = p.id) as assignment_count
        FROM customer_products p 
        WHERE p.customer_id = ? 
        ORDER BY p.created_at DESC
    `).all(customerId);

    console.log('--- Query Results ---');
    products.forEach(p => {
        const show = p.source !== 'shopware' || (p.assignment_count > 0);
        console.log(`Product: ${p.name}`);
        console.log(`  Source: ${p.source}`);
        console.log(`  Count: ${p.assignment_count} (Type: ${typeof p.assignment_count})`);
        console.log(`  Price: ${p.price}`);
        console.log(`  Action: ${show ? 'SHOW' : 'HIDE'}`);
        console.log('---------------------');
    });

} catch (e) {
    console.error(e);
}
