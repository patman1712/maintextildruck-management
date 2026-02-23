import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
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
router.post('/logo', upload.single('logo'), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file' });
  
  const logoUrl = `/uploads/${req.file.filename}`;
  
  try {
    // Upsert logo setting
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

export default router;
