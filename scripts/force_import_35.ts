import db from '../api/db.js';

console.log('--- FORCE IMPORT Order #35 ---');

// 1. Get Customer Config
const customer = db.prepare("SELECT * FROM customers WHERE shopware_url IS NOT NULL LIMIT 1").get() as any;
if (!customer) {
    console.error('No customer found!');
    process.exit(1);
}

const baseUrl = customer.shopware_url.replace(/\/$/, '');
const authString = Buffer.from(`${customer.shopware_access_key}:${customer.shopware_secret_key}`).toString('base64');

async function run() {
    try {
        console.log(`Fetching Order #35 from Shopware 5 (${baseUrl})...`);
        const response = await fetch(`${baseUrl}/api/orders?filter[0][property]=number&filter[0][value]=35`, {
            headers: { 'Authorization': `Basic ${authString}`, 'Accept': 'application/json' }
        });
        const json = await response.json();
        
        if (!json.data || json.data.length === 0) {
            console.error('Order #35 not found in API!');
            return;
        }

        const swOrder = json.data[0];
        console.log(`Found Order: ID=${swOrder.id}, Time=${swOrder.orderTime}`);

        // Fetch Details
        console.log('Fetching details...');
        const detailRes = await fetch(`${baseUrl}/api/orders/${swOrder.id}`, {
            headers: { 'Authorization': `Basic ${authString}`, 'Accept': 'application/json' }
        });
        const detailedOrder = (await detailRes.json()).data;

        // INSERT
        console.log('Inserting into DB...');
        
        const newOrderId = Math.random().toString(36).substr(2, 9);
        const orderNumber = detailedOrder.number;
        const deadlineDate = new Date();
        deadlineDate.setDate(deadlineDate.getDate() + 14);
        const deadline = deadlineDate.toISOString().split('T')[0];

        // Address
        let address = 'N/A';
        let contactPerson = 'N/A';
        const shipping = detailedOrder.shipping || detailedOrder.billing;
        if (shipping) {
            address = `${shipping.firstName} ${shipping.lastName}\n${shipping.street} ${shipping.streetNumber || ''}\n${shipping.zipCode} ${shipping.city}`;
            contactPerson = `${shipping.firstName} ${shipping.lastName}`;
        }

        const newOrder = {
            id: newOrderId,
            title: `Shopware Order #${orderNumber}`,
            order_number: orderNumber, 
            customer_id: customer.id,
            customer_name: customer.name, 
            customer_email: customer.email,
            customer_phone: customer.phone,
            customer_address: address,
            customer_contact_person: contactPerson,
            deadline: deadline,
            status: 'active',
            description: `Importiert aus Shopware (FORCE).\nBestell-Nr: ${orderNumber}`,
            shopware_order_id: detailedOrder.id.toString(),
            steps: { processing: false, produced: false, invoiced: false }
        };

        db.prepare(`
            INSERT INTO orders (
                id, title, order_number, customer_id, customer_name, customer_email, customer_phone, customer_address, customer_contact_person,
                deadline, status, description, shopware_order_id, created_at, steps
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            newOrder.id, newOrder.title, newOrder.order_number, newOrder.customer_id, newOrder.customer_name, newOrder.customer_email, newOrder.customer_phone, newOrder.customer_address, newOrder.customer_contact_person,
            newOrder.deadline, newOrder.status, newOrder.description, newOrder.shopware_order_id, new Date().toISOString(), JSON.stringify(newOrder.steps)
        );

        console.log('SUCCESS! Order inserted.');

    } catch (e: any) {
        console.error('ERROR:', e.message);
        console.error(e);
    }
}

run();
