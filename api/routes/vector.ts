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
        
        // 1. Load image & Upscale for better tracing quality
        // Potrace produces smoother curves with higher resolution inputs.
        let imgPipeline = sharp(req.file.path).ensureAlpha();
        const metadata = await imgPipeline.metadata();
        
        // Upscale if smaller than 2000px width
        if (metadata.width && metadata.width < 2000) {
            imgPipeline = imgPipeline.resize({ width: 2000, kernel: 'lanczos3' });
        } else {
            // Even if large, resize to max 2500 to prevent OOM
            imgPipeline = imgPipeline.resize({ width: 2500, fit: 'inside' });
        }

        // Apply stronger median blur to remove noise/artifacts before quantization
        // This helps create solid color areas instead of pixel noise
        imgPipeline = imgPipeline.median(5);

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
                .blur(3) // Blur to smooth out pixel steps
                .threshold(128) // Cut back to binary (sharp clean edge)
                .toFormat('png')
                .toBuffer();
                
            // Trace
            try {
                // Params optimized for clean shapes (Logo style)
                const params = {
                    threshold: 128,
                    turdSize: 10, // Keep small details
                    optCurve: true,
                    optTolerance: 0.2, // Faithful tracing
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
