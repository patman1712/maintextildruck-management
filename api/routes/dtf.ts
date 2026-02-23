import { Router, type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs-extra';
import { PDFDocument, PDFPage, degrees } from 'pdf-lib';
import potpack from 'potpack'; // We will use potpack for better nesting if possible, or implement a Shelf/Guillotine
import { UPLOAD_DIR } from './upload.js';
import { DATA_DIR } from '../db.js';

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

    fit(w: number, h: number): { x: number, y: number } | null {
        // Find best free rect
        // Best Short Side Fit (BSSF) usually performs better for packing density than Best Area Fit
        // BSSF: Minimize min(free.w - w, free.h - h)
        // Or Best Long Side Fit (BLSF)
        
        // Let's use a heuristic:
        // Try to place the item such that it leaves the most usable space.
        
        // We want to minimize Roll Width usage?
        // User said: "am wenigstens rollenbreite benutzt wird".
        // This means we want to pack tight to the left? Or tight to the top?
        // If Roll Width is the X axis (55cm), and Length is Y axis (infinite or 56cm).
        // If we want to minimize Roll Width usage (X), we should pack tight to X=0?
        // Wait, Roll Width is fixed 55cm. We can't "use less" of it unless we cut the paper.
        // Usually "use less roll width" means "use less roll LENGTH" (Y axis)?
        // "eben war hätte man noch 2-3 cm sparen können" -> implied height/length savings.
        
        // If we want to save Length (Y), we should pack as tight as possible in Y.
        // We should pick the spot with smallest Y first.
        
        // Sort free rects by Y primary, X secondary.
        this.freeRects.sort((a, b) => {
             if (Math.abs(a.y - b.y) > 1) return a.y - b.y; // Topmost first
             return a.x - b.x; // Leftmost first
        });

        // Find the first rect where it fits (First Fit with Top-Left preference)
        // Or find Best Fit?
        // Best Area Fit tends to be robust.
        
        let bestRectIndex = -1;
        let bestScore = Number.MAX_VALUE;

        for (let i = 0; i < this.freeRects.length; i++) {
            const rect = this.freeRects[i];
            if (w <= rect.w && h <= rect.h) {
                // Score: Minimize Y?
                // Or minimize wasted area in this rect?
                // BSSF (Best Short Side Fit)
                const leftoverHoriz = Math.abs(rect.w - w);
                const leftoverVert = Math.abs(rect.h - h);
                const shortSide = Math.min(leftoverHoriz, leftoverVert);
                
                // If we want to pack tight to top (min Y), we should penalize high Y.
                // But `this.freeRects` is already sorted by Y.
                // So the first one we find is the topmost available.
                // Let's just take the first one that fits (First Fit).
                // First Fit on Y-sorted list is extremely effective for minimizing height.
                
                bestRectIndex = i;
                break;
            }
        }

        if (bestRectIndex !== -1) {
            const rect = this.freeRects[bestRectIndex];
            const fitX = rect.x;
            const fitY = rect.y;
            this.splitFreeRect(rect, bestRectIndex, w, h);
            return { x: fitX, y: fitY };
        }
        
        return null;
    }

    splitFreeRect(freeRect: Rect, index: number, w: number, h: number) {
        // Guillotine Split strategy affects packing quality.
        // Split Horizontally (cut across Width) or Vertically (cut across Height)?
        // If we split Horizontally:
        //   New Rect Right: x+w, y, free.w-w, h
        //   New Rect Bottom: x, y+h, free.w, free.h-h
        //   -> This creates a full-width strip at the bottom. Good for minimizing height?
        
        // If we split Vertically:
        //   New Rect Right: x+w, y, free.w-w, free.h
        //   New Rect Bottom: x, y+h, w, free.h-h
        //   -> This creates a full-height strip on the right.
        
        // To minimize Height (Length) usage:
        // We want to fill the current Y-level as much as possible before moving down.
        // So we prefer to leave space to the RIGHT of the item available for others.
        // So we should perform a Vertical Split? (Create a tall strip on right).
        // Or Horizontal Split? (Create a strip on right restricted to item height).
        
        // "Shorter Axis Split" rule (SAS) often works well.
        // Split along the shorter axis of the leftover space.
        
        const wRem = freeRect.w - w;
        const hRem = freeRect.h - h;
        
        let splitHorizontal = false;
        
        // Heuristic:
        // If we want to fill rows (minimize height), we prefer creating free space to the RIGHT.
        // Horizontal Split creates: Rect Right (Height = Item Height). Rect Bottom (Width = Free Width).
        // Vertical Split creates: Rect Right (Height = Free Height). Rect Bottom (Width = Item Width).
        
        // If we Vertical Split, we create a large free rect on the right (x+w, y, free.w-w, free.h).
        // This large rect allows placing another tall item next to current item.
        // This is good for filling width.
        
        // If we Horizontal Split, we create a rect on right (x+w, y, free.w-w, h).
        // This forces next item to be same height or shorter to fit there.
        // But we have a huge bottom rect.
        
        // Let's use Vertical Split to prioritize filling the row width.
        // Unless remaining width is tiny.
        
        // Let's try "Minimize area of placed item" heuristic? No.
        
        // Let's stick to Vertical Split (Option 2 from before) but refine the sort order in `fit`.
        // Vertical split maximizes the rectangle to the right, encouraging placement there.
        
        const usedRect = freeRect;
        this.freeRects.splice(index, 1); 
        
        // Vertical Split (Option 2)
        // Rect 1 (Right): x + w, y, free.w - w, free.h
        // Rect 2 (Bottom): x, y + h, w, free.h - h
        
        if (usedRect.w > w) {
            this.freeRects.push({
                x: usedRect.x + w,
                y: usedRect.y,
                w: usedRect.w - w,
                h: usedRect.h
            });
        }
        
        if (usedRect.h > h) {
            this.freeRects.push({
                x: usedRect.x,
                y: usedRect.y + h,
                w: w, 
                h: usedRect.h - h
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
        const rollWidthPoints = rollWidthMm * 2.83465;
        const maxPageHeightPoints = rollLengthMm > 0 ? rollLengthMm * 2.83465 : 14400; // ~5 meters if 0

        const itemsToPack: Item[] = [];

        for (const file of files) {
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
        // Sort items: Widest First usually works best for Strip Packing to minimize gaps?
        // Or Largest Area?
        // User said: "schau mal bei den 3 logos neben der 17 ist viel platz"
        // This implies small items should fill gaps.
        // Sorting by Height Descending is good for "Level" packing.
        // Sorting by Width Descending is good for filling width.
        // Let's try Width Descending to place big items first, then small items fill gaps.
        itemsToPack.sort((a, b) => b.w - a.w);

        let pages: Item[][] = [];
        let currentPageItems: Item[] = [];
        let packer = new GuillotinePacker(rollWidthPoints, maxPageHeightPoints);
        let currentPageIndex = 0;

        for (const item of itemsToPack) {
            if (item.w > rollWidthPoints) {
                console.warn("Item wider than roll width, skipping");
                continue;
            }
            if (item.h > maxPageHeightPoints) {
                console.warn("Item taller than page height, skipping");
                continue;
            }

            let pos = packer.fit(item.w, item.h);
            
            if (!pos) {
                // Page full, start new page
                pages.push(currentPageItems);
                currentPageItems = [];
                currentPageIndex++;
                packer = new GuillotinePacker(rollWidthPoints, maxPageHeightPoints);
                pos = packer.fit(item.w, item.h);
            }

            if (pos) {
                item.x = pos.x;
                item.y = pos.y;
                item.pageIndex = currentPageIndex;
                currentPageItems.push(item);
            } else {
                console.error("Item could not fit even in new page!", item);
            }
        }
        
        if (currentPageItems.length > 0) {
            pages.push(currentPageItems);
        }

        // 3. Create Output PDF
        const outputPdf = await PDFDocument.create();
        
        // Set metadata
        outputPdf.setTitle('DTF Print Job');
        outputPdf.setSubject('Nesting Output');
        outputPdf.setProducer('MainTextildruck Manager');
        outputPdf.setCreator('MainTextildruck Manager');

        for (let pIdx = 0; pIdx < pages.length; pIdx++) {
            const pageItems = pages[pIdx];
            if (!pageItems || pageItems.length === 0) continue;
            
            let pageWidth = rollWidthPoints;
            let pageHeight = 0;
            
            if (rollLengthMm > 0) {
                 // FIXED SHEET MODE (Portrait)
                 // Height is FIXED to Max Length as requested ("auch 56cm höhe")
                 pageHeight = maxPageHeightPoints;
            } else {
                 // ROLL MODE
                 // Height = Used Height
                 const maxY = pageItems.reduce((max, item) => Math.max(max, (item.y || 0) + item.h), 0);
                 pageHeight = maxY;
            }

            const page = outputPdf.addPage([pageWidth, pageHeight]);
            
            for (const item of pageItems) {
                if (item.sourceIndex === undefined || item.x === undefined || item.y === undefined) continue;
                
                const source = sourceDocs[item.sourceIndex];
                
                // Embed page
                const [embeddedPage] = await outputPdf.embedPages(source.pdf.getPages().slice(0, 1));
                
                // Calculate position
                // PDF coordinate system: (0,0) is bottom-left.
                // Our packing (0,0) is top-left.
                
                // x = item.x
                // y = pageHeight - item.y - item.h
                
                const drawX = item.x + (paddingPoints / 2);
                const drawY = pageHeight - item.y - item.h + (paddingPoints / 2);
                
                page.drawPage(embeddedPage, {
                    x: drawX,
                    y: drawY,
                    width: source.width,
                    height: source.height
                });
            }
        }

        const pdfBytes = await outputPdf.save();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFilename = `DTF_Job_${timestamp}.pdf`;
        const outputPath = path.join(UPLOAD_DIR, outputFilename);
        
        await fs.writeFile(outputPath, pdfBytes);

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