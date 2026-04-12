import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import { toAbsoluteMediaUrl } from '../mediaUrl';

interface ProductTileProps {
    product: any;
    shopId: string;
    shopBaseUrl: string;
}

type ColorMap = Record<string, string>;
const colorMapCacheByShop: Record<string, ColorMap> = {};
const colorMapPromiseByShop: Record<string, Promise<ColorMap> | null> = {};
const colorVarIdsCacheByShop: Record<string, Set<string>> = {};
const colorVarIdsPromiseByShop: Record<string, Promise<Set<string>> | null> = {};

const normalizeColorKey = (value: string) => value.trim().toLowerCase();

const getColorMapForShop = async (shopId: string): Promise<ColorMap> => {
    if (colorMapCacheByShop[shopId]) return colorMapCacheByShop[shopId];
    if (colorMapPromiseByShop[shopId]) return colorMapPromiseByShop[shopId] as Promise<ColorMap>;

    colorMapPromiseByShop[shopId] = (async () => {
        try {
            const res = await fetch(`/api/variables/shop/${shopId}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
            });
            const data = await res.json();
            const rows = data?.success && Array.isArray(data.data) ? data.data : [];
            const map: ColorMap = {};
            const colorVarIds = new Set<string>();
            for (const v of rows) {
                if (v?.type !== 'color') continue;
                if (v?.id) colorVarIds.add(String(v.id));
                const colors = v?.variable_colors && typeof v.variable_colors === 'object' ? v.variable_colors : {};
                for (const [name, hex] of Object.entries(colors)) {
                    if (typeof name !== 'string' || typeof hex !== 'string') continue;
                    const normalized = normalizeColorKey(name);
                    const trimmed = hex.trim();
                    if (!normalized) continue;
                    if (!/^#([0-9a-fA-F]{6})$/.test(trimmed)) continue;
                    map[normalized] = trimmed;
                }
            }
            colorMapCacheByShop[shopId] = map;
            colorVarIdsCacheByShop[shopId] = colorVarIds;
            return map;
        } catch {
            colorMapCacheByShop[shopId] = {};
            colorVarIdsCacheByShop[shopId] = new Set<string>();
            return {};
        } finally {
            colorMapPromiseByShop[shopId] = null;
        }
    })();

    return colorMapPromiseByShop[shopId] as Promise<ColorMap>;
};

const getColorVarIdsForShop = async (shopId: string): Promise<Set<string>> => {
    if (colorVarIdsCacheByShop[shopId]) return colorVarIdsCacheByShop[shopId];
    if (colorVarIdsPromiseByShop[shopId]) return colorVarIdsPromiseByShop[shopId] as Promise<Set<string>>;
    colorVarIdsPromiseByShop[shopId] = (async () => {
        await getColorMapForShop(shopId);
        return colorVarIdsCacheByShop[shopId] || new Set<string>();
    })().finally(() => {
        colorVarIdsPromiseByShop[shopId] = null;
    });
    return colorVarIdsPromiseByShop[shopId] as Promise<Set<string>>;
};

export const ProductTile: React.FC<ProductTileProps> = ({ product, shopId, shopBaseUrl }) => {
    
    // Parse variants if available
    let sizes: string[] = [];
    let displayPrice = product.price > 0 ? product.price : 29.95;
    let showFrom = false;

    const [colorMap, setColorMap] = useState<ColorMap | null>(colorMapCacheByShop[shopId] || null);
    const [colorVarIds, setColorVarIds] = useState<Set<string> | null>(colorVarIdsCacheByShop[shopId] || null);
    useEffect(() => {
        if (colorMap) return;
        if (!shopId) return;
        getColorMapForShop(shopId).then(setColorMap);
    }, [colorMap, shopId]);
    useEffect(() => {
        if (colorVarIds) return;
        if (!shopId) return;
        getColorVarIdsForShop(shopId).then(setColorVarIds);
    }, [colorVarIds, shopId]);

    const availableColors = useMemo(() => {
        const collect = (raw: any) => {
            const out: string[] = [];
            if (!raw) return out;
            if (Array.isArray(raw)) return raw.map(String);
            if (typeof raw === 'string') return raw.split(',').map(s => s.trim()).filter(Boolean);
            return out;
        };

        const values: string[] = [];
        try {
            if (product?.variants) {
                const variants = typeof product.variants === 'string' ? JSON.parse(product.variants) : product.variants;
                const entries = Object.entries(variants || {}) as [string, any][];
                for (const [varId, v] of entries) {
                    const isColor = !!colorVarIds && colorVarIds.has(String(varId));
                    if (isColor) {
                        values.push(...collect(v?.values));
                        continue;
                    }
                    const name = typeof v?.name === 'string' ? v.name.toLowerCase() : '';
                    if (!name) continue;
                    if (name.includes('farbe') || name.includes('color')) values.push(...collect(v?.values));
                }
            }
        } catch {}

        if (values.length === 0 && typeof product?.color === 'string' && product.color.trim()) {
            values.push(...collect(product.color));
        }

        const seen = new Set<string>();
        const unique: string[] = [];
        for (const c of values) {
            const key = normalizeColorKey(c);
            if (!key) continue;
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(c.trim());
        }
        return unique;
    }, [product, colorVarIds]);

    const colorsWithHex = useMemo(() => {
        const map = colorMap || {};
        return availableColors.map(name => ({ name, hex: map[normalizeColorKey(name)] }));
    }, [availableColors, colorMap]);
    const hasAnyHex = colorsWithHex.some(c => !!c.hex);
    const visibleColors = hasAnyHex ? colorsWithHex.slice(0, 6) : availableColors.slice(0, 6);

    try {
        if (product.variants) {
            const variants = typeof product.variants === 'string' ? JSON.parse(product.variants) : product.variants;
            const variantValues = Object.values(variants) as any[];
            
            // 1. Find sizes
            // Try to find explicit 'size' type first (if we had access to variable types, but we don't here easily without fetching)
            // So we guess by name or fallback to standard logic
            const sizeVar = variantValues.find((v: any) => v.name && (v.name.toLowerCase().includes('größe') || v.name.toLowerCase().includes('size')));
            if (sizeVar && sizeVar.values) {
                // Handle comma separated string or array
                sizes = Array.isArray(sizeVar.values) ? sizeVar.values : sizeVar.values.split(',').map((s: string) => s.trim());
            }

            // 2. Calculate Min Price
            if (variantValues.length > 0) {
                let minPrice = Infinity;
                let foundVariantPrice = false;

                variantValues.forEach(v => {
                    if (v.price && v.price > 0) {
                        foundVariantPrice = true;
                        if (v.price < minPrice) minPrice = v.price;
                    }
                });

                if (foundVariantPrice && minPrice < Infinity) {
                    displayPrice = minPrice;
                    showFrom = true;
                } else if (variantValues.length > 0) {
                    // If variants exist but have same price as base (or 0 meaning base), 
                    // we might still want "Ab" if there are multiple options? 
                    // Usually "Ab" implies price difference. 
                    // But user said "bis zur auswahl ab schreiben" -> write "ab" until selection.
                    // If simply having variants implies "Ab" (like "Ab 29.95" because maybe XXL is more expensive?),
                    // let's follow the logic: if variants exist, show "Ab".
                    showFrom = true;
                }
            }
        }
    } catch (e) {
        console.error('Error parsing variants', e);
    }
    
    // TODO: Connect this to backend "is_new" field later
    // For now we assume if product.is_new is true, or we could add a field in shop_products table
    const isNew = product.is_featured === 1 || product.is_featured === true || product.is_new === true;
    const tileThumbUrl = toAbsoluteMediaUrl(product?.files?.[0]?.thumbnail_url);
    const tileFileUrl = toAbsoluteMediaUrl(product?.files?.[0]?.file_url);
    const tileSrc = tileFileUrl || tileThumbUrl || '';
    const tileSrcSet = tileThumbUrl && tileFileUrl ? `${tileThumbUrl} 300w, ${tileFileUrl} 1200w` : undefined;

    return (
        <div className="group block relative bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-slate-100">
            <Link to={`${shopBaseUrl}/product/${product.product_id}`} className="block h-full flex flex-col">
                <div className="relative aspect-[3/4] bg-white overflow-hidden">
                    {product.files && product.files.length > 0 && (product.files[0].thumbnail_url || product.files[0].file_url) ? (
                        <>
                            <img 
                                src={tileSrc}
                                srcSet={tileSrcSet}
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                alt={product.name}
                                className="w-full h-full object-contain object-center p-4 group-hover:scale-105 transition-transform duration-700"
                                loading="lazy"
                                decoding="async"
                            />
                            {/* Overlay gradient on hover */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-100">
                            <span className="text-sm font-bold opacity-30 uppercase tracking-widest">Kein Bild</span>
                        </div>
                    )}
                    
                    {/* Badge "NEU" - Only show if isNew is true */}
                    {isNew && (
                        <div className="absolute top-3 left-3 bg-red-600 text-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded shadow-md z-10">
                            Neu
                        </div>
                    )}
                    
                    {/* Hover Action Button */}
                    <div className="absolute bottom-4 right-4 translate-y-12 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 z-10">
                         <div className="bg-white text-slate-900 w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:bg-slate-900 hover:text-white transition-colors">
                             <ArrowRight size={18} />
                         </div>
                    </div>
                </div>
                
                <div className="p-5 flex-grow flex flex-col">
                    <div className="mb-1">
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">{product.product_number}</p>
                        <h3 className="font-bold text-base leading-snug text-slate-800 group-hover:text-red-600 transition-colors line-clamp-2 min-h-[2.5rem]">
                            {product.name}
                        </h3>
                        {availableColors.length > 0 && (
                            <div className="mt-2">
                                {hasAnyHex ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                        {visibleColors.map((c: any) => (
                                            c.hex ? (
                                                <span
                                                    key={c.name}
                                                    title={c.name}
                                                    className="w-3 h-3 rounded-full border border-slate-200"
                                                    style={{ backgroundColor: c.hex }}
                                                />
                                            ) : (
                                                <span key={c.name} className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                                                    {c.name}
                                                </span>
                                            )
                                        ))}
                                        {availableColors.length > 6 && (
                                            <span className="text-[10px] font-bold text-slate-400">+{availableColors.length - 6}</span>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-500 font-medium line-clamp-1">
                                        Farben: {availableColors.join(', ')}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                    
                    <div className="mt-auto pt-3 flex items-center justify-between border-t border-slate-50">
                        <span className="font-extrabold text-lg text-slate-900">
                            {showFrom && <span className="text-xs font-normal text-slate-500 mr-1">Ab</span>}
                            € {displayPrice.toFixed(2)}
                        </span>
                        <span className="text-xs font-bold text-red-600 uppercase opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300">
                            Zum Produkt
                        </span>
                    </div>
                </div>
            </Link>
        </div>
    );
};
