import { Router, type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs-extra';
import { PDFDocument, PDFPage, degrees, PDFOperator } from 'pdf-lib';
import potpack from 'potpack'; 
import { UPLOAD_DIR } from './upload.js';
import { DATA_DIR } from '../db.js';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const router = Router();

interface DTFFileRequest {
    url: string;
    quantity: number;
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
        // We want to fill Y (Height) first (Column packing).
        // So we want to preserve vertical space for next items in this column.
        
        // Vertical Split:
        // Rect Right: x+w, y, free.w-w, free.h (Tall strip to right)
        // Rect Bottom: x, y+h, w, free.h-h (Rest of column below)
        
        // If we use Vertical Split, we create a specific slot below (width w).
        // This forces next item below to be width <= w.
        // If next item is wider, it must go to Rect Right.
        
        // Horizontal Split:
        // Rect Right: x+w, y, free.w-w, h (Short strip to right)
        // Rect Bottom: x, y+h, free.w, free.h-h (Wide strip below)
        
        // If we use Horizontal Split, Rect Bottom is wide.
        // Next item can be wider than current item and still fit below.
        // This is better for "Shelf" packing where we fill a shelf of height h.
        
        // But here height is fixed (56cm). We are filling "Columns".
        // Actually, we are filling the "Sheet".
        
        // If we want to pack tight, we should use "Shorter Axis Split" (SAS) rule?
        // Or "Maximize Area" rule?
        
        // Given the user wants "durcheinander" and "optimal":
        // Let's use the standard Guillotine Split Rule:
        // Split along the axis that minimizes the shorter side of the leftover rectangles?
        // Or "Split Horizontally" if w < h?
        
        // Let's use a dynamic split:
        // If free.w < free.h, split horizontally?
        
        // Let's try minimizing the "waste" aspect.
        // Actually, for fixed height strip packing, keeping the "bottom" rect available as wide as possible is often good?
        // No, we want to fill the "left" side.
        
        // Let's stick to Vertical Split (creates Rect Bottom restricted to w).
        // This is standard for Column packing.
        // BUT: User complained about gaps.
        // Gaps appear if `w` is small, and we can't fit anything in `Rect Bottom`.
        // Then `Rect Bottom` is wasted.
        
        // Maybe we should allow items to be placed in `Rect Right` even if `Rect Bottom` is empty?
        // Yes, the packer does that.
        
        // What if we try `Horizontal Split`?
        // Rect Bottom is full width.
        // If we place Item 1 (top-left). Rect Bottom is (0, h, W, H-h).
        // Next item can be placed at (0, h).
        // This effectively fills Top-to-Bottom.
        // This creates "Shelves" defined by item height? No, just fills Y.
        
        // Let's try Horizontal Split.
        // It allows wider items to be placed below narrow items.
        // This might reduce gaps!
        
        const usedRect = freeRect;
        this.freeRects.splice(index, 1); 
        
        // Horizontal Split strategy
        // Rect 1 (Bottom): x, y + h, free.w, free.h - h
        // Rect 2 (Right): x + w, y, free.w - w, h
        
        // Add Bottom first (so it's picked first by Left-sort if x is same)
        if (usedRect.h > h) {
            this.freeRects.push({
                x: usedRect.x,
                y: usedRect.y + h,
                w: usedRect.w, // Full remaining width
                h: usedRect.h - h
            });
        }
        
        // Add Right
        if (usedRect.w > w) {
            this.freeRects.push({
                x: usedRect.x + w,
                y: usedRect.y,
                w: usedRect.w - w,
                h: h // Restricted height
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

        for (const file of files) {
            // ... (file loading same)
            const filename = path.basename(file.url);
            const filePath = path.join(UPLOAD_DIR, filename);

            if (!fs.existsSync(filePath)) {
                console.warn(`File not found: ${filePath}`);
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
                    console.warn(`Unsupported file type: ${filename}`);
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
            }
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
            
            const currentPages: Item[][] = [];
            let currentPageItems: Item[] = [];
            let currentPacker = new GuillotinePacker(PACKER_WIDTH, PACKER_HEIGHT);
            let pageIdx = 0;
            
            let allFit = true;
            
            // Simulation loop
            // We need to clone items again because fit modifies x, y, etc.
            const simItems = currentItems.map(i => ({...i}));
            
            for (const item of simItems) {
                if (item.h > PACKER_HEIGHT || item.w > PACKER_WIDTH) {
                    continue; // Should have been caught before
                }
                
                let pos = currentPacker.fit(item.w, item.h);
                
                if (!pos) {
                    currentPages.push(currentPageItems);
                    currentPageItems = [];
                    pageIdx++;
                    currentPacker = new GuillotinePacker(PACKER_WIDTH, PACKER_HEIGHT);
                    pos = currentPacker.fit(item.w, item.h);
                }
                
                if (pos) {
                    item.x = pos.x;
                    item.y = pos.y;
                    item.rotated = pos.rotated;
                    item.pageIndex = pageIdx;
                    currentPageItems.push(item);
                } else {
                    allFit = false;
                    break; 
                }
            }
            
            if (allFit) {
                if (currentPageItems.length > 0) {
                    currentPages.push(currentPageItems);
                }
                
                // Calculate total width used across all pages (sum of max X on each page? Or just max X of last page if 1 page?)
                // Actually we want to minimize the max X used on the last page (length of roll).
                // Assuming we want to fit everything on ONE page (infinite width).
                // If multiple pages are generated (because PACKER_WIDTH was hit?), we sum widths?
                // PACKER_WIDTH is effectively infinite. So usually 1 page.
                
                let totalWidth = 0;
                for (const p of currentPages) {
                    const maxX = p.reduce((max, i) => Math.max(max, (i.x || 0) + i.w), 0);
                    totalWidth += maxX;
                }
                
                if (totalWidth < minTotalWidth) {
                    minTotalWidth = totalWidth;
                    bestPages = currentPages;
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
             
             pages = [];
             let currentPageItems: Item[] = [];
             let packer = new GuillotinePacker(PACKER_WIDTH, PACKER_HEIGHT);
             let currentPageIndex = 0;
             
             for (const item of itemsToPack) {
                 // ... check bounds ...
                 if (item.h > PACKER_HEIGHT || item.w > PACKER_WIDTH) continue;

                 let pos = packer.fit(item.w, item.h);
                 if (!pos) {
                     pages.push(currentPageItems);
                     currentPageItems = [];
                     currentPageIndex++;
                     packer = new GuillotinePacker(PACKER_WIDTH, PACKER_HEIGHT);
                     pos = packer.fit(item.w, item.h);
                 }
                 if (pos) {
                     item.x = pos.x;
                     item.y = pos.y;
                     item.rotated = pos.rotated;
                     item.pageIndex = currentPageIndex;
                     currentPageItems.push(item);
                 }
             }
             if (currentPageItems.length > 0) pages.push(currentPageItems);
        }

        // 3. Create Output PDF
        const outputPdf = await PDFDocument.create();
        
        outputPdf.setTitle('DTF Print Job');
        outputPdf.setSubject('Nesting Output');
        outputPdf.setProducer('MainTextildruck Manager');
        outputPdf.setCreator('MainTextildruck Manager');

        for (let pIdx = 0; pIdx < pages.length; pIdx++) {
            const pageItems = pages[pIdx];
            if (!pageItems || pageItems.length === 0) continue;
            
            // Determine Page Dimensions
            // Height = Fixed (User RollWidth)
            // Width = Used Width (Max X + W)
            
            const maxX = pageItems.reduce((max, item) => Math.max(max, (item.x || 0) + item.w), 0);
            const pageWidth = maxX; 
            const pageHeight = pdfHeightFixedPoints;

            const page = outputPdf.addPage([pageWidth, pageHeight]);
            
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
            }
        }

        const pdfBytes = await outputPdf.save();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFilename = `DTF_Job_${timestamp}.pdf`;
        const outputPath = path.join(UPLOAD_DIR, outputFilename);

        await fs.writeFile(outputPath, pdfBytes);

        // Generate Thumbnail for the output PDF
        try {
            // pdftoppm with -singlefile appends .png to the output root name
            const thumbRoot = path.join(UPLOAD_DIR, `${outputFilename}_thumb`);
            
            await execFileAsync('pdftoppm', [
                '-png',
                '-singlefile',
                '-scale-to', '300',
                outputPath,
                thumbRoot
            ]);
        } catch (e) {
            console.error('Failed to generate thumbnail for output PDF:', e);
        }

        res.json({
            success: true,
            url: `/uploads/${outputFilename}`,
            pages: pages.length
        });

    } catch (error) {
        console.error('DTF Generation Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

export default router;