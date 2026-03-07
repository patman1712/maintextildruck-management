import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import db from '../db.js';
import { UPLOAD_DIR } from './upload.js';
import nodemailer from 'nodemailer';
import dns from 'dns';
import net from 'net';
import tls from 'tls';

const router = Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const filename = `logo-${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({ storage: storage });

// GET /api/settings
router.get('/', (req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all() as {key: string, value: string}[];
    const settings: Record<string, string> = {};
    rows.forEach(r => settings[r.key] = r.value);
    res.json({ success: true, settings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

// POST /api/settings/logo
router.post('/logo', upload.single('logo'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file' });
  
  const logoUrl = `/uploads/${req.file.filename}`;
  
  try {
    const existing = db.prepare('SELECT key FROM settings WHERE key = ?').get('logo');
    if (existing) {
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(logoUrl, 'logo');
    } else {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('logo', logoUrl);
    }
    
    res.json({ success: true, logoUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Failed to save setting' });
  }
});

// POST /api/settings/favicon
router.post('/favicon', upload.single('favicon'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file' });
  
  const faviconUrl = `/uploads/${req.file.filename}`;
  
  try {
    const existing = db.prepare('SELECT key FROM settings WHERE key = ?').get('favicon');
    if (existing) {
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(faviconUrl, 'favicon');
    } else {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('favicon', faviconUrl);
    }
    
    // Auto-update public logos for PWA/Favicon
    let copyError = null;
    try {
        const publicDir = path.join(process.cwd(), 'public');
        
        // Ensure public dir exists
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
        }
        
        // Use req.file.path directly
        const srcPath = req.file.path;
        
        // Copy to logo.png
        await fs.copy(srcPath, path.join(publicDir, 'logo.png'));
        
        // Copy to apple-touch-icon.png
        await fs.copy(srcPath, path.join(publicDir, 'apple-touch-icon.png'));
        
        // Copy to favicon.ico
        await fs.copy(srcPath, path.join(publicDir, 'favicon.ico'));
        
    } catch (e: any) {
        console.error("Failed to update public favicon files", e);
        copyError = e.message;
    }
    
    res.json({ success: true, faviconUrl, warning: copyError ? `Favicon copied but public update failed: ${copyError}` : undefined });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Failed to save favicon' });
  }
});

// POST /api/settings
router.post('/', (req: Request, res: Response) => {
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ success: false, error: 'Missing key/value' });

  try {
    const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const existing = db.prepare('SELECT key FROM settings WHERE key = ?').get(key);
    
    if (existing) {
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(strValue, key);
    } else {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, strValue);
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Failed to save setting' });
  }
});

// GET /api/settings/global-content
router.get('/global-content', (req, res) => {
  try {
    const content = db.prepare("SELECT * FROM global_shop_content WHERE id = 'main'").get();
    res.json({ success: true, data: content });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/settings/global-content
router.put('/global-content', (req, res) => {
  try {
    const updates = req.body;
    const allowedKeys = [
        'footer_logo_url', 'contact_phone', 'contact_email', 'contact_address',
        'company_name', 'company_address', 'ceo_name', 'bank_name', 'bank_iban',
        'bank_bic', 'tax_number', 'vat_id', 'commercial_register'
    ]; // Add more as needed

    const keysToUpdate = Object.keys(updates).filter(k => allowedKeys.includes(k));
    
    if (keysToUpdate.length > 0) {
        const setClause = keysToUpdate.map(k => `${k} = ?`).join(', ');
        const values = keysToUpdate.map(k => updates[k]);
        
        db.prepare(`UPDATE global_shop_content SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = 'main'`).run(...values);
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/settings/email-config
router.get('/email-config', (req, res) => {
  try {
    const config = db.prepare("SELECT * FROM email_config WHERE id = 'main'").get();
    res.json({ success: true, data: config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/settings/email-config
router.put('/email-config', (req, res) => {
  try {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, sender_name, sender_email, ignore_certs } = req.body;
    
    db.prepare(`
        UPDATE email_config 
        SET smtp_host = ?, smtp_port = ?, smtp_user = ?, smtp_pass = ?, 
            smtp_secure = ?, sender_name = ?, sender_email = ?, ignore_certs = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = 'main'
    `).run(smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure ? 1 : 0, sender_name, sender_email, ignore_certs ? 1 : 0);
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/settings/email-config/test
router.post('/email-config/test', async (req: Request, res: Response) => {
    let logs: string[] = [];
    const log = (msg: string) => {
        console.log(`[SMTP Debug] ${msg}`);
        logs.push(msg);
    };

    try {
        const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, sender_email, test_email, ignore_certs } = req.body;

        if (!smtp_host || !smtp_port || !smtp_user || !smtp_pass || !sender_email || !test_email) {
            return res.status(400).json({ success: false, error: 'Bitte alle SMTP-Felder und eine Test-Empfänger-Adresse ausfüllen.' });
        }

        log(`Starting Test: ${smtp_host}:${smtp_port} | User: ${smtp_user} | Secure: ${smtp_secure}`);

        // Step 1: DNS Lookup
        log('Step 1: DNS Lookup...');
        let resolvedIp = '';
        try {
             await new Promise<void>((resolve, reject) => {
                dns.lookup(smtp_host.trim(), { family: 4 }, (err, address) => {
                    if (err) {
                        log(`DNS Error: ${err.message}`);
                        reject(err);
                    } else {
                        log(`DNS Resolved: ${address}`);
                        resolvedIp = address;
                        resolve();
                    }
                });
            });
        } catch (e: any) {
            return res.status(500).json({ success: false, error: `DNS Fehler: ${e.message}`, logs });
        }

        // Step 2: Connectivity Check
        log(`Step 2: Checking network connectivity to ${resolvedIp}:${smtp_port}...`);
        try {
            await new Promise<void>((resolve, reject) => {
                const socket = new net.Socket();
                socket.setTimeout(5000);
                
                socket.on('connect', () => {
                    log('TCP Connection successful!');
                    socket.destroy();
                    resolve();
                });
                
                socket.on('timeout', () => {
                    log('TCP Connection Timed Out');
                    socket.destroy();
                    reject(new Error('TCP Timeout'));
                });
                
                socket.on('error', (err) => {
                    log(`TCP Connection Error: ${err.message}`);
                    socket.destroy();
                    reject(err);
                });

                socket.connect(Number(smtp_port), resolvedIp);
            });
        } catch (e: any) {
            log(`Network Check Failed: ${e.message}`);
            return res.status(500).json({ 
                success: false, 
                error: `Netzwerkfehler: Der Server kann keine Verbindung zu Port ${smtp_port} aufbauen. Vermutlich blockiert eine Firewall (ausgehend) oder der Provider (Vercel/Railway/etc.) diesen Port.`, 
                logs 
            });
        }

        // Step 3: Nodemailer
        log('Step 3: Sending Mail via Nodemailer...');
        
        // Force use of IP address to bypass Node's internal DNS issues
        const transporter = nodemailer.createTransport({
            host: resolvedIp, 
            port: Number(smtp_port),
            secure: Boolean(smtp_secure),
            auth: {
                user: smtp_user.trim(),
                pass: smtp_pass
            },
            tls: {
                rejectUnauthorized: !Boolean(ignore_certs),
                servername: smtp_host.trim() // Critical for IP connection
            },
            logger: true,
            debug: true,
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000
        } as any);

        await transporter.verify();
        log('SMTP Handshake & Auth successful.');

        // 4. Send Mail
        log('Step 4: Sending Test Mail...');
        await transporter.sendMail({
            from: sender_email,
            to: test_email,
            subject: 'Test Email - System Einstellungen',
            text: 'Dies ist eine Test-Email um die SMTP-Einstellungen zu überprüfen.\n\nErfolgreich gesendet!',
            html: '<h3>SMTP Test erfolgreich!</h3><p>Dies ist eine Test-Email um die SMTP-Einstellungen zu überprüfen.</p>'
        });
        log('Mail sent successfully.');

        res.json({ success: true, message: 'Verbindung erfolgreich & Test-Email gesendet!', logs });
    } catch (error: any) {
        log(`Error: ${error.message}`);
        
        let errorMessage = error.message;
        if (error.code === 'ETIMEDOUT') {
            errorMessage = 'Zeitüberschreitung: Der Server konnte unter diesem Host/Port nicht erreicht werden. Prüfen Sie Hostname und Port (oft 465 oder 587).';
        } else if (error.code === 'EAUTH') {
            errorMessage = 'Authentifizierung fehlgeschlagen: Benutzername oder Passwort falsch.';
        } else if (error.code === 'ESOCKET') {
            errorMessage = 'Verbindungsfehler: Falsches Protokoll? (Prüfen Sie den Haken bei "SSL (Erzwungen)").';
        }

        res.status(500).json({ success: false, error: errorMessage, logs });
    }
});

export default router;
