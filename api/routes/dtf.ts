import { Router, type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs-extra';
import { PDFDocument, PDFPage, degrees, PDFOperator } from 'pdf-lib';
import potpack from 'potpack'; 
import { UPLOAD_DIR } from './upload.js';
import db from '../db.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';

const execFileAsync = promisify(execFile);

const router = Router();

interface DTFFileRequest {
    url: string;
    quantity: number;
    orderId?: string;
    name?: string;
    reference?: string;
}

interface DTFGenerateRequest {
    rollWidthMm: number;
    rollLengthMm: number; // 0 for auto/infinite
    paddingMm: number;
    files: DTFFileRequest[];
}

interface Item {
    w: number;
    h: number;
    sourceIndex: number;
    x?: number;
    y?: number;
    pageIndex?: number;
    rotated?: boolean; // New: Track if item was rotated
}

type JobFileMeta = {
    url: string;
    quantity: number;
    orderId?: string;
    name?: string;
    reference?: string;
};

const pointsToMm = (pt: number) => pt / 2.83465;

const deleteJobPdfs = async (urls: string[]) => {
    const deleted: string[] = [];
    const skipped: string[] = [];

    for (const u of urls) {
        const filename = path.basename(String(u || ''));
        if (!filename.startsWith('dtf-output-') || !filename.toLowerCase().endsWith('.pdf')) {
            if (filename) skipped.push(filename);
            continue;
        }

        const pdfPath = path.join(UPLOAD_DIR, filename);
        const thumbPath = path.join(UPLOAD_DIR, `${filename}_thumb.png`);
        const thumbLgPath = path.join(UPLOAD_DIR, `${filename}_thumb_lg.png`);

        try {
            if (await fs.pathExists(pdfPath)) await fs.remove(pdfPath);
            if (await fs.pathExists(thumbPath)) await fs.remove(thumbPath);
            if (await fs.pathExists(thumbLgPath)) await fs.remove(thumbLgPath);
            deleted.push(filename);
        } catch {
            skipped.push(filename);
        }
    }

    return { deleted, skipped };
};

router.get('/jobs', (req: Request, res: Response) => {
    try {
        const rows = db.prepare(`
            SELECT id, created_at, pdf_urls, order_ids_json, stats_json
            FROM dtf_jobs
            ORDER BY datetime(created_at) DESC
            LIMIT 500
        `).all() as any[];

        const data = rows.map(r => ({
            id: r.id,
            created_at: r.created_at,
            pdf_urls: r.pdf_urls ? JSON.parse(r.pdf_urls) : [],
            order_ids: r.order_ids_json ? JSON.parse(r.order_ids_json) : [],
            stats: r.stats_json ? JSON.parse(r.stats_json) : {}
        }));

        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/jobs/:id', (req: Request, res: Response) => {
    try {
        const row = db.prepare(`
            SELECT id, created_at, pdf_urls, roll_width_mm, roll_length_mm, padding_mm, files_json, pages_json, order_ids_json, stats_json
            FROM dtf_jobs
            WHERE id = ?
        `).get(req.params.id) as any;

        if (!row) return res.status(404).json({ success: false, error: 'Job not found' });

        res.json({
            success: true,
            data: {
                id: row.id,
                created_at: row.created_at,
                pdf_urls: row.pdf_urls ? JSON.parse(row.pdf_urls) : [],
                roll_width_mm: row.roll_width_mm,
                roll_length_mm: row.roll_length_mm,
                padding_mm: row.padding_mm,
                files: row.files_json ? JSON.parse(row.files_json) : [],
                pages: row.pages_json ? JSON.parse(row.pages_json) : [],
                order_ids: row.order_ids_json ? JSON.parse(row.order_ids_json) : [],
                stats: row.stats_json ? JSON.parse(row.stats_json) : {}
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/jobs/:id/purge-pdfs', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const row = db.prepare(`SELECT id, pdf_urls FROM dtf_jobs WHERE id = ?`).get(id) as any;
        if (!row) return res.status(404).json({ success: false, error: 'Job not found' });

        const urls: string[] = row.pdf_urls ? JSON.parse(row.pdf_urls) : [];
        const { deleted, skipped } = await deleteJobPdfs(urls);

        db.prepare(`UPDATE dtf_jobs SET pdf_urls = ? WHERE id = ?`).run(JSON.stringify([]), id);

        res.json({ success: true, deleted, skipped });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/jobs/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const row = db.prepare(`SELECT id, pdf_urls FROM dtf_jobs WHERE id = ?`).get(id) as any;
        if (!row) return res.status(404).json({ success: false, error: 'Job not found' });

        const urls: string[] = row.pdf_urls ? JSON.parse(row.pdf_urls) : [];
        const { deleted, skipped } = await deleteJobPdfs(urls);

        db.prepare(`DELETE FROM dtf_jobs WHERE id = ?`).run(id);
        res.json({ success: true, deleted, skipped });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/purge-orphan-pdfs', async (req: Request, res: Response) => {
    try {
        const rows = db.prepare(`SELECT pdf_urls FROM dtf_jobs`).all() as any[];
        const referenced = new Set<string>();
        for (const r of rows) {
            const urls: string[] = r.pdf_urls ? JSON.parse(r.pdf_urls) : [];
            for (const u of urls) {
                const filename = path.basename(String(u || ''));
                if (filename) referenced.add(filename);
                if (filename) referenced.add(`${filename}_thumb.png`);
                if (filename) referenced.add(`${filename}_thumb_lg.png`);
            }
        }

        const entries = await fs.readdir(UPLOAD_DIR);
        const deleted: string[] = [];

        for (const name of entries) {
            const isLegacy = name.startsWith('DTF_Job_');
            const isNew = name.startsWith('dtf-output-');
            if (!isNew && !isLegacy) continue;
            const lower = name.toLowerCase();
            const isDtfPdf = lower.endsWith('.pdf');
            const isDtfThumb = lower.endsWith('.pdf_thumb.png');
            if (!isDtfPdf && !isDtfThumb) continue;
            if (referenced.has(name)) continue;
            try {
                await fs.remove(path.join(UPLOAD_DIR, name));
                deleted.push(name);
            } catch {}
        }

        res.json({ success: true, deletedCount: deleted.length, deleted });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Simple Guillotine Bin Packing
// We maintain a list of free rectangles.
interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

class GuillotinePacker {
    width: number;
    height: number;
    freeRects: Rect[];

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.freeRects = [{ x: 0, y: 0, w: width, h: height }];
    }

    fit(w: number, h: number): { x: number, y: number, rotated: boolean } | null {
        // We want to maximize packing efficiency into a Fixed Height, Infinite Width strip.
        // Primary Goal: Minimize Total Width (Length).
        // Strategy: "Leftmost First"
        // We should always place the item in the leftmost available space that fits.
        // Among spaces with the same X, we can use "Best Short Side Fit" or "Bottom-most".
        
        let bestRectIndex = -1;
        let bestScore = Number.MAX_VALUE;
        let bestX = Number.MAX_VALUE;
        
        // Search all free rects
        for (let i = 0; i < this.freeRects.length; i++) {
            const rect = this.freeRects[i];
            
            // Check if fits
            if (w <= rect.w && h <= rect.h) {
                // We want strict Leftmost priority.
                // If this rect is significantly to the left of our current best, pick it.
                // "Significantly" = integer coordinates usually.
                
                if (rect.x < bestX) {
                    // Found a new leftmost candidate
                    bestX = rect.x;
                    bestRectIndex = i;
                    // Calculate score for tie-breaking later?
                    // For now, just take it.
                    // But if there are multiple rects at this X (stacked vertically), we want the best one.
                    
                    // Reset best score for this new X
                    const leftoverHoriz = Math.abs(rect.w - w);
                    const leftoverVert = Math.abs(rect.h - h);
                    bestScore = Math.min(leftoverHoriz, leftoverVert);
                    
                } else if (rect.x === bestX) {
                    // Same column. Pick the one that fits best (BSSF).
                    const leftoverHoriz = Math.abs(rect.w - w);
                    const leftoverVert = Math.abs(rect.h - h);
                    const score = Math.min(leftoverHoriz, leftoverVert);
                    
                    if (score < bestScore) {
                        bestScore = score;
                        bestRectIndex = i;
                    }
                }
            }
        }
        
        if (bestRectIndex !== -1) {
            const rect = this.freeRects[bestRectIndex];
            const fitX = rect.x;
            const fitY = rect.y;
            
            this.splitFreeRect(rect, bestRectIndex, w, h);
            return { x: fitX, y: fitY, rotated: false };
        }
        
        return null;
    }

    splitFreeRect(freeRect: Rect, index: number, w: number, h: number) {
        const usedRect = freeRect;
        this.freeRects.splice(index, 1); 
        
        // Revert to Vertical Split (Standard for Strip Packing)
        // This preserves the full height for the right-hand split, allowing new columns to be formed efficiently.
        // The previous "Horizontal Split" for wide items caused fragmentation of the right space, leading to more pages.
        
        // Vertical Split:
        // Bottom (Restricted Width): x, y+h, w, usedRect.h-h
        // Right (Full Height): x+w, y, usedRect.w-w, usedRect.h
        
        // Add Bottom first (so it's picked first by Left-sort if x is same)
        if (usedRect.h > h) {
            this.freeRects.push({
                x: usedRect.x,
                y: usedRect.y + h,
                w: w, 
                h: usedRect.h - h
            });
        }
        
        if (usedRect.w > w) {
            this.freeRects.push({
                x: usedRect.x + w,
                y: usedRect.y,
                w: usedRect.w - w, 
                h: usedRect.h
            });
        }
    }
}

router.post('/generate', async (req: Request, res: Response) => {
    try {
        const { rollWidthMm, rollLengthMm, paddingMm, files } = req.body as DTFGenerateRequest;

        if (!files || files.length === 0) {
            res.status(400).json({ success: false, error: 'Keine Dateien ausgewählt.' });
            return;
        }

        const normalizedRequests = new Map<string, JobFileMeta>();
        const invalid: any[] = [];
        for (const f of files) {
            const url = typeof f?.url === 'string' ? f.url.trim() : '';
            const qty = Number.parseInt(String((f as any)?.quantity ?? '0'), 10);
            if (!url) continue;
            if (!Number.isFinite(qty) || qty < 1) {
                invalid.push({ url, quantity: (f as any)?.quantity });
                continue;
            }
            const existing = normalizedRequests.get(url);
            if (existing) {
                existing.quantity += qty;
            } else {
                normalizedRequests.set(url, {
                    url,
                    quantity: qty,
                    orderId: typeof (f as any)?.orderId === 'string' ? (f as any).orderId : undefined,
                    name: typeof (f as any)?.name === 'string' ? (f as any).name : undefined,
                    reference: typeof (f as any)?.reference === 'string' ? (f as any).reference : undefined
                });
            }
        }

        if (invalid.length > 0) {
            res.status(400).json({ success: false, error: 'Ungültige Menge in Auswahl.', invalid });
            return;
        }

        const requestedFiles = Array.from(normalizedRequests.values());
        if (requestedFiles.length === 0) {
            res.status(400).json({ success: false, error: 'Keine gültigen Dateien ausgewählt.' });
            return;
        }

        // 1. Load all source PDFs and measure dimensions
        const sourceDocs: { 
            pdf: PDFDocument, 
            width: number, 
            height: number,
            originalUrl: string
        }[] = [];

        const paddingPoints = (paddingMm || 0) * 2.83465;
        
        // Final Interpretation based on "56cm hoch ... 8,5cm breit" where "56cm rollenbreite eingabe":
        // Input 1 (rollWidthMm) = PDF HEIGHT (Fixed).
        // Input 2 (rollLengthMm) = PDF WIDTH (Variable/Max).
        
        const pdfHeightFixedPoints = rollWidthMm * 2.83465; // Fixed Height
        const pdfMaxWidthPoints = rollLengthMm > 0 ? rollLengthMm * 2.83465 : Number.MAX_VALUE; // Max Width

        // Packer Config:
        // We pack into a strip of Fixed Height and Infinite/Max Width.
        // We want to minimize Width usage.
        
        const PACKER_HEIGHT = pdfHeightFixedPoints;
        const PACKER_WIDTH = pdfMaxWidthPoints === Number.MAX_VALUE ? 100000 : pdfMaxWidthPoints;

        const itemsToPack: Item[] = [];
        const missingFiles: any[] = [];
        const unsupportedFiles: any[] = [];

        for (const file of requestedFiles) {
            // ... (file loading same)
            const filename = path.basename(file.url);
            const filePath = path.join(UPLOAD_DIR, filename);

            if (!fs.existsSync(filePath)) {
                missingFiles.push({ url: file.url, filename });
                continue;
            }

            try {
                const fileBuffer = await fs.readFile(filePath);
                let width = 0;
                let height = 0;
                let pdfDoc: PDFDocument | null = null;

                if (filename.toLowerCase().endsWith('.pdf')) {
                    pdfDoc = await PDFDocument.load(fileBuffer);
                    const firstPage = pdfDoc.getPages()[0];
                    const { width: w, height: h } = firstPage.getSize();
                    width = w; 
                    height = h;
                } else if (filename.toLowerCase().endsWith('.png')) {
                    pdfDoc = await PDFDocument.create();
                    const image = await pdfDoc.embedPng(fileBuffer);
                    width = image.width;
                    height = image.height;
                    const page = pdfDoc.addPage([width, height]);
                    page.drawImage(image, { x: 0, y: 0, width, height });
                } else {
                    unsupportedFiles.push({ url: file.url, filename });
                    continue;
                }

                if (pdfDoc) {
                    const sourceIndex = sourceDocs.length;
                    sourceDocs.push({
                        pdf: pdfDoc,
                        width,
                        height,
                        originalUrl: file.url
                    });

                    for (let i = 0; i < file.quantity; i++) {
                        itemsToPack.push({
                            w: width + paddingPoints,
                            h: height + paddingPoints,
                            sourceIndex
                        });
                    }
                }
            } catch (err) {
                console.error(`Error processing file ${filename}:`, err);
                unsupportedFiles.push({ url: file.url, filename });
            }
        }

        if (missingFiles.length > 0 || unsupportedFiles.length > 0) {
            res.status(400).json({
                success: false,
                error: 'Mindestens eine Datei konnte nicht verarbeitet werden. Bitte prüfen und erneut generieren.',
                missingFiles,
                unsupportedFiles
            });
            return;
        }

        if (itemsToPack.length === 0) {
            res.status(400).json({ success: false, error: 'Keine gültigen Dateien verarbeitet.' });
            return;
        }

        // 2. Perform Bin Packing (Guillotine)
        // Config: 
        // Container Height = Fixed (User RollWidth)
        // Container Width = Variable (User RollLength)
        
        // We want to fill Y (Height) first (Columns), then X (Width).
        // Sorting items?
        // To fill Height efficiently, sorting by Height Descending is good.
        // Or Width Descending?
        // Let's use Height Descending to fit tall items first into the fixed height strip.
        itemsToPack.sort((a, b) => b.h - a.h);

        // OPTIMIZATION: Try to pack as tightly as possible to minimize total width.
        // The current packer (Guillotine Best Short Side Fit) does a good job, 
        // but sorting by height descending might leave gaps if we have many small items.
        // We can try to sort by Area Descending or Max Side Descending?
        // Actually, Height Descending is best for Fixed Height strip packing (FFDH level).
        // BSSF handles the rest.
        
        // To further optimize length (width usage):
        // We can try multiple sort orders and pick the best one?
        // Sort orders: Height Descending, Width Descending, Area Descending.
        
        const sortStrategies = [
            (a: Item, b: Item) => b.h - a.h, // Height Desc
            (a: Item, b: Item) => b.w - a.w, // Width Desc
            (a: Item, b: Item) => (b.w * b.h) - (a.w * a.h), // Area Desc
            (a: Item, b: Item) => Math.max(b.w, b.h) - Math.max(a.w, a.h) // Max Side Desc
        ];
        
        let bestPages: Item[][] | null = null;
        let minTotalWidth = Number.MAX_VALUE;
        
        // Clone items for simulation
        const originalItems = [...itemsToPack];
        
        for (const strategy of sortStrategies) {
            const currentItems = [...originalItems].sort(strategy);
            
            const currentPackers: { packer: GuillotinePacker, items: Item[] }[] = [
                { packer: new GuillotinePacker(PACKER_WIDTH, PACKER_HEIGHT), items: [] }
            ];
            
            let allFit = true;
            
            // Simulation loop
            // We need to clone items again because fit modifies x, y, etc.
            const simItems = currentItems.map(i => ({...i}));
            
            for (const item of simItems) {
                if (item.h > PACKER_HEIGHT || item.w > PACKER_WIDTH) {
                    continue; // Should have been caught before
                }
                
                let pos = null;
                let placedPackerIndex = -1;
                
                // Try to fit in existing pages first (First Fit)
                for (let i = 0; i < currentPackers.length; i++) {
                    pos = currentPackers[i].packer.fit(item.w, item.h);
                    if (pos) {
                        placedPackerIndex = i;
                        break;
                    }
                }
                
                // If it doesn't fit in any existing page, create a new one
                if (!pos) {
                    const newPacker = new GuillotinePacker(PACKER_WIDTH, PACKER_HEIGHT);
                    pos = newPacker.fit(item.w, item.h);
                    if (pos) {
                        currentPackers.push({ packer: newPacker, items: [] });
                        placedPackerIndex = currentPackers.length - 1;
                    }
                }
                
                if (pos && placedPackerIndex !== -1) {
                    item.x = pos.x;
                    item.y = pos.y;
                    item.rotated = pos.rotated;
                    item.pageIndex = placedPackerIndex;
                    currentPackers[placedPackerIndex].items.push(item);
                } else {
                    allFit = false;
                    break; 
                }
            }
            
            if (allFit) {
                const currentPages = currentPackers.map(p => p.items).filter(items => items.length > 0);
                
                // Calculate total width used across all pages
                let totalWidth = 0;
                for (const p of currentPages) {
                    const maxX = p.reduce((max, i) => Math.max(max, (i.x || 0) + i.w), 0);
                    totalWidth += maxX;
                }
                
                // PRIORITIZE FEWER PAGES FIRST
                // If current result has FEWER pages than best result, take it.
                // If same pages, check total width.
                
                const currentPagesCount = currentPages.length;
                const bestPagesCount = bestPages ? bestPages.length : Number.MAX_VALUE;
                
                if (currentPagesCount < bestPagesCount) {
                    minTotalWidth = totalWidth;
                    bestPages = currentPages;
                } else if (currentPagesCount === bestPagesCount) {
                    if (totalWidth < minTotalWidth) {
                        minTotalWidth = totalWidth;
                        bestPages = currentPages;
                    }
                }
            }
        }
        
        // Use best result
        let pages = bestPages || [];
        
        // Fallback if simulation failed (shouldn't happen)
        if (!bestPages) {
             // ... original logic ...
             itemsToPack.sort((a, b) => b.h - a.h);
             // ... (rest of original packing logic) ...
             // But let's just assume one strategy worked.
             // If not, we just run the default height desc.
             
             const fallbackPackers: { packer: GuillotinePacker, items: Item[] }[] = [
                 { packer: new GuillotinePacker(PACKER_WIDTH, PACKER_HEIGHT), items: [] }
             ];
             
             for (const item of itemsToPack) {
                 // ... check bounds ...
                 if (item.h > PACKER_HEIGHT || item.w > PACKER_WIDTH) continue;

                 let pos = null;
                 let placedPackerIndex = -1;
                 
                 for (let i = 0; i < fallbackPackers.length; i++) {
                     pos = fallbackPackers[i].packer.fit(item.w, item.h);
                     if (pos) {
                         placedPackerIndex = i;
                         break;
                     }
                 }
                 
                 if (!pos) {
                     const newPacker = new GuillotinePacker(PACKER_WIDTH, PACKER_HEIGHT);
                     pos = newPacker.fit(item.w, item.h);
                     if (pos) {
                         fallbackPackers.push({ packer: newPacker, items: [] });
                         placedPackerIndex = fallbackPackers.length - 1;
                     }
                 }
                 
                 if (pos && placedPackerIndex !== -1) {
                     item.x = pos.x;
                     item.y = pos.y;
                     item.rotated = pos.rotated;
                     item.pageIndex = placedPackerIndex;
                     fallbackPackers[placedPackerIndex].items.push(item);
                 }
             }
             
             pages = fallbackPackers.map(p => p.items).filter(items => items.length > 0);
        }

        // 3. Create Output PDFs (One per page)
        const generatedUrls: string[] = [];
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const jobId = crypto.randomUUID();
        const jobPages: any[] = [];
        const countsPlaced: Record<string, number> = {};

        const generateThumbnail = async (pdfPath: string, outputFilename: string, scaleTo: number, suffix: string) => {
            const thumbRoot = path.join(UPLOAD_DIR, `${outputFilename}${suffix}`);
            try {
                await execFileAsync('pdftocairo', [
                    '-png',
                    '-singlefile',
                    '-scale-to', String(scaleTo),
                    '-transp',
                    pdfPath,
                    thumbRoot
                ]);
                return;
            } catch {}

            try {
                await execFileAsync('pdftoppm', [
                    '-png',
                    '-singlefile',
                    '-scale-to', String(scaleTo),
                    pdfPath,
                    thumbRoot
                ]);
            } catch (e) {
                console.error('Failed to generate thumbnail for output PDF:', e);
            }
        };
        
        for (let pIdx = 0; pIdx < pages.length; pIdx++) {
            const pageItems = pages[pIdx];
            if (!pageItems || pageItems.length === 0) continue;
            
            const outputPdf = await PDFDocument.create();
            
            outputPdf.setTitle(`DTF Print Job - Part ${pIdx + 1}`);
            outputPdf.setSubject('Nesting Output');
            outputPdf.setProducer('MainTextildruck Manager');
            outputPdf.setCreator('MainTextildruck Manager');
            
            // Determine Page Dimensions
            // Height = Fixed (User RollWidth)
            // Width = Used Width (Max X + W)
            
            const maxX = pageItems.reduce((max, item) => Math.max(max, (item.x || 0) + item.w), 0);
            const pageWidth = maxX; 
            const pageHeight = pdfHeightFixedPoints;

            const page = outputPdf.addPage([pageWidth, pageHeight]);
            const placements: any[] = [];
            
            for (const item of pageItems) {
                if (item.sourceIndex === undefined || item.x === undefined || item.y === undefined) continue;
                
                const source = sourceDocs[item.sourceIndex];
                
                // Embed page
                const [embeddedPage] = await outputPdf.embedPages(source.pdf.getPages().slice(0, 1));
                
                // Position:
                // PDF Origin is Bottom-Left.
                // Packer Origin is Top-Left (0,0).
                
                // x = item.x
                // y = pageHeight - item.y - item.h
                
                const drawX = item.x + (paddingPoints / 2);
                const drawY = pageHeight - item.y - item.h + (paddingPoints / 2);
                
                if (item.rotated) {
                    // Should not happen anymore as rotation is disabled in packer
                    page.drawPage(embeddedPage, {
                        x: drawX,
                        y: drawY,
                        width: source.width,
                        height: source.height
                    });
                } else {
                    page.drawPage(embeddedPage, {
                        x: drawX,
                        y: drawY,
                        width: source.width,
                        height: source.height
                    });
                }

                countsPlaced[source.originalUrl] = (countsPlaced[source.originalUrl] || 0) + 1;
                const reqMeta = normalizedRequests.get(source.originalUrl);
                placements.push({
                    url: source.originalUrl,
                    name: reqMeta?.name,
                    orderId: reqMeta?.orderId,
                    reference: reqMeta?.reference,
                    x_mm: pointsToMm(drawX),
                    y_mm: pointsToMm(drawY),
                    w_mm: pointsToMm(source.width),
                    h_mm: pointsToMm(source.height)
                });
            }
            
            const pdfBytes = await outputPdf.save();
            // If multiple pages, append suffix. If only one, keep standard name (or also append suffix for consistency?)
            // Let's append suffix if > 1 page or always?
            // User requested "mehrere pdfs ausgeben".
            
            let outputFilename = `DTF_Job_${timestamp}.pdf`;
            if (pages.length > 1) {
                outputFilename = `DTF_Job_${timestamp}_Part${pIdx + 1}.pdf`;
            }
            
            const outputPath = path.join(UPLOAD_DIR, outputFilename);
            await fs.writeFile(outputPath, pdfBytes);
            
            generatedUrls.push(`/uploads/${outputFilename}`);
            
            await generateThumbnail(outputPath, outputFilename, 300, '_thumb');
            await generateThumbnail(outputPath, outputFilename, 1100, '_thumb_lg');

            const usedArea = pageItems.reduce((sum, i) => sum + (i.w * i.h), 0);
            const sheetArea = pageWidth * pageHeight;
            jobPages.push({
                index: pIdx,
                pdf_url: `/uploads/${outputFilename}`,
                width_mm: pointsToMm(pageWidth),
                height_mm: pointsToMm(pageHeight),
                utilization: sheetArea > 0 ? (usedArea / sheetArea) : 0,
                placements
            });
        }

        const mismatch: any[] = [];
        for (const req of requestedFiles) {
            const placed = countsPlaced[req.url] || 0;
            if (placed !== req.quantity) mismatch.push({ url: req.url, requested: req.quantity, placed });
        }
        if (mismatch.length > 0) {
            res.status(500).json({ success: false, error: 'Interner Prüf-Fehler: Mengen stimmen nicht mit Layout überein.', mismatch });
            return;
        }

        const orderIds = Array.from(new Set(requestedFiles.map(f => f.orderId).filter(Boolean)));
        const totalPieces = requestedFiles.reduce((sum, f) => sum + f.quantity, 0);
        const stats = {
            pages: jobPages.length,
            uniqueFiles: requestedFiles.length,
            totalPieces,
            utilization: jobPages.length > 0 ? jobPages.reduce((sum, p) => sum + (p.utilization || 0), 0) / jobPages.length : 0
        };

        db.prepare(`
            INSERT INTO dtf_jobs (id, pdf_urls, roll_width_mm, roll_length_mm, padding_mm, files_json, pages_json, order_ids_json, stats_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            jobId,
            JSON.stringify(generatedUrls),
            rollWidthMm,
            rollLengthMm,
            paddingMm,
            JSON.stringify(requestedFiles),
            JSON.stringify(jobPages),
            JSON.stringify(orderIds),
            JSON.stringify(stats)
        );

        res.json({
            success: true,
            url: generatedUrls[0], // Backward compatibility
            urls: generatedUrls,   // New field for multiple files
            pages: pages.length,
            jobId,
            stats
        });

    } catch (error) {
        console.error('DTF Generation Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

export default router;
