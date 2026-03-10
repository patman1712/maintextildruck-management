
import { Router } from 'express';
import db, { DATA_DIR } from '../db.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs-extra';
import { generateInvoice } from '../services/invoice.js';
import { sendOrderConfirmation } from '../services/email.js';

const router = Router();

// Helper to clean names (remove trailing '0' bug)
const cleanName = (name: string | null | undefined) => {
    if (!name) return '';
    let cleaned = name.trim();
    if (cleaned.endsWith('0')) {
        cleaned = cleaned.slice(0, -1);
    }
    return cleaned;
};

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
    const existing = db.prepare('SELECT id, customer_number FROM shop_customers WHERE shop_id = ? AND email = ?').get(shopId, email) as any;
    if (existing) {
      return res.status(400).json({ success: false, error: 'Ein Konto mit dieser E-Mail existiert bereits in diesem Shop.' });
    }

    const id = crypto.randomUUID();
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Generate Customer Number
    let nextNr = 10000;
    const shop = db.prepare('SELECT next_customer_number FROM shops WHERE id = ?').get(shopId) as { next_customer_number?: number };
    if (shop && shop.next_customer_number) {
        nextNr = shop.next_customer_number;
    }
    const customerNumber = `KD-${nextNr}`;

    // Fix: Ensure last_name does not have a trailing '0' appended by accident if frontend sends it?
    // User reported "Pat Sch0" or "Patrick Scheiber0".
    // This implies something is appending '0' to the name.
    // Check if data_privacy_accepted logic was somehow concatenating '0' string instead of int?
    // In previous versions: data_privacy_accepted ? 1 : 0.
    // Wait, in line 76: last_name is passed directly.
    // Let's check where the user input comes from.
    // If user input is clean, maybe the DB insert is weird?
    // Or maybe the display logic?
    // Let's sanitize input just in case.
    const cleanLastName = cleanName(last_name);
    const cleanFirstName = cleanName(first_name);

    // Transaction for atomic update
    const transaction = db.transaction(() => {
        db.prepare(`
          INSERT INTO shop_customers (
            id, shop_id, email, password, first_name, last_name, 
            company, street, zip, city, phone, data_privacy_accepted, customer_number
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, shopId, email, hashedPassword, cleanFirstName, cleanLastName, 
          company, street, zip, city, phone, data_privacy_accepted ? 1 : 0, customerNumber
        );
        
        // Increment shop next number
        db.prepare('UPDATE shops SET next_customer_number = ? WHERE id = ?').run(nextNr + 1, shopId);
    });

    transaction();

    console.log(`[Register] Creating customer: ${email} (${customerNumber}) for shop: ${shopId}`);

    const customer = db.prepare('SELECT id, shop_id, email, first_name, last_name, company, street, zip, city, phone, customer_number FROM shop_customers WHERE id = ?').get(id);
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

    if (customer.is_blocked) {
      console.warn(`[Login] Blocked customer attempted login: ${email}`);
      return res.status(403).json({ success: false, error: 'Ihr Konto wurde gesperrt. Bitte kontaktieren Sie den Shop-Betreiber.' });
    }

    const match = bcrypt.compareSync(password, customer.password);
    if (!match) {
      console.warn(`[Login] Password mismatch: ${email}`);
      // Debug: Check if maybe plain text (legacy)
      if (password === customer.password) {
          console.warn('[Login] Plain text password match (LEGACY). Migrating to hash...');
          const newHash = bcrypt.hashSync(password, 10);
          db.prepare('UPDATE shop_customers SET password = ? WHERE id = ?').run(newHash, customer.id);
          // Allow login this time
      } else {
          return res.status(401).json({ success: false, error: 'Ungültige E-Mail oder Passwort.' });
      }
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

    const customers = db.prepare('SELECT id, email, first_name, last_name, company, street, zip, city, phone, created_at, customer_number, is_blocked FROM shop_customers WHERE shop_id = ? ORDER BY created_at DESC').all(shopId) as any[];
    
    // Clean data before sending
    const cleanedCustomers = customers.map(c => ({
        ...c,
        first_name: cleanName(c.first_name),
        last_name: cleanName(c.last_name)
    }));

    res.json({ success: true, data: cleanedCustomers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Toggle block status for a customer
router.put('/:shopId/admin/customers/:customerId/block', (req, res) => {
  try {
    const { customerId } = req.params;
    const { is_blocked } = req.body;

    if (typeof is_blocked !== 'boolean') {
        return res.status(400).json({ success: false, error: 'is_blocked muss ein Boolean sein.' });
    }

    db.prepare('UPDATE shop_customers SET is_blocked = ? WHERE id = ?').run(is_blocked ? 1 : 0, customerId);
    
    // Also invalidate any active sessions if possible (not implemented here as JWT/Session is stateless or handled elsewhere)
    // But login check will prevent new logins.

    res.json({ success: true });
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

    const cleanFirstName = cleanName(first_name);
    const cleanLastName = cleanName(last_name);

    // Update basic info
    let query = `
      UPDATE shop_customers 
      SET email = ?, first_name = ?, last_name = ?, company = ?, 
          street = ?, zip = ?, city = ?, phone = ?
    `;
    const params = [email, cleanFirstName, cleanLastName, company, street, zip, city, phone];

    // Update password if provided
    if (password && password.trim() !== '') {
      const hashedPassword = bcrypt.hashSync(password, 10);
      query += `, password = ?`;
      params.push(hashedPassword);
    }

    query += ` WHERE id = ?`;
    params.push(customerId);

    db.prepare(query).run(...params);

    const updated = db.prepare('SELECT id, shop_id, email, first_name, last_name, company, street, zip, city, phone, customer_number FROM shop_customers WHERE id = ?').get(customerId);
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

// Admin: Download Invoice PDF
router.get('/:shopId/admin/orders/:orderId/invoice', async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = db.prepare('SELECT invoice_path, invoice_number FROM orders WHERE id = ?').get(orderId) as any;
    
    if (!order || !order.invoice_path) {
        // Try to generate it if missing?
        // For now, return 404
        return res.status(404).json({ success: false, error: 'Rechnung nicht gefunden.' });
    }

    const filePath = path.join(DATA_DIR, 'invoices', order.invoice_path);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'Rechnungsdatei nicht gefunden.' });
    }

    res.download(filePath, `Rechnung_${order.invoice_number || orderId}.pdf`);
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

    // Get Shop Owner (Customer ID) and number circle config
    const shop = db.prepare('SELECT customer_id, order_number_circle, next_order_number FROM shops WHERE id = ?').get(shopId) as { customer_id: string, order_number_circle?: string, next_order_number?: number };
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
    
    // Generate Order Number
    let orderNumber = `${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    let nextNr = 1;

    // Use custom number circle if defined
    if (shop.order_number_circle) {
        nextNr = shop.next_order_number || 1;
        // Simple replacements
        orderNumber = shop.order_number_circle
            .replace('{YEAR}', new Date().getFullYear().toString())
            .replace('{NR}', nextNr.toString());
    }

    // Start transaction
    const transaction = db.transaction(() => {
      // Update next number if custom circle used
      if (shop.order_number_circle) {
          db.prepare('UPDATE shops SET next_order_number = ? WHERE id = ?').run(nextNr + 1, shopId);
      }

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
            id, order_id, customer_id, name, path, type, status, print_status, quantity, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // 2. Create Order Items and Collect Files
      // We aggregate files globally for the entire order to prevent duplicate entries for same file
      const orderAggregatedFiles = new Map<string, { file: any, quantity: number, type: string }>();

      for (const item of items) {
        let supplierId = 'manual';
        if (item.productId) {
            // ... (supplier logic unchanged)
            // 1. Check Shop Assignment first (overrides base product)
            const assignment = db.prepare('SELECT supplier_id FROM shop_product_assignments WHERE shop_id = ? AND product_id = ?').get(shopId, item.productId) as { supplier_id: string };
            
            if (assignment && assignment.supplier_id) {
                supplierId = assignment.supplier_id;
            } else {
                // 2. Fallback to Base Product
                const product = db.prepare('SELECT supplier_id FROM customer_products WHERE id = ?').get(item.productId) as { supplier_id: string };
                if (product && product.supplier_id) {
                    supplierId = product.supplier_id;
                }
            }
        }

        insertItem.run(
          crypto.randomUUID(),
          orderId,
          supplierId,
          item.name,
          item.quantity,
          item.price,
          item.color || null,
          item.size || null,
          item.personalization || null,
          item.productNumber || null
        );
        
        // 2.1 Copy files from Product to Order (Preview & Print Data)
        if (item.productId) {
            const assignment = db.prepare('SELECT id, variants FROM shop_product_assignments WHERE shop_id = ? AND product_id = ?').get(shopId, item.productId) as any;
            
            let filesToProcess: any[] = [];
            let useAssignments = false;

            if (assignment) {
                // Check if shop has specific images assigned - INCLUDE size_restrictions
                const assignedImages = db.prepare(`
                    SELECT cpf.*, spi.variant_ids, spi.size_restrictions
                    FROM shop_product_images spi
                    JOIN customer_product_files cpf ON spi.customer_product_file_id = cpf.id
                    WHERE spi.shop_product_assignment_id = ?
                `).all(assignment.id) as any[];

                if (assignedImages.length > 0) {
                    filesToProcess = assignedImages;
                    useAssignments = true;
                } else {
                    filesToProcess = db.prepare(`
                        SELECT * FROM customer_product_files WHERE product_id = ?
                    `).all(item.productId) as any[];
                }
            } else {
                filesToProcess = db.prepare(`
                    SELECT * FROM customer_product_files WHERE product_id = ?
                `).all(item.productId) as any[];
            }
            
            // Determine active variant ID
            let activeVariantIds: string[] = [];
            if (assignment && assignment.variants && item.color) {
                try {
                    const variants = JSON.parse(assignment.variants);
                    for (const [varId, varData] of Object.entries(variants) as any) {
                        if (varData.name === item.color) {
                            activeVariantIds.push(varId);
                        }
                    }
                } catch (e) {
                    console.error('Error parsing variants:', e);
                }
            }

            // 2.1.1 Print & Vector Data
            for (const file of filesToProcess) {
                if (['print', 'vector', 'photoshop'].includes(file.type)) {
                     let isIncluded = true;

                     // Check filtering if using assigned images
                     if (useAssignments && file.variant_ids) {
                         try {
                             const allowedVariants = JSON.parse(file.variant_ids);
                             if (allowedVariants.length > 0) {
                                 const match = activeVariantIds.some(id => allowedVariants.includes(id));
                                 if (!match) isIncluded = false;
                             }
                         } catch (e) {}
                     }

                     // Check Size Restrictions - STRICT MODE
                     if (isIncluded && useAssignments && file.size_restrictions) {
                         try {
                             const allowedSizes = JSON.parse(file.size_restrictions);
                             if (allowedSizes.length > 0) {
                                 if (item.size) {
                                     const itemSize = String(item.size).trim();
                                     const match = allowedSizes.some((s: string) => s.trim() === itemSize);
                                     if (!match) isIncluded = false;
                                 } else {
                                     isIncluded = false;
                                 }
                             }
                         } catch (e) {}
                     }

                     if (isIncluded) {
                         const existing = orderAggregatedFiles.get(file.file_url);
                         const qtyToAdd = (item.quantity || 1) * (file.quantity || 1); // Account for multiple prints per item if configured
                         
                         if (existing) {
                             existing.quantity += qtyToAdd;
                         } else {
                             orderAggregatedFiles.set(file.file_url, { 
                                 file: file, 
                                 quantity: qtyToAdd,
                                 type: file.type
                             });
                         }
                     }
                 }
            }

            // 2.1.2 Preview Image
            if (item.image) {
                const selectedPreview = filesToProcess.find(f => f.file_url === item.image);
                const previewUrl = selectedPreview ? selectedPreview.file_url : item.image;
                const previewName = selectedPreview ? (selectedPreview.file_name || 'Vorschau') : 'Vorschau';
                
                // Aggregate previews too to avoid duplicates
                const existing = orderAggregatedFiles.get(previewUrl);
                if (!existing) {
                    orderAggregatedFiles.set(previewUrl, {
                        file: { file_name: previewName, file_url: previewUrl, type: 'preview' },
                        quantity: 1, // Preview usually 1 per unique design
                        type: 'preview'
                    });
                }
            } else {
                // Legacy Fallback
                for (const file of filesToProcess) {
                    if (file.type === 'preview' || file.type === 'view') {
                         const existing = orderAggregatedFiles.get(file.file_url);
                         if (!existing) {
                             orderAggregatedFiles.set(file.file_url, {
                                 file: file,
                                 quantity: 1,
                                 type: 'preview'
                             });
                         }
                    }
                }
            }
        }
      } // End item loop

      // Insert all aggregated files
      for (const { file, quantity, type } of orderAggregatedFiles.values()) {
           insertFile.run(
              crypto.randomUUID(),
              orderId,
              shop.customer_id,
              file.file_name || 'Datei',
              file.file_url,
              type,
               'active',
               'pending',
               quantity,
               new Date().toISOString()
            );
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

    // Post-order processing: Generate Invoice & Send Email
    // We do this AFTER transaction commits to ensure data is available
    try {
        const invoicePath = await generateInvoice(orderId);
        if (invoicePath) {
            console.log(`[Order] Invoice generated: ${invoicePath}`);
            await sendOrderConfirmation(orderId, invoicePath);
        } else {
            console.error('[Order] Failed to generate invoice');
        }
    } catch (e) {
        console.error('[Order] Error in post-processing:', e);
    }

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

// Admin: Delete an order
router.delete('/:shopId/admin/orders/:orderId', (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Delete order items first
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId);
    
    // Delete associated files
    db.prepare('DELETE FROM files WHERE order_id = ?').run(orderId);
    
    // Delete the order itself
    db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
    
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
