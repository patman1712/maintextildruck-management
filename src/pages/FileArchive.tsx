import { useEffect, useState } from "react";
import { useAppStore } from "@/store";
import { Archive, Download, Trash2, FileText, Search, User, Printer, Image as ImageIcon, RotateCcw, Folder, FolderOpen, ChevronRight, ChevronDown, Layers } from "lucide-react";

export default function FileArchive() {
  const currentUser = useAppStore((state) => state.currentUser);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'print' | 'preview'>('all');
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerFilter, setCustomerFilter] = useState("");
  const [folders, setFolders] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<{ folder_id: string; file_url: string }[]>([]);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [reloadToken, setReloadToken] = useState(0);

  const pageSize = 25;

  useEffect(() => {
    fetch('/api/customers')
      .then(r => r.json())
      .then(d => { if (d.success) setCustomers(d.data || []); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
    setSelectedUrls(new Set());
  }, [search, filterType, customerFilter]);

  // Ordner-Struktur des gewählten Kunden laden
  useEffect(() => {
    if (!customerFilter) { setFolders([]); setAssignments([]); return; }
    fetch(`/api/customers/${customerFilter}/file-folders`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setFolders(d.data.folders || []);
          setAssignments(d.data.assignments || []);
        }
      })
      .catch(() => {});
  }, [customerFilter]);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('limit', customerFilter ? '2000' : String(pageSize));
        params.set('offset', customerFilter ? '0' : String((page - 1) * pageSize));
        params.set('type', filterType);
        if (search.trim()) params.set('search', search.trim());
        if (customerFilter) params.set('customerId', customerFilter);

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
  }, [page, pageSize, filterType, search, customerFilter, reloadToken]);

  const handleDeleteFile = async (fileToDelete: any) => {
    if (!confirm(`Möchten Sie die Datei "${fileToDelete.customName || fileToDelete.name}" wirklich entgültig löschen?`)) return;
    try {
      await fetch('/api/upload/archive-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fileToDelete.url })
      });
      setReloadToken(t => t + 1);
    } catch {
    }
  };

  const toggleUrlSelection = (url: string) => {
    setSelectedUrls(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });
  };

  const allOnPageSelected = files.length > 0 && files.every(f => selectedUrls.has(f.url));

  const toggleSelectAllOnPage = () => {
    if (allOnPageSelected) setSelectedUrls(new Set());
    else setSelectedUrls(new Set(files.map(f => f.url)));
  };

  const handleBulkDelete = async () => {
    const urls = Array.from(selectedUrls);
    if (urls.length === 0) return;
    if (!confirm(`Möchten Sie die ${urls.length} ausgewählten Datei(en) wirklich endgültig löschen?`)) return;
    setBulkDeleting(true);
    try {
      for (const url of urls) {
        try {
          await fetch('/api/upload/archive-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          });
        } catch {}
      }
      setSelectedUrls(new Set());
      setReloadToken(t => t + 1);
    } finally {
      setBulkDeleting(false);
    }
  };

  // ---- Ordner-Gruppierung (nur bei gewähltem Kunden, Druckansicht sichtbar) ----
  const groupingActive = !!customerFilter && filterType !== 'preview' && folders.length > 0;

  const assignedUrlSet = new Set(assignments.map(a => a.file_url));
  const fileByUrl = new Map(files.map((f: any) => [f.url, f]));
  const rootFolders = folders.filter(f => !f.parent_id);
  const childFoldersOf = (parentId: string) => folders.filter(f => f.parent_id === parentId);
  const filesInFolder = (folderId: string): any[] =>
    assignments.filter(a => a.folder_id === folderId).map(a => fileByUrl.get(a.file_url)).filter(Boolean);
  const collectFolderUrls = (folderId: string): string[] => {
    const urls = assignments.filter(a => a.folder_id === folderId).map(a => a.file_url);
    childFoldersOf(folderId).forEach(c => urls.push(...collectFolderUrls(c.id)));
    return urls;
  };
  const folderFileCount = (folderId: string) =>
    new Set(collectFolderUrls(folderId).filter(u => fileByUrl.has(u))).size;
  const unassignedFiles = files.filter((f: any) => !assignedUrlSet.has(f.url));

  const toggleFolderOpen = (folderId: string) => {
    setOpenFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId); else next.add(folderId);
      return next;
    });
  };

  const renderCard = (file: any, cardKey: string) => (
    <div key={cardKey} className={`bg-white border rounded-lg p-4 hover:shadow-md transition-all group relative ${selectedUrls.has(file.url) ? 'border-red-400 ring-2 ring-red-200' : 'border-gray-200'}`}>
        <div className="aspect-square bg-gray-100 rounded mb-3 flex items-center justify-center overflow-hidden border border-gray-100 relative">
            {/* Auswahl-Checkbox */}
            <label className="absolute top-2 left-2 z-10 flex items-center justify-center bg-white/90 rounded p-1 cursor-pointer shadow-sm">
                <input
                    type="checkbox"
                    checked={selectedUrls.has(file.url)}
                    onChange={() => toggleUrlSelection(file.url)}
                    className="w-4 h-4 accent-red-600 cursor-pointer"
                    title="Für Mehrfachauswahl markieren"
                />
            </label>
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
  );

  const renderFolderNode = (folder: any, depth: number) => {
    const kids = childFoldersOf(folder.id);
    const folderFiles = filesInFolder(folder.id);
    const isOpen = openFolders.has(folder.id);
    const count = folderFileCount(folder.id);
    return (
      <div key={folder.id} className="mb-3" style={{ marginLeft: depth * 16 }}>
        <button
          onClick={() => toggleFolderOpen(folder.id)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-left"
        >
          {isOpen ? <ChevronDown size={16} className="text-gray-500 shrink-0" /> : <ChevronRight size={16} className="text-gray-500 shrink-0" />}
          {isOpen ? <FolderOpen size={18} className="text-amber-500 shrink-0" /> : <Folder size={18} className="text-amber-500 shrink-0" />}
          <span className="flex-1 min-w-0 truncate font-medium text-gray-800 text-sm">{folder.name}</span>
          <span className="text-xs text-gray-500 shrink-0">{count} {count === 1 ? 'Datei' : 'Dateien'}</span>
        </button>
        {isOpen && (
          <div className="mt-2">
            {kids.map(k => renderFolderNode(k, depth + 1))}
            {folderFiles.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-2">
                {folderFiles.map((f: any) => renderCard(f, `${folder.id}:${f.url}`))}
              </div>
            )}
            {kids.length === 0 && folderFiles.length === 0 && (
              <p className="text-xs text-gray-400 px-3 py-2" style={{ marginLeft: 16 }}>Leerer Ordner.</p>
            )}
          </div>
        )}
      </div>
    );
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
        setReloadToken(t => t + 1);
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

            <select
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-red-500 focus:border-red-500 max-w-[220px]"
                title="Archiv nach Kunde filtern"
            >
                <option value="">Alle Kunden</option>
                {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>

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
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-4">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleSelectAllOnPage}
                        className="w-4 h-4 accent-red-600 cursor-pointer"
                    />
                    {groupingActive ? 'Alle auswählen' : 'Alle auf dieser Seite auswählen'}
                </label>
                {selectedUrls.size > 0 && (
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-red-800">{selectedUrls.size} ausgewählt</span>
                        <button onClick={() => setSelectedUrls(new Set())} className="text-sm text-gray-500 hover:text-gray-700">Aufheben</button>
                        <button
                            onClick={handleBulkDelete}
                            disabled={bulkDeleting}
                            className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md font-medium hover:bg-red-700 disabled:opacity-50 flex items-center"
                        >
                            <Trash2 size={14} className="mr-1.5" />
                            {bulkDeleting ? 'Lösche…' : 'Auswahl löschen'}
                        </button>
                    </div>
                )}
            </div>
            {groupingActive ? (
              <div className="p-6">
                {rootFolders.map(folder => renderFolderNode(folder, 0))}
                <div className="mt-4 rounded-lg border-2 border-dashed border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Layers size={18} className="text-gray-500" />
                    <h4 className="font-semibold text-gray-700">Ohne Ordner</h4>
                    <span className="text-xs text-gray-500">({unassignedFiles.length})</span>
                  </div>
                  {unassignedFiles.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {unassignedFiles.map((file: any) => renderCard(file, `unassigned:${file.url}`))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 px-1 py-2">Alle Dateien sind einem Ordner zugeordnet.</p>
                  )}
                </div>
              </div>
            ) : (
              <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
                  {files.map((file, idx) => renderCard(file, `${file.url}-${idx}`))}
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
            </>
        )}
      </div>
    </div>
  );
}
