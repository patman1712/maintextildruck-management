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
        
        // Config:
        // PACKER_WIDTH (X) = Variable/Max. We want to minimize MAX X usage.
        // PACKER_HEIGHT (Y) = Fixed. We want to fill this tightly.
        
        // So we prefer rects with smallest X (Leftmost).
        // If same X, smallest Y (Topmost).
        
        this.freeRects.sort((a, b) => {
             if (Math.abs(a.x - b.x) > 1) return a.x - b.x; // Leftmost first
             return a.y - b.y; // Topmost first
        });

        // Find the first rect where it fits (First Fit)
        
        let bestRectIndex = -1;

        for (let i = 0; i < this.freeRects.length; i++) {
            const rect = this.freeRects[i];
            if (w <= rect.w && h <= rect.h) {
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
        // We want to fill columns (Y axis) first.
        // So when we place an item, we want to create a space BELOW it (same column) 
        // and a space to the RIGHT of it (next column).
        
        // If we split Horizontally:
        //   New Rect Right: x+w, y, free.w-w, h  <-- Restricted height strip to right
        //   New Rect Bottom: x, y+h, free.w, free.h-h <-- Full width strip at bottom
        
        // If we split Vertically:
        //   New Rect Right: x+w, y, free.w-w, free.h <-- Full height strip to right
        //   New Rect Bottom: x, y+h, w, free.h-h <-- Restricted width strip below
        
        // We want to fill Y first.
        // So we want the space BELOW the item to be available for next items in this "column".
        // The space BELOW is `Rect Bottom`.
        // In Vertical Split, `Rect Bottom` has width `w` (restricted).
        // This forces next item below to fit in width `w`.
        // This is good for "Column" packing of same-width items.
        
        // However, if next item is wider, it won't fit below.
        // But we want to fill Y first.
        
        // If we use Horizontal Split:
        // Rect Bottom spans full remaining width.
        // This is good for "Shelf" packing (Rows).
        
        // Since we treat Y as the Fixed Dimension (Height), and X as Variable (Length).
        // We are effectively packing into a Fixed-Height Strip.
        // We want to minimize X.
        
        // To minimize X, we should fill Y as much as possible at current X.
        // So we want to prioritize placing items in the "strip" defined by current X.
        // Vertical Split creates a "strip" below the item with width `w`.
        // And a "remainder" to the right.
        
        // Let's stick with Vertical Split (Option 2).
        // Rect Right is the "rest of the roll length".
        // Rect Bottom is the "rest of the column height".
        // We process Rect Bottom first?
        // Our sort order (Min X) will pick Rect Bottom (x, y+h) before Rect Right (x+w, y)
        // because x < x+w.
        // So we will try to fill below the item first.
        
        const usedRect = freeRect;
        this.freeRects.splice(index, 1); 
        
        // Vertical Split
        
        // Add Rect Bottom (Priority 1 for next placement due to X sort)
        if (usedRect.h > h) {
            this.freeRects.push({
                x: usedRect.x,
                y: usedRect.y + h,
                w: w, 
                h: usedRect.h - h
            });
        }
        
        // Add Rect Right
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

        let pages: Item[][] = [];
        let currentPageItems: Item[] = [];
        
        let packer = new GuillotinePacker(PACKER_WIDTH, PACKER_HEIGHT);
        let currentPageIndex = 0;

        for (const item of itemsToPack) {
            if (item.h > PACKER_HEIGHT) {
                console.warn("Item taller than fixed roll height (rollWidth), skipping");
                continue;
            }
            if (item.w > PACKER_WIDTH) {
                 console.warn("Item wider than max length (rollLength), skipping");
                 continue;
            }

            // Packer fit:
            // We want to pack Left-to-Right (X) but fill Top-to-Bottom (Y) first.
            // Our GuillotinePacker sorts freeRects by X (Leftmost).
            // This encourages filling the leftmost column (Y axis) first.
            
            let pos = packer.fit(item.w, item.h);
            
            if (!pos) {
                // Page full, start new page
                pages.push(currentPageItems);
                currentPageItems = [];
                currentPageIndex++;
                packer = new GuillotinePacker(PACKER_WIDTH, PACKER_HEIGHT);
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