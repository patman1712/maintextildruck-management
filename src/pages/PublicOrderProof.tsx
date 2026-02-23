import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle, XCircle, X, FileText, Image as ImageIcon, Calendar } from "lucide-react";

interface PublicOrder {
  id: string;
  title: string;
  orderNumber: string;
  customerName: string;
  deadline: string;
  description: string;
  files: any[];
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

export default function PublicOrderProof() {
  const { token } = useParams<{ token: string }>();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approverName, setApproverName] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/orders/public/${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setOrder(data.order);
          setItems(data.items);
        } else {
          setError(data.error);
        }
        setLoading(false);
      })
      .catch(err => {
        setError("Verbindungsfehler");
        setLoading(false);
      });
  }, [token]);

  const handleApprove = async () => {
    if (!approverName) return alert("Bitte geben Sie Ihren Namen ein.");
    
    try {
      const res = await fetch(`/api/orders/public/${token}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: approverName })
      });
      if (res.ok) {
        window.location.reload();
      } else {
        alert("Fehler beim Bestätigen.");
      }
    } catch (e) {
      alert("Netzwerkfehler.");
    }
  };

  const handleReject = async () => {
    try {
      const res = await fetch(`/api/orders/public/${token}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason })
      });
      if (res.ok) {
        window.location.reload();
      } else {
        alert("Fehler beim Ablehnen.");
      }
    } catch (e) {
      alert("Netzwerkfehler.");
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Lade Auftrag...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!order) return null;

  const previewFiles = order.files.filter((f: any) => f.type === 'preview' || f.type === 'view' || f.name === 'Shopware Bild');

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="text-white">
            <h1 className="text-2xl font-bold">Digitaler Abzug</h1>
            <p className="text-slate-400 text-sm mt-1">Auftrags-Nr: <span className="font-mono text-slate-300">{order.orderNumber}</span></p>
          </div>
          {order.approvalStatus === 'approved' && (
            <div className="bg-green-500 text-white px-4 py-2 rounded-full flex items-center text-sm font-bold shadow-sm">
              <CheckCircle size={18} className="mr-2" /> Freigegeben
            </div>
          )}
          {order.approvalStatus === 'rejected' && (
            <div className="bg-red-500 text-white px-4 py-2 rounded-full flex items-center text-sm font-bold shadow-sm">
              <XCircle size={18} className="mr-2" /> Abgelehnt
            </div>
          )}
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          {/* Order Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b pb-8">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Auftrag</h3>
              <p className="text-xl font-semibold text-gray-900">{order.title}</p>
              <div className="flex items-center text-gray-600 mt-2 text-sm">
                <Calendar size={16} className="mr-2 text-red-500" /> 
                <span className="font-medium">Deadline: {new Date(order.deadline).toLocaleDateString()}</span>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Kunde</h3>
              <p className="text-lg text-gray-900">{order.customerName}</p>
            </div>
          </div>

          {order.description && (
            <div className="bg-blue-50 p-5 rounded-lg border border-blue-100">
              <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">Beschreibung / Hinweise</h3>
              <p className="text-blue-900 whitespace-pre-wrap text-sm leading-relaxed">{order.description}</p>
            </div>
          )}

          {/* Visuals */}
          {previewFiles.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center border-b pb-2">
                <ImageIcon className="mr-2 text-red-600" /> Ansichten / Vorschau
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {previewFiles.map((file: any, idx: number) => (
                  <div 
                    key={idx} 
                    className="group border rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-all bg-gray-50 relative"
                    onClick={() => setLightboxImage(file.url)}
                  >
                    <div className="aspect-square flex items-center justify-center p-2 bg-white">
                       <img src={file.url} alt={file.name} className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <span className="bg-white/90 text-gray-800 text-xs font-medium px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transform scale-95 group-hover:scale-100 transition-all shadow-sm">
                            Vergrößern
                        </span>
                    </div>
                    <div className="p-3 bg-gray-50 text-xs text-center font-medium text-gray-600 truncate border-t border-gray-100">
                        {file.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Items */}
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center border-b pb-2">
              <FileText className="mr-2 text-red-600" /> Positionen
            </h3>
            <div className="overflow-hidden border rounded-lg shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Artikel</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Farbe</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Größe</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Anzahl</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item: any) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{item.item_name}</td>
                      <td className="px-6 py-4 text-gray-600">{item.color || '-'}</td>
                      <td className="px-6 py-4 text-gray-600">{item.size}</td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Approval Action */}
          <div className="pt-8 mt-8">
            {order.approvalStatus === 'pending' ? (
              <div className="bg-white p-8 rounded-xl border-2 border-slate-200 shadow-sm text-center">
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Freigabe erforderlich</h3>
                <p className="text-gray-600 mb-8 max-w-lg mx-auto">
                    Bitte prüfen Sie alle Details und Vorschaubilder sorgfältig auf Richtigkeit. 
                    Mit Ihrer Bestätigung geben Sie den Auftrag zur Produktion frei.
                </p>
                
                <div className="max-w-md mx-auto space-y-6">
                  <div className="text-left">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ihr Name (zur Bestätigung)</label>
                    <input 
                      type="text" 
                      className="w-full border-gray-300 rounded-lg p-3 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                      placeholder="Vorname Nachname eingeben..."
                      value={approverName}
                      onChange={e => setApproverName(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
                    <button 
                      onClick={() => setShowRejectModal(true)}
                      className="px-6 py-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    >
                      Ablehnen / Korrektur
                    </button>
                    <button 
                      onClick={handleApprove}
                      disabled={!approverName}
                      className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                    >
                      Auftrag jetzt freigeben
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`p-8 rounded-xl text-center border ${order.approvalStatus === 'approved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                {order.approvalStatus === 'approved' ? (
                  <div>
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={32} className="text-green-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-green-800 mb-2">Auftrag freigegeben</h3>
                    <p className="text-green-700">
                      Bestätigt von <strong>{order.approvedBy}</strong> am {new Date(order.approvedAt!).toLocaleString('de-DE')}
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <XCircle size={32} className="text-red-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-red-800 mb-2">Auftrag abgelehnt</h3>
                    <p className="text-red-700 font-medium bg-white/50 inline-block px-4 py-2 rounded-lg mt-2">
                        Grund: {order.rejectionReason}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl transform scale-100 transition-all">
            <h3 className="text-lg font-bold mb-2 text-red-600 flex items-center">
                <XCircle size={20} className="mr-2" /> Auftrag ablehnen
            </h3>
            <p className="text-sm text-gray-600 mb-4">Bitte teilen Sie uns mit, was korrigiert werden muss oder warum Sie den Auftrag ablehnen:</p>
            <textarea 
              className="w-full border border-gray-300 p-3 rounded-lg mb-6 h-32 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
              placeholder="Grund für die Ablehnung eingeben..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              autoFocus
            ></textarea>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                Abbrechen
              </button>
              <button 
                onClick={handleReject}
                disabled={!rejectReason}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold shadow-sm disabled:opacity-50 transition-colors"
              >
                Ablehnen senden
              </button>
            </div>
          </div>
        </div>
      )}

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
