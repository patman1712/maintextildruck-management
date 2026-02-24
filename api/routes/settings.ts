import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import db from '../db.js';
import { UPLOAD_DIR } from './upload.js';

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

export default router;
