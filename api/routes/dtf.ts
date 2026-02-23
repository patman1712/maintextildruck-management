import { Router, type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs-extra';
import { PDFDocument, PDFPage, degrees } from 'pdf-lib';
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

        // Flatten quantity: if qty=3, add 3 items to the packing list
        // Add padding to dimensions for packing
        // Convert mm to points: 1 mm = 2.83465 points
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

        // 2. Perform Bin Packing
        let currentPageIndex = 0;
        let shelves: { y: number, height: number, freeWidth: number, items: Item[] }[] = [];
        let columns: { x: number, width: number, freeHeight: number, items: Item[] }[] = [];
        
        // Helper to find shelf (Row-based packing)
        const placeItemRowFirst = (item: Item) => {
            // Try to fit in existing shelves on current page
            for (const shelf of shelves) {
                if (item.w <= shelf.freeWidth) {
                    item.x = rollWidthPoints - shelf.freeWidth; 
                    item.y = shelf.y;
                    item.pageIndex = currentPageIndex;
                    
                    shelf.freeWidth -= item.w;
                    shelf.items.push(item);
                    return true;
                }
            }
            
            // New shelf needed
            const shelfHeight = item.h;
            
            // Check if shelf fits on page
            // Calculate current max Y used by shelves
            const currentMaxY = shelves.length > 0 ? shelves[shelves.length - 1].y + shelves[shelves.length - 1].height : 0;
            
            if (currentMaxY + shelfHeight > maxPageHeightPoints) {
                currentPageIndex++;
                shelves = [];
            }
            
            const startY = shelves.length > 0 ? shelves[shelves.length - 1].y + shelves[shelves.length - 1].height : 0;
            
            const newShelf = {
                y: startY,
                height: shelfHeight,
                freeWidth: rollWidthPoints - item.w,
                items: [item]
            };
            
            item.x = 0;
            item.y = startY;
            item.pageIndex = currentPageIndex;
            
            shelves.push(newShelf);
            return true;
        };

        // Helper to find column (Column-based packing, fill height first)
        const placeItemColumnFirst = (item: Item) => {
            // New logic:
            // "rollenbreite soll die datei nach unten sein, rollenlänge nach rechts."
            // "breite soll immer genau so sein wie die angeben sind" (FIXED)
            // "länge soll so sein das die maximal breite eingehalten wird" (VARIABLE)
            
            // Interpretation:
            // The User considers "Breite" as the Vertical axis (Y) ?
            // And "Länge" as the Horizontal axis (X) ?
            
            // "wird weniger gebraucht. gibt man die datei schmaler aus."
            // This usually refers to the Roll Length (Variable).
            
            // Let's stick to:
            // rollWidthMm = Fixed Constraint (Vertical Y?)
            // rollLengthMm = Max Constraint (Horizontal X?) or Auto.
            
            // If User wants "Breite nach unten" (Width is Height) and "Länge nach rechts" (Length is Width).
            // Then we are creating a PDF where:
            // PDF Height = rollWidthMm
            // PDF Width = rollLengthMm (or auto)
            
            // AND "erst in der höhe anzuordnen dann in der breite"
            // Means fill Y (Height/Breite) first, then X (Width/Länge).
            
            // This is actually Column Packing where Column Height is Fixed (rollWidthMm).
            // And we add columns to the right (X axis).
            
            // So:
            // Page Height = rollWidthPoints (FIXED)
            // Page Width = Grows (up to rollLengthPoints max)
            
            // Let's re-implement `placeItemColumnFirst` to reflect this "Rotated" view if needed.
            // BUT usually printers expect Roll Width as the Width of the PDF page.
            // If the user rotates the view, that's one thing.
            // But if the user says "Breite nach unten", they might mean the roll unrolls vertically.
            
            // Let's assume standard roll printing again but check "erst in der höhe".
            // If standard: Width (X) is fixed. Height (Y) grows.
            // "erst in der höhe" -> Fill Y first? That means one column, then next column?
            // Yes, that creates columns.
            // But if X is fixed, we can only have limited columns.
            
            // Let's try to implement exactly what was asked:
            // "rollenbreite soll die datei nach unten sein" -> PDF Height = rollWidth
            // "rollenlänge nach rechts" -> PDF Width = rollLength (or variable)
            
            // So we are swapping dimensions for the internal logic?
            // Let's try to just swap the input parameters interpretation?
            
            // NO, let's keep PDF Width = Roll Width.
            // But maybe user wants to fill the SHEET differently?
            
            // "probiere die logos wenn möglich erst in der höhe anzuordnen dann in der breite"
            // This strongly suggests Column-Major order.
            // Fill Column 1 (top to bottom), then Column 2, etc.
            // This is what I implemented in `placeItemColumnFirst`.
            
            // The confusion is "Breite nach unten".
            // Maybe they mean "Width is the vertical dimension".
            // If so, the PDF should be:
            // Width = Variable/Max Length
            // Height = Fixed Roll Width
            
            // Let's Ask or Assume?
            // "die breite soll immer genau so sein wie die angeben sind." (The width must be exactly as specified).
            // Usually Roll Width is fixed hardware constraint.
            // So PDF Width MUST match Roll Width.
            
            // So: PDF Width = rollWidthMm.
            // "die länge soll so sein das die maximal breite eingehalten wird" (Length should be such that max width is kept??)
            // This sentence is confusing: "max width kept" might mean "max length kept"?
            // "wird weniger gebraucht. gibt man die datei schmaler aus." (If less is used, output file narrower).
            // "Schmaler" usually refers to Width.
            // So if less Length is used, the file should be shorter?
            
            // Conclusion:
            // PDF Width = rollWidthMm (Fixed).
            // PDF Height = Auto (up to rollLengthMm).
            // Packing: Fill Columns (Y) first?
            // If I fill Y first in a fixed width page:
            // I place item at 0,0. Next item at 0, h1. Next at 0, h1+h2.
            // Until column full (Height limit?).
            // But Height is Auto/Infinite in roll mode?
            // Then I would just have one long column?
            // That is inefficient if items are narrow.
            
            // Maybe user wants:
            // Fill vertically (Y) up to rollLengthMm (Limit).
            // Then move to next Column (X).
            // This implies rollLengthMm is NOT the continuous direction, but the Fixed Sheet Height?
            // And rollWidthMm is the direction we expand in?
            
            // "rollenbreite soll die datei nach unten sein" -> Height = Width?
            // "rollenlänge nach rechts" -> Width = Length?
            
            // Let's Assume:
            // User wants a Landscape PDF.
            // Height = Fixed Roll Width (55cm).
            // Width = Variable (Length).
            // Packing: Fill Y (Height/Width) first. Then X.
            
            // Let's swap the dimensions for the PDF creation logic?
            // PDF Width = Variable (grows to right).
            // PDF Height = Fixed (Roll Width).
            
            // Let's adjust the variables.
            const PAGE_HEIGHT_FIXED = rollWidthPoints;
            const PAGE_WIDTH_MAX = rollLengthMm > 0 ? rollLengthMm * 2.83465 : 14400; // ~5m max width
            
            // Try to fit in existing columns on current page
            // Columns are now vertical strips filling the PAGE_HEIGHT_FIXED.
            // Actually, if we fill Y first, we fill the Fixed Height.
            
             for (const col of columns) {
                if (item.h <= col.freeHeight) {
                    item.x = col.x;
                    const usedHeight = PAGE_HEIGHT_FIXED - col.freeHeight;
                    item.y = usedHeight; // Top-down
                    item.pageIndex = currentPageIndex;
                    
                    col.freeHeight -= item.h;
                    col.items.push(item);
                    return true;
                }
            }
            
            // New column needed
            // Check if fits in Max Width
            const currentMaxX = columns.length > 0 ? columns[columns.length - 1].x + columns[columns.length - 1].width : 0;
            
            if (currentMaxX + item.w > PAGE_WIDTH_MAX) {
                // Page full (width-wise)
                currentPageIndex++;
                columns = [];
            }
            
            const startX = columns.length > 0 ? columns[columns.length - 1].x + columns[columns.length - 1].width : 0;
            
            const newCol = {
                x: startX,
                width: item.w,
                freeHeight: PAGE_HEIGHT_FIXED - item.h,
                items: [item]
            };
            
            item.x = startX;
            item.y = 0;
            item.pageIndex = currentPageIndex;
            
            columns.push(newCol);
            return true;
        };

        if (rollLengthMm > 0) {
            // FIXED SHEET MODE (User Request: Roll Width = Height, Roll Length = Width)
            // PDF will be Landscape-ish: Height is Fixed (RollWidth), Width Grows (up to RollLength)
            
            // Sort by HEIGHT descending to fill columns (Y axis, which is Roll Width) efficiently
            itemsToPack.sort((a, b) => b.h - a.h);
            
            for (const item of itemsToPack) {
                // Check if item fits in the Fixed Height (Roll Width)
                if (item.h > rollWidthPoints) {
                    console.warn("Item taller than roll width (fixed height), skipping or rotate?");
                    // Ideally rotate here.
                    continue;
                }
                placeItemColumnFirst(item);
            }
        } else {
            // ROLL MODE (Infinite length): Use Row-First Packing (Shelf)
            // Standard Portrait: Width is Fixed (RollWidth), Height Grows
            // Sort by HEIGHT descending to minimize vertical waste
            itemsToPack.sort((a, b) => b.h - a.h);
            
            for (const item of itemsToPack) {
                if (item.w > rollWidthPoints) {
                    console.warn("Item wider than roll width, skipping");
                    continue;
                }
                placeItemRowFirst(item);
            }
        }

        // Group by page index
        const pages: Item[][] = [];
        itemsToPack.forEach(item => {
            if (item.pageIndex === undefined) return;
            if (!pages[item.pageIndex]) pages[item.pageIndex] = [];
            pages[item.pageIndex].push(item);
        });

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
            
            let pageWidth = 0;
            let pageHeight = 0;
            
            if (rollLengthMm > 0) {
                 // Landscape Mode
                 // Height = Fixed Roll Width
                 // Width = Used Width (up to Roll Length)
                 
                 const maxX = pageItems.reduce((max, item) => Math.max(max, (item.x || 0) + item.w), 0);
                 pageWidth = maxX; // "wird weniger gebraucht. gibt man die datei schmaler aus."
                 pageHeight = rollWidthPoints;
            } else {
                 // Portrait Mode
                 // Width = Fixed Roll Width
                 // Height = Used Height
                 const maxY = pageItems.reduce((max, item) => Math.max(max, (item.y || 0) + item.h), 0);
                 pageWidth = rollWidthPoints;
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
                
                // If Landscape Mode (Length > 0):
                // x = item.x
                // y = pageHeight (Fixed RollWidth) - item.y - item.h
                
                // If Portrait Mode:
                // x = item.x
                // y = pageHeight (Variable) - item.y - item.h
                
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