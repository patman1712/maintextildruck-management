import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';

interface ProductTileProps {
    product: any;
    shopId: string | undefined;
}

export const ProductTile: React.FC<ProductTileProps> = ({ product, shopId }) => {
    const [showSizes, setShowSizes] = useState(false);
    
    // Parse variants if available
    let sizes: string[] = [];
    try {
        if (product.variants) {
            const variants = typeof product.variants === 'string' ? JSON.parse(product.variants) : product.variants;
            // Find size variable
            const sizeVar = variants.find((v: any) => v.name === 'Größe' || v.name === 'Size');
            if (sizeVar && sizeVar.values) {
                sizes = sizeVar.values;
            }
        }
    } catch (e) {
        console.error('Error parsing variants', e);
    }

    return (
        <div className="group block relative" onMouseLeave={() => setShowSizes(false)}>
            <Link to={`/shop/${shopId}/product/${product.product_id}`} className="block">
                <div className="relative aspect-[3/4] bg-slate-100 mb-4 overflow-hidden">
                    {product.files && product.files.length > 0 && (product.files[0].thumbnail_url || product.files[0].file_url) ? (
                        <img 
                            src={product.files[0].thumbnail_url || product.files[0].file_url} 
                            alt={product.name}
                            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <span className="text-4xl font-bold opacity-20">NO IMAGE</span>
                        </div>
                    )}
                    
                    {/* Badge */}
                    <div className="absolute top-4 left-4 bg-white px-2 py-1 text-xs font-bold uppercase tracking-wider">Neu</div>
                    
                    {/* Quick Add Button / Size Selector Overlay */}
                    <div className={`absolute bottom-0 left-0 right-0 bg-white p-4 transition-transform duration-300 ${showSizes ? 'translate-y-0' : 'translate-y-full group-hover:translate-y-0'}`}>
                        {showSizes ? (
                            <div className="grid grid-cols-4 gap-2">
                                {sizes.length > 0 ? sizes.map(size => (
                                    <Link 
                                        key={size}
                                        to={`/shop/${shopId}/product/${product.product_id}?size=${size}`} 
                                        className="text-center py-1 border border-slate-200 hover:border-black text-xs font-bold text-slate-800"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {size}
                                    </Link>
                                )) : (
                                    <Link to={`/shop/${shopId}/product/${product.product_id}`} className="col-span-4 text-center text-xs font-bold underline text-slate-800">
                                        Details ansehen
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <button 
                                className="w-full bg-black text-white py-2 text-sm font-bold uppercase hover:bg-slate-800 flex items-center justify-center gap-2"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setShowSizes(true);
                                }}
                            >
                                <ShoppingCart size={16} />
                                In den Warenkorb
                            </button>
                        )}
                    </div>
                </div>
                
                <h3 className="font-bold text-lg leading-tight mb-1 group-hover:text-red-600 transition-colors">{product.name}</h3>
                <p className="text-sm text-slate-500 mb-2">{product.product_number}</p>
                <div className="flex items-center justify-between">
                    <span className="font-bold text-lg">€ {product.price > 0 ? product.price.toFixed(2) : '29.95'}</span>
                </div>
            </Link>
        </div>
    );
};