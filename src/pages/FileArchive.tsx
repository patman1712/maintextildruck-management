import { useEffect, useState } from "react";
import { useAppStore } from "@/store";
import { Archive, Download, Trash2, FileText, Search, User } from "lucide-react";

export default function FileArchive() {
  const orders = useAppStore((state) => state.orders);
  const loading = useAppStore((state) => state.loading);
  const fetchData = useAppStore((state) => state.fetchData);
  const updateOrder = useAppStore((state) => state.updateOrder);

  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter for archived orders (which contain the files)
  // Or active orders too? The user asked for "Archived files".
  // But typically "Archived" means "Direct Uploads" in our system context (status='archived').
  // Let's show ALL files from orders with status 'archived' (which includes One-Time and Direct Uploads).
  
  const archivedOrders = orders.filter(o => o.status === 'archived');
  
  const allFiles = archivedOrders.flatMap(order => 
    (order.files || []).map(f => ({
        ...f,
        orderId: order.id,
        orderTitle: order.title,
        customerName: order.customerName,
        createdAt: order.createdAt
    }))
  ).filter(f => f.url);

  const filteredFiles = allFiles.filter(f => 
    (f.name && f.name.toLowerCase().includes(search.toLowerCase())) ||
    (f.customName && f.customName.toLowerCase().includes(search.toLowerCase())) ||
    (f.customerName && f.customerName.toLowerCase().includes(search.toLowerCase()))
  );

  // Sort by date desc
  filteredFiles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleDeleteFile = async (fileToDelete: any) => {
    if (!confirm(`Möchten Sie die Datei "${fileToDelete.customName || fileToDelete.name}" wirklich entgültig löschen?`)) return;

    // Find the order
    const order = orders.find(o => o.id === fileToDelete.orderId);
    if (!order) return;

    // Remove file from order
    const updatedFiles = (order.files || []).filter(f => f.url !== fileToDelete.url);
    
    // Update order in DB
    await updateOrder(order.id, { files: updatedFiles });

    // Delete file from disk
    try {
        await fetch('/api/upload/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: fileToDelete.url })
        });
    } catch (e) {
        console.error("Failed to delete physical file", e);
    }

    // If order has no files left, maybe delete the order too?
    if (updatedFiles.length === 0) {
        // We can't easily "delete" order via store yet without setting status to archived (which it already is).
        // But since it's empty, maybe we don't care? Or we should clean it up?
        // Ideally we would delete the empty container order.
        // But for now, just removing the file is enough to clean disk space.
    }
    
    fetchData();
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center">
          <Archive className="mr-3 text-red-600" />
          Datei-Archiv (Direkt-Uploads)
        </h1>
        <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
                type="text" 
                placeholder="Suchen..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 w-full"
            />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
            <div className="p-8 text-center text-gray-500">Lade Archiv...</div>
        ) : filteredFiles.length === 0 ? (
            <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                <Archive size={48} className="text-gray-300 mb-4" />
                <p>Keine archivierten Dateien gefunden.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
                {filteredFiles.map((file, idx) => (
                    <div key={`${file.url}-${idx}`} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all group relative">
                        <div className="aspect-square bg-gray-100 rounded mb-3 flex items-center justify-center overflow-hidden border border-gray-100 relative">
                            {(file.thumbnail || file.url) ? (
                                <img 
                                    src={file.thumbnail || file.url} 
                                    alt={file.name} 
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                                    }} 
                                />
                            ) : null}
                            
                            <div className={`fallback-icon ${(file.thumbnail || file.url) ? 'hidden' : ''} flex items-center justify-center absolute inset-0`}>
                                <FileText className="text-gray-300 h-16 w-16" />
                            </div>

                            {/* Overlay Actions */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-3">
                                <a 
                                    href={file.url} 
                                    download
                                    className="p-2 bg-white text-gray-800 rounded-full hover:bg-gray-100 hover:text-green-600 transition-colors"
                                    title="Herunterladen"
                                >
                                    <Download size={20} />
                                </a>
                                <button 
                                    onClick={() => handleDeleteFile(file)}
                                    className="p-2 bg-white text-gray-800 rounded-full hover:bg-gray-100 hover:text-red-600 transition-colors"
                                    title="Endgültig löschen"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-medium text-gray-800 truncate text-sm mb-1" title={file.customName || file.name}>
                                {file.customName || file.name}
                            </h4>
                            <div className="flex items-center text-xs text-gray-500 mb-1">
                                <User size={12} className="mr-1" />
                                <span className="truncate">{file.customerName}</span>
                            </div>
                            <p className="text-[10px] text-gray-400">
                                {new Date(file.createdAt).toLocaleString('de-DE')}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}