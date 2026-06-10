import { jsPDF } from 'jspdf';
import path from 'path';
import fs from 'fs-extra';
import db, { DATA_DIR } from '../db.js';

const INVOICE_DIR = path.join(DATA_DIR, 'invoices');
fs.ensureDirSync(INVOICE_DIR);

export const generateCancellationInvoice = async (cancellationId: string): Promise<string | null> => {
  try {
    const cancellation = db.prepare('SELECT * FROM order_cancellations WHERE id = ?').get(cancellationId) as any;
    if (!cancellation) throw new Error('Storno nicht gefunden');

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(cancellation.order_id) as any;
    if (!order) throw new Error('Bestellung nicht gefunden');

    const shop = order.shop_id ? db.prepare('SELECT * FROM shops WHERE id = ?').get(order.shop_id) as any : null;
    const customer = order.shop_customer_id ? db.prepare('SELECT * FROM shop_customers WHERE id = ?').get(order.shop_customer_id) as any : null;
    const globalContent = db.prepare("SELECT * FROM global_shop_content WHERE id = 'main'").get() as any;
    const items = JSON.parse(cancellation.items_json || '[]') as any[];

    const doc = new jsPDF({ compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFont('helvetica');
    doc.setFontSize(20);
    doc.setTextColor(200, 0, 0);
    doc.text('STORNORECHNUNG', 20, 24);
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(8);
    let companyY = 20;
    const companyX = 145;
    doc.setFont('helvetica', 'bold');
    doc.text(globalContent?.company_name || 'Main Textildruck GmbH', companyX, companyY);
    doc.setFont('helvetica', 'normal');
    companyY += 4;
    const companyAddr = String(globalContent?.company_address || '').split('\n').map((s: string) => s.trim()).filter(Boolean);
    companyAddr.forEach((line: string) => {
      doc.text(line, companyX, companyY);
      companyY += 4;
    });
    if (globalContent?.contact_phone) {
      doc.text(`Telefon ${globalContent.contact_phone}`, companyX, companyY);
      companyY += 4;
    }
    if (globalContent?.contact_email) doc.text(globalContent.contact_email, companyX, companyY);

    doc.setFontSize(9);
    doc.text(`${globalContent?.company_name || 'Main Textildruck GmbH'} - ${String(globalContent?.company_address || '').replace(/\n/g, ', ')}`, 20, 40);
    doc.line(20, 42, 110, 42);

    doc.setFontSize(10);
    let addrY = 52;
    if (customer?.company) {
      doc.text(customer.company, 20, addrY);
      addrY += 5;
    }
    doc.text(order.customer_name || '-', 20, addrY);
    addrY += 5;
    const addressLines = String(order.customer_address || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    addressLines.forEach((line: string) => {
      doc.text(line, 20, addrY);
      addrY += 5;
    });

    doc.setFontSize(10);
    doc.text(`Kunden-Nr. ${customer?.customer_number || '-'}`, 145, 55);
    doc.text(`Bestell-Nr. ${order.order_number || '-'}`, 145, 60);
    doc.text(`Rechnungs-Nr. ${order.invoice_number || order.order_number || '-'}`, 145, 65);
    doc.text(`Storno-Nr. ${cancellation.cancellation_number}`, 145, 70);
    doc.text(`Storno-Datum ${new Date(cancellation.cancellation_date || cancellation.created_at).toLocaleDateString('de-DE')}`, 145, 75);

    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text(`Stornorechnung Nr. ${cancellation.cancellation_number}`, 20, 95);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Folgende Positionen wurden storniert:', 20, 103);

    let y = 115;
    const footerY = pageHeight - 26;
    const bottomLimit = footerY - 10;

    const drawTableHeader = (yPos: number) => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Pos.', 20, yPos);
      doc.text('Bezeichnung', 35, yPos);
      doc.text('Menge', 135, yPos, { align: 'right' });
      doc.text('Einzelpreis', 165, yPos, { align: 'right' });
      doc.text('Stornobetrag', 195, yPos, { align: 'right' });
      doc.line(20, yPos + 2, 195, yPos + 2);
      doc.setFont('helvetica', 'normal');
      return yPos + 8;
    };

    const addPage = () => {
      doc.addPage();
      y = 20;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Stornorechnung Nr. ${cancellation.cancellation_number}`, 20, y);
      doc.setFont('helvetica', 'normal');
      y = drawTableHeader(y + 10);
    };

    y = drawTableHeader(y);
    let total = 0;

    items.forEach((item, index) => {
      const cancelledQty = Number(item.cancelled_quantity || item.quantity || 0);
      const price = Number(item.price || 0);
      const lineTotal = cancelledQty * price;
      total += lineTotal;

      const labelParts = [item.item_name || 'Artikel'];
      if (item.size) labelParts.push(`Größe: ${item.size}`);
      if (item.color && item.color !== item.size) labelParts.push(`Farbe: ${item.color}`);
      if (item.notes) labelParts.push(`Personalisierung: ${item.notes}`);
      const labelLines = doc.splitTextToSize(labelParts.join(' | '), 92);
      const blockHeight = Math.max(6, labelLines.length * 4 + 2);

      if (y + blockHeight > bottomLimit) addPage();

      doc.text(String(index + 1), 20, y);
      doc.text(labelLines, 35, y);
      doc.text(String(cancelledQty), 135, y, { align: 'right' });
      doc.text(`${price.toFixed(2).replace('.', ',')} €`, 165, y, { align: 'right' });
      doc.text(`-${lineTotal.toFixed(2).replace('.', ',')} €`, 195, y, { align: 'right' });
      y += blockHeight;
    });

    y += 6;
    doc.line(120, y, 195, y);
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Stornobetrag', 160, y, { align: 'right' });
    doc.text(`-${total.toFixed(2).replace('.', ',')} €`, 195, y, { align: 'right' });
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Der ausgewiesene Betrag wird der ursprünglichen Rechnung gutgeschrieben.', 20, y);

    const drawFooter = (pageNo: number, totalPages: number) => {
      doc.setFontSize(6);
      doc.setTextColor(100, 100, 100);
      doc.text(globalContent?.company_name || shop?.name || '', 20, footerY);
      doc.text(globalContent?.contact_email || '', 80, footerY);
      doc.text(globalContent?.contact_phone || '', 120, footerY);
      doc.text(`Seite ${pageNo} / ${totalPages}`, pageWidth - 20, footerY, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    };

    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      drawFooter(p, totalPages);
    }

    const fileName = `Storno_${cancellation.cancellation_number}.pdf`;
    const filePath = path.join(INVOICE_DIR, fileName);
    const pdfOutput = doc.output('arraybuffer');
    fs.writeFileSync(filePath, Buffer.from(pdfOutput));
    db.prepare('UPDATE order_cancellations SET cancellation_path = ? WHERE id = ?').run(fileName, cancellationId);
    return filePath;
  } catch (e) {
    console.error('Error generating cancellation invoice:', e);
    return null;
  }
};

