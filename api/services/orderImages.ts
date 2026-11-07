import db from '../db.js';

// ============================================
// Bildauflösung für Bestellpositionen
// ============================================
// Wird identisch für Bestelldetails (API) und Kunden-/Betreibermails genutzt.
// Gespeicherte Bildadressen (order_items.image) sind oft relative Pfade
// (z. B. "/uploads/foo.png"). Für Mails sind absolute, öffentlich erreichbare
// HTTPS-URLs nötig. Für ältere Positionen ohne Bild wird ein Fallback über
// Produkt + Variante aufgelöst.

// Öffentliche Basis-URL des Servers, unter der /uploads erreichbar ist.
export const getPublicBaseUrl = (): string => {
  const raw = (
    process.env.PUBLIC_BASE_URL ||
    process.env.APP_URL ||
    process.env.RAILWAY_PUBLIC_DOMAIN ||
    ''
  ).trim();
  if (raw) {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return withProto.replace(/\/+$/, '');
  }
  return 'https://manager.main-textildruck.com';
};

// Wandelt einen relativen Pfad in eine absolute HTTPS-URL um (absolute URLs bleiben unverändert).
export const toAbsoluteImageUrl = (value?: string | null, baseUrl: string = getPublicBaseUrl()): string | null => {
  const url = String(value ?? '').trim();
  if (!url) return null;
  if (/^(https?:|data:|cid:)/i.test(url)) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

interface OrderItemImageInput {
  image?: string | null;
  item_number?: string | null;
  item_name?: string | null;
  size?: string | null;
  color?: string | null;
}

const parseList = (value: any): string[] => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    return [];
  }
};

// Fallback: passendes Produktbild über Produkt + Variante ermitteln.
const findFallbackImagePath = (item: OrderItemImageInput, shopId: string | null | undefined): string | null => {
  if (!shopId) return null;
  try {
    // Produkt im Shop über Artikelnummer (bevorzugt) oder Namen finden.
    let product: any = null;
    if (item.item_number) {
      product = db.prepare(`
        SELECT spa.id as assignment_id, spa.product_id
        FROM shop_product_assignments spa
        JOIN customer_products cp ON cp.id = spa.product_id
        WHERE spa.shop_id = ? AND cp.product_number = ?
        ORDER BY spa.sort_order ASC
        LIMIT 1
      `).get(shopId, item.item_number) as any;
    }
    if (!product && item.item_name) {
      product = db.prepare(`
        SELECT spa.id as assignment_id, spa.product_id
        FROM shop_product_assignments spa
        JOIN customer_products cp ON cp.id = spa.product_id
        WHERE spa.shop_id = ? AND cp.name = ?
        ORDER BY spa.sort_order ASC
        LIMIT 1
      `).get(shopId, item.item_name) as any;
    }
    if (!product) return null;

    // Bilder des Produkts: bevorzugt Shop-Bilder, sonst Kunden-Produktdateien.
    const shopImages = db.prepare(`
      SELECT cpf.file_url, spi.size_restrictions, spi.sort_order
      FROM shop_product_images spi
      JOIN customer_product_files cpf ON cpf.id = spi.customer_product_file_id
      WHERE spi.shop_product_assignment_id = ?
      ORDER BY spi.sort_order ASC, spi.created_at ASC
    `).all(product.assignment_id) as any[];

    const candidates = shopImages.length > 0
      ? shopImages
      : db.prepare('SELECT file_url FROM customer_product_files WHERE product_id = ? ORDER BY created_at DESC').all(product.product_id) as any[];
    if (!candidates.length) return null;

    // Variante: Bild, dessen Größen-Restriktion die Bestellgröße enthält.
    if (item.size) {
      const sizeMatch = candidates.find((c: any) => parseList(c.size_restrictions).includes(String(item.size)));
      if (sizeMatch) return sizeMatch.file_url;
    }
    // Sonst erstes Bild ohne Größen-Restriktion, ansonsten das erste Bild.
    const unrestricted = candidates.find((c: any) => parseList(c.size_restrictions).length === 0);
    return (unrestricted || candidates[0]).file_url || null;
  } catch {
    return null;
  }
};

// Liefert eine absolute Bild-URL für eine Bestellposition (gespeichert oder Fallback).
export const resolveOrderItemImageUrl = (item: OrderItemImageInput, shopId: string | null | undefined): string | null => {
  const base = getPublicBaseUrl();
  const stored = toAbsoluteImageUrl(item?.image, base);
  if (stored) return stored;
  return toAbsoluteImageUrl(findFallbackImagePath(item, shopId), base);
};

// Reichert Bestellpositionen mit einer absoluten image-URL an.
export const withResolvedItemImages = <T extends OrderItemImageInput>(
  items: T[],
  shopId: string | null | undefined
): (T & { image: string | null })[] =>
  (Array.isArray(items) ? items : []).map((it) => ({ ...it, image: resolveOrderItemImageUrl(it, shopId) }));
