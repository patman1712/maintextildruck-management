import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import webpush from 'web-push';

const router = Router();

// Configure web-push
// We read env vars inside the request/init to ensure they are loaded
const getVapidKeys = () => {
    return {
        publicKey: process.env.VITE_VAPID_PUBLIC_KEY,
        privateKey: process.env.VAPID_PRIVATE_KEY,
        subject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com'
    };
};

const initWebPush = () => {
    const { publicKey, privateKey, subject } = getVapidKeys();
    if (publicKey && privateKey) {
        try {
            webpush.setVapidDetails(subject, publicKey, privateKey);
            console.log('WebPush initialized successfully');
        } catch (e) {
            console.error('WebPush init failed:', e);
        }
    } else {
        console.warn('VAPID keys not found on init. Push notifications will not work.');
    }
};

// Initialize on load
initWebPush();

// GET VAPID Public Key
router.get('/public-key', (req: Request, res: Response) => {
    const { publicKey } = getVapidKeys();
    if (!publicKey) {
        console.error('Public Key requested but not found in env');
        return res.status(500).json({ success: false, error: 'VAPID Public Key not configured on server' });
    }
    res.json({ success: true, publicKey });
});

// POST Subscribe
router.post('/subscribe', (req: Request, res: Response) => {
    const subscription = req.body;
    const { endpoint, keys } = subscription;
    const userId = (req as any).user?.id || null; // If authenticated

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
        return res.status(400).json({ success: false, error: 'Invalid subscription object' });
    }

    try {
        const { publicKey, privateKey, subject } = getVapidKeys();
        if(publicKey && privateKey) webpush.setVapidDetails(subject, publicKey, privateKey);
        
        // Check if exists
        const exists = db.prepare('SELECT id FROM push_subscriptions WHERE endpoint = ?').get(endpoint);
        
        if (exists) {
            // Update user_id if needed
            if (userId) {
                db.prepare('UPDATE push_subscriptions SET user_id = ? WHERE endpoint = ?').run(userId, endpoint);
            }
            return res.json({ success: true, message: 'Subscription updated' });
        }

        const id = Math.random().toString(36).substr(2, 9);
        db.prepare(`
            INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, user_id)
            VALUES (?, ?, ?, ?, ?)
        `).run(id, endpoint, keys.p256dh, keys.auth, userId);

        res.status(201).json({ success: true, message: 'Subscribed successfully' });
    } catch (error: any) {
        console.error('Error saving subscription:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST Send Notification (Test/Admin)
router.post('/send', async (req: Request, res: Response) => {
    const { title, body, userId } = req.body; // If userId provided, send to specific user, else all

    const payload = JSON.stringify({ title, body });

    try {
        const { publicKey, privateKey, subject } = getVapidKeys();
        if(publicKey && privateKey) webpush.setVapidDetails(subject, publicKey, privateKey);
        
        let subscriptions: any[] = [];
        if (userId) {
            subscriptions = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
        } else {
            subscriptions = db.prepare('SELECT * FROM push_subscriptions').all();
        }

        const promises = subscriptions.map(sub => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };
            return webpush.sendNotification(pushSubscription, payload)
                .catch(err => {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        // Subscription expired or gone
                        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
                    } else {
                        console.error('Error sending push:', err);
                    }
                });
        });

        await Promise.all(promises);

        res.json({ success: true, message: `Notification sent to ${subscriptions.length} devices` });
    } catch (error: any) {
        console.error('Error sending notification:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
