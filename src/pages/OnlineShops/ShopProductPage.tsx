
import React, { useEffect, useState } from 'react';
import { useOutletContext, useParams, Link } from 'react-router-dom';
import { ShoppingCart, Heart, ChevronRight, Info, Plus, Minus, Check, Shirt, User, Hash, Shield } from 'lucide-react';
import { Shop, ShopCategory, Product } from '../../store';
import { useShopStore, CartItem } from '../../shopStore';

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
          const wasSelected = !!prev[option.id];
          let newState;
          
          if (wasSelected) {
              newState = { ...prev };
              delete newState[option.id];
          } else {
              newState = { ...prev, [option.id]: true }; 
          }
          
          // Image Logic: Find the best matching image for the NEW state
          // We need to find an image where ALL its required options are selected in newState
          
          // Get all currently selected option IDs (including the one just toggled)
          const selectedIds = Object.keys(newState).filter(k => !!newState[k]);
          
          // Find images that have personalization requirements
          const personalizedImages = images.filter((img: any) => 
              img.personalization_option_ids && img.personalization_option_ids.length > 0
          );
          
          // Try to find an image where ALL required options are present in selectedIds
          // We prefer images with MORE matching options (specificity)
          let bestMatch = null;
          let maxMatchCount = 0;
          
          for (const img of personalizedImages) {
              const requiredIds = img.personalization_option_ids;
              const allRequiredPresent = requiredIds.every((id: string) => selectedIds.includes(id));
              
              if (allRequiredPresent) {
                  // This image is a candidate. Check if it's more specific than previous candidate
                  if (requiredIds.length > maxMatchCount) {
                      maxMatchCount = requiredIds.length;
                      bestMatch = img;
                  }
              }
          }
          
          if (bestMatch) {
              setActiveImage(bestMatch.file_url);
          } else {
              // No matching personalized image found.
              // If we were viewing a personalized image that is no longer valid, revert to standard.
              // Or just revert to standard if no match found?
              
              // Check if currently active image is a personalized one that is now invalid
              const activeImgObj = images.find((i: any) => i.file_url === activeImage);
              const activeIsPersonalized = activeImgObj && activeImgObj.personalization_option_ids && activeImgObj.personalization_option_ids.length > 0;
              
              if (activeIsPersonalized) {
                   // Switch to standard
                   const standardImage = images.find((img: any) => !img.personalization_option_ids || img.personalization_option_ids.length === 0);
                   if (standardImage) setActiveImage(standardImage.file_url);
              } else if (!activeImage) {
                   const standardImage = images.find((img: any) => !img.personalization_option_ids || img.personalization_option_ids.length === 0);
                   if (standardImage) setActiveImage(standardImage.file_url);
              }
          }
          
          return newState;
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

  const images = (product.files || []).filter((f: any) => !f.type || f.type === 'view' || f.type === 'preview' || (f.thumbnail_url && f.type !== 'print' && f.type !== 'vector' && f.type !== 'internal'));
  
  // Filter images: 
  // 1. If NO personalization is selected, show ONLY standard images (no personalization_option_id)
  // 2. If personalization IS selected, show standard images AND the specific image for that option
  
  const hasSelectedPersonalization = Object.values(selectedPersonalization).some(v => !!v);

  const displayedImages = images.filter((img: any) => {
      // Standard images (no personalization requirements)
      if (!img.personalization_option_ids || img.personalization_option_ids.length === 0) {
          // Hide standard images if ANY personalized image is currently valid and active
          const activeOptionIds = Object.keys(selectedPersonalization).filter(k => !!selectedPersonalization[k]);
          
          const hasActivePersonalizedImage = images.some((i: any) => 
              i.personalization_option_ids && 
              i.personalization_option_ids.length > 0 &&
              i.personalization_option_ids.every((id: string) => activeOptionIds.includes(id))
          );
          
          if (hasActivePersonalizedImage) return false; 
          return true; 
      } 
      
      // Personalized images
      else {
          const requiredIds = img.personalization_option_ids;
          const activeOptionIds = Object.keys(selectedPersonalization).filter(k => !!selectedPersonalization[k]);
          
          // Show only if ALL required options for this image are currently selected
          return requiredIds.every((id: string) => activeOptionIds.includes(id));
      }
  });

  // Fallback image if no files
  const mainImage = activeImage || (displayedImages.length > 0 ? displayedImages[0].file_url : null);
  
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

  const handleAddToCart = () => {
    if (!selectedSize) return;

    const totalPrice = currentPrice + calculatePersonalizationPrice();
    
    // Create a unique ID for this specific product + options combo
    const personalizationString = Object.entries(selectedPersonalization)
      .filter(([_, v]) => !!v)
      .map(([k, v]) => `${k}:${v}`)
      .sort()
      .join('|');
    
    const cartItemId = `${product.product_id}-${selectedVariantId || 'std'}-${selectedSize}-${personalizationString}`;

    const cartItem: CartItem = {
      id: cartItemId,
      productId: product.product_id,
      productNumber: product.product_number,
      name: product.name,
      price: totalPrice,
      quantity: quantity,
      image: mainImage || undefined,
      size: selectedSize,
      color: selectedVariantId ? variants[selectedVariantId]?.name : undefined,
      personalization: personalizationString || undefined,
      weight: product.weight || 0,
      supplierId: product.supplier_id || undefined
    };

    useShopStore.getState().addToCart(cartItem);
    
    // Trigger a brief success animation or just open the cart sidebar? 
    // The user mentioned "wenn man auf den Warenkorb klickt soll eine sidebar aufgehen", 
    // but usually adding also opens it or shows a notification.
    // I'll assume adding just updates the count for now, or I can try to find a way to open the sidebar.
    // Since ShopLayout manages the sidebar state, I'd need a way to communicate.
    // For now, let's just add it.
  };

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
                {displayedImages.map((img: any, idx: number) => (
                    <button 
                        key={idx} 
                        onClick={() => setActiveImage(img.file_url)}
                        className={`w-20 h-20 border-2 flex-shrink-0 bg-slate-50 relative ${activeImage === img.file_url ? 'border-slate-800' : 'border-transparent hover:border-slate-300'}`}
                    >
                        <img src={img.thumbnail_url || img.file_url} alt="" className="w-full h-full object-cover" />
                        {img.personalization_option_id && (
                             <div className="absolute bottom-0 right-0 bg-blue-600 text-white p-0.5 rounded-tl text-[8px] font-bold">
                                 ★
                             </div>
                        )}
                    </button>
                ))}
                {/* Fallback thumbnails if few images */}
                {displayedImages.length === 0 && [1,2,3].map(i => (
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

            {/* Quantity and Total Price */}
            <div className="mb-6 flex items-center justify-between bg-slate-50 p-4 rounded-lg border border-slate-100">
                <div className="flex items-center">
                    <span className="font-bold text-sm uppercase mr-4">Menge:</span>
                    <div className="flex items-center bg-white rounded border border-slate-200">
                        <button 
                            className="p-2 hover:bg-slate-100 text-slate-600"
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        >
                            <Minus size={16} />
                        </button>
                        <input 
                            type="number" 
                            className="w-12 text-center border-x border-slate-200 py-2 text-sm font-bold outline-none"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                        <button 
                            className="p-2 hover:bg-slate-100 text-slate-600"
                            onClick={() => setQuantity(quantity + 1)}
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                </div>
                
                <div className="text-right">
                    <div className="text-xs font-bold uppercase text-slate-500 mb-1">Gesamtpreis:</div>
                    <div className="text-3xl font-bold">€ {((currentPrice + calculatePersonalizationPrice()) * quantity).toFixed(2)}</div>
                </div>
            </div>

            {/* Add to Cart */}
            <button 
                onClick={handleAddToCart}
                className="w-full bg-slate-900 text-white py-4 font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center space-x-2 mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
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
