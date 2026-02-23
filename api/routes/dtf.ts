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
            // New logic v2:
            // User says "genau falsch rum" (exactly wrong way around).
            // Previous attempt: Height = Fixed Roll Width, Width = Variable.
            // If that is "wrong way around", then:
            // Width = Fixed Roll Width (as standard).
            // Height = Variable (up to Roll Length).
            
            // "die breite soll immer genau so sein wie die angeben sind" (Width must be exactly as specified).
            // User Input "Breite" (e.g. 55cm).
            // User Input "Länge" (e.g. 100cm).
            
            // So: PDF Width = 55cm (Fixed).
            // PDF Height = 100cm (Max) or less if not used.
            
            // "rollenbreite soll die datei nach unten sein" -> This confused me.
            // Maybe "nach unten" means the vertical dimension on the screen/paper?
            // If "Breite" is "nach unten", then Width is Height?
            // But if I did that and it was "wrong", then "Breite" is Width!
            
            // So let's go back to Standard:
            // PDF Width = Roll Width (Fixed).
            // PDF Height = Variable (up to Max Length).
            
            // Packing Logic:
            // "probiere die logos wenn möglich erst in der höhe anzuordnen dann in der breite"
            // Fill Y axis first?
            // In a fixed width page, filling Y first means creating columns.
            // Column 1 fills top-to-bottom. Then Column 2 starts to the right.
            
            // This requires the page height to be known/fixed?
            // "die länge soll so sein das die maximal breite eingehalten wird" (Length should be such that max width is kept??)
            // This sentence is still cryptic.
            // Maybe: "The Length (Height of PDF) should be minimized?"
            // "wird weniger gebraucht. gibt man die datei schmaler aus." -> "Schmaler" = Narrower (Width) or Shorter (Height)?
            // Usually "Schmal" = Width. "Kurz" = Height.
            // If "Schmaler" means Width, then the Width is variable?
            
            // Let's try the other interpretation of "Falsch rum":
            // Maybe they want:
            // PDF Width = Variable (up to 55cm).
            // PDF Height = Fixed (100cm).
            
            // But "Rollenbreite" usually implies the fixed hardware constraint.
            // A printer has a 60cm roll. You cannot print wider.
            // So one dimension MUST be fixed to 55cm.
            
            // If my previous "Landscape" attempt (Height=55, Width=Variable) was wrong.
            // Then it must be "Portrait" (Width=55, Height=Variable).
            
            // So let's revert to Portrait Mode logic but with Column Filling?
            // If Width is Fixed (55cm) and Height is Variable (up to 100cm).
            // And we want to fill Y first ("erst in der höhe").
            // We fill down to 100cm. Then start new column at right?
            // If we start new column at right, we consume Width.
            // Width is fixed 55cm.
            // So we fill columns within the 55cm width.
            
            // This is exactly what `placeItemColumnFirst` does if we set:
            // Page Height = 100cm (Fixed Limit).
            // Page Width = 55cm (Fixed Limit).
            
            // But wait, "wird weniger gebraucht. gibt man die datei schmaler aus."
            // If we use less space, make it smaller.
            // If we fill columns (Y), we use full Height (100cm) first?
            // Then we use Width?
            // If we only need 1 column of 10cm width, the PDF should be 10cm wide?
            // But 100cm high?
            
            // Or does "erst in der höhe" mean:
            // Stack items vertically (Row 1, Row 2...) -> This is standard "Shelf" / Row packing.
            // Shelf packing fills X (Width) first!
            // Item 1 at 0,0. Item 2 at w1, 0.
            // When row full, go to Y+h.
            
            // If User wants "Vertical" packing:
            // Item 1 at 0,0. Item 2 at 0, h1.
            // When column full (Height limit), go to X+w.
            
            // This requires a Height Limit.
            // User Input "Länge" (e.g. 100cm) IS the Height Limit.
            
            // So:
            // PDF Width = 55cm (Max/Fixed).
            // PDF Height = 100cm (Max).
            // Packing: Column First (Fill Y).
            // Output Size:
            // If we only use 30cm Width, should PDF be 30cm wide? Yes ("schmaler ausgeben").
            // If we only use 50cm Height, should PDF be 50cm high?
            // "die breite soll immer genau so sein wie die angeben sind" -> Width MUST be 55cm?
            // If Width must be 55cm, then "schmaler" makes no sense unless they mean Height?
            
            // Let's assume:
            // Rollenbreite (55cm) = PDF WIDTH. Fixed? Or Max?
            // User says "Breite soll immer genau so sein". -> Fixed 55cm Width.
            // User says "wird weniger gebraucht. gibt man die datei schmaler aus." -> This contradicts "Fixed".
            // Unless "Breite" in their mind is the other dimension (Height)?
            
            // Let's look at "die datei dann immer genau falsch rum an".
            // If I produced a Landscape PDF (W=Variable, H=55) and it was wrong.
            // Then they want a Portrait PDF (W=55, H=Variable).
            
            // "die datei hat auch nicht die fixe höhe von 55 die ich eingeben habe".
            // I produced H=55.
            // If they say "it didn't have the fixed height of 55", maybe they checked the Width?
            // Or maybe my previous code produced H=Auto because of a bug?
            // In my previous code: `pageHeight = rollWidthPoints;` (Fixed).
            // So it should have been 55cm high.
            
            // If they say "hat nicht die fixe höhe", maybe they mean it SHOULD have been 55cm WIDE?
            // And they call 55cm "Height"? ("Rollenbreite soll die Datei nach unten sein" -> Width extends downwards?)
            
            // Let's try the Portrait orientation again (W=55, H=Auto).
            // But maybe "Rollenbreite" (55) is meant to be the Height?
            // If I produced H=55 and they say it's wrong, maybe they wanted W=55.
            
            // Let's go with the most standard print logic:
            // Roll Width = PDF Width.
            // Roll Length = PDF Height.
            
            // User input:
            // Breite: 55.
            // Länge: 100.
            
            // My Proposal:
            // PDF Width = 55cm.
            // PDF Height = Variable (up to 100cm).
            // Packing: Fill Y (Height) first (Columns).
            
            // Wait, "Breite soll immer genau so sein".
            // So PDF Width = 55cm Fixed.
            // "wird weniger gebraucht, gibt man die datei schmaler aus".
            // If Width is fixed 55cm, it cannot be narrower.
            // So "Schmaler" MUST refer to Height (Length).
            
            // So:
            // PDF Width = 55cm (Fixed).
            // PDF Height = Minimized (Auto).
            // Packing: If "erst in der höhe", we fill columns.
            // Item 1 (0,0). Item 2 (0, h1).
            // This fills Height quickly.
            // This makes the file Long/Tall.
            // If we want to minimize Height, we should fill Rows (Shelf) first?
            // Item 1 (0,0). Item 2 (w1, 0).
            // This fills Width. Keeps Height small.
            
            // User said: "probiere die logos wenn möglich erst in der höhe anzuordnen dann in der breite"
            // This explicitly requests Column Filling.
            // Why? Maybe to optimize cutting or material usage on a roll that is 55cm wide?
            // If I fill Y first, I get a long strip on the left side of the 55cm roll.
            // The rest of the 55cm width is empty.
            // If I cut that strip, I save the rest of the roll width?
            // Yes, that makes sense for expensive foil.
            
            // So:
            // PDF Width = 55cm (Max).
            // PDF Height = 100cm (Max/Constraint).
            // Packing: Fill Y first (Column).
            // Result: A filled column on the left.
            // PDF Dimensions:
            // Should the PDF be full 55cm wide? Or cropped to content?
            // "Breite soll immer genau so sein wie angegeben" -> PDF Width = 55cm.
            // "Länge soll so sein das die maximal breite eingehalten wird" -> Length (Height) is result?
            // "wird weniger gebraucht. gibt man die datei schmaler aus."
            // This is the contradiction.
            // Maybe "Breite" = Length?
            
            // Let's try:
            // PDF Width = 55cm (Fixed).
            // PDF Height = Variable.
            // Packing = Column First (Fill Y up to Limit).
            
            // Let's implement this Standard Portrait Column mode.
            
            const PAGE_WIDTH_FIXED = rollWidthPoints;
            const PAGE_HEIGHT_MAX = rollLengthMm > 0 ? rollLengthMm * 2.83465 : 14400;

            // Try to fit in existing columns on current page
             for (const col of columns) {
                if (item.h <= col.freeHeight) {
                    item.x = col.x;
                    // item.y is relative to top?
                    // Let's use standard top-down accumulation
                    // We need to store currentY in column
                    
                    // col.freeHeight is strictly space remaining.
                    // We need to know WHERE to place.
                    // Let's add `currentY` to column state.
                    
                    // Hack: calculate y from freeHeight?
                    // No, freeHeight doesn't tell us start pos if we have max height.
                    // We need `col.y`.
                    
                    // Let's fix the column structure type implicitly by logic change?
                    // I can't change interface easily here without larger refactor.
                    // I will use `maxPageHeightPoints - col.freeHeight` as `y`.
                    // This assumes `freeHeight` started at `maxPageHeightPoints`.
                    // Yes.
                    
                    item.y = PAGE_HEIGHT_MAX - col.freeHeight; 
                    item.pageIndex = currentPageIndex;
                    
                    col.freeHeight -= item.h;
                    col.items.push(item);
                    return true;
                }
            }
            
            // New column needed
            // Check if fits in Width
            const currentMaxX = columns.length > 0 ? columns[columns.length - 1].x + columns[columns.length - 1].width : 0;
            
            // User says: "nur wenn nichts mehr hinpasst geh in die breite"
            // This means we fill Y first (Column). If Y full, we create new Column (X).
            // This is already what we do.
            
            if (currentMaxX + item.w > PAGE_WIDTH_FIXED) {
                // Page full (width-wise)
                // "geh in die breite" might mean: extend the page width?
                // BUT User said "Breite soll immer genau so sein wie die angeben sind" (Fixed Width).
                
                // So if Page Full, we must create new Page.
                currentPageIndex++;
                columns = [];
            }
            
            const startX = columns.length > 0 ? columns[columns.length - 1].x + columns[columns.length - 1].width : 0;
            
            const newCol = {
                x: startX,
                width: item.w,
                freeHeight: PAGE_HEIGHT_MAX - item.h,
                items: [item]
            };
            
            item.x = startX;
            item.y = 0;
            item.pageIndex = currentPageIndex;
            
            columns.push(newCol);
            return true;
        };

        if (rollLengthMm > 0) {
            // FIXED SHEET MODE (User Request: "Genau falsch rum" fixed)
            // Roll Width = PDF Width (Fixed)
            // Roll Length = PDF Height (Max)
            
            // "erst in der höhe anzuordnen dann in der breite" -> Fill Columns (Y first)
            
            // Sort by HEIGHT descending for column packing efficiency? 
            // Or Width descending to fit widest items first?
            // Usually Width descending is better for strip packing.
            itemsToPack.sort((a, b) => b.w - a.w);
            
            for (const item of itemsToPack) {
                if (item.w > rollWidthPoints) {
                    console.warn("Item wider than roll width, skipping or rotate?");
                    continue;
                }
                if (item.h > (rollLengthMm * 2.83465)) {
                     console.warn("Item taller than roll length, skipping");
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
                 // FIXED SHEET MODE (Portrait)
                 // Width = Roll Width (Fixed)
                 // Height = User requested "auch 56cm höhe auche auch wenn leerraum dabei ist"
                 // "nur wenn nichts mehr hinpasst geh in die breite" -> This means fill full page height first.
                 
                 // If page is full, we create new page.
                 // So Page Height should be FIXED to Max Length (e.g. 56cm).
                 
                 pageHeight = maxPageHeightPoints; 
                 pageWidth = rollWidthPoints;
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