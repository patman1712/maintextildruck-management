
import db from './api/db.ts';

const orderNumber = '2026-6397';

console.log(`\n=== DEBUGGING ORDER ${orderNumber} ===\n`);

// 1. Get Order
const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber) as any;

if (!order) {
    console.error('❌ Order not found!');
    process.exit(1);
}

console.log('Order Details:');
console.log(`- ID: ${order.id}`);
console.log(`- Customer ID (Shop Owner): ${order.customer_id}`);
console.log(`- Shop Customer ID: ${order.shop_customer_id}`);
console.log(`- Shop ID: ${order.shop_id}`);

// 2. Get Shop Config
const shopConfig = db.prepare('SELECT * FROM shop_shipping_config WHERE shop_id = ?').get(order.shop_id) as any || {};
const globalConfig = db.prepare("SELECT * FROM global_shipping_config WHERE id = 'main'").get() as any || {};

let packagingWeight = 0;
if (shopConfig.packaging_weight && parseFloat(shopConfig.packaging_weight) > 0) {
    packagingWeight = parseFloat(shopConfig.packaging_weight);
    console.log(`- Packaging Weight (Shop): ${packagingWeight}kg`);
} else {
    packagingWeight = parseFloat(globalConfig.packaging_weight || 0);
    console.log(`- Packaging Weight (Global): ${packagingWeight}kg`);
}

// 3. Get Items
const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id) as any[];
console.log(`\nFound ${items.length} Items:\n`);

let totalItemWeight = 0;

for (const item of items) {
    console.log(`🔹 Item: "${item.item_name}"`);
    console.log(`   - SKU: "${item.item_number}"`);
    console.log(`   - Qty: ${item.quantity}`);
    
    let product = null;
    let method = '';

    // Strategy 1: SKU + Customer ID
    if (item.item_number) {
        product = db.prepare(`
            SELECT id, name, weight, product_number 
            FROM customer_products 
            WHERE product_number = ? AND customer_id = ?
        `).get(item.item_number, order.customer_id) as any;
        
        if (product) method = 'SKU + CustomerID';
        
        // Strategy 2: SKU Global
        if (!product) {
            product = db.prepare(`
                SELECT id, name, weight, product_number 
                FROM customer_products 
                WHERE product_number = ?
            `).get(item.item_number) as any;
            if (product) method = 'SKU Global';
        }
    }

    // Strategy 3: Name + Customer ID
    if (!product) {
        const cleanName = item.item_name.trim();
        product = db.prepare(`
            SELECT id, name, weight, product_number 
            FROM customer_products 
            WHERE LOWER(name) = LOWER(?) AND customer_id = ?
        `).get(cleanName, order.customer_id) as any;
        if (product) method = 'Name + CustomerID';
    }

    // Strategy 4: Name Global
    if (!product) {
        const cleanName = item.item_name.trim();
        product = db.prepare(`
            SELECT id, name, weight, product_number 
            FROM customer_products 
            WHERE LOWER(name) = LOWER(?)
        `).get(cleanName) as any;
        if (product) method = 'Name Global';
    }

    if (product) {
        console.log(`   ✅ FOUND via ${method}`);
        console.log(`   - Product ID: ${product.id}`);
        console.log(`   - Name: ${product.name}`);
        console.log(`   - DB Weight: ${product.weight} (${typeof product.weight})`);
        
        let w = parseFloat(String(product.weight).replace(',', '.'));
        console.log(`   - Parsed Weight: ${w}kg`);
        
        if (isNaN(w)) w = 0;
        totalItemWeight += (w * item.quantity);
    } else {
        console.log(`   ❌ NOT FOUND`);
        
        // Debug: Search for similar names?
        const similar = db.prepare(`SELECT name FROM customer_products WHERE name LIKE ? LIMIT 3`).all(`%${item.item_name}%`);
        if (similar.length > 0) {
            console.log(`   (Did you mean: ${similar.map((s:any) => s.name).join(', ')}?)`);
        }
    }
    console.log('');
}

console.log('=== CALCULATION ===');
console.log(`Total Item Weight: ${totalItemWeight}kg`);
console.log(`Packaging Weight: ${packagingWeight}kg`);
console.log(`FINAL WEIGHT: ${totalItemWeight + packagingWeight}kg`);

