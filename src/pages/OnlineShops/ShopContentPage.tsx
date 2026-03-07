
import React from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { Shop } from '../../store';

const ShopContentPage: React.FC = () => {
    const { pageSlug } = useParams<{ pageSlug: string }>();
    const { shop } = useOutletContext<{ shop: Shop }>();

    if (!shop) return null;

    let title = '';
    let content = '';

    switch (pageSlug) {
        case 'impressum':
            title = 'Impressum';
            content = shop.impressum_text || '';
            break;
        case 'datenschutz':
            title = 'Datenschutz';
            content = shop.privacy_text || '';
            break;
        case 'ueber-uns':
            title = 'Über uns';
            content = shop.about_us_text || '';
            break;
        case 'kontakt':
            title = 'Kontakt';
            content = shop.contact_text || '';
            break;
        case 'widerrufsrecht':
            title = 'Widerrufsrecht';
            content = shop.revocation_text || '';
            break;
        case 'versand':
            title = 'Versand- und Zahlungsbedingungen';
            content = shop.shipping_info_text || '';
            break;
        case 'agb':
            title = 'AGB';
            content = shop.agb_text || '';
            break;
        default:
            return <div className="container mx-auto px-4 py-12 text-center">Seite nicht gefunden</div>;
    }

    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <h1 className="text-3xl font-bold mb-8 text-slate-900">{title}</h1>
            
            <div className="prose max-w-none text-slate-700">
                {content ? (
                    <div dangerouslySetInnerHTML={{ __html: content }} />
                ) : (
                    <p className="italic text-slate-400">Inhalt folgt.</p>
                )}
            </div>

            {pageSlug === 'kontakt' && (
                <div className="mt-12 pt-12 border-t border-slate-200">
                    <h3 className="text-xl font-bold mb-6">Kontaktformular</h3>
                    <form className="max-w-lg space-y-4" onSubmit={(e) => {
                        e.preventDefault();
                        alert('Vielen Dank für Ihre Nachricht! Wir werden uns schnellstmöglich bei Ihnen melden.');
                    }}>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Vorname</label>
                                <input type="text" required className="w-full border border-slate-300 rounded-lg p-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nachname</label>
                                <input type="text" required className="w-full border border-slate-300 rounded-lg p-2" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">E-Mail Adresse</label>
                            <input type="email" required className="w-full border border-slate-300 rounded-lg p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Betreff</label>
                            <input type="text" required className="w-full border border-slate-300 rounded-lg p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nachricht</label>
                            <textarea required className="w-full border border-slate-300 rounded-lg p-2 h-32"></textarea>
                        </div>
                        <button 
                            type="submit" 
                            className="bg-slate-900 text-white px-6 py-3 rounded-lg font-bold hover:bg-slate-800 transition-colors"
                            style={{ backgroundColor: shop.primary_color }}
                        >
                            Nachricht senden
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default ShopContentPage;
