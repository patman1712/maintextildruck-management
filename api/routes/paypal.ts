import express from 'express';
import db from '../db.js';

const router = express.Router();

// Helper to get access token
async function getAccessToken(clientId: string, clientSecret: string, mode: string) {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const url = mode === 'live' 
        ? 'https://api-m.paypal.com/v1/oauth2/token' 
        : 'https://api-m.sandbox.paypal.com/v1/oauth2/token';

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });

    const data = await response.json();
    return data.access_token;
}

// Test Configuration
router.post('/test-config', async (req, res) => {
    try {
        const { clientId, clientSecret, mode } = req.body;
        
        if (!clientId || !clientSecret) {
            return res.status(400).json({ success: false, error: 'Client ID and Secret are required' });
        }

        const accessToken = await getAccessToken(clientId, clientSecret, mode || 'sandbox');
        
        if (accessToken) {
            res.json({ success: true, message: 'Verbindung erfolgreich! Token abgerufen.' });
        } else {
            res.status(400).json({ success: false, error: 'Kein Access Token erhalten. Bitte Zugangsdaten prüfen.' });
        }
    } catch (error: any) {
        console.error('PayPal Test Config Error:', error);
        res.status(500).json({ success: false, error: 'Verbindung fehlgeschlagen: ' + error.message });
    }
});

// Get Client ID (Public)
router.get('/config', (req, res) => {
    try {
        const config = db.prepare("SELECT paypal_client_id, paypal_mode FROM global_payment_config WHERE id = 'main'").get() as any;
        
        if (!config || !config.paypal_client_id) {
            return res.status(404).json({ success: false, error: 'PayPal not configured' });
        }

        res.json({ 
            success: true, 
            clientId: config.paypal_client_id,
            mode: config.paypal_mode || 'sandbox'
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create Order
router.post('/create-order', async (req, res) => {
    try {
        const { amount, currency, items, shipping } = req.body;

        const config = db.prepare("SELECT * FROM global_payment_config WHERE id = 'main'").get() as any;
        if (!config || !config.paypal_client_id || !config.paypal_client_secret) {
            throw new Error('PayPal not configured');
        }

        const accessToken = await getAccessToken(config.paypal_client_id, config.paypal_client_secret, config.paypal_mode);

        const url = config.paypal_mode === 'live'
            ? 'https://api-m.paypal.com/v2/checkout/orders'
            : 'https://api-m.sandbox.paypal.com/v2/checkout/orders';

        const currencyCode = currency || 'EUR';
        const normalizedItems = Array.isArray(items) ? items : [];
        const parsedShipping = Number.parseFloat(String(shipping ?? '0')) || 0;
        const parsedAmount = Number.parseFloat(String(amount ?? '0')) || 0;

        const toCents = (v: number) => Math.round(v * 100);
        const itemTotalCents = normalizedItems.reduce((sum: number, it: any) => {
            const unit = Number.parseFloat(String(it?.unit_amount ?? it?.price ?? '0')) || 0;
            const qty = Number.parseInt(String(it?.quantity ?? '1'), 10) || 1;
            return sum + toCents(unit) * Math.max(1, qty);
        }, 0);
        const shippingCents = toCents(parsedShipping);
        const computedTotalCents = itemTotalCents + shippingCents;
        const providedTotalCents = toCents(parsedAmount);

        if (normalizedItems.length > 0 && Math.abs(computedTotalCents - providedTotalCents) > 1) {
            return res.status(400).json({ success: false, error: { message: 'Totals mismatch' } });
        }

        const payload = {
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: currencyCode,
                    value: (normalizedItems.length > 0 ? (computedTotalCents / 100) : parsedAmount).toFixed(2),
                    breakdown: normalizedItems.length > 0 ? {
                        item_total: { currency_code: currencyCode, value: (itemTotalCents / 100).toFixed(2) },
                        shipping: { currency_code: currencyCode, value: (shippingCents / 100).toFixed(2) }
                    } : undefined
                }
            }],
            application_context: {
                shipping_preference: 'GET_FROM_FILE'
            }
        };

        if (normalizedItems.length > 0) {
            (payload.purchase_units[0] as any).items = normalizedItems.map((it: any) => ({
                name: String(it?.name || 'Artikel').slice(0, 127),
                quantity: String(Math.max(1, Number.parseInt(String(it?.quantity ?? '1'), 10) || 1)),
                unit_amount: {
                    currency_code: currencyCode,
                    value: (Number.parseFloat(String(it?.unit_amount ?? it?.price ?? '0')) || 0).toFixed(2)
                }
            }));
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (response.status === 201) {
             res.json({ success: true, orderId: data.id });
        } else {
             res.status(response.status).json({ success: false, error: data });
        }
    } catch (error: any) {
        console.error('PayPal Create Order Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Capture Order
router.post('/capture-order', async (req, res) => {
    try {
        const { orderId } = req.body;

        const config = db.prepare("SELECT * FROM global_payment_config WHERE id = 'main'").get() as any;
        if (!config || !config.paypal_client_id || !config.paypal_client_secret) {
            throw new Error('PayPal not configured');
        }

        const accessToken = await getAccessToken(config.paypal_client_id, config.paypal_client_secret, config.paypal_mode);

        const url = config.paypal_mode === 'live'
            ? `https://api-m.paypal.com/v2/checkout/orders/${orderId}/capture`
            : `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        if (response.status === 201 || response.status === 200) {
             res.json({ success: true, data: data });
        } else {
             res.status(response.status).json({ success: false, error: data });
        }
    } catch (error: any) {
        console.error('PayPal Capture Order Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
