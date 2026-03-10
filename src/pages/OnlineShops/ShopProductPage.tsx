
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
  const [selectedBackPrint, setSelectedBackPrint] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [personalizationOptions, setPersonalizationOptions] = useState<any[]>([]);
  const [selectedPersonalization, setSelectedPersonalization] = useState<{ [key: string]: string | boolean }>({});
  const [selectedVariantValues, setSelectedVariantValues] = useState<Record<string, string>>({});
  const [expandedSection, setExpandedSection] = useState<'description' | 'manufacturer' | null>('description');
  const [shopVariables, setShopVariables] = useState<any[]>([]);

  useEffect(() => {
    if (shopId) {
      fetch(`/api/variables/shop/${shopId}`)
        .then(res => res.json())
        .then(data => { if (data.success) setShopVariables(data.data); })
        .catch(err => console.error("Error fetching variables", err));
    }
  }, [shopId]);

  // Parse Variants - Safe default
  const variants = React.useMemo(() => {
      if (!product || !product.variants) return {};
      try {
          return (typeof product.variants === 'string') 
              ? JSON.parse(product.variants) 
              : product.variants;
      } catch (e) {
          console.error("Failed to parse variants JSON", e);
          return {};
      }
  }, [product]);

  const variantDefinitions = React.useMemo(() => {
      return Object.entries(variants).map(([id, data]: [string, any]) => {
          const variable = shopVariables.find(v => String(v.id) === String(id));
          const name = variable?.name || data.name || 'Unbekannt';
          
          // Determine type: Explicit type OR guess by name
          let type = variable?.type;
          if (!type) {
              const lowerName = name.toLowerCase();
              if (lowerName.includes('rücken') || lowerName.includes('back')) type = 'back_print';
              else if (lowerName.includes('größe') || lowerName.includes('size')) type = 'size';
              else type = 'other';
          }
          
          return {
              id,
              name,
              type,
              values: data.values ? data.values.split(',').map((s: string) => s.trim()) : [],
              price: data.price
          };
      });
  }, [variants, shopVariables]);

  const backPrintVariant = React.useMemo(() => 
      variantDefinitions.find(v => v.type === 'back_print'),
  [variantDefinitions]);

  const mainVariants = React.useMemo(() => 
      variantDefinitions.filter(v => v.type !== 'back_print'),
  [variantDefinitions]);

  // Auto-select variant if only one exists (e.g. only "Size")
  useEffect(() => {
      if (mainVariants.length === 1 && !selectedVariantId) {
          setSelectedVariantId(mainVariants[0].id);
      }
  }, [mainVariants, selectedVariantId]);

  // Derived state (needs to be here because product is null initially)
  const availableSizes = React.useMemo(() => {
      // Logic:
      // If we have "Main Variants" (which now INCLUDE things like "Jako Erwachsen" if they are not explicitly 'size'),
      // then the sizes depend on the SELECTION of that variant.
      
      // If we have selected a variant ID:
      if (selectedVariantId) {
          const selectedVar = variantDefinitions.find(v => v.id === selectedVariantId);
          // If the selected variant has values (e.g. S, M, L), use them as sizes
          if (selectedVar && selectedVar.values.length > 0) {
              return selectedVar.values;
          }
      }
      
      // If we have variants but none selected -> Empty sizes to force selection
      if (mainVariants.length > 0 && !selectedVariantId) {
          return [];
      }

      // Fallback: Use product.size string or dedicated 'size' variant if no main variants exist
      const sizeVariant = variantDefinitions.find(v => v.type === 'size');
      if (sizeVariant && sizeVariant.values.length > 0) return sizeVariant.values;
      
      if (product?.size) return product.size.split(',').map((s: any) => s.trim());
      
      return ['S', 'M', 'L', 'XL', 'XXL'];
  }, [product, variantDefinitions, selectedVariantId, mainVariants]);
  
  const availableBackPrints = React.useMemo(() => {
      if (backPrintVariant) return backPrintVariant.values;
      return [];
  }, [backPrintVariant]);

  const currentPrice = React.useMemo(() => {
      if (!product) return 0;
      let price = product.price > 0 ? product.price : 29.95;
      
      const hasVariants = Object.keys(variants).length > 0;

      // If variant is selected, use its price
      if (selectedVariantId && variants[selectedVariantId] && variants[selectedVariantId].price) {
          price = variants[selectedVariantId].price;
      } 
      // If no variant is selected, but variants exist, find the lowest price
      else if (hasVariants) {
          let minPrice = Infinity;
          let found = false;
          
          Object.values(variants).forEach((v: any) => {
              if (v.price && v.price > 0) {
                  if (v.price < minPrice) {
                      minPrice = v.price;
                      found = true;
                  }
              }
          });
          
          if (found) {
              price = minPrice;
          }
      }
      
      return price;
  }, [product, variants, selectedVariantId]);

  // Derived state to show "Ab" (From) prefix
  const showFromPrice = !selectedVariantId && Object.keys(variants).length > 0;

  useEffect(() => {
    // Parse Personalization Options from Product Assignment
    if (product && product.personalization_options) {
        try {
            const selectedIds = typeof product.personalization_options === 'string' 
                ? JSON.parse(product.personalization_options) 
                : product.personalization_options;
            
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

  // Initialize selections
  useEffect(() => {
      const hasVariants = Object.keys(variants).length > 0;
      if (hasVariants && Object.keys(selectedVariantValues).length === 0) {
          // Optional: Pre-select first value? Or leave empty for mandatory selection?
      }
  }, [variants, selectedVariantValues]);

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

  const images = React.useMemo(() => {
      if (!product || !product.files) return [];
      return (product.files || []).filter((f: any) => !f.type || f.type === 'view' || f.type === 'preview' || (f.thumbnail_url && f.type !== 'print' && f.type !== 'vector' && f.type !== 'internal'));
  }, [product]);

  const displayedImages = React.useMemo(() => {
      return images.filter((img: any) => {
          // 0. Parse attribute restrictions safely
          let restrictions: Record<string, string[]> = {};
          if (img.attribute_restrictions) {
              if (typeof img.attribute_restrictions === 'string') {
                   try { restrictions = JSON.parse(img.attribute_restrictions); } catch (e) {}
              } else {
                   restrictions = img.attribute_restrictions;
              }
          }

          // 1. Check Attribute Restrictions (Back Print, Color, etc.)
          if (Object.keys(restrictions).length > 0) {
              // Iterate all restrictions
              for (const [varId, allowedValues] of Object.entries(restrictions)) {
                   // Check against selected Back Print
                   if (backPrintVariant && String(backPrintVariant.id) === String(varId)) {
                       if (selectedBackPrint) {
                           if (!allowedValues.includes(selectedBackPrint)) return false;
                       } else {
                           // If file is restricted to a Back Print option, but none selected yet -> Hide
                           return false;
                       }
                   }
                   else if (varId === 'standard') {
                       // Standard restriction (e.g. Size S, M) - Check against selectedSize
                       if (selectedSize) {
                            if (!allowedValues.includes(selectedSize)) return false;
                       } else {
                            // Restriction exists but no size selected yet -> Hide? 
                            // Or show if we assume unselected means "all sizes"? 
                            // Usually restrictions mean "Only show for these".
                            return false;
                       }
                   }
                   // Check against other variants (Color etc.)
                   else {
                       const selectedVal = selectedVariantValues[varId];
                       if (selectedVal) {
                           if (!allowedValues.includes(selectedVal)) return false;
                       } 
                       // If restriction exists but no value selected for that variant -> Hide
                       else {
                           return false;
                       }
                   }
              }
          } else {
              // New Logic: If image has NO restrictions but belongs to a variant group (like Back Print),
              // we should probably hide it unless it's a "general" back print image?
              // But usually, back print images are specific to a value (Motiv A, Motiv B).
              // If an image is assigned to the "Back Print" variant GROUP but has NO value restrictions,
              // it means "Show for ANY Back Print selection"? Or "Show always"?
              
              // The user requirement is: "Show back print images ONLY when back print is selected".
              // This implies that images associated with Back Print should be hidden if selectedBackPrint is empty.
              
              // We need to know if this image is "associated" with Back Print.
              // We can check `img.variant_ids` (array of variant IDs this image belongs to).
              
              if (img.variant_ids && img.variant_ids.length > 0) {
                  // Check if any of the assigned variant IDs is the Back Print ID
                  if (backPrintVariant && img.variant_ids.map((id: any) => String(id)).includes(String(backPrintVariant.id))) {
                      // If image is associated with Back Print, but no back print is selected -> Hide
                      if (!selectedBackPrint) return false;
                  }
              }
          }
    
          // 2. Standard images (no personalization requirements)
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
  }, [images, backPrintVariant, selectedBackPrint, selectedVariantValues, selectedPersonalization]);

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
          
          // Image Logic
          const selectedIds = Object.keys(newState).filter(k => !!newState[k]);
          const personalizedImages = images.filter((img: any) => 
              img.personalization_option_ids && img.personalization_option_ids.length > 0
          );
          
          let bestMatch = null;
          let maxMatchCount = 0;
          
          for (const img of personalizedImages) {
              const requiredIds = img.personalization_option_ids;
              const allRequiredPresent = requiredIds.every((id: string) => selectedIds.includes(id));
              
              if (allRequiredPresent) {
                  if (requiredIds.length > maxMatchCount) {
                      maxMatchCount = requiredIds.length;
                      bestMatch = img;
                  }
              }
          }
          
          if (bestMatch) {
              setActiveImage(bestMatch.file_url);
          } else {
              const activeImgObj = images.find((i: any) => i.file_url === activeImage);
              const activeIsPersonalized = activeImgObj && activeImgObj.personalization_option_ids && activeImgObj.personalization_option_ids.length > 0;
              
              if (activeIsPersonalized) {
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

  // Auto-select first image of newly filtered set if active image becomes hidden
  useEffect(() => {
      if (displayedImages.length > 0) {
          const isActiveVisible = displayedImages.some((img: any) => img.file_url === activeImage);
          if (!isActiveVisible) {
              setActiveImage(displayedImages[0].file_url || displayedImages[0].thumbnail_url);
          }
      }
  }, [displayedImages, activeImage]);

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
              if (typeof selectedPersonalization[key] === 'boolean' && selectedPersonalization[key] === true) {
                  total += option.price_adjustment || 0;
              } else if (typeof selectedPersonalization[key] === 'string' && selectedPersonalization[key] !== '') {
                   total += option.price_adjustment || 0;
              }
          }
      });
      return total;
  };
  
  if (loading) return <div className="container mx-auto p-8 text-center">Lade Produkt...</div>;
  if (!product) return <div className="container mx-auto p-8 text-center">Produkt nicht gefunden.</div>;

  const mainImage = activeImage || (displayedImages.length > 0 ? displayedImages[0].file_url : null);
  // Re-declare hasVariants here if needed, or use the one derived from variants object
  const variantsExist = Object.keys(variants).length > 0;
  
  // Override availableSizes logic:
  // If we have a "Main Variant" selected, we use its values as sizes?
  // Wait, `type="size"` variables are used for sizes. `type="color"` for variants.
  // The `variants` object in `shop_product_assignments` contains BOTH?
  // Let's check ProductEditorModal.
  // It fetches variables. If type is 'size', it populates `getAllAvailableSizes`.
  // If type is NOT size, it adds to `activeVariants`.
  // So `variants` JSON in DB only contains NON-SIZE variables (Colors, Models, and now Back Prints).
  // The SIZES are derived from the "Main Variant" (if active) or the product size string.
  
  // So:
  // 1. `availableSizes` comes from `getAllAvailableSizes` which logic is:
  //    - If active variants exist, it unions their values?
  //    - Wait, previous logic was: `values.split(',').forEach...`
  //    - So if I have "Color: Red" (values: S,M,L) and "Back: A" (values: ??)
  //    - This is confusing. "Color" variable usually has values "Red, Blue". Not Sizes.
  //    - The `variants` column in DB stores the configuration of the variable for this product.
  //      e.g. Variable "Color" (Values: Red, Blue).
  //      e.g. Variable "Size" (Values: S, M, L).
  
  // Correct logic should be:
  // - Attributes of type "size" -> Populate Size Dropdown.
  // - Attributes of type "color"/"other" -> Populate Variant Selectors.
  
  // The current `variants` object contains ALL assigned variables (checked in ProductEditor).
  // We need to separate them by intent.
  // Since we don't have the "type" here, we have to guess or change backend to include type.
  // Guessing by name is brittle but might work for "Rückendruck".
  // For Sizes: We usually have a dedicated "Size" variable or fallback to `product.size`.
  
  // Let's assume `variants` contains all non-standard configurations.
  // If we added "Rückendruck" (Back Print) as a variable, it will be in `variants`.
  


  const isPersonalizationEnabled = product.personalization_enabled === 1 || product.personalization_enabled === true;

  const handleAddToCart = () => {
    if (!selectedSize) return;

    // Check if back print is mandatory and missing
    if (backPrintVariant && !selectedBackPrint) return;

    const totalPrice = currentPrice + calculatePersonalizationPrice();
    
    // Create a unique ID for this specific product + options combo
    const personalizationString = Object.entries(selectedPersonalization)
      .filter(([_, v]) => !!v)
      .map(([k, v]) => `${k}:${v}`)
      .sort()
      .join('|');
    
    const cartItemId = `${product.product_id}-${Object.values(selectedVariantValues).join('_')}-${selectedBackPrint}-${selectedSize}-${personalizationString}`;

    const cartItem: CartItem = {
      id: cartItemId,
      productId: product.product_id,
      productNumber: product.product_number,
      name: product.name,
      price: totalPrice,
      quantity: quantity,
      image: mainImage || undefined,
      size: selectedSize,
      color: Object.values(selectedVariantValues).join(', ') || undefined, // Concatenate selected variants
      personalization: personalizationString || undefined,
      weight: product.weight || 0,
      supplierId: product.supplier_id || undefined,
      // Pass back print as personalization option or separate field?
      // Since we don't have a "back_print" field in CartItem, we append it to personalization or handle it specially.
      // But personalization is a string.
      // Or we append it to color/variant description?
      // Let's append to personalization string for now so it shows up in orders.
      // Actually, CartItem interface is defined in shopStore.ts.
    };
    
    // Hack: Append Back Print to personalization if selected
    if (selectedBackPrint) {
        if (cartItem.personalization) {
            cartItem.personalization += ` | Rückendruck: ${selectedBackPrint}`;
        } else {
            cartItem.personalization = `Rückendruck: ${selectedBackPrint}`;
        }
    }

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
                <div className="text-2xl font-bold">
                    {showFromPrice && <span className="text-sm font-normal text-slate-500 mr-1">Ab</span>}
                    € {currentPrice.toFixed(2)}
                </div>
                <div className="text-xs text-slate-500">inkl. MwSt. zzgl. Versandkosten</div>
            </div>

            {/* Variant Group Selection (e.g., Adult vs Kids) */}
            {Object.keys(variants).length > 0 && mainVariants.length > 1 && (
                <div className="mb-6">
                    <label className="font-bold text-sm uppercase block mb-2">Ausführung / Modell:</label>
                    <div className="flex flex-wrap gap-2">
                        {mainVariants.map(variant => {
                            const isSelected = selectedVariantId === variant.id;
                            return (
                                <button
                                    key={variant.id}
                                    onClick={() => {
                                        setSelectedVariantId(variant.id);
                                        setSelectedSize(''); // Reset size when group changes
                                        setSelectedVariantValues({}); // Reset previous selection values
                                    }}
                                    className={`px-4 py-2 border rounded text-sm font-medium transition-colors ${
                                        isSelected 
                                            ? 'border-slate-800 bg-slate-800 text-white' 
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                                    }`}
                                >
                                    {variant.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
            
            {/* Size Selection - Standard */}
            <div className="mb-8">
                <div className="flex justify-between mb-2">
                    <label className="font-bold text-sm uppercase">Grösse:</label>
                    <button className="text-xs text-slate-500 underline hover:text-slate-800">Grössentabelle</button>
                </div>
                <select 
                    className="w-full border border-slate-300 rounded p-3 text-sm focus:ring-2 focus:ring-slate-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                    value={selectedSize}
                    onChange={(e) => {
                        const val = e.target.value;
                        setSelectedSize(val);
                        // Link the size to the selected variant group for cart/price logic
                        if (selectedVariantId && val) {
                            setSelectedVariantValues({ [selectedVariantId]: val });
                        }
                    }}
                >
                    <option value="">Bitte Grösse wählen</option>
                    {availableSizes.map((size: string) => (
                        <option key={size} value={size}>{size}</option>
                    ))}
                </select>
            </div>

            {/* Back Print Selection (Explicit) */}
            {backPrintVariant && (
                <div className="mb-6">
                    <label className="font-bold text-sm uppercase block mb-2">{backPrintVariant.name}:</label>
                    <select
                        className="w-full border border-slate-300 rounded p-3 text-sm focus:ring-2 focus:ring-slate-500 outline-none"
                        value={selectedBackPrint}
                        onChange={(e) => setSelectedBackPrint(e.target.value)}
                    >
                        <option value="">Bitte wählen (Pflichtfeld)</option>
                        {availableBackPrints.map(val => (
                            <option key={val} value={val}>{val}</option>
                        ))}
                    </select>
                </div>
            )}

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
                disabled={
                    !selectedSize || 
                    (!!backPrintVariant && !selectedBackPrint) ||
                    // Require variant group selection if multiple groups exist
                    (mainVariants.length > 0 && !selectedVariantId)
                }
            >
                <ShoppingCart size={20} />
                <span>In den Warenkorb</span>
            </button>
            
            {!selectedSize && <p className="text-red-500 text-xs text-center">Bitte wähle zuerst eine Grösse.</p>}
            {!!backPrintVariant && !selectedBackPrint && <p className="text-red-500 text-xs text-center">Bitte wähle einen Rückendruck.</p>}

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
                                <div dangerouslySetInnerHTML={{ __html: product.description }} className="prose prose-sm max-w-none text-slate-600" />
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
                                <div dangerouslySetInnerHTML={{ __html: product.manufacturer_info }} className="prose prose-sm max-w-none text-slate-600" />
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
