import { useEffect, useState } from "react";
import { useAppStore } from "@/store";
import { Archive, Download, Trash2, FileText, Search, User, Printer, Image as ImageIcon } from "lucide-react";

export default function FileArchive() {
  const orders = useAppStore((state) => state.orders);
  const products = useAppStore((state) => state.products) || [];
  const loading = useAppStore((state) => state.loading);
  const fetchData = useAppStore((state) => state.fetchData);
  const updateOrder = useAppStore((state) => state.updateOrder);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'print' | 'preview'>('all');

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter for archived orders (which contain the files)
  // Or active orders too? The user asked for "Archived files".
  // But typically "Archived" means "Direct Uploads" in our system context (status='archived').
  // Let's show ALL files from orders with status 'archived' (which includes One-Time and Direct Uploads).
  
  const archivedOrders = orders.filter(o => o.status === 'archived');
  
  const allOrderFiles = archivedOrders.flatMap(order => 
    (order.files || []).map(f => ({
        ...f,
        orderId: order.id,
        orderTitle: order.title,
        customerName: order.customerName,
        createdAt: order.createdAt
    }))
  ).filter(f => f.url);

  // Get preview files from Products (Freisteller)
  const freistellerProducts = products.filter(p => p.product_number === 'FREISTELLER' || (p.files && p.files.some(f => f.type === 'preview')));
  const productFiles = freistellerProducts.flatMap(p => 
      (p.files || []).filter(f => f.type === 'preview').map(f => ({
          name: f.file_name,
          type: 'preview' as const,
          url: f.file_url,
          thumbnail: f.thumbnail_url,
          customName: f.file_name, // Map to same structure
          orderId: `prod-${p.id}`,
          orderTitle: `Produkt: ${p.name}`,
          customerName: useAppStore.getState().customers.find(c => c.id === p.supplier_id)?.name || "Unbekannt", // supplier_id is used as customer_id for products
          createdAt: p.created_at || new Date().toISOString()
      }))
  );

  const allFilesRaw = [...allOrderFiles, ...productFiles];

  // Deduplicate files by URL
  // Keep the most recent one (since sorted later by createdAt, let's sort first)
  allFilesRaw.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  const allFiles: typeof allFilesRaw = [];
  const seenUrls = new Set<string>();

  for (const file of allFilesRaw) {
      if (!seenUrls.has(file.url)) {
          seenUrls.add(file.url);
          allFiles.push(file);
      }
  }

  const filteredFiles = allFiles.filter(f => 
    ((f.name && f.name.toLowerCase().includes(search.toLowerCase())) ||
    (f.customName && f.customName.toLowerCase().includes(search.toLowerCase())) ||
    (f.customerName && f.customerName.toLowerCase().includes(search.toLowerCase()))) &&
    (filterType === 'all' || f.type === filterType)
  );

  const handleDeleteFile = async (fileToDelete: any) => {
    if (!confirm(`Möchten Sie die Datei "${fileToDelete.customName || fileToDelete.name}" wirklich entgültig löschen?`)) return;

    // Find ALL orders that use this file URL
    const ordersWithFile = orders.filter(o => 
        (o.files || []).some(f => f.url === fileToDelete.url)
    );

    // Remove file from ALL these orders
    for (const order of ordersWithFile) {
        const updatedFiles = (order.files || []).filter(f => f.url !== fileToDelete.url);
        await updateOrder(order.id, { files: updatedFiles });
    }
    
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
    
    fetchData();
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center">
            <Archive className="mr-3 text-red-600" />
            Datei-Archiv (Direkt-Uploads)
            </h1>
        </div>
        
        <div className="flex items-center space-x-2">
            <div className="flex bg-gray-100 p-1 rounded-lg mr-2">
                <button 
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${filterType === 'all' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Alle
                </button>
                <button 
                    onClick={() => setFilterType('print')}
                    className={`px-3 py-1 text-sm rounded-md transition-colors flex items-center ${filterType === 'print' ? 'bg-white shadow-sm text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Printer size={14} className="mr-1" />
                    Druck
                </button>
                <button 
                    onClick={() => setFilterType('preview')}
                    className={`px-3 py-1 text-sm rounded-md transition-colors flex items-center ${filterType === 'preview' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <ImageIcon size={14} className="mr-1" />
                    Vorschau
                </button>
            </div>

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
                            {/* Type Indicator */}
                            <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm ${
                                file.type === 'print' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                                {file.type === 'print' ? 'DRUCK' : 'VORSCHAU'}
                            </div>

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