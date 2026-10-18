import { jsPDF } from 'jspdf';
import path from 'path';
import fs from 'fs-extra';
import db, { DATA_DIR } from '../db.js';
import sharp from 'sharp';

// Ensure invoices directory exists
const INVOICE_DIR = path.join(DATA_DIR, 'invoices');
fs.ensureDirSync(INVOICE_DIR);

const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

export const generateInvoice = async (
    orderId: string,
    opts?: {
        forceRegenerate?: boolean;
        newInvoiceNumber?: string;
        subjectSuffix?: string; // z.B. "Rechnungskorrektur aus RE.2026-9980"
        overwriteInvoiceDate?: string;
        doNotSaveToOrder?: boolean;
        customFileName?: string;
        forceItems?: Array<{item_name: string; quantity: number; price: number; color?: string|null; size?: string|null; item_number?: string|null; notes?: string|null;}>;
        overwriteTotalAmount?: number; // Optional: Gesamtsumme der neuen Korrektur (wenn manuell geänderte Positionen)
        // Vorschau/Test: statt einer echten Bestellung werden die übergebenen Daten verwendet.
        // Es wird NICHTS in der Datenbank gespeichert.
        previewData?: {
            order: any;
            items: Array<{item_name: string; quantity: number; price: number; color?: string|null; size?: string|null; item_number?: string|null; notes?: string|null;}>;
        };
    }
): Promise<string | null> => {
    try {
        const isPreview = !!opts?.previewData?.order;

        // Fetch Order (oder Vorschau-Daten verwenden)
        const order = isPreview
            ? opts!.previewData!.order
            : (db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any);
        if (!order) throw new Error('Order not found');

        // --- forceItems (Admin manuell geänderte Positionen in Korrektur) ---
        // Wenn forceItems/previewData gesetzt → Komplett order_items ignorieren und diese verwenden!
        const hasForceItems = Array.isArray(opts?.forceItems) && opts.forceItems.length > 0;
        const hasPreviewItems = Array.isArray(opts?.previewData?.items) && opts!.previewData!.items.length > 0;
        let rawItems: any[] = [];
        if (hasPreviewItems) {
          rawItems = opts!.previewData!.items.map((fi, idx) => ({
            id: `preview-${idx}`,
            order_id: orderId,
            supplier_id: 'manual',
            item_name: fi.item_name,
            quantity: fi.quantity,
            price: fi.price,
            color: fi.color ?? null,
            size: fi.size ?? null,
            item_number: fi.item_number ?? null,
            notes: fi.notes ?? null,
            status: 'active',
            created_at: new Date().toISOString()
          }));
        } else if (hasForceItems) {
          rawItems = opts!.forceItems!.map((fi, idx) => ({
            id: `force-${orderId}-${idx}`,
            order_id: orderId,
            supplier_id: 'manual',
            item_name: fi.item_name,
            quantity: fi.quantity,
            price: fi.price,
            color: fi.color ?? null,
            size: fi.size ?? null,
            item_number: fi.item_number ?? null,
            notes: fi.notes ?? null,
            status: 'active',
            created_at: new Date().toISOString()
          }));
        } else {
          rawItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];
        }
        // --- Ende forceItems ---

        // ---- ROBUSTE NORMALISIERUNG (Fix für fehlende Spalten) ----
        // Sicherstellen dass JEDE Zeile IMMER item_name, quantity (≥1), price (Zahl) hat.
        const items: any[] = rawItems.map((it, idx) => {
          const safe: any = { ...it };

          // --- Menge: Sicherstellen, mindestens 1 ---
          let qty = Number(
            safe.quantity ?? safe.qty ?? safe.menge ?? safe.count ?? (safe.item_total && safe.price ? safe.item_total / safe.price : 1)
          );
          if (!isFinite(qty) || qty <= 0 || isNaN(qty)) qty = 1;
          safe.quantity = Math.round(qty);

          // --- Einzelpreis: Sicherstellen (Zahl) ---
          // Fallback-Reihenfolge: price → unit_price → einzelpreis → amount → item_total / Menge
          const qtySafe = safe.quantity || 1;
          let totalDiv = 0;
          const totalRaw = Number(safe.item_total ?? safe.total ?? safe.subtotal ?? NaN);
          if (isFinite(totalRaw) && !isNaN(totalRaw) && qtySafe > 0) {
            totalDiv = totalRaw / qtySafe;
          }
          let price = Number(
            safe.price ?? safe.unit_price ?? safe.einzelpreis ?? safe.amount ?? totalDiv
          );
          if (!isFinite(price) || isNaN(price)) price = 0;
          // Zusätzlich: Wenn item_total gesetzt und price * qty != total, korrigiere price an total
          if (safe.item_total != null || safe.total != null) {
            const knownTotal = Number(safe.item_total ?? safe.total ?? safe.subtotal);
            if (isFinite(knownTotal) && !isNaN(knownTotal) && knownTotal > 0 && knownTotal === knownTotal) {
              const computedTotal = +(price * qtySafe).toFixed(2);
              if (Math.abs(computedTotal - knownTotal) >= 0.01) {
                price = +(knownTotal / qtySafe).toFixed(4);
              }
            }
          }
          safe.price = +price.toFixed(2);

          // --- Artikel-Name: IMMER gesetzt (nie leer!) ---
          // Fallback-Reihenfolge: item_name → name → product_name → title → artikel → description
          let name = String(
            safe.item_name ?? safe.name ?? safe.product_name ?? safe.title ?? safe.artikel ?? safe.description ?? ''
          ).trim();
          if (!name) {
            name = `Artikel ${idx + 1}`;
          }
          safe.item_name = name;

          // --- Optionale Meta-Felder normalisieren (Größe/Farbe/Nummer/Notes) ---
          if (!safe.size && safe.size_name) safe.size = safe.size_name;
          if (!safe.size && safe.variant_size) safe.size = safe.variant_size;
          if (!safe.color && safe.color_name) safe.color = safe.color_name;
          if (!safe.item_number && safe.sku) safe.item_number = safe.sku;
          if (!safe.item_number && safe.variant_sku) safe.item_number = safe.variant_sku;
          // Notes (für Personalisierung): wenn nicht gesetzt, Fallback auf options / extras / personalization
          if (!safe.notes && typeof safe.options === 'string') safe.notes = safe.options;
          if (!safe.notes && typeof safe.extras === 'string') safe.notes = safe.extras;
          if (!safe.notes && typeof safe.personalization === 'string') safe.notes = safe.personalization;
          if (!safe.notes && safe.options && typeof safe.options === 'object') safe.notes = JSON.stringify(safe.options);
          if (!safe.notes && safe.personalization && typeof safe.personalization === 'object') safe.notes = JSON.stringify(safe.personalization);

          return safe;
        });
        // -------------------------------------------------------------

        // =========================================================================
        // 🔴 🔴 🔴 SHOP-DONATIONS PRIORITÄT (100% FIX)
        //
        // PROBLEM ALT: order_items war oft mit Dummy-Zeilen gefüllt (Name "Trainerset
        // Home" aber PRICE=0 / quantity=0). hasUsableItems hat diese fälschlicher-
        // weise als "verwertbar" eingestuft, weil der Name != "Artikel N" war.
        // Der shop_donations Fallback wurde also NIE ausgeführt.
        //
        // LÖSUNG: shop_donations wird JETZT DIREKT ALS ERSTES ABGEFRAGT.
        //  - Wenn es ≥1 Zeile shop_donations mit REALEM item_total>0 gibt,
        //    => IGNORIERE order_items KOMPLETT und nutze NUR shop_donations!
        //  - Nur wenn shop_donations leer ist oder nur 0€-Spenden hat:
        //    => Fallback auf (bereits normalisierte) order_items.
        // =========================================================================
        const orderTotal = Number(order.total_amount || 0);
        const orderShipping = Number(order.shipping_costs || 0);
        const itemsTotal = +(orderTotal - orderShipping).toFixed(2);

        let sdRows: any[] = [];
        try {
          sdRows = db.prepare(
            'SELECT id, order_id, item_name, item_number, quantity, item_total, donation_per_item, donation_total FROM shop_donations WHERE order_id = ? ORDER BY COALESCE(created_at, id) ASC'
          ).all(orderId) as any[];
        } catch (e) { /* ignore */ }

        const hasRealShopDonations = sdRows && sdRows.some((r) => {
          const total = Number(r.item_total || 0);
          const name = String(r.item_name || '').trim();
          return (total > 0.001 || (Number(r.donation_total || 0) > 0.001)) && name.length > 0;
        });

        if (hasRealShopDonations) {
          const shopDonationItems: any[] = [];
          let cumulatedTotal = 0;
          sdRows.forEach((row, idx) => {
            const qty = Math.max(1, Number(row.quantity || 1));
            let price = 0;
            if (row.item_total != null) {
              const t = Number(row.item_total || 0);
              if (isFinite(t) && !isNaN(t) && t >= 0) price = +(t / qty).toFixed(6);
            }
            const totalForRow = +(price * qty).toFixed(2);
            cumulatedTotal = +(cumulatedTotal + totalForRow).toFixed(2);

            shopDonationItems.push({
              id: `sd-${row.id || idx}`,
              order_id: orderId,
              supplier_id: 'shop',
              item_name: String(row.item_name || `Produkt ${idx+1}`).trim() || `Produkt ${idx+1}`,
              quantity: qty,
              price: +price.toFixed(2),
              color: null,
              size: null,
              notes: null,
              item_number: row.item_number || null
            });
          });

          // Summe korrigieren wenn nötig
          if (itemsTotal > 0 && Math.abs(cumulatedTotal - itemsTotal) > 0.01) {
            const diff = +(itemsTotal - cumulatedTotal).toFixed(2);
            const last = shopDonationItems[shopDonationItems.length - 1];
            if (last) {
              last.price = +(Number(last.price) + +(diff / Math.max(1, Number(last.quantity))).toFixed(6)).toFixed(2);
            }
          }

          // Items komplett ERSETZEN (altes order_items wird ignoriert!)
          console.warn(`[generateInvoice] Order ${orderId} (${order.order_number}): Nutze shop_donations (${shopDonationItems.length} Pos.) statt order_items – Gesamt €${itemsTotal}`);
          items.splice(0, items.length, ...shopDonationItems);
        }

        // --- 🔴 FALLBACK: Wenn (auch nach shop_donations) KEINE verwertbaren Items da sind ---
        const hasUsableItems = items.length > 0 && items.some((it) => {
          const isDummyName = /^(Artikel|Produkt)\s+\d+$/i.test(String(it.item_name || '').trim());
          const hasRealPrice = Number(it.price) > 0.001;
          const hasRealTotal = (Number(it.price) * Number(it.quantity || 1)) > 0.001;
          return hasRealPrice || hasRealTotal || !isDummyName;
        });

        if (!hasUsableItems) {
          let fallbackItems: any[] = [];
          // Wenn shop_donations zwar da, aber alle leer – dann aus shop_donations bauen
          if (sdRows && sdRows.length > 0) {
            let cumulatedTotal = 0;
            sdRows.forEach((row, idx) => {
              const qty = Math.max(1, Number(row.quantity || 1));
              let price = 0;
              if (row.item_total != null) {
                const t = Number(row.item_total || 0);
                if (isFinite(t) && !isNaN(t) && t >= 0) price = +(t / qty).toFixed(6);
              }
              const totalForRow = +(price * qty).toFixed(2);
              cumulatedTotal = +(cumulatedTotal + totalForRow).toFixed(2);
              fallbackItems.push({
                id: `sdfb-${row.id || idx}`,
                order_id: orderId,
                supplier_id: 'shop',
                item_name: String(row.item_name || `Produkt ${idx+1}`).trim() || `Produkt ${idx+1}`,
                quantity: qty,
                price: +price.toFixed(2),
                color: null,
                size: null,
                notes: null,
                item_number: row.item_number || null
              });
            });
            if (itemsTotal > 0 && Math.abs(cumulatedTotal - itemsTotal) > 0.01) {
              const diff = +(itemsTotal - cumulatedTotal).toFixed(2);
              const last = fallbackItems[fallbackItems.length - 1];
              if (last) last.price = +(Number(last.price) + +(diff / Math.max(1, Number(last.quantity))).toFixed(6)).toFixed(2);
            }
          }

          // Ultima Ratio: 1 Summen-Zeile aus Order-Ebene
          if (fallbackItems.length === 0 && itemsTotal > 0) {
            let name = String(order.description || order.title || '').trim();
            if (!name) name = `Bestellung ${order.order_number || order.id}`;
            if (/^Shop\s+Bestellung/i.test(name) && order.customer_name) {
              name = `${name.trim()} - ${order.customer_name.trim()}`;
            }
            fallbackItems.push({
              id: `fb-${orderId}-0`,
              order_id: orderId,
              supplier_id: 'manual',
              item_name: name,
              quantity: 1,
              price: +itemsTotal.toFixed(2),
              color: null,
              size: null,
              notes: null,
              item_number: null
            });
          }

          if (fallbackItems.length > 0) {
            console.warn(`[generateInvoice] Order ${orderId} (${order.order_number}): Ultima-Ratio Fallback (${fallbackItems.length} Pos., €${itemsTotal})`);
            items.splice(0, items.length, ...fallbackItems);
          }
        }
        // -----------------------------------------------------------------

        // Fetch Shop
        const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(order.shop_id) as any;

        // Fetch Customer (Shop Customer)
        const customer = db.prepare('SELECT * FROM shop_customers WHERE id = ?').get(order.shop_customer_id) as any;

        // Fetch Personalization Options Map
        const personalizationOptions = db.prepare('SELECT id, name FROM personalization_options').all() as {id: string, name: string}[];
        const optionMap = new Map(personalizationOptions.map(o => [o.id, o.name]));

        // Fetch Global Content (Company Info)
        const globalContent = db.prepare("SELECT * FROM global_shop_content WHERE id = 'main'").get() as any;

        // --- Rechnungs-Design (pro Shop, aus invoice.json des Design-Pakets) ---
        // Optionale Design-Daten. Fehlt etwas, bleibt das bewährte Standard-Layout aktiv.
        type InvoiceDesign = {
            logo_url?: string;
            primary_color?: string;
            muted_color?: string;
            text_color?: string;
            background_color?: string;
            background_image?: string;
            font_family?: string;
            font_file?: string;
            font_file_bold?: string;
            // Optionale Display-Schrift nur für die Überschrift (Rechnungstitel).
            // title_font_file = TTF aus dem ZIP, title_font_family = Name der Schrift.
            title_font_family?: string;
            title_font_file?: string;
            font_size_title?: number;
            font_size_footer?: number;
            header_company_name?: string;
            intro_text?: string;
            payment_note?: string;
            footer_note?: string;
            footer_website?: string;
        };
        let invoiceDesign: InvoiceDesign = {};
        if (shop?.custom_invoice_design) {
            try {
                const parsed = JSON.parse(shop.custom_invoice_design);
                if (parsed && typeof parsed === 'object') invoiceDesign = parsed;
            } catch {
                console.warn('[generateInvoice] custom_invoice_design ist kein gültiges JSON – Standard-Design wird verwendet.');
            }
        }
        const hexToRgb = (hex: string | undefined, fallback: [number, number, number]): [number, number, number] => {
            const m = String(hex || '').trim().match(/^#?([0-9a-f]{6})$/i);
            if (!m) return fallback;
            const int = parseInt(m[1], 16);
            return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
        };
        const accentRgb = hexToRgb(invoiceDesign.primary_color, [0, 0, 0]);
        const mutedRgb = hexToRgb(invoiceDesign.muted_color, [100, 100, 100]);
        const textRgb = hexToRgb(invoiceDesign.text_color, [0, 0, 0]);
        const bgRgb = invoiceDesign.background_color ? hexToRgb(invoiceDesign.background_color, [255, 255, 255]) : null;
        const designTitleSize = Number(invoiceDesign.font_size_title) || 16;
        const designFooterSize = Number(invoiceDesign.font_size_footer) || 6;
        const designCompanyName = invoiceDesign.header_company_name || globalContent?.company_name || shop?.name || 'Main Textildruck GmbH';

        // Datei aus dem Design-Paket des Shops (oder /uploads, /shop-assets, URL) auflösen.
        const resolvePackageAsset = (rel: string): string => {
            const s = String(rel || '').trim();
            if (!s || s.startsWith('http')) return '';
            if (s.startsWith('/uploads/')) return path.join(UPLOAD_DIR, s.replace(/^\/uploads\//, ''));
            if (s.startsWith('/shop-assets/')) return path.join(DATA_DIR, 'shop_templates', s.replace(/^\/shop-assets\//, ''));
            if (s.startsWith('/')) return path.join(process.cwd(), s);
            if (!shop?.id) return '';
            const root = path.join(DATA_DIR, 'shop_templates', shop.id);
            const target = path.resolve(root, s);
            // Pfad-Traversal-Schutz
            if (target !== path.resolve(root) && !target.startsWith(path.resolve(root) + path.sep)) return '';
            return target;
        };

        // Check if invoice number is already set
        const orderCheck = db.prepare('SELECT invoice_number, invoice_date FROM orders WHERE id = ?').get(orderId) as any;

        let invoiceNumber = opts?.newInvoiceNumber || orderCheck?.invoice_number || order.invoice_number;
        let invoiceDate = opts?.overwriteInvoiceDate || orderCheck?.invoice_date || order.invoice_date;
        const forceRegen = !!opts?.forceRegenerate;

        if (!invoiceNumber || forceRegen) {
            if (opts?.newInvoiceNumber) {
                invoiceNumber = opts.newInvoiceNumber;
            } else {
                // STRICT REQUIREMENT: Invoice Number = Order Number
                invoiceNumber = order.order_number;
            }
            invoiceDate = opts?.overwriteInvoiceDate || new Date().toISOString();

            console.log(`Assigning Invoice Number ${invoiceNumber} to Order ${orderId} (forceRegen=${forceRegen})`);

            // Update Order (im Vorschau-/Test-Modus nicht speichern)
            if (!opts?.doNotSaveToOrder && !isPreview) {
                db.prepare('UPDATE orders SET invoice_number = ?, invoice_date = ? WHERE id = ?').run(invoiceNumber, invoiceDate, orderId);
            }
        } else {
             console.log(`Order ${orderId} already has Invoice Number ${invoiceNumber}`);
        }

        // Create PDF
        const doc = new jsPDF({ compress: true });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // jsPDF arbeitet hier in Millimetern, Schriftgrößen aber in Punkten.
        // Alle Zeilenhöhen werden deshalb explizit umgerechnet (nie Punkt/mm mischen).
        const MM_PER_PT = 25.4 / 72;
        const lineHeightFor = (pt: number, factor = 1.2) => pt * factor * MM_PER_PT;

        // Textumbruch mit der TATSÄCHLICH aktiven Schrift und Schriftgröße.
        // Zu lange Einzelwörter (z.B. eine IBAN ohne Leerzeichen) werden zeichenweise
        // umbrochen – es wird niemals Text abgeschnitten.
        const wrapText = (text: string, maxWidth: number): string[] => {
            const raw = String(text ?? '');
            if (!raw.trim() || maxWidth <= 0) return [];
            const out: string[] = [];
            for (const paragraph of raw.split(/\r?\n/)) {
                const para = paragraph.trim();
                if (!para) continue;
                const segments = doc.splitTextToSize(para, maxWidth) as string[];
                for (const segment of segments) {
                    if (doc.getTextWidth(segment) <= maxWidth) {
                        out.push(segment);
                        continue;
                    }
                    let current = '';
                    for (const word of segment.split(' ')) {
                        const candidate = current ? `${current} ${word}` : word;
                        if (doc.getTextWidth(candidate) <= maxWidth) { current = candidate; continue; }
                        if (current) { out.push(current); current = ''; }
                        if (doc.getTextWidth(word) <= maxWidth) { current = word; continue; }
                        let chunk = '';
                        for (const ch of word) {
                            if (doc.getTextWidth(chunk + ch) <= maxWidth) chunk += ch;
                            else { if (chunk) out.push(chunk); chunk = ch; }
                        }
                        current = chunk;
                    }
                    if (current) out.push(current);
                }
            }
            return out;
        };

        // --- Schriftart ---
        // Optional: eigene TTF-Schriftart aus dem Design-Paket (invoice.json: font_file / font_file_bold).
        // Fallback: die in jsPDF eingebauten Schriften helvetica / times / courier.
        let baseFont = ['helvetica', 'times', 'courier'].includes(String(invoiceDesign.font_family || '').toLowerCase())
            ? String(invoiceDesign.font_family).toLowerCase()
            : 'helvetica';
        if (invoiceDesign.font_file) {
            try {
                const fontPath = resolvePackageAsset(invoiceDesign.font_file);
                if (fontPath && fs.existsSync(fontPath) && fontPath.toLowerCase().endsWith('.ttf')) {
                    const fontName = 'ShopFont';
                    doc.addFileToVFS('ShopFont.ttf', fs.readFileSync(fontPath).toString('base64'));
                    doc.addFont('ShopFont.ttf', fontName, 'normal');
                    // Fette Variante: eigene Datei, sonst dieselbe Datei
                    const boldPath = invoiceDesign.font_file_bold ? resolvePackageAsset(invoiceDesign.font_file_bold) : '';
                    const boldData = (boldPath && fs.existsSync(boldPath))
                        ? fs.readFileSync(boldPath).toString('base64')
                        : fs.readFileSync(fontPath).toString('base64');
                    doc.addFileToVFS('ShopFont-Bold.ttf', boldData);
                    doc.addFont('ShopFont-Bold.ttf', fontName, 'bold');
                    baseFont = fontName;
                } else {
                    console.warn('[generateInvoice] font_file nicht gefunden oder kein .ttf – Standard-Schrift wird verwendet.');
                }
            } catch (e) {
                console.warn('[generateInvoice] Schriftart konnte nicht eingebettet werden:', e);
            }
        }

        // --- Display-Schrift NUR für die Überschrift ---
        // Aus invoice.json: title_font_file (TTF aus dem ZIP) bzw. title_font_family.
        // Ohne Angabe bleibt für den Titel die normale Rechnungsschrift aktiv.
        let titleFont = baseFont;
        if (invoiceDesign.title_font_file) {
            try {
                const titleFontPath = resolvePackageAsset(invoiceDesign.title_font_file);
                if (titleFontPath && fs.existsSync(titleFontPath)) {
                    if (titleFontPath.toLowerCase().endsWith('.ttf')) {
                        const titleFontName = 'ShopTitleFont';
                        const titleFontData = fs.readFileSync(titleFontPath).toString('base64');
                        doc.addFileToVFS('ShopTitleFont.ttf', titleFontData);
                        doc.addFont('ShopTitleFont.ttf', titleFontName, 'normal');
                        // Display-Schriften haben oft nur einen Schnitt -> beide Stile auf dieselbe Datei legen
                        doc.addFont('ShopTitleFont.ttf', titleFontName, 'bold');
                        titleFont = titleFontName;
                    } else {
                        console.warn('[generateInvoice] title_font_file ist keine .ttf – jsPDF kann nur TTF einbetten. Titel nutzt Standard-Schrift.');
                    }
                } else {
                    console.warn('[generateInvoice] title_font_file nicht gefunden – Titel nutzt Standard-Schrift.');
                }
            } catch (e) {
                console.warn('[generateInvoice] Titel-Schriftart konnte nicht eingebettet werden:', e);
            }
        }
        if (titleFont === baseFont && invoiceDesign.title_font_family) {
            const fam = String(invoiceDesign.title_font_family).toLowerCase();
            if (['helvetica', 'times', 'courier'].includes(fam)) titleFont = fam;
        }

        // --- Hintergrund ---
        // Vorab als JPEG aufbereiten, damit er synchron vor jedem Seiteninhalt gezeichnet werden kann.
        let bgImageBuffer: Buffer | null = null;
        if (invoiceDesign.background_image) {
            try {
                const bgPath = resolvePackageAsset(invoiceDesign.background_image);
                if (bgPath && fs.existsSync(bgPath)) {
                    bgImageBuffer = await sharp(fs.readFileSync(bgPath))
                        .resize({ width: Math.round(pageWidth * 4), withoutEnlargement: false })
                        .flatten({ background: '#ffffff' })
                        .jpeg({ quality: 82 })
                        .toBuffer();
                }
            } catch (e) {
                console.warn('[generateInvoice] Hintergrundbild konnte nicht geladen werden:', e);
            }
        }
        const drawPageBackground = () => {
            if (bgImageBuffer) {
                try {
                    doc.addImage(bgImageBuffer, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
                    return true;
                } catch { /* Fallback auf Farbe */ }
            }
            if (bgRgb) {
                doc.setFillColor(bgRgb[0], bgRgb[1], bgRgb[2]);
                doc.rect(0, 0, pageWidth, pageHeight, 'F');
                return true;
            }
            return false;
        };

        // Fonts + Hintergrund für Seite 1
        doc.setFont(baseFont);
        drawPageBackground();

        // --- Header ---
        
        const resolveLocalPath = (urlOrPath: string) => {
            const p = String(urlOrPath || '');
            if (!p || p.startsWith('http')) return '';
            if (p.startsWith('/uploads/')) return path.join(UPLOAD_DIR, p.replace(/^\/uploads\//, ''));
            // Assets aus dem Design-Paket (ZIP) eines Shops: /shop-assets/<shopId>/...
            if (p.startsWith('/shop-assets/')) {
                return path.join(DATA_DIR, 'shop_templates', p.replace(/^\/shop-assets\//, ''));
            }
            if (p.startsWith('/')) return path.join(process.cwd(), p);
            return path.join(process.cwd(), p);
        };

        const mainLogoSetting = db.prepare("SELECT value FROM settings WHERE key = 'logo'").get() as any;
        const mainLogoUrl = mainLogoSetting?.value || '';
        const shopLogoUrl = invoiceDesign.logo_url || shop?.email_logo_url || shop?.logo_url || '';

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
        const headerY = 16;
        const senderBlockX = 20;
        const senderBlockWidth = 80;
        const headerLogoWidth = 36;
        const headerLogoX = senderBlockX + ((senderBlockWidth - headerLogoWidth) / 2);

        // Im Rechnungskopf immer nur EIN Logo:
        // 1. Shop-Logo, 2. Fallback auf Main-Textildruck-Logo.
        if (shopLogoUrl) {
            logoAdded = await tryAddLogo(shopLogoUrl, headerLogoX, headerY, headerLogoWidth);
        }
        if (!logoAdded && mainLogoUrl) {
            logoAdded = await tryAddLogo(mainLogoUrl, headerLogoX, headerY, headerLogoWidth);
        }

        if (!logoAdded) {
            doc.setFontSize(20);
            doc.setTextColor(200, 0, 0);
            doc.text("MAIN", 20, 30);
            doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
            doc.text("TEXTILDRUCK", 50, 30);
        }

        // Company Info (Right)
        doc.setFontSize(8); 
        doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
        const companyX = 140;
        const companyMaxWidth = pageWidth - 20 - companyX;
        let companyY = 25;

        // Firmierung und Adresse umbrechen, damit lange Angaben nicht aus der Seite laufen
        doc.setFont(baseFont, "bold");
        for (const line of wrapText(designCompanyName, companyMaxWidth)) {
            doc.text(line, companyX, companyY);
            companyY += 4;
        }
        doc.setFont(baseFont, "normal");
        
        // Handle multiline address
        const companyAddr = globalContent.company_address || '';
        const companyAddrLines = companyAddr.split('\n').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
        
        companyAddrLines.forEach((line: string) => {
            for (const wrapped of wrapText(line, companyMaxWidth)) {
                doc.text(wrapped, companyX, companyY);
                companyY += 4;
            }
        });

        for (const line of wrapText(`Telefon ${globalContent.contact_phone || ''}`, companyMaxWidth)) {
            doc.text(line, companyX, companyY);
            companyY += 4;
        }
        for (const line of wrapText(globalContent.contact_email || '', companyMaxWidth)) {
            doc.text(line, companyX, companyY);
            companyY += 4;
        }
        
        companyY += 4;
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
        // Absenderzeile auf die linke Spalte begrenzen und – falls nötig – mehrzeilig
        // oberhalb der Trennlinie zeichnen (kein Überlauf in die rechte Firmenspalte).
        const senderLineH = lineHeightFor(7, 1.2);
        const senderLines = wrapText(`${globalContent.company_name || 'Main Textildruck GmbH'} - ${flatAddress}`, companyX - 20 - 6);
        const senderLastY = 60;
        let senderY = Math.max(senderLastY - (senderLines.length - 1) * senderLineH, 46);
        for (const line of senderLines) {
            if (senderY > senderLastY) break;
            doc.text(line, 20, senderY);
            senderY += senderLineH;
        }
        
        // Line under sender address
        doc.setLineWidth(0.1);
        doc.line(20, 62, 100, 62); // Made slightly longer

        // Delivery Address
        doc.setFontSize(10);
        // Anschrift auf Druckbreite umbrechen, damit auch lange Adressen vollständig erscheinen.
        const addressMaxWidth = pageWidth - 40;
        const addressLines = (order.customer_address || '').split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
        let addrY = 70; // Moved up from 75

        if (order.company) {
            for (const line of wrapText(order.company, addressMaxWidth)) {
                doc.text(line, 20, addrY);
                addrY += 5;
            }
        }
        for (const line of wrapText(order.customer_name, addressMaxWidth)) {
            doc.text(line, 20, addrY);
            addrY += 5;
        }
        // Split address nicely – alle Teile ausgeben (Straße, PLZ/Ort, …)
        addressLines.forEach((part, idx) => {
            if (idx > 0) addrY += 5;
            for (const line of wrapText(part, addressMaxWidth)) {
                doc.text(line, 20, addrY);
                addrY += 5;
            }
        });
        doc.text('Deutschland', 20, addrY);

        // --- Titel: Display-Schrift NUR hier aktiv, danach zurück zur Rechnungsschrift ---
        const titleText = opts?.subjectSuffix
            ? `${opts.subjectSuffix}`
            : `Rechnung Nr. ${invoiceNumber}`;
        doc.setTextColor(accentRgb[0], accentRgb[1], accentRgb[2]);
        doc.setFont(titleFont, "bold");
        doc.setFontSize(designTitleSize);
        const titleLineH = lineHeightFor(designTitleSize, 1.15);
        // Titel beginnt unterhalb des Anschriftblocks (auch bei mehrzeiligen Adressen)
        let titleY = Math.max(110, addrY + 10);
        for (const line of wrapText(titleText, pageWidth - 40)) {
            doc.text(line, 20, titleY);
            titleY += titleLineH;
        }
        // Zurück zur normalen Rechnungsschrift
        doc.setFont(baseFont, "normal");
        doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);

        // --- Einleitungstext auf Druckbreite umbrechen ---
        doc.setFontSize(10);
        const introLineH = lineHeightFor(10, 1.25);
        let introY = titleY + 2;
        if (opts?.subjectSuffix) {
            doc.text(`Rechnungs-Nr. ${invoiceNumber}`, 20, introY);
            introY += introLineH;
            for (const line of wrapText("Aufgrund der geänderten Rechnungsadresse stellen wir Ihnen die korrigierte Rechnung wie folgt zu:", pageWidth - 40)) {
                doc.text(line, 20, introY);
                introY += introLineH;
            }
        } else {
            const introText = invoiceDesign.intro_text || "Wir erlauben uns, Ihnen folgende Leistungen in Rechnung zu stellen:";
            for (const line of wrapText(introText, pageWidth - 40)) {
                doc.text(line, 20, introY);
                introY += introLineH;
            }
        }

        // --- Fußzeile: Blöcke VORAB umbrechen, damit die benötigte Höhe bekannt ist ---
        // So kann der Bereich auf jeder Seite reserviert und von Tabelle/Summen/
        // Zahlungsdaten freigehalten werden.
        const footerLineH = lineHeightFor(designFooterSize, 1.25);
        const footerGap = 8;            // Mindestabstand zwischen Inhalt und Fußzeile
        const footerPageNoLine = 5;     // reservierte Höhe der Seitenzahl-Zeile
        const footerBottomMargin = 10;  // Abstand der Seitenzahl zum unteren Seitenrand

        // Spaltenpositionen wie bisher, Breite = Abstand zur nächsten Spalte minus Spaltenabstand.
        const footerColGap = 4;
        const footerCols = [
            { x: 20, width: 45 - footerColGap },
            { x: 65, width: 45 - footerColGap },
            { x: 110, width: 45 - footerColGap },
            { x: 155, width: (pageWidth - 15) - 155 }
        ];

        // IBAN in 4er-Gruppen mit Leerzeichen -> Umbruch an Leerzeichen möglich.
        const formatIban = (value: string) =>
            String(value || '').replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();

        type FooterLine = { text: string; bold: boolean };
        const buildFooterColumn = (
            col: { x: number; width: number },
            title: string,
            blocks: Array<string | null | undefined>
        ): FooterLine[] => {
            const lines: FooterLine[] = [];
            if (title) {
                doc.setFont(baseFont, "bold");
                wrapText(title, col.width).forEach((t) => lines.push({ text: t, bold: true }));
            }
            doc.setFont(baseFont, "normal");
            for (const block of blocks) {
                const value = String(block ?? '').trim();
                if (!value) continue;
                if (value === 'IBAN:') continue;
                wrapText(value, col.width).forEach((t) => lines.push({ text: t, bold: false }));
            }
            return lines;
        };

        doc.setFontSize(designFooterSize);
        doc.setFont(baseFont, "normal");
        const footerColumns: FooterLine[][] = [
            buildFooterColumn(footerCols[0], '', [
                globalContent?.company_name || shop?.name || '',
                globalContent?.company_address || '',
                globalContent?.ceo_name ? `GF: ${globalContent.ceo_name}` : ''
            ]),
            buildFooterColumn(footerCols[1], 'Kontakt', [
                globalContent?.contact_email || '',
                globalContent?.contact_phone || '',
                invoiceDesign.footer_website || 'www.maintextildruck.com'
            ]),
            buildFooterColumn(footerCols[2], 'Bankverbindung', [
                globalContent?.bank_name || '',
                globalContent?.bank_iban ? `IBAN: ${formatIban(globalContent.bank_iban)}` : '',
                globalContent?.bank_bic ? `BIC: ${globalContent.bank_bic}` : ''
            ]),
            buildFooterColumn(footerCols[3], 'Register & Steuer', [
                globalContent?.tax_number ? `Steuer-Nr: ${globalContent.tax_number}` : '',
                globalContent?.vat_id ? `USt-ID: ${globalContent.vat_id}` : '',
                globalContent?.commercial_register ? `HRB: ${globalContent.commercial_register}` : ''
            ])
        ];
        // Höchste Spalte bestimmt den Anfang der Fußzeile.
        const footerHeight = footerColumns.reduce((max, lines) => Math.max(max, lines.length * footerLineH), 0);
        const footerY = pageHeight - footerBottomMargin - footerPageNoLine - footerHeight;
        const bottomLimit = Math.max(footerY - footerGap, 100);

        // --- Table ---
        let y = Math.max(introY + 5, 130);

        const drawTableHeader = (yPos: number) => {
            doc.setFontSize(9);
            doc.setFont(baseFont, "bold");
            doc.text("Pos.", 20, yPos);
            doc.text("Bezeichnung", 40, yPos);
            doc.text("Menge", 130, yPos, { align: 'right' });
            doc.text("Einzelpreis", 160, yPos, { align: 'right' });
            doc.text("Gesamtpreis", 195, yPos, { align: 'right' });
            doc.setDrawColor(accentRgb[0], accentRgb[1], accentRgb[2]);
            doc.line(20, yPos + 2, 195, yPos + 2);
            doc.setDrawColor(0, 0, 0);
            doc.setFont(baseFont, "normal");
            return yPos + 8;
        };

        const drawContinuationHeader = () => {
            doc.setFontSize(10);
            // Der Rechnungstitel bleibt auch auf Folgeseiten in der Display-Schrift.
            doc.setFont(titleFont, "bold");
            doc.text(
                opts?.subjectSuffix ? opts.subjectSuffix : `Rechnung Nr. ${invoiceNumber}`,
                20, 18
            );
            doc.setFont(baseFont, "normal");
            doc.setFontSize(8);
            doc.text(`Bestell-Nr. ${order.order_number}`, 195, 18, { align: 'right' });
        };

        const addPageForTable = () => {
            doc.addPage();
            drawPageBackground();
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
                drawPageBackground();
                drawContinuationHeader();
                y = 28;
            }
        };
        
        y = drawTableHeader(y);

        // Items
        let subtotal = 0;

        items.forEach((item, index) => {
            doc.setFont(baseFont, "normal");
            doc.setFontSize(9);
            doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);

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
                doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
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

        doc.setFont(baseFont, "bold");
        doc.text("Gesamtbetrag:", 160, y, { align: 'right' });
        doc.text(`${grossTotal.toFixed(2).replace('.', ',')} €`, 195, y, { align: 'right' });
        doc.setFont(baseFont, "normal");
        
        y += 15;

        // Payment Info
        ensureSpace(30, false);
        doc.text(invoiceDesign.payment_note || "Bitte bei Zahlung angeben!", 20, y);
        y += 5;
        doc.text(`Verwendungszweck: ${invoiceNumber}`, 20, y);
        y += 10;
        
        if (order.payment_method) {
             doc.text(`Zahlungsart: ${order.payment_method}`, 20, y);
             y += 5;
        }
        
        const footerNoteLines = wrapText(invoiceDesign.footer_note || "Die Ware bleibt bis zur vollständigen Bezahlung unser Eigentum.", 175);
        ensureSpace(footerNoteLines.length * 5 + 2, false);
        for (const line of footerNoteLines) {
            doc.text(line, 20, y);
            y += 5;
        }

        const drawFooter = (pageNo: number, totalPages: number) => {
            doc.setFontSize(designFooterSize);
            doc.setTextColor(mutedRgb[0], mutedRgb[1], mutedRgb[2]);

            // Jeder Block startet unter der tatsächlichen Höhe des vorherigen Blocks.
            footerColumns.forEach((lines, idx) => {
                const col = footerCols[idx];
                let lineY = footerY;
                for (const line of lines) {
                    doc.setFont(baseFont, line.bold ? 'bold' : 'normal');
                    doc.text(line.text, col.x, lineY);
                    lineY += footerLineH;
                }
            });

            // Seitenzahl separat unterhalb der Fußzeilen-Blöcke
            doc.setFont(baseFont, 'normal');
            doc.setTextColor(150);
            doc.text(`Seite ${pageNo} / ${totalPages}`, pageWidth - 20, pageHeight - footerBottomMargin + 3, { align: 'right' });
            doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
        };

        const totalPages = doc.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            drawFooter(p, totalPages);
        }

        // Save PDF
        const safeInvoiceNumber = String(invoiceNumber || orderId).replace(/[^\w\-]/g, '_');
        const fileName = opts?.customFileName
            ? opts.customFileName
            : `Rechnung_${safeInvoiceNumber}.pdf`;
        const filePath = path.join(INVOICE_DIR, fileName);

        // Output as Buffer and write to file
        const pdfOutput = doc.output('arraybuffer');
        fs.writeFileSync(filePath, Buffer.from(pdfOutput));

        // Update Order with path (im Vorschau-/Test-Modus nicht speichern)
        if (!opts?.doNotSaveToOrder && !isPreview) {
            db.prepare('UPDATE orders SET invoice_path = ? WHERE id = ?').run(fileName, orderId);
        }

        return filePath;

    } catch (e) {
        console.error('Error generating invoice:', e);
        return null;
    }
};
