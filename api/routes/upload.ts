import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { DATA_DIR } from '../db.js';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

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
]), async (req: Request, res: Response) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const result: any = { preview: [], print: [], vector: [] };

  if (files) {
    if (files.preview) {
      result.preview = await Promise.all(files.preview.map(async f => {
        const originalName = Buffer.from(f.originalname, 'latin1').toString('utf8');
        let thumbnail = undefined;

        if (f.mimetype === 'application/pdf' || f.originalname.toLowerCase().endsWith('.pdf')) {
            try {
                const inputPath = path.join(UPLOAD_DIR, f.filename);
                const thumbName = `${f.filename}_thumb`;
                const thumbOutputPath = path.join(UPLOAD_DIR, thumbName);
                
                await execFileAsync('pdftoppm', [
                    '-png',
                    '-singlefile',
                    '-scale-to', '300',
                    inputPath,
                    thumbOutputPath
                ]);
                
                thumbnail = `/uploads/${thumbName}.png`;
            } catch (e) {
                console.error('Thumbnail generation failed for preview', e);
            }
        }

        return {
            originalName,
            filename: f.filename,
            path: `/uploads/${f.filename}`,
            thumbnail
        };
      }));
    }
    if (files.print) {
      result.print = await Promise.all(files.print.map(async f => {
        const originalName = Buffer.from(f.originalname, 'latin1').toString('utf8');
        let thumbnail = undefined;

        if (f.mimetype === 'application/pdf' || f.originalname.toLowerCase().endsWith('.pdf')) {
            try {
                const inputPath = path.join(UPLOAD_DIR, f.filename);
                const thumbName = `${f.filename}_thumb`;
                const thumbOutputPath = path.join(UPLOAD_DIR, thumbName);
                
                await execFileAsync('pdftoppm', [
                    '-png',
                    '-singlefile',
                    '-scale-to', '300',
                    inputPath,
                    thumbOutputPath
                ]);
                
                thumbnail = `/uploads/${thumbName}.png`;
            } catch (e) {
                console.error('Thumbnail generation failed for print', e);
            }
        }

        return {
            originalName,
            filename: f.filename,
            path: `/uploads/${f.filename}`,
            thumbnail
        };
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

// POST /api/upload/delete
// Expects JSON body: { filePath: string }
// filePath is like "/uploads/filename.ext"
router.post('/delete', async (req: Request, res: Response) => {
    try {
        const { filePath } = req.body;
        
        if (!filePath) {
            res.status(400).json({ success: false, error: 'No file path provided' });
            return;
        }

        // Extract filename from path (e.g., /uploads/foo.png -> foo.png)
        const filename = path.basename(filePath);
        const fullPath = path.join(UPLOAD_DIR, filename);

        // Security check: ensure the file is within UPLOAD_DIR
        if (!fullPath.startsWith(UPLOAD_DIR)) {
            res.status(403).json({ success: false, error: 'Invalid file path' });
            return;
        }

        if (await fs.pathExists(fullPath)) {
            await fs.remove(fullPath);
            
            // Also try to remove thumbnail if it exists
            // Thumbnail convention: filename_thumb.png
            // Check if this was a PDF (or just check for thumb blindly)
            const thumbName = `${filename}_thumb.png`;
            const thumbPath = path.join(UPLOAD_DIR, thumbName);
            if (await fs.pathExists(thumbPath)) {
                await fs.remove(thumbPath);
            }
            
            res.json({ success: true });
        } else {
            // File not found, but we can consider it "deleted"
            res.json({ success: true, message: 'File not found, assumed deleted' });
        }
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ success: false, error: 'Delete failed' });
    }
});

export default router;
export { UPLOAD_DIR };
