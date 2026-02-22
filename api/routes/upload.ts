import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { DATA_DIR } from '../db.js';

const router = Router();
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.ensureDirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // Decode original name to avoid encoding issues
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, originalName);
  }
});

const upload = multer({ storage: storage });

// POST /api/upload
router.post('/', upload.fields([
  { name: 'preview', maxCount: 20 },
  { name: 'print', maxCount: 20 },
  { name: 'vector', maxCount: 20 }
]), (req: Request, res: Response) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const result: any = { preview: [], print: [], vector: [] };

  if (files) {
    if (files.preview) {
      result.preview = files.preview.map(f => ({
        originalName: Buffer.from(f.originalname, 'latin1').toString('utf8'),
        filename: f.filename,
        path: `/uploads/${f.filename}`
      }));
    }
    if (files.print) {
      result.print = files.print.map(f => ({
        originalName: Buffer.from(f.originalname, 'latin1').toString('utf8'),
        filename: f.filename,
        path: `/uploads/${f.filename}`
      }));
    }
    if (files.vector) {
      result.vector = files.vector.map(f => ({
        originalName: Buffer.from(f.originalname, 'latin1').toString('utf8'),
        filename: f.filename,
        path: `/uploads/${f.filename}`
      }));
    }
  }

  res.json({ success: true, files: result });
});

export default router;
export { UPLOAD_DIR };
