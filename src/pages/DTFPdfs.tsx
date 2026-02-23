import { useState, useEffect } from "react";
import { Download, Trash2, FileText, Printer, Search } from "lucide-react";

export default function DTFPdfs() {
  const [pdfs, setPdfs] = useState<{name: string, url: string, date: string, thumbnail?: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchPdfs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/upload/list-pdfs'); // We need to implement this endpoint
      const data = await res.json();
      if (data.success) {
        setPdfs(data.files);
      }
    } catch (error) {
      console.error("Failed to fetch PDFs", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPdfs();
  }, []);

  const handleDelete = async (filename: string) => {
    if (!confirm(`Möchten Sie die Datei "${filename}" wirklich löschen?`)) return;

    try {
      const res = await fetch('/api/upload/delete-pdf', { // We need to implement this endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      
      const data = await res.json();
      if (data.success) {
        setPdfs(prev => prev.filter(p => p.name !== filename));
      } else {
        alert("Löschen fehlgeschlagen: " + data.error);
      }
    } catch (error) {
      console.error("Failed to delete PDF", error);
      alert("Fehler beim Löschen.");
    }
  };

  const filteredPdfs = pdfs.filter(pdf => 
    pdf.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center">
          <FileText className="mr-3 text-red-600" />
          Fertige DTF PDFs
        </h1>
        <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
                type="text" 
                placeholder="Suchen..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
            />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Lade PDFs...</div>
      ) : filteredPdfs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <Printer size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Keine generierten PDFs gefunden.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPdfs.map((pdf, idx) => (
            <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all group">
              <div className="h-48 bg-gray-100 rounded mb-3 flex items-center justify-center overflow-hidden border border-gray-100 relative group-hover:bg-gray-50 transition-colors">
                {pdf.thumbnail ? (
                    <img src={pdf.thumbnail} alt={pdf.name} className="w-full h-full object-contain" />
                ) : (
                    <div className="flex flex-col items-center text-gray-400">
                        <FileText size={48} className="mb-2" />
                        <span className="text-xs">Vorschau nicht verfügbar</span>
                    </div>
                )}
                
                {/* Overlay Actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-4">
                    <a 
                        href={pdf.url} 
                        download
                        className="p-2 bg-white text-gray-800 rounded-full hover:bg-gray-100 hover:text-red-600 transition-colors"
                        title="Herunterladen"
                    >
                        <Download size={20} />
                    </a>
                    <button 
                        onClick={() => handleDelete(pdf.name)}
                        className="p-2 bg-white text-gray-800 rounded-full hover:bg-gray-100 hover:text-red-600 transition-colors"
                        title="Löschen"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
              </div>

              <div className="mb-1">
                <h4 className="font-medium text-gray-800 truncate text-sm" title={pdf.name}>
                    {pdf.name}
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                    {new Date(pdf.date).toLocaleString('de-DE')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}