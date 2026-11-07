import nodemailer from 'nodemailer';
import db from '../db.js';
import { Resend } from 'resend';
import fs from 'fs-extra';
import {
    escapeHtml,
    composeOrderMail,
    applyShopEmailFrame,
    buildLogoHtml,
    getMailTypeInfo,
    type MailType
} from './emailTemplates.js';

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
// Shop-Branding (Logo/Farben/Name/Footer) für Standardrahmen
// ============================================
// Wird nur für den Standardrahmen benötigt (Shops ohne eigene email.html).
// Der komplette Look eigener Vorlagen entsteht ausschließlich über das Design-ZIP.
interface ShopBranding {
    logo_url: string;
    email_logo_url: string;
    primary_color: string;
    secondary_color: string;
    company_name: string;
    footer_text: string;
}

const resolveShopBranding = (
    shopId: string | null | undefined,
    defaults: Partial<ShopBranding> & { company_name: string }
): ShopBranding => {
    const branding: ShopBranding = {
        logo_url: defaults.logo_url || '',
        email_logo_url: defaults.email_logo_url || '',
        primary_color: defaults.primary_color || '#3b82f6',
        secondary_color: defaults.secondary_color || '#1e40af',
        company_name: defaults.company_name,
        footer_text: defaults.footer_text || ''
    };
    if (shopId) {
        const shop = db.prepare('SELECT logo_url, email_logo_url, primary_color, secondary_color, name FROM shops WHERE id = ?').get(shopId) as any;
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
        const parts: string[] = [];
        if (globalContent.company_name) parts.push(globalContent.company_name);
        if (globalContent.company_address) parts.push(globalContent.company_address);
        if (globalContent.contact_email) parts.push(globalContent.contact_email);
        branding.footer_text = parts.join(' | ');
    }
    return branding;
};

// Vollständiger Standard-Mailrahmen (nur ohne eigene email.html-Vorlage).
const standardShell = (opts: {
    branding: ShopBranding;
    title: string;
    headerHtml: string;
    bodyHtml: string;
    footerHtml?: string;
    maxWidth?: number;
    bodyBg?: string;
    radius?: number;
    cardBorder?: string;
    cardShadow?: string;
}): string => {
    const { branding, title, headerHtml, bodyHtml } = opts;
    const maxWidth = opts.maxWidth ?? 640;
    const bodyBg = opts.bodyBg ?? '#f8fafc';
    const radius = opts.radius ?? 16;
    const cardBorder = opts.cardBorder ?? '1px solid #e2e8f0';
    const cardShadow = opts.cardShadow ?? '0 2px 8px rgba(0,0,0,0.05)';
    const footerHtml = opts.footerHtml !== undefined
        ? opts.footerHtml
        : (branding.footer_text
            ? `<div style="padding: 16px 22px; border-top: 1px solid #e2e8f0; color:#64748b; font-size:12px;">${branding.footer_text}</div>`
            : '');
    return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0; padding:0; background-color:${bodyBg}; font-family: Arial, Helvetica, sans-serif;">
  <div style="max-width:${maxWidth}px; margin:20px auto; background:#ffffff; border-radius:${radius}px; overflow:hidden; border:${cardBorder}; box-shadow:${cardShadow};">
    ${headerHtml}
    <div style="padding: 24px 22px;">${bodyHtml}</div>
    ${footerHtml}
  </div>
</body>
</html>`;
};

// Kopfzeile mit Farbverlauf (für Versand, Produktionsstart, Abholung, Erinnerung, Betreiber).
const gradientHeader = (branding: ShopBranding, opts: { kicker?: string; title: string; right?: string }): string => `
  <div style="padding: 22px; background: linear-gradient(90deg, ${branding.primary_color}, ${branding.secondary_color}); color:#ffffff;">
    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
      <div>
        ${opts.kicker ? `<div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; opacity:.95;">${escapeHtml(opts.kicker)}</div>` : ''}
        <div style="font-size:20px; font-weight:800; margin-top:2px;">${escapeHtml(opts.title)}</div>
      </div>
      ${opts.right ? `<div style="text-align:right; background: rgba(255,255,255,.14); padding:8px 12px; border-radius:10px; font-size:15px; font-weight:800;">${escapeHtml(opts.right)}</div>` : ''}
    </div>
  </div>`;

const centeredLogo = (branding: ShopBranding): string =>
    `<div style="margin-bottom: 16px; text-align:center;">${buildLogoHtml({
        logo_url: branding.logo_url,
        email_logo_url: branding.email_logo_url,
        shop_name: branding.company_name
    })}</div>`;

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

            const fromAddress = `${config.sender_name} <${config.sender_email}>`;

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
                    pass: config.smtp_pass
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

// Reihenfolge der Bereiche im Nachrichteninhalt je Mailart (nur für den Standard),
// damit Artikel/Summen/Fortschritt weiterhin genau einmal ausgegeben werden.
type MailSection = { key: 'items' | 'totals' | 'progress'; label?: string };

// ============================================
// Kontaktformular eines Onlineshops
// ============================================
// Fallback-Empfänger, wenn im Shop keine eigene Kontakt-E-Mail hinterlegt ist
export const DEFAULT_SHOP_CONTACT_RECIPIENT = 'info@maintextildruck.com';

// Wird mit der optionalen Shop-E-Mail-Vorlage (email.html) umrahmt; die Kontaktdaten
// und die Nachricht landen im Platzhalter {{content}}. Bestellbereiche (Fortschritt,
// Artikel) bleiben bei Kontaktmails leer.
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

// ============================================
// Bestellbestätigung
// ============================================
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

        const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];
        const branding = resolveShopBranding(order.shop_id, { company_name: config.sender_name, primary_color: '#3b82f6', secondary_color: '#1e40af' });
        const orderNumber = String(order.order_number || order.id);
        const subject = `Ihre Bestellung #${orderNumber} bei ${branding.company_name}`;
        const year = new Date().getFullYear();
        const orderDate = order.created_at ? new Date(order.created_at).toLocaleDateString('de-DE') : '';
        const statusLabel = orderStatusLabel(order);

        const vars = {
            shop_name: branding.company_name,
            customer_name: order.customer_name || '',
            order_number: orderNumber,
            subject,
            year: String(year),
            logo_url: branding.logo_url,
            email_logo_url: branding.email_logo_url,
            primary_color: branding.primary_color,
            secondary_color: branding.secondary_color,
            footer_text: branding.footer_text
        };

        const defaultMessageHtml = `
            <h2 style="color: ${escapeHtml(branding.secondary_color || '#333')}; margin: 0 0 12px;">Vielen Dank für Ihre Bestellung!</h2>
            <p style="margin:0 0 10px;">Guten Tag ${escapeHtml(order.customer_name || '')},</p>
            <p style="margin:0 0 10px;">wir haben Ihre Bestellung erhalten und freuen uns, diese für Sie produzieren zu dürfen.</p>
            <div style="background-color:#f8f9fa; padding:20px; border-radius:6px; margin:20px 0; border-left:4px solid ${escapeHtml(branding.primary_color)};">
                <p style="margin:5px 0;"><strong>Bestellnummer:</strong> ${escapeHtml(orderNumber)}</p>
                <p style="margin:5px 0;"><strong>Bestelldatum:</strong> ${escapeHtml(orderDate)}</p>
                <p style="margin:5px 0;"><strong>Status:</strong> ${escapeHtml(statusLabel)}</p>
            </div>
            <p style="margin:0 0 10px;">Ihre Rechnung finden Sie als PDF-Anhang an dieser E-Mail.</p>
            <p style="margin:0 0 10px;">Bei Rückfragen stehen wir Ihnen gerne zur Verfügung.</p>
            <p style="margin:0;">Mit freundlichen Grüßen<br>${escapeHtml(branding.company_name)}</p>`;

        const { html } = composeOrderMail({
            shopId: order.shop_id,
            order,
            items,
            mailType: 'order_confirmation',
            vars,
            defaultMessageHtml,
            sections: [],
            buildStandard: (content) => standardShell({
                branding,
                title: 'Bestellbestätigung',
                radius: 8,
                maxWidth: 600,
                bodyBg: '#f4f4f4',
                headerHtml: `<div style="padding:30px; text-align:center; background:#ffffff; border-bottom:4px solid ${escapeHtml(branding.primary_color)};">${buildLogoHtml(vars)}</div>`,
                footerHtml: `<div style="background:#333; color:#eee; padding:20px; text-align:center; font-size:12px;">&copy; ${year} ${escapeHtml(branding.company_name)}${branding.footer_text ? `<br>${branding.footer_text}` : ''}</div>`,
                bodyHtml: content
            })
        });

        const text = `Guten Tag ${order.customer_name},

vielen Dank für Ihre Bestellung bei ${branding.company_name}!

Bestellnummer: ${orderNumber}
Datum: ${orderDate}

Wir haben Ihre Bestellung erhalten und bearbeiten diese schnellstmöglich.
Ihre Rechnung finden Sie als PDF im Anhang.

Mit freundlichen Grüßen
${branding.company_name}
`;

        return await sendEmailWithInvoice({
            to: [order.customer_email],
            subject,
            text,
            html,
            invoicePath,
            invoiceFilename: `Rechnung_${orderNumber}.pdf`
        });
    } catch (e) {
        console.error('Error sending order confirmation:', e);
        return false;
    }
};

// Statuslabel (neutral) aus dem tatsächlichen Bearbeitungsstand ableiten.
const ORDER_STATUS_LABELS: Record<string, string> = {
    pending_payment: 'Zahlung ausstehend',
    active: 'In Bearbeitung',
    shipped: 'Versendet',
    cancelled: 'Storniert',
    storniert: 'Storniert',
    completed: 'Abgeschlossen'
};
const orderStatusLabel = (order: any): string => {
    const status = String(order?.status || '').toLowerCase().trim();
    return ORDER_STATUS_LABELS[status] || (status ? status : 'In Bearbeitung');
};

// ============================================
// Versandbenachrichtigung
// ============================================
export const sendShipmentNotification = async (orderId: string, trackingNumber?: string) => {
    const config = getEmailConfig();
    if (!config) {
        console.warn('Email configuration missing. Skipping email sending.');
        return false;
    }

    try {
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
        if (!order || !order.customer_email) return false;

        const branding = resolveShopBranding(order.shop_id, { company_name: config.sender_name, primary_color: '#3b82f6', secondary_color: '#1e40af' });
        const orderNumber = String(order.order_number || order.id);
        const tn = String(trackingNumber || order.tracking_number || '').trim();
        const trackingUrl = tn ? `https://www.dhl.de/de/privatkunden/dhl-sendungsverfolgung.html?piececode=${encodeURIComponent(tn)}` : '';
        const subject = tn
            ? `Ihre Bestellung #${orderNumber} ist auf dem Weg (Sendungsnummer: ${tn})`
            : `Ihre Bestellung #${orderNumber} ist auf dem Weg`;

        const vars = {
            shop_name: branding.company_name,
            customer_name: order.customer_name || '',
            order_number: orderNumber,
            subject,
            year: String(new Date().getFullYear()),
            tracking_number: tn,
            tracking_url: trackingUrl,
            logo_url: branding.logo_url,
            email_logo_url: branding.email_logo_url,
            primary_color: branding.primary_color,
            secondary_color: branding.secondary_color,
            footer_text: branding.footer_text
        };

        const trackingBox = tn ? `
            <div style="margin: 14px 0; padding: 14px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc;">
              <div style="font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 6px;">Sendungsnummer</div>
              <div style="font-size: 16px; font-weight: 800; color: #0f172a;">${escapeHtml(tn)}</div>
              ${trackingUrl ? `<div style="margin-top: 10px;"><a href="${escapeHtml(trackingUrl)}" style="display:inline-block; padding: 10px 14px; border-radius: 12px; background: ${escapeHtml(branding.primary_color)}; color: white; text-decoration: none; font-weight: 700; font-size: 13px;">Sendung verfolgen</a></div>` : ''}
            </div>` : '';

        const defaultMessageHtml = `
            <p style="font-size: 14px; color: #0f172a; line-height: 1.5; margin:0 0 10px;">Ihre Bestellung ist jetzt im Versand.</p>
            ${trackingBox}
            <p style="font-size: 12px; color: #64748b; margin-top: 12px;">Sie finden die Sendungsnummer auch jederzeit in Ihrem Kundenkonto unter „Meine Bestellungen“.</p>`;

        const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];
        const { html } = composeOrderMail({
            shopId: order.shop_id,
            order,
            items,
            mailType: 'shipment',
            vars,
            defaultMessageHtml,
            sections: [],
            buildStandard: (content) => standardShell({
                branding,
                title: 'Versandupdate',
                headerHtml: gradientHeader(branding, { kicker: 'Versandupdate', title: 'Ihre Bestellung ist unterwegs', right: `#${orderNumber}` }),
                bodyHtml: `${centeredLogo(branding)}${content}`
            })
        });

        const text = tn
            ? `Ihre Bestellung #${orderNumber} ist jetzt im Versand. Sendungsnummer: ${tn}\n${trackingUrl ? `Sendung verfolgen: ${trackingUrl}\n` : ''}`
            : `Ihre Bestellung #${orderNumber} ist jetzt im Versand.`;

        return await sendEmailWithInvoice({
            to: [order.customer_email],
            subject,
            text,
            html
        });
    } catch (e) {
        console.error('Error sending shipment notification:', e);
        return false;
    }
};

// ============================================
// Produktionsstart
// ============================================
/**
 * Einmalige Kundenmail beim tatsächlichen Produktionsstart.
 * Wird ausgelöst, sobald der Bearbeitungsstatus explizit auf "In Bearbeitung"
 * ('active') gesetzt wird. Der Zahlstatus allein gilt NICHT als Produktionsstart.
 * Der Versand wird über orders.production_start_email_sent_at abgesichert, damit
 * wiederholtes Speichern keine zweite Mail auslöst.
 *
 * Texte sind bewusst neutral gehalten (keine shop-spezifischen Formulierungen);
 * der individuelle Look entsteht ausschließlich über das Design-ZIP des Shops.
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

        const branding = resolveShopBranding(order.shop_id, { company_name: config.sender_name, primary_color: '#3b82f6', secondary_color: '#1e40af' });
        const orderNumber = String(order.order_number || order.id);
        const typeInfo = getMailTypeInfo('production_started');
        const subject = `${typeInfo.title} – Bestellung #${orderNumber}`;

        const isPaid = ['paid', 'completed'].includes(String(order.payment_status || '').toLowerCase());
        const paymentLine = isPaid
            ? 'Ihre Zahlung ist bei uns eingegangen – vielen Dank!'
            : 'Ihre Zahlung ist bei uns noch offen. Wir starten dennoch mit der Produktion.';

        const vars = {
            shop_name: branding.company_name,
            customer_name: order.customer_name || '',
            order_number: orderNumber,
            subject,
            year: String(new Date().getFullYear()),
            logo_url: branding.logo_url,
            email_logo_url: branding.email_logo_url,
            primary_color: branding.primary_color,
            secondary_color: branding.secondary_color,
            footer_text: branding.footer_text
        };

        const defaultMessageHtml = `
            <div style="margin-bottom: 16px; padding: 14px 16px; border-radius: 12px; border: 1px solid ${isPaid ? '#bbf7d0' : '#fde68a'}; background: ${isPaid ? '#f0fdf4' : '#fffbeb'}; font-size: 14px; color: #0f172a;">
                <div style="font-weight: 800; margin-bottom: 4px;">${isPaid ? 'Zahlung bestätigt' : 'Zahlung offen'}</div>
                <div>${paymentLine}</div>
            </div>
            <p style="font-size: 14px; color: #0f172a; line-height: 1.6; margin:0;">
                Ihre Bestellung befindet sich jetzt in der Produktion. Wir bereiten Ihren Auftrag vor und melden uns,
                sobald es weitergeht.
            </p>`;

        const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];
        const { html } = composeOrderMail({
            shopId: order.shop_id,
            order,
            items,
            mailType: 'production_started',
            vars,
            defaultMessageHtml,
            sections: [
                { key: 'items', label: 'Ihre Artikel' },
                { key: 'totals' },
                { key: 'progress', label: 'Fortschritt' }
            ],
            buildStandard: (content) => standardShell({
                branding,
                title: 'Produktionsstart',
                maxWidth: 720,
                headerHtml: gradientHeader(branding, { kicker: 'Produktionsstart', title: 'Ihre Bestellung ist in Bearbeitung', right: `#${orderNumber}` }),
                bodyHtml: `${centeredLogo(branding)}${content}`
            })
        });

        const text = [
            typeInfo.title,
            `Bestellung #${orderNumber}`,
            '',
            isPaid ? 'Ihre Zahlung ist bei uns eingegangen – vielen Dank!' : 'Ihre Zahlung ist bei uns noch offen.',
            '',
            'Ihre Artikel:',
            ...items.map((it: any, idx: number) => `${idx + 1}. ${it.item_name || ''} | ${Number(it.quantity) || 0}x | ${(Number(it.price) || 0).toFixed(2).replace('.', ',')} €`),
            '',
            'Ihre Bestellung befindet sich jetzt in der Produktion.'
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

// ============================================
// Betreiber-Benachrichtigung über neue Bestellung
// ============================================
export const sendShopOrderNotification = async (orderId: string, invoicePath: string, recipients: string | string[]) => {
    try {
        const to = normalizeRecipientList(recipients);
        if (!to.length) return false;

        const config = getEmailConfig();
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
        if (!order) return false;

        const shop = order.shop_id ? (db.prepare('SELECT * FROM shops WHERE id = ?').get(order.shop_id) as any) : null;
        const customer = order.shop_customer_id ? (db.prepare('SELECT * FROM shop_customers WHERE id = ?').get(order.shop_customer_id) as any) : null;
        const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];

        const shopName = shop?.name || 'Onlineshop';
        const orderNumber = String(order.order_number || order.id);
        const subject = `Neue Bestellung #${orderNumber} (${shopName})`;

        const branding = resolveShopBranding(order.shop_id, {
            company_name: shopName,
            primary_color: '#16a34a',
            secondary_color: '#0f172a'
        });

        const createdAt = order.created_at ? new Date(order.created_at).toLocaleString('de-DE') : '';
        const customerLine = customer
            ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
            : (order.customer_name || '');
        const customerEmail = order.customer_email || customer?.email || '';
        const customerPhone = order.customer_phone || customer?.phone || '';
        const addressLines = String(order.customer_address || '').split(/\n|,\s/).map(s => s.trim()).filter(Boolean);
        const addressHtml = addressLines.length ? addressLines.map(l => escapeHtml(l)).join('<br>') : '-';

        const paymentMethod = order.paymentMethod || order.payment_method || '-';
        const paymentStatus = order.paymentStatus || order.payment_status || '-';
        const isPaymentPending = ['open', 'pending', 'pending_payment', 'unpaid'].includes(String(paymentStatus).toLowerCase());
        const paymentStatusLabel = isPaymentPending ? `${paymentStatus} (Zahlung ausstehend)` : paymentStatus;

        const vars = {
            shop_name: shopName,
            customer_name: customerLine || '',
            order_number: orderNumber,
            subject,
            year: String(new Date().getFullYear()),
            logo_url: branding.logo_url,
            email_logo_url: branding.email_logo_url,
            primary_color: branding.primary_color,
            secondary_color: branding.secondary_color,
            footer_text: branding.footer_text
        };

        const defaultMessageHtml = `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 14px; margin-bottom:16px; font-size:14px; color:#0f172a; line-height:1.6;">
                <div><b>Bestellnummer:</b> ${escapeHtml(orderNumber)}</div>
                <div><b>Datum:</b> ${escapeHtml(createdAt)}</div>
                <div><b>Kunde:</b> ${escapeHtml(customerLine) || '-'}</div>
                <div><b>E-Mail:</b> ${escapeHtml(customerEmail) || '-'}${customerPhone ? ` · <b>Telefon:</b> ${escapeHtml(customerPhone)}` : ''}</div>
                <div><b>Adresse:</b><br>${addressHtml}</div>
            </div>
            <div style="margin-top:16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 14px; font-size:14px; color:#0f172a;">
                <div><b>Zahlungsart:</b> ${escapeHtml(String(paymentMethod))}</div>
                <div><b>Zahlungsstatus:</b> ${escapeHtml(String(paymentStatusLabel))}</div>
            </div>
            <p style="margin-top:16px; color:#334155; font-size:14px;">Die Rechnung ist als PDF im Anhang.</p>`;

        const { html } = composeOrderMail({
            shopId: order.shop_id,
            order,
            items,
            mailType: 'shop_notification',
            vars,
            defaultMessageHtml,
            sections: [
                { key: 'items', label: 'Artikel' },
                { key: 'totals' }
            ],
            buildStandard: (content) => standardShell({
                branding,
                title: 'Neue Bestellung',
                maxWidth: 720,
                headerHtml: gradientHeader(branding, { kicker: 'Neue Bestellung', title: shopName, right: `#${orderNumber}` }),
                bodyHtml: content
            })
        });

        const textLines = [
            `Neue Bestellung #${orderNumber} (${shopName})`,
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
            `Zahlungsart: ${paymentMethod}`,
            `Zahlungsstatus: ${paymentStatusLabel}`,
            '',
            'Rechnung ist im Anhang.'
        ].filter(Boolean);

        void config;
        return await sendEmailWithInvoice({
            to,
            subject,
            text: textLines.join('\n'),
            html,
            invoicePath,
            invoiceFilename: `Rechnung_${orderNumber}.pdf`
        });
    } catch (e) {
        console.error('Error sending shop order notification:', e);
        return false;
    }
};

// ============================================
// Abholung (Packstation)
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

const loadPickupTemplate = (shopId: string | null | undefined, fallback: string): string => {
    let templateRaw: string | null = null;
    if (shopId) {
        const shopCfg = db.prepare('SELECT pickup_email_template FROM shop_shipping_config WHERE shop_id = ?').get(shopId) as any;
        templateRaw = shopCfg?.pickup_email_template || null;
    }
    if (!templateRaw) {
        const gCfg = db.prepare("SELECT pickup_email_template FROM global_shipping_config WHERE id = 'main'").get() as any;
        templateRaw = gCfg?.pickup_email_template || null;
    }
    return templateRaw || fallback;
};

const paragraphsFromText = (text: string): string =>
    text.split('\n').map(l => l.trimEnd()).map(l =>
        l ? `<p style="font-size:14px; color:#0f172a; line-height:1.65; margin:0 0 12px 0;">${escapeHtml(l)}</p>` : '<div style="height:4px;"></div>'
    ).join('');

export const sendPickupConfirmation = async (orderId: string) => {
    const config = getEmailConfig();
    if (!config) {
        console.warn('[Pickup] Email config missing, skipping confirmation.');
        return false;
    }
    try {
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
        if (!order || !order.customer_email) return false;

        const branding = resolveShopBranding(order.shop_id, { company_name: config.sender_name, primary_color: '#0f172a', secondary_color: '#334155' });
        const orderNumber = String(order.order_number || order.id);

        const templateRaw = loadPickupTemplate(order.shop_id, PICKUP_DEFAULT_CONFIRMATION_TEXT);
        const renderedText = renderPickupTemplate(templateRaw, {
            order_number: orderNumber,
            customer_name: order.customer_name || 'Kunde',
            shop_name: branding.company_name,
            pickup_code: order.pickup_code || '',
            pickup_compartment: order.pickup_compartment || ''
        });

        const subject = `Bestellbestätigung #${orderNumber} – Abholung Packstation`;
        const vars = {
            shop_name: branding.company_name,
            customer_name: order.customer_name || '',
            order_number: orderNumber,
            subject,
            year: String(new Date().getFullYear()),
            pickup_code: order.pickup_code || '',
            pickup_compartment: order.pickup_compartment || '',
            logo_url: branding.logo_url,
            email_logo_url: branding.email_logo_url,
            primary_color: branding.primary_color,
            secondary_color: branding.secondary_color,
            footer_text: branding.footer_text
        };

        const defaultMessageHtml = `
            ${paragraphsFromText(renderedText)}
            <div style="margin-top: 18px; padding: 14px; border-radius: 12px; border: 1px dashed #94a3b8; background: #f8fafc;">
                <div style="font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: .08em; margin-bottom:4px;">Nächster Schritt</div>
                <div style="font-size: 13px; color: #0f172a;">Wir melden uns per E-Mail mit Ihrem persönlichen Abholcode und der Fachnummer, sobald die Bestellung fertig ist.</div>
            </div>`;

        const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];
        const { html } = composeOrderMail({
            shopId: order.shop_id,
            order,
            items,
            mailType: 'pickup_confirmation',
            vars,
            defaultMessageHtml,
            sections: [],
            buildStandard: (content) => standardShell({
                branding,
                title: 'Abholung',
                maxWidth: 620,
                headerHtml: gradientHeader(branding, { kicker: 'Packstation Abholung', title: 'Bestellung eingegangen', right: `#${orderNumber}` }),
                bodyHtml: `${centeredLogo(branding)}${content}`
            })
        });

        const text = renderedText + `\n\n--\nNächster Schritt: Sie erhalten bald eine weitere E-Mail mit Abholcode und Fachnummer.`;

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

        const branding = resolveShopBranding(order.shop_id, { company_name: config.sender_name, primary_color: '#16a34a', secondary_color: '#15803d' });
        const orderNumber = String(order.order_number || order.id);

        const renderedText = renderPickupTemplate(PICKUP_DEFAULT_READY_TEXT, {
            order_number: orderNumber,
            customer_name: order.customer_name || 'Kunde',
            shop_name: branding.company_name,
            pickup_code: code,
            pickup_compartment: compartment
        });

        const subject = `Bereit zur Abholung! Bestellung #${orderNumber} – Code ${code}`;
        const vars = {
            shop_name: branding.company_name,
            customer_name: order.customer_name || '',
            order_number: orderNumber,
            subject,
            pickup_code: code,
            pickup_compartment: compartment,
            year: String(new Date().getFullYear()),
            logo_url: branding.logo_url,
            email_logo_url: branding.email_logo_url,
            primary_color: branding.primary_color,
            secondary_color: branding.secondary_color,
            footer_text: branding.footer_text
        };

        const defaultMessageHtml = `
            ${paragraphsFromText(renderedText)}
            <div style="margin-top: 18px;">
              <div style="padding: 16px; border-radius: 12px; background: #fef3c7; border: 1px solid #f59e0b; text-align:center; margin-bottom:12px;">
                <div style="font-size: 11px; font-weight: 800; color: #92400e; text-transform: uppercase; letter-spacing:.08em;">Abholcode</div>
                <div style="margin-top:6px; font-size: 28px; font-weight: 900; letter-spacing: 2px; color: #78350f;">${escapeHtml(code)}</div>
              </div>
              <div style="padding: 16px; border-radius: 12px; background: #dbeafe; border: 1px solid #3b82f6; text-align:center;">
                <div style="font-size: 11px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing:.08em;">Fach-Nummer</div>
                <div style="margin-top:6px; font-size: 28px; font-weight: 900; letter-spacing: 1px; color: #1e3a8a;">${escapeHtml(compartment)}</div>
              </div>
            </div>
            <div style="margin-top: 16px; padding: 12px 14px; border-radius: 10px; background: #f0fdf4; border: 1px solid #bbf7d0; font-size: 13px; color: #14532d;">
                Tipp: Geben Sie einfach den Abholcode am Packstation-Terminal ein – das Fach öffnet sich automatisch.
            </div>`;

        const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];
        const { html } = composeOrderMail({
            shopId: order.shop_id,
            order,
            items,
            mailType: 'pickup_ready',
            vars,
            defaultMessageHtml,
            sections: [],
            buildStandard: (content) => standardShell({
                branding,
                title: 'Abholbereit',
                maxWidth: 620,
                bodyBg: '#f0fdf4',
                cardBorder: '2px solid #16a34a',
                cardShadow: '0 8px 30px rgba(22,163,74,.12)',
                headerHtml: gradientHeader(branding, { kicker: 'Packstation', title: 'Bestellung abholbereit!', right: `#${orderNumber}` }),
                bodyHtml: `${centeredLogo(branding)}${content}`
            })
        });

        return await sendEmailWithInvoice({ to: [order.customer_email], subject, text: renderedText, html });
    } catch (e) {
        console.error('[Pickup Ready] Error:', e);
        return false;
    }
};

// ============================================
// Vorkasse-Zahlungserinnerung
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

        const branding = resolveShopBranding(order.shop_id, { company_name: config.sender_name, primary_color: '#0f172a', secondary_color: '#334155' });
        const globalContent = db.prepare("SELECT * FROM global_shop_content WHERE id = 'main'").get() as any;

        // --- Bankdaten (Priority: Shop > Global) ---
        const bankData: any = {
            bank_name: globalContent?.bank_name || '',
            iban: globalContent?.bank_iban || '',
            bic: globalContent?.bank_bic || '',
            company_name: globalContent?.company_name || branding.company_name
        };
        if (order.shop_id) {
            try {
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

        const orderNumber = String(order.order_number || order.id);
        const customerName = order.customer_name || 'Sehr geehrte Damen und Herren';
        const orderDate = order.created_at ? new Date(order.created_at).toLocaleDateString('de-DE') : '';
        const totalRaw = Number(order.total_price || order.total || order.total_amount || 0);
        const total = isNaN(totalRaw) ? '0,00 €' : totalRaw.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);
        const dueDateStr = dueDate.toLocaleDateString('de-DE');

        const bankBoxHtml = `
          <div style="margin-top: 6px; padding: 18px; border-radius: 14px; background: linear-gradient(180deg, #fff7ed, #ffedd5); border: 1px solid #fdba74;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing:.08em; color:#9a3412; margin-bottom:6px;">Zu zahlender Betrag</div>
            <div style="font-size: 26px; font-weight: 900; color: #7c2d12;">${escapeHtml(total)}</div>
            <div style="font-size: 12px; color: #78350f; margin-top:6px;">Bestellung: <b>${escapeHtml(orderNumber)}</b>${orderDate ? ` · vom ${escapeHtml(orderDate)}` : ''}</div>
            <div style="font-size: 12px; color: #78350f; margin-top:2px;">Zahlungsziel: <b>${escapeHtml(dueDateStr)}</b></div>
            <div style="margin-top: 14px; font-size: 13px; color: #0f172a; line-height: 1.6;">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing:.08em; color:#9a3412; margin-bottom:4px;">Bankverbindung</div>
              <div><b>${escapeHtml(bankData.company_name || branding.company_name)}</b></div>
              ${bankData.bank_name ? `<div>${escapeHtml(bankData.bank_name)}</div>` : ''}
              ${bankData.iban ? `<div>IBAN: <b style="font-family: monospace;">${escapeHtml(bankData.iban)}</b></div>` : ''}
              ${bankData.bic ? `<div>BIC: <b style="font-family: monospace;">${escapeHtml(bankData.bic)}</b></div>` : ''}
            </div>
            <div style="margin-top: 14px; padding: 10px 12px; border-radius: 10px; background: white; border: 1px dashed #fb923c; font-size: 12px; color:#7c2d12;">
              Bitte geben Sie im Verwendungszweck <b>unbedingt die Bestellnummer „${escapeHtml(orderNumber)}“</b> an, damit wir die Zahlung zuordnen können. Vielen Dank!
            </div>
          </div>`;

        const noteHtml = customNote?.trim() ? `
          <div style="margin-top: 16px; padding: 14px 16px; border-radius: 12px; background: #eef2ff; border: 1px solid #a5b4fc; font-size: 13px; color: #1e1b4b;">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing:.1em; color:#4338ca; margin-bottom:4px;">Hinweis von uns</div>
            ${escapeHtml(customNote.trim())}
          </div>` : '';

        const subject = `Zahlungserinnerung – Bestellung #${orderNumber} (${branding.company_name})`;
        const vars = {
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
        };

        const defaultMessageHtml = `
          <div style="font-size: 15px; color: #0f172a; line-height: 1.7;">
            <p style="margin:0 0 10px 0;">Hallo ${escapeHtml(customerName)},</p>
            <p style="margin:0 0 10px 0;">vielen Dank für Ihre Bestellung bei <b>${escapeHtml(branding.company_name)}</b>. Wir möchten Sie freundlich daran erinnern, dass der Betrag für Ihre Bestellung <b>#${escapeHtml(orderNumber)}</b> bisher noch nicht bei uns eingegangen ist.</p>
            <p style="margin:0 0 8px 0;">Um die Bearbeitung Ihrer Bestellung fortsetzen zu können, bitten wir Sie um die zeitnahe Überweisung des offenen Betrags auf die unten genannte Bankverbindung.</p>
          </div>
          ${bankBoxHtml}
          ${noteHtml}
          <div style="margin-top: 20px; padding: 14px; border-radius: 12px; border: 1px dashed #94a3b8; background: #f8fafc;">
            <div style="font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: .08em; margin-bottom:4px;">Was passiert als Nächstes?</div>
            <div style="font-size: 13px; color: #0f172a;">Sobald der Zahlungseingang bei uns verbucht wurde, setzen wir die Bestellung unverzüglich in Produktion / Versand. Danke für Ihre Unterstützung!</div>
          </div>`;

        const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];
        const { html } = composeOrderMail({
            shopId: order.shop_id,
            order,
            items,
            mailType: 'payment_reminder',
            vars,
            defaultMessageHtml,
            sections: [],
            buildStandard: (content) => standardShell({
                branding,
                title: 'Zahlungserinnerung',
                maxWidth: 620,
                headerHtml: gradientHeader(branding, { kicker: 'Vorkasse · Zahlungserinnerung', title: 'Zahlung ausstehend', right: `#${orderNumber}` }),
                bodyHtml: `${centeredLogo(branding)}${content}`
            })
        });

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
// Test-E-Mail: rendert die tatsächlich gespeicherten Vorlagen eines Shops
// ============================================
const TEST_SAMPLE_ITEMS = (): any[] => ([
    { item_name: 'Beispiel T-Shirt', item_number: 'TS-001', size: 'L', color: 'Schwarz', quantity: 2, price: 19.9, image: '' },
    { item_name: 'Beispiel Hoodie', item_number: 'HD-002', size: 'M', color: 'Bordeaux', quantity: 1, price: 44.9, image: '' }
]);

// Beispiel-Bestellung je Mailart, damit die Testmail den echten Fall abbildet.
const TEST_ORDER_FOR = (mailType: MailType, shopId: string, to: string) => {
    const base: any = {
        id: `TEST-${Date.now()}`,
        shop_id: shopId,
        order_number: `TEST-${new Date().getFullYear()}-0001`,
        created_at: new Date().toISOString(),
        customer_name: 'Max Mustermann',
        customer_email: to,
        customer_address: 'Musterstraße 1\n12345 Musterstadt',
        status: 'active',
        payment_status: 'paid',
        shipping_method: 'dhl',
        pickup_status: '',
        shipping_costs: 4.9,
        discount_amount: 0,
        total_amount: 89.6,
        voucher_code: ''
    };
    switch (mailType) {
        case 'production_started':
            base.status = 'active';
            break;
        case 'shipment':
            base.status = 'shipped';
            base.tracking_number = '00340434161094000000';
            break;
        case 'pickup_confirmation':
            base.shipping_method = 'pickup';
            base.status = 'active';
            break;
        case 'pickup_ready':
            base.shipping_method = 'pickup';
            base.status = 'active';
            base.pickup_status = 'ready';
            break;
        case 'payment_reminder':
            base.status = 'pending_payment';
            base.payment_status = 'pending';
            break;
        case 'shop_notification':
            base.status = 'active';
            break;
        default:
            break;
    }
    return base;
};

// Standard-Bereiche je Mailart (identisch zu den echten Mails).
const sectionsForMailType = (mailType: MailType): MailSection[] => {
    switch (mailType) {
        case 'production_started':
            return [{ key: 'items', label: 'Ihre Artikel' }, { key: 'totals' }, { key: 'progress', label: 'Fortschritt' }];
        case 'shop_notification':
            return [{ key: 'items', label: 'Artikel' }, { key: 'totals' }];
        default:
            return [];
    }
};

export const sendShopTestEmail = async (
    shopId: string,
    to: string,
    mailType: MailType = 'order_confirmation'
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

        const branding = resolveShopBranding(shopId, {
            company_name: shop.name || config.sender_name,
            primary_color: '#3b82f6',
            secondary_color: '#1e40af'
        });
        const typeInfo = getMailTypeInfo(mailType);
        const order = TEST_ORDER_FOR(mailType, shopId, to);
        const items = TEST_SAMPLE_ITEMS();
        const subject = `[TEST] ${typeInfo.label} – Bestellung #${order.order_number}`;
        const year = new Date().getFullYear();

        const vars = {
            shop_name: branding.company_name,
            customer_name: order.customer_name,
            order_number: order.order_number,
            subject,
            year: String(year),
            tracking_number: order.tracking_number || '',
            pickup_code: order.pickup_code || 'A1B2C3',
            pickup_compartment: order.pickup_compartment || 'Fach 12',
            logo_url: branding.logo_url,
            email_logo_url: branding.email_logo_url,
            primary_color: branding.primary_color,
            secondary_color: branding.secondary_color,
            footer_text: branding.footer_text
        };

        const defaultMessageHtml = `
            <h2 style="color: ${escapeHtml(branding.secondary_color || '#333')}; margin: 0 0 12px;">${escapeHtml(typeInfo.title)}</h2>
            <p style="margin:0 0 10px;">Guten Tag ${escapeHtml(order.customer_name)},</p>
            <p style="margin:0 0 10px;">${escapeHtml(typeInfo.intro)}</p>
            ${typeInfo.note ? `<p style="margin:0 0 10px; color:#475569;">${escapeHtml(typeInfo.note)}</p>` : ''}
            <p style="margin:0;">Mit freundlichen Grüßen<br>${escapeHtml(branding.company_name)}</p>`;

        const { html } = composeOrderMail({
            shopId,
            order,
            items,
            mailType,
            vars,
            defaultMessageHtml,
            sections: sectionsForMailType(mailType),
            buildStandard: (content) => standardShell({
                branding,
                title: `Test: ${typeInfo.label}`,
                headerHtml: gradientHeader(branding, { kicker: `Testmail · ${typeInfo.label}`, title: typeInfo.title, right: `#${order.order_number}` }),
                bodyHtml: `${centeredLogo(branding)}${content}`
            })
        });

        const text = `[TEST] ${typeInfo.label}\n\n${typeInfo.title}\n\n${typeInfo.intro}\n\nMit freundlichen Grüßen\n${branding.company_name}`;

        const ok = await sendEmailWithInvoice({ to: [to], subject, text, html });
        return { success: !!ok, recipient: to, error: ok ? undefined : 'E-Mail Versand fehlgeschlagen (siehe Logs).' };
    } catch (e: any) {
        console.error('[Test Email] Error:', e);
        return { success: false, recipient: null, error: e.message || 'Interner Fehler.' };
    }
};
