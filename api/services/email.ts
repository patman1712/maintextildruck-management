import nodemailer from 'nodemailer';
import db from '../db.js';
import { Resend } from 'resend';
import fs from 'fs-extra';
import { withResolvedItemImages } from './orderImages.js';

interface EmailConfig {
    smtp_host: string;
    smtp_port: number;
    smtp_user: string;
    smtp_pass: string;
    smtp_secure: boolean;
    sender_name: string;
    sender_email: string;
    resend_api_key?: string;
    ignore_certs?: boolean;
}

const getEmailConfig = (): EmailConfig | null => {
    try {
        const config = db.prepare("SELECT * FROM email_config WHERE id = 'main'").get() as any;
        if (!config) return null;
        return {
            smtp_host: config.smtp_host,
            smtp_port: config.smtp_port || 587,
            smtp_user: config.smtp_user,
            smtp_pass: config.smtp_pass,
            smtp_secure: Boolean(config.smtp_secure),
            sender_name: config.sender_name || 'Main Textildruck',
            sender_email: config.sender_email || config.smtp_user,
            resend_api_key: config.resend_api_key,
            ignore_certs: Boolean(config.ignore_certs)
        };
    } catch (e) {
        console.error('Error fetching email config:', e);
        return null;
    }
};

const normalizeRecipientList = (value: string | string[]) => {
    const joined = Array.isArray(value) ? value.join(',') : value;
    return joined
        .split(/[,\n;\s]+/g)
        .map(s => s.trim())
        .filter(Boolean)
        .filter(s => s.includes('@'));
};

// ============================================
// Kundenspezifische E-Mail-Vorlage (pro Shop)
// ============================================
// Über das Design-Template-Paket kann ein Shop eine eigene "email.html" mitliefern.
// Diese wird als Rahmen um alle Kunden-Mails gelegt (Header/Footer/Farben/Schrift).
// Platzhalter: {{content}}, {{shop_name}}, {{customer_name}}, {{order_number}},
// {{subject}}, {{year}}, {{logo_url}}, {{email_logo_url}}, {{primary_color}},
// {{secondary_color}}, {{footer_text}}. In Bestell-Mails zusätzlich
// {{order_items_html}} (Positionen inkl. Variantenbild), {{order_totals_html}}
// (Summenübersicht) und {{order_progress_html}} (Fortschrittsanzeige aus dem
// tatsächlichen Bestellstatus). Ohne eigene Vorlage bleibt alles unverändert.
// In Kontakt-Mails (ohne Bestellbezug) bleibt {{order_progress_html}} leer.
const extractBodyInner = (html: string): string => {
    const m = String(html || '').match(/<body[^>]*>([\s\S]*)<\/body>/i);
    return m ? m[1] : String(html || '');
};

const getShopEmailFrame = (shopId: string | null | undefined): string | null => {
    if (!shopId) return null;
    try {
        const row = db.prepare('SELECT custom_email_html FROM shops WHERE id = ?').get(shopId) as any;
        const frame = (row?.custom_email_html || '').trim();
        return frame || null;
    } catch {
        return null;
    }
};

// ----- Bausteine für Bestellpositionen & Summen (auch als email.html-Platzhalter) -----
const escapeHtml = (value: any) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const formatEur = (n: number) => `${(Number(n) || 0).toFixed(2).replace('.', ',')} €`;

// Artikel-Tabelle: Variantenbild, Artikelname, Größe/Farbe, Menge und Preise.
const buildOrderItemsHtml = (items: any[]): string => {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return '';
    const rows = list.map((it) => {
        const qty = Number(it.quantity) || 0;
        const price = Number(it.price) || 0;
        const variant = [
            it.size ? `Größe: ${escapeHtml(it.size)}` : '',
            it.color ? `Farbe: ${escapeHtml(it.color)}` : ''
        ].filter(Boolean).join(' · ');
        const imageCell = it.image
            ? `<img src="${escapeHtml(it.image)}" alt="${escapeHtml(it.item_name || '')}" width="48" height="48" style="width:48px; height:48px; object-fit:cover; border-radius:6px; border:1px solid #e2e8f0; display:block;">`
            : `<div style="width:48px; height:48px; border-radius:6px; border:1px solid #e2e8f0; background:#f1f5f9;"></div>`;
        return `<tr>
            <td style="padding:8px; border-bottom:1px solid #eee; word-break:break-word;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>
                <td style="vertical-align:top; padding-right:10px;">${imageCell}</td>
                <td style="vertical-align:top;">
                  <div style="font-weight:700; color:#0f172a; word-break:break-word;">${escapeHtml(it.item_name || '')}</div>
                  ${variant ? `<div style="color:#64748b; font-size:12px; margin-top:2px; word-break:break-word;">${variant}</div>` : ''}
                </td>
              </tr></table>
            </td>
            <td style="padding:8px; border-bottom:1px solid #eee; text-align:right; white-space:nowrap;">${qty}</td>
            <td style="padding:8px; border-bottom:1px solid #eee; text-align:right; white-space:nowrap;">${formatEur(price)}</td>
            <td style="padding:8px; border-bottom:1px solid #eee; text-align:right; white-space:nowrap;">${formatEur(qty * price)}</td>
          </tr>`;
    }).join('');
    return `<table style="width:100%; border-collapse:collapse; font-size:14px;">
        <thead>
          <tr style="background:#f1f5f9; color:#334155;">
            <th style="padding:8px; text-align:left; word-break:break-word;">Artikel</th>
            <th style="padding:8px; text-align:right; white-space:nowrap; width:56px;">Menge</th>
            <th style="padding:8px; text-align:right; white-space:nowrap; width:88px;">Einzelpreis</th>
            <th style="padding:8px; text-align:right; white-space:nowrap; width:88px;">Summe</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
};

// Summenübersicht: Warenwert, Versandkosten, ggf. Rabatt und Gesamtbetrag.
const buildOrderTotalsHtml = (order: any, items: any[]): string => {
    const list = Array.isArray(items) ? items : [];
    const itemsSubtotal = list.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0);
    const shippingCosts = Number(order?.shipping_costs) || 0;
    const discountAmount = Number(order?.discount_amount) || 0;
    const totalAmount = Number(order?.total_amount) || 0;
    return `<table style="width:100%; border-collapse:collapse; font-size:14px; margin-top:12px;">
        <tr><td style="padding:4px 8px 4px 0; color:#64748b;">Warenwert</td><td style="padding:4px 0; text-align:right;">${formatEur(itemsSubtotal)}</td></tr>
        <tr><td style="padding:4px 8px 4px 0; color:#64748b;">Versandkosten</td><td style="padding:4px 0; text-align:right;">${formatEur(shippingCosts)}</td></tr>
        ${discountAmount > 0 ? `<tr><td style="padding:4px 8px 4px 0; color:#64748b;">Rabatt${order?.voucher_code ? ` (${escapeHtml(order.voucher_code)})` : ''}</td><td style="padding:4px 0; text-align:right;">-${formatEur(discountAmount)}</td></tr>` : ''}
        <tr><td style="padding:8px 8px 8px 0; border-top:2px solid #0f172a; font-weight:800; font-size:16px;">Gesamtbetrag</td><td style="padding:8px 0; border-top:2px solid #0f172a; text-align:right; font-weight:800; font-size:16px;">${formatEur(totalAmount)}</td></tr>
      </table>`;
};

// Fortschrittsanzeige für Bestell-Mails (E-Mail-kompatibel: Tabellenlayout + Inline-CSS).
// Basiert ausschließlich auf dem tatsächlichen Bestell-/Produktionsstatus:
//  - Versand und Abholung werden getrennt berücksichtigt (unterschiedliche Schritte).
//  - Der Zahlungsstatus wird separat ausgewiesen und NICHT mit dem Produktionsstatus gleichgesetzt.
//  - Es wird keine Zustellung/Abholung behauptet, solange keine bestätigten Daten vorliegen
//    (Endschritt ist "Versendet" bzw. "Abholbereit", nicht "Zugestellt"/"Abgeholt").
const buildOrderProgressHtml = (order: any): string => {
    if (!order) return '';

    const status = String(order.status || '').toLowerCase().trim();
    const isCancelled = status === 'cancelled' || status === 'storniert';
    const paymentStatus = String(order.payment_status || '').toLowerCase().trim();
    const isPaid = paymentStatus === 'paid' || paymentStatus === 'completed' || paymentStatus === 'bezahlt';
    const isPickup = String(order.shipping_method || 'dhl').toLowerCase().trim() === 'pickup';
    const paymentPending = status === 'pending_payment';
    const inProgress = !isCancelled && !paymentPending; // Bestellung angenommen und in Bearbeitung
    const shipped = status === 'shipped' || !!order.shipped_at;
    const pickupReady = String(order.pickup_status || '').toLowerCase().trim() === 'ready';

    const DONE = '#16a34a';
    const LINE_TODO = '#e2e8f0';
    const CIRCLE_TODO_BG = '#e2e8f0';
    const CIRCLE_TODO_FG = '#94a3b8';

    if (isCancelled) {
        return `<div style="border:1px solid #fecaca; border-radius:10px; padding:16px; margin:16px 0; background:#fef2f2;">
            <div style="font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#b91c1c; margin-bottom:6px;">Bestellstatus</div>
            <div style="font-size:14px; font-weight:700; color:#b91c1c;">Diese Bestellung wurde storniert.</div>
        </div>`;
    }

    const steps: { label: string; done: boolean }[] = isPickup
        ? [
            { label: 'Bestellung eingegangen', done: true },
            { label: 'In Bearbeitung', done: inProgress },
            { label: 'Abholbereit', done: pickupReady }
        ]
        : [
            { label: 'Bestellung eingegangen', done: true },
            { label: 'In Bearbeitung', done: inProgress },
            { label: 'Versendet', done: shipped }
        ];

    const firstOpen = steps.findIndex((s) => !s.done);
    const last = steps.length - 1;

    const lineDiv = (color: string) =>
        color ? `<div style="height:2px; line-height:2px; font-size:0; background:${color};">&nbsp;</div>` : '';

    const cells = steps.map((step, i) => {
        const state = step.done ? 'done' : (i === firstOpen ? 'current' : 'pending');
        const bg = state === 'pending' ? CIRCLE_TODO_BG : DONE;
        const fg = state === 'pending' ? CIRCLE_TODO_FG : '#ffffff';
        const content = state === 'done' ? '&#10003;' : (i + 1);
        const circle = `<div style="width:28px; height:28px; border-radius:14px; background:${bg}; color:${fg}; font-size:13px; font-weight:700; line-height:28px; text-align:center; margin:0 auto;">${content}</div>`;
        const leftLine = i === 0 ? '' : lineDiv(step.done ? DONE : LINE_TODO);
        const rightLine = i === last ? '' : lineDiv(steps[i + 1].done ? DONE : LINE_TODO);
        const labelColor = state === 'pending' ? '#94a3b8' : '#0f172a';
        const labelWeight = state === 'pending' ? 500 : 700;
        const width = i === last ? '34%' : '33%';
        return `<td width="${width}" valign="top" align="center" style="padding:0 2px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td width="50%" height="28" valign="middle" style="height:28px; vertical-align:middle; font-size:0; line-height:0;">${leftLine}</td>
                <td width="28" valign="middle" align="center" style="width:28px; vertical-align:middle; font-size:0;">${circle}</td>
                <td width="50%" height="28" valign="middle" style="height:28px; vertical-align:middle; font-size:0; line-height:0;">${rightLine}</td>
              </tr>
            </table>
            <div style="font-size:12px; line-height:1.35; margin-top:8px; font-weight:${labelWeight}; color:${labelColor};">${step.label}</div>
        </td>`;
    }).join('');

    const paymentLine = `<div style="margin-top:14px; padding-top:12px; border-top:1px solid #e2e8f0; font-size:13px; color:#475569;">
        Zahlung: <span style="font-weight:700; color:${isPaid ? '#16a34a' : '#d97706'};">${isPaid ? 'Bezahlt' : 'Offen'}</span>
      </div>`;

    return `<div style="border:1px solid #e2e8f0; border-radius:10px; padding:16px; margin:16px 0; background:#ffffff;">
        <div style="font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#94a3b8; margin-bottom:14px;">Bestellstatus</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>${cells}</tr>
        </table>
        ${paymentLine}
      </div>`;
};

// Prüft, ob die eigene email.html-Vorlage eines Shops einen Platzhalter verwendet.
// Damit werden die gleichen Angaben im Standard-Inhalt nicht doppelt ausgegeben.
const shopEmailFrameUsesPlaceholder = (shopId: string | null | undefined, key: string): boolean => {
    const frame = getShopEmailFrame(shopId);
    if (!frame) return false;
    return new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`).test(frame);
};

// Liefert Bestellpositionen, Summenübersicht und Fortschrittsanzeige als
// email.html-Platzhalter. Die Bilder werden auf absolute, öffentlich erreichbare
// URLs aufgelöst (inkl. Fallback über Produkt + Variante bei älteren Positionen
// ohne Bild). Der Fortschritt wird aus dem tatsächlichen Bestellstatus erzeugt.
const buildOrderEmailPlaceholders = (order: any, items: any[]): Record<string, string> => {
    const resolvedItems = withResolvedItemImages(items, order?.shop_id);
    return {
        order_items_html: buildOrderItemsHtml(resolvedItems),
        order_totals_html: buildOrderTotalsHtml(order, resolvedItems),
        order_progress_html: buildOrderProgressHtml(order)
    };
};

export const applyShopEmailFrame = (
    shopId: string | null | undefined,
    vars: Record<string, string>,
    contentHtml: string
): string => {
    const frame = getShopEmailFrame(shopId);
    if (!frame) return contentHtml;
    // Fertiges Logo-Markup (Bild oder Shopname), damit die Vorlage kein eigenes Markup braucht.
    const logoUrl = (vars.logo_url || vars.email_logo_url || '').trim();
    const shopName = vars.shop_name || '';
    const logoHtml = logoUrl
        ? `<img src="${logoUrl}" alt="${shopName}" style="max-height:64px; max-width:220px;">`
        : `<div style="font-size:20px; font-weight:800; color:#ffffff;">${shopName}</div>`;
    const allVars: Record<string, string> = {
        ...vars,
        logo_html: logoHtml,
        content: extractBodyInner(contentHtml)
    };
    return frame.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => (key in allVars ? String(allVars[key]) : ''));
};

const sendEmailWithInvoice = async (opts: {
    to: string[];
    subject: string;
    text: string;
    html: string;
    invoicePath?: string | null;
    invoiceFilename?: string;
    replyTo?: string | null;
}) => {
    const config = getEmailConfig();
    if (!config) {
        console.warn('Email configuration missing. Skipping email sending.');
        return false;
    }

    const toList = opts.to.filter(Boolean);
    if (toList.length === 0) return false;

    try {
        if (config.resend_api_key && config.resend_api_key.startsWith('re_')) {
            const resend = new Resend(config.resend_api_key);
            const attachments: any[] = [];
            if (opts.invoicePath) {
                const pdfBuffer = await fs.readFile(opts.invoicePath);
                attachments.push({
                    filename: opts.invoiceFilename || 'Rechnung.pdf',
                    content: pdfBuffer
                });
            }

            let fromAddress = `${config.sender_name} <${config.sender_email}>`;

            try {
                const { data, error } = await resend.emails.send({
                    from: fromAddress,
                    to: toList,
                    subject: opts.subject,
                    text: opts.text,
                    html: opts.html,
                    replyTo: opts.replyTo || undefined,
                    attachments: attachments.length ? attachments : undefined
                } as any);

                if (error) {
                    console.error('Resend send failed:', error.message || error);
                    const { data: fallbackData, error: fallbackError } = await resend.emails.send({
                        from: 'onboarding@resend.dev',
                        to: toList,
                        subject: opts.subject,
                        text: opts.text,
                        html: opts.html,
                        replyTo: opts.replyTo || undefined,
                        attachments: attachments.length ? attachments : undefined
                    } as any);

                    if (fallbackError) {
                        console.error('Resend fallback failed:', fallbackError.message || fallbackError);
                        return false;
                    }
                    console.log('Resend Email sent (Fallback):', fallbackData?.id);
                    return true;
                }

                console.log('Resend Email sent:', data?.id);
                return true;
            } catch (e: any) {
                console.error('Resend exception:', e?.message || e);
                return false;
            }
        }

        if (config.smtp_host) {
            const transporter = nodemailer.createTransport({
                host: config.smtp_host,
                port: config.smtp_port,
                secure: config.smtp_secure,
                auth: {
                    user: config.smtp_user,
                    pass: config.smtp_pass,
                },
                tls: {
                    rejectUnauthorized: !config.ignore_certs
                }
            });

            const attachments: any[] = [];
            if (opts.invoicePath) {
                attachments.push({
                    filename: opts.invoiceFilename || 'Rechnung.pdf',
                    path: opts.invoicePath
                });
            }

            await transporter.sendMail({
                from: `"${config.sender_name}" <${config.sender_email}>`,
                to: toList.join(', '),
                subject: opts.subject,
                text: opts.text,
                html: opts.html,
                replyTo: opts.replyTo || undefined,
                attachments: attachments.length ? attachments : undefined
            });
            return true;
        }

        return false;
    } catch (e) {
        console.error('Error sending email:', e);
        return false;
    }
};

// Fallback-Empfänger, wenn im Shop keine eigene Kontakt-E-Mail hinterlegt ist
export const DEFAULT_SHOP_CONTACT_RECIPIENT = 'info@maintextildruck.com';

// Kontaktformular eines Onlineshops: leitet die Nachricht an die im Shop hinterlegte
// E-Mail-Adresse weiter (oder an die Firmen-Standardadresse als Fallback).
// Wird mit der optionalen Shop-E-Mail-Vorlage (email.html) umrahmt; die Kontaktdaten
// und die Nachricht landen im Platzhalter {{content}}.
export const sendShopContactMessage = async (opts: {
    to: string;
    shopId?: string | null;
    shopName: string;
    firstName?: string;
    lastName?: string;
    email: string;
    subject?: string;
    message: string;
    replyTo?: string;
    branding?: {
        logo_url?: string;
        email_logo_url?: string;
        primary_color?: string;
        secondary_color?: string;
        footer_text?: string;
    };
}): Promise<boolean> => {
    const fullName = [opts.firstName, opts.lastName].filter(Boolean).join(' ').trim();
    const subject = `[Shop-Kontakt] ${opts.subject || 'Neue Nachricht'} – ${opts.shopName}`;

    const text = [
        `Neue Nachricht über das Kontaktformular des Shops "${opts.shopName}".`,
        '',
        `Name:    ${fullName || '-'}`,
        `E-Mail:  ${opts.email}`,
        `Betreff: ${opts.subject || '-'}`,
        '',
        'Nachricht:',
        opts.message,
    ].join('\n');

    const esc = (value: string) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br />');

    const contentHtml = `
        <div style="font-family: Arial, Helvetica, sans-serif; color: #0f172a; line-height: 1.6;">
            <h2 style="margin: 0 0 12px;">Neue Kontaktanfrage</h2>
            <p style="margin: 0 0 16px; color: #475569;">
                Über das Kontaktformular des Shops <strong>${esc(opts.shopName)}</strong> ist eine neue Nachricht eingegangen.
            </p>
            <table style="border-collapse: collapse; margin-bottom: 16px;">
                <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Name</td><td style="padding: 4px 0;">${esc(fullName) || '-'}</td></tr>
                <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">E-Mail</td><td style="padding: 4px 0;">${esc(opts.email)}</td></tr>
                <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Betreff</td><td style="padding: 4px 0;">${esc(opts.subject || '-')}</td></tr>
            </table>
            <div style="border-left: 3px solid #0f172a; padding: 4px 0 4px 12px; white-space: pre-wrap;">${esc(opts.message)}</div>
        </div>
    `;

    // Eigene Shop-E-Mail-Vorlage (email.html) anwenden, sonst Standard-HTML beibehalten.
    const html = applyShopEmailFrame(opts.shopId, {
        shop_name: opts.shopName,
        customer_name: fullName,
        subject,
        year: String(new Date().getFullYear()),
        logo_url: opts.branding?.logo_url || '',
        email_logo_url: opts.branding?.email_logo_url || '',
        primary_color: opts.branding?.primary_color || '',
        secondary_color: opts.branding?.secondary_color || '',
        footer_text: opts.branding?.footer_text || '',
    }, contentHtml);

    return await sendEmailWithInvoice({
        to: [opts.to],
        subject,
        text,
        html,
        invoicePath: null,
        replyTo: opts.replyTo,
    });
};

export const sendOrderConfirmation = async (orderId: string, invoicePath: string) => {
    const config = getEmailConfig();
    if (!config) {
        console.warn('Email configuration missing. Skipping email sending.');
        return false;
    }

    try {
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
        if (!order || !order.customer_email) {
            console.warn('Order or customer email missing.');
            return false;
        }

        // Fetch Shop Branding if available
        let branding = {
            logo_url: '',
            email_logo_url: '',
            primary_color: '#3b82f6', // blue-500 default
            secondary_color: '#1e40af', // darker blue default
            company_name: config.sender_name,
            footer_text: ''
        };

        if (order.shop_id) {
            const shop = db.prepare('SELECT logo_url, email_logo_url, primary_color, secondary_color, name FROM shops WHERE id = ?').get(order.shop_id) as any;
            if (shop) {
                if (shop.logo_url && shop.logo_url.startsWith('http')) {
                    branding.logo_url = shop.logo_url;
                }
                if (shop.email_logo_url && shop.email_logo_url.startsWith('http')) {
                    branding.email_logo_url = shop.email_logo_url;
                }
                if (shop.primary_color) branding.primary_color = shop.primary_color;
                if (shop.secondary_color) branding.secondary_color = shop.secondary_color;
                if (shop.name) branding.company_name = shop.name;
            }
        }

        // Fetch Global Content for Footer
        const globalContent = db.prepare("SELECT * FROM global_shop_content WHERE id = 'main'").get() as any;
        if (globalContent) {
            const parts = [];
            if (globalContent.company_name) parts.push(globalContent.company_name);
            if (globalContent.company_address) parts.push(globalContent.company_address);
            if (globalContent.contact_email) parts.push(globalContent.contact_email);
            branding.footer_text = parts.join(' | ');
        }

        const subject = `Ihre Bestellung #${order.order_number} bei ${branding.company_name}`;
        
        // Prepare Logos HTML
        let logosHtml = '';
        // Prefer email logo if exists, or show both if distinct
        // User requested: "auch in der email an den kunden sollten die logos zu sehen sein" -> implied plural "logos"
        // Let's try to show both if available and different
        if (branding.logo_url && branding.email_logo_url && branding.logo_url !== branding.email_logo_url) {
             logosHtml = `
                <img src="${branding.logo_url}" alt="${branding.company_name}" style="max-height: 60px; max-width: 150px; margin-right: 15px; vertical-align: middle;">
                <img src="${branding.email_logo_url}" alt="" style="max-height: 60px; max-width: 150px; vertical-align: middle;">
             `;
        } else if (branding.email_logo_url) {
             logosHtml = `<img src="${branding.email_logo_url}" alt="${branding.company_name}" style="max-height: 70px; max-width: 250px;">`;
        } else if (branding.logo_url) {
             logosHtml = `<img src="${branding.logo_url}" alt="${branding.company_name}" style="max-height: 70px; max-width: 250px;">`;
        } else {
             logosHtml = `<h1>${branding.company_name}</h1>`;
        }

        // Professional HTML Template
        const contentHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bestellbestätigung</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .header { background-color: #ffffff; padding: 30px; text-align: center; border-bottom: 4px solid ${branding.primary_color}; }
        .header h1 { color: ${branding.primary_color}; margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 40px 30px; }
        .order-info { background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid ${branding.primary_color}; }
        .order-info p { margin: 5px 0; }
        .footer { background-color: #333; color: #eee; padding: 20px; text-align: center; font-size: 12px; }
        .btn { display: inline-block; padding: 12px 24px; background-color: ${branding.primary_color}; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            ${logosHtml}
        </div>
        
        <div class="content">
            <h2 style="color: ${branding.secondary_color || '#333'}">Vielen Dank für Ihre Bestellung!</h2>
            <p>Guten Tag ${order.customer_name},</p>
            <p>wir haben Ihre Bestellung erhalten und freuen uns, diese für Sie produzieren zu dürfen.</p>
            
            <div class="order-info">
                <p><strong>Bestellnummer:</strong> ${order.order_number}</p>
                <p><strong>Bestelldatum:</strong> ${new Date(order.created_at).toLocaleDateString('de-DE')}</p>
                <p><strong>Status:</strong> In Bearbeitung</p>
            </div>

            <p>Ihre Rechnung finden Sie als PDF-Anhang an dieser E-Mail.</p>
            
            <p>Bei Rückfragen stehen wir Ihnen gerne zur Verfügung.</p>
            
            <p>Mit freundlichen Grüßen<br>${branding.company_name}</p>
        </div>

        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${branding.company_name}</p>
            <p>${branding.footer_text}</p>
        </div>
    </div>
</body>
</html>
`;

        // Eigene Shop-E-Mail-Vorlage (email.html aus dem Design-Paket) anwenden, sonst Standard.
        // Bestellpositionen + Summen als Platzhalter bereitstellen (Standard-Inhalt bleibt unverändert).
        const confirmationItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];
        const orderPlaceholders = buildOrderEmailPlaceholders(order, confirmationItems);
        const html = applyShopEmailFrame(order.shop_id, {
            shop_name: branding.company_name,
            customer_name: order.customer_name || '',
            order_number: order.order_number || order.id,
            subject,
            year: String(new Date().getFullYear()),
            logo_url: branding.logo_url,
            email_logo_url: branding.email_logo_url,
            primary_color: branding.primary_color,
            secondary_color: branding.secondary_color,
            footer_text: branding.footer_text,
            ...orderPlaceholders
        }, contentHtml);

        // Plain text fallback
        const text = `Guten Tag ${order.customer_name},

vielen Dank für Ihre Bestellung bei ${branding.company_name}!

Bestellnummer: ${order.order_number}
Datum: ${new Date(order.created_at).toLocaleDateString('de-DE')}

Wir haben Ihre Bestellung erhalten und bearbeiten diese schnellstmöglich.
Ihre Rechnung finden Sie als PDF im Anhang.

Mit freundlichen Grüßen
${branding.company_name}
`;

        // OPTION 1: Resend
        if (config.resend_api_key && config.resend_api_key.startsWith('re_')) {
            console.log('Sending via Resend API...');
            const resend = new Resend(config.resend_api_key);
            
            // Read PDF file for attachment
            const pdfBuffer = await fs.readFile(invoicePath);
            
            // FORCE ONBOARDING SENDER IF DOMAIN NOT MATCHING
            // Resend only allows custom sender if domain is verified.
            // To be safe, let's check if the sender email domain is 'resend.dev' or custom.
            // If custom and not working, we fallback to onboarding@resend.dev
            
            let fromAddress = `${config.sender_name} <${config.sender_email}>`;
            
            // If the user hasn't verified their domain, they MUST use onboarding@resend.dev
            // AND they can ONLY send to the email address they registered with Resend!
            // We can't know if they verified, but we can try/catch.
            
            try {
                const { data, error } = await resend.emails.send({
                    from: fromAddress,
                    to: order.customer_email,
                    subject: subject,
                    text: text,
                    html: html,
                    attachments: [
                        {
                            filename: `Rechnung_${order.order_number}.pdf`,
                            content: pdfBuffer
                        }
                    ]
                });

                if (error) {
                    console.warn('Resend failed with custom sender, trying fallback (onboarding@resend.dev)...', error.message);
                    
                    // Fallback to onboarding@resend.dev
                    const { data: fallbackData, error: fallbackError } = await resend.emails.send({
                        from: 'onboarding@resend.dev',
                        to: order.customer_email,
                        subject: subject,
                        text: text,
                        html: html,
                        attachments: [
                            {
                                filename: `Rechnung_${order.order_number}.pdf`,
                                content: pdfBuffer
                            }
                        ]
                    });

                    if (fallbackError) {
                         console.error('Resend Fallback Error:', fallbackError);
                         return false;
                    }
                    console.log('Resend Email sent (Fallback):', fallbackData?.id);
                    return true;
                }
                
                console.log('Resend Email sent:', data?.id);
                return true;
            } catch (err) {
                 console.error('Resend Exception:', err);
                 return false;
            }
        }

        // OPTION 2: SMTP (Fallback)
        if (config.smtp_host) {
            console.log('Sending via SMTP...');
            const transporter = nodemailer.createTransport({
                host: config.smtp_host,
                port: config.smtp_port,
                secure: config.smtp_secure, // true for 465, false for other ports
                auth: {
                    user: config.smtp_user,
                    pass: config.smtp_pass,
                },
                tls: {
                    rejectUnauthorized: !config.ignore_certs
                }
            });

            const info = await transporter.sendMail({
                from: `"${config.sender_name}" <${config.sender_email}>`,
                to: order.customer_email,
                subject: subject,
                text: text,
                html: html,
                attachments: [
                    {
                        filename: `Rechnung_${order.order_number}.pdf`,
                        path: invoicePath
                    }
                ]
            });

            console.log('SMTP Email sent: %s', info.messageId);
            return true;
        }
        
        console.warn('No valid email transport configured (neither Resend nor SMTP).');
        return false;

    } catch (e) {
        console.error('Error sending email:', e);
        return false;
    }
};

export const sendShipmentNotification = async (orderId: string, trackingNumber?: string) => {
    const config = getEmailConfig();
    if (!config) {
        console.warn('Email configuration missing. Skipping email sending.');
        return false;
    }

    try {
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
        if (!order || !order.customer_email) return false;

        let branding = {
            logo_url: '',
            email_logo_url: '',
            primary_color: '#3b82f6',
            secondary_color: '#1e40af',
            company_name: config.sender_name,
            footer_text: ''
        };

        if (order.shop_id) {
            const shop = db.prepare('SELECT logo_url, email_logo_url, primary_color, secondary_color, name FROM shops WHERE id = ?').get(order.shop_id) as any;
            if (shop) {
                if (shop.logo_url && shop.logo_url.startsWith('http')) branding.logo_url = shop.logo_url;
                if (shop.email_logo_url && shop.email_logo_url.startsWith('http')) branding.email_logo_url = shop.email_logo_url;
                if (shop.primary_color) branding.primary_color = shop.primary_color;
                if (shop.secondary_color) branding.secondary_color = shop.secondary_color;
                if (shop.name) branding.company_name = shop.name;
            }
        }

        const globalContent = db.prepare("SELECT * FROM global_shop_content WHERE id = 'main'").get() as any;
        if (globalContent) {
            const parts = [];
            if (globalContent.company_name) parts.push(globalContent.company_name);
            if (globalContent.company_address) parts.push(globalContent.company_address);
            if (globalContent.contact_email) parts.push(globalContent.contact_email);
            branding.footer_text = parts.join(' | ');
        }

        const tn = String(trackingNumber || order.tracking_number || '').trim();
        const trackingUrl = tn ? `https://www.dhl.de/de/privatkunden/dhl-sendungsverfolgung.html?piececode=${encodeURIComponent(tn)}` : '';
        const subject = tn
            ? `Ihre Bestellung #${order.order_number} ist auf dem Weg (Sendungsnummer: ${tn})`
            : `Ihre Bestellung #${order.order_number} ist auf dem Weg`;

        let logosHtml = '';
        if (branding.logo_url && branding.email_logo_url && branding.logo_url !== branding.email_logo_url) {
            logosHtml = `
                <img src="${branding.logo_url}" alt="${branding.company_name}" style="max-height: 60px; max-width: 150px; margin-right: 15px; vertical-align: middle;">
                <img src="${branding.email_logo_url}" alt="" style="max-height: 60px; max-width: 150px; vertical-align: middle;">
            `;
        } else if (branding.email_logo_url) {
            logosHtml = `<img src="${branding.email_logo_url}" alt="${branding.company_name}" style="max-height: 70px; max-width: 250px;">`;
        } else if (branding.logo_url) {
            logosHtml = `<img src="${branding.logo_url}" alt="${branding.company_name}" style="max-height: 70px; max-width: 250px;">`;
        } else {
            logosHtml = `<h1>${branding.company_name}</h1>`;
        }

        const contentHtml = `
        <div style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 24px;">
          <div style="max-width: 640px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
            <div style="padding: 22px; background: linear-gradient(90deg, ${branding.primary_color}, ${branding.secondary_color}); color: white;">
              <div style="display:flex; align-items:center; justify-content:space-between; gap: 12px;">
                <div style="font-size: 18px; font-weight: 700;">Versandupdate</div>
                <div style="text-align:right; font-size: 12px; opacity: 0.95;">Bestellung #${order.order_number}</div>
              </div>
            </div>
            <div style="padding: 22px;">
              <div style="margin-bottom: 14px; text-align:center;">${logosHtml}</div>
              <p style="font-size: 14px; color: #0f172a; line-height: 1.5;">
                Ihre Bestellung ist jetzt im Versand.
              </p>
              ${tn ? `
                <div style="margin: 14px 0; padding: 14px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc;">
                  <div style="font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 6px;">Sendungsnummer</div>
                  <div style="font-size: 16px; font-weight: 800; color: #0f172a;">${tn}</div>
                  ${trackingUrl ? `<div style="margin-top: 10px;"><a href="${trackingUrl}" style="display:inline-block; padding: 10px 14px; border-radius: 12px; background: ${branding.primary_color}; color: white; text-decoration: none; font-weight: 700; font-size: 13px;">Sendung verfolgen</a></div>` : ''}
                </div>
              ` : ''}
              <p style="font-size: 12px; color: #64748b; margin-top: 12px;">
                Sie finden die Sendungsnummer auch jederzeit in Ihrem Kundenkonto unter „Meine Bestellungen“.
              </p>
            </div>
            ${branding.footer_text ? `
              <div style="padding: 16px 22px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
                ${branding.footer_text}
              </div>
            ` : ''}
          </div>
        </div>
        `;

        const shipmentItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];
        const orderPlaceholders = buildOrderEmailPlaceholders(order, shipmentItems);
        const html = applyShopEmailFrame(order.shop_id, {
            shop_name: branding.company_name,
            customer_name: order.customer_name || '',
            order_number: order.order_number || order.id,
            subject,
            year: String(new Date().getFullYear()),
            logo_url: branding.logo_url,
            email_logo_url: branding.email_logo_url,
            primary_color: branding.primary_color,
            secondary_color: branding.secondary_color,
            footer_text: branding.footer_text,
            ...orderPlaceholders
        }, contentHtml);

        const text = tn
            ? `Ihre Bestellung #${order.order_number} ist jetzt im Versand. Sendungsnummer: ${tn}\n${trackingUrl ? `Sendung verfolgen: ${trackingUrl}\n` : ''}`
            : `Ihre Bestellung #${order.order_number} ist jetzt im Versand.`;

        return await sendEmailWithInvoice({
            to: [order.customer_email],
            subject,
            text,
            html
        });
    } catch {
        return false;
    }
};

/**
 * Einmalige Kundenmail beim tatsächlichen Produktionsstart ("Ab in die Kabine").
 * Wird ausgelöst, sobald der Bearbeitungsstatus explizit auf "In Bearbeitung"
 * ('active') gesetzt wird. Der Zahlstatus allein gilt NICHT als Produktionsstart.
 * Der Versand wird über orders.production_start_email_sent_at abgesichert, damit
 * wiederholtes Speichern keine zweite Mail auslöst.
 *
 * Rückgabe: true bei erfolgreichem Versand, sonst false (inkl. Logging).
 */
export const sendOrderProductionStarted = async (orderId: string): Promise<boolean> => {
    const config = getEmailConfig();
    if (!config) {
        console.warn('[Production Started] E-Mail-Konfiguration fehlt. Versand übersprungen.');
        return false;
    }

    try {
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
        if (!order) {
            console.warn(`[Production Started] Bestellung ${orderId} nicht gefunden.`);
            return false;
        }
        if (!order.customer_email) {
            console.warn(`[Production Started] Bestellung ${orderId} hat keine Kunden-E-Mail. Versand übersprungen.`);
            return false;
        }

        const branding = {
            logo_url: '',
            email_logo_url: '',
            primary_color: '#3b82f6',
            secondary_color: '#1e40af',
            company_name: config.sender_name,
            footer_text: ''
        };

        if (order.shop_id) {
            const shop = db.prepare('SELECT logo_url, email_logo_url, primary_color, secondary_color, name FROM shops WHERE id = ?').get(order.shop_id) as any;
            if (shop) {
                if (shop.logo_url && shop.logo_url.startsWith('http')) branding.logo_url = shop.logo_url;
                if (shop.email_logo_url && shop.email_logo_url.startsWith('http')) branding.email_logo_url = shop.email_logo_url;
                if (shop.primary_color) branding.primary_color = shop.primary_color;
                if (shop.secondary_color) branding.secondary_color = shop.secondary_color;
                if (shop.name) branding.company_name = shop.name;
            }
        }

        const globalContent = db.prepare("SELECT * FROM global_shop_content WHERE id = 'main'").get() as any;
        if (globalContent) {
            const parts: string[] = [];
            if (globalContent.company_name) parts.push(globalContent.company_name);
            if (globalContent.company_address) parts.push(globalContent.company_address);
            if (globalContent.contact_email) parts.push(globalContent.contact_email);
            branding.footer_text = parts.join(' | ');
        }

        const orderNumber = String(order.order_number || order.id);
        const subject = 'Ab in die Kabine – dein Equipment entsteht!';

        const isPaid = ['paid', 'completed'].includes(String(order.payment_status || '').toLowerCase());
        const paymentLine = isPaid
            ? 'Deine Zahlung ist bei uns eingegangen – vielen Dank!'
            : 'Deine Zahlung ist bei uns noch offen. Wir starten dennoch mit der Produktion.';

        const logosHtml =
            branding.logo_url
                ? `<img src="${branding.logo_url}" alt="${branding.company_name}" style="max-height:70px; max-width:250px;">`
                : `<h1 style="margin:0; color:white;">${branding.company_name}</h1>`;

        const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];
        const orderPlaceholders = buildOrderEmailPlaceholders(order, items);
        // Nutzt die shopspezifische email.html diese Platzhalter, werden die Angaben im
        // Standard-Inhalt weggelassen, damit sie nicht doppelt erscheinen.
        const frameUsesItems = shopEmailFrameUsesPlaceholder(order.shop_id, 'order_items_html');
        const frameUsesTotals = shopEmailFrameUsesPlaceholder(order.shop_id, 'order_totals_html');
        const frameUsesProgress = shopEmailFrameUsesPlaceholder(order.shop_id, 'order_progress_html');

        const contentHtml = `
        <div style="font-family: Arial, Helvetica, sans-serif; background-color: #f8fafc; padding: 24px;">
          <div style="max-width: 720px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
            <div style="padding: 24px; background: linear-gradient(90deg, ${branding.primary_color}, ${branding.secondary_color}); color: #ffffff;">
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing:.08em; opacity:.95;">Produktionsstart</div>
              <div style="font-size: 22px; font-weight: 800; margin-top: 4px;">Ab in die Kabine – dein Equipment entsteht!</div>
              <div style="font-size: 13px; opacity: 0.95; margin-top: 6px;">Bestellung #${escapeHtml(orderNumber)}</div>
            </div>
            <div style="padding: 22px;">
              <div style="margin-bottom: 16px; text-align:center;">${logosHtml}</div>

              <div style="margin-bottom: 16px; padding: 14px 16px; border-radius: 12px; border: 1px solid ${isPaid ? '#bbf7d0' : '#fde68a'}; background: ${isPaid ? '#f0fdf4' : '#fffbeb'}; font-size: 14px; color: #0f172a;">
                <div style="font-weight: 800; margin-bottom: 4px;">${isPaid ? 'Zahlung bestätigt' : 'Zahlung offen'}</div>
                <div>${paymentLine}</div>
              </div>

              <p style="font-size: 14px; color: #0f172a; line-height: 1.6;">
                Dein Auftrag ist jetzt in der Produktion. Wir bereiten dein Equipment vor und melden uns,
                sobald es weitergeht.
              </p>

              ${frameUsesItems ? '' : `<div style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; margin:16px 0 10px;">Deine Artikel</div>
              ${orderPlaceholders.order_items_html}`}

              ${frameUsesTotals ? '' : orderPlaceholders.order_totals_html}

              ${frameUsesProgress ? '' : `<div style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; margin:20px 0 10px;">Fortschritt</div>
              ${orderPlaceholders.order_progress_html}`}
            </div>
            ${branding.footer_text ? `<div style="padding: 16px 22px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">${branding.footer_text}</div>` : ''}
          </div>
        </div>`;

        const html = applyShopEmailFrame(order.shop_id, {
            shop_name: branding.company_name,
            customer_name: order.customer_name || '',
            order_number: orderNumber,
            subject,
            year: String(new Date().getFullYear()),
            logo_url: branding.logo_url,
            email_logo_url: branding.email_logo_url,
            primary_color: branding.primary_color,
            secondary_color: branding.secondary_color,
            footer_text: branding.footer_text,
            ...orderPlaceholders
        }, contentHtml);

        const text = [
            'Ab in die Kabine – dein Equipment entsteht!',
            `Bestellung #${orderNumber}`,
            '',
            isPaid ? 'Deine Zahlung ist bei uns eingegangen – vielen Dank!' : 'Deine Zahlung ist bei uns noch offen.',
            '',
            'Deine Artikel:',
            ...items.map((it: any, idx: number) => `${idx + 1}. ${it.item_name || ''} | ${Number(it.quantity) || 0}x | ${(Number(it.price) || 0).toFixed(2).replace('.', ',')} €`),
            '',
            'Dein Auftrag ist jetzt in der Produktion.'
        ].join('\n');

        const sent = await sendEmailWithInvoice({ to: [order.customer_email], subject, text, html });
        if (sent) {
            console.log(`[Production Started] Produktionsstart-Mail an ${order.customer_email} für Bestellung ${orderNumber} versendet.`);
        } else {
            console.error(`[Production Started] Versand der Produktionsstart-Mail für Bestellung ${orderNumber} fehlgeschlagen.`);
        }
        return sent;
    } catch (e) {
        console.error('[Production Started] Fehler beim Erstellen/Versand der Produktionsstart-Mail:', e);
        return false;
    }
};

export const sendShopOrderNotification = async (orderId: string, invoicePath: string, recipients: string | string[]) => {
    try {
        const to = normalizeRecipientList(recipients);
        if (!to.length) return false;

        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
        if (!order) return false;

        const shop = order.shop_id ? (db.prepare('SELECT * FROM shops WHERE id = ?').get(order.shop_id) as any) : null;
        const customer = order.shop_customer_id ? (db.prepare('SELECT * FROM shop_customers WHERE id = ?').get(order.shop_customer_id) as any) : null;
        const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];

        const shopName = shop?.name || 'Onlineshop';
        const subject = `Neue Bestellung #${order.order_number} (${shopName})`;

        const esc = escapeHtml;

        // Branding für die optionale Shop-Mailvorlage (email.html)
        const branding = {
            logo_url: '',
            email_logo_url: '',
            primary_color: '#16a34a',
            secondary_color: '#0f172a',
            footer_text: ''
        };
        if (shop) {
            if (shop.logo_url?.startsWith('http')) branding.logo_url = shop.logo_url;
            if (shop.email_logo_url?.startsWith('http')) branding.email_logo_url = shop.email_logo_url;
            if (shop.primary_color) branding.primary_color = shop.primary_color;
            if (shop.secondary_color) branding.secondary_color = shop.secondary_color;
        }
        const globalContent = db.prepare("SELECT * FROM global_shop_content WHERE id = 'main'").get() as any;
        if (globalContent) {
            const parts: string[] = [];
            if (globalContent.company_name) parts.push(globalContent.company_name);
            if (globalContent.company_address) parts.push(globalContent.company_address);
            if (globalContent.contact_email) parts.push(globalContent.contact_email);
            branding.footer_text = parts.join(' | ');
        }

        const createdAt = order.created_at ? new Date(order.created_at).toLocaleString('de-DE') : '';
        const customerLine = customer
            ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
            : (order.customer_name || '');
        const customerEmail = order.customer_email || customer?.email || '';
        const customerPhone = order.customer_phone || customer?.phone || '';
        const addressLines = String(order.customer_address || '').split(/\n|,\s/).map(s => s.trim()).filter(Boolean);
        const addressHtml = addressLines.length ? addressLines.map(esc).join('<br>') : '-';

        const paymentMethod = order.paymentMethod || order.payment_method || '-';
        const paymentStatus = order.paymentStatus || order.payment_status || '-';
        const isPaymentPending = ['open', 'pending', 'pending_payment', 'unpaid'].includes(String(paymentStatus).toLowerCase());
        const paymentStatusLabel = isPaymentPending ? `${paymentStatus} (Zahlung ausstehend)` : paymentStatus;

        const itemsSubtotal = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0);
        const shippingCosts = Number(order.shipping_costs) || 0;
        const discountAmount = Number(order.discount_amount) || 0;
        const totalAmount = Number(order.total_amount) || 0;
        const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

        // Artikel + Summen als wiederverwendbare Bausteine (auch für die email.html-Platzhalter
        // {{order_items_html}} und {{order_totals_html}}).
        const orderPlaceholders = buildOrderEmailPlaceholders(order, items);
        // Nutzt die eigene email.html-Vorlage diese Platzhalter, werden die Angaben im
        // Standard-Inhalt weggelassen, damit sie nicht doppelt erscheinen.
        const frameUsesItems = shopEmailFrameUsesPlaceholder(order.shop_id, 'order_items_html');
        const frameUsesTotals = shopEmailFrameUsesPlaceholder(order.shop_id, 'order_totals_html');

        const contentHtml = `
        <div style="font-family: Arial, Helvetica, sans-serif; background-color: #f8fafc; padding: 24px;">
          <div style="max-width: 720px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
            <div style="padding: 22px; background: linear-gradient(90deg, ${branding.primary_color}, ${branding.secondary_color}); color: #ffffff;">
              <div style="font-size: 18px; font-weight: 700;">Neue Bestellung</div>
              <div style="font-size: 13px; opacity: 0.95;">#${esc(order.order_number)} · ${esc(shopName)}</div>
            </div>
            <div style="padding: 22px;">
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 14px; margin-bottom:16px; font-size:14px; color:#0f172a; line-height:1.6;">
                <div><b>Bestellnummer:</b> ${esc(order.order_number)}</div>
                <div><b>Datum:</b> ${esc(createdAt)}</div>
                <div><b>Kunde:</b> ${esc(customerLine) || '-'}</div>
                <div><b>E-Mail:</b> ${esc(customerEmail) || '-'}${customerPhone ? ` · <b>Telefon:</b> ${esc(customerPhone)}` : ''}</div>
                <div><b>Adresse:</b><br>${addressHtml}</div>
              </div>

              ${frameUsesItems ? '' : `<div style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; margin:10px 0;">Artikel</div>
              ${orderPlaceholders.order_items_html}`}

              ${frameUsesTotals ? '' : orderPlaceholders.order_totals_html}

              <div style="margin-top:16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 14px; font-size:14px; color:#0f172a;">
                <div><b>Zahlungsart:</b> ${esc(paymentMethod)}</div>
                <div><b>Zahlungsstatus:</b> ${esc(paymentStatusLabel)}</div>
              </div>

              <p style="margin-top:16px; color:#334155; font-size:14px;">Die Rechnung ist als PDF im Anhang.</p>
            </div>
          </div>
        </div>`;

        // Mit der shopspezifischen E-Mail-Vorlage (email.html) umrahmen; ohne Vorlage bleibt der Inhalt unverändert.
        const html = applyShopEmailFrame(order.shop_id, {
            shop_name: shopName,
            customer_name: customerLine || '',
            order_number: String(order.order_number || ''),
            subject,
            year: String(new Date().getFullYear()),
            logo_url: branding.logo_url,
            email_logo_url: branding.email_logo_url,
            primary_color: branding.primary_color,
            secondary_color: branding.secondary_color,
            footer_text: branding.footer_text,
            ...orderPlaceholders
        }, contentHtml);

        const textLines = [
            `Neue Bestellung #${order.order_number} (${shopName})`,
            createdAt ? `Datum: ${createdAt}` : '',
            `Kunde: ${customerLine || '-'}`,
            `E-Mail: ${customerEmail || '-'}`,
            customerPhone ? `Telefon: ${customerPhone}` : '',
            `Adresse: ${String(order.customer_address || '-').replace(/\n/g, ', ')}`,
            '',
            'Artikel:',
            ...items.map((it: any, idx: number) => {
                const qty = Number(it.quantity) || 0;
                const price = Number(it.price) || 0;
                return `${idx + 1}. ${it.item_name || ''} | ${qty}x | ${price.toFixed(2).replace('.', ',')} €`;
            }),
            '',
            `Warenwert: ${itemsSubtotal.toFixed(2).replace('.', ',')} €`,
            `Versandkosten: ${shippingCosts.toFixed(2).replace('.', ',')} €`,
            discountAmount > 0 ? `Rabatt${order.voucher_code ? ` (${order.voucher_code})` : ''}: -${discountAmount.toFixed(2).replace('.', ',')} €` : '',
            `Gesamtbetrag: ${totalAmount.toFixed(2).replace('.', ',')} €`,
            '',
            `Zahlungsart: ${paymentMethod}`,
            `Zahlungsstatus: ${paymentStatusLabel}`,
            '',
            'Rechnung ist im Anhang.'
        ].filter(Boolean);

        return await sendEmailWithInvoice({
            to,
            subject,
            text: textLines.join('\n'),
            html,
            invoicePath,
            invoiceFilename: `Rechnung_${order.order_number}.pdf`
        });
    } catch (e) {
        console.error('Error sending shop order notification:', e);
        return false;
    }
};

// ============================================
// NEU: Pickup / Abholung Packstation Mails
// ============================================
const PICKUP_DEFAULT_CONFIRMATION_TEXT = `Liebe/r {{customer_name}},

vielen Dank für Deine Bestellung #{{order_number}} bei {{shop_name}}!

Du hast die Abholung in unserer Packstation gewählt. Wir bearbeiten Deine Bestellung jetzt und melden uns SOFORT per E-Mail, sobald sie zur Abholung bereit liegt. Dann erhältst Du einen persönlichen Abholcode und die Fachnummer.

Liebe Grüße
Dein Team von {{shop_name}}`;

const PICKUP_DEFAULT_READY_TEXT = `Liebe/r {{customer_name}},

Deine Bestellung #{{order_number}} ist FERTIG und wartet auf Dich in der Packstation!

🏷️ Dein Abholcode: {{pickup_code}}
🔐 Fach-Nummer: {{pickup_compartment}}

Gib einfach den Abholcode am Terminal ein und öffne das zugehörige Fach.

Liebe Grüße
Dein Team von {{shop_name}}`;

const renderPickupTemplate = (template: string | null | undefined, vars: Record<string, string>) => {
  let text = (template || '').trim();
  if (!text) text = PICKUP_DEFAULT_CONFIRMATION_TEXT;
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => vars[key] || '');
};

export const sendPickupConfirmation = async (orderId: string) => {
  const config = getEmailConfig();
  if (!config) {
    console.warn('[Pickup] Email config missing, skipping confirmation.');
    return false;
  }
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    if (!order || !order.customer_email) return false;

    let branding: any = {
      logo_url: '', email_logo_url: '',
      primary_color: '#0f172a', secondary_color: '#334155',
      company_name: config.sender_name || 'Main Textildruck',
      footer_text: ''
    };
    if (order.shop_id) {
      const shop = db.prepare('SELECT logo_url, email_logo_url, primary_color, secondary_color, name FROM shops WHERE id = ?').get(order.shop_id) as any;
      if (shop) {
        if (shop.logo_url?.startsWith('http')) branding.logo_url = shop.logo_url;
        if (shop.email_logo_url?.startsWith('http')) branding.email_logo_url = shop.email_logo_url;
        if (shop.primary_color) branding.primary_color = shop.primary_color;
        if (shop.secondary_color) branding.secondary_color = shop.secondary_color;
        if (shop.name) branding.company_name = shop.name;
      }
    }
    const globalContent = db.prepare("SELECT * FROM global_shop_content WHERE id = 'main'").get() as any;
    if (globalContent) {
      const parts = [];
      if (globalContent.company_name) parts.push(globalContent.company_name);
      if (globalContent.company_address) parts.push(globalContent.company_address);
      if (globalContent.contact_email) parts.push(globalContent.contact_email);
      branding.footer_text = parts.join(' | ');
    }

    let templateRaw: string | null = null;
    if (order.shop_id) {
      const shopCfg = db.prepare('SELECT pickup_email_template FROM shop_shipping_config WHERE shop_id = ?').get(order.shop_id) as any;
      templateRaw = shopCfg?.pickup_email_template || null;
    }
    if (!templateRaw) {
      const gCfg = db.prepare("SELECT pickup_email_template FROM global_shipping_config WHERE id = 'main'").get() as any;
      templateRaw = gCfg?.pickup_email_template || null;
    }
    if (!templateRaw) templateRaw = PICKUP_DEFAULT_CONFIRMATION_TEXT;

    const vars = {
      order_number: order.order_number || order.id,
      customer_name: order.customer_name || 'Kunde',
      shop_name: branding.company_name,
      pickup_code: order.pickup_code || '',
      pickup_compartment: order.pickup_compartment || ''
    };
    const renderedText = renderPickupTemplate(templateRaw, vars);
    const renderedLines = renderedText.split('\n').map(l => l.trimEnd());
    const bodyHtml = renderedLines.map(l => l ? `<p style="font-size:14px; color:#0f172a; line-height:1.65; margin:0 0 12px 0;">${l}</p>` : '<div style="height:4px;"></div>').join('');

    const logosHtml =
      branding.logo_url ? `<img src="${branding.logo_url}" alt="${branding.company_name}" style="max-height:70px; max-width:250px;">` :
      `<h1 style="margin:0; color:white;">${branding.company_name}</h1>`;

    const subject = `Bestellbestätigung #${order.order_number} – Abholung Packstation`;
    const contentHtml = `
    <div style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 24px;">
      <div style="max-width: 620px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="padding: 22px; background: linear-gradient(90deg, ${branding.primary_color}, ${branding.secondary_color}); color: white;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap: 12px;">
            <div>
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing:.08em; opacity:.95;">Packstation Abholung</div>
              <div style="font-size: 20px; font-weight: 800; margin-top:2px;">Bestellung eingegangen</div>
            </div>
            <div style="text-align:right; background: rgba(255,255,255,.12); padding:8px 12px; border-radius:10px;">
              <div style="font-size: 11px; opacity:.9;">#</div>
              <div style="font-size: 16px; font-weight: 800;">${order.order_number}</div>
            </div>
          </div>
        </div>
        <div style="padding: 22px;">
          <div style="margin-bottom: 16px; text-align:center;">${logosHtml}</div>
          ${bodyHtml}
          <div style="margin-top: 18px; padding: 14px; border-radius: 12px; border: 1px dashed #94a3b8; background: #f8fafc;">
            <div style="font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: .08em; margin-bottom:4px;">⏰ Nächster Schritt</div>
            <div style="font-size: 13px; color: #0f172a;">Wir melden uns per E-Mail mit Deinem persönlichen Abholcode und der Fachnummer, sobald die Bestellung fertig ist.</div>
          </div>
        </div>
        ${branding.footer_text ? `<div style="padding: 16px 22px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">${branding.footer_text}</div>` : ''}
      </div>
    </div>`;

    const pickupItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];
    const orderPlaceholders = buildOrderEmailPlaceholders(order, pickupItems);
    const html = applyShopEmailFrame(order.shop_id, {
      shop_name: branding.company_name,
      customer_name: order.customer_name || '',
      order_number: order.order_number || order.id,
      subject,
      pickup_code: order.pickup_code || '',
      pickup_compartment: order.pickup_compartment || '',
      year: String(new Date().getFullYear()),
      logo_url: branding.logo_url,
      email_logo_url: branding.email_logo_url,
      primary_color: branding.primary_color,
      secondary_color: branding.secondary_color,
      footer_text: branding.footer_text,
      ...orderPlaceholders
    }, contentHtml);

    const text = renderedText + `\n\n--\nNächster Schritt: Du erhältst bald eine weitere E-Mail mit Abholcode und Fachnummer.`;

    return await sendEmailWithInvoice({ to: [order.customer_email], subject, text, html });
  } catch (e) {
    console.error('[Pickup Confirmation] Error:', e);
    return false;
  }
};

export const sendPickupReady = async (orderId: string, code: string, compartment: string) => {
  const config = getEmailConfig();
  if (!config) {
    console.warn('[Pickup Ready] Email config missing, skipping.');
    return false;
  }
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    if (!order || !order.customer_email) return false;

    let branding: any = {
      logo_url: '', email_logo_url: '',
      primary_color: '#16a34a', secondary_color: '#15803d',
      company_name: config.sender_name || 'Main Textildruck',
      footer_text: ''
    };
    if (order.shop_id) {
      const shop = db.prepare('SELECT logo_url, email_logo_url, primary_color, secondary_color, name FROM shops WHERE id = ?').get(order.shop_id) as any;
      if (shop) {
        if (shop.logo_url?.startsWith('http')) branding.logo_url = shop.logo_url;
        if (shop.email_logo_url?.startsWith('http')) branding.email_logo_url = shop.email_logo_url;
        if (shop.name) branding.company_name = shop.name;
        if (shop.primary_color) { branding.primary_color = shop.primary_color; branding.secondary_color = shop.secondary_color || shop.primary_color; }
      }
    }
    const globalContent = db.prepare("SELECT * FROM global_shop_content WHERE id = 'main'").get() as any;
    if (globalContent) {
      const parts = [];
      if (globalContent.company_name) parts.push(globalContent.company_name);
      if (globalContent.company_address) parts.push(globalContent.company_address);
      if (globalContent.contact_email) parts.push(globalContent.contact_email);
      branding.footer_text = parts.join(' | ');
    }

    const vars = {
      order_number: order.order_number || order.id,
      customer_name: order.customer_name || 'Kunde',
      shop_name: branding.company_name,
      pickup_code: code,
      pickup_compartment: compartment
    };
    const renderedText = renderPickupTemplate(PICKUP_DEFAULT_READY_TEXT, vars);
    const renderedLines = renderedText.split('\n').map(l => l.trimEnd());
    const bodyHtml = renderedLines.map(l => l ? `<p style="font-size:14px; color:#0f172a; line-height:1.65; margin:0 0 12px 0;">${l}</p>` : '<div style="height:4px;"></div>').join('');

    const logosHtml =
      branding.logo_url ? `<img src="${branding.logo_url}" alt="${branding.company_name}" style="max-height:70px; max-width:250px;">` :
      `<h1 style="margin:0; color:white;">${branding.company_name}</h1>`;

    const subject = `✅ Bereit zur Abholung! Bestellung #${order.order_number} – Code ${code}`;
    const contentHtml = `
    <div style="font-family: Arial, sans-serif; background-color: #f0fdf4; padding: 24px;">
      <div style="max-width: 620px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; border: 2px solid #16a34a; box-shadow: 0 8px 30px rgba(22,163,74,.12);">
        <div style="padding: 22px; background: linear-gradient(90deg, #16a34a, #15803d); color: white;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap: 12px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="background: rgba(255,255,255,.2); padding:6px; border-radius:10px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <div>
                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing:.08em; opacity:.95;">Packstation</div>
                <div style="font-size: 20px; font-weight: 800; margin-top:2px;">Bestellung abholbereit!</div>
              </div>
            </div>
            <div style="text-align:right; background: rgba(255,255,255,.18); padding:8px 12px; border-radius:10px;">
              <div style="font-size: 11px; opacity:.9;">#</div>
              <div style="font-size: 16px; font-weight: 800;">${order.order_number}</div>
            </div>
          </div>
        </div>
        <div style="padding: 22px;">
          <div style="margin-bottom: 16px; text-align:center;">${logosHtml}</div>
          ${bodyHtml}
          <div style="margin-top: 18px; display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div style="padding: 16px; border-radius: 12px; background: #fef3c7; border: 1px solid #f59e0b; text-align:center;">
              <div style="font-size: 11px; font-weight: 800; color: #92400e; text-transform: uppercase; letter-spacing:.08em;">Abholcode</div>
              <div style="margin-top:6px; font-size: 28px; font-weight: 900; letter-spacing: 2px; color: #78350f;">${code}</div>
            </div>
            <div style="padding: 16px; border-radius: 12px; background: #dbeafe; border: 1px solid #3b82f6; text-align:center;">
              <div style="font-size: 11px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing:.08em;">Fach-Nummer</div>
              <div style="margin-top:6px; font-size: 28px; font-weight: 900; letter-spacing: 1px; color: #1e3a8a;">${compartment}</div>
            </div>
          </div>
          <div style="margin-top: 16px; padding: 12px 14px; border-radius: 10px; background: #f0fdf4; border: 1px solid #bbf7d0; font-size: 13px; color: #14532d;">
            💡 Tipp: Gib einfach den Abholcode am Packstation-Terminal ein – das Fach öffnet sich automatisch.
          </div>
        </div>
        ${branding.footer_text ? `<div style="padding: 16px 22px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">${branding.footer_text}</div>` : ''}
      </div>
    </div>`;

    const readyItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];
    const orderPlaceholders = buildOrderEmailPlaceholders(order, readyItems);
    const html = applyShopEmailFrame(order.shop_id, {
      shop_name: branding.company_name,
      customer_name: order.customer_name || '',
      order_number: order.order_number || order.id,
      subject,
      pickup_code: code,
      pickup_compartment: compartment,
      year: String(new Date().getFullYear()),
      logo_url: branding.logo_url,
      email_logo_url: branding.email_logo_url,
      primary_color: branding.primary_color,
      secondary_color: branding.secondary_color,
      footer_text: branding.footer_text,
      ...orderPlaceholders
    }, contentHtml);

    return await sendEmailWithInvoice({ to: [order.customer_email], subject, text: renderedText, html });
  } catch (e) {
    console.error('[Pickup Ready] Error:', e);
    return false;
  }
};
// ============================================

/**
 * Vorkasse-Zahlungserinnerung per E-Mail mit Bankdaten.
 * Wird manuell angestoßen (Button in ShopDashboard), wenn:
 *   - order.payment_method === 'Vorkasse' (oder payment_method ist 'advance' / 'bank_transfer')
 *   - order.payment_status NICHT 'paid' oder 'completed'
 */
export const sendVorkassePaymentReminder = async (orderId: string, customNote?: string): Promise<{ success: boolean; recipient: string | null; error?: string }> => {
  const config = getEmailConfig();
  if (!config) {
    console.warn('[Payment Reminder] Email config missing.');
    return { success: false, recipient: null, error: 'Keine E-Mail-Konfiguration hinterlegt.' };
  }
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    if (!order) return { success: false, recipient: null, error: 'Bestellung nicht gefunden.' };
    if (!order.customer_email) return { success: false, recipient: null, error: 'Kunde hat keine E-Mail-Adresse.' };

    // --- Branding (Shop-spezifisch + Global Content) ---
    let branding: any = {
      logo_url: '', email_logo_url: '',
      primary_color: '#0f172a', secondary_color: '#334155',
      company_name: config.sender_name || 'Main Textildruck',
      footer_text: ''
    };
    if (order.shop_id) {
      const shop = db.prepare('SELECT logo_url, email_logo_url, primary_color, secondary_color, name FROM shops WHERE id = ?').get(order.shop_id) as any;
      if (shop) {
        if (shop.logo_url?.startsWith('http')) branding.logo_url = shop.logo_url;
        if (shop.email_logo_url?.startsWith('http')) branding.email_logo_url = shop.email_logo_url;
        if (shop.primary_color) branding.primary_color = shop.primary_color;
        if (shop.secondary_color) branding.secondary_color = shop.secondary_color;
        if (shop.name) branding.company_name = shop.name;
      }
    }
    const globalContent = db.prepare("SELECT * FROM global_shop_content WHERE id = 'main'").get() as any;
    if (globalContent) {
      const parts = [];
      if (globalContent.company_name) parts.push(globalContent.company_name);
      if (globalContent.company_address) parts.push(globalContent.company_address);
      if (globalContent.contact_email) parts.push(globalContent.contact_email);
      branding.footer_text = parts.join(' | ');
    }

    // --- Bankdaten (Priority: Shop > Global) ---
    let bankData: any = {
      bank_name: globalContent?.bank_name || '',
      iban: globalContent?.bank_iban || '',
      bic: globalContent?.bank_bic || '',
      company_name: globalContent?.company_name || branding.company_name
    };
    if (order.shop_id) {
      try {
        // Shop-Shipping-Config kann diese Spalten haben (je nach Migration Stand); sicher per Fallback
        const shopBankAll = db.prepare("SELECT * FROM shop_shipping_config WHERE shop_id = ?").get(order.shop_id) as any;
        if (shopBankAll) {
          if (shopBankAll.bank_name) bankData.bank_name = shopBankAll.bank_name;
          if (shopBankAll.bank_iban) bankData.iban = shopBankAll.bank_iban;
          if (shopBankAll.bank_bic) bankData.bic = shopBankAll.bank_bic;
          if (shopBankAll.company_name) bankData.company_name = shopBankAll.company_name;
        }
      } catch {
        // Spalten existieren evtl. nicht in shop_shipping_config (altes DB Schema) -> Fallback global
      }
    }

    // --- Daten ---
    const orderNumber = order.order_number || order.id;
    const customerName = order.customer_name || 'Sehr geehrte Damen und Herren';
    const orderDate = order.created_at ? new Date(order.created_at).toLocaleDateString('de-DE') : '';
    const totalRaw = Number(order.total_price || order.total || 0);
    const total = isNaN(totalRaw) ? '0,00' : totalRaw.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const dueDateStr = dueDate.toLocaleDateString('de-DE');

    // --- Logo ---
    const logosHtml =
      branding.logo_url ? `<img src="${branding.logo_url}" alt="${branding.company_name}" style="max-height:70px; max-width:250px;">` :
      `<h1 style="margin:0; color:white;">${branding.company_name}</h1>`;

    // --- Betrag & Bankdaten Box ---
    const bankBoxHtml = `
      <div style="margin-top: 6px; padding: 18px; border-radius: 14px; background: linear-gradient(180deg, #fff7ed, #ffedd5); border: 1px solid #fdba74;">
        <div style="display:grid; grid-template-columns: 1.1fr 1fr; gap: 16px;">
          <div>
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing:.08em; color:#9a3412; margin-bottom:6px;">🧾 Zu zahlender Betrag</div>
            <div style="font-size: 26px; font-weight: 900; color: #7c2d12;">${total}</div>
            <div style="font-size: 12px; color: #78350f; margin-top:6px;">Bestellung: <b>${orderNumber}</b>${orderDate ? ` · vom ${orderDate}` : ''}</div>
            <div style="font-size: 12px; color: #78350f; margin-top:2px;">Zahlungsziel: <b>${dueDateStr}</b></div>
          </div>
          <div>
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing:.08em; color:#9a3412; margin-bottom:6px;">🏦 Bankverbindung</div>
            <div style="font-size: 13px; color: #0f172a; line-height: 1.6;">
              <div><b>${bankData.company_name || branding.company_name}</b></div>
              ${bankData.bank_name ? `<div>${bankData.bank_name}</div>` : ''}
              ${bankData.iban ? `<div>IBAN: <b style="font-family: monospace;">${bankData.iban}</b></div>` : ''}
              ${bankData.bic ? `<div>BIC: <b style="font-family: monospace;">${bankData.bic}</b></div>` : ''}
            </div>
          </div>
        </div>
        <div style="margin-top: 14px; padding: 10px 12px; border-radius: 10px; background: white; border: 1px dashed #fb923c; font-size: 12px; color:#7c2d12;">
          💡 Bitte geben Sie im Verwendungszweck <b>unbedingt die Bestellnummer „${orderNumber}“</b> an, damit wir die Zahlung zuordnen können. Vielen Dank!
        </div>
      </div>`;

    // --- Body Intro ---
    const introHtml = `
      <div style="font-size: 15px; color: #0f172a; line-height: 1.7;">
        <p style="margin:0 0 10px 0;">Hallo ${customerName},</p>
        <p style="margin:0 0 10px 0;">vielen Dank für Ihre Bestellung bei <b>${branding.company_name}</b>. Wir möchten Sie freundlich daran erinnern, dass der Betrag für Ihre Bestellung <b>#${orderNumber}</b> bisher noch nicht bei uns eingegangen ist.</p>
        <p style="margin:0 0 8px 0;">Um die Bearbeitung Ihrer Bestellung fortsetzen zu können, bitten wir Sie um die zeitnahe Überweisung des offenen Betrags auf die unten genannte Bankverbindung.</p>
      </div>`;

    const noteHtml = customNote?.trim() ? `
      <div style="margin-top: 16px; padding: 14px 16px; border-radius: 12px; background: #eef2ff; border: 1px solid #a5b4fc; font-size: 13px; color: #1e1b4b;">
        <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing:.1em; color:#4338ca; margin-bottom:4px;">📝 Hinweis von uns</div>
        ${customNote.trim()}
      </div>` : '';

    const nextStepHtml = `
      <div style="margin-top: 20px; padding: 14px; border-radius: 12px; border: 1px dashed #94a3b8; background: #f8fafc;">
        <div style="font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: .08em; margin-bottom:4px;">⏰ Was passiert als Nächstes?</div>
        <div style="font-size: 13px; color: #0f172a;">Sobald der Zahlungseingang bei uns verbucht wurde, setzen wir die Bestellung unverzüglich in Produktion / Versand. Danke für Ihre Unterstützung!</div>
      </div>`;

    // --- Subject / HTML / TEXT ---
    const subject = `💰 Zahlungserinnerung – Bestellung #${orderNumber} (${branding.company_name})`;
    const contentHtml = `
    <div style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 24px;">
      <div style="max-width: 620px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="padding: 22px; background: linear-gradient(90deg, ${branding.primary_color}, ${branding.secondary_color}); color: white;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap: 12px;">
            <div>
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing:.08em; opacity:.95;">Vorkasse · Zahlungserinnerung</div>
              <div style="font-size: 20px; font-weight: 800; margin-top:2px;">Zahlung ausstehend</div>
            </div>
            <div style="text-align:right; background: rgba(255,255,255,.12); padding:8px 12px; border-radius:10px;">
              <div style="font-size: 11px; opacity:.9;">#</div>
              <div style="font-size: 16px; font-weight: 800;">${orderNumber}</div>
            </div>
          </div>
        </div>
        <div style="padding: 22px;">
          <div style="margin-bottom: 16px; text-align:center;">${logosHtml}</div>
          ${introHtml}
          ${bankBoxHtml}
          ${noteHtml}
          ${nextStepHtml}
        </div>
        ${branding.footer_text ? `<div style="padding: 16px 22px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">${branding.footer_text}</div>` : ''}
      </div>
    </div>`;

    const reminderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];
    const orderPlaceholders = buildOrderEmailPlaceholders(order, reminderItems);
    const html = applyShopEmailFrame(order.shop_id, {
      shop_name: branding.company_name,
      customer_name: customerName,
      order_number: orderNumber,
      subject,
      year: String(new Date().getFullYear()),
      logo_url: branding.logo_url,
      email_logo_url: branding.email_logo_url,
      primary_color: branding.primary_color,
      secondary_color: branding.secondary_color,
      footer_text: branding.footer_text,
      ...orderPlaceholders
    }, contentHtml);

    const textLines = [
      `Zahlungserinnerung – Bestellung #${orderNumber} (${branding.company_name})`,
      ``,
      `Hallo ${customerName},`,
      ``,
      `vielen Dank für Ihre Bestellung. Der Betrag für die Bestellung #${orderNumber} ist noch offen.`,
      ``,
      `Zu zahlender Betrag: ${total}`,
      `Zahlungsziel: ${dueDateStr}`,
      `Verwendungszweck: ${orderNumber}`,
      ``,
      `Bankverbindung:`,
      `${bankData.company_name || branding.company_name}`,
      bankData.bank_name ? bankData.bank_name : '',
      bankData.iban ? `IBAN: ${bankData.iban}` : '',
      bankData.bic ? `BIC: ${bankData.bic}` : '',
      ``,
      customNote?.trim() ? `Hinweis von uns:\n${customNote.trim()}\n\n` : '',
      `Sobald der Zahlungseingang bei uns verbucht wurde, setzen wir die Bestellung sofort fort.`,
      ``,
      `Mit freundlichen Grüßen,`,
      `${branding.company_name}`
    ];
    const text = textLines.filter(Boolean).join('\n');

    const ok = await sendEmailWithInvoice({ to: [order.customer_email], subject, text, html });
    return { success: !!ok, recipient: order.customer_email, error: ok ? undefined : 'E-Mail Versand fehlgeschlagen (Siehe Logs).' };
  } catch (e: any) {
    console.error('[Payment Reminder] Error:', e);
    return { success: false, recipient: null, error: e.message || 'Interner Fehler.' };
  }
};

// ============================================
// Test-E-Mail: sieht aus wie eine echte Bestellbestätigung eines Shops
// ============================================
export const sendShopTestEmail = async (
    shopId: string,
    to: string
): Promise<{ success: boolean; recipient: string | null; error?: string }> => {
    const config = getEmailConfig();
    if (!config) {
        return { success: false, recipient: null, error: 'E-Mail-Konfiguration fehlt.' };
    }
    if (!to || !to.includes('@')) {
        return { success: false, recipient: null, error: 'Ungültige Empfängeradresse.' };
    }

    try {
        const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId) as any;
        if (!shop) return { success: false, recipient: null, error: 'Shop nicht gefunden.' };

        const branding = {
            logo_url: shop.logo_url?.startsWith('http') ? shop.logo_url : '',
            email_logo_url: shop.email_logo_url?.startsWith('http') ? shop.email_logo_url : '',
            primary_color: shop.primary_color || '#3b82f6',
            secondary_color: shop.secondary_color || '#1e40af',
            company_name: shop.name || config.sender_name,
            footer_text: ''
        };
        const globalContent = db.prepare("SELECT * FROM global_shop_content WHERE id = 'main'").get() as any;
        if (globalContent) {
            const parts = [];
            if (globalContent.company_name) parts.push(globalContent.company_name);
            if (globalContent.company_address) parts.push(globalContent.company_address);
            if (globalContent.contact_email) parts.push(globalContent.contact_email);
            branding.footer_text = parts.join(' | ');
        }

        const orderNumber = `TEST-${new Date().getFullYear()}-0001`;
        const customerName = 'Max Mustermann';
        const subject = `[TEST] Ihre Bestellung #${orderNumber} bei ${branding.company_name}`;

        // Inhalt – gleiche Struktur wie die echte Bestellbestätigung
        const contentHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bestellbestätigung (Test)</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .content { padding: 40px 30px; }
        .order-info { background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid ${branding.primary_color}; }
        .order-info p { margin: 5px 0; }
        table.items { width: 100%; border-collapse: collapse; margin-top: 12px; }
        table.items th, table.items td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #eee; font-size: 14px; }
        table.items td.num, table.items th.num { text-align: right; }
    </style>
</head>
<body>
    <div class="container">
        <div class="content">
            <h2 style="color: ${branding.secondary_color || '#333'}">Vielen Dank für Ihre Bestellung!</h2>
            <p>Guten Tag ${customerName},</p>
            <p>wir haben Ihre Bestellung erhalten und freuen uns, diese für Sie produzieren zu dürfen.</p>

            <div class="order-info">
                <p><strong>Bestellnummer:</strong> ${orderNumber}</p>
                <p><strong>Bestelldatum:</strong> ${new Date().toLocaleDateString('de-DE')}</p>
                <p><strong>Status:</strong> In Bearbeitung</p>
            </div>

            <table class="items">
                <thead>
                    <tr>
                        <th>Artikel</th>
                        <th class="num">Menge</th>
                        <th class="num">Preis</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>Beispiel T-Shirt (Motiv: Testmotiv)</td><td class="num">2</td><td class="num">19,90 €</td></tr>
                    <tr><td>Beispiel Hoodie (Motiv: Testmotiv)</td><td class="num">1</td><td class="num">44,90 €</td></tr>
                </tbody>
            </table>

            <p>Ihre Rechnung finden Sie als PDF-Anhang an dieser E-Mail.</p>
            <p>Bei Rückfragen stehen wir Ihnen gerne zur Verfügung.</p>
            <p>Mit freundlichen Grüßen<br>${branding.company_name}</p>
        </div>
    </div>
</body>
</html>
`;

        const html = applyShopEmailFrame(shopId, {
            shop_name: branding.company_name,
            customer_name: customerName,
            order_number: orderNumber,
            subject,
            year: String(new Date().getFullYear()),
            logo_url: branding.logo_url,
            email_logo_url: branding.email_logo_url,
            primary_color: branding.primary_color,
            secondary_color: branding.secondary_color,
            footer_text: branding.footer_text
        }, contentHtml);

        const text = `Guten Tag ${customerName},\n\nwir haben Ihre Test-Bestellung #${orderNumber} erhalten.\n\nMit freundlichen Grüßen\n${branding.company_name}`;

        const ok = await sendEmailWithInvoice({ to: [to], subject, text, html });
        return { success: !!ok, recipient: to, error: ok ? undefined : 'E-Mail Versand fehlgeschlagen (siehe Logs).' };
    } catch (e: any) {
        console.error('[Test Email] Error:', e);
        return { success: false, recipient: null, error: e.message || 'Interner Fehler.' };
    }
};
