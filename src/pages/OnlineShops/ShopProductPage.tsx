
import React, { useEffect, useState } from 'react';
import { useOutletContext, useParams, Link } from 'react-router-dom';
import { ShoppingCart, Heart, ChevronRight, Info, Plus, Minus, Check, Shirt, User, Hash, Shield } from 'lucide-react';
import { Shop, ShopCategory, Product } from '../../store';

interface ShopContext {
  shop: Shop;
  categories: ShopCategory[];
  primaryColor: string;
  secondaryColor: string;
}

const ShopProductPage: React.FC = () => {
  const { shopId, productId } = useParams<{ shopId: string; productId: string }>();
  const { shop, primaryColor } = useOutletContext<ShopContext>();
  const [product, setProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [personalizationOptions, setPersonalizationOptions] = useState<any[]>([]);
  const [selectedPersonalization, setSelectedPersonalization] = useState<{ [key: string]: string | boolean }>({});

  useEffect(() => {
    // Parse Personalization Options from Product Assignment
    let options: any[] = [];
    if (product && product.personalization_options) {
        try {
            const selectedIds = typeof product.personalization_options === 'string' 
                ? JSON.parse(product.personalization_options) 
                : product.personalization_options;
            
            // We need to fetch the full details for these IDs.
            // Ideally the backend should join this, but for now we fetch all options and filter.
            // Or we could fetch just the ones we need.
            fetch('/api/personalization')
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        const allOptions = data.data;
                        const productOptions = allOptions.filter((o: any) => selectedIds.includes(o.id));
                        setPersonalizationOptions(productOptions);
                    }
                });
        } catch (e) {
            console.error("Failed to parse personalization options", e);
        }
    }
  }, [product]);

  const toggleOption = (option: any) => {
      setSelectedPersonalization(prev => {
          if (prev[option.id]) {
              const newState = { ...prev };
              delete newState[option.id];
              return newState;
          } else {
              return { ...prev, [option.id]: true }; // For boolean/checkbox type options
          }
      });
  };

  const setOptionValue = (optionId: string, value: string) => {
      setSelectedPersonalization(prev => ({
          ...prev,
          [optionId]: value
      }));
  };

  const calculatePersonalizationPrice = () => {
      let total = 0;
      Object.keys(selectedPersonalization).forEach(key => {
          const option = personalizationOptions.find(o => o.id === key);
          if (option && selectedPersonalization[key]) {
              // Only add price if it's selected (true) or has a value (string)
              if (typeof selectedPersonalization[key] === 'boolean' && selectedPersonalization[key] === true) {
                  total += option.price_adjustment || 0;
              } else if (typeof selectedPersonalization[key] === 'string' && selectedPersonalization[key] !== '') {
                   total += option.price_adjustment || 0;
              }
          }
      });
      return total;
  };

  const [expandedSection, setExpandedSection] = useState<'description' | 'manufacturer' | null>('description');
  
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/shops/${shopId}/products`);
        const data = await res.json();
        if (data.success) {
          const found = data.data.find((p: any) => p.product_id === productId);
          if (found) {
            setProduct(found);
            if (found.files && found.files.length > 0) {
                setActiveImage(found.files[0].file_url || found.files[0].thumbnail_url);
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (shopId && productId) {
      fetchProduct();
    }
  }, [shopId, productId]);

  if (loading) return <div className="container mx-auto p-8 text-center">Lade Produkt...</div>;
  if (!product) return <div className="container mx-auto p-8 text-center">Produkt nicht gefunden.</div>;

  const images = product.files || [];
  // Fallback image if no files
  const mainImage = activeImage || (images.length > 0 ? images[0].file_url : null);
  
  // Parse Variants
  // If product.variants is undefined, it defaults to {}.
  // If product.variants is null or empty string, we should treat it as no variants.
  // The backend might return null for variants column.
  let variants = {};
  try {
      variants = (product.variants && typeof product.variants === 'string') 
          ? JSON.parse(product.variants) 
          : (product.variants || {});
  } catch (e) {
      console.error("Failed to parse variants JSON", e);
      variants = {};
  }
  
  const variantKeys = Object.keys(variants);
  const hasVariants = variantKeys.length > 0;

  // Derived state (needs to be here because product is null initially)
  let availableSizes: string[] = [];
  let currentPrice = product.price > 0 ? product.price : 29.95;

  if (hasVariants) {
      if (selectedVariantId) {
          const variant = variants[selectedVariantId];
          if (variant) {
              availableSizes = variant.values ? variant.values.split(',').map((s: string) => s.trim()) : [];
              if (variant.price) currentPrice = variant.price;
          }
      } else {
          // If variants exist but none selected, availableSizes stays empty to force selection
          availableSizes = [];
      }
  } else {
      // Fallback to standard sizes if no variants configured
      availableSizes = product.size ? product.size.split(',').map((s: string) => s.trim()) : ['S', 'M', 'L', 'XL', 'XXL'];
  }

  const isPersonalizationEnabled = product.personalization_enabled === 1 || product.personalization_enabled === true;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <div className="flex items-center text-xs uppercase tracking-wider text-slate-500 mb-8">
        <Link to={`/shop/${shopId}`} className="hover:text-slate-800">Startseite</Link>
        <span className="mx-2">/</span>
        {product.category_slug ? (
             <>
                <Link to={`/shop/${shopId}/category/${product.category_slug}`} className="hover:text-slate-800">{product.category_name}</Link>
                <span className="mx-2">/</span>
             </>
        ) : null}
        <span className="text-slate-800 font-bold">{product.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Left Column: Images */}
        <div className="flex flex-col-reverse lg:flex-row gap-4">
            {/* Thumbnails */}
            <div className="flex lg:flex-col gap-4 overflow-x-auto lg:overflow-visible">
                {images.map((img: any, idx: number) => (
                    <button 
                        key={idx} 
                        onClick={() => setActiveImage(img.file_url)}
                        className={`w-20 h-20 border-2 flex-shrink-0 bg-slate-50 ${activeImage === img.file_url ? 'border-slate-800' : 'border-transparent hover:border-slate-300'}`}
                    >
                        <img src={img.thumbnail_url || img.file_url} alt="" className="w-full h-full object-cover" />
                    </button>
                ))}
                {/* Fallback thumbnails if few images */}
                {images.length === 0 && [1,2,3].map(i => (
                     <div key={i} className="w-20 h-20 bg-slate-100 flex items-center justify-center text-slate-300 text-xs">No Img</div>
                ))}
            </div>
            
            {/* Main Image */}
            <div className="flex-1 bg-slate-50 aspect-[3/4] relative">
                {mainImage ? (
                    <img src={mainImage} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 text-2xl font-bold">NO IMAGE</div>
                )}
                <button className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-sm hover:bg-slate-50">
                    <Heart size={20} />
                </button>
            </div>
        </div>

        {/* Right Column: Details */}
        <div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter mb-2">{product.name}</h1>
            <div className="flex items-center justify-between mb-6">
                <div className="text-2xl font-bold">€ {currentPrice.toFixed(2)}</div>
                <div className="text-xs text-slate-500">inkl. MwSt. zzgl. Versandkosten</div>
            </div>

            {/* Variant Selection Buttons - Render logic above was slightly incorrect, moving it here properly */}
            {hasVariants && (
                <div className="mb-6">
                    <label className="font-bold text-sm uppercase block mb-2">Ausführung:</label>
                    <div className="flex flex-wrap gap-2">
                        {variantKeys.map(key => {
                            const variant = variants[key];
                            const isSelected = selectedVariantId === key;
                            return (
                                <button
                                    key={key}
                                    onClick={() => {
                                        setSelectedVariantId(key);
                                        setSelectedSize(''); // Reset size when variant changes
                                    }}
                                    className={`px-4 py-2 border rounded text-sm font-medium transition-colors ${isSelected ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}
                                >
                                    {variant.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Size Selection */}
            <div className="mb-8">
                <div className="flex justify-between mb-2">
                    <label className="font-bold text-sm uppercase">Grösse:</label>
                    <button className="text-xs text-slate-500 underline hover:text-slate-800">Grössentabelle</button>
                </div>
                <select 
                    className="w-full border border-slate-300 rounded p-3 text-sm focus:ring-2 focus:ring-slate-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                    value={selectedSize}
                    onChange={(e) => setSelectedSize(e.target.value)}
                    disabled={hasVariants && !selectedVariantId}
                >
                    <option value="">
                        {hasVariants && !selectedVariantId ? 'Bitte erst Ausführung wählen' : 'Bitte Grösse wählen'}
                    </option>
                    {availableSizes.map((size: string) => (
                        <option key={size} value={size}>{size}</option>
                    ))}
                </select>
            </div>

            {/* Personalization Section */}
            {isPersonalizationEnabled && personalizationOptions.length > 0 && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8">
                    <h3 className="font-bold text-blue-900 flex items-center mb-4">
                        PERSONALISIERE DEIN PRODUKT <span className="ml-2 text-xs">✨</span>
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {personalizationOptions.map(option => {
                            const isSelected = !!selectedPersonalization[option.id];
                            
                            // Determine Icon based on name or type
                            let Icon = Shirt; // Default
                            if (option.type === 'number') Icon = Hash;
                            else if (option.type === 'logo') Icon = Shield;
                            else if (option.name.toLowerCase().includes('name')) Icon = User;
                            
                            return (
                                <div key={option.id} className="flex flex-col">
                                    <button 
                                        className={`border rounded-lg p-3 text-center hover:border-blue-500 bg-white h-24 flex flex-col items-center justify-center transition-all ${isSelected ? 'border-blue-600 ring-2 ring-blue-100 shadow-sm' : 'border-slate-200 text-slate-500'}`}
                                        onClick={() => toggleOption(option)}
                                    >
                                        <div className={`mb-2 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>
                                            <Icon size={24} strokeWidth={1.5} />
                                        </div>
                                        <div className={`text-xs font-bold leading-tight px-1 ${isSelected ? 'text-slate-800' : 'text-slate-600'}`}>{option.name}</div>
                                        <div className="text-[10px] text-slate-400 mt-1 font-medium">+ € {option.price_adjustment.toFixed(2)}</div>
                                    </button>
                                    
                                    {/* Input Field below button if selected */}
                                    {isSelected && (option.type === 'text' || option.type === 'number') && (
                                        <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                                            <input 
                                                type={option.type === 'number' ? 'number' : 'text'}
                                                placeholder={option.type === 'number' ? "Nummer" : "Text"}
                                                className="w-full border border-blue-300 rounded p-2 text-sm text-center focus:ring-2 focus:ring-blue-200 outline-none shadow-sm"
                                                value={typeof selectedPersonalization[option.id] === 'string' ? selectedPersonalization[option.id] as string : ''}
                                                onChange={(e) => setOptionValue(option.id, e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Total Price */}
            <div className="mb-6">
                <div className="text-xs font-bold uppercase text-slate-500 mb-1">Gesamtpreis:</div>
                <div className="text-3xl font-bold">€ {(currentPrice + calculatePersonalizationPrice()).toFixed(2)}</div>
            </div>

            {/* Add to Cart */}
            <button 
                className="w-full bg-slate-900 text-white py-4 font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center space-x-2 mb-4"
                disabled={!selectedSize}
            >
                <ShoppingCart size={20} />
                <span>In den Warenkorb</span>
            </button>
            
            {!selectedSize && <p className="text-red-500 text-xs text-center">Bitte wähle zuerst eine Grösse.</p>}

            {/* Additional Info */}
            <div className="mt-8 border-t border-slate-200 pt-8 space-y-4">
                <div className="border-b border-slate-100 pb-4">
                    <button 
                        className="flex justify-between items-center w-full font-bold uppercase text-sm"
                        onClick={() => setExpandedSection(expandedSection === 'description' ? null : 'description')}
                    >
                        <span>Beschreibung</span>
                        {expandedSection === 'description' ? <Minus size={16} /> : <Plus size={16} />}
                    </button>
                    
                    {expandedSection === 'description' && (
                        <div className="mt-4 text-sm text-slate-600 leading-relaxed animate-in fade-in slide-in-from-top-2">
                            {product.description ? (
                                <div className="whitespace-pre-wrap">{product.description}</div>
                            ) : (
                                <p className="italic text-slate-400">Keine Beschreibung verfügbar.</p>
                            )}
                        </div>
                    )}
                </div>
                
                <div className="border-b border-slate-100 pb-4">
                    <button 
                        className="flex justify-between items-center w-full font-bold uppercase text-sm"
                        onClick={() => setExpandedSection(expandedSection === 'manufacturer' ? null : 'manufacturer')}
                    >
                        <span>Herstellerangaben</span>
                        {expandedSection === 'manufacturer' ? <Minus size={16} /> : <Plus size={16} />}
                    </button>
                    
                    {expandedSection === 'manufacturer' && (
                        <div className="mt-4 text-sm text-slate-600 leading-relaxed animate-in fade-in slide-in-from-top-2">
                            {product.manufacturer_info ? (
                                <div className="whitespace-pre-wrap">{product.manufacturer_info}</div>
                            ) : (
                                <p className="italic text-slate-400">Keine Herstellerangaben verfügbar.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ShopProductPage;
