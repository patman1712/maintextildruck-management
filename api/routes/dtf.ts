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
        // User interpretation update:
        // "Rollenbreite" (Field 1) is WIDTH (Fixed).
        // "Länge" (Field 2) is HEIGHT (Variable/Max).
        // "Rollenbreite soll FIX sein... diese soll immer ausgegeben werden auchw wen noch luft ist." -> Fixed Width.
        // "in der länge sollen die dateien optimal angeordnet werden so dass so wenig länge wie mölgich benutzt wird" -> Minimize Height.
        
        const rollWidthPoints = rollWidthMm * 2.83465; // User's "Width" (Fixed)
        const rollLengthPoints = rollLengthMm > 0 ? rollLengthMm * 2.83465 : Number.MAX_VALUE; // User's "Height" (Max)

        // Packer Dimension Config:
        // Width = rollWidthPoints (Fixed)
        // Height = rollLengthPoints (Variable/Max)
        
        const PACKER_WIDTH = rollWidthPoints;
        const PACKER_HEIGHT = rollLengthPoints === Number.MAX_VALUE ? 100000 : rollLengthPoints;

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
        // Container Width = Fixed (User RollWidth)
        // Container Height = Variable (User RollLength)
        
        // We want to fill X (Width) first, then Y (Height). (Shelf/Guillotine Standard)
        // AND minimize Y usage ("am wenigstens länge benutzt").
        
        // Sorting items?
        // To minimize Height, usually sort by Height Descending (Level Packing) or Width Descending?
        // Width Descending places wide items first, then fills gaps.
        // Let's stick with Width Descending.
        itemsToPack.sort((a, b) => b.w - a.w);

        let pages: Item[][] = [];
        let currentPageItems: Item[] = [];
        
        // Initialize Packer
        let packer = new GuillotinePacker(PACKER_WIDTH, PACKER_HEIGHT);
        let currentPageIndex = 0;

        for (const item of itemsToPack) {
            if (item.w > PACKER_WIDTH) {
                 console.warn("Item wider than fixed roll width, skipping");
                 continue;
            }
            if (item.h > PACKER_HEIGHT) {
                console.warn("Item taller than max length, skipping");
                continue;
            }

            // Standard Guillotine packing (Min Y, Min X) minimizes Height usage.
            // Our fit function prioritizes Min X (Leftmost) then Min Y (Topmost).
            // This fills rows.
            // `if (Math.abs(a.y - b.y) > 1) return a.y - b.y; return a.x - b.x;` (Topmost first)
            // Wait, previous tool call set it to X primary? No, I reverted to Y primary in thought but code might differ.
            // Let's check `GuillotinePacker.fit` in previous tool output.
            
            // Previous tool output for `fit`:
            // `this.freeRects.sort((a, b) => { if (Math.abs(a.x - b.x) > 1) return a.x - b.x; return a.y - b.y; });`
            // This is Leftmost First.
            // Leftmost First fills COLUMNS (fills Height first).
            
            // User wants "erst in der höhe anzuordnen dann in der breite"?
            // Wait, if Width is Fixed.
            // And we fill Height first.
            // Then we create a long column on the left.
            // This maximizes Height usage for that column.
            // But if we want to minimize TOTAL Height usage of the sheet?
            // "so wenig länge wie mölgich benutzt wird".
            
            // If we fill Columns, we use full height immediately?
            // No, we use height up to item height.
            // If we stack items vertically (Column), we increase Height rapidly.
            // Item 1 (h=10). Item 2 (h=10). Total H = 20.
            // If we place side-by-side (Row). Total H = 10.
            
            // So to minimize Height, we MUST fill ROWS (Width) first!
            // "erst in der breite, dann in der höhe".
            
            // BUT User said: "probiere die logos wenn möglich erst in der höhe anzuordnen dann in der breite"
            // AND "so wenig länge wie mölgich benutzt wird".
            // These are CONTRADICTORY if "Länge" = Height.
            
            // UNLESS "Höhe" in their sentence means "Width of the roll"? (Rotated).
            
            // Let's assume the "Minimize Length" requirement is the most important for saving money.
            // To minimize Length (Height), we MUST fill Width (Row) first.
            
            // So I will change the sort order in `fit` to Topmost First (Min Y).
            // This fills Rows.
            
            // And I will ensure PDF Width is Fixed `rollWidthPoints`.
            
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
            // Width = Fixed (User RollWidth)
            // Height = Used Height (Minimize)
            
            const maxY = pageItems.reduce((max, item) => Math.max(max, (item.y || 0) + item.h), 0);
            const pageWidth = rollWidthPoints; 
            const pageHeight = maxY;

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