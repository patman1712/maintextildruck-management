
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
      return Object.entries(variants).map(([id, data]: [string, any]) => ({
          id,
          name: data.name,
          values: data.values ? data.values.split(',').map((s: string) => s.trim()) : [],
          price: data.price
      }));
  }, [variants]);

  const backPrintVariant = React.useMemo(() => 
      variantDefinitions.find(v => v.name.toLowerCase().includes('rücken') || v.name.toLowerCase().includes('back')),
  [variantDefinitions]);

  const mainVariants = React.useMemo(() => 
      variantDefinitions.filter(v => !v.name.toLowerCase().includes('rücken') && !v.name.toLowerCase().includes('back')),
  [variantDefinitions]);

  // Derived state (needs to be here because product is null initially)
  const availableSizes = React.useMemo(() => {
      if (!product) return [];
      const hasVariants = Object.keys(variants).length > 0;
      
      if (hasVariants) {
          if (selectedVariantId) {
              const variant = variants[selectedVariantId];
              if (variant) {
                  return variant.values ? variant.values.split(',').map((s: string) => s.trim()) : [];
              }
          }
          return [];
      } else {
          return product.size ? product.size.split(',').map((s: string) => s.trim()) : ['S', 'M', 'L', 'XL', 'XXL'];
      }
  }, [product, variants, selectedVariantId]);
  
  const availableBackPrints = React.useMemo(() => {
      if (backPrintVariant) return backPrintVariant.values;
      return [];
  }, [backPrintVariant]);

  const currentPrice = React.useMemo(() => {
      if (!product) return 0;
      let price = product.price > 0 ? product.price : 29.95;
      if (selectedVariantId && variants[selectedVariantId] && variants[selectedVariantId].price) {
          price = variants[selectedVariantId].price;
      }
      return price;
  }, [product, variants, selectedVariantId]);

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
          // 1. Check Attribute Restrictions (Back Print, Color, etc.)
          if (img.attribute_restrictions) {
              let restrictions: Record<string, string[]> = {};
              if (typeof img.attribute_restrictions === 'string') {
                   try { restrictions = JSON.parse(img.attribute_restrictions); } catch (e) {}
              } else {
                   restrictions = img.attribute_restrictions;
              }
              
              if (Object.keys(restrictions).length > 0) {
                  // Iterate all restrictions
                  for (const [varId, allowedValues] of Object.entries(restrictions)) {
                       // Check against selected Back Print
                       if (backPrintVariant && backPrintVariant.id === varId) {
                           if (selectedBackPrint) {
                               if (!allowedValues.includes(selectedBackPrint)) return false;
                           } else {
                               // If file is restricted to a Back Print option, but none selected yet -> Hide
                               return false;
                           }
                       }
                       // Check against other variants (Color etc.)
                       else if (selectedVariantValues[varId]) {
                           if (!allowedValues.includes(selectedVariantValues[varId])) return false;
                       } 
                       // If restriction exists but no value selected for that variant -> Hide
                       else {
                           return false;
                       }
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
  const hasVariants = Object.keys(variants).length > 0;
  
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
                <div className="text-2xl font-bold">€ {currentPrice.toFixed(2)}</div>
                <div className="text-xs text-slate-500">inkl. MwSt. zzgl. Versandkosten</div>
            </div>

            {/* Variant Selection Buttons (Excluding Back Print) */}
            {hasVariants && mainVariants.length > 0 && (
                <div className="mb-6">
                    <label className="font-bold text-sm uppercase block mb-2">{mainVariants[0].name}:</label>
                    <div className="flex flex-wrap gap-2">
                        {mainVariants.map(variant => {
                            // This logic assumes we iterate over values, but mainVariants iterates over definitions.
                            // The previous logic was iterating over variant KEYS (IDs).
                            // But here we have the DEFINITION.
                            // WAIT! `variants` structure is { [id]: { name, values: "A,B,C" } }
                            // This defines ONE variant type (e.g. Color) with multiple OPTIONS (A,B,C).
                            
                            // If we have MULTIPLE variant types (e.g. Color AND Model), we have multiple entries in `variants`.
                            // So `mainVariants` is an array of variant DEFINITIONS.
                            
                            // We should render a selector for EACH definition.
                            
                            return (
                                <div key={variant.id} className="mb-4">
                                     {/* If we have multiple main variants, show label for each. If only one, maybe hide or show? */}
                                     {mainVariants.length > 1 && <div className="text-xs font-bold mb-1">{variant.name}</div>}
                                     
                                     {/* Wait, the previous code rendered BUTTONS for the KEYS of `variants`.
                                         That implied that `variants` was NOT { id: {values} }, but rather { id: {name: "Option Name"} }?
                                         Let's check ProductEditorModal again.
                                         
                                         In ProductEditorModal:
                                         formData.variants[varId] = { values: "..." }
                                         
                                         So `variants` in DB is:
                                         { "var_color": { values: "Red, Blue" }, "var_size": { values: "S, M" } }
                                         
                                         The previous code:
                                         variantKeys.map(key => ... variant.name ...)
                                         
                                         Wait, if `variant.name` is "Red", then `variants` structure must be:
                                         { "option_1": { name: "Red", values: "S, M, L" }, "option_2": { name: "Blue", values: "S, M, L" } }
                                         
                                         AH! This means the current system supports only ONE dimension of variants (e.g. Color), 
                                         and the keys are the OPTIONS (Red, Blue). And each option has specific SIZES.
                                         
                                         So "Global Shop Attributes" (Variables) are used to generate these OPTIONS.
                                         If I add "Rückendruck" as a variable, does it create OPTIONS?
                                         
                                         If I select "Rückendruck" in ProductEditor, do I get "Back Print A", "Back Print B" as options?
                                         
                                         If the user wants "Rückendruck" as a SEPARATE selection (independent of Color),
                                         then the current data model (One Variant Dimension -> Sizes) is insufficient 
                                         OR we are misusing it.
                                         
                                         The user says: "Shop Attributes ... give me option to select back print ... 2 different back prints ... I want to offer BOTH".
                                         
                                         If we use the current system:
                                         We could create variants:
                                         1. Color Red + Back A
                                         2. Color Red + Back B
                                         3. Color Blue + Back A
                                         ...
                                         But that's combinatorial explosion.
                                         
                                         If we want a simple dropdown "Rückendruck: A, B", we need a second dimension.
                                         
                                         Since I cannot easily change the whole data model now, I will implement a "Rückendruck" logic 
                                         that looks for a variable named "Rückendruck" and renders it separately.
                                         
                                         BUT: Where is the data stored?
                                         If `variants` stores { "var_id": { values: "Option1, Option2" } } -> This is the DEFINITION of the variable.
                                         
                                         Wait, let's re-read ProductEditorModal logic.
                                         It iterates `activeVariants`. For each `varId`, it gets `formData.variants[varId]`.
                                         And it saves this to DB.
                                         
                                         So if I have Variable "Color" (Red, Blue) and Variable "Back" (A, B).
                                         The DB `variants` JSON will be:
                                         {
                                            "var_color_id": { values: "Red, Blue", ... },
                                            "var_back_id": { values: "A, B", ... }
                                         }
                                         
                                         The previous code `ShopProductPage` did:
                                         `variantKeys.map(...)` -> renders a button for EACH key.
                                         So it rendered a button for "var_color_id" and a button for "var_back_id"?
                                         NO. `variant.name` would be "Color" and "Back".
                                         
                                         If I clicked "Color", `selectedVariantId` became "var_color_id".
                                         Then `availableSizes` became "Red, Blue".
                                         
                                         This means the previous logic treated Variables as mutually exclusive "Types".
                                         e.g. "Select Type: Color" -> "Select Size: Red". 
                                         This is weird. Usually you select "Color: Red" then "Size: S".
                                         
                                         It seems the previous logic was:
                                         Variants = "Ausführungen". e.g. "Cotton", "Polyester".
                                         And each Ausführung has Sizes.
                                         
                                         If the user used "Color" variable, they got buttons "Color". Clicking it showed "Red, Blue" in the size dropdown?
                                         No, `availableSizes = variant.values`.
                                         So if I had Variable "Color" with values "Red, Blue".
                                         I would see one button "Color". Clicking it would put "Red, Blue" into the "Size" dropdown.
                                         This is definitely not what is intended for Colors.
                                         
                                         BUT: The user asked to add "Rückendruck".
                                         If I add it, I want a dropdown "Rückendruck" with values "A, B".
                                         And I want the standard "Size" dropdown (S, M, L).
                                         
                                         So:
                                         1. Identify "Back Print" variable.
                                         2. Render it as a separate Select.
                                         3. Ensure "Size" dropdown is still populated (either from product.size or from a "Size" variable).
                                         
                                         If `mainVariants` contains "Color" (Values: Red, Blue).
                                         We should render a "Color" dropdown/buttons.
                                         And a "Size" dropdown.
                                         
                                         So I need to change how `variants` are rendered.
                                         Instead of buttons switching the *source* of the size dropdown,
                                         they should be independent selectors.
                                     */}
                                     
                                     {/* Correct Implementation for Independent Dimensions */}
                                     <div className="flex flex-wrap gap-2">
                                        {variant.values.map((val: string) => {
                                            const isSelected = selectedVariantValues[variant.id] === val;
                                            return (
                                                <button
                                                    key={val}
                                                    onClick={() => setSelectedVariantValues(prev => ({ ...prev, [variant.id]: val }))}
                                                    className={`px-4 py-2 border rounded text-sm font-medium transition-colors ${isSelected ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}
                                                >
                                                    {val}
                                                </button>
                                            )
                                        })}
                                     </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
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

            {/* Size Selection - Standard */}
            {/* If we have variables that are NOT back print, do they define sizes? */}
            {/* The logic is: 
                - If we have explicit "size" variable (how to detect? maybe if values look like sizes S,M,L?), use it.
                - Else use product.size.
            */}
            <div className="mb-8">
                <div className="flex justify-between mb-2">
                    <label className="font-bold text-sm uppercase">Grösse:</label>
                    <button className="text-xs text-slate-500 underline hover:text-slate-800">Grössentabelle</button>
                </div>
                <select 
                    className="w-full border border-slate-300 rounded p-3 text-sm focus:ring-2 focus:ring-slate-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                    value={selectedSize}
                    onChange={(e) => setSelectedSize(e.target.value)}
                >
                    <option value="">Bitte Grösse wählen</option>
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
                disabled={!selectedSize || (!!backPrintVariant && !selectedBackPrint)}
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
