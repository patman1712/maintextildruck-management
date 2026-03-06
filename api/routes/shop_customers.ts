
import { Router } from 'express';
import db from '../db.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const router = Router();

// Helper to resolve shopId from either ID or Slug
const resolveShopId = (idOrSlug: string): string | null => {
    // Try finding by ID first
    let shop = db.prepare('SELECT id FROM shops WHERE id = ?').get(idOrSlug) as { id: string } | undefined;
    if (shop) return shop.id;

    // Try finding by Slug
    shop = db.prepare('SELECT id FROM shops WHERE domain_slug = ?').get(idOrSlug) as { id: string } | undefined;
    if (shop) return shop.id;

    return null;
};

// Register a new customer for a shop
router.post('/:shopId/register', async (req, res) => {
  try {
    const { shopId: rawShopId } = req.params;
    const shopId = resolveShopId(rawShopId);
    
    console.log(`[Register] Resolving ShopID: ${rawShopId} -> ${shopId}`);

    if (!shopId) {
        console.error(`[Register] Shop not found for: ${rawShopId}`);
        return res.status(404).json({ success: false, error: 'Shop nicht gefunden.' });
    }

    const { 
      email: rawEmail, password, first_name, last_name, 
      company, street, zip, city, phone, 
      data_privacy_accepted 
    } = req.body;

    const email = rawEmail?.toLowerCase().trim();

    if (!email || !password || !data_privacy_accepted) {
      return res.status(400).json({ success: false, error: 'E-Mail, Passwort und Datenschutz-Zustimmung sind erforderlich.' });
    }

    // Check if customer already exists for this shop
    const existing = db.prepare('SELECT id FROM shop_customers WHERE shop_id = ? AND email = ?').get(shopId, email);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Ein Konto mit dieser E-Mail existiert bereits in diesem Shop.' });
    }

    const id = crypto.randomUUID();
    const hashedPassword = bcrypt.hashSync(password, 10);

    console.log(`[Register] Creating customer: ${email} for shop: ${shopId}`);

    db.prepare(`
      INSERT INTO shop_customers (
        id, shop_id, email, password, first_name, last_name, 
        company, street, zip, city, phone, data_privacy_accepted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, shopId, email, hashedPassword, first_name, last_name, 
      company, street, zip, city, phone, data_privacy_accepted ? 1 : 0
    );

    const customer = db.prepare('SELECT id, shop_id, email, first_name, last_name, company, street, zip, city, phone FROM shop_customers WHERE id = ?').get(id);
    res.json({ success: true, data: customer });
  } catch (error: any) {
    console.error(`[Register] Error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Login for a shop customer
router.post('/:shopId/login', async (req, res) => {
  try {
    const { shopId: rawShopId } = req.params;
    const shopId = resolveShopId(rawShopId);

    console.log(`[Login] Resolving ShopID: ${rawShopId} -> ${shopId}`);

    if (!shopId) {
        console.error(`[Login] Shop not found for: ${rawShopId}`);
        return res.status(404).json({ success: false, error: 'Shop nicht gefunden.' });
    }

    const { email: rawEmail, password } = req.body;
    const email = rawEmail?.toLowerCase().trim();

    console.log(`[Login] Attempt for email: ${email} in shop: ${shopId}`);

    const customer = db.prepare('SELECT * FROM shop_customers WHERE shop_id = ? AND email = ?').get(shopId, email) as any;
    
    if (!customer) {
      console.warn(`[Login] Customer not found: ${email}`);
      return res.status(401).json({ success: false, error: 'Ungültige E-Mail oder Passwort.' });
    }

    if (!bcrypt.compareSync(password, customer.password)) {
      console.warn(`[Login] Password mismatch: ${email}`);
      return res.status(401).json({ success: false, error: 'Ungültige E-Mail oder Passwort.' });
    }

    console.log(`[Login] Success: ${email}`);
    const { password: _, ...customerInfo } = customer;
    res.json({ success: true, data: customerInfo });
  } catch (error: any) {
    console.error(`[Login] Error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get all customers for a specific shop
router.get('/:shopId/admin/list', (req, res) => {
  try {
    const { shopId: rawShopId } = req.params;
    const shopId = resolveShopId(rawShopId);

    if (!shopId) {
        return res.status(404).json({ success: false, error: 'Shop nicht gefunden.' });
    }

    const customers = db.prepare('SELECT id, email, first_name, last_name, company, street, zip, city, phone, created_at FROM shop_customers WHERE shop_id = ? ORDER BY created_at DESC').all(shopId);
    res.json({ success: true, data: customers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update shop customer profile
router.put('/:shopId/profile/:customerId', async (req, res) => {
  try {
    const { shopId: rawShopId, customerId } = req.params;
    const shopId = resolveShopId(rawShopId);

    if (!shopId) {
        return res.status(404).json({ success: false, error: 'Shop nicht gefunden.' });
    }

    // Check if customer exists
    const existing = db.prepare('SELECT id FROM shop_customers WHERE id = ?').get(customerId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Kunde nicht gefunden.' });
    }

    const { 
      email, first_name, last_name, 
      company, street, zip, city, phone,
      password 
    } = req.body;

    // Update basic info
    let query = `
      UPDATE shop_customers 
      SET email = ?, first_name = ?, last_name = ?, company = ?, 
          street = ?, zip = ?, city = ?, phone = ?
    `;
    const params = [email, first_name, last_name, company, street, zip, city, phone];

    // Update password if provided
    if (password && password.trim() !== '') {
      const hashedPassword = bcrypt.hashSync(password, 10);
      query += `, password = ?`;
      params.push(hashedPassword);
    }

    query += ` WHERE id = ?`;
    params.push(customerId);

    db.prepare(query).run(...params);

    const updated = db.prepare('SELECT id, shop_id, email, first_name, last_name, company, street, zip, city, phone FROM shop_customers WHERE id = ?').get(customerId);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get orders for a shop customer
router.get('/:shopId/orders/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const orders = db.prepare('SELECT * FROM orders WHERE shop_customer_id = ? ORDER BY created_at DESC').all(customerId);
    res.json({ success: true, data: orders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get order details for a shop customer
router.get('/:shopId/orders/:customerId/:orderId', async (req, res) => {
  try {
    const { orderId, customerId } = req.params;
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND shop_customer_id = ?').get(orderId, customerId);
    if (!order) return res.status(404).json({ success: false, error: 'Bestellung nicht gefunden.' });

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    res.json({ success: true, data: { ...(order as any), items } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Place a new order from a shop
router.post('/:shopId/orders', async (req, res) => {
  try {
    const { shopId: rawShopId } = req.params;
    const shopId = resolveShopId(rawShopId);
    
    console.log(`[Order] Placing order for Shop: ${rawShopId} -> ${shopId}`);

    if (!shopId) return res.status(404).json({ success: false, error: 'Shop nicht gefunden.' });

    // Get Shop Owner (Customer ID)
    const shop = db.prepare('SELECT customer_id FROM shops WHERE id = ?').get(shopId) as { customer_id: string };
    if (!shop) return res.status(404).json({ success: false, error: 'Shop-Besitzer nicht gefunden.' });

    const { 
      customerId, 
      items, 
      address, 
      paymentMethod,
      paymentStatus,
      transactionId,
      totalAmount,
      shippingCosts
    } = req.body;

    console.log(`[Order] Data: Customer=${customerId}, Items=${items?.length}, Total=${totalAmount}`);

    if (!address || !address.firstName || !address.lastName) {
        return res.status(400).json({ success: false, error: 'Bitte füllen Sie alle Pflichtfelder der Adresse aus.' });
    }

    const orderId = crypto.randomUUID();
    const orderNumber = `${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Start transaction
    const transaction = db.transaction(() => {
      // 1. Create Order
      // Logic: If paymentStatus is 'paid', status is 'active'. If 'open', status is 'on_hold' (or similar).
      // But user said: "Aufträge sollen erst dort unter aktuelle aufträge erscheinen wenn der status komplett bezahlt vergeben wurde!"
      // So if not paid, we might want to use a status that is filtered out by default in the main list.
      // 'active' orders ARE shown in the main list.
      // So let's use 'pending_payment' for open orders?
      // Or just keep 'active' but filter in frontend?
      // User says: "aufträge sollen erst dort unter aktuelle aufträge erscheinen wenn der status komplett bezahlt vergeben wurde"
      // This implies we should set status to 'pending_payment' if not paid.
      
      const isPaid = paymentStatus === 'paid';
      const initialStatus = isPaid ? 'active' : 'pending_payment';

      db.prepare(`
        INSERT INTO orders (
          id, title, shop_id, shop_customer_id, customer_id,
          customer_name, customer_email, customer_phone, customer_address,
          order_number, total_amount, shipping_costs, payment_method,
          payment_status, transaction_id,
          status, deadline
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderId,
        `Shop Bestellung ${orderNumber}`,
        shopId,
        customerId || null,
        shop.customer_id,
        `${address.firstName} ${address.lastName}`,
        address.email || '',
        address.phone || '',
        `${address.street}, ${address.zip} ${address.city}`,
        orderNumber,
        totalAmount,
        shippingCosts,
        paymentMethod,
        paymentStatus || 'open', // Default to 'open' instead of 'pending'
        transactionId || null,
        initialStatus,
        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // Default 14 days
      );

      // 2. Create Order Items
      const insertItem = db.prepare(`
        INSERT INTO order_items (
          id, order_id, supplier_id, item_name, quantity, price, color, size, notes, item_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const insertFile = db.prepare(`
        INSERT INTO files (
            id, order_id, customer_id, name, path, type, status, quantity, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        insertItem.run(
          crypto.randomUUID(),
          orderId,
          'manual', // Default or find supplier
          item.name,
          item.quantity,
          item.price,
          item.color || null,
          item.size || null,
          item.personalization || null,
          item.productNumber || null
        );
        
        // 2.1 Copy files from Product to Order (Preview & Print Data)
        // Find the original product to get its files
        if (item.productId) {
            // Get all files for this product
            const productFiles = db.prepare(`
                SELECT * FROM customer_product_files WHERE product_id = ?
            `).all(item.productId) as any[];
            
            // 2.1.1 Print & Vector Data (Always copy all)
            for (const file of productFiles) {
                if (['print', 'vector', 'photoshop'].includes(file.type)) {
                     // Calculate total quantity needed for this file based on order item quantity
                     // Default file quantity is 1 (per product). So if customer buys 9 products, we need 9 prints.
                     // If file itself has a quantity (e.g. front and back print needed per shirt?), we should multiply.
                     // Assuming customer_product_files doesn't have a quantity field yet, or if it does, use it.
                     // Currently customer_product_files schema: id, product_id, file_name, file_url, type, created_at...
                     // Wait, shopware.ts line 923 suggests: const fileQty = (pFile.quantity || 1) * quantity;
                     
                     // Let's check if customer_product_files has quantity. 
                     // Looking at db.ts schema for customer_product_files... it does NOT seem to have quantity.
                     // But let's assume 1 per product for now.
                     
                     const fileQuantity = item.quantity; 

                     insertFile.run(
                        crypto.randomUUID(),
                        orderId,
                        shop.customer_id, // Owner
                        file.file_name,
                        file.file_url,
                        file.type,
                         'active',
                         fileQuantity,
                         new Date().toISOString()
                      );
                 }
            }

            // 2.1.2 Preview Image (Specific one selected by user)
            // If item.image is provided, it's the URL of the selected preview image
            if (item.image) {
                const selectedPreview = productFiles.find(f => f.file_url === item.image);
                if (selectedPreview) {
                    insertFile.run(
                        crypto.randomUUID(),
                        orderId,
                        shop.customer_id,
                        selectedPreview.file_name || 'Vorschau',
                        selectedPreview.file_url,
                        'preview',
                        'active',
                        1, // Preview always quantity 1
                        new Date().toISOString()
                    );
                } else {
                    // Fallback: If selected URL not found in product files, still add it as a preview
                    insertFile.run(
                        crypto.randomUUID(),
                        orderId,
                        shop.customer_id,
                        'Vorschau',
                        item.image,
                        'preview',
                        'active',
                        1,
                        new Date().toISOString()
                    );
                }
            } else {
                // Legacy Fallback: Add all previews if none specific selected
                for (const file of productFiles) {
                    if (file.type === 'preview' || file.type === 'view') {
                         insertFile.run(
                            crypto.randomUUID(),
                            orderId,
                            shop.customer_id,
                            file.file_name,
                            file.file_url,
                            'preview',
                            'active',
                            1,
                            new Date().toISOString()
                         );
                    }
                }
            }
        }
      }
      
      // Update orders.files JSON cache
      const allLinkedFiles = db.prepare("SELECT * FROM files WHERE order_id = ?").all(orderId) as any[];
      if (allLinkedFiles.length > 0) {
          const filesJson = allLinkedFiles.map(f => ({
              name: f.name,
              url: f.path,
              type: f.type,
              quantity: f.quantity // Include quantity
          }));
          db.prepare('UPDATE orders SET files = ? WHERE id = ?').run(JSON.stringify(filesJson), orderId);
      }
    });

    transaction();

    res.json({ success: true, data: { id: orderId, orderNumber } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get all orders for a specific shop
router.get('/:shopId/admin/orders', (req, res) => {
  try {
    const { shopId: rawShopId } = req.params;
    const shopId = resolveShopId(rawShopId);

    if (!shopId) {
        return res.status(404).json({ success: false, error: 'Shop nicht gefunden.' });
    }

    const orders = db.prepare('SELECT * FROM orders WHERE shop_id = ? ORDER BY created_at DESC').all(shopId);
    res.json({ success: true, data: orders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Update order status
router.put('/:shopId/admin/orders/:orderId/status', (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, payment_status } = req.body;

    if (!status && !payment_status) {
        return res.status(400).json({ success: false, error: 'Status oder Zahlstatus ist erforderlich.' });
    }

    if (status) {
        db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, orderId);
    }

    if (payment_status) {
        db.prepare('UPDATE orders SET payment_status = ? WHERE id = ?').run(payment_status, orderId);

        // Auto-activate order if paid
        if (payment_status === 'paid' || payment_status === 'completed') {
             const currentStatus = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId) as { status: string };
             if (currentStatus && currentStatus.status === 'pending_payment') {
                 db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('active', orderId);
             }
        }
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Delete a customer
router.delete('/:shopId/admin/:customerId', (req, res) => {
  try {
    const { customerId } = req.params;
    db.prepare('DELETE FROM shop_customers WHERE id = ?').run(customerId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
