
import { Router } from 'express';
import db from '../db.js';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { DATA_DIR } from '../db.js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const router = Router();

// Ensure labels directory exists
const LABELS_DIR = path.join(DATA_DIR, 'shipping_labels');
fs.ensureDirSync(LABELS_DIR);

// --- Shop Categories ---

router.get('/:shopId/categories', (req, res) => {
  try {
    const { shopId } = req.params;
    const categories = db.prepare('SELECT * FROM shop_categories WHERE shop_id = ? ORDER BY sort_order ASC').all(shopId);
    res.json({ success: true, data: categories });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:shopId/categories', (req, res) => {
  try {
    const { shopId } = req.params;
    const { name, slug, description, image_url, sort_order, parent_id } = req.body;
    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO shop_categories (id, shop_id, name, slug, description, image_url, sort_order, parent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, shopId, name, slug, description, image_url, sort_order || 0, parent_id || null);

    const category = db.prepare('SELECT * FROM shop_categories WHERE id = ?').get(id);
    res.json({ success: true, data: category });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:shopId/categories/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, image_url, sort_order, parent_id } = req.body;

    db.prepare(`
      UPDATE shop_categories 
      SET name = ?, slug = ?, description = ?, image_url = ?, sort_order = ?, parent_id = ?
      WHERE id = ?
    `).run(name, slug, description, image_url, sort_order, parent_id || null, id);

    const category = db.prepare('SELECT * FROM shop_categories WHERE id = ?').get(id);
    res.json({ success: true, data: category });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:shopId/categories/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM shop_categories WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Shop Products ---

router.get('/:shopId/products', (req, res) => {
  try {
    const { shopId } = req.params;
    const products = db.prepare(`
      SELECT spa.*, cp.name as product_name, cp.product_number, cp.manufacturer_info, cp.description, cp.size, cp.color, sc.name as category_name
      FROM shop_product_assignments spa
      JOIN customer_products cp ON spa.product_id = cp.id
      LEFT JOIN shop_categories sc ON spa.category_id = sc.id
      WHERE spa.shop_id = ?
      ORDER BY spa.sort_order ASC
    `).all(shopId) as any[];

    // Fetch files for each product. 
    // Logic: If there are entries in shop_product_images, use ONLY those.
    // If NO entries in shop_product_images, fallback to ALL customer_product_files (legacy behavior).
    const productsWithFiles = products.map(p => {
        const assignedImages = db.prepare(`
            SELECT cpf.* 
            FROM shop_product_images spi
            JOIN customer_product_files cpf ON spi.customer_product_file_id = cpf.id
            WHERE spi.shop_product_assignment_id = ?
            ORDER BY spi.sort_order ASC, spi.created_at ASC
        `).all(p.id) as any[];

        let files = [];
        if (assignedImages.length > 0) {
            files = assignedImages;
        } else {
            // Fallback: Get all files from the base product
            files = db.prepare('SELECT * FROM customer_product_files WHERE product_id = ? ORDER BY created_at DESC').all(p.product_id);
        }

        if (p.variants) {
            try {
                p.variants = JSON.parse(p.variants);
            } catch (e) {
                p.variants = null;
            }
        }
        return { ...p, files };
    });

    res.json({ success: true, data: productsWithFiles });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:shopId/products', (req, res) => {
  try {
    const { shopId } = req.params;
    const { product_id, category_id, price, is_featured, sort_order } = req.body;
    const id = crypto.randomUUID();

    // Check if already assigned
    const exists = db.prepare('SELECT id FROM shop_product_assignments WHERE shop_id = ? AND product_id = ?').get(shopId, product_id);
    if (exists) {
      return res.status(400).json({ success: false, error: 'Product already assigned to this shop' });
    }

    db.prepare(`
      INSERT INTO shop_product_assignments (id, shop_id, product_id, category_id, price, is_featured, personalization_enabled, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, shopId, product_id, category_id, price, is_featured ? 1 : 0, 0, sort_order || 0);

    const assignment = db.prepare('SELECT * FROM shop_product_assignments WHERE id = ?').get(id);
    res.json({ success: true, data: assignment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:shopId/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, price, is_featured, personalization_enabled, sort_order, manufacturer_info, description, size, variants, personalization_options, weight } = req.body;

    // Update assignment
    db.prepare(`
      UPDATE shop_product_assignments 
      SET category_id = ?, price = ?, is_featured = ?, personalization_enabled = ?, sort_order = ?, variants = ?, personalization_options = ?
      WHERE id = ?
    `).run(
        category_id, 
        price, 
        is_featured ? 1 : 0, 
        personalization_enabled ? 1 : 0, 
        sort_order, 
        variants ? JSON.stringify(variants) : null, 
        personalization_options ? JSON.stringify(personalization_options) : null,
        id
    );

    // Update product details (manufacturer_info, description, size, weight)
    const assignment = db.prepare('SELECT product_id FROM shop_product_assignments WHERE id = ?').get(id) as { product_id: string };
    if (assignment) {
        db.prepare(`
            UPDATE customer_products 
            SET manufacturer_info = ?, description = ?, size = ?, weight = ?
            WHERE id = ?
        `).run(manufacturer_info || null, description || null, size || null, weight || 0, assignment.product_id);
    }

    const updatedAssignment = db.prepare('SELECT * FROM shop_product_assignments WHERE id = ?').get(id);
    
    // Parse variants and personalization_options back to JSON
    if (updatedAssignment) {
        if ((updatedAssignment as any).variants) {
            (updatedAssignment as any).variants = JSON.parse((updatedAssignment as any).variants);
        }
        if ((updatedAssignment as any).personalization_options) {
            (updatedAssignment as any).personalization_options = JSON.parse((updatedAssignment as any).personalization_options);
        }
    }
    
    res.json({ success: true, data: updatedAssignment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:shopId/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM shop_product_assignments WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Shop Product Images ---

router.get('/:shopId/products/:assignmentId/images', (req, res) => {
    try {
        const { assignmentId } = req.params;
        
        // Get currently assigned images
        const assignedImages = db.prepare(`
            SELECT cpf.*, spi.id as assignment_image_id, spi.sort_order, spi.personalization_option_id, spi.personalization_option_ids
            FROM shop_product_images spi
            JOIN customer_product_files cpf ON spi.customer_product_file_id = cpf.id
            WHERE spi.shop_product_assignment_id = ?
            ORDER BY spi.sort_order ASC
        `).all(assignmentId);

        // Parse JSON for option_ids
        const assignedImagesParsed = assignedImages.map((img: any) => {
             try {
                 img.personalization_option_ids = img.personalization_option_ids ? JSON.parse(img.personalization_option_ids) : [];
                 // Fallback for migration: If single ID exists but array is empty, populate array
                 if (img.personalization_option_ids.length === 0 && img.personalization_option_id) {
                     img.personalization_option_ids = [img.personalization_option_id];
                 }
             } catch (e) {
                 img.personalization_option_ids = [];
             }
             return img;
        });

        // Get all available images for the customer (across all their products)
        const assignment = db.prepare('SELECT product_id FROM shop_product_assignments WHERE id = ?').get(assignmentId) as { product_id: string };
        if (!assignment) return res.status(404).json({ success: false, error: 'Assignment not found' });

        const product = db.prepare('SELECT customer_id FROM customer_products WHERE id = ?').get(assignment.product_id) as { customer_id: string };

        let allImages = [];
        if (product && product.customer_id) {
             // 1. Get files from customer_product_files (associated with products)
             const productFiles = db.prepare(`
                SELECT cpf.id, cpf.file_url, cpf.file_name, cpf.thumbnail_url, cpf.type, cpf.created_at, cp.name as product_origin_name
                FROM customer_product_files cpf
                JOIN customer_products cp ON cpf.product_id = cp.id
                WHERE cp.customer_id = ?
             `).all(product.customer_id) as any[];

             // 2. Get files from files table (direct uploads / orders)
             const directFiles = db.prepare(`
                SELECT id, path as file_url, name as file_name, thumbnail as thumbnail_url, type, created_at
                FROM files
                WHERE customer_id = ?
             `).all(product.customer_id) as any[];

             // Add origin context for direct files
             const directFilesWithOrigin = directFiles.map(f => ({
                 ...f,
                 product_origin_name: 'Direkter Upload / Auftrag'
             }));

             // Combine both sources
             allImages = [...productFiles, ...directFilesWithOrigin].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        } else {
             allImages = db.prepare('SELECT * FROM customer_product_files WHERE product_id = ? ORDER BY created_at DESC').all(assignment.product_id);
        }

        res.json({ success: true, data: { assigned: assignedImagesParsed, available: allImages } });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/:shopId/products/:assignmentId/images', (req, res) => {
    try {
        const { assignmentId } = req.params;
        const { file_id } = req.body;
        const id = crypto.randomUUID();

        // Check if already assigned
        const exists = db.prepare('SELECT id FROM shop_product_images WHERE shop_product_assignment_id = ? AND customer_product_file_id = ?').get(assignmentId, file_id);
        if (exists) return res.json({ success: true, message: 'Already assigned' });

        db.prepare(`
            INSERT INTO shop_product_images (id, shop_product_assignment_id, customer_product_file_id, sort_order, personalization_option_ids)
            VALUES (?, ?, ?, 0, '[]')
        `).run(id, assignmentId, file_id);

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/:shopId/products/:assignmentId/images/:fileId', (req, res) => {
    try {
        const { assignmentId, fileId } = req.params;
        const { personalization_option_ids } = req.body; // Expect array of IDs

        // Also update the legacy single column with the first ID or null, just in case
        const legacyId = (personalization_option_ids && personalization_option_ids.length > 0) ? personalization_option_ids[0] : null;

        db.prepare(`
            UPDATE shop_product_images 
            SET personalization_option_ids = ?, personalization_option_id = ?
            WHERE shop_product_assignment_id = ? AND customer_product_file_id = ?
        `).run(JSON.stringify(personalization_option_ids || []), legacyId, assignmentId, fileId);

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/:shopId/products/:assignmentId/images/:fileId', (req, res) => {
    try {
        const { assignmentId, fileId } = req.params;
        // Delete the assignment link, NOT the file itself
        db.prepare('DELETE FROM shop_product_images WHERE shop_product_assignment_id = ? AND customer_product_file_id = ?').run(assignmentId, fileId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Shop Shipping ---

router.get('/shipping/global-config', (req, res) => {
  try {
    const config = db.prepare("SELECT * FROM global_shipping_config WHERE id = 'main'").get();
    res.json({ success: true, data: config || null });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/shipping/global-config', (req, res) => {
  try {
    const { dhl_user, dhl_signature, dhl_ekp, dhl_participation, sender_name, sender_street, sender_house_number, sender_zip, sender_city, sender_country } = req.body;

    // Check if record exists
    const existing = db.prepare("SELECT id FROM global_shipping_config WHERE id = 'main'").get();

    if (existing) {
      db.prepare(`
        UPDATE global_shipping_config 
        SET dhl_user = ?, dhl_signature = ?, dhl_ekp = ?, dhl_participation = ?, 
            sender_name = ?, sender_street = ?, sender_house_number = ?, 
            sender_zip = ?, sender_city = ?, sender_country = ?, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 'main'
      `).run(dhl_user, dhl_signature, dhl_ekp, dhl_participation || '01', sender_name, sender_street, sender_house_number, sender_zip, sender_city, sender_country || 'DEU');
    } else {
      db.prepare(`
        INSERT INTO global_shipping_config (id, dhl_user, dhl_signature, dhl_ekp, dhl_participation, sender_name, sender_street, sender_house_number, sender_zip, sender_city, sender_country)
        VALUES ('main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(dhl_user, dhl_signature, dhl_ekp, dhl_participation || '01', sender_name, sender_street, sender_house_number, sender_zip, sender_city, sender_country || 'DEU');
    }

    const updatedConfig = db.prepare("SELECT * FROM global_shipping_config WHERE id = 'main'").get();
    res.json({ success: true, data: updatedConfig });
  } catch (error: any) {
    console.error('Error saving global shipping config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/shipping/test-config', async (req, res) => {
  try {
    const { dhl_user, dhl_signature, dhl_ekp } = req.body;

    if (!dhl_user || !dhl_signature || !dhl_ekp) {
        return res.status(400).json({ success: false, error: 'Unvollständige Daten für den Test.' });
    }

    console.log(`Echter DHL Verbindungstest für: ${dhl_user}...`);
    
    // Use getVersion to test basic connectivity and soap structure
    // Note: getVersion doesn't always require full auth, but it's a good first step
    const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                  xmlns:cis="http://dhl.de/webservice/cisbase" 
                  xmlns:ns="http://dhl.de/webservices/businesscustomershipping/3.0">
  <soapenv:Header>
    <cis:Authentification>
      <cis:user>${dhl_user}</cis:user>
      <cis:signature>${dhl_signature}</cis:signature>
    </cis:Authentification>
  </soapenv:Header>
  <soapenv:Body>
    <ns:GetVersionRequest>
      <majorRelease>3</majorRelease>
      <minorRelease>1</minorRelease>
    </ns:GetVersionRequest>
  </soapenv:Body>
</soapenv:Envelope>`;

    // Try with both HTTP Basic Auth and XML Auth (Shopware style)
    let authHeader = Buffer.from(`${dhl_user}:${dhl_signature}`).toString('base64');
    let body = soapRequest;

    let response = await fetch('https://cig.dhl.de/services/production/soap', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': '""'
        },
        body: body
    });

    let xmlResponse = await response.text();
    console.log('DHL Test Response (Attempt 1):', xmlResponse);

    // If 401, try WITHOUT HTTP Basic Auth (only XML Auth)
    if (response.status === 401) {
        console.log('401 detected, trying without HTTP Basic Auth...');
        response = await fetch('https://cig.dhl.de/services/production/soap', {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': '""'
            },
            body: body
        });
        xmlResponse = await response.text();
        console.log('DHL Test Response (Attempt 2 - No Basic Auth):', xmlResponse);
    }

    if (!response.ok) {
        let testError = `HTTP Fehler ${response.status}`;
        if (response.status === 401) testError = "Anmeldung fehlgeschlagen (401). DHL akzeptiert die Kombination aus Benutzer und Passwort nicht. Bitte prüfen Sie, ob Sie das 'Webservice-Passwort' (Signatur) verwenden.";
        if (response.status === 403) testError = "Zugriff verweigert (403). Der Account ist nicht für diesen Webservice freigeschaltet.";
        throw new Error(testError);
    }

    if (xmlResponse.includes('<majorRelease>') || xmlResponse.includes('ok') || xmlResponse.includes('OK')) {
        res.json({ 
            success: true, 
            message: 'Verbindung zum DHL-Server erfolgreich hergestellt!' 
        });
    } else {
        // Try to find faultstring
        const faultMatch = xmlResponse.match(/<faultstring>(.*?)<\/faultstring>/i);
        const errorMsg = faultMatch ? faultMatch[1] : 'Die Anmeldung wurde von DHL abgelehnt.';
        throw new Error(errorMsg);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:shopId/shipping-config', (req, res) => {
  try {
    const { shopId } = req.params;
    const config = db.prepare('SELECT * FROM shop_shipping_config WHERE shop_id = ?').get(shopId);
    res.json({ success: true, data: config || null });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:shopId/shipping-config', (req, res) => {
  try {
    const { shopId } = req.params;
    const { dhl_user, dhl_signature, dhl_ekp, dhl_participation, sender_name, sender_street, sender_house_number, sender_zip, sender_city, sender_country } = req.body;

    db.prepare(`
      INSERT INTO shop_shipping_config (shop_id, dhl_user, dhl_signature, dhl_ekp, dhl_participation, sender_name, sender_street, sender_house_number, sender_zip, sender_city, sender_country)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(shop_id) DO UPDATE SET
        dhl_user = excluded.dhl_user,
        dhl_signature = excluded.dhl_signature,
        dhl_ekp = excluded.dhl_ekp,
        dhl_participation = excluded.dhl_participation,
        sender_name = excluded.sender_name,
        sender_street = excluded.sender_street,
        sender_house_number = excluded.sender_house_number,
        sender_zip = excluded.sender_zip,
        sender_city = excluded.sender_city,
        sender_country = excluded.sender_country
    `).run(shopId, dhl_user, dhl_signature, dhl_ekp, dhl_participation, sender_name, sender_street, sender_house_number, sender_zip, sender_city, sender_country);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:shopId/shipping/create-label', async (req, res) => {
  try {
    const { shopId } = req.params;
    const { orderId } = req.body;

    // 1. Get Order Details
    const order = db.prepare(`
        SELECT o.*, sc.first_name, sc.last_name, sc.street, sc.zip, sc.city, sc.phone, sc.email
        FROM orders o
        LEFT JOIN shop_customers sc ON o.shop_customer_id = sc.id
        WHERE o.id = ?
    `).get(orderId) as any;

    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    // 1.1 Cleanup old label/error files for this order
    try {
        const files = await fs.readdir(LABELS_DIR);
        for (const file of files) {
            if (file.includes(`_${order.order_number}_`)) {
                await fs.remove(path.join(LABELS_DIR, file));
            }
        }
    } catch (cleanupErr) {
        console.warn('Cleanup of old labels failed:', cleanupErr);
    }

    // 2. Get Shipping Config (Check Shop-specific first, then Global)
    let config = db.prepare('SELECT * FROM shop_shipping_config WHERE shop_id = ?').get(shopId) as any;
    
    if (!config || !config.dhl_user) {
        // Fallback to Global Config
        config = db.prepare("SELECT * FROM global_shipping_config WHERE id = 'main'").get() as any;
    }

    if (!config || !config.dhl_user) {
        return res.status(400).json({ success: false, error: 'DHL Konfiguration fehlt oder unvollständig (weder im Shop noch global hinterlegt).' });
    }

    // 3. Attempt REAL DHL API Call (SOAP via XML)
    let trackingNumber = '';
    let labelUrl = '';
    let success = false;
    let errorMessage = '';

    try {
        console.log(`Versuche ECHTES DHL Label für Bestellung ${order.order_number} via SOAP...`);
        
        const splitAddress = (fullAddress: string) => {
            const match = fullAddress.match(/^(.+?)\s+(\d+[a-zA-Z]*)$/);
            if (match) return { street: match[1], number: match[2] };
            return { street: fullAddress, number: '1' };
        };

        const receiverAddr = splitAddress(order.street || order.customer_address || '');
        const senderAddr = {
            street: config.sender_street || '',
            number: config.sender_house_number || ''
        };

        const today = new Date().toISOString().split('T')[0];
        const billingNumber = `${config.dhl_ekp}${config.dhl_participation || '01'}01`;

        // XML Payload for DHL GKV SOAP API v3.0
        const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                  xmlns:cis="http://dhl.de/webservice/cisbase" 
                  xmlns:ns="http://dhl.de/webservices/businesscustomershipping/3.0">
  <soapenv:Header>
    <cis:Authentification>
      <cis:user>${config.dhl_user}</cis:user>
      <cis:signature>${config.dhl_signature}</cis:signature>
    </cis:Authentification>
  </soapenv:Header>
  <soapenv:Body>
    <ns:CreateShipmentOrderRequest>
      <ns:Version>
        <majorRelease>3</majorRelease>
        <minorRelease>1</minorRelease>
      </ns:Version>
      <ShipmentOrder>
        <sequenceNumber>${order.order_number}</sequenceNumber>
        <Shipment>
          <ShipmentDetails>
            <product>V01PAK</product>
            <cis:accountNumber>${billingNumber}</cis:accountNumber>
            <shipmentDate>${today}</shipmentDate>
            <ShipmentItem>
              <weightInKG>${order.weight || 1.0}</weightInKG>
            </ShipmentItem>
          </ShipmentDetails>
          <Shipper>
            <Name>
              <cis:name1>${config.sender_name || 'Maintextildruck'}</cis:name1>
            </Name>
            <Address>
              <cis:streetName>${senderAddr.street}</cis:streetName>
              <cis:streetNumber>${senderAddr.number}</cis:streetNumber>
              <cis:zip>${config.sender_zip}</cis:zip>
              <cis:city>${config.sender_city}</cis:city>
              <cis:Origin>
                <cis:countryISOCode>DE</cis:countryISOCode>
              </cis:Origin>
            </Address>
          </Shipper>
          <Receiver>
            <cis:name1>${`${order.first_name || ''} ${order.last_name || ''}`.trim().substring(0, 35) || order.customer_name.substring(0, 35)}</cis:name1>
            <Address>
              <cis:streetName>${receiverAddr.street.substring(0, 35)}</cis:streetName>
              <cis:streetNumber>${receiverAddr.number.substring(0, 10)}</cis:streetNumber>
              <cis:zip>${order.zip || ''}</cis:zip>
              <cis:city>${order.city ? order.city.substring(0, 35) : ''}</cis:city>
              <cis:Origin>
                <cis:countryISOCode>DE</cis:countryISOCode>
              </cis:Origin>
            </Address>
          </Receiver>
        </Shipment>
      </ShipmentOrder>
    </ns:CreateShipmentOrderRequest>
  </soapenv:Body>
</soapenv:Envelope>`;

        const authHeader = Buffer.from(`${config.dhl_user}:${config.dhl_signature}`).toString('base64');
        const body = soapRequest;

        let response = await fetch('https://cig.dhl.de/services/production/soap', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authHeader}`,
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': '""'
            },
            body: body
        });

        let xmlResponse = await response.text();
        
        // If 401, try WITHOUT HTTP Basic Auth (only XML Auth)
        if (response.status === 401) {
            console.log('401 detected, trying without HTTP Basic Auth...');
            response = await fetch('https://cig.dhl.de/services/production/soap', {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': '""'
                },
                body: body
            });
            xmlResponse = await response.text();
        }
        
        if (!response.ok) {
            console.error(`DHL API HTTP Error ${response.status}:`, xmlResponse);
            let httpError = `HTTP Fehler ${response.status}`;
            if (response.status === 401) httpError = "Authentifizierung fehlgeschlagen (401). DHL akzeptiert die Kombination aus Benutzer und Passwort nicht.";
            if (response.status === 403) httpError = "Zugriff verweigert (403). Ihr Account hat eventuell keine Berechtigung für diesen Webservice.";
            
            // Include raw response for debugging if it's short
            if (xmlResponse && xmlResponse.length < 500) {
                httpError += ` - Server Antwort: ${xmlResponse.replace(/<[^>]+>/g, ' ').trim()}`;
            }
            throw new Error(httpError);
        }
        
        // Basic XML Parsing (without heavy libraries)
        if (xmlResponse.includes('<statusText>ok</statusText>') || xmlResponse.includes('<statusText>OK</statusText>') || xmlResponse.includes('majorRelease')) {
            const shipNumMatch = xmlResponse.match(/<shipmentNumber>(.*?)<\/shipmentNumber>/);
            const labelUrlMatch = xmlResponse.match(/<labelUrl>(.*?)<\/labelUrl>/);
            
            if (shipNumMatch) {
                trackingNumber = shipNumMatch[1];
                
                if (labelUrlMatch) {
                    // DHL often returns a URL in SOAP. We fetch it and save it locally.
                    const labelRes = await fetch(labelUrlMatch[1]);
                    const pdfBuffer = await labelRes.arrayBuffer();
                    const fileName = `label_${order.order_number}_${trackingNumber}.pdf`;
                    const filePath = path.join(LABELS_DIR, fileName);
                    await fs.writeFile(filePath, Buffer.from(pdfBuffer));
                    labelUrl = `/labels/${fileName}`;
                    success = true;
                } else {
                    // Check if label is base64 in response
                    const labelDataMatch = xmlResponse.match(/<labelData>(.*?)<\/labelData>/);
                    if (labelDataMatch) {
                        const pdfBuffer = Buffer.from(labelDataMatch[1], 'base64');
                        const fileName = `label_${order.order_number}_${trackingNumber}.pdf`;
                        const filePath = path.join(LABELS_DIR, fileName);
                        await fs.writeFile(filePath, pdfBuffer);
                        labelUrl = `/labels/${fileName}`;
                        success = true;
                    } else {
                        throw new Error('Keine Label-Daten (URL oder Base64) in der Antwort gefunden.');
                    }
                }
            } else {
                throw new Error('Keine Sendungsnummer in der Antwort gefunden.');
            }
        } else {
            // Detailed Error Parsing
            console.error('DHL SOAP Error Response:', xmlResponse);
            
            const statusTextMatch = xmlResponse.match(/<statusText>(.*?)<\/statusText>/i);
            const statusMessageMatch = xmlResponse.match(/<statusMessage>(.*?)<\/statusMessage>/i);
            const faultStringMatch = xmlResponse.match(/<faultstring>(.*?)<\/faultstring>/i);
            
            let dhlError = '';
            if (statusMessageMatch && statusMessageMatch[1]) {
                dhlError = statusMessageMatch[1];
            } else if (statusTextMatch && statusTextMatch[1]) {
                dhlError = statusTextMatch[1];
            } else if (faultStringMatch && faultStringMatch[1]) {
                dhlError = faultStringMatch[1];
            } else {
                // Last resort: extract everything between status tags if they exist
                const statusMatch = xmlResponse.match(/<Status>([\s\S]*?)<\/Status>/i);
                if (statusMatch) {
                    dhlError = statusMatch[1].replace(/<[^>]+>/g, ' ').trim();
                }
            }
            
            // If we still have no error text, it might be a login error or structural error
            if (!dhlError || dhlError.toLowerCase() === 'ok') {
                if (xmlResponse.includes('Login failed')) dhlError = 'Anmeldung fehlgeschlagen (Login failed).';
                else if (xmlResponse.includes('Authentication failed')) dhlError = 'Authentifizierung fehlgeschlagen.';
                else dhlError = `Unbekannter DHL Fehler (Antwort-Länge: ${xmlResponse.length} Zeichen).`;
            }
            
            throw new Error(dhlError);
        }

    } catch (e: any) {
        errorMessage = e.message;
        console.error('DHL SOAP API Error Detail:', e);
        
        // FALLBACK to Draft Label with ERROR MESSAGE
        console.log(`Erstelle Entwurfs-Label aufgrund von SOAP-Fehler: ${errorMessage}`);
        trackingNumber = `ERROR-${Date.now()}`; // Unique ID for the error state
        
        const pdfDoc = await PDFDocument.create();
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const page = pdfDoc.addPage([400, 600]);
        
        page.drawText('DHL FEHLER-PROTOKOLL', { x: 50, y: 550, size: 20, font: fontBold, color: rgb(0.8, 0, 0) });
        page.drawText('DIES IST KEIN VERSANDLABEL', { x: 50, y: 525, size: 12, font: fontBold, color: rgb(1, 0, 0) });
        
        page.drawText('FEHLERMELDUNG VON DHL:', { x: 50, y: 490, size: 10, font: fontBold });
        
        // Wrap text for long error messages
        const errorText = errorMessage || 'Keine detaillierte Fehlermeldung empfangen.';
        const words = errorText.split(' ');
        let line = '';
        let y = 475;
        for (const word of words) {
            if ((line + word).length > 50) {
                page.drawText(line, { x: 50, y, size: 9, font: fontRegular });
                line = word + ' ';
                y -= 12;
            } else {
                line += word + ' ';
            }
        }
        page.drawText(line, { x: 50, y, size: 9, font: fontRegular });

        page.drawText('BESTELLDATEN:', { x: 50, y: y - 30, size: 10, font: fontBold });
        page.drawText(`Bestellung: #${order.order_number}`, { x: 50, y: y - 45, size: 9 });
        page.drawText(`Empfänger: ${order.customer_name}`, { x: 50, y: y - 57, size: 9 });
        page.drawText(`Adresse: ${order.customer_address}`, { x: 50, y: y - 69, size: 9 });
        
        page.drawText('HINWEIS:', { x: 50, y: 100, size: 10, font: fontBold });
        page.drawText('Bitte prüfen Sie Ihre DHL-Zugangsdaten (EKP, Benutzer, Signatur)', { x: 50, y: 85, size: 8 });
        page.drawText('und die Empfängeradresse auf Korrektheit.', { x: 50, y: 73, size: 8 });

        const pdfBytes = await pdfDoc.save();
        const fileName = `error_${order.order_number}_${Date.now()}.pdf`;
        const filePath = path.join(LABELS_DIR, fileName);
        await fs.writeFile(filePath, pdfBytes);
        
        labelUrl = `/labels/${fileName}`;
        success = false;
    }

    if (!success) {
        // Return 200 but with success:false so the frontend can show the error but still maybe provide the draft?
        // Actually, let's return 400 so the alert triggers.
        return res.status(400).json({ 
            success: false, 
            error: `DHL API Fehler: ${errorMessage}. Ein Entwurfs-Label wurde zur Korrektur erstellt.`,
            labelUrl: labelUrl
        });
    }

    // 4. Update Order with Tracking Info
    db.prepare("UPDATE orders SET tracking_number = ?, label_url = ?, status = 'shipped' WHERE id = ?")
      .run(trackingNumber, labelUrl, orderId);

    res.json({ 
        success: true, 
        trackingNumber: trackingNumber,
        labelUrl: labelUrl
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
