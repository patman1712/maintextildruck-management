
import React, { useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { Shop } from '../../store';
import { ShopTemplate } from './template/templateEngine';

interface ShopContext {
    shop: Shop;
    template?: any;
    customTemplateActive?: boolean;
    templateContext?: Record<string, any>;
}

const EMPTY_CONTACT_FORM = { firstName: '', lastName: '', email: '', subject: '', message: '' };

const ShopContentPage: React.FC = () => {
    const { pageSlug } = useParams<{ pageSlug: string }>();
    const { shop, template, customTemplateActive, templateContext } = useOutletContext<ShopContext>();

    const [contactForm, setContactForm] = useState({ ...EMPTY_CONTACT_FORM });
    const [contactSending, setContactSending] = useState(false);
    const [contactStatus, setContactStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    if (!shop) return null;

    const handleContactSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setContactSending(true);
        setContactStatus(null);
        try {
            const res = await fetch(`/api/shops/${shop.id}/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(contactForm),
            });
            const data = await res.json().catch(() => ({} as any));
            if (res.ok && data.success) {
                setContactStatus({ type: 'success', text: 'Vielen Dank für Ihre Nachricht! Wir melden uns schnellstmöglich bei Ihnen.' });
                setContactForm({ ...EMPTY_CONTACT_FORM });
            } else {
                setContactStatus({ type: 'error', text: data.error || 'Die Nachricht konnte nicht gesendet werden.' });
            }
        } catch {
            setContactStatus({ type: 'error', text: 'Die Nachricht konnte nicht gesendet werden. Bitte prüfen Sie Ihre Verbindung.' });
        } finally {
            setContactSending(false);
        }
    };

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

    const standardBody = (
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
                    <form className="max-w-lg space-y-4" onSubmit={handleContactSubmit}>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Vorname</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full border border-slate-300 rounded-lg p-2"
                                    value={contactForm.firstName}
                                    onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nachname</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full border border-slate-300 rounded-lg p-2"
                                    value={contactForm.lastName}
                                    onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">E-Mail Adresse</label>
                            <input
                                type="email"
                                required
                                className="w-full border border-slate-300 rounded-lg p-2"
                                value={contactForm.email}
                                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Betreff</label>
                            <input
                                type="text"
                                required
                                className="w-full border border-slate-300 rounded-lg p-2"
                                value={contactForm.subject}
                                onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nachricht</label>
                            <textarea
                                required
                                className="w-full border border-slate-300 rounded-lg p-2 h-32"
                                value={contactForm.message}
                                onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                            ></textarea>
                        </div>

                        {contactStatus && (
                            <div className={`rounded-lg p-3 text-sm ${contactStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                {contactStatus.text}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={contactSending}
                            className="bg-slate-900 text-white px-6 py-3 rounded-lg font-bold hover:bg-slate-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{ backgroundColor: shop.primary_color }}
                        >
                            {contactSending ? 'Wird gesendet…' : 'Nachricht senden'}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );

    const pageContext = {
        ...(templateContext || {}),
        content_title: title,
        content_slug: pageSlug || '',
        content_body: content,
    };

    if (customTemplateActive && template?.blocks?.['content']) {
        return (
            <ShopTemplate
                template={template}
                page="content"
                context={pageContext}
                widgets={{ content: standardBody }}
                fallback={standardBody}
            />
        );
    }

    return standardBody;
};

export default ShopContentPage;
