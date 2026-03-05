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
        const { amount, currency } = req.body; // Expecting { value: "10.00", currency_code: "EUR" }

        const config = db.prepare("SELECT * FROM global_payment_config WHERE id = 'main'").get() as any;
        if (!config || !config.paypal_client_id || !config.paypal_client_secret) {
            throw new Error('PayPal not configured');
        }

        const accessToken = await getAccessToken(config.paypal_client_id, config.paypal_client_secret, config.paypal_mode);

        const url = config.paypal_mode === 'live'
            ? 'https://api-m.paypal.com/v2/checkout/orders'
            : 'https://api-m.sandbox.paypal.com/v2/checkout/orders';

        const payload = {
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: currency || 'EUR',
                    value: amount
                }
            }]
        };

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
