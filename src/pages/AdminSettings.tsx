import { useState, useEffect } from "react";
import { useAppStore } from "@/store";
import { Shield, Save, RotateCcw, AlertTriangle, Upload, Eye, EyeOff, LayoutDashboard, FileText, ShoppingCart, Archive, Users, Folder, Printer, Zap, Database, Download, Image as ImageIcon, History, GitCommit, Sliders, Plus, Trash2, Edit2, X } from "lucide-react";

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders_new', label: 'Auftrag erfassen', icon: FileText },
  { id: 'orders', label: 'Aktuelle Aufträge', icon: Folder },
  { id: 'invoices', label: 'Rechnung schreiben', icon: FileText },
  { id: 'orders_finished', label: 'Fertige Aufträge', icon: Archive },
  { id: 'online_orders', label: 'Aktuelle Online Aufträge', icon: Folder },
  { id: 'online_orders_finished', label: 'Fertige Online Aufträge', icon: Archive },
  { id: 'inventory', label: 'Warenbestellung', icon: ShoppingCart },
  { id: 'dtf', label: 'DTF-Bestellen', icon: Printer },
  { id: 'dtf_pdfs', label: 'Fertige DTF PDFs', icon: FileText },
  { id: 'dtf_archive', label: 'Datei-Archiv', icon: Archive },
  { id: 'dtf_remove_bg', label: 'Freisteller', icon: ImageIcon },
  { id: 'preview_generator', label: 'Vorschau-Generator', icon: ImageIcon },
  { id: 'vector', label: 'Bildvektor', icon: Zap },
  { id: 'customers', label: 'Kundendateien', icon: Users },
];

export default function AdminSettings() {
  const orders = useAppStore((state) => state.orders);
  const loading = useAppStore((state) => state.loading);
  const fetchData = useAppStore((state) => state.fetchData);
  const updateOrder = useAppStore((state) => state.updateOrder);
  const menuSettings = useAppStore((state) => state.menuSettings);
  const updateMenuSettings = useAppStore((state) => state.updateMenuSettings);
  const logoUrl = useAppStore((state) => state.logoUrl);
  const faviconUrl = useAppStore((state) => state.faviconUrl);
  
  // --- VARIABLES LOGIC REMOVED FROM HERE ---

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [nextOrderNumber, setNextOrderNumber] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [manualNextNumber, setManualNextNumber] = useState(1);
  const [changelog, setChangelog] = useState<{hash: string, date: string, message: string}[]>([]);
  const [showChangelog, setShowChangelog] = useState(false);
  const [systemHealth, setSystemHealth] = useState<{diskUsage: string, dbSize: string, walSize: string, dataDir: string} | null>(null);
  
  // Invoice & Email Settings
  const [globalContent, setGlobalContent] = useState<any>({});
  const [emailConfig, setEmailConfig] = useState<any>({});
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [testStatus, setTestStatus] = useState<{success: boolean, message: string} | null>(null);

  const fetchGlobalSettings = async () => {
      try {
          const res1 = await fetch('/api/settings/global-content');
          const data1 = await res1.json();
          if (data1.success) setGlobalContent(data1.data || {});

          const res2 = await fetch('/api/settings/email-config');
          const data2 = await res2.json();
          if (data2.success) setEmailConfig(data2.data || {});
      } catch (e) { console.error(e); }
  };

  useEffect(() => {
      fetchGlobalSettings();
  }, []);

  const handleSaveGlobalContent = async () => {
      try {
          await fetch('/api/settings/global-content', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(globalContent)
          });
          alert('Firmendaten gespeichert!');
      } catch (e) { alert('Fehler beim Speichern'); }
  };

  const handleSaveEmailConfig = async () => {
      try {
          await fetch('/api/settings/email-config', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(emailConfig)
          });
          alert('E-Mail Einstellungen gespeichert!');
      } catch (e) { alert('Fehler beim Speichern'); }
  };

  const handleTestEmail = async () => {
      if (!testEmailAddress) {
          alert("Bitte geben Sie eine Empfänger-Adresse für den Test ein.");
          return;
      }
      
      setTestingEmail(true);
      setTestStatus(null);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

      try {
          const res = await fetch('/api/settings/email-config/test', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  ...emailConfig,
                  test_email: testEmailAddress
              }),
              signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          const data = await res.json();
          if (data.success) {
              setTestStatus({ success: true, message: data.message || 'Email gesendet!' });
          } else {
              setTestStatus({ success: false, message: data.error || 'Unbekannter Fehler' });
          }
      } catch (e: any) {
          if (e.name === 'AbortError') {
              setTestStatus({ success: false, message: "Zeitüberschreitung: Der Server antwortet nicht (Timeout 20s)." });
          } else {
              setTestStatus({ success: false, message: "Verbindungsfehler: " + e.message });
          }
      } finally {
          clearTimeout(timeoutId);
          setTestingEmail(false);
      }
  };

  const checkSystemHealth = async () => {
      try {
          const res = await fetch('/api/admin/system-health');
          const data = await res.json();
          if (data.success) {
              setSystemHealth(data);
          }
      } catch (e) {
          console.error('Failed to check system health', e);
      }
  };

  useEffect(() => {
    if (showChangelog && changelog.length === 0) {
        fetch('/api/admin/changelog')
            .then(res => res.json())
            .then(data => {
                if (data.success) setChangelog(data.logs);
            })
            .catch(err => console.error(err));
    }
  }, [showChangelog]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('logo', file);

    try {
        const res = await fetch('/api/settings/logo', { method: 'POST', body: formData });
        
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Server Status ${res.status}: ${text.substring(0, 100)}`);
        }

        const data = await res.json();
        if (data.success) {
            alert("Logo erfolgreich hochgeladen!");
            window.location.reload(); 
        } else {
            alert("Fehler: " + data.error);
        }
    } catch (err: any) {
        console.error(err);
        alert("Fehler beim Upload: " + err.message);
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('favicon', file);

    try {
        const res = await fetch('/api/settings/favicon', { method: 'POST', body: formData });
        
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Server Status ${res.status}: ${text.substring(0, 100)}`);
        }

        const data = await res.json();
        if (data.success) {
            if (data.warning) {
                alert("Warnung: " + data.warning);
            } else {
                alert("Favicon erfolgreich hochgeladen! Bitte laden Sie die Seite neu.");
                window.location.reload(); 
            }
        } else {
            alert("Fehler: " + data.error);
        }
    } catch (err: any) {
        console.error(err);
        alert("Fehler beim Upload: " + err.message);
    }
  };

  const toggleMenu = async (key: string) => {
      const isVisible = menuSettings[key] !== false;
      const updated = { ...menuSettings, [key]: !isVisible };
      await updateMenuSettings(updated);
  };

  const handleBackup = () => {
    window.location.href = '/api/backup/download';
  };

  // Calculate current max number
  useEffect(() => {
    const prefix = `${currentYear}-`;
    const currentYearOrders = orders.filter(o => 
        (o.orderNumber && o.orderNumber.startsWith(prefix))
    );

    let maxNum = 0;
    currentYearOrders.forEach(o => {
        if (o.orderNumber && o.orderNumber.startsWith(prefix)) {
            const numPart = parseInt(o.orderNumber.split('-')[1]);
            if (!isNaN(numPart) && numPart > maxNum) {
                maxNum = numPart;
            }
        }
    });

    setNextOrderNumber(maxNum + 1);
    if (!isEditing) {
        setManualNextNumber(maxNum + 1);
    }
  }, [orders, currentYear, isEditing]);

  const handleSaveCounter = async () => {
    // To "set" the counter, we essentially need to ensure the NEXT order picks this up.
    // Our logic in NewOrder.tsx calculates MAX + 1.
    // So to force the next number to be X, we need a dummy order with number X-1?
    // OR we change the logic in NewOrder to look at a setting?
    // BUT the user asked to "edit the number circle".
    // Since our logic is "Max + 1", we can't easily "reset" it to a lower number if higher numbers exist without deleting them.
    // However, we CAN create a "placeholder" system setting if we had a settings table.
    // BUT we don't have a settings table yet.
    
    // Alternative: We create a dummy order with the number (X-1) so the next one is X.
    // But that's messy.
    
    // Better approach: Since I cannot change the "Max+1" logic without a persistent storage for "Next Number",
    // I will explain to the user how it works: It always takes the highest number.
    // If they want to INCREASE it, we can create a dummy placeholder order? No.
    
    // Actually, maybe we should just create a settings table?
    // Or just let them know they can't change it easily downwards?
    
    // Wait, if they want to START at 1000 for example:
    // We can create a hidden "seed" order with number "2024-0999" so the next is "2024-1000".
    
    if (manualNextNumber <= nextOrderNumber && manualNextNumber !== 1) {
        // Allow resetting to 1 if user explicitly wants to restart (e.g. new year or clean slate)
        // But warn them if higher numbers exist
        if (!confirm(`Die gewählte Nummer (${manualNextNumber}) ist kleiner oder gleich der nächsten freien Nummer (${nextOrderNumber}).\n\nACHTUNG: Wenn Sie fortfahren, versucht das System, ALLE existierenden Aufträge (auch archivierte) des Jahres ${currentYear}, die eine höhere oder gleiche Nummer haben, zu löschen!\n\nDies ist notwendig, um den Zähler zurückzusetzen. Sind Sie sicher?`)) {
            return;
        }
    }
    
    if (confirm(`Möchten Sie den Nummernkreis wirklich auf ${manualNextNumber} setzen?`)) {
        
        // If resetting downwards, we MUST delete higher number orders
        if (manualNextNumber < nextOrderNumber) {
             const prefix = `${currentYear}-`;
             const ordersToDelete = orders.filter(o => {
                 if (o.orderNumber && o.orderNumber.startsWith(prefix)) {
                     const numPart = parseInt(o.orderNumber.split('-')[1]);
                     // Delete everything that is >= the new start number
                     // Example: Next is 10. We want to start at 1.
                     // We must delete 1, 2, ..., 9? NO.
                     // Wait. If we want next to be 1.
                     // We need to delete everything >= 1.
                     return !isNaN(numPart) && numPart >= manualNextNumber;
                 }
                 return false;
             });

             if (ordersToDelete.length > 0) {
                 console.log("Deleting orders to reset counter:", ordersToDelete.map(o => o.orderNumber));
                 // Delete them one by one via API
                 // We need a real DELETE endpoint in backend, but currently DELETE just archives.
                 // We need a HARD DELETE.
                 // Let's assume we implement a hard delete or just accept that "Archive" isn't enough.
                 // Actually, if we just Archive, they still exist and block the number.
                 // We need to Nuke them.
                 
                 // Since we don't have a bulk hard delete, let's try to update their order numbers to something else?
                 // e.g. "DELETED-YYYY-XXXX" so they don't block the sequence.
                 
                 for (const order of ordersToDelete) {
                     await updateOrder(order.id, { 
                         orderNumber: `DEL-${order.orderNumber}-${Date.now()}`,
                         status: 'archived'
                     });
                 }
             }
        }

        // Create placeholder order
        const seedNumber = manualNextNumber - 1;
        const seedOrderNumber = `${currentYear}-${String(seedNumber).padStart(4, '0')}`;
        
        await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: `seed-${seedOrderNumber}-${Date.now()}`, // Unique ID to allow multiple attempts/overwrites
                title: 'System-Platzhalter für Nummernkreis',
                order_number: seedOrderNumber,
                customer_name: 'System',
                status: 'archived', // Hidden
                deadline: new Date().toISOString(),
                description: 'Dieser Auftrag dient nur dazu, den Nummernkreis zu definieren. Bitte nicht löschen, solange keine höheren Nummern existieren.',
                files: [],
                employees: []
            })
        });
        
        // Force refresh
        await fetchData();
        setIsEditing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
        <Shield className="mr-2 text-red-600" />
        Admin Einstellungen
      </h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2">Logo & Branding</h2>
        
        {/* Main Logo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center mb-8 border-b pb-8">
            <div>
                <h3 className="font-medium text-slate-800 mb-2">Firmenlogo (Header & Login)</h3>
                <p className="text-sm text-gray-600 mb-4">
                    Wird oben rechts auf der Seite und im Login-Bereich angezeigt.
                    <br/><span className="text-xs text-gray-400">Empfohlen: PNG mit transparentem Hintergrund.</span>
                </p>
                <label className="inline-block bg-white border border-gray-300 text-slate-700 px-4 py-2 rounded shadow-sm hover:bg-gray-50 cursor-pointer">
                    <span className="flex items-center"><Upload size={16} className="mr-2"/> Logo hochladen</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </label>
            </div>
            <div className="flex justify-center bg-gray-50 p-6 rounded border border-gray-200 h-32 items-center">
                {logoUrl ? (
                    <img src={logoUrl} alt="Firmenlogo" className="max-h-full object-contain" />
                ) : (
                    <div className="text-gray-400 text-sm italic">Kein Logo vorhanden</div>
                )}
            </div>
        </div>

        {/* Favicon */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
                <h3 className="font-medium text-slate-800 mb-2">Favicon / App Icon (Rund)</h3>
                <p className="text-sm text-gray-600 mb-4">
                    Wird im Browser-Tab und als App-Icon auf dem Home-Screen verwendet.
                    <br/><span className="text-xs text-gray-400">Empfohlen: Rundes PNG, quadratisch zugeschnitten.</span>
                </p>
                <label className="inline-block bg-white border border-gray-300 text-slate-700 px-4 py-2 rounded shadow-sm hover:bg-gray-50 cursor-pointer">
                    <span className="flex items-center"><Upload size={16} className="mr-2"/> Icon hochladen</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFaviconUpload} />
                </label>
            </div>
            <div className="flex justify-center bg-gray-50 p-6 rounded border border-gray-200 h-32 items-center">
                {faviconUrl ? (
                    <div className="w-16 h-16 rounded-full overflow-hidden border bg-white shadow-sm">
                        <img src={faviconUrl} alt="Favicon" className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <div className="text-gray-400 text-sm italic">Kein Icon vorhanden</div>
                )}
            </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2">Auftragsnummern</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <p className="text-sm text-gray-600 mb-4">
                    Hier können Sie den Nummernkreis für Aufträge verwalten.
                    Das System vergibt Nummern automatisch im Format <strong>YYYY-XXXX</strong> (z.B. {currentYear}-0001).
                </p>
                
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Aktuelles Jahr:</span>
                        <span className="text-sm font-bold">{currentYear}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Nächste Auftragsnummer:</span>
                        <span className="text-lg font-bold text-red-600">
                            {currentYear}-{String(isEditing ? manualNextNumber : nextOrderNumber).padStart(4, '0')}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col justify-center">
                {!isEditing ? (
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="bg-white border border-gray-300 text-slate-700 px-4 py-2 rounded shadow-sm hover:bg-gray-50 flex items-center justify-center"
                    >
                        <Save size={16} className="mr-2" />
                        Nummernkreis anpassen
                    </button>
                ) : (
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <label className="block text-xs font-bold text-yellow-800 mb-2 uppercase">Nächste Laufnummer setzen</label>
                        <div className="flex space-x-2 mb-3">
                            <input 
                                type="number" 
                                className="flex-1 border-yellow-300 rounded p-2 text-sm focus:ring-yellow-500 focus:border-yellow-500"
                                value={manualNextNumber}
                                onChange={(e) => setManualNextNumber(parseInt(e.target.value) || 1)}
                                min={1}
                            />
                        </div>
                        <div className="flex space-x-2">
                            <button 
                                onClick={handleSaveCounter}
                                className="flex-1 bg-yellow-600 text-white px-3 py-2 rounded text-sm hover:bg-yellow-700"
                            >
                                Speichern
                            </button>
                            <button 
                                onClick={() => { setIsEditing(false); setManualNextNumber(nextOrderNumber); }}
                                className="px-3 py-2 text-yellow-700 hover:bg-yellow-100 rounded"
                            >
                                <RotateCcw size={18} />
                            </button>
                        </div>
                        <div className="mt-3 flex items-start text-xs text-yellow-700">
                            <AlertTriangle size={12} className="mr-1 mt-0.5 shrink-0" />
                            <p>Achtung: Das Hochsetzen erstellt einen unsichtbaren Platzhalter-Auftrag. Ein Zurücksetzen ist nur durch Löschen der Aufträge möglich.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2 flex items-center">
            <FileText size={20} className="mr-2" />
            Rechnung & E-Mail Einstellungen
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Company Info */}
            <div>
                <h3 className="font-bold text-slate-800 mb-4">Firmendaten (für Rechnungsfuß)</h3>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Firmenname</label>
                        <input 
                            type="text" className="w-full border border-gray-300 rounded p-2 text-sm"
                            value={globalContent.company_name || ''}
                            onChange={(e) => setGlobalContent({ ...globalContent, company_name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Anschrift (Komplett)</label>
                        <textarea 
                            className="w-full border border-gray-300 rounded p-2 text-sm h-20"
                            value={globalContent.company_address || ''}
                            onChange={(e) => setGlobalContent({ ...globalContent, company_address: e.target.value })}
                            placeholder="Musterstraße 1, 12345 Musterstadt"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Geschäftsführer</label>
                        <input 
                            type="text" className="w-full border border-gray-300 rounded p-2 text-sm"
                            value={globalContent.ceo_name || ''}
                            onChange={(e) => setGlobalContent({ ...globalContent, ceo_name: e.target.value })}
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Steuernummer</label>
                            <input 
                                type="text" className="w-full border border-gray-300 rounded p-2 text-sm"
                                value={globalContent.tax_number || ''}
                                onChange={(e) => setGlobalContent({ ...globalContent, tax_number: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">USt-IdNr.</label>
                            <input 
                                type="text" className="w-full border border-gray-300 rounded p-2 text-sm"
                                value={globalContent.vat_id || ''}
                                onChange={(e) => setGlobalContent({ ...globalContent, vat_id: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700">Gerichtsstand / HRB</label>
                        <input 
                            type="text" className="w-full border border-gray-300 rounded p-2 text-sm"
                            value={globalContent.commercial_register || ''}
                            onChange={(e) => setGlobalContent({ ...globalContent, commercial_register: e.target.value })}
                        />
                    </div>

                    <h4 className="font-bold text-slate-800 mt-4 mb-2">Bankverbindung</h4>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Bankname</label>
                        <input 
                            type="text" className="w-full border border-gray-300 rounded p-2 text-sm"
                            value={globalContent.bank_name || ''}
                            onChange={(e) => setGlobalContent({ ...globalContent, bank_name: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">IBAN</label>
                            <input 
                                type="text" className="w-full border border-gray-300 rounded p-2 text-sm"
                                value={globalContent.bank_iban || ''}
                                onChange={(e) => setGlobalContent({ ...globalContent, bank_iban: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">BIC</label>
                            <input 
                                type="text" className="w-full border border-gray-300 rounded p-2 text-sm"
                                value={globalContent.bank_bic || ''}
                                onChange={(e) => setGlobalContent({ ...globalContent, bank_bic: e.target.value })}
                            />
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleSaveGlobalContent}
                        className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 mt-2"
                    >
                        Firmendaten speichern
                    </button>
                </div>
            </div>

            {/* Email Config */}
            <div>
                <h3 className="font-bold text-slate-800 mb-4">E-Mail Versand (SMTP)</h3>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Absender Name</label>
                        <input 
                            type="text" className="w-full border border-gray-300 rounded p-2 text-sm"
                            value={emailConfig.sender_name || ''}
                            onChange={(e) => setEmailConfig({ ...emailConfig, sender_name: e.target.value })}
                            placeholder="Main Textildruck"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Absender E-Mail</label>
                        <input 
                            type="email" className="w-full border border-gray-300 rounded p-2 text-sm"
                            value={emailConfig.sender_email || ''}
                            onChange={(e) => setEmailConfig({ ...emailConfig, sender_email: e.target.value })}
                            placeholder="info@maintextildruck.com"
                        />
                    </div>

                    <div className="border-t border-slate-200 my-3 pt-3"></div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700">SMTP Host</label>
                        <input 
                            type="text" className="w-full border border-gray-300 rounded p-2 text-sm"
                            value={emailConfig.smtp_host || ''}
                            onChange={(e) => setEmailConfig({ ...emailConfig, smtp_host: e.target.value })}
                            placeholder="smtp.example.com"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">SMTP Port</label>
                            <input 
                                type="number" className="w-full border border-gray-300 rounded p-2 text-sm"
                                value={emailConfig.smtp_port || ''}
                                onChange={(e) => setEmailConfig({ ...emailConfig, smtp_port: parseInt(e.target.value) })}
                                placeholder="587"
                            />
                        </div>
                        <div className="flex items-center pt-6">
                            <input 
                                type="checkbox" id="smtp_secure"
                                className="mr-2"
                                checked={!!emailConfig.smtp_secure}
                                onChange={(e) => setEmailConfig({ ...emailConfig, smtp_secure: e.target.checked })}
                            />
                            <label htmlFor="smtp_secure" className="text-sm font-medium text-slate-700">Secure (SSL/TLS)</label>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">SMTP Benutzer</label>
                        <input 
                            type="text" className="w-full border border-gray-300 rounded p-2 text-sm"
                            value={emailConfig.smtp_user || ''}
                            onChange={(e) => setEmailConfig({ ...emailConfig, smtp_user: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">SMTP Passwort</label>
                        <input 
                            type="password" className="w-full border border-gray-300 rounded p-2 text-sm"
                            value={emailConfig.smtp_pass || ''}
                            onChange={(e) => setEmailConfig({ ...emailConfig, smtp_pass: e.target.value })}
                        />
                    </div>

                    <div className="bg-slate-100 p-3 rounded border border-slate-200 mt-4">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Verbindung testen</label>
                        <div className="flex space-x-2">
                            <input 
                                type="email" 
                                className="flex-1 border border-gray-300 rounded p-2 text-sm"
                                placeholder="Empfänger für Test-Email (z.B. Ihre Adresse)"
                                value={testEmailAddress}
                                onChange={(e) => setTestEmailAddress(e.target.value)}
                            />
                            <button 
                                onClick={handleTestEmail}
                                disabled={testingEmail}
                                className="bg-slate-600 text-white px-3 py-2 rounded text-sm hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap"
                            >
                                {testingEmail ? 'Sende...' : 'Test Senden'}
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Sendet eine Test-Email mit den oben eingegebenen Einstellungen (auch ohne Speichern).</p>
                        
                        {testStatus && (
                            <div className={`mt-3 p-2 rounded text-sm ${testStatus.success ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                                <strong>{testStatus.success ? 'Erfolg:' : 'Fehler:'}</strong> {testStatus.message}
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={handleSaveEmailConfig}
                        className="bg-slate-800 text-white px-4 py-2 rounded text-sm hover:bg-slate-900 mt-2 w-full"
                    >
                        E-Mail Einstellungen speichern
                    </button>
                </div>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2 flex items-center">
            <Database size={20} className="mr-2" />
            System Wartung & Backup
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <h3 className="font-medium text-slate-800 mb-2">System Backup</h3>
                <p className="text-sm text-gray-600 mb-4">
                    Erstellen Sie ein vollständiges Backup aller Daten (Datenbank, Uploads, Downloads).
                    Das Archiv kann bei einem Serverwechsel einfach wiederhergestellt werden.
                </p>
                <button 
                    onClick={handleBackup}
                    className="bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-900 flex items-center"
                >
                    <Download size={16} className="mr-2" />
                    Backup herunterladen (.tar.gz)
                </button>
            </div>

            <div>
                <h3 className="font-medium text-slate-800 mb-2">Bilder optimieren</h3>
                <p className="text-sm text-gray-600 mb-4">
                    Generiert fehlende Vorschaubilder (Thumbnails) für alle hochgeladenen Dateien (PDF, JPG, PNG). 
                    Dies verbessert die Ladezeit der Artikelansicht erheblich.
                </p>
                <button 
                    onClick={async () => {
                        if (confirm('Möchten Sie die Vorschaubilder jetzt neu generieren? Dies kann je nach Anzahl der Dateien einige Minuten dauern.')) {
                            try {
                                const btn = document.getElementById('regen-btn');
                                if (btn) { btn.innerText = 'Wird verarbeitet...'; (btn as HTMLButtonElement).disabled = true; }
                                
                                const res = await fetch('/api/upload/regenerate-thumbnails?force=true', { method: 'POST' });
                                const data = await res.json();
                                
                                if (data.success) {
                                    alert(`Erfolgreich! ${data.updated} Dateien aktualisiert (von ${data.ordersFound} Aufträgen).`);
                                } else {
                                    alert('Fehler: ' + data.error);
                                }
                            } catch (e: any) {
                                alert('Fehler: ' + e.message);
                            } finally {
                                const btn = document.getElementById('regen-btn');
                                if (btn) { btn.innerText = 'Vorschaubilder generieren'; (btn as HTMLButtonElement).disabled = false; }
                            }
                        }
                    }}
                    id="regen-btn"
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center"
                >
                    <ImageIcon size={16} className="mr-2" />
                    Vorschaubilder generieren
                </button>
            </div>

            <div>
                <h3 className="font-medium text-slate-800 mb-2">Datenbank Bereinigung</h3>
                <p className="text-sm text-gray-600 mb-4">
                    Entfernt doppelte Dateizuweisungen bei Kunden-Artikeln (z.B. durch Mehrfach-Importe).
                </p>
                <button 
                    onClick={async () => {
                        if (confirm('Möchten Sie die Datenbank jetzt bereinigen?')) {
                            try {
                                const res = await fetch('/api/admin/cleanup-product-files', { method: 'POST' });
                                const data = await res.json();
                                if (data.success) {
                                    alert(data.message);
                                } else {
                                    alert('Fehler: ' + data.error);
                                }
                            } catch (e: any) {
                                alert('Netzwerkfehler: ' + e.message);
                            }
                        }
                    }}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 flex items-center"
                >
                    <Database size={16} className="mr-2" />
                    Doppelte Dateien löschen
                </button>
            </div>
        </div>

        <div className="mt-8 border-t pt-6">
            <h3 className="font-medium text-slate-800 mb-2 flex items-center justify-between">
                <span>System Status & Speicherplatz</span>
                <button 
                    onClick={checkSystemHealth}
                    className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded hover:bg-slate-200"
                >
                    Status prüfen
                </button>
            </h3>
            
            {systemHealth ? (
                <div className="bg-slate-50 p-4 rounded text-xs font-mono text-slate-700 overflow-x-auto">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-white p-2 rounded border border-slate-200">
                            <span className="block text-slate-400 mb-1">Datenbank Größe:</span>
                            <span className="text-lg font-bold text-slate-800">{systemHealth.dbSize}</span>
                        </div>
                        <div className="bg-white p-2 rounded border border-slate-200">
                            <span className="block text-slate-400 mb-1">WAL (Temp) Größe:</span>
                            <span className="text-lg font-bold text-slate-800">{systemHealth.walSize}</span>
                        </div>
                    </div>
                    
                    <div className="mb-2 font-bold text-slate-500 uppercase">Disk Usage (Server):</div>
                    <pre className="whitespace-pre-wrap bg-white p-2 rounded border border-slate-200">
                        {systemHealth.diskUsage}
                    </pre>
                </div>
            ) : (
                <p className="text-sm text-gray-500 italic">Klicken Sie auf "Status prüfen", um die aktuelle Speicherauslastung anzuzeigen.</p>
            )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2 flex items-center justify-between">
            <div className="flex items-center">
                <History size={20} className="mr-2" />
                System Änderungsprotokoll
            </div>
            <button 
                onClick={() => setShowChangelog(!showChangelog)}
                className="text-sm text-blue-600 hover:text-blue-800"
            >
                {showChangelog ? 'Verbergen' : 'Anzeigen'}
            </button>
        </h2>
        
        {showChangelog && (
            <div className="bg-slate-50 rounded border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                            <tr>
                                <th className="p-3 w-32">Datum</th>
                                <th className="p-3">Änderung</th>
                                <th className="p-3 w-24">Hash</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {changelog.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="p-4 text-center text-gray-500">Lade Protokoll...</td>
                                </tr>
                            ) : (
                                changelog.map((log) => (
                                    <tr key={log.hash} className="hover:bg-white transition-colors">
                                        <td className="p-3 text-gray-600 whitespace-nowrap">{log.date}</td>
                                        <td className="p-3 font-medium text-slate-800">{log.message}</td>
                                        <td className="p-3 font-mono text-xs text-gray-400">{log.hash}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2">Menü-Verwaltung</h2>
        <p className="text-sm text-gray-600 mb-4">
            Deaktivieren Sie Menüpunkte, die für normale Mitarbeiter ausgeblendet werden sollen.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MENU_ITEMS.map(item => {
                const isVisible = menuSettings[item.id] !== false;
                const Icon = item.icon;
                return (
                    <div key={item.id} className={`flex items-center justify-between p-3 rounded border ${isVisible ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300 opacity-75'}`}>
                        <div className="flex items-center space-x-3">
                            <span className="text-gray-500"><Icon size={20} /></span>
                            <span className={`font-medium ${isVisible ? 'text-gray-800' : 'text-gray-500'}`}>{item.label}</span>
                        </div>
                        <button 
                            onClick={() => toggleMenu(item.id)}
                            className={`p-2 rounded-full transition-colors ${isVisible ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-200'}`}
                            title={isVisible ? "Sichtbar" : "Versteckt"}
                        >
                            {isVisible ? <Eye size={20} /> : <EyeOff size={20} />}
                        </button>
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
}