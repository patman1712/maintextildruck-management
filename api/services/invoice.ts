import { jsPDF } from 'jspdf';
import path from 'path';
import fs from 'fs-extra';
import db, { DATA_DIR } from '../db.js';

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
        const doc = new jsPDF();
        
        // Fonts
        doc.setFont('helvetica');

        // --- Header ---
        
        // Shop Logo (Left)
        // Logic: Prefer email_logo_url, then logo_url
        const logoUrl = shop.email_logo_url || shop.logo_url;
        let logoAdded = false;

        if (logoUrl) {
            try {
                let logoPath = logoUrl;
                let absolutePath = '';

                if (logoPath.startsWith('http')) {
                    // Skip remote images for now unless we implement fetching
                    // If it's localhost, we might be able to map it?
                    // Usually uploads are local.
                } else {
                    // Local path
                    // If starts with /uploads/, map to UPLOAD_DIR
                    if (logoPath.startsWith('/uploads/')) {
                        const filename = path.basename(logoPath);
                        absolutePath = path.join(UPLOAD_DIR, filename);
                    } else if (logoPath.startsWith('/')) {
                        // Relative to root? or public?
                        absolutePath = path.join(process.cwd(), logoPath);
                    } else {
                         // Relative?
                         absolutePath = path.join(process.cwd(), logoPath);
                    }

                    if (fs.existsSync(absolutePath)) {
                         const ext = path.extname(absolutePath).slice(1).toUpperCase(); // PNG, JPG, JPEG
                         // jspdf needs format.
                         let format = ext;
                         if (format === 'JPG') format = 'JPEG';
                         
                         const imgData = fs.readFileSync(absolutePath);
                         // Keep aspect ratio
                         // We want max width 60, max height 30
                         // We don't know dimensions easily without sharp/image-size.
                         // jsPDF addImage(data, format, x, y, w, h)
                         // If w/h are not provided, it uses default? No.
                         // We'll set width 50, height auto (undefined) might not work in all versions.
                         // Let's assume square or landscape.
                         doc.addImage(imgData, format, 20, 15, 50, 0); // 0 height = auto keep aspect ratio
                         logoAdded = true;
                    } else {
                        console.warn('Logo file not found at:', absolutePath);
                    }
                }
            } catch (e) {
                console.error('Error adding shop logo to PDF:', e);
            }
        }

        // Fallback Title if no logo
        if (!logoAdded) {
            doc.setFontSize(20);
            doc.setTextColor(200, 0, 0); // Red
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
        
        // Headers
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("Pos.", 20, y);
        doc.text("Bezeichnung", 40, y);
        doc.text("Menge", 130, y, { align: 'right' });
        doc.text("Einzelpreis", 160, y, { align: 'right' });
        doc.text("Gesamtpreis", 195, y, { align: 'right' });
        
        doc.line(20, y + 2, 195, y + 2);
        y += 8;

        // Items
        doc.setFont("helvetica", "normal");
        let subtotal = 0;

        items.forEach((item, index) => {
            const price = item.price || 0;
            const total = price * item.quantity;
            subtotal += total;

            doc.text((index + 1).toString(), 20, y);
            
            // Handle long product names
            const splitName = doc.splitTextToSize(item.item_name, 80);
            doc.text(splitName, 40, y);
            
            doc.text(item.quantity.toString(), 130, y, { align: 'right' });
            doc.text(`${price.toFixed(2).replace('.', ',')} €`, 160, y, { align: 'right' });
            doc.text(`${total.toFixed(2).replace('.', ',')} €`, 195, y, { align: 'right' });

            // Extra info (size, color, notes)
            let extraLines = [];
            if (item.size) extraLines.push(`Größe: ${item.size}`);
            
            // Filter out "Kindergrößen" or empty/irrelevant color info
            // Also filter if color matches size (redundant)
            if (item.color && !item.color.includes('Kindergrößen') && item.color.trim() !== '' && item.color !== item.size) {
                extraLines.push(`Farbe: ${item.color}`);
            }
            
            // Check for personalization notes
            if (item.notes) {
                 let notesParsed = false;
                 // Try JSON
                 try {
                     const notesObj = JSON.parse(item.notes);
                     if (typeof notesObj === 'object' && notesObj !== null) {
                         Object.entries(notesObj).forEach(([k, v]) => {
                             // Check if k is a known option ID
                             const label = optionMap.get(k) || k;
                             let valStr = String(v);
                             extraLines.push(`${label}: ${valStr}`);
                         });
                         notesParsed = true;
                     }
                 } catch (e) { /* ignore */ }
                 
                 if (!notesParsed) {
                     // Check for UUID:Value format
                     const parts = item.notes.split(':');
                     if (parts.length === 2) {
                         const [key, val] = parts;
                         if (optionMap.has(key)) {
                             extraLines.push(`${optionMap.get(key)}: ${val}`);
                             notesParsed = true;
                         }
                     }
                 }

                 if (!notesParsed) {
                      // Fallback: If it looks like a raw code but we couldn't resolve it,
                      // and user wants "Initialen: PS", maybe we can guess?
                      // If it's just text, show it.
                      extraLines.push(`Hinweis: ${item.notes}`);
                 }
            }

            let extraY = y + (splitName.length * 4);
            
            if (extraLines.length > 0) {
                doc.setFontSize(8);
                doc.setTextColor(100);
                
                // Print each extra line
                extraLines.forEach((line) => {
                    const splitLine = doc.splitTextToSize(line, 80);
                    // Reduced spacing: +2 instead of +4
                    doc.text(splitLine, 40, extraY + 2);
                    // Reduced line height for extra info block: * 3.5 instead of * 4
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
            doc.text((items.length + 1).toString(), 20, y);
            doc.text("Versandkosten", 40, y);
            doc.text("1", 130, y, { align: 'right' });
            doc.text(`${shipping.toFixed(2).replace('.', ',')} €`, 160, y, { align: 'right' });
            doc.text(`${shipping.toFixed(2).replace('.', ',')} €`, 195, y, { align: 'right' });
            y += 8;
        }

        doc.line(20, y, 195, y);
        y += 8;

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
        doc.text("Bitte bei Zahlung angeben!", 20, y);
        y += 5;
        doc.text(`Verwendungszweck: ${invoiceNumber}`, 20, y);
        y += 10;
        
        if (order.payment_method) {
             doc.text(`Zahlungsart: ${order.payment_method}`, 20, y);
             y += 5;
        }
        
        doc.text("Die Ware bleibt bis zur vollständigen Bezahlung unser Eigentum.", 20, y);

        // --- FOOTER ---
        const footerY = 270;
        doc.setFontSize(6); // Reduced from 7
        doc.setTextColor(100, 100, 100);
        
        // Helper for columns - Adjusted spacing
        const col1 = 20;
        const col2 = 65; // Reduced from 70
        const col3 = 110; // Reduced from 120
        const col4 = 155; // Reduced from 160
        
        // Col 1: Address
        doc.setFont("helvetica", "bold");
        doc.text(globalContent.company_name || shop.name || '', col1, footerY);
        doc.setFont("helvetica", "normal");
        doc.text(globalContent.company_address || '', col1, footerY + 3);
        if (globalContent.ceo_name) doc.text(`GF: ${globalContent.ceo_name}`, col1, footerY + 6);
        
        // Col 2: Contact
        doc.setFont("helvetica", "bold");
        doc.text('Kontakt', col2, footerY);
        doc.setFont("helvetica", "normal");
        doc.text(globalContent.contact_email || '', col2, footerY + 3);
        doc.text(globalContent.contact_phone || '', col2, footerY + 6);
        doc.text('www.maintextildruck.com', col2, footerY + 9);

        // Col 3: Bank
        doc.setFont("helvetica", "bold");
        doc.text('Bankverbindung', col3, footerY);
        doc.setFont("helvetica", "normal");
        doc.text(globalContent.bank_name || '', col3, footerY + 3);
        doc.text(`IBAN: ${globalContent.bank_iban || ''}`, col3, footerY + 6);
        doc.text(`BIC: ${globalContent.bank_bic || ''}`, col3, footerY + 9);

        // Col 4: Tax
        doc.setFont("helvetica", "bold");
        doc.text('Register & Steuer', col4, footerY);
        doc.setFont("helvetica", "normal");
        doc.text(`Steuer-Nr: ${globalContent.tax_number || ''}`, col4, footerY + 3);
        doc.text(`USt-ID: ${globalContent.vat_id || ''}`, col4, footerY + 6);
        if (globalContent.commercial_register) doc.text(`HRB: ${globalContent.commercial_register}`, col4, footerY + 9);

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