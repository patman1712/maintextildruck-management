import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store";
import { 
    ArrowLeft, Calendar, User, FileText, Image as ImageIcon, 
    CheckCircle, AlertCircle, Phone, Mail, MapPin, Printer, PenTool, 
    X, Info, Clock, Download
} from "lucide-react";

export default function InternalOrderView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const orders = useAppStore((state) => state.orders);
  const loading = useAppStore((state) => state.loading);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const order = orders.find(o => o.id === id);
  const items = order?.orderItems || [];
  const allOrderFiles = order?.files || [];

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const findFileById = (fileId: string): any | null => {
    if (!fileId) return null;
    const cleanId = fileId.split(/[:,\s]/)[0].trim();
    return allOrderFiles.find(f => (f as any).id === cleanId || (f as any).reference === cleanId || f.url === cleanId || f.name === cleanId) || null;
  };

  const extractFileFromNotes = (notes?: string): { file: any | null; remainingText: string } => {
    if (!notes) return { file: null, remainingText: '' };
    const parts = notes.split(/[\s,;]+/).filter(Boolean);
    let foundFile: any | null = null;
    let remaining: string[] = [];
    for (const part of parts) {
      const clean = part.replace(/[:.]$/, '').trim();
      const isLikelyFileId = UUID_REGEX.test(clean) || (clean.length >= 20 && /^[a-z0-9-]+$/i.test(clean));
      const matched = isLikelyFileId ? findFileById(clean) : null;
      if (matched && !foundFile) {
        foundFile = matched;
      } else {
        remaining.push(part);
      }
    }
    return { file: foundFile, remainingText: remaining.join(' ').trim() };
  };

  const getFileBadgeColor = (type?: string) => {
    switch (type) {
      case 'print': return 'bg-red-500';
      case 'vector': return 'bg-purple-500';
      case 'preview': return 'bg-blue-500';
      case 'internal': return 'bg-orange-500';
      case 'photoshop': return 'bg-indigo-500';
      default: return 'bg-gray-500';
    }
  };

  const getFileBadgeLabel = (type?: string) => {
    switch (type) {
      case 'print': return 'DRUCK';
      case 'vector': return 'VEKTOR';
      case 'preview': return 'VORSCHAU';
      case 'internal': return 'INTERN';
      case 'photoshop': return 'PSD';
      default: return 'DATEI';
    }
  };

  if (loading && !order) return <div className="p-8 text-center text-gray-500">Lade Auftrag...</div>;
  if (!order) return <div className="p-8 text-center text-red-600">Auftrag nicht gefunden.</div>;

  const displayFiles = allOrderFiles.filter(f => {
    if (!f) return false;
    return true;
  });
  const printFilesCount = allOrderFiles.filter(f => f.type === 'print' || f.type === 'vector').length;
  const visualFilesCount = allOrderFiles.filter(f => f.type === 'preview' || f.type === 'internal').length;

  return (
    <div className="min-h-screen bg-gray-100 font-sans pb-12">
      {/* Top Bar (Sticky) */}
      <div className="bg-slate-900 text-white sticky top-0 z-10 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center">
                <button 
                    onClick={() => navigate(-1)}
                    className="mr-4 p-2 hover:bg-slate-800 rounded-full transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-lg font-bold flex items-center">
                        <span className="mr-2">Auftrag {order.orderNumber || order.title}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${
                            order.status === 'active' ? 'bg-green-500 text-white' : 
                            order.status === 'completed' ? 'bg-gray-500 text-gray-200' : 'bg-red-500 text-white'
                        }`}>
                            {order.status === 'active' ? 'Aktiv' : order.status === 'completed' ? 'Fertig' : 'Storniert'}
                        </span>
                    </h1>
                    <p className="text-slate-400 text-xs">{order.customerName}</p>
                </div>
            </div>
            <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center" title="Deadline">
                    <Calendar size={16} className="mr-1.5 text-red-400" />
                    <span className="font-mono font-bold text-red-100">
                        {new Date(order.deadline).toLocaleDateString('de-DE')}
                    </span>
                </div>
            </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        
        {/* Customer & Order Details Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-bold text-gray-700 flex items-center">
                    <User size={18} className="mr-2 text-blue-600" />
                    Kunde & Auftrag
                </h3>
                <span className="text-xs text-gray-400">Erstellt: {new Date(order.createdAt).toLocaleDateString('de-DE')}</span>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">Kunde / Firma</label>
                        <p className="font-medium text-lg text-gray-900">{order.customerName}</p>
                    </div>
                    {order.customerContactPerson && (
                        <div className="flex items-center text-gray-600 text-sm">
                            <User size={14} className="mr-2" /> {order.customerContactPerson}
                        </div>
                    )}
                    {(order.customerEmail || order.customerPhone) && (
                        <div className="flex flex-col gap-1 text-sm text-gray-600">
                            {order.customerEmail && (
                                <a href={`mailto:${order.customerEmail}`} className="flex items-center hover:text-blue-600">
                                    <Mail size={14} className="mr-2" /> {order.customerEmail}
                                </a>
                            )}
                            {order.customerPhone && (
                                <a href={`tel:${order.customerPhone}`} className="flex items-center hover:text-blue-600">
                                    <Phone size={14} className="mr-2" /> {order.customerPhone}
                                </a>
                            )}
                        </div>
                    )}
                    {order.customerAddress && (
                        <div className="flex items-start text-sm text-gray-600">
                            <MapPin size={14} className="mr-2 mt-0.5 shrink-0" />
                            <span className="whitespace-pre-line">{order.customerAddress}</span>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">Auftragsbeschreibung</label>
                        {order.description ? (
                            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-sm text-gray-800 whitespace-pre-wrap mt-1">
                                {order.description}
                            </div>
                        ) : (
                            <p className="text-gray-400 italic text-sm mt-1">Keine Beschreibung.</p>
                        )}
                    </div>
                    
                    {/* Employees */}
                    {order.employees && order.employees.length > 0 && (
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Bearbeiter</label>
                            <div className="flex gap-2">
                                {order.employees.map((emp, i) => (
                                    <span key={i} className="px-2 py-1 bg-gray-100 rounded text-xs font-medium text-gray-700 border border-gray-200">
                                        {emp}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Visuals / Internal Images + Druckdaten */}
        {displayFiles.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-700 flex items-center">
                <ImageIcon size={18} className="mr-2 text-purple-600" />
                Alle Dateien & Druckdaten
              </h3>
              <div className="flex gap-2 text-xs">
                {printFilesCount > 0 && (
                  <span className="px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded font-bold">
                    {printFilesCount}x Druckdaten
                  </span>
                )}
                {visualFilesCount > 0 && (
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded font-bold">
                    {visualFilesCount}x Vorschauen
                  </span>
                )}
              </div>
            </div>
            <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {displayFiles.map((file: any, idx: number) => {
                const previewUrl = file.thumbnail || file.url;
                return (
                  <div 
                    key={idx} 
                    className="group border rounded-xl overflow-hidden cursor-pointer bg-gray-50 relative hover:shadow-xl hover:-translate-y-1 transition-all"
                    onClick={() => previewUrl && setLightboxImage(previewUrl)}
                  >
                    <div className="aspect-[4/3] flex items-center justify-center p-2 bg-white border-b border-gray-100 overflow-hidden">
                      {previewUrl ? (
                        <img 
                          src={previewUrl} 
                          alt={file.name} 
                          className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as any).style.display = 'none';
                            (e.target as any).nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`${previewUrl ? 'hidden' : ''} text-gray-400 flex flex-col items-center justify-center gap-2`}>
                        <FileText size={48} strokeWidth={1.2} />
                        <span className="text-xs font-mono text-gray-400">{(file.name || '').split('.').pop()?.toUpperCase()}</span>
                      </div>
                    </div>
                    <div className="absolute top-2 left-2 flex gap-1">
                      <span className={`text-[9px] font-bold px-2 py-1 rounded shadow text-white ${getFileBadgeColor(file.type)}`}>
                        {getFileBadgeLabel(file.type)}
                      </span>
                      {typeof file.quantity === 'number' && file.quantity > 1 && (
                        <span className="text-[9px] font-bold px-2 py-1 rounded shadow bg-slate-800 text-white">
                          {file.quantity}x
                        </span>
                      )}
                    </div>
                    {previewUrl && (
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a 
                          href={file.url} 
                          download={file.name}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-white text-gray-700 rounded-full p-1.5 hover:bg-green-50 hover:text-green-700 shadow-md"
                          title={`Download: ${file.name}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    )}
                    <div className="p-2.5 text-xs font-medium text-gray-700 truncate border-t border-gray-100 bg-gray-50/50 group-hover:bg-white transition-colors" title={file.name}>
                      {file.name || 'Unbenannte Datei'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Order Items */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-bold text-gray-700 flex items-center">
                    <FileText size={18} className="mr-2 text-green-600" />
                    Bestellte Ware / Positionen
                </h3>
                <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-full">
                    {items.reduce((sum, item) => sum + item.quantity, 0)} Teile
                </span>
            </div>
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Menge</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Artikel</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Farbe / Größe</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">📸 Druckdaten</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Notizen</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-gray-400 italic">Keine Positionen eingetragen.</td>
                            </tr>
                        ) : (
                            items.map((item) => {
                                const { file: notesFile, remainingText } = extractFileFromNotes(item.notes);
                                const printFile = notesFile;
                                const previewUrl = printFile?.thumbnail || printFile?.url;
                                return (
                                <tr key={item.id} className="hover:bg-blue-50/50 transition-colors group">
                                    <td className="px-4 py-4 font-bold text-xl text-gray-900 w-16 text-center">
                                        <div className="w-12 h-12 mx-auto bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-sm">
                                            {item.quantity}x
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-start gap-3">
                                            {previewUrl && (
                                              <div 
                                                className="shrink-0 w-14 h-14 border-2 border-gray-200 group-hover:border-red-400 rounded-lg overflow-hidden bg-white cursor-pointer shadow-sm transition-all" 
                                                onClick={() => setLightboxImage(previewUrl)}
                                                title="Druckdaten vergrößern"
                                              >
                                                <img src={previewUrl} className="w-full h-full object-contain" alt="" />
                                              </div>
                                            )}
                                            <div>
                                                <div className="font-semibold text-gray-900 leading-tight">{item.itemName}</div>
                                                {item.itemNumber && <div className="text-xs text-gray-500 font-mono mt-1 bg-gray-100 px-1.5 py-0.5 rounded inline-block">{item.itemNumber}</div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-gray-600">
                                        <div className="flex flex-col gap-0.5">
                                            {item.color && (
                                              <span className="inline-flex items-center gap-1.5">
                                                <span className="w-2.5 h-2.5 rounded-full border border-gray-300 inline-block bg-gray-100" 
                                                  style={{backgroundColor: /^(#[a-f0-9]{3,8}|rgba?\(|hsl\()/i.test(item.color) ? item.color : undefined}}
                                                  title={item.color}
                                                ></span>
                                                {item.color}
                                              </span>
                                            )}
                                            <span className="font-bold text-lg text-slate-900 tracking-wide">{item.size || '-'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        {printFile ? (
                                          <div className="space-y-2">
                                            <div 
                                              className="relative w-16 h-16 border-2 border-red-200 rounded-xl overflow-hidden bg-red-50 cursor-pointer hover:border-red-500 hover:shadow-md transition-all"
                                              onClick={() => (previewUrl || printFile.url) && setLightboxImage(previewUrl || printFile.url)}
                                            >
                                              {previewUrl ? (
                                                <img src={previewUrl} className="w-full h-full object-contain" alt="" />
                                              ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-red-400">
                                                  <FileText size={24} />
                                                  <span className="text-[9px] font-bold mt-0.5">{(printFile.name || '').split('.').pop()?.toUpperCase()}</span>
                                                </div>
                                              )}
                                              <span className={`absolute -top-1 -left-1 text-[8px] font-bold px-1.5 py-0.5 rounded shadow text-white ${getFileBadgeColor(printFile.type)} z-10`}>
                                                {getFileBadgeLabel(printFile.type)}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                              <a 
                                                href={printFile.url || '#'}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-[10px] font-medium text-gray-700 hover:text-red-600 truncate max-w-[140px] block"
                                                title={printFile.name}
                                              >
                                                📄 {printFile.name || 'Datei'}
                                              </a>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1.5 text-gray-400 text-xs italic">
                                            <span className="w-16 h-16 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center text-gray-300">
                                              <ImageIcon size={20} strokeWidth={1.2} />
                                            </span>
                                          </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 max-w-[220px]">
                                        {printFile || remainingText ? (
                                          <div className="space-y-2">
                                            {remainingText && (
                                              <p className="text-sm text-gray-800 leading-relaxed bg-yellow-50 text-yellow-900 border border-yellow-100 px-3 py-1.5 rounded-lg">
                                                {remainingText}
                                              </p>
                                            )}
                                            {printFile && (
                                              <div className="flex items-center gap-2">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded ${getFileBadgeColor(printFile.type)} text-white`}>
                                                  <Printer size={11} />
                                                  {printFile.name?.length > 18 ? `${printFile.name.slice(0, 16)}...` : printFile.name || 'Druckdatei'}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-gray-400 italic text-xs">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${
                                            item.status === 'received' ? 'bg-green-100 text-green-800 border border-green-200' :
                                            item.status === 'ordered' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                            'bg-gray-100 text-gray-700 border border-gray-200'
                                        }`}>
                                            {item.status === 'received' ? (<><CheckCircle size={12} className="mr-1.5"/> Da</>) : 
                                             item.status === 'ordered' ? (<><Clock size={12} className="mr-1.5"/> Bestellt</>) : 
                                             (<><PenTool size={12} className="mr-1.5"/> Offen</>)}
                                        </span>
                                    </td>
                                </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Footer Info */}
        <div className="flex justify-between items-center text-xs text-gray-400 px-2">
            <span>Interne Laufzettel-Ansicht</span>
            <span>ID: {order.id}</span>
        </div>

      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setLightboxImage(null)}>
          <div className="relative max-w-full max-h-full" onClick={e => e.stopPropagation()}>
            <img src={lightboxImage} className="max-w-full max-h-[90vh] object-contain rounded shadow-2xl" />
            <button 
                className="absolute -top-4 -right-4 bg-white text-black rounded-full p-2 hover:bg-gray-200 shadow-lg transform hover:scale-110 transition-all" 
                onClick={() => setLightboxImage(null)}
            >
              <X size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}