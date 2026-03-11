import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, ArrowRight } from 'lucide-react';

interface ProductTileProps {
    product: any;
    shopId: string | undefined;
}

export const ProductTile: React.FC<ProductTileProps> = ({ product, shopId }) => {
    
    // Parse variants if available
    let sizes: string[] = [];
    let displayPrice = product.price > 0 ? product.price : 29.95;
    let showFrom = false;

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

    return (
        <div className="group block relative bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-slate-100">
            <Link to={`/shop/${shopId}/product/${product.product_id}`} className="block h-full flex flex-col">
                <div className="relative aspect-[3/4] bg-slate-50 overflow-hidden">
                    {product.files && product.files.length > 0 && (product.files[0].thumbnail_url || product.files[0].file_url) ? (
                        <>
                            <img 
                                src={product.files[0].thumbnail_url || product.files[0].file_url} 
                                alt={product.name}
                                className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-700"
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