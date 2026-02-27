import { Router, type Request, type Response } from 'express';
import db from '../db.js';

const router = Router();

// --- Helper Functions ---

async function getShopware6Token(baseUrl: string, accessKey: string, secretKey: string) {
    const url = baseUrl.replace(/\/$/, '');
    
    try {
        const response = await fetch(`${url}/api/oauth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                grant_type: 'client_credentials',
                client_id: accessKey,
                client_secret: secretKey,
            }),
        });

        if (!response.ok) {
            throw new Error(`Authentication failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error('Shopware 6 Auth Error:', error);
        throw error;
    }
}

async function getShopware6Orders(baseUrl: string, token: string) {
    const url = baseUrl.replace(/\/$/, '');
    
    // Fetch all recent orders (limit 100)
    // We remove filters to allow importing all orders (including completed)
    const payload = {
        limit: 100,
        sort: [{ field: 'orderDateTime', order: 'DESC' }],
        associations: {
            lineItems: {
                associations: {
                    cover: {}
                }
            },
            stateMachineState: {}, 
            transactions: {
                associations: {
                    stateMachineState: {}
                }
            },
            deliveries: {
                associations: {
                    shippingOrderAddress: {
                        associations: {
                            country: {}
                        }
                    }
                }
            },
            orderCustomer: {}
        }
    };

    try {
        const response = await fetch(`${url}/api/search/order`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Shopware 6 Order Fetch failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error('Shopware 6 Order Fetch Error:', error);
        throw error;
    }
}

async function getShopware5Products(baseUrl: string, username: string, apiKey: string) {
    const url = baseUrl.replace(/\/$/, '');
    
    // Shopware 5 uses Basic Auth (Digest is default but Basic often supported)
    const authString = Buffer.from(`${username}:${apiKey}`).toString('base64');
    
    try {
        const response = await fetch(`${url}/api/articles?limit=100`, {
            headers: {
                'Authorization': `Basic ${authString}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Shopware 5 Request failed (${response.status}): ${text.substring(0, 100)}`);
        }

        const data = await response.json();
        // Shopware 5 API returns { data: [...], success: true }
        if (!data.success && !Array.isArray(data.data)) {
             throw new Error('Invalid Shopware 5 response format');
        }
        return data.data; 
    } catch (error) {
        console.error('Shopware 5 Product Fetch Error:', error);
        throw error;
    }
}

async function getShopware5Orders(baseUrl: string, username: string, apiKey: string) {
    const url = baseUrl.replace(/\/$/, '');
    const authString = Buffer.from(`${username}:${apiKey}`).toString('base64');
    
    // Shopware 5 REST API requires proper encoding for filter arrays in query params.
    // However, some servers might struggle with manual URL construction.
    // Let's use URLSearchParams to handle encoding correctly.
    
    let data;

    try {
        const params = new URLSearchParams();
        // REMOVED FILTERS to allow ALL orders
        // params.append('filter[0][property]', 'status');
        // params.append('filter[0][value]', '0');
        // params.append('filter[1][property]', 'paymentStatusId'); // Try paymentStatusId instead of paymentStatus
        // params.append('filter[1][value]', '12');
        params.append('limit', '50');

        const response = await fetch(`${url}/api/orders?${params.toString()}`, {
            headers: {
                'Authorization': `Basic ${authString}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
             const errorText = await response.text();
             console.warn(`Shopware 5 Filtered Fetch failed (${response.status}): ${errorText.substring(0, 200)}`);
             throw new Error(response.statusText);
        }

        const json = await response.json();
        data = json;

    } catch (filterError) {
        console.log('Shopware 5 filtered fetch failed, trying fallback (fetch latest + client side filter)...');
        
        // Fallback: Fetch latest 50 orders sorted by orderTime DESC
        // Note: Shopware 5 uses 'orderTime' for sorting usually
        const params = new URLSearchParams();
        params.append('sort[0][property]', 'orderTime');
        params.append('sort[0][direction]', 'DESC');
        params.append('limit', '50');
        
        const response = await fetch(`${url}/api/orders?${params.toString()}`, {
             headers: {
                 'Authorization': `Basic ${authString}`,
                 'Accept': 'application/json'
             }
         });

         if (!response.ok) {
             const errorText = await response.text();
             throw new Error(`Shopware 5 Fallback Fetch failed (${response.status}): ${errorText.substring(0, 200)}`);
         }
         
         const json = await response.json();
         
         // Manually filter in JS
          // Status 0 (Open) and PaymentStatus 12 (Completely Paid)
          if (json.data && Array.isArray(json.data)) {
              // DEBUG: Log the first few orders to check their status values
              console.log('--- SW5 DEBUG: Fallback Orders ---');
              json.data.slice(0, 5).forEach((o: any) => {
                  console.log(`Order ${o.number}: Status=${o.status} (${typeof o.status}), Payment=${o.paymentStatusId} (${typeof o.paymentStatusId}) / ${o.paymentStatus?.id}`);
              });
              console.log('-----------------------------------');

              json.data = json.data.filter((o: any) => {
                  // Check status (can be string or int)
                  // Some SW5 versions use -1 for cancelled, 0 for open, 1 for in_process, etc.
                  // But sometimes '0' comes as string.
                  const statusMatch = String(o.status) === '0';
                  
                  // Check payment status (can be nested object or direct id)
                  // Usually o.paymentStatus is an object { id: 12, ... } or o.paymentStatusId is 12
                  // 12 = Completely Paid
                  let paymentMatch = false;
                  if (o.paymentStatusId !== undefined && o.paymentStatusId !== null) {
                      paymentMatch = String(o.paymentStatusId) === '12';
                  } else if (o.paymentStatus && o.paymentStatus.id) {
                      paymentMatch = String(o.paymentStatus.id) === '12';
                  }
                  
                  return statusMatch && paymentMatch;
              });
          }
         
         data = json;
    }

    // Process data
    if (!data.success && !Array.isArray(data.data)) {
             throw new Error('Invalid Shopware 5 response format');
    }

    const orders = data.data || [];
    
    // We need full details (line items) for each order
    if (orders.length > 0) {
        const detailedOrders = await Promise.all(orders.map(async (order: any) => {
            const detailRes = await fetch(`${url}/api/orders/${order.id}`, {
                headers: {
                    'Authorization': `Basic ${authString}`,
                    'Accept': 'application/json'
                }
            });
            if (detailRes.ok) {
                const detailData = await detailRes.json();
                return detailData.data;
            }
            return order;
        }));
        return detailedOrders;
    }
    
    return [];
}

async function getShopware5ArticleDetails(baseUrl: string, username: string, apiKey: string, articleId: number | string) {
    const url = baseUrl.replace(/\/$/, '');
    const authString = Buffer.from(`${username}:${apiKey}`).toString('base64');
    
    try {
        const response = await fetch(`${url}/api/articles/${articleId}`, {
            headers: {
                'Authorization': `Basic ${authString}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) return null;
        
        const data = await response.json();
        return data.data; 
    } catch (error) {
        console.error('Shopware 5 Article Detail Fetch Error:', error);
        return null;
    }
}

// --- Routes ---

// Test connection
router.post('/test-connection', async (req: Request, res: Response) => {
    const { url, version, accessKey, secretKey } = req.body;

    if (!url || !accessKey || !secretKey) {
        return res.status(400).json({ success: false, error: 'Missing credentials' });
    }

    try {
        if (version === '5') {
            await getShopware5Products(url, accessKey, secretKey);
        } else {
            await getShopware6Token(url, accessKey, secretKey);
        }
        res.json({ success: true, message: 'Connection successful' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message || 'Connection failed' });
    }
});

// Sync Orders
router.post('/sync-orders', async (req: Request, res: Response) => {
    console.log('Starting Shopware Order Sync...');
    
    // 1. Get all customers with Shopware credentials
    const customers = db.prepare(`
        SELECT * FROM customers 
        WHERE shopware_url IS NOT NULL 
        AND shopware_access_key IS NOT NULL 
        AND shopware_secret_key IS NOT NULL
    `).all() as any[];

    if (customers.length === 0) {
        return res.json({ success: true, message: 'No customers configured for Shopware sync', count: 0 });
    }

    let totalSynced = 0;
    const errors = [];
    const debugInfo: string[] = [];

    // CLEANUP: Delete orders that look like Shopware imports but have no shopware_order_id or are incomplete
    // This fixes the issue where failed imports left "zombie" orders in the manual list
    // WARNING: This is aggressive but requested by user to clean up broken state.
    try {
        const deleted = db.prepare(`
            DELETE FROM orders 
            WHERE (shopware_order_id IS NULL OR shopware_order_id = '') 
            AND (title LIKE 'Shopware Order #%' OR description LIKE '%Importiert aus Shopware%')
        `).run();
        
        // Also delete items related to these orders? 
        // SQLite usually handles this via foreign keys if CASCADE is set, but let's be safe.
        // Actually our DB schema doesn't seem to have CASCADE on order_items -> orders.
        // So we should clean up orphans.
        db.prepare('DELETE FROM order_items WHERE order_id NOT IN (SELECT id FROM orders)').run();
        db.prepare('DELETE FROM files WHERE order_id NOT IN (SELECT id FROM orders)').run();

        if (deleted.changes > 0) {
            console.log(`Cleaned up ${deleted.changes} broken Shopware import orders.`);
            debugInfo.push(`Cleaned up ${deleted.changes} broken orders.`);
        }
    } catch (e) {
        console.error('Cleanup failed:', e);
    }

    for (const customer of customers) {
        try {
            console.log(`Syncing orders for customer: ${customer.name} (${customer.shopware_version || '6'})`);
            const version = customer.shopware_version || '6';
            const baseUrl = customer.shopware_url;
            
            let orders = [];

            if (version === '5') {
                 // Inline logic to capture debug info
                 const url = baseUrl.replace(/\/$/, '');
                 const authString = Buffer.from(`${customer.shopware_access_key}:${customer.shopware_secret_key}`).toString('base64');
                 let rawOrders = [];
                 
                 // Try filtered fetch
                 try {
                    const params = new URLSearchParams();
                    // REMOVED FILTERS to allow ALL orders
                    // params.append('filter[0][property]', 'status');
                    // params.append('filter[0][value]', '0');
                    // params.append('filter[1][property]', 'paymentStatusId'); 
                    // params.append('filter[1][value]', '12');
                    params.append('limit', '100'); // Increased limit to find older/deleted orders
                    // REMOVED SORT to use default ID sorting (helps finding older orders if ID > date)
                    // params.append('sort[0][property]', 'orderTime'); 
                    // params.append('sort[0][direction]', 'DESC');

                    const response = await fetch(`${url}/api/orders?${params.toString()}`, {
                        headers: {
                            'Authorization': `Basic ${authString}`,
                            'Accept': 'application/json'
                        }
                    });
                    
                    if (response.ok) {
                        const json = await response.json();
                        rawOrders = json.data || [];
                    } else {
                        throw new Error(response.statusText);
                    }
                 } catch (e) {
                     // Fallback
                     const params = new URLSearchParams();
                     params.append('sort[0][property]', 'orderTime');
                     params.append('sort[0][direction]', 'DESC');
                     params.append('limit', '50');
                     
                     const response = await fetch(`${url}/api/orders?${params.toString()}`, {
                        headers: { 'Authorization': `Basic ${authString}`, 'Accept': 'application/json' }
                     });
                     
                     if (response.ok) {
                         const json = await response.json();
                         const fallbackOrders = json.data || [];
                         
                         // Collect Debug Info for User
                         // Enhanced Debug: Check also nested orderStatus and paymentStatus objects
                         const statusDebug = fallbackOrders.slice(0, 5).map((o: any) => {
                            const s = o.status ?? o.orderStatus?.id ?? o.orderStatusId ?? 'ND';
                            const p = o.paymentStatusId ?? o.paymentStatus?.id ?? 'ND';
                            return `#${o.number}: S=${s} P=${p}`;
                         });
                         debugInfo.push(`SW5 Fallback (${customer.name}): ${statusDebug.join(', ')}`);
                         
                         // Filter - DISABLED to import ALL orders
                        rawOrders = fallbackOrders;
                        /*
                        rawOrders = fallbackOrders.filter((o: any) => {
                             // Status: 0 (Open) OR '0'
                             // Some SW5 installations use 'orderStatusId' or nested 'orderStatus' object
                             let s = o.status;
                             if (s === undefined) s = o.orderStatusId;
                             // ... rest of logic
                             return true; 
                        });
                        */
                    }
                }
                
                // Fetch Details for ALL orders
                 if (rawOrders.length > 0) {
                     orders = await Promise.all(rawOrders.map(async (order: any) => {
                        const detailRes = await fetch(`${url}/api/orders/${order.id}`, {
                            headers: { 'Authorization': `Basic ${authString}`, 'Accept': 'application/json' }
                        });
                        return detailRes.ok ? (await detailRes.json()).data : order;
                     }));
                 }
                 
            } else {
                const token = await getShopware6Token(baseUrl, customer.shopware_access_key, customer.shopware_secret_key);
                orders = await getShopware6Orders(baseUrl, token);
            }

            console.log(`Found ${orders.length} potential orders for ${customer.name}`);

            for (const swOrder of orders) {
                // Check if order already exists
                // Check by shopware_order_id OR order_number (if shopware_order_id might be missing or changed)
                const orderNumber = swOrder.orderNumber || swOrder.number; // SW6 vs SW5
                
                const existing = db.prepare('SELECT id, shopware_order_id FROM orders WHERE shopware_order_id = ? OR order_number = ?')
                    .get(swOrder.id || swOrder.id?.toString(), orderNumber) as any;
                
                if (existing) {
                    console.log(`Order ${orderNumber} already exists. Checking for updates...`);
                    
                    // Optional: Update status if local is not completed but shopware is?
                    // But if shopware_order_id was missing (due to bad import), we should update it!
                    if (!existing.shopware_order_id && swOrder.id) {
                         console.log(`Fixing missing shopware_order_id for Order ${orderNumber}`);
                         db.prepare('UPDATE orders SET shopware_order_id = ? WHERE id = ?').run(swOrder.id.toString(), existing.id);
                    }
                    
                    continue;
                }

                // CHECK IF CUSTOMER EXISTS LOCALLY
                // The current loop variable 'customer' is the Configured Shopware Customer (the one we are syncing FROM).
                // But the order itself belongs to a specific customer IN Shopware (e.g. "Max Mustermann").
                // We need to map this to a local customer entry in our 'customers' table.
                
                // Currently, we just assign it to 'customer.id' (the agency/B2B account that has the API keys).
                // This is correct for the "Agency Model" (one API key = one main customer).
                // But if the user wants separate customers for "Online Orders" where end-customers differ,
                // we might need to create them.
                
                // However, based on the prompt "sie ist auch nur online", the user implies that maybe the *config* is missing?
                // No, the user probably means the END CUSTOMER of that order is not in the system yet.
                // But our code currently assigns ALL imported orders to the 'customer' object from the loop (line 332).
                // So if 'customer' exists (which it must, otherwise the loop wouldn't run), then customer_id is valid.
                
                // WAIT! Is it possible that `customer.id` refers to a customer that was deleted?
                // No, we fetched it from DB in line 292.
                
                // Is it possible that swOrder.id is somehow matching something else?
                // We checked 'existing' above.
                
                // DEBUG LOGGING
                console.log(`Processing Order ${orderNumber} (ID: ${swOrder.id})...`);

                // Map Order
                const newOrderId = Math.random().toString(36).substr(2, 9);
                
                // Determine Deadline (e.g., +14 days from now, or based on order date)
                // Defaulting to +14 days
                const deadlineDate = new Date();
                deadlineDate.setDate(deadlineDate.getDate() + 14);
                const deadline = deadlineDate.toISOString().split('T')[0];

                // Determine Address
                let address = '';
                let contactPerson = customer.contact_person;
                let phone = customer.phone;
                let email = customer.email; // Usually the agency/B2B customer email, maybe we want the end-customer email in description?

                if (version === '5') {
                    // SW5 Address mapping
                    const shipping = swOrder.shipping || swOrder.billing; // Fallback
                    if (shipping) {
                        address = `${shipping.firstName} ${shipping.lastName}\n${shipping.company ? shipping.company + '\n' : ''}${shipping.street} ${shipping.streetNumber || ''}\n${shipping.zipCode} ${shipping.city}\n${shipping.country?.name || ''}`;
                        contactPerson = `${shipping.firstName} ${shipping.lastName}`;
                    }
                } else {
                    // SW6 Address mapping
                    const shipping = swOrder.deliveries?.[0]?.shippingOrderAddress;
                    if (shipping) {
                        address = `${shipping.firstName} ${shipping.lastName}\n${shipping.company ? shipping.company + '\n' : ''}${shipping.street}\n${shipping.zipcode} ${shipping.city}\n${shipping.country?.name || ''}`;
                        contactPerson = `${shipping.firstName} ${shipping.lastName}`;
                        if (shipping.phoneNumber) phone = shipping.phoneNumber;
                    }
                }

                const newOrder = {
                    id: newOrderId,
                    title: `Shopware Order #${orderNumber}`,
                    order_number: orderNumber, 
                    customer_id: customer.id,
                    customer_name: customer.name, 
                    customer_email: email,
                    customer_phone: phone,
                    customer_address: address, // Use End-Customer Shipping Address
                    customer_contact_person: contactPerson,
                    deadline: deadline,
                    status: 'active',
                    description: `Importiert aus Shopware.\nBestell-Nr: ${orderNumber}\nLieferadresse (Endkunde):\n${address}`,
                    shopware_order_id: swOrder.id.toString(),
                    steps: { processing: false, produced: false, invoiced: false }
                };

                // Check status to determine if it should be auto-completed
                let isCompleted = false;
                if (version === '5') {
                    // SW5 Status: 2 = Completed
                    // Also check Payment Status? 12 = Completely Paid
                    // User says: "die schon auf komplett abgeschlossen sind"
                    const statusId = swOrder.orderStatusId || swOrder.orderStatus?.id;
                    if (String(statusId) === '2') isCompleted = true;
                } else {
                    // SW6 Status: 'completed'
                    const stateName = swOrder.stateMachineState?.technicalName;
                    if (stateName === 'completed') isCompleted = true;
                }

                if (isCompleted) {
                    newOrder.status = 'completed';
                    // Auto-set steps to true
                    newOrder.steps = { processing: true, produced: true, invoiced: true };
                }

                // Insert Order
                db.prepare(`
                    INSERT INTO orders (
                        id, title, order_number, customer_id, customer_name, customer_email, customer_phone, customer_address, customer_contact_person,
                        deadline, status, description, shopware_order_id, created_at, steps
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    newOrder.id, newOrder.title, newOrder.order_number, newOrder.customer_id, newOrder.customer_name, newOrder.customer_email, newOrder.customer_phone, newOrder.customer_address, newOrder.customer_contact_person,
                    newOrder.deadline, newOrder.status, newOrder.description, newOrder.shopware_order_id, new Date(swOrder.orderDate || swOrder.orderTime || new Date()).toISOString(), JSON.stringify(newOrder.steps)
                );

                // Map Items
                const lineItems = version === '5' ? swOrder.details : swOrder.lineItems;
                
                if (lineItems && Array.isArray(lineItems)) {
                    for (const item of lineItems) {
                        const itemId = Math.random().toString(36).substr(2, 9);
                        const itemName = item.label || item.articleName;
                        const itemNumber = item.payload?.productNumber || item.articleNumber || '';
                        const quantity = item.quantity;
                        
                        // 1. Try to find matching Online Product (by shopware ID or number)
                        // Note: swOrder items might have 'articleId' (SW5) or 'productId' (SW6) or 'referencedId'
                        const swProductId = item.productId || item.articleId; 
                        
                        let matchedProduct = null;
                        if (swProductId) {
                            matchedProduct = db.prepare("SELECT * FROM customer_products WHERE customer_id = ? AND (shopware_product_id = ? OR product_number = ?) AND source = 'shopware'").get(customer.id, String(swProductId), itemNumber) as any;
                        } else {
                            matchedProduct = db.prepare("SELECT * FROM customer_products WHERE customer_id = ? AND product_number = ? AND source = 'shopware'").get(customer.id, itemNumber) as any;
                        }

                        // 2. Insert Item (Link supplier if matched)
                        // If order is completed, set item status to completed too?
                        // User said: "benötigt es keine warenbestellung und dtf bestellung mehr"
                        // So if order is completed, items should not be pending.
                        
                        // Fix for "NOT NULL constraint failed: order_items.supplier_id"
                        // Ensure supplier_id is never null. If no product matched, use 'shopware-import' or 'unknown'
                        const supplierId = (matchedProduct && matchedProduct.supplier_id) ? matchedProduct.supplier_id : 'shopware-import';

                        db.prepare(`
                            INSERT INTO order_items (id, order_id, supplier_id, item_name, item_number, quantity, status)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        `).run(itemId, newOrderId, supplierId, itemName, itemNumber, quantity, isCompleted ? 'completed' : 'pending');

                        // 3. Copy Print Files from Matched Product
                        if (matchedProduct) {
                            const productFiles = db.prepare("SELECT * FROM customer_product_files WHERE product_id = ? AND type = 'print'").all(matchedProduct.id) as any[];
                            
                            for (const pFile of productFiles) {
                                // Calculate quantity based on order quantity
                                const fileQty = (pFile.quantity || 1) * quantity;
                                
                                const newFileId = Math.random().toString(36).substr(2, 9);
                                db.prepare(`
                                    INSERT INTO files (id, customer_id, order_id, name, path, type, thumbnail, print_status)
                                    VALUES (?, ?, ?, ?, ?, 'print', ?, ?)
                                `).run(newFileId, customer.id, newOrderId, pFile.file_name, pFile.file_url, pFile.thumbnail_url, isCompleted ? 'completed' : 'pending');
                                
                            }
                        }

                        // Try to find image (Shopware Preview)
                        let fileUrl = null;
                        if (version === '6' && item.cover?.media?.url) {
                            fileUrl = item.cover.media.url;
                        } 
                        // SW5 images are usually in article details, hard to get here without extra fetch per item.
                        // But we might have it if we fetched details.
                        // SW5 detail object has 'articleId'.
                        
                        // If we have a file, add it to files table and link to order
                        if (fileUrl) {
                            const fileId = Math.random().toString(36).substr(2, 9);
                            db.prepare(`
                                INSERT INTO files (id, customer_id, order_id, name, path, type)
                                VALUES (?, ?, ?, ?, ?, 'preview')
                            `).run(fileId, customer.id, newOrderId, `${itemName} - Vorschau`, fileUrl);
                        }
                    }
                    
                    // After processing all items, update the orders.files JSON with all linked files
                    const allLinkedFiles = db.prepare("SELECT * FROM files WHERE order_id = ?").all(newOrderId) as any[];
                    if (allLinkedFiles.length > 0) {
                        const filesJson = allLinkedFiles.map(f => ({
                            name: f.name,
                            url: f.path,
                            type: f.type,
                            thumbnail: f.thumbnail
                        }));
                        db.prepare('UPDATE orders SET files = ? WHERE id = ?').run(JSON.stringify(filesJson), newOrderId);
                    }
                }

                totalSynced++;
                console.log(`Imported Order ${orderNumber}`);
            }

        } catch (err: any) {
            console.error(`Error syncing customer ${customer.name}:`, err);
            errors.push({ customer: customer.name, error: err.message });
        }
    }

    res.json({ success: true, count: totalSynced, errors, debug: debugInfo });
});

// Update Order Status in Shopware
router.post('/update-order-status', async (req: Request, res: Response) => {
    const { orderId, status, shopwareStatus } = req.body;

    try {
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
        if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
        
        if (!order.shopware_order_id) {
             // Just update local status if not shopware
             db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, orderId);
             return res.json({ success: true, message: 'Local status updated' });
        }

        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(order.customer_id) as any;
        if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

        // Update local status first
        db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, orderId);

        // Update Shopware Status if requested
        if (shopwareStatus) {
            const version = customer.shopware_version || '6';
            const baseUrl = customer.shopware_url.replace(/\/$/, '');
            
            if (version === '6') {
                const token = await getShopware6Token(baseUrl, customer.shopware_access_key, customer.shopware_secret_key);
                
                // SW6 Status Transition
                // We need to find the transition action name for the target status.
                // Common transitions: 'process', 'complete', 'cancel'
                // Mapping (simplified):
                // pending -> open
                // processing -> process
                // completed -> complete
                // cancelled -> cancel
                
                let actionName = '';
                switch (shopwareStatus) {
                    case 'open': actionName = 'reopen'; break;
                    case 'in_progress': actionName = 'process'; break;
                    case 'completed': actionName = 'complete'; break;
                    case 'cancelled': actionName = 'cancel'; break;
                }

                if (actionName) {
                     const transitionUrl = `${baseUrl}/api/_action/order_transaction/${order.shopware_order_id}/state/${actionName}`;
                     // Note: In SW6, order state is often on the ORDER, but payment/delivery states are separate.
                     // The order state machine is usually: open -> in_progress -> completed
                     // Endpoint: /api/_action/order/{orderId}/state/{transition}
                     
                     // Let's try order state first
                     const orderStateUrl = `${baseUrl}/api/_action/order/${order.shopware_order_id}/state/${actionName}`;
                     
                     const response = await fetch(orderStateUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({})
                     });
                     
                     if (!response.ok) {
                         const err = await response.text();
                         console.error('Shopware Status Update Failed:', err);
                         // Don't fail the whole request, just warn
                         return res.json({ success: true, message: 'Local updated, Shopware update failed: ' + err });
                     }
                }
            } else {
                // SW5 Status Update
                // PUT /api/orders/{id} with { orderStatusId: X }
                // Status IDs: 0=Open, 1=InProcess, 2=Completed, 3=PartiallyCompleted, 4=Cancelled...
                
                let statusId = -1;
                switch (shopwareStatus) {
                    case 'open': statusId = 0; break;
                    case 'in_progress': statusId = 1; break;
                    case 'completed': statusId = 2; break;
                    case 'cancelled': statusId = 4; break;
                }

                if (statusId !== -1) {
                    const auth = Buffer.from(`${customer.shopware_access_key}:${customer.shopware_secret_key}`).toString('base64');
                    const response = await fetch(`${baseUrl}/api/orders/${order.shopware_order_id}`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Basic ${auth}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ orderStatusId: statusId })
                    });
                    
                     if (!response.ok) {
                         const err = await response.text();
                         return res.json({ success: true, message: 'Local updated, Shopware update failed: ' + err });
                     }
                }
            }
        }

        res.json({ success: true });
    } catch (error: any) {
        console.error('Update status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get products for a customer
router.get('/products/:customerId', async (req: Request, res: Response) => {
    const { customerId } = req.params;
    
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;
    
    if (!customer) {
        return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    if (!customer.shopware_url || !customer.shopware_access_key || !customer.shopware_secret_key) {
        return res.status(400).json({ success: false, error: 'Shopware not configured for this customer' });
    }

    const version = customer.shopware_version || '6';

    try {
        let products = [];
        const baseUrl = customer.shopware_url.replace(/\/$/, '');

        if (version === '5') {
            // Shopware 5 Logic
            const rawProducts = await getShopware5Products(baseUrl, customer.shopware_access_key, customer.shopware_secret_key);
            
            products = rawProducts.map((p: any) => ({
                id: String(p.id),
                name: p.name,
                productNumber: p.mainDetail?.number || p.mainDetail?.ordernumber || '',
                active: p.active,
                stock: p.mainDetail?.inStock,
                imageUrl: p.images?.[0]?.link, // Shopware 5 often provides 'link' or 'path'
                variants: p.details // Usually included if we fetch list, but 'details' might be empty in list view
            }));

            // If we want variants, we need to ensure we have them. 
            // In standard SW5 API list call, 'details' might not be populated with all variants.
            // We need to fetch details or check if 'configuratorSet' exists.
            
            // To get all variants, we often need to fetch article details.
            // Let's expand products array by flattening variants.
            
            // NOTE: Fetching details for ALL products is heavy. 
            // But user asked for it: "kann man da auch alle varianten einzeln abrufen?"
            
            // Let's modify the strategy:
            // 1. We have 'products' which are main articles.
            // 2. We will expand this list.
            
            const expandedProducts = [];
            
            // We need to fetch details for products to get variants
            // We do this in batches.
            const batchSize = 5;
            for (let i = 0; i < products.length; i += batchSize) {
                const batch = products.slice(i, i + batchSize);
                await Promise.all(batch.map(async (p: any) => {
                    // Fetch full details including variants
                    const details = await getShopware5ArticleDetails(baseUrl, customer.shopware_access_key, customer.shopware_secret_key, p.id);
                    
                    if (details) {
                         // Add Main Detail (already in p but let's refresh)
                         // Actually, details.mainDetail is the main variant.
                         // details.details contains OTHER variants.
                         
                         // Main Variant
                         const mainName = details.name;
                         const mainVariantName = details.mainDetail?.additionaltext ? `${mainName} - ${details.mainDetail.additionaltext}` : mainName;
                         
                         // Resolve Image for Main
                         let mainImage = p.imageUrl;
                         if (!mainImage && details.images && details.images.length > 0) {
                             const img = details.images.find((img: any) => img.main === 1) || details.images[0];
                             if (img.link) mainImage = img.link;
                             else if (img.path) {
                                 const ext = img.extension || 'jpg';
                                 const cleanBaseUrl = baseUrl.replace(/\/$/, '');
                                 mainImage = `${cleanBaseUrl}/media/image/${img.path}.${ext}`;
                             }
                         }

                         expandedProducts.push({
                             id: `${p.id}_main`, // Unique ID for our DB
                             shopware_product_id: String(p.id), // Parent ID
                             name: mainVariantName,
                             productNumber: details.mainDetail?.number,
                             active: details.active,
                             stock: details.mainDetail?.inStock,
                             imageUrl: mainImage
                         });
                         
                         // Other Variants
                         if (details.details && Array.isArray(details.details)) {
                             for (const v of details.details) {
                                 // Construct Variant Name & Attributes
                                 let variantSuffix = v.additionaltext;
                                 let size = null;
                                 let color = null;
                                 
                                 if (v.configuratorOptions && Array.isArray(v.configuratorOptions)) {
                                     // Parse options for size/color
                                     for (const opt of v.configuratorOptions) {
                                         const groupName = opt.group?.name || opt.groupName || '';
                                         const optName = opt.name || opt.option || '';
                                         
                                         if (groupName.toLowerCase().includes('größe') || groupName.toLowerCase().includes('size')) {
                                             size = optName;
                                         } else if (groupName.toLowerCase().includes('farbe') || groupName.toLowerCase().includes('color')) {
                                             color = optName;
                                         }
                                     }
                                     
                                     // If additionaltext is missing, build suffix from options
                                     if (!variantSuffix) {
                                         variantSuffix = v.configuratorOptions.map((opt: any) => opt.name || opt.option).join(' / ');
                                     }
                                 }
                                 
                                 const vName = variantSuffix ? `${mainName} - ${variantSuffix}` : `${mainName} (Var ${v.number})`;

                                 expandedProducts.push({
                                     id: `${p.id}_${v.id}`,
                                     shopware_product_id: String(p.id),
                                     name: vName,
                                     productNumber: v.number,
                                     active: v.active,
                                     stock: v.inStock,
                                     imageUrl: mainImage,
                                     size: size,
                                     color: color
                                 });
                             }
                         }
                    } else {
                        // Fallback if detail fetch fails
                        expandedProducts.push({
                            id: String(p.id),
                            shopware_product_id: String(p.id),
                            name: p.name,
                            productNumber: p.productNumber,
                            active: p.active,
                            stock: p.stock,
                            imageUrl: p.imageUrl,
                            size: null,
                            color: null
                        });
                    }
                }));
            }
            
            products = expandedProducts;
            
        } else {
            // Shopware 6 Logic
            const token = await getShopware6Token(baseUrl, customer.shopware_access_key, customer.shopware_secret_key);
            
            // SW6: fetch products with children association to get variants
            const response = await fetch(`${baseUrl}/api/product?limit=100&associations[cover][]&associations[children][associations][options][associations][group][]`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch products: ${response.statusText}`);
            }

            const data = await response.json();
            
            products = [];
            
            // Iterate SW6 products
            for (const p of data.data) {
                // Main product (parent)
                // If it has children, we might want to list children instead?
                // Or list parent + children.
                
                // For now, let's just map the main ones, but check if we can extract options if it is a variant itself (parentId != null)
                // SW6 often returns parents and children in the same list if not filtered.
                
                // Let's extract options if available
                let size = null;
                let color = null;
                
                if (p.options && Array.isArray(p.options)) {
                    for (const opt of p.options) {
                        const groupName = opt.group?.name || '';
                        if (groupName.toLowerCase().includes('größe') || groupName.toLowerCase().includes('size')) {
                            size = opt.name;
                        } else if (groupName.toLowerCase().includes('farbe') || groupName.toLowerCase().includes('color')) {
                            color = opt.name;
                        }
                    }
                }

                products.push({
                    id: p.id,
                    name: p.name,
                    productNumber: p.productNumber,
                    active: p.active,
                    stock: p.stock,
                    imageUrl: p.cover?.media?.url,
                    size,
                    color
                });
            }
        }

        // Sync with local DB (upsert)
        const existingProducts = db.prepare("SELECT id, shopware_product_id FROM customer_products WHERE customer_id = ? AND source = 'shopware'").all(customerId) as any[];
        
        const upsertTransaction = db.transaction((productsToSync: any[]) => {
            for (const p of productsToSync) {
                const existing = existingProducts.find(ep => ep.shopware_product_id === p.id);
                
                if (existing) {
                    // Update existing product with new details (size/color) if missing?
                    // User said "not overwrite", but we just added new columns.
                    // Maybe we should update ONLY the new columns if they are null?
                    // For now, respect "don't overwrite" rule for existing rows to avoid losing manual edits?
                    // Actually, let's update size/color if they are present in new data, as these are new fields.
                    if (p.size || p.color) {
                         db.prepare("UPDATE customer_products SET size = ?, color = ? WHERE id = ?")
                           .run(p.size, p.color, existing.id);
                    }
                    
                    // DO NOT overwrite files. 
                    // If we wanted to update the image, we would check if a 'view' type file exists and update it, 
                    // but we must NEVER touch 'print' files that the user manually uploaded.
                    
                    // Only add the Shopware image if NO view image exists at all?
                    // Or add it as a new view if it's different?
                    // For now, user request is "not overwrite print data".
                    // The code below (in the else block) only runs for NEW products.
                    // So for existing products, we do nothing with files here, which is correct.
                    
                    continue;
                } else {
                    const newId = Math.random().toString(36).substr(2, 9);
                    db.prepare("INSERT INTO customer_products (id, customer_id, name, product_number, source, shopware_product_id, size, color) VALUES (?, ?, ?, ?, 'shopware', ?, ?, ?)")
                      .run(newId, customerId, p.name, p.productNumber, p.id, p.size, p.color);

                    if (p.imageUrl) {
                        const fileId = Math.random().toString(36).substr(2, 9);
                        db.prepare("INSERT INTO customer_product_files (id, product_id, file_url, file_name, thumbnail_url, type) VALUES (?, ?, ?, ?, ?, 'view')")
                          .run(fileId, newId, p.imageUrl, 'Shopware Bild', p.imageUrl);
                    }
                }
            }
        });

        upsertTransaction(products);

        res.json({ success: true, data: products });

    } catch (error: any) {
        console.error('Shopware Product Fetch Error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to fetch products' });
    }
});

export default router;
