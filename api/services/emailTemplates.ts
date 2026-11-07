/**
 * ============================================================
 * Shopspezifische E-Mail-Vorlagen (Design-ZIP) – zentrale Bausteine
 * ============================================================
 * Kapselt alles, was für einen vollständig über das Design-ZIP
 * gestaltbaren Mail-Look nötig ist:
 *   - einen kleinen Mustache-Renderer ({{wert}}, {{{roh}}},
 *     {{#schleife}}...{{/schleife}}, {{^bedingung}}...{{/bedingung}})
 *   - die optionale Rahmenvorlage "email.html" (custom_email_html)
 *   - die optionalen Teilvorlagen "email-progress.html",
 *     "email-order-items.html", "email-order-totals.html",
 *     "email-message.html" (custom_email_partials als JSON)
 *   - die dokumentierten Mailtypen samt Standard-Texten und Daten
 *
 * Wichtig: Es werden hier KEINE shop-spezifischen Texte, Farben oder
 * Schriften fest hinterlegt. Der eigentliche Look entsteht ausschließlich
 * über die hochgeladenen Vorlagen des jeweiligen Shops. Fehlt eine Vorlage,
 * greift der neutrale Standard.
 */

import db from '../db.js';
import { getPublicBaseUrl, withResolvedItemImages } from './orderImages.js';

// ---------- HTML-Helfer ----------
export const escapeHtml = (value: any): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const formatEur = (n: number): string => `${(Number(n) || 0).toFixed(2).replace('.', ',')} €`;

// Skripte werden aus allen Mailvorlagen entfernt (Mail-Clients führen sie ohnehin nicht aus).
const stripScripts = (html: string): string =>
    String(html || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

// ============================================================
// Vorlagen-Renderer (bewusst kleine, sichere Mustache-Teilmenge)
// ============================================================
//   {{key}}      -> Wert, HTML-escaped
//   {{{key}}}    -> Roh-Wert (HTML erlaubt)
//   {{#key}}...{{/key}}  -> Schleife über Liste ODER Bedingung (truthy)
//   {{^key}}...{{/key}}  -> Invertierte Bedingung (leer/falsy)
// Punkt-Notation (z.B. {{progress.steps}}) ist erlaubt.
// Schlüssel in rawKeys werden immer roh eingesetzt (fertige HTML-Blöcke).

const resolveAssetUrl = (value: string, assetBase?: string): string => {
    const v = String(value || '').trim();
    if (!v) return v;
    if (/^(https?:)?\/\//i.test(v)) return v;
    if (/^(data:|blob:|mailto:|tel:|#)/i.test(v)) return v;
    if (v.startsWith('/')) return v;
    if (!assetBase) return v;
    return assetBase.replace(/\/+$/, '') + '/' + v.replace(/^\.?\//, '');
};

const lookup = (ctx: Record<string, any>, key: string): any => {
    if (ctx && Object.prototype.hasOwnProperty.call(ctx, key)) return ctx[key];
    if (key.includes('.')) {
        return key.split('.').reduce((acc: any, part: string) => (acc == null ? undefined : acc[part]), ctx);
    }
    return ctx ? ctx[key] : undefined;
};

export interface RenderMailOptions {
    /** Basis für relative Asset-Pfade, z.B. https://host/shop-assets/<shopId>/ */
    assetBase?: string;
    /** Schlüssel, die immer roh (ungeescaped) eingesetzt werden. */
    rawKeys?: string[];
}

export const renderMailTemplate = (
    templateHtml: string,
    context: Record<string, any>,
    opts: RenderMailOptions = {}
): string => {
    const base = opts.assetBase || '';
    const rawKeys = new Set(opts.rawKeys || []);
    const ctx: Record<string, any> = { ...(context || {}) };
    let html = stripScripts(String(templateHtml || ''));

    const renderInto = (tpl: string, scope: Record<string, any>): string => {
        let out = tpl;
        // Schleifen/Bedingungen (mehrere Durchläufe für verschachtelte Listen)
        for (let pass = 0; pass < 6; pass++) {
            let changed = false;

            // Invertierte Bedingung
            out = out.replace(/\{\{\s*\^\s*([\w.-]+)\s*\}\}([\s\S]*?)\{\{\s*\/\s*\1\s*\}\}/g,
                (_m, key: string, inner: string) => {
                    changed = true;
                    const value = lookup(scope, key);
                    const isEmpty = Array.isArray(value) ? value.length === 0 : !value;
                    return isEmpty ? renderInto(inner, scope) : '';
                });

            // Schleife / Bedingung
            out = out.replace(/\{\{\s*#\s*([\w.-]+)\s*\}\}([\s\S]*?)\{\{\s*\/\s*\1\s*\}\}/g,
                (_m, key: string, inner: string) => {
                    changed = true;
                    const value = lookup(scope, key);
                    if (Array.isArray(value)) {
                        return value.map((item: any) => {
                            if (item && typeof item === 'object') return renderInto(inner, { ...scope, ...item });
                            return renderInto(inner, { ...scope, '.': item });
                        }).join('');
                    }
                    return value ? renderInto(inner, scope) : '';
                });

            if (!changed) break;
        }

        // Roh-Werte {{{key}}}
        out = out.replace(/\{\{\{\s*([\w.-]+)\s*\}\}\}/g, (_m, key: string) => {
            const value = lookup(scope, key);
            return value === null || value === undefined ? '' : String(value);
        });

        // Werte {{key}} (fertige HTML-Blöcke bleiben roh)
        out = out.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_m, key: string) => {
            const value = lookup(scope, key);
            if (rawKeys.has(key)) return value === null || value === undefined ? '' : String(value);
            return escapeHtml(value);
        });

        return out;
    };

    html = renderInto(html, ctx);

    // Relative Asset-Pfade auf absolute öffentliche URLs auflösen (E-Mail-Clients
    // können relative Pfade nicht laden).
    if (base) {
        html = html.replace(/\b(href|src|poster|data-src)\s*=\s*"([^"]*)"/gi,
            (_m, attr: string, val: string) => `${attr}="${resolveAssetUrl(val, base)}"`);
    }
    return html;
};

// ============================================================
// Mailtypen (dokumentiert)
// ============================================================
export type MailType =
    | 'order_confirmation'
    | 'production_started'
    | 'shipment'
    | 'pickup_confirmation'
    | 'pickup_ready'
    | 'payment_reminder'
    | 'shop_notification'
    | 'contact';

export interface MailTypeInfo {
    key: MailType;
    label: string;
    /** Standard-Überschrift (an {{message.title}} übergeben) */
    title: string;
    /** Standard-Einleitung (an {{message.intro}} übergeben) */
    intro: string;
    /** Standard-Hinweis (an {{message.note}} übergeben) */
    note: string;
}

export const MAIL_TYPES: MailTypeInfo[] = [
    {
        key: 'order_confirmation',
        label: 'Bestellbestätigung',
        title: 'Vielen Dank für Ihre Bestellung!',
        intro: 'Wir haben Ihre Bestellung erhalten und freuen uns, diese für Sie produzieren zu dürfen.',
        note: 'Ihre Rechnung finden Sie als PDF-Anhang an dieser E-Mail.'
    },
    {
        key: 'production_started',
        label: 'Produktionsstart',
        title: 'Ihre Bestellung ist in Bearbeitung',
        intro: 'Wir haben mit der Produktion Ihrer Bestellung begonnen.',
        note: 'Sobald Ihre Bestellung fertiggestellt ist, informieren wir Sie über den nächsten Schritt.'
    },
    {
        key: 'shipment',
        label: 'Versand',
        title: 'Ihre Bestellung ist auf dem Weg',
        intro: 'Ihre Bestellung wurde soeben versendet.',
        note: 'Sie finden die Sendungsnummer auch jederzeit in Ihrem Kundenkonto unter „Meine Bestellungen“.'
    },
    {
        key: 'pickup_confirmation',
        label: 'Abholung (Bestellung eingegangen)',
        title: 'Vielen Dank für Ihre Bestellung!',
        intro: 'Sie haben die Abholung gewählt. Wir bearbeiten Ihre Bestellung und melden uns, sobald sie abholbereit ist.',
        note: 'Sie erhalten von uns eine weitere E-Mail mit Abholcode und Fachnummer.'
    },
    {
        key: 'pickup_ready',
        label: 'Abholbereit',
        title: 'Ihre Bestellung ist abholbereit',
        intro: 'Ihre Bestellung ist fertig und wartet auf Sie.',
        note: 'Geben Sie den Abholcode am Terminal ein und öffnen Sie das zugehörige Fach.'
    },
    {
        key: 'payment_reminder',
        label: 'Zahlungserinnerung',
        title: 'Erinnerung an Ihre offene Zahlung',
        intro: 'Der Betrag für Ihre Bestellung ist bei uns noch nicht eingegangen.',
        note: 'Bitte überweisen Sie den offenen Betrag unter Angabe der Bestellnummer im Verwendungszweck.'
    },
    {
        key: 'shop_notification',
        label: 'Bestellung (Betreiber-Benachrichtigung)',
        title: 'Neue Bestellung eingegangen',
        intro: 'Über den Onlineshop ist eine neue Bestellung eingegangen.',
        note: 'Die Rechnung ist als PDF im Anhang.'
    },
    {
        key: 'contact',
        label: 'Kontaktanfrage',
        title: 'Neue Kontaktanfrage',
        intro: 'Über das Kontaktformular ist eine neue Nachricht eingegangen.',
        note: ''
    }
];

const MAIL_TYPE_MAP: Record<string, MailTypeInfo> = MAIL_TYPES.reduce((acc, mt) => {
    acc[mt.key] = mt;
    return acc;
}, {} as Record<string, MailTypeInfo>);

export const getMailTypeInfo = (mailType: string | undefined | null): MailTypeInfo =>
    MAIL_TYPE_MAP[String(mailType || '')] || MAIL_TYPE_MAP['order_confirmation'];

export const mailTypeLabel = (mailType: string | undefined | null): string => getMailTypeInfo(mailType).label;

// ============================================================
// Teilvorlagen (pro Shop) – Ablage in shops.custom_email_partials (JSON)
// ============================================================
export type MailPartialName = 'progress' | 'order_items' | 'order_totals' | 'message';

/** Dateiname im Design-ZIP -> Schlüssel in custom_email_partials */
export const MAIL_PARTIAL_FILES: Record<MailPartialName, string> = {
    progress: 'email-progress.html',
    order_items: 'email-order-items.html',
    order_totals: 'email-order-totals.html',
    message: 'email-message.html'
};

export const MAIL_PARTIAL_NAMES: MailPartialName[] = ['progress', 'order_items', 'order_totals', 'message'];

export const getShopEmailFrame = (shopId: string | null | undefined): string | null => {
    if (!shopId) return null;
    try {
        const row = db.prepare('SELECT custom_email_html FROM shops WHERE id = ?').get(shopId) as any;
        const frame = String(row?.custom_email_html || '').trim();
        return frame || null;
    } catch {
        return null;
    }
};

export const getShopEmailPartials = (shopId: string | null | undefined): Partial<Record<MailPartialName, string>> => {
    if (!shopId) return {};
    try {
        const row = db.prepare('SELECT custom_email_partials FROM shops WHERE id = ?').get(shopId) as any;
        const raw = row?.custom_email_partials;
        if (!raw) return {};
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const result: Partial<Record<MailPartialName, string>> = {};
        for (const name of MAIL_PARTIAL_NAMES) {
            const value = parsed?.[name];
            if (typeof value === 'string' && value.trim()) result[name] = value;
        }
        return result;
    } catch {
        return {};
    }
};

/** Prüft, ob eine Vorlage einen Platzhalter wie {{order_items_html}} verwendet. */
export const templateUsesPlaceholder = (template: string | null | undefined, key: string): boolean => {
    if (!template) return false;
    return new RegExp(`\\{\\{\\{?\\s*${key}\\s*\\}?\\}\\}`).test(template);
};

/** Alias für die bisherige Bezeichnung. */
export const shopEmailFrameUsesPlaceholder = (shopId: string | null | undefined, key: string): boolean =>
    templateUsesPlaceholder(getShopEmailFrame(shopId), key);

// ============================================================
// Rahmen (email.html) anwenden
// ============================================================
const extractBodyInner = (html: string): string => {
    const m = String(html || '').match(/<body[^>]*>([\s\S]*)<\/body>/i);
    return m ? m[1] : String(html || '');
};

// Fertiges Logo-Markup (Bild oder Shopname), damit die Vorlage kein eigenes Markup braucht.
export const buildLogoHtml = (vars: Record<string, any>): string => {
    const logoUrl = String(vars.logo_url || vars.email_logo_url || '').trim();
    const shopName = String(vars.shop_name || '');
    return logoUrl
        ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(shopName)}" style="max-height:64px; max-width:220px;">`
        : `<div style="font-size:20px; font-weight:800; color:#ffffff;">${escapeHtml(shopName)}</div>`;
};

export const applyShopEmailFrame = (
    shopId: string | null | undefined,
    vars: Record<string, string>,
    contentHtml: string
): string => {
    const frame = getShopEmailFrame(shopId);
    if (!frame) return contentHtml;
    const allVars: Record<string, any> = {
        ...vars,
        logo_html: buildLogoHtml(vars),
        content: extractBodyInner(contentHtml)
    };
    // Voller Renderer, damit auch {{#...}}/{{^...}} in der Rahmenvorlage korrekt
    // aufgelöst werden und Bestell-Platzhalter (in Kontakt-Mails) leer bleiben.
    return renderMailTemplate(frame, allVars, {
        assetBase: shopId ? `${getPublicBaseUrl()}/shop-assets/${shopId}/` : '',
        rawKeys: ['content', 'logo_html', 'order_items_html', 'order_totals_html', 'order_progress_html']
    });
};

// ============================================================
// Fortschrittslogik (Zahlung und Bearbeitung getrennt)
// ============================================================
export type ProgressState = 'done' | 'current' | 'pending';

export interface ProgressStep {
    label: string;
    state: ProgressState;
    done: boolean;
    current: boolean;
    pending: boolean;
    index: number;
    number: number;
    icon: string;
    state_label: string;
}

export interface ProgressData {
    is_pickup: boolean;
    is_cancelled: boolean;
    is_paid: boolean;
    is_payment_pending: boolean;
    status_label: string;
    payment_status_label: string;
    payment_state_label: string;
    steps: ProgressStep[];
}

const ORDER_STATUS_LABELS: Record<string, string> = {
    pending_payment: 'Zahlung ausstehend',
    active: 'In Bearbeitung',
    shipped: 'Versendet',
    cancelled: 'Storniert',
    storniert: 'Storniert',
    completed: 'Abgeschlossen'
};

export const buildProgressData = (order: any): ProgressData => {
    const status = String(order?.status || '').toLowerCase().trim();
    const paymentStatus = String(order?.payment_status || '').toLowerCase().trim();
    const isCancelled = status === 'cancelled' || status === 'storniert';
    const isPaid = paymentStatus === 'paid' || paymentStatus === 'completed' || paymentStatus === 'bezahlt';
    const isPickup = String(order?.shipping_method || 'dhl').toLowerCase().trim() === 'pickup';
    const pickupReady = String(order?.pickup_status || '').toLowerCase().trim() === 'ready';
    const shipped = status === 'shipped' || !!order?.shipped_at;
    const paymentPending = status === 'pending_payment';

    // Bearbeitung ist abgeschlossen, sobald versendet bzw. abholbereit.
    const productionDone = shipped || (isPickup && pickupReady);
    const productionCurrent = !productionDone && status === 'active';
    // versendet wird AUSSCHLIESSLICH über den Versandstatus/-zeitpunkt bestätigt
    const shipmentDone = !isPickup && shipped;
    const pickupDone = isPickup && pickupReady;

    const mk = (label: string, state: ProgressState, index: number): ProgressStep => ({
        label,
        state,
        done: state === 'done',
        current: state === 'current',
        pending: state === 'pending',
        index,
        number: index + 1,
        icon: state === 'done' ? '✓' : String(index + 1),
        state_label: state === 'done' ? 'erledigt' : (state === 'current' ? 'aktuell' : 'ausstehend')
    });

    const productionState: ProgressState = productionDone ? 'done' : (productionCurrent ? 'current' : 'pending');
    let endState: ProgressState;
    if (isPickup) {
        endState = pickupDone ? 'done' : 'pending';
    } else {
        endState = shipmentDone ? 'done' : 'pending';
    }

    const steps: ProgressStep[] = [
        mk('Bestellung eingegangen', 'done', 0),
        mk('In Bearbeitung', productionState, 1),
        mk(isPickup ? 'Abholbereit' : 'Versendet', endState, 2)
    ];

    const paymentStateLabel = isPaid ? 'Bezahlt' : 'Offen';
    return {
        is_pickup: isPickup,
        is_cancelled: isCancelled,
        is_paid: isPaid,
        is_payment_pending: paymentPending,
        status_label: ORDER_STATUS_LABELS[status] || (status ? status : ''),
        payment_status_label: paymentStateLabel,
        payment_state_label: paymentStateLabel,
        steps
    };
};

// ============================================================
// Datenkontext für die Teilvorlagen
// ============================================================
export interface MailDataInput {
    order: any;
    items: any[];
    mailType: MailType;
    vars: Record<string, any>;
}

const formatDate = (value: any): string => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('de-DE');
};

export const buildMailData = ({ order, items, mailType, vars }: MailDataInput): Record<string, any> => {
    const resolved = withResolvedItemImages(items, order?.shop_id);
    const progress = buildProgressData(order);
    const typeInfo = getMailTypeInfo(mailType);

    const list = resolved.map((it: any) => {
        const qty = Number(it.quantity) || 0;
        const price = Number(it.price) || 0;
        const variant = [
            it.size ? `Größe: ${it.size}` : '',
            it.color ? `Farbe: ${it.color}` : ''
        ].filter(Boolean).join(' · ');
        return {
            name: it.item_name || '',
            item_name: it.item_name || '',
            item_number: it.item_number || '',
            quantity: qty,
            price,
            price_formatted: formatEur(price),
            line_total: qty * price,
            line_total_formatted: formatEur(qty * price),
            size: it.size || '',
            color: it.color || '',
            variant,
            has_variant: !!variant,
            image: it.image || '',
            has_image: !!it.image,
            notes: it.notes || ''
        };
    });

    const itemsSubtotal = list.reduce((sum: number, it: any) => sum + it.line_total, 0);
    const shippingCosts = Number(order?.shipping_costs) || 0;
    const discountAmount = Number(order?.discount_amount) || 0;
    const totalAmount = Number(order?.total_amount) || 0;
    const trackingNumber = String(order?.tracking_number || '').trim();

    return {
        // Shop/Branding (aus vars)
        ...vars,
        // Mail-Meta
        mail_type: mailType,
        mail_label: typeInfo.label,
        year: vars.year || String(new Date().getFullYear()),
        // Kunde
        customer_name: order?.customer_name || '',
        customer_email: order?.customer_email || '',
        customer_address: order?.customer_address || '',
        customer_phone: order?.customer_phone || '',
        // Bestellung
        order_number: order?.order_number || order?.id || '',
        order_date: formatDate(order?.created_at),
        order_datetime: order?.created_at ? new Date(order.created_at).toLocaleString('de-DE') : '',
        status: String(order?.status || ''),
        status_label: progress.status_label,
        payment_method: order?.payment_method || order?.paymentMethod || '',
        payment_status: String(order?.payment_status || ''),
        payment_status_label: progress.payment_status_label,
        is_paid: progress.is_paid,
        is_payment_pending: progress.is_payment_pending,
        shipping_method: order?.shipping_method || '',
        is_pickup: progress.is_pickup,
        is_shipping: !progress.is_pickup,
        tracking_number: trackingNumber,
        tracking_url: trackingNumber
            ? `https://www.dhl.de/de/privatkunden/dhl-sendungsverfolgung.html?piececode=${encodeURIComponent(trackingNumber)}`
            : '',
        has_tracking: !!trackingNumber,
        pickup_code: order?.pickup_code || '',
        pickup_compartment: order?.pickup_compartment || '',
        is_pickup_ready: String(order?.pickup_status || '').toLowerCase() === 'ready',
        // Positionen
        items: list,
        item_count: list.length,
        // Summen
        items_subtotal: itemsSubtotal,
        items_subtotal_formatted: formatEur(itemsSubtotal),
        shipping_costs: shippingCosts,
        shipping_costs_formatted: formatEur(shippingCosts),
        discount_amount: discountAmount,
        discount_amount_formatted: formatEur(discountAmount),
        has_discount: discountAmount > 0,
        voucher_code: order?.voucher_code || '',
        total_amount: totalAmount,
        total_amount_formatted: formatEur(totalAmount),
        // Fortschritt
        progress,
        steps: progress.steps,
        // Nachricht (für email-message.html)
        message: {
            title: typeInfo.title,
            intro: typeInfo.intro,
            note: typeInfo.note,
            greeting: order?.customer_name || ''
        }
    };
};

// ============================================================
// Standard-Bausteine (Fallback, wenn keine Teilvorlage vorhanden ist)
// ============================================================
const sectionTitle = (text: string): string =>
    `<div style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; margin:16px 0 10px;">${escapeHtml(text)}</div>`;

export const buildOrderItemsHtml = (items: any[]): string => {
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
            ? `<img src="${escapeHtml(it.image)}" alt="${escapeHtml(it.item_name || it.name || '')}" width="48" height="48" style="width:48px; height:48px; object-fit:cover; border-radius:6px; border:1px solid #e2e8f0; display:block;">`
            : `<div style="width:48px; height:48px; border-radius:6px; border:1px solid #e2e8f0; background:#f1f5f9;"></div>`;
        return `<tr>
            <td style="padding:8px; border-bottom:1px solid #eee; word-break:break-word;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>
                <td style="vertical-align:top; padding-right:10px;">${imageCell}</td>
                <td style="vertical-align:top;">
                  <div style="font-weight:700; color:#0f172a; word-break:break-word;">${escapeHtml(it.item_name || it.name || '')}</div>
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

export const buildOrderTotalsHtml = (order: any, items: any[]): string => {
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

// Fortschrittsanzeige (E-Mail-kompatibel: Tabellenlayout + Inline-CSS).
// Die Zustände sind nicht nur über Farbe unterscheidbar: erledigte Schritte
// tragen ein Häkchen, aktuelle/zukünftige ihre Nummer, dazu jeweils ein
// ausgeschriebener Zustand (erledigt/aktuell/ausstehend) und unterschiedliche
// Schriftschnitte. Zahlungs- und Bearbeitungsstatus werden getrennt behandelt.
export const buildOrderProgressHtml = (order: any): string => {
    if (!order) return '';
    const data = buildProgressData(order);

    if (data.is_cancelled) {
        return `<div style="border:1px solid #fecaca; border-radius:10px; padding:16px; margin:16px 0; background:#fef2f2;">
            <div style="font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#b91c1c; margin-bottom:6px;">Bestellstatus</div>
            <div style="font-size:14px; font-weight:700; color:#b91c1c;">Diese Bestellung wurde storniert.</div>
        </div>`;
    }

    const DONE = '#16a34a';
    const ACTIVE = '#0f172a';
    const TODO = '#e2e8f0';
    const TODO_FG = '#94a3b8';

    const line = (color: string) =>
        `<div style="height:2px; line-height:2px; font-size:0; background:${color};">&nbsp;</div>`;

    const last = data.steps.length - 1;
    const cells = data.steps.map((step, i) => {
        const bg = step.done ? DONE : (step.current ? ACTIVE : TODO);
        const fg = step.done || step.current ? '#ffffff' : TODO_FG;
        const circle = `<div style="width:28px; height:28px; border-radius:14px; background:${bg}; color:${fg}; font-size:13px; font-weight:800; line-height:28px; text-align:center; margin:0 auto;">${step.icon}</div>`;
        const leftLine = i === 0 ? '' : line(step.done ? DONE : TODO);
        const rightLine = i === last ? '' : line(data.steps[i + 1].done ? DONE : TODO);
        const labelColor = step.pending ? '#94a3b8' : '#0f172a';
        const labelWeight = step.current ? 800 : (step.done ? 700 : 500);
        const stateColor = step.done ? '#16a34a' : (step.current ? '#0f172a' : '#94a3b8');
        const width = i === last ? '34%' : '33%';
        return `<td width="${width}" valign="top" align="center" style="padding:0 2px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td width="50%" height="28" valign="middle" style="height:28px; vertical-align:middle; font-size:0; line-height:0;">${leftLine}</td>
                <td width="28" valign="middle" align="center" style="width:28px; vertical-align:middle; font-size:0;">${circle}</td>
                <td width="50%" height="28" valign="middle" style="height:28px; vertical-align:middle; font-size:0; line-height:0;">${rightLine}</td>
              </tr>
            </table>
            <div style="font-size:12px; line-height:1.35; margin-top:8px; font-weight:${labelWeight}; color:${labelColor};">${escapeHtml(step.label)}</div>
            <div style="font-size:10px; line-height:1.3; margin-top:2px; text-transform:uppercase; letter-spacing:0.06em; color:${stateColor};">${escapeHtml(step.state_label)}</div>
        </td>`;
    }).join('');

    const paymentLine = `<div style="margin-top:14px; padding-top:12px; border-top:1px solid #e2e8f0; font-size:13px; color:#475569;">
        Zahlung: <span style="font-weight:700; color:${data.is_paid ? '#16a34a' : '#d97706'};">${data.is_paid ? 'Bezahlt' : 'Offen'}</span>
      </div>`;

    return `<div style="border:1px solid #e2e8f0; border-radius:10px; padding:16px; margin:16px 0; background:#ffffff;">
        <div style="font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#94a3b8; margin-bottom:14px;">Bestellstatus</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>${cells}</tr>
        </table>
        ${paymentLine}
      </div>`;
};

// ============================================================
// Orchestrierung: fertige Bestell-Mail (Rahmen + Teilvorlagen)
// ============================================================
export interface ComposeOrderMailParams {
    shopId: string | null | undefined;
    order: any;
    items: any[];
    mailType: MailType;
    /** Basis-Platzhalter (shop_name, subject, year, logo_url, ...) */
    vars: Record<string, string>;
    /** Standard-Nachrichteninhalt (ohne Rahmen), falls keine email-message.html existiert */
    defaultMessageHtml: string;
    /** Welche Bereiche im Standard-Inhalt zusätzlich einsetzen (nur falls nicht über Vorlage/Frahm genutzt) */
    sections?: Array<{ key: 'items' | 'totals' | 'progress'; label?: string }>;
    /** Baut den vollständigen Standardrahmen (nur nötig, wenn keine email.html existiert). */
    buildStandard: (contentHtml: string) => string;
}

export interface ComposeOrderMailResult {
    html: string;
    hasFrame: boolean;
    messageHtml: string;
    orderItemsHtml: string;
    orderTotalsHtml: string;
    orderProgressHtml: string;
    data: Record<string, any>;
}

export const composeOrderMail = (params: ComposeOrderMailParams): ComposeOrderMailResult => {
    const { shopId, order, items, mailType, vars, defaultMessageHtml, sections = [], buildStandard } = params;
    const assetBase = shopId ? `${getPublicBaseUrl()}/shop-assets/${shopId}/` : '';
    const renderOpts: RenderMailOptions = {
        assetBase,
        rawKeys: ['order_items_html', 'order_totals_html', 'order_progress_html', 'logo_html', 'content']
    };

    const data = buildMailData({ order, items, mailType, vars });
    const partials = getShopEmailPartials(shopId);
    const frame = getShopEmailFrame(shopId);

    const orderItemsHtml = partials.order_items
        ? renderMailTemplate(partials.order_items, data, renderOpts)
        : buildOrderItemsHtml(data.items as any[]);
    const orderTotalsHtml = partials.order_totals
        ? renderMailTemplate(partials.order_totals, data, renderOpts)
        : buildOrderTotalsHtml(order, data.items as any[]);
    const orderProgressHtml = partials.progress
        ? renderMailTemplate(partials.progress, data, renderOpts)
        : buildOrderProgressHtml(order);

    const blocks = { order_items_html: orderItemsHtml, order_totals_html: orderTotalsHtml, order_progress_html: orderProgressHtml };
    const messageHtml = partials.message
        ? renderMailTemplate(partials.message, { ...data, ...blocks }, renderOpts)
        : defaultMessageHtml;

    // Bereiche nur ergänzen, wenn sie nicht bereits über Rahmen oder Nachrichtenvorlage ausgegeben werden.
    const sectionContent: Record<string, string> = {
        items: orderItemsHtml,
        totals: orderTotalsHtml,
        progress: orderProgressHtml
    };
    let content = messageHtml;
    for (const section of sections) {
        const block = sectionContent[section.key];
        if (!block) continue;
        const key = section.key === 'items' ? 'order_items_html' : (section.key === 'totals' ? 'order_totals_html' : 'order_progress_html');
        if (templateUsesPlaceholder(frame, key) || templateUsesPlaceholder(partials.message, key)) continue;
        if (section.key !== 'totals' && section.label) content += sectionTitle(section.label);
        content += block;
    }

    if (frame) {
        // Eigene email.html ist der vollständige Mailrahmen. In {{content}} landet
        // ausschließlich der Nachrichteninhalt (inkl. der nicht über Vorlagen
        // abgedeckten Bereiche). So entsteht kein doppelter Rahmen/Logo/Footer.
        const frameCtx: Record<string, any> = {
            ...data,
            ...blocks,
            content,
            logo_html: buildLogoHtml(vars)
        };
        const html = renderMailTemplate(frame, frameCtx, renderOpts);
        return { html, hasFrame: true, messageHtml, orderItemsHtml, orderTotalsHtml, orderProgressHtml, data };
    }

    return {
        html: buildStandard(content),
        hasFrame: false,
        messageHtml,
        orderItemsHtml,
        orderTotalsHtml,
        orderProgressHtml,
        data
    };
};
