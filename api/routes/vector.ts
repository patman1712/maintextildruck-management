import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import potrace from 'potrace';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { buildPalette, applyPalette, utils } from "image-q";

const router = Router();
const upload = multer({ dest: 'uploads/' });

// Helper: Cleanup temp files older than 12 hours
const cleanupTempFiles = () => {
    const tempDir = path.resolve('uploads');
    fs.readdir(tempDir, (err, files) => {
        if (err) return; // Directory might not exist or other error
        const now = Date.now();
        const maxAge = 12 * 60 * 60 * 1000; // 12 hours

        files.forEach(file => {
            const filePath = path.join(tempDir, file);
            fs.stat(filePath, (err, stats) => {
                if (err) return;
                if (now - stats.mtimeMs > maxAge) {
                    fs.unlink(filePath, (err) => {
                        if (err) console.error('Failed to delete temp file:', filePath);
                    });
                }
            });
        });
    });
};

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
  cleanupTempFiles();
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
    cleanupTempFiles();
    if (!req.file) return res.status(400).json({ success: false, error: 'No file' });

    try {
        const maxColors = parseInt(req.body.colors as string) || 8;
        const detailLevel = parseInt(req.body.detail as string) || 80;
        const isComic = req.body.comic === 'true';
        
        // Map detail to params
        // Detail 100 = Min Noise Removal, Max Precision
        // Detail 0 = Max Noise Removal, Max Smoothing
        const turdSize = Math.max(2, Math.round((100 - detailLevel) * 2)); // 100->2, 50->100, 0->200
        const optTolerance = 0.1 + ((100 - detailLevel) / 100) * 0.4; // 100->0.1, 0->0.5
        const blurAmount = Math.max(0.3, (100 - detailLevel) / 25); // 100->0.3, 0->4
        
        // 1. Load image & Upscale
        let imgPipeline = sharp(req.file.path).ensureAlpha();
        const metadata = await imgPipeline.metadata();
        
        if (metadata.width && metadata.width < 2000) {
            imgPipeline = imgPipeline.resize({ width: 2000, kernel: 'lanczos3' });
        } else {
            imgPipeline = imgPipeline.resize({ width: 2500, fit: 'inside' });
        }

        // Pre-blur (Despeckle)
        imgPipeline = imgPipeline.median(Math.ceil(blurAmount));

        const { data, info } = await imgPipeline
            .raw()
            .toBuffer({ resolveWithObject: true });

        const width = info.width;
        const height = info.height;

        // 2. Quantize
        // Use fewer colors for cleaner look if not specified
        const targetColors = maxColors > 16 ? 16 : maxColors;
        
        const pointContainer = utils.PointContainer.fromUint8Array(data, width, height);
        const palette = await buildPalette([pointContainer], { colors: targetColors });
        const outContainer = await applyPalette(pointContainer, palette);
        
        // Get unique palette colors used
        const paletteColors = palette.getPointContainer().getPointArray();
        const outPixels = outContainer.getPointArray();
        
        // 3. Separate Layers & Trace
        let paths: string[] = [];

        // Create buffers for each palette color (initialized to White)
        const layers = paletteColors.map(c => ({
            r: c.r, g: c.g, b: c.b, a: c.a,
            buffer: Buffer.alloc(width * height * 3).fill(255),
            hasPixels: false
        }));

        // Assign every pixel to exactly one layer (closest color)
        for (let i = 0; i < outPixels.length; i++) {
            const p = outPixels[i];
            
            let minIdx = 0;
            let minDiff = Infinity;

            for (let j = 0; j < layers.length; j++) {
                const l = layers[j];
                const diff = Math.abs(p.r - l.r) + Math.abs(p.g - l.g) + Math.abs(p.b - l.b);
                if (diff < minDiff) {
                    minDiff = diff;
                    minIdx = j;
                }
            }

            // Mark pixel as Black (0) in the chosen layer
            const offset = i * 3;
            layers[minIdx].buffer[offset] = 0;
            layers[minIdx].buffer[offset + 1] = 0;
            layers[minIdx].buffer[offset + 2] = 0;
            layers[minIdx].hasPixels = true;
        }
        
        // Trace each layer
        for (const layer of layers) {
            if (!layer.hasPixels) continue;
            if (layer.a < 50) continue; // Skip transparent
            
            const hex = '#' + ((1 << 24) + (layer.r << 16) + (layer.g << 8) + layer.b).toString(16).slice(1).toUpperCase();
            
            // Convert to PNG for Potrace
            // Apply BLUR + THRESHOLD to smooth jagged quantization edges
            const pngBuffer = await sharp(layer.buffer, { raw: { width, height, channels: 3 } })
                .toColorspace('b-w') // Grayscale
                .blur(Math.max(1, blurAmount)) // Dynamic blur based on detail level
                .threshold(128) // Cut back to binary (sharp clean edge)
                .toFormat('png')
                .toBuffer();
                
            // Trace
            try {
                // Params optimized for clean shapes (Logo style)
                const params = {
                    threshold: 128,
                    turdSize: turdSize, // Dynamic despeckle
                    optCurve: true,
                    optTolerance: optTolerance, // Dynamic smoothing
                    alphaMax: 1.0, 
                    blackOnWhite: true,
                    color: hex,
                    background: 'transparent'
                };
                
                // Use custom trace helper that accepts params
                const svgFragment = await new Promise<string>((resolve, reject) => {
                    potrace.trace(pngBuffer, params, (err: any, svg: string) => {
                        if (err) reject(err);
                        else resolve(svg);
                    });
                });

                const pathMatch = svgFragment.match(/<path[^>]*>/);
                if (pathMatch) paths.push(pathMatch[0]);
            } catch (e) {
                console.error("Layer trace failed", e);
            }
        }
        
        // If Comic Mode, add crisp black lines on top
        if (isComic) {
            try {
                // Generate Ink Layer (Thresholded Black Lines)
                // Must match dimensions of color layers exactly!
                const inkBuffer = await sharp(req.file.path)
                    .resize({ width: width, height: height, fit: 'fill' }) 
                    .grayscale()
                    .threshold(90) // Cutoff for black lines
                    .toFormat('png')
                    .toBuffer();
                
                // Trace Ink (Black)
                const params = {
                    threshold: 128,
                    turdSize: 2, // Keep tiny dots (stippling)
                    optCurve: true,
                    optTolerance: 0.1, // Super precise
                    alphaMax: 1.0,
                    blackOnWhite: true,
                    color: '#000000',
                    background: 'transparent'
                };
                
                const svgFragment = await new Promise<string>((resolve, reject) => {
                    potrace.trace(inkBuffer, params, (err: any, svg: string) => {
                        if (err) reject(err);
                        else resolve(svg);
                    });
                });

                const pathMatch = svgFragment.match(/<path[^>]*>/);
                if (pathMatch) paths.push(pathMatch[0]);
            } catch (e) {
                console.error("Ink layer failed", e);
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
