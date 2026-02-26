import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import db, { DATA_DIR } from '../db.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';

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
    // Sanitize filename to avoid filesystem issues
    const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    cb(null, `${timestamp}_${safeName}`);
  }
});

const upload = multer({ storage: storage });

// Helper to generate thumbnails
const generateThumbnail = async (file: Express.Multer.File) => {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    let thumbnail = undefined;
    const inputPath = path.join(UPLOAD_DIR, file.filename);
    const thumbName = `${file.filename}_thumb`; // Base name for thumb
    
    try {
        if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
            const thumbOutputPath = path.join(UPLOAD_DIR, thumbName); // pdftoppm adds extension automatically if we don't be careful, but with -singlefile it uses the root name
            
            await execFileAsync('pdftoppm', [
                '-png',
                '-singlefile',
                '-scale-to', '300',
                inputPath,
                thumbOutputPath
            ]);
            
            thumbnail = `/uploads/${thumbName}.png`;
        } else if (file.mimetype.startsWith('image/')) {
            // Use sharp for images
            const thumbOutputPath = path.join(UPLOAD_DIR, `${thumbName}.png`); // Explicit png extension
            
            await sharp(inputPath)
                .resize(300, 300, {
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 0 }
                })
                .toFile(thumbOutputPath);
                
            thumbnail = `/uploads/${thumbName}.png`;
        }
    } catch (e) {
        console.error('Thumbnail generation failed:', e);
    }

    return {
        originalName,
        filename: file.filename,
        path: `/uploads/${file.filename}`,
        thumbnail
    };
};

// POST /api/upload
router.post('/', upload.fields([
  { name: 'preview', maxCount: 20 },
  { name: 'print', maxCount: 20 },
  { name: 'vector', maxCount: 20 },
  { name: 'internal', maxCount: 20 }
]), async (req: Request, res: Response) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const result: any = { preview: [], print: [], vector: [], internal: [] };

  if (files) {
    if (files.preview) {
      result.preview = await Promise.all(files.preview.map(generateThumbnail));
    }
    if (files.print) {
      result.print = await Promise.all(files.print.map(generateThumbnail));
    }
    if (files.vector) {
      result.vector = files.vector.map(f => ({
        originalName: Buffer.from(f.originalname, 'latin1').toString('utf8'),
        filename: f.filename,
        path: `/uploads/${f.filename}`
      }));
    }
    if (files.internal) {
      result.internal = await Promise.all(files.internal.map(generateThumbnail));
    }
  }

  res.json({ success: true, files: result });
});

// POST /api/upload/regenerate-thumbnails
// Helper to fix missing thumbnails for existing PDF files
router.post('/regenerate-thumbnails', async (req: Request, res: Response) => {
    console.log('Starting thumbnail regeneration...');
    try {
        const orders = db.prepare('SELECT id, files FROM orders').all() as { id: string, files: string }[];
        const ordersCount = orders.length;
        let totalUpdated = 0;
        
        console.log(`Found ${ordersCount} orders to check.`);

        for (const order of orders) {
            let files: any[] = [];
            try {
                files = JSON.parse(order.files || '[]');
            } catch (e) {
                continue;
            }
            
            // LOGGING: Check file structure for first few orders
            if (totalUpdated === 0 && files.length > 0) {
                 console.log(`DEBUG: Order ${order.id} files sample:`, JSON.stringify(files[0], null, 2));
            }

            let orderUpdated = false;
            for (const file of files) {
                // Support both url and path fields
                const fileUrl = file.url || file.path;
                if (!fileUrl) continue;

                // Extract filename properly: handle both /uploads/filename and just filename
                const filename = path.basename(fileUrl);
                
                // FORCE PATH:
                // If we are on Railway (or any server where UPLOAD_DIR is absolute), we must be careful.
                // fileUrl might be "/uploads/foo.png".
                // UPLOAD_DIR might be "/app/data/uploads".
                // path.join(UPLOAD_DIR, filename) -> "/app/data/uploads/foo.png". This is correct.
                
                // BUT: Check if filename is actually found.
                // Let's try to look for it directly.
                const inputPath = path.join(UPLOAD_DIR, filename);

                // Determine file type
                const isPdf = filename.toLowerCase().endsWith('.pdf') || (file.name && file.name.toLowerCase().endsWith('.pdf'));
                const isImage = filename.match(/\.(jpg|jpeg|png|webp)$/i) || (file.name && file.name.match(/\.(jpg|jpeg|png|webp)$/i));
                
                // FORCE REGENERATE if it's an image and doesn't have a thumbnail (or has a dummy one)
                // Also check if file exists
                // CHANGE: We removed the check "!file.thumbnail" to force re-check of existence for debugging?
                // No, user says "0 updated".
                // Let's assume thumbnails are missing.
                const needsThumb = (isPdf || isImage) && (!file.thumbnail || file.thumbnail === "");
                
                if (isPdf || isImage) {
                    // console.log(`Checking ${filename}... Needs thumb? ${needsThumb}`);
                    
                    if (await fs.pathExists(inputPath)) {
                         if (needsThumb) {
                            try {
                                console.log(`Generating thumbnail for ${filename}...`);
                                const thumbName = `${filename}_thumb`;
                                let thumbOutputPath = "";
                                
                                if (isPdf) {
                                    thumbOutputPath = path.join(UPLOAD_DIR, thumbName);
                                    // Generate thumbnail for PDF
                                    await execFileAsync('pdftoppm', [
                                        '-png',
                                        '-singlefile',
                                        '-scale-to', '300',
                                        inputPath,
                                        thumbOutputPath
                                    ]);
                                } else {
                                    // Generate thumbnail for Image
                                    thumbOutputPath = path.join(UPLOAD_DIR, `${thumbName}.png`);
                                    await sharp(inputPath)
                                        .resize(300, 300, {
                                            fit: 'contain',
                                            background: { r: 255, g: 255, b: 255, alpha: 0 }
                                        })
                                        .toFile(thumbOutputPath);
                                }
                                
                                const thumbUrl = `/uploads/${thumbName}.png`;
                                file.thumbnail = thumbUrl;
                                
                                // Also update legacy thumbnail_url if present
                                if (file.thumbnail_url !== undefined) file.thumbnail_url = thumbUrl;
                                
                                orderUpdated = true;
                                totalUpdated++;
                            } catch (e) {
                                console.error(`Failed to regenerate thumbnail for ${filename}:`, e);
                            }
                        }
                    } else {
                        console.log(`File not found on disk: ${inputPath} (UPLOAD_DIR: ${UPLOAD_DIR})`);
                    }
                }
            }

            if (orderUpdated) {
                db.prepare('UPDATE orders SET files = ? WHERE id = ?').run(JSON.stringify(files), order.id);
            }
        }
        
        // Also regenerate for customer products
        console.log('Checking customer products...');
        const productFiles = db.prepare('SELECT id, file_url, file_name, thumbnail_url FROM customer_product_files').all() as { id: string, file_url: string, file_name: string, thumbnail_url: string }[];
        let productsUpdated = 0;
        
        for (const file of productFiles) {
            const fileUrl = file.file_url;
            if (!fileUrl) continue;
            
            const filename = path.basename(fileUrl);
            const inputPath = path.join(UPLOAD_DIR, filename);
            
            const isPdf = filename.toLowerCase().endsWith('.pdf') || (file.file_name && file.file_name.toLowerCase().endsWith('.pdf'));
            const isImage = filename.match(/\.(jpg|jpeg|png|webp)$/i) || (file.file_name && file.file_name.match(/\.(jpg|jpeg|png|webp)$/i));
            
            // Check if missing thumbnail
            if ((isPdf || isImage) && !file.thumbnail_url) {
                    if (await fs.pathExists(inputPath)) {
                    try {
                        console.log(`Generating product thumbnail for ${filename}...`);
                        const thumbName = `${filename}_thumb`;
                        let thumbOutputPath = "";
                        
                        if (isPdf) {
                            thumbOutputPath = path.join(UPLOAD_DIR, thumbName);
                            await execFileAsync('pdftoppm', [
                                '-png',
                                '-singlefile',
                                '-scale-to', '300',
                                inputPath,
                                thumbOutputPath
                            ]);
                        } else {
                            thumbOutputPath = path.join(UPLOAD_DIR, `${thumbName}.png`);
                            await sharp(inputPath)
                                .resize(300, 300, {
                                    fit: 'contain',
                                    background: { r: 255, g: 255, b: 255, alpha: 0 }
                                })
                                .toFile(thumbOutputPath);
                        }
                        
                        const thumbUrl = `/uploads/${thumbName}.png`;
                        
                        // Update the record
                        db.prepare('UPDATE customer_product_files SET thumbnail_url = ? WHERE id = ?').run(thumbUrl, file.id);
                        productsUpdated++;
                    } catch (e) {
                        console.error(`Failed to regenerate product thumbnail for ${filename}:`, e);
                    }
                    } else {
                         console.log(`Product file not found on disk: ${inputPath}`);
                    }
            }
        }
        
        console.log(`Finished. Orders updated: ${totalUpdated}, Products updated: ${productsUpdated}`);
        res.json({ success: true, updated: totalUpdated, productsUpdated, ordersFound: ordersCount });
    } catch (error: any) {
        console.error('Error regenerating thumbnails:', error);
        res.status(500).json({ success: false, error: error.message || 'Regeneration failed' });
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
