import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import potrace from 'potrace';
import fs from 'fs';
import sharp from 'sharp';
import { buildPalette, applyPalette, utils } from "image-q";

const router = Router();
const upload = multer({ dest: 'uploads/' });

// Helper: Promisify potrace
const trace = (buffer: Buffer, color: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const params = {
            threshold: 128,
            turnPolicy: 'black',
            turdSize: 2,
            optCurve: true,
            optTolerance: 0.2,
            blackOnWhite: true,
            color: color,
            background: 'transparent'
        };
        potrace.trace(buffer, params, (err: any, svg: string) => {
            if (err) reject(err);
            else resolve(svg);
        });
    });
};

// POST /api/vector/potrace (B/W)
router.post('/potrace', upload.single('image'), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file' });

  const params = {
    threshold: 128,
    turnPolicy: 'black',
    turdSize: 2,
    alphaMax: 1,
    optCurve: true,
    optTolerance: 0.2,
    blackOnWhite: true,
    color: 'black',
    background: 'transparent'
  };

  potrace.trace(req.file.path, params, (err: any, svg: string) => {
    fs.unlink(req.file!.path, () => {});
    if (err) return res.status(500).json({ success: false, error: 'Vectorization failed' });
    res.json({ success: true, svg });
  });
});

// POST /api/vector/potrace-color
router.post('/potrace-color', upload.single('image'), async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file' });

    try {
        const maxColors = parseInt(req.body.colors as string) || 16;
        
        // 1. Load image & Resize
        const { data, info } = await sharp(req.file.path)
            .resize({ width: 800, fit: 'inside' }) 
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const width = info.width;
        const height = info.height;

        // 2. Quantize
        const pointContainer = utils.PointContainer.fromUint8Array(data, width, height);
        const palette = await buildPalette([pointContainer], { colors: maxColors });
        const outContainer = await applyPalette(pointContainer, palette);
        
        // Get unique palette colors used
        const paletteColors = palette.getPointContainer().getPointArray();
        const outPixels = outContainer.getPointArray();
        
        // 3. Separate Layers & Trace
        let paths: string[] = [];
        
        for (const color of paletteColors) {
            const r = color.r, g = color.g, b = color.b, a = color.a;
            if (a < 10) continue; // Skip transparent
            
            // Convert to Hex
            const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
            
            // Create mask buffer (RGB)
            const maskBuffer = Buffer.alloc(width * height * 3);
            
            let hasPixels = false;
            for (let i = 0; i < outPixels.length; i++) {
                const p = outPixels[i];
                // Check if this pixel maps to current color
                if (Math.abs(p.r - r) < 2 && Math.abs(p.g - g) < 2 && Math.abs(p.b - b) < 2) {
                    // Match: Black (for Potrace to trace)
                    maskBuffer[i * 3] = 0;
                    maskBuffer[i * 3 + 1] = 0;
                    maskBuffer[i * 3 + 2] = 0;
                    hasPixels = true;
                } else {
                    // No match: White
                    maskBuffer[i * 3] = 255;
                    maskBuffer[i * 3 + 1] = 255;
                    maskBuffer[i * 3 + 2] = 255;
                }
            }
            
            if (!hasPixels) continue;
            
            // Convert to PNG for Potrace
            const pngBuffer = await sharp(maskBuffer, { raw: { width, height, channels: 3 } })
                .toFormat('png')
                .toBuffer();
                
            // Trace
            try {
                const svgFragment = await trace(pngBuffer, hex);
                const pathMatch = svgFragment.match(/<path[^>]*>/);
                if (pathMatch) paths.push(pathMatch[0]);
            } catch (e) {
                console.error("Layer trace failed", e);
            }
        }
        
        const finalSvg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            ${paths.join('\n')}
        </svg>`;
        
        fs.unlink(req.file.path, () => {});
        res.json({ success: true, svg: finalSvg });

    } catch (err) {
        console.error(err);
        if (req.file) fs.unlink(req.file.path, () => {});
        res.status(500).json({ success: false, error: 'Color vectorization failed' });
    }
});

export default router;
