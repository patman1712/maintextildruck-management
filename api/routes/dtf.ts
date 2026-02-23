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

        // Helper to find column (Column-based packing)
        const placeItemColumnFirst = (item: Item) => {
            // Try to fit in existing columns on current page
            for (const col of columns) {
                if (item.h <= col.freeHeight) {
                    item.x = col.x;
                    item.y = maxPageHeightPoints - col.freeHeight; // Top-down filling within column?
                    // Actually, y should be relative to page top.
                    // Let's say y starts at 0.
                    // col.freeHeight starts at maxPageHeightPoints.
                    // usedHeight = maxPageHeightPoints - col.freeHeight.
                    // item.y = usedHeight.
                    
                    const usedHeight = maxPageHeightPoints - col.freeHeight;
                    item.y = usedHeight;
                    item.pageIndex = currentPageIndex;
                    
                    col.freeHeight -= item.h;
                    col.items.push(item);
                    return true;
                }
            }
            
            // New column needed
            const colWidth = item.w;
            
            // Check if column fits on page width
            const currentMaxX = columns.length > 0 ? columns[columns.length - 1].x + columns[columns.length - 1].width : 0;
            
            if (currentMaxX + colWidth > rollWidthPoints) {
                currentPageIndex++;
                columns = [];
            }
            
            const startX = columns.length > 0 ? columns[columns.length - 1].x + columns[columns.length - 1].width : 0;
            
            const newCol = {
                x: startX,
                width: colWidth,
                freeHeight: maxPageHeightPoints - item.h,
                items: [item]
            };
            
            item.x = startX;
            item.y = 0;
            item.pageIndex = currentPageIndex;
            
            columns.push(newCol);
            return true;
        };

        if (rollLengthMm > 0) {
            // FIXED SHEET MODE: Use Column-First Packing (fill height first)
            // Sort by WIDTH descending to pack columns efficiently
            itemsToPack.sort((a, b) => b.w - a.w);
            
            for (const item of itemsToPack) {
                if (item.h > maxPageHeightPoints) {
                    console.warn("Item taller than page height, skipping");
                    continue;
                }
                placeItemColumnFirst(item);
            }
        } else {
            // ROLL MODE (Infinite length): Use Row-First Packing (Shelf)
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
            
            // Determine page height
            // If explicit roll length set, use it. Otherwise use used height.
            let pageHeight = maxPageHeightPoints;
            if (rollLengthMm === 0) {
                // Find max Y + H
                const maxY = pageItems.reduce((max, item) => Math.max(max, (item.y || 0) + item.h), 0);
                pageHeight = maxY;
            }

            const page = outputPdf.addPage([rollWidthPoints, pageHeight]);
            
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
                // Add half padding offset because item.w/h includes padding
                
                const drawX = item.x + (paddingPoints / 2);
                const drawY = pageHeight - item.y - item.h + (paddingPoints / 2);
                
                // Draw
                // Note: embeddedPage might need scaling if source width/height differs from what we measured?
                // We measured source.width/height earlier.
                
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