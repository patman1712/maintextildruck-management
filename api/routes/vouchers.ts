import { Router } from 'express';
import db from '../db.js';
import { normalizeVoucherCode, createVoucherId, serializeVoucher } from '../services/vouchers.js';

const router = Router();

// 🔐 Gutscheine dürfen NUR Administratoren verwalten.
// Analog zu shop_management: kein x-user-id Header = internes Admin-Frontend.
function requireAdmin(req: any, res: any): boolean {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return true;
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;
    if (!user || user.role !== 'admin') {
        res.status(403).json({ success: false, error: 'Nur Administratoren dürfen Gutscheincodes verwalten.' });
        return false;
    }
    return true;
}

type VoucherInput = {
    shopId: string;
    code: string;
    discountType: 'percent' | 'fixed';
    discountValue: number;
    active: boolean;
    validUntil: string | null;
    minOrderValue: number | null;
    oncePerCustomer: boolean;
};

// Validiert die Eingaben. Gibt bei Fehlern eine Meldung zurück, sonst die normalisierten Werte.
function parseVoucherInput(body: any): { error: string } | { value: VoucherInput } {
    const shopId = String(body?.shopId || '').trim();
    if (!shopId) return { error: 'Bitte einen Shop auswählen.' };
    const shop = db.prepare('SELECT id FROM shops WHERE id = ?').get(shopId) as any;
    if (!shop) return { error: 'Shop nicht gefunden.' };

    const code = normalizeVoucherCode(body?.code);
    if (!code) return { error: 'Bitte einen Gutscheincode angeben.' };
    if (code.length > 40) return { error: 'Der Gutscheincode darf maximal 40 Zeichen lang sein.' };

    const discountType: 'percent' | 'fixed' = body?.discountType === 'fixed' ? 'fixed' : 'percent';
    const discountValue = Number(body?.discountValue);
    if (!isFinite(discountValue) || discountValue <= 0) {
        return { error: 'Bitte einen Rabattwert größer 0 angeben.' };
    }
    if (discountType === 'percent' && discountValue > 100) {
        return { error: 'Ein prozentualer Rabatt darf maximal 100 % betragen.' };
    }

    let validUntil: string | null = null;
    if (body?.validUntil) {
        const parsed = new Date(String(body.validUntil));
        if (isNaN(parsed.getTime())) return { error: 'Das Gültigkeitsdatum ist ungültig.' };
        validUntil = parsed.toISOString().slice(0, 10);
    }

    let minOrderValue: number | null = null;
    if (body?.minOrderValue !== undefined && body?.minOrderValue !== null && String(body.minOrderValue).trim() !== '') {
        const min = Number(body.minOrderValue);
        if (!isFinite(min) || min < 0) return { error: 'Der Mindestbestellwert muss eine Zahl ≥ 0 sein.' };
        minOrderValue = min > 0 ? min : null;
    }

    return {
        value: {
            shopId,
            code,
            discountType,
            discountValue,
            active: body?.active === undefined ? true : !!body.active,
            validUntil,
            minOrderValue,
            oncePerCustomer: !!body?.oncePerCustomer,
        },
    };
}

const isUniqueViolation = (e: any): boolean =>
    /UNIQUE|constraint/i.test(String(e?.message || ''));

// Alle Gutscheine (optional auf einen Shop gefiltert)
router.get('/', (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const shopId = String(req.query.shopId || '').trim();
        const base = 'SELECT v.*, s.name AS shop_name FROM shop_vouchers v LEFT JOIN shops s ON s.id = v.shop_id';
        const rows = shopId
            ? db.prepare(`${base} WHERE v.shop_id = ? ORDER BY v.created_at DESC`).all(shopId)
            : db.prepare(`${base} ORDER BY v.created_at DESC`).all();
        res.json({ success: true, data: (rows as any[]).map(serializeVoucher) });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Neuen Gutschein anlegen
router.post('/', (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const parsed = parseVoucherInput(req.body);
        if ('error' in parsed) return res.status(400).json({ success: false, error: parsed.error });
        const v = parsed.value;

        const id = createVoucherId();
        db.prepare(`
            INSERT INTO shop_vouchers
                (id, shop_id, code, discount_type, discount_value, active, valid_until, min_order_value, once_per_customer)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, v.shopId, v.code, v.discountType, v.discountValue,
            v.active ? 1 : 0, v.validUntil, v.minOrderValue, v.oncePerCustomer ? 1 : 0
        );

        const row = db.prepare('SELECT v.*, s.name AS shop_name FROM shop_vouchers v LEFT JOIN shops s ON s.id = v.shop_id WHERE v.id = ?').get(id);
        res.json({ success: true, data: serializeVoucher(row) });
    } catch (e: any) {
        if (isUniqueViolation(e)) {
            return res.status(400).json({ success: false, error: 'Diesen Gutscheincode gibt es für diesen Shop bereits.' });
        }
        res.status(500).json({ success: false, error: e.message });
    }
});

// Gutschein bearbeiten
router.put('/:id', (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const existing = db.prepare('SELECT * FROM shop_vouchers WHERE id = ?').get(req.params.id) as any;
        if (!existing) return res.status(404).json({ success: false, error: 'Gutschein nicht gefunden.' });

        const parsed = parseVoucherInput({ ...req.body, shopId: req.body?.shopId || existing.shop_id });
        if ('error' in parsed) return res.status(400).json({ success: false, error: parsed.error });
        const v = parsed.value;

        db.prepare(`
            UPDATE shop_vouchers
            SET shop_id = ?, code = ?, discount_type = ?, discount_value = ?,
                active = ?, valid_until = ?, min_order_value = ?, once_per_customer = ?
            WHERE id = ?
        `).run(
            v.shopId, v.code, v.discountType, v.discountValue,
            v.active ? 1 : 0, v.validUntil, v.minOrderValue, v.oncePerCustomer ? 1 : 0,
            req.params.id
        );

        const row = db.prepare('SELECT v.*, s.name AS shop_name FROM shop_vouchers v LEFT JOIN shops s ON s.id = v.shop_id WHERE v.id = ?').get(req.params.id);
        res.json({ success: true, data: serializeVoucher(row) });
    } catch (e: any) {
        if (isUniqueViolation(e)) {
            return res.status(400).json({ success: false, error: 'Diesen Gutscheincode gibt es für diesen Shop bereits.' });
        }
        res.status(500).json({ success: false, error: e.message });
    }
});

// Gutschein löschen
router.delete('/:id', (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const result = db.prepare('DELETE FROM shop_vouchers WHERE id = ?').run(req.params.id);
        if (!result.changes) return res.status(404).json({ success: false, error: 'Gutschein nicht gefunden.' });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
