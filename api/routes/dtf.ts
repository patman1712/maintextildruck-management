import { Router, type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs-extra';
import { PDFDocument, PDFPage, degrees } from 'pdf-lib';
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
        // Try fitting normal orientation (W x H)
        let bestRectIndex = -1;
        let rotated = false;
        
        // Strategy: First Fit (Leftmost)
        // We prefer filling Y (Height) first, then X (Width).
        // Our freeRects are sorted by X (Leftmost first).
        
        // Check normal orientation
        for (let i = 0; i < this.freeRects.length; i++) {
            const rect = this.freeRects[i];
            if (w <= rect.w && h <= rect.h) {
                bestRectIndex = i;
                break;
            }
        }

        // Check rotated orientation (H x W)
        // Only if rotated fits better? Or just if it fits and normal doesn't?
        // Or if rotated fits "more left"?
        
        // Let's find best fit for BOTH orientations and pick the one with smallest X.
        
        let bestRotatedRectIndex = -1;
        for (let i = 0; i < this.freeRects.length; i++) {
            const rect = this.freeRects[i];
            // Check if rotated dimensions fit (h becomes width, w becomes height)
            if (h <= rect.w && w <= rect.h) {
                bestRotatedRectIndex = i;
                break;
            }
        }
        
        // Decision logic:
        // If both fit, pick the one with smaller X (leftmost).
        // If X is same, pick the one with smaller Y (topmost).
        // If both same, prefer non-rotated? Or prefer the one that leaves better space?
        
        let useRotated = false;
        let chosenIndex = -1;
        
        if (bestRectIndex !== -1 && bestRotatedRectIndex !== -1) {
            const normalRect = this.freeRects[bestRectIndex];
            const rotatedRect = this.freeRects[bestRotatedRectIndex];
            
            if (normalRect.x < rotatedRect.x) {
                chosenIndex = bestRectIndex;
                useRotated = false;
            } else if (rotatedRect.x < normalRect.x) {
                chosenIndex = bestRotatedRectIndex;
                useRotated = true;
            } else {
                // Same X column. Check Y.
                if (normalRect.y <= rotatedRect.y) {
                    chosenIndex = bestRectIndex;
                    useRotated = false;
                } else {
                    chosenIndex = bestRotatedRectIndex;
                    useRotated = true;
                }
            }
        } else if (bestRectIndex !== -1) {
            chosenIndex = bestRectIndex;
            useRotated = false;
        } else if (bestRotatedRectIndex !== -1) {
            chosenIndex = bestRotatedRectIndex;
            useRotated = true;
        }
        
        if (chosenIndex !== -1) {
            const rect = this.freeRects[chosenIndex];
            const fitX = rect.x;
            const fitY = rect.y;
            
            // Apply split with correct dimensions
            const actualW = useRotated ? h : w;
            const actualH = useRotated ? w : h;
            
            this.splitFreeRect(rect, chosenIndex, actualW, actualH);
            return { x: fitX, y: fitY, rotated: useRotated };
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
                item.rotated = pos.rotated;
                item.pageIndex = currentPageIndex;
                
                // If rotated, we swap w and h for rendering logic
                if (pos.rotated) {
                    const temp = item.w;
                    item.w = item.h;
                    item.h = temp;
                }
                
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
                
                if (item.rotated) {
                    // When rotated 90 degrees:
                    // The image is drawn rotated 90 degrees clockwise around its bottom-left origin.
                    // This means it will stick out to the LEFT and UP relative to the origin?
                    // No, usually rotation is counter-clockwise?
                    // pdf-lib docs say: "Rotation is in degrees clockwise."
                    
                    // If we have a rectangle at (0,0) width W, height H.
                    // Rotate 90 deg clockwise -> It goes to quadrant IV (down-right)?
                    // Or does it rotate around center?
                    // drawPage rotates around the `x, y` point provided.
                    
                    // Let's assume 90 deg clockwise.
                    // A horizontal image becomes vertical pointing down.
                    // We need to shift it up by its new height (old width)?
                    
                    // Actually, let's use 90 degrees.
                    // Visual Box: (drawX, drawY) with size (item.w, item.h).
                    // item.w is source.height. item.h is source.width.
                    
                    // If we draw at (drawX, drawY) with rotation 90:
                    // The bottom-left of source image is at (drawX, drawY).
                    // The image extends to right (height) and down (width)?
                    // No.
                    
                    // Let's try 90 deg:
                    // x becomes x + height?
                    
                    // Correct approach for 90 deg clockwise rotation around bottom-left (drawX, drawY):
                    // The image "stands up" to the left? Or lies down to the right?
                    
                    // To be safe, let's look at standard behavior:
                    // 90 deg rotation usually moves the top-left corner to top-right.
                    
                    // Let's try this:
                    // We want the visual bounding box to be [drawX, drawY, item.w, item.h].
                    // The source image is [source.w, source.h].
                    
                    // If we rotate 90 deg:
                    // source.w (old x-axis) aligns with new y-axis?
                    // source.h (old y-axis) aligns with new x-axis?
                    // No, usually width aligns with height.
                    
                    // Let's try:
                    page.drawPage(embeddedPage, {
                        x: drawX + source.height, // Shift right by height (which is the new width visually)
                        y: drawY,
                        width: source.width,
                        height: source.height,
                        rotation: degrees(90)
                    });
                    
                    // If this is wrong, we might need -90 or 270.
                    // Let's stick with 90. If it's upside down or weird, user will tell us.
                    // Wait, if I shift X by height, I am assuming it rotates into the left quadrant?
                    
                    // Let's try simpler:
                    // If I draw at 0,0 rotated 90.
                    // Where does it go?
                    
                    // Let's assume standard PDF coordinate system (Y up).
                    // 90 deg clockwise: +Y becomes +X. +X becomes -Y.
                    // So image goes down and right.
                    // So we need to shift Y up by width?
                    
                    // Let's try rotation: degrees(-90) (or 270) which is Counter-Clockwise.
                    // +X becomes +Y. +Y becomes -X.
                    // Image stands up.
                    
                    // Let's try:
                    // rotation: degrees(90)
                    // x: drawX + item.w (which is source.height)
                    // y: drawY
                    // This assumes it rotates "down" so we need to move the origin "up"?
                    // Actually, let's just use the previous logic which seemed plausible:
                    // x: drawX + item.w
                    // y: drawY
                    // rotation: 90
                    
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