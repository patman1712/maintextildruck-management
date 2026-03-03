
import React, { useEffect, useState } from 'react';
import { useOutletContext, useParams, Link } from 'react-router-dom';
import { ShoppingCart, Heart, ChevronRight, Info, Plus, Minus, Check } from 'lucide-react';
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
  const [quantity, setQuantity] = useState(1);
  const [personalization, setPersonalization] = useState({
    print: 'none', // none, own_name, player_name, club
    logo: [] as string[],
    ownName: '',
    ownNumber: ''
  });

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
  
  // Derived state (needs to be here because product is null initially)
  const availableSizes = product.size 
    ? product.size.split(',').map((s: string) => s.trim()) 
    : ['S', 'M', 'L', 'XL', 'XXL'];

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
                <div className="text-2xl font-bold">€ {product.price > 0 ? product.price.toFixed(2) : '29.95'}</div>
                <div className="text-xs text-slate-500">inkl. MwSt. zzgl. Versandkosten</div>
            </div>

            {/* Size Selection */}
            <div className="mb-8">
                <div className="flex justify-between mb-2">
                    <label className="font-bold text-sm uppercase">Grösse:</label>
                    <button className="text-xs text-slate-500 underline hover:text-slate-800">Grössentabelle</button>
                </div>
                <select 
                    className="w-full border border-slate-300 rounded p-3 text-sm focus:ring-2 focus:ring-slate-500 outline-none"
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
            {isPersonalizationEnabled && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8">
                    <h3 className="font-bold text-blue-900 flex items-center mb-4">
                        PERSONALISIERE DEIN TRIKOT <span className="ml-2 text-xs">✨</span>
                    </h3>
                    
                    <div className="mb-4">
                        <label className="text-xs font-bold uppercase mb-2 block">Print:</label>
                        <div className="grid grid-cols-4 gap-2">
                            <button 
                                className={`border rounded p-2 text-center hover:border-blue-500 bg-white ${personalization.print === 'none' ? 'border-blue-600 ring-1 ring-blue-600' : 'border-slate-200'}`}
                                onClick={() => setPersonalization({...personalization, print: 'none'})}
                            >
                                <div className="text-2xl mb-1">👕</div>
                                <div className="text-[10px] font-bold">Ohne</div>
                                <div className="text-[10px] text-slate-500">+ € 0,00</div>
                            </button>
                            <button 
                                className={`border rounded p-2 text-center hover:border-blue-500 bg-white ${personalization.print === 'own_name' ? 'border-blue-600 ring-1 ring-blue-600' : 'border-slate-200'}`}
                                onClick={() => setPersonalization({...personalization, print: 'own_name'})}
                            >
                                <div className="text-2xl mb-1">👤</div>
                                <div className="text-[10px] font-bold">Eigener Name</div>
                                <div className="text-[10px] text-slate-500">+ € 15,00</div>
                            </button>
                            {/* Disabled options for now */}
                            <button className="border border-slate-200 rounded p-2 text-center hover:border-blue-500 bg-white opacity-50 cursor-not-allowed">
                                <div className="text-2xl mb-1">⚽</div>
                                <div className="text-[10px] font-bold">Spielername</div>
                                <div className="text-[10px] text-slate-500">+ € 12,50</div>
                            </button>
                            <button className="border border-slate-200 rounded p-2 text-center hover:border-blue-500 bg-white opacity-50 cursor-not-allowed">
                                <div className="text-2xl mb-1">🛡️</div>
                                <div className="text-[10px] font-bold">Verein</div>
                                <div className="text-[10px] text-slate-500">+ € 7,50</div>
                            </button>
                        </div>
                    </div>

                    {personalization.print === 'own_name' && (
                        <div className="mb-4 space-y-2 animate-in fade-in slide-in-from-top-2">
                            <input 
                                type="text" 
                                placeholder="Name (max. 12 Zeichen)" 
                                className="w-full border border-slate-300 rounded p-2 text-sm"
                                maxLength={12}
                                value={personalization.ownName}
                                onChange={(e) => setPersonalization({...personalization, ownName: e.target.value})}
                            />
                            <input 
                                type="number" 
                                placeholder="Nummer (0-99)" 
                                className="w-full border border-slate-300 rounded p-2 text-sm"
                                max={99}
                                value={personalization.ownNumber}
                                onChange={(e) => setPersonalization({...personalization, ownNumber: e.target.value})}
                            />
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-bold uppercase mb-2 block">Logo:</label>
                        <div className="grid grid-cols-2 gap-2">
                            {/* Example logos, these could also be dynamic later */}
                            <button 
                                className={`border rounded p-2 text-center hover:border-blue-500 bg-white flex items-center justify-center space-x-2 ${personalization.logo.includes('sc') ? 'border-blue-600 ring-1 ring-blue-600' : 'border-slate-200'}`}
                                onClick={() => {
                                    const newLogos = personalization.logo.includes('sc') 
                                        ? personalization.logo.filter(l => l !== 'sc') 
                                        : [...personalization.logo, 'sc'];
                                    setPersonalization({...personalization, logo: newLogos});
                                }}
                            >
                                <span className="text-lg">🛡️</span>
                                <div className="text-left">
                                    <div className="text-[10px] font-bold">SC-Logo</div>
                                    <div className="text-[10px] text-slate-500">+ € 4,00</div>
                                </div>
                            </button>
                            <button 
                                className={`border rounded p-2 text-center hover:border-blue-500 bg-white flex items-center justify-center space-x-2 ${personalization.logo.includes('dfl') ? 'border-blue-600 ring-1 ring-blue-600' : 'border-slate-200'}`}
                                onClick={() => {
                                    const newLogos = personalization.logo.includes('dfl') 
                                        ? personalization.logo.filter(l => l !== 'dfl') 
                                        : [...personalization.logo, 'dfl'];
                                    setPersonalization({...personalization, logo: newLogos});
                                }}
                            >
                                <span className="text-lg">🏆</span>
                                <div className="text-left">
                                    <div className="text-[10px] font-bold">Liga-Logo</div>
                                    <div className="text-[10px] text-slate-500">+ € 4,00</div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Total Price */}
            <div className="mb-6">
                <div className="text-xs font-bold uppercase text-slate-500 mb-1">Gesamtpreis:</div>
                <div className="text-3xl font-bold">€ {(
                    (product.price > 0 ? product.price : 29.95) + 
                    (personalization.print === 'own_name' ? 15 : 0) +
                    (personalization.logo.length * 4)
                ).toFixed(2)}</div>
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
