import { jsPDF } from 'jspdf';
import path from 'path';
import fs from 'fs-extra';
import db, { DATA_DIR } from '../db.js';
import sharp from 'sharp';

// Ensure invoices directory exists
const INVOICE_DIR = path.join(DATA_DIR, 'invoices');
fs.ensureDirSync(INVOICE_DIR);

const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

export const generateInvoice = async (orderId: string): Promise<string | null> => {
    try {
        // Fetch Order
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
        if (!order) throw new Error('Order not found');

        // Fetch Order Items
        const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];

        // Fetch Shop
        const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(order.shop_id) as any;

        // Fetch Customer (Shop Customer)
        const customer = db.prepare('SELECT * FROM shop_customers WHERE id = ?').get(order.shop_customer_id) as any;

        // Fetch Personalization Options Map
        const personalizationOptions = db.prepare('SELECT id, name FROM personalization_options').all() as {id: string, name: string}[];
        const optionMap = new Map(personalizationOptions.map(o => [o.id, o.name]));

        // Fetch Global Content (Company Info)
        const globalContent = db.prepare("SELECT * FROM global_shop_content WHERE id = 'main'").get() as any;

        // Check if invoice number is already set
        const orderCheck = db.prepare('SELECT invoice_number, invoice_date FROM orders WHERE id = ?').get(orderId) as any;
        
        let invoiceNumber = orderCheck?.invoice_number || order.invoice_number;
        let invoiceDate = orderCheck?.invoice_date || order.invoice_date;

        if (!invoiceNumber) {
            // STRICT REQUIREMENT: Invoice Number = Order Number
            invoiceNumber = order.order_number;
            invoiceDate = new Date().toISOString();

            console.log(`Assigning Invoice Number ${invoiceNumber} to Order ${orderId}`);

            // Update Order
            db.prepare('UPDATE orders SET invoice_number = ?, invoice_date = ? WHERE id = ?').run(invoiceNumber, invoiceDate, orderId);
        } else {
             console.log(`Order ${orderId} already has Invoice Number ${invoiceNumber}`);
        }

        // Create PDF
        const doc = new jsPDF({ compress: true });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        
        // Fonts
        doc.setFont('helvetica');

        // --- Header ---
        
        const resolveLocalPath = (urlOrPath: string) => {
            const p = String(urlOrPath || '');
            if (!p || p.startsWith('http')) return '';
            if (p.startsWith('/uploads/')) return path.join(UPLOAD_DIR, p.replace(/^\/uploads\//, ''));
            if (p.startsWith('/')) return path.join(process.cwd(), p);
            return path.join(process.cwd(), p);
        };

        const mainLogoSetting = db.prepare("SELECT value FROM settings WHERE key = 'logo'").get() as any;
        const mainLogoUrl = mainLogoSetting?.value || '';
        const shopLogoUrl = shop?.email_logo_url || shop?.logo_url || '';

        const tryAddLogo = async (logoUrl: string, x: number, y: number, width: number) => {
            const absolutePath = resolveLocalPath(logoUrl);
            if (!absolutePath) return false;
            if (!fs.existsSync(absolutePath)) return false;
            const input = fs.readFileSync(absolutePath);
            const targetDpi = 200;
            const targetWidthPx = Math.max(1, Math.round((width / 25.4) * targetDpi));

            const jpegBuffer = await sharp(input, { density: 300 })
                .resize({ width: targetWidthPx, fit: 'inside', withoutEnlargement: true })
                .flatten({ background: '#ffffff' })
                .jpeg({ quality: 80, mozjpeg: true })
                .toBuffer();

            doc.addImage(jpegBuffer, 'JPEG', x, y, width, 0, undefined, 'FAST');
            return true;
        };

        let logoAdded = false;
        const headerY = 15;
        let x = 20;
        const shopLogoWidth = 42;
        const mainLogoWidth = 42;

        const shopLogoAdded = !!shopLogoUrl && (await tryAddLogo(shopLogoUrl, x, headerY, shopLogoWidth));
        if (shopLogoAdded) {
            logoAdded = true;
            x += shopLogoWidth + 6;
        }

        const mainLogoAdded = !!mainLogoUrl && (await tryAddLogo(mainLogoUrl, x + (shopLogoAdded ? 6 : 0), headerY, mainLogoWidth));
        if (shopLogoAdded && mainLogoAdded) {
            const lineX = 20 + shopLogoWidth + 3;
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.4);
            doc.line(lineX, headerY, lineX, headerY + 18);
            x += 6;
        }
        if (mainLogoAdded) {
            logoAdded = true;
        }

        if (!logoAdded) {
            doc.setFontSize(20);
            doc.setTextColor(200, 0, 0);
            doc.text("MAIN", 20, 30);
            doc.setTextColor(0, 0, 0);
            doc.text("TEXTILDRUCK", 50, 30);
        }

        // Company Info (Right)
        doc.setFontSize(8); 
        doc.setTextColor(0, 0, 0);
        const companyX = 140;
        let companyY = 25;
        
        doc.setFont("helvetica", "bold");
        doc.text(globalContent.company_name || 'Main Textildruck GmbH', companyX, companyY);
        doc.setFont("helvetica", "normal");
        companyY += 4;
        
        // Handle multiline address
        const companyAddr = globalContent.company_address || '';
        const companyAddrLines = companyAddr.split('\n').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
        
        companyAddrLines.forEach((line: string) => {
            doc.text(line, companyX, companyY);
            companyY += 4;
        });

        doc.text(`Telefon ${globalContent.contact_phone || ''}`, companyX, companyY);
        companyY += 4;
        doc.text(globalContent.contact_email || '', companyX, companyY);
        
        companyY += 8;
        doc.text(`Kunden-Nr. ${customer?.customer_number || '-'}`, companyX, companyY);
        companyY += 4;
        doc.text(`Bestell-Nr. ${order.order_number}`, companyX, companyY);
        companyY += 4;
        doc.text(`Bestelldatum ${new Date(order.created_at).toLocaleDateString('de-DE')}`, companyX, companyY);
        companyY += 4;
        doc.text(`Rechnungsdatum ${new Date(invoiceDate).toLocaleDateString('de-DE')}`, companyX, companyY);
        companyY += 4;
        if (order.deadline) {
             doc.text(`Lieferdatum ${new Date(order.deadline).toLocaleDateString('de-DE')}`, companyX, companyY);
        }

        // Sender Address (Left, small, above address)
        doc.setFontSize(7);
        // Flatten address for single line display
        const flatAddress = (globalContent.company_address || '').replace(/\n/g, ', ').replace(/\r/g, '');
        doc.text(`${globalContent.company_name || 'Main Textildruck GmbH'} - ${flatAddress}`, 20, 60);
        
        // Line under sender address
        doc.setLineWidth(0.1);
        doc.line(20, 62, 100, 62); // Made slightly longer

        // Delivery Address
        doc.setFontSize(10);
        const addressLines = (order.customer_address || '').split(',').map((s: string) => s.trim());
        let addrY = 70; // Moved up from 75
        
        if (order.company) {
            doc.text(order.company, 20, addrY);
            addrY += 5;
        }
        doc.text(order.customer_name, 20, addrY);
        addrY += 5;
        // Split address nicely
        if (addressLines.length > 0) doc.text(addressLines[0], 20, addrY); // Street
        if (addressLines.length > 1) {
            addrY += 5;
            doc.text(addressLines[1], 20, addrY); // City
        }
        addrY += 5;
        doc.text('Deutschland', 20, addrY);

        // Title
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(`Rechnung Nr. ${invoiceNumber}`, 20, 110);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Wir erlauben uns, Ihnen folgende Leistungen in Rechnung zu stellen:", 20, 120);

        // --- Table ---
        let y = 130;

        const footerY = pageHeight - 27;
        const bottomLimit = footerY - 8;
        const col1 = 20;
        const col2 = 65;
        const col3 = 110;
        const col4 = 155;

        const drawTableHeader = (yPos: number) => {
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("Pos.", 20, yPos);
            doc.text("Bezeichnung", 40, yPos);
            doc.text("Menge", 130, yPos, { align: 'right' });
            doc.text("Einzelpreis", 160, yPos, { align: 'right' });
            doc.text("Gesamtpreis", 195, yPos, { align: 'right' });
            doc.line(20, yPos + 2, 195, yPos + 2);
            doc.setFont("helvetica", "normal");
            return yPos + 8;
        };

        const drawContinuationHeader = () => {
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(`Rechnung Nr. ${invoiceNumber}`, 20, 18);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.text(`Bestell-Nr. ${order.order_number}`, 195, 18, { align: 'right' });
        };

        const addPageForTable = () => {
            doc.addPage();
            drawContinuationHeader();
            y = 28;
            y = drawTableHeader(y);
        };

        const ensureSpace = (requiredHeight: number, forTable: boolean) => {
            if (y + requiredHeight <= bottomLimit) return;
            if (forTable) {
                addPageForTable();
            } else {
                doc.addPage();
                drawContinuationHeader();
                y = 28;
            }
        };
        
        y = drawTableHeader(y);

        // Items
        let subtotal = 0;

        items.forEach((item, index) => {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(0);

            const price = item.price || 0;
            const total = price * item.quantity;
            subtotal += total;

            // Handle long product names
            const splitName = doc.splitTextToSize(item.item_name, 80);

            // Extra info (size, color, notes)
            let extraLines = [];
            if (item.item_number) extraLines.push(`Art-Nr: ${item.item_number}`);
            if (item.size) extraLines.push(`Größe: ${item.size}`);
            
            // Filter out "Kindergrößen" or empty/irrelevant color info
            // Also filter if color matches size (redundant)
            if (item.color && !item.color.includes('Kindergrößen') && item.color.trim() !== '' && item.color !== item.size) {
                extraLines.push(`Farbe: ${item.color}`);
            }
            
            // Check for personalization notes
            if (item.notes) {
                let notesParsed = false;
                
                // 1. Try JSON first
                try {
                    const notesObj = JSON.parse(item.notes);
                    if (typeof notesObj === 'object' && notesObj !== null) {
                        Object.entries(notesObj).forEach(([k, v]) => {
                            const label = optionMap.get(k) || k;
                            const valStr = String(v);
                            if (valStr === 'false') return;
                            if (valStr === 'true') {
                                extraLines.push(label);
                            } else {
                                extraLines.push(`${label}: ${valStr}`);
                            }
                        });
                        notesParsed = true;
                    }
                } catch (e) { /* ignore */ }
                
                // 2. Try pipe-separated or legacy colon format (e.g. "UUID1:Val1|UUID2:Val2")
                if (!notesParsed) {
                    // Check if it looks like a structured string (contains : or |)
                    if (item.notes.includes(':') || item.notes.includes('|')) {
                         const parts = item.notes.split('|').map((p: string) => p.trim()).filter((p: string) => p.length > 0);
                         let resolvedAny = false;
                         
                         parts.forEach((part: string) => {
                             const colonIndex = part.indexOf(':');
                             if (colonIndex > -1) {
                                 const key = part.substring(0, colonIndex).trim();
                                 const val = part.substring(colonIndex + 1).trim();
                                 
                                 // Look up key in optionMap (UUID -> Name)
                                 const label = optionMap.get(key) || key;
                                 
                                 if (val === 'false') return;
                                 if (val === 'true') {
                                     extraLines.push(label);
                                 } else {
                                     extraLines.push(`${label}: ${val}`);
                                 }
                                 resolvedAny = true;
                             } else {
                                 // If it's part of a piped string but has no colon, just show it
                                 if (parts.length > 1 || item.notes.includes('|')) {
                                     extraLines.push(part);
                                     resolvedAny = true;
                                 }
                             }
                         });
                         
                         if (resolvedAny) notesParsed = true;
                    }
                }

                if (!notesParsed) {
                     // Fallback: If it looks like a raw code but we couldn't resolve it,
                     // and user wants "Initialen: PS", maybe we can guess?
                     // If it's just text, show it, but prefix with "Hinweis" only if it's long or unusual
                     // Or just print it directly to be cleaner as requested "es würde langen wenn da steht trikotnummer - spielername"
                     extraLines.push(item.notes);
                }
            }

            const extraHeight = extraLines.reduce((sum, line) => sum + (doc.splitTextToSize(line, 80).length * 3.5), 0);
            const requiredHeight = (splitName.length * 4) + (extraLines.length > 0 ? (2 + extraHeight) : 0) + 6;
            ensureSpace(requiredHeight, true);

            doc.text((index + 1).toString(), 20, y);
            doc.text(splitName, 40, y);
            doc.text(item.quantity.toString(), 130, y, { align: 'right' });
            doc.text(`${price.toFixed(2).replace('.', ',')} €`, 160, y, { align: 'right' });
            doc.text(`${total.toFixed(2).replace('.', ',')} €`, 195, y, { align: 'right' });

            let extraY = y + (splitName.length * 4);

            if (extraLines.length > 0) {
                doc.setFontSize(8);
                doc.setTextColor(100);
                extraLines.forEach((line) => {
                    const splitLine = doc.splitTextToSize(line, 80);
                    doc.text(splitLine, 40, extraY + 2);
                    extraY += (splitLine.length * 3.5);
                });
                doc.setTextColor(0);
                doc.setFontSize(9);
            }

            y = extraY + 6;
        });

        // Shipping
        const shipping = order.shipping_costs || 0;
        if (shipping > 0) {
            subtotal += shipping;
            ensureSpace(10, true);
            doc.text((items.length + 1).toString(), 20, y);
            doc.text("Versandkosten", 40, y);
            doc.text("1", 130, y, { align: 'right' });
            doc.text(`${shipping.toFixed(2).replace('.', ',')} €`, 160, y, { align: 'right' });
            doc.text(`${shipping.toFixed(2).replace('.', ',')} €`, 195, y, { align: 'right' });
            y += 8;
        }

        ensureSpace(70, false);
        if (y > 40) {
            doc.line(20, y, 195, y);
            y += 8;
        } else {
            y += 4;
        }

        // Totals
        // Assuming prices are Gross (Brutto) in the system
        const grossTotal = subtotal; 
        const netTotal = grossTotal / 1.19;
        const vatTotal = grossTotal - netTotal;

        doc.text("Netto-Betrag:", 160, y, { align: 'right' });
        doc.text(`${netTotal.toFixed(2).replace('.', ',')} €`, 195, y, { align: 'right' });
        y += 5;

        doc.text("zzgl. 19% MwSt.:", 160, y, { align: 'right' });
        doc.text(`${vatTotal.toFixed(2).replace('.', ',')} €`, 195, y, { align: 'right' });
        y += 5;

        doc.setFont("helvetica", "bold");
        doc.text("Gesamtbetrag:", 160, y, { align: 'right' });
        doc.text(`${grossTotal.toFixed(2).replace('.', ',')} €`, 195, y, { align: 'right' });
        doc.setFont("helvetica", "normal");
        
        y += 15;

        // Payment Info
        ensureSpace(30, false);
        doc.text("Bitte bei Zahlung angeben!", 20, y);
        y += 5;
        doc.text(`Verwendungszweck: ${invoiceNumber}`, 20, y);
        y += 10;
        
        if (order.payment_method) {
             doc.text(`Zahlungsart: ${order.payment_method}`, 20, y);
             y += 5;
        }
        
        doc.text("Die Ware bleibt bis zur vollständigen Bezahlung unser Eigentum.", 20, y);

        const drawFooter = (pageNo: number, totalPages: number) => {
            doc.setFontSize(6);
            doc.setTextColor(100, 100, 100);

            doc.setFont("helvetica", "bold");
            doc.text(globalContent.company_name || shop.name || '', col1, footerY);
            doc.setFont("helvetica", "normal");
            doc.text(globalContent.company_address || '', col1, footerY + 3);
            if (globalContent.ceo_name) doc.text(`GF: ${globalContent.ceo_name}`, col1, footerY + 6);

            doc.setFont("helvetica", "bold");
            doc.text('Kontakt', col2, footerY);
            doc.setFont("helvetica", "normal");
            doc.text(globalContent.contact_email || '', col2, footerY + 3);
            doc.text(globalContent.contact_phone || '', col2, footerY + 6);
            doc.text('www.maintextildruck.com', col2, footerY + 9);

            doc.setFont("helvetica", "bold");
            doc.text('Bankverbindung', col3, footerY);
            doc.setFont("helvetica", "normal");
            doc.text(globalContent.bank_name || '', col3, footerY + 3);
            doc.text(`IBAN: ${globalContent.bank_iban || ''}`, col3, footerY + 6);
            doc.text(`BIC: ${globalContent.bank_bic || ''}`, col3, footerY + 9);

            doc.setFont("helvetica", "bold");
            doc.text('Register & Steuer', col4, footerY);
            doc.setFont("helvetica", "normal");
            doc.text(`Steuer-Nr: ${globalContent.tax_number || ''}`, col4, footerY + 3);
            doc.text(`USt-ID: ${globalContent.vat_id || ''}`, col4, footerY + 6);
            if (globalContent.commercial_register) doc.text(`HRB: ${globalContent.commercial_register}`, col4, footerY + 9);

            doc.setTextColor(150);
            doc.text(`Seite ${pageNo} / ${totalPages}`, pageWidth - 20, footerY + 12, { align: 'right' });
            doc.setTextColor(0);
        };

        const totalPages = doc.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            drawFooter(p, totalPages);
        }

        // Save PDF
        const fileName = `Rechnung_${invoiceNumber}.pdf`;
        const filePath = path.join(INVOICE_DIR, fileName);
        
        // Output as Buffer and write to file
        const pdfOutput = doc.output('arraybuffer');
        fs.writeFileSync(filePath, Buffer.from(pdfOutput));

        // Update Order with path
        db.prepare('UPDATE orders SET invoice_path = ? WHERE id = ?').run(fileName, orderId);

        return filePath;

    } catch (e) {
        console.error('Error generating invoice:', e);
        return null;
    }
};
