import crypto from 'crypto';
import db from '../db.js';

// 🎟️ Gutschein-Codes (pro Shop) – zentrale Prüf- und Rabattlogik.
// Wird sowohl von der öffentlichen Shop-API als auch von der Bestellanlage genutzt,
// damit im Frontend und im Backend identisch gerechnet wird.

export type VoucherRow = {
    id: string;
    shop_id: string;
    code: string;
    discount_type: string;
    discount_value: number;
    active: number;
    valid_until: string | null;
    min_order_value: number | null;
    once_per_customer: number;
    created_at?: string;
};

export const normalizeVoucherCode = (code: unknown): string =>
    String(code ?? '').trim().toUpperCase().replace(/\s+/g, '');

export const createVoucherId = (): string => crypto.randomUUID();

// Rabatt bezieht sich IMMER nur auf den Warenwert (nicht auf Versandkosten)
// und kann den Warenwert nie überschreiten.
export const computeVoucherDiscount = (voucher: VoucherRow, subtotal: number): number => {
    const value = Number(voucher.discount_value || 0);
    const base = Math.max(0, Number(subtotal) || 0);
    if (!isFinite(value) || value <= 0 || base <= 0) return 0;
    const raw = voucher.discount_type === 'fixed' ? value : (base * value) / 100;
    return Math.round(Math.min(raw, base) * 100) / 100;
};

export type VoucherCheckResult = {
    ok: boolean;
    error?: string;
    voucher?: VoucherRow;
    discount?: number;
};

export const validateVoucherForShop = (params: {
    shopId: string;
    code: string;
    subtotal: number;
    customerEmail?: string | null;
    customerId?: string | null;
}): VoucherCheckResult => {
    const code = normalizeVoucherCode(params.code);
    if (!code) return { ok: false, error: 'Bitte gib einen Gutscheincode ein.' };

    const shop = db.prepare('SELECT vouchers_enabled FROM shops WHERE id = ?').get(params.shopId) as any;
    if (!shop) return { ok: false, error: 'Shop nicht gefunden.' };
    if (!shop.vouchers_enabled) return { ok: false, error: 'Gutscheincodes sind in diesem Shop nicht verfügbar.' };

    const voucher = db.prepare('SELECT * FROM shop_vouchers WHERE shop_id = ? AND code = ?').get(params.shopId, code) as VoucherRow | undefined;
    if (!voucher) return { ok: false, error: 'Dieser Gutscheincode ist ungültig.' };
    if (!voucher.active) return { ok: false, error: 'Dieser Gutscheincode ist nicht mehr aktiv.' };

    if (voucher.valid_until) {
        const expiry = new Date(voucher.valid_until);
        if (!isNaN(expiry.getTime())) {
            expiry.setHours(23, 59, 59, 999); // gültig bis Ende des angegebenen Tages
            if (Date.now() > expiry.getTime()) {
                return { ok: false, error: 'Dieser Gutscheincode ist abgelaufen.' };
            }
        }
    }

    const minOrder = Number(voucher.min_order_value || 0);
    if (minOrder > 0 && (Number(params.subtotal) || 0) < minOrder) {
        return { ok: false, error: `Dieser Code gilt erst ab ${minOrder.toFixed(2).replace('.', ',')} € Warenwert.` };
    }

    if (voucher.once_per_customer) {
        const email = String(params.customerEmail || '').trim().toLowerCase();
        const customerId = String(params.customerId || '').trim();
        if (!email && !customerId) {
            return { ok: false, error: 'Dieser Code ist nur einmal pro Kunde einlösbar. Bitte melde dich an.' };
        }
        let alreadyUsed = 0;
        try {
            if (customerId) {
                const row = db.prepare(
                    'SELECT COUNT(*) AS c FROM orders WHERE shop_id = ? AND voucher_code = ? AND shop_customer_id = ? AND deleted_at IS NULL'
                ).get(params.shopId, code, customerId) as any;
                alreadyUsed = Number(row?.c || 0);
            }
            if (!alreadyUsed && email) {
                const row = db.prepare(
                    'SELECT COUNT(*) AS c FROM orders WHERE shop_id = ? AND voucher_code = ? AND LOWER(customer_email) = ? AND deleted_at IS NULL'
                ).get(params.shopId, code, email) as any;
                alreadyUsed = Number(row?.c || 0);
            }
        } catch {
            alreadyUsed = 0;
        }
        if (alreadyUsed > 0) {
            return { ok: false, error: 'Dieser Gutscheincode wurde für dich bereits eingelöst.' };
        }
    }

    const discount = computeVoucherDiscount(voucher, params.subtotal);
    if (discount <= 0) return { ok: false, error: 'Dieser Gutscheincode ergibt keinen Rabatt.' };

    return { ok: true, voucher, discount };
};

export const serializeVoucher = (row: any) => ({
    id: row.id,
    shop_id: row.shop_id,
    shop_name: row.shop_name ?? undefined,
    code: row.code,
    discount_type: row.discount_type === 'fixed' ? 'fixed' : 'percent',
    discount_value: Number(row.discount_value || 0),
    active: !!row.active,
    valid_until: row.valid_until || '',
    min_order_value: row.min_order_value === null || row.min_order_value === undefined ? null : Number(row.min_order_value),
    once_per_customer: !!row.once_per_customer,
    created_at: row.created_at,
});
