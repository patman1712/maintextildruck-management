import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import db from '../db.js';
import { UPLOAD_DIR } from './upload.js';

const router = Router();
const DOWNLOADS_DIR = path.join(path.dirname(UPLOAD_DIR), 'downloads');
fs.ensureDirSync(DOWNLOADS_DIR);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, DOWNLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    // Use timestamp to avoid collision
    cb(null, `${name}-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage: storage });

// GET all
router.get('/', (req, res) => {
    try {
        const downloads = db.prepare('SELECT * FROM downloads ORDER BY created_at DESC').all();
        res.json({ success: true, data: downloads });
    } catch (e) { 
        console.error(e);
        res.status(500).json({success: false, error: 'Failed'}); 
    }
});

// POST
router.post('/', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({success: false, error: 'No file'});
    
    const { title, description } = req.body;
    const id = Math.random().toString(36).substr(2, 9);
    const filename = req.file.filename;
    
    try {
        db.prepare('INSERT INTO downloads (id, title, description, file_path, file_name) VALUES (?, ?, ?, ?, ?)').run(
            id, title || filename, description || '', req.file.path, filename
        );
        res.json({ success: true, id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false });
    }
});

// DELETE
router.delete('/:id', async (req, res) => {
    try {
        const row = db.prepare('SELECT file_path FROM downloads WHERE id = ?').get(req.params.id) as {file_path: string};
        if (row) {
            if (await fs.pathExists(row.file_path)) {
                await fs.remove(row.file_path);
            }
            db.prepare('DELETE FROM downloads WHERE id = ?').run(req.params.id);
        }
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false });
    }
});

export default router;
export { DOWNLOADS_DIR };
