import { useEffect, useState } from "react";
import { useAppStore } from "@/store";
import { Archive, Download, Trash2, FileText, Search, User, Printer, Image as ImageIcon, RotateCcw } from "lucide-react";

export default function FileArchive() {
  const currentUser = useAppStore((state) => state.currentUser);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'print' | 'preview'>('all');
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const pageSize = 25;

  useEffect(() => {
    setPage(1);
  }, [search, filterType]);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('limit', String(pageSize));
        params.set('offset', String((page - 1) * pageSize));
        params.set('type', filterType);
        if (search.trim()) params.set('search', search.trim());

        const res = await fetch(`/api/upload/archive-files?${params.toString()}`, { signal: controller.signal });
        const data = await res.json();
        if (data.success) {
          setFiles(data.data || []);
          setHasMore(!!data.hasMore);
        } else {
          setFiles([]);
          setHasMore(false);
        }
      } catch {
        setFiles([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => controller.abort();
  }, [page, pageSize, filterType, search]);

  const handleDeleteFile = async (fileToDelete: any) => {
    if (!confirm(`Möchten Sie die Datei "${fileToDelete.customName || fileToDelete.name}" wirklich entgültig löschen?`)) return;
    try {
      await fetch('/api/upload/archive-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fileToDelete.url })
      });
      setPage(1);
    } catch {
    }
  };

  const handleRegenerateThumbnails = async () => {
    if (!currentUser || currentUser.role !== 'admin') {
      alert('Nur Admins können Thumbnails regenerieren.');
      return;
    }
    if (!confirm('Thumbnails neu generieren? Das kann je nach Datenmenge etwas dauern.')) return;

    setRegenerating(true);
    try {
      const res = await fetch('/api/upload/regenerate-thumbnails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true })
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        alert(data?.error || 'Regeneration fehlgeschlagen.');
      } else {
        alert(`Fertig.\nOrders: ${data.updated || 0}\nProdukte: ${data.productsUpdated || 0}`);
        setPage(1);
      }
    } catch {
      alert('Regeneration fehlgeschlagen.');
    } finally {
      setRegenerating(false);
    }
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
            {currentUser?.role === 'admin' && (
              <button
                onClick={handleRegenerateThumbnails}
                disabled={regenerating}
                className="bg-white border border-gray-200 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center"
                title="Thumbnails neu generieren"
              >
                <RotateCcw size={16} className="mr-2" />
                {regenerating ? 'Regeneriere…' : 'Thumbnails neu'}
              </button>
            )}
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
        ) : files.length === 0 ? (
            <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                <Archive size={48} className="text-gray-300 mb-4" />
                <p>Keine archivierten Dateien gefunden.</p>
            </div>
        ) : (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
                {files.map((file, idx) => (
                    <div key={`${file.url}-${idx}`} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all group relative">
                        <div className="aspect-square bg-gray-100 rounded mb-3 flex items-center justify-center overflow-hidden border border-gray-100 relative">
                            {/* Type Indicator */}
                            <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm ${
                                file.type === 'print' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                                {file.type === 'print' ? 'DRUCK' : 'VORSCHAU'}
                            </div>

                            {file.thumbnail ? (
                                <img 
                                    src={file.thumbnail} 
                                    alt={file.name} 
                                    className="w-full h-full object-contain"
                                    loading="lazy"
                                    decoding="async"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                                    }} 
                                />
                            ) : null}
                            
                            <div className={`fallback-icon ${file.thumbnail ? 'hidden' : ''} flex items-center justify-center absolute inset-0`}>
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
            <div className="flex items-center justify-between px-6 pb-6">
                <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-4 py-2 border border-gray-200 rounded-md text-sm disabled:opacity-50"
                >
                    Zurück
                </button>
                <div className="text-sm text-gray-500">Seite {page}</div>
                <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={!hasMore}
                    className="px-4 py-2 border border-gray-200 rounded-md text-sm disabled:opacity-50"
                >
                    Weiter
                </button>
            </div>
            </>
        )}
      </div>
    </div>
  );
}
