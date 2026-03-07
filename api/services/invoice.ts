import { jsPDF } from 'jspdf';
import path from 'path';
import fs from 'fs-extra';
import db, { DATA_DIR } from '../db.js';

// Ensure invoices directory exists
const INVOICE_DIR = path.join(DATA_DIR, 'invoices');
fs.ensureDirSync(INVOICE_DIR);

interface InvoiceData {
    orderId: string;
    shopId: string;
    customerId: string;
}

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

        // Fetch Global Content (Company Info)
        const globalContent = db.prepare("SELECT * FROM global_shop_content WHERE id = 'main'").get() as any;

        // Generate Invoice Number if not exists
        let invoiceNumber = order.invoice_number;
        let invoiceDate = order.invoice_date;

        if (!invoiceNumber) {
            // Transaction to ensure sequential numbers
            const transaction = db.transaction(() => {
                // Get current next number for shop
                const currentShop = db.prepare('SELECT invoice_number_circle, next_invoice_number FROM shops WHERE id = ?').get(shop.id) as any;
                let nextNr = currentShop.next_invoice_number || 1;
                let format = currentShop.invoice_number_circle || 'RE-{YYYY}-{NR}';

                invoiceNumber = format
                    .replace('{YEAR}', new Date().getFullYear().toString())
                    .replace('{NR}', nextNr.toString());
                
                invoiceDate = new Date().toISOString();

                // Update Order
                db.prepare('UPDATE orders SET invoice_number = ?, invoice_date = ? WHERE id = ?').run(invoiceNumber, invoiceDate, orderId);

                // Update Shop next number
                db.prepare('UPDATE shops SET next_invoice_number = ? WHERE id = ?').run(nextNr + 1, shop.id);
            });
            transaction();
        }

        // Create PDF
        const doc = new jsPDF();
        
        // Fonts
        doc.setFont('helvetica');

        // --- Header ---
        
        // Shop Logo (Left)
        if (shop.logo_url) {
            try {
                // Check if url is local path or http
                // If it's a relative path from uploads, resolve it
                // If it's http, we might need to fetch it.
                // For simplicity, assume local path if it starts with /uploads
                // But logo_url might be full URL in some cases?
                // In db.ts migration, we didn't enforce path structure.
                // But in ShopDashboard, we use /api/upload which returns path.
                
                let logoPath = shop.logo_url;
                if (logoPath.startsWith('http')) {
                    // Skip remote images for now or fetch buffer (complex)
                    // doc.addImage(logoPath, 'PNG', 20, 20, 40, 0); 
                } else {
                    // Local path
                    // remove leading slash if present
                    if (logoPath.startsWith('/')) logoPath = logoPath.substring(1);
                    const absolutePath = path.join(process.cwd(), logoPath);
                    if (fs.existsSync(absolutePath)) {
                         const ext = path.extname(absolutePath).slice(1).toUpperCase(); // PNG, JPG
                         const imgData = fs.readFileSync(absolutePath);
                         doc.addImage(imgData, ext, 20, 20, 40, 20, undefined, 'FAST');
                    }
                }
            } catch (e) {
                console.error('Error adding shop logo to PDF:', e);
            }
        }

        // Main Textildruck Logo (Middle/Right) - Placeholder text if no image
        doc.setFontSize(20);
        doc.setTextColor(200, 0, 0); // Red
        doc.text("MAIN", 80, 30);
        doc.setTextColor(0, 0, 0);
        doc.text("TEXTILDRUCK", 110, 30);

        // Company Info (Right)
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        const companyX = 140;
        let companyY = 25;
        
        doc.font("helvetica", "bold");
        doc.text(globalContent.company_name || 'Main Textildruck GmbH', companyX, companyY);
        doc.font("helvetica", "normal");
        companyY += 5;
        doc.text(globalContent.company_address || '', companyX, companyY);
        companyY += 5;
        doc.text(`Telefon ${globalContent.contact_phone || ''}`, companyX, companyY);
        companyY += 5;
        doc.text(globalContent.contact_email || '', companyX, companyY);
        companyY += 5;
        doc.text('maintextildruck.com', companyX, companyY); // Hardcoded or from DB?

        companyY += 10;
        doc.text(`Kunden-Nr. ${customer?.customer_number || '-'}`, companyX, companyY);
        companyY += 5;
        doc.text(`Bestell-Nr. ${order.order_number}`, companyX, companyY);
        companyY += 5;
        doc.text(`Bestelldatum ${new Date(order.created_at).toLocaleDateString('de-DE')}`, companyX, companyY);
        companyY += 5;
        doc.text(`Datum ${new Date(invoiceDate).toLocaleDateString('de-DE')}`, companyX, companyY);

        // Sender Address (Left, small)
        doc.setFontSize(8);
        doc.text(`${globalContent.company_name || 'Main Textildruck GmbH'} - ${globalContent.company_address || ''}`, 20, 60);

        // Delivery Address
        doc.setFontSize(10);
        const addressLines = (order.customer_address || '').split(',').map((s: string) => s.trim());
        let addrY = 70;
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
        doc.font("helvetica", "bold");
        doc.text(`Rechnungs-Nr. ${invoiceNumber}`, 20, 100);

        // --- Table ---
        let y = 110;
        
        // Headers
        doc.setFontSize(9);
        doc.font("helvetica", "bold");
        doc.text("Prod.-Nr.", 20, y);
        doc.text("Produkt / Dienst", 60, y);
        doc.text("Anzahl", 130, y, { align: 'right' });
        doc.text("USt.", 150, y, { align: 'right' });
        doc.text("Stückpreis", 175, y, { align: 'right' });
        doc.text("Gesamt", 195, y, { align: 'right' });
        
        doc.line(20, y + 2, 195, y + 2);
        y += 8;

        // Items
        doc.font("helvetica", "normal");
        let subtotal = 0;

        items.forEach((item) => {
            const price = item.price || 0;
            const total = price * item.quantity;
            subtotal += total;

            doc.text(item.item_number || item.product_number || '-', 20, y);
            
            // Handle long product names
            const splitName = doc.splitTextToSize(item.item_name, 60);
            doc.text(splitName, 60, y);
            
            doc.text(item.quantity.toString(), 130, y, { align: 'right' });
            doc.text("19 %", 150, y, { align: 'right' }); // Hardcoded 19% for now
            doc.text(`${price.toFixed(2).replace('.', ',')} €`, 175, y, { align: 'right' });
            doc.text(`${total.toFixed(2).replace('.', ',')} €`, 195, y, { align: 'right' });

            // Extra info (size, color)
            let extraY = y + (splitName.length * 4);
            if (item.size || item.color) {
                doc.setFontSize(8);
                doc.setTextColor(100);
                let details = [];
                if (item.size) details.push(`Größe: ${item.size}`);
                if (item.color) details.push(`Farbe: ${item.color}`);
                doc.text(details.join(', '), 60, y + 4);
                doc.setTextColor(0);
                doc.setFontSize(9);
            }

            y = extraY + 4;
        });

        // Shipping
        const shipping = order.shipping_costs || 0;
        if (shipping > 0) {
            subtotal += shipping;
            doc.text("Versandkosten", 60, y);
            doc.text("1", 130, y, { align: 'right' });
            doc.text("19 %", 150, y, { align: 'right' });
            doc.text(`${shipping.toFixed(2).replace('.', ',')} €`, 175, y, { align: 'right' });
            doc.text(`${shipping.toFixed(2).replace('.', ',')} €`, 195, y, { align: 'right' });
            y += 8;
        }

        doc.line(20, y, 195, y);
        y += 8;

        // Totals
        // Assuming prices are Gross (Brutto) in the system?
        // Usually shop systems store Gross.
        // Tax is included.
        // Net = Gross / 1.19
        // VAT = Gross - Net
        
        const grossTotal = subtotal; // Assuming stored prices are gross
        const netTotal = grossTotal / 1.19;
        const vatTotal = grossTotal - netTotal;

        doc.text("Gesamtsumme (Netto):", 160, y, { align: 'right' });
        doc.text(`${netTotal.toFixed(2).replace('.', ',')} €`, 195, y, { align: 'right' });
        y += 5;

        doc.text("zzgl. 19% MwSt.:", 160, y, { align: 'right' });
        doc.text(`${vatTotal.toFixed(2).replace('.', ',')} €`, 195, y, { align: 'right' });
        y += 5;

        doc.font("helvetica", "bold");
        doc.text("Gesamtsumme:", 160, y, { align: 'right' });
        doc.text(`${grossTotal.toFixed(2).replace('.', ',')} €`, 195, y, { align: 'right' });
        doc.font("helvetica", "normal");
        
        y += 15;

        // Payment & Shipping Info
        doc.font("helvetica", "bold");
        doc.text(`Gewählte Zahlungsart: ${order.payment_method || '-'}`, 20, y);
        y += 5;
        doc.text(`Gewählte Versandart: DHL`, 20, y); // Hardcoded DHL or from config?
        doc.font("helvetica", "normal");
        
        y += 10;
        doc.text("Die Ware bleibt, bis zur vollständigen Bezahlung, unser Eigentum.", 20, y);
        y += 5;
        doc.text(`Leistungsdatum entspricht Rechnungsdatum`, 20, y);

        // Footer (Bottom)
        const footerY = 270;
        doc.setFontSize(7);
        doc.line(20, footerY - 5, 195, footerY - 5);
        
        const col1X = 20;
        const col2X = 80;
        const col3X = 140;
        const col4X = 195; // Right align

        // Col 1: Company
        doc.font("helvetica", "bold");
        doc.text(globalContent.company_name || 'Main Textildruck GmbH', col1X, footerY);
        doc.font("helvetica", "normal");
        doc.text(`IdNr.: ${globalContent.tax_number || '-'}`, col1X, footerY + 3);
        doc.text(`USt-IdNr.: ${globalContent.vat_id || '-'}`, col1X, footerY + 6);
        // doc.text(`Finanzamt: ...`, col1X, footerY + 9);

        // Col 2: Bank
        doc.font("helvetica", "bold");
        doc.text("Bankverbindung", col2X, footerY);
        doc.font("helvetica", "normal");
        doc.text(globalContent.bank_name || '-', col2X, footerY + 3);
        doc.text(`IBAN: ${globalContent.bank_iban || '-'}`, col2X, footerY + 6);
        doc.text(`BIC: ${globalContent.bank_bic || '-'}`, col2X, footerY + 9);

        // Col 3: Court
        doc.font("helvetica", "bold");
        doc.text(`Gerichtsstand: ${globalContent.commercial_register || '-'}`, col3X, footerY);
        doc.font("helvetica", "normal");
        doc.text(`Erfüllungsort: ${globalContent.company_address ? globalContent.company_address.split(',')[1]?.trim() : '-'}`, col3X, footerY + 3);

        // Col 4: CEO (Right aligned - tricky with simple text, use fixed X)
        // Actually col4X is right edge.
        doc.font("helvetica", "bold");
        doc.text("Geschäftsführer", 170, footerY);
        doc.font("helvetica", "normal");
        doc.text(globalContent.ceo_name || '-', 170, footerY + 3);
        doc.text(globalContent.contact_phone || '-', 170, footerY + 6);

        doc.text("Seite 1 / 1", 195, footerY, { align: 'right' });


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
