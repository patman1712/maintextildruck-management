import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import db, { DATA_DIR } from '../db.js';
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

// POST /api/upload/regenerate-thumbnails
// Helper to fix missing thumbnails for existing PDF files
router.post('/regenerate-thumbnails', async (req: Request, res: Response) => {
    try {
        const orders = db.prepare('SELECT id, files FROM orders').all() as { id: string, files: string }[];
        const ordersCount = orders.length;
        let totalUpdated = 0;

        for (const order of orders) {
            let files: any[] = [];
            try {
                files = JSON.parse(order.files || '[]');
            } catch (e) {
                continue;
            }

            let orderUpdated = false;
            for (const file of files) {
                if (!file.url) continue;

                // Check if PDF and missing thumbnail
                const isPdf = file.url.toLowerCase().endsWith('.pdf') || (file.name && file.name.toLowerCase().endsWith('.pdf'));
                
                if (isPdf && !file.thumbnail) {
                    const filename = path.basename(file.url);
                    const inputPath = path.join(UPLOAD_DIR, filename);

                    if (await fs.pathExists(inputPath)) {
                        try {
                            const thumbName = `${filename}_thumb`;
                            const thumbOutputPath = path.join(UPLOAD_DIR, thumbName);
                            
                            // Generate thumbnail
                            await execFileAsync('pdftoppm', [
                                '-png',
                                '-singlefile',
                                '-scale-to', '300',
                                inputPath,
                                thumbOutputPath
                            ]);
                            
                            file.thumbnail = `/uploads/${thumbName}.png`;
                            orderUpdated = true;
                            totalUpdated++;
                        } catch (e) {
                            console.error(`Failed to regenerate thumbnail for ${filename}:`, e);
                        }
                    }
                }
            }

            if (orderUpdated) {
                db.prepare('UPDATE orders SET files = ? WHERE id = ?').run(JSON.stringify(files), order.id);
            }
        }

        res.json({ success: true, updated: totalUpdated, ordersFound: ordersCount });
    } catch (error) {
        console.error('Error regenerating thumbnails:', error);
        res.status(500).json({ success: false, error: 'Regeneration failed' });
    }
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

// POST /api/upload/delete-pdf
// Expects JSON body: { filename: string }
router.post('/delete-pdf', async (req: Request, res: Response) => {
    try {
        const { filename } = req.body;
        
        if (!filename) {
            res.status(400).json({ success: false, error: 'No filename provided' });
            return;
        }

        const fullPath = path.join(UPLOAD_DIR, filename);

        // Security check
        if (!fullPath.startsWith(UPLOAD_DIR)) {
            res.status(403).json({ success: false, error: 'Invalid file path' });
            return;
        }

        if (await fs.pathExists(fullPath)) {
            await fs.remove(fullPath);
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, error: 'File not found' });
        }
    } catch (error) {
        console.error('Error deleting PDF:', error);
        res.status(500).json({ success: false, error: 'Delete failed' });
    }
});

// GET /api/upload/list-pdfs
router.get('/list-pdfs', async (req: Request, res: Response) => {
    try {
        const files = await fs.readdir(UPLOAD_DIR);
        const pdfs = await Promise.all(files
            .filter(f => f.startsWith('DTF_Job_') && f.endsWith('.pdf'))
            .map(async f => {
                const stat = await fs.stat(path.join(UPLOAD_DIR, f));
                const thumbName = `${f}_thumb.png`;
                const thumbPath = path.join(UPLOAD_DIR, thumbName);
                
                let hasThumb = await fs.pathExists(thumbPath);
                
                // If missing, try to generate it now
                if (!hasThumb) {
                    try {
                        const inputPath = path.join(UPLOAD_DIR, f);
                        // Output root for pdftoppm (it appends .png)
                        const thumbRoot = path.join(UPLOAD_DIR, `${f}_thumb`);
                        
                        await execFileAsync('pdftoppm', [
                            '-png',
                            '-singlefile',
                            '-scale-to', '300',
                            inputPath,
                            thumbRoot
                        ]);
                        hasThumb = await fs.pathExists(thumbPath);
                    } catch (e) {
                        console.error('Failed to generate missing thumbnail during list:', f, e);
                    }
                }

                return {
                    name: f,
                    url: `/uploads/${f}`,
                    date: stat.mtime.toISOString(),
                    thumbnail: hasThumb ? `/uploads/${thumbName}` : null
                };
            }));
            
        // Sort by date desc
        pdfs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        res.json({ success: true, files: pdfs });
    } catch (error) {
        console.error('Error listing PDFs:', error);
        res.status(500).json({ success: false, error: 'List failed' });
    }
});

export default router;
export { UPLOAD_DIR };
