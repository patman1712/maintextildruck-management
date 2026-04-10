import { useState, useEffect } from "react";
import { Download, FileText, Printer, Search, Eye, Trash2 } from "lucide-react";

export default function DTFPdfs() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [hoverThumb, setHoverThumb] = useState<string | null>(null);
  const checkerStyle = {
    backgroundColor: "#00FF00",
  } as const;
  const thumbFilterStyle = {
    filter: "drop-shadow(0 0 1px rgba(0,0,0,0.75)) drop-shadow(0 2px 10px rgba(0,0,0,0.25))",
  } as const;

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dtf/jobs');
      const data = await res.json();
      if (data.success) {
        setJobs(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch DTF jobs", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const openDetails = async (jobId: string) => {
    setDetailsLoading(true);
    try {
      const res = await fetch(`/api/dtf/jobs/${jobId}`);
      const data = await res.json();
      if (data.success) setSelectedJob(data.data);
      else alert(data.error || 'Fehler beim Laden des DTF Jobs');
    } catch (e: any) {
      alert(e?.message || 'Fehler beim Laden des DTF Jobs');
    } finally {
      setDetailsLoading(false);
    }
  };

  const deleteJob = async (jobId: string) => {
    if (!confirm('DTF Job wirklich löschen? Dabei werden auch die PDFs/Thumbnails entfernt.')) return;
    try {
      const res = await fetch(`/api/dtf/jobs/${jobId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'Löschen fehlgeschlagen');
        return;
      }
      setSelectedJob(null);
      await fetchJobs();
    } catch (e: any) {
      alert(e?.message || 'Löschen fehlgeschlagen');
    }
  };

  const purgeOrphans = async () => {
    if (!confirm('Alte DTF PDFs ohne Job-Referenz jetzt löschen?')) return;
    setPurgeLoading(true);
    try {
      const res = await fetch('/api/dtf/purge-orphan-pdfs', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(`Gelöscht: ${data.deletedCount}`);
      } else {
        alert(data.error || 'Cleanup fehlgeschlagen');
      }
    } catch (e: any) {
      alert(e?.message || 'Cleanup fehlgeschlagen');
    } finally {
      setPurgeLoading(false);
    }
  };

  const filteredJobs = jobs.filter(job => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const orderIds = Array.isArray(job.order_ids) ? job.order_ids.join(' ') : '';
    const id = String(job.id || '');
    return id.toLowerCase().includes(q) || orderIds.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center">
          <FileText className="mr-3 text-red-600" />
          Fertige DTF Jobs
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={purgeOrphans}
            disabled={purgeLoading}
            className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            title="Löscht dtf-output PDFs im Uploads-Ordner, die zu keinem gespeicherten DTF Job gehören"
          >
            {purgeLoading ? 'Aufräumen…' : 'Alte PDFs aufräumen'}
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
                type="text" 
                placeholder="Suchen (Job-ID / Auftrag)..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Lade PDFs...</div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <Printer size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Keine DTF Jobs gefunden.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredJobs.map((job: any) => {
            const pdfs: string[] = Array.isArray(job.pdf_urls) ? job.pdf_urls : [];
            const firstPdf = pdfs[0];
            const thumb = firstPdf ? `${firstPdf}_thumb.png` : '';
            const stats = job.stats || {};
            return (
            <div key={job.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all group">
              <div style={checkerStyle} className="h-48 bg-white rounded mb-3 flex items-center justify-center overflow-hidden border border-gray-100 relative group-hover:bg-gray-50 transition-colors">
                {thumb ? (
                    <img src={thumb} alt="" className="w-full h-full object-contain" style={thumbFilterStyle} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                    <div className="flex flex-col items-center text-gray-400">
                        <FileText size={48} className="mb-2" />
                        <span className="text-xs">Vorschau nicht verfügbar</span>
                    </div>
                )}
                
                {/* Overlay Actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-4">
                    <button 
                        onClick={() => openDetails(job.id)}
                        className="p-2 bg-white text-gray-800 rounded-full hover:bg-gray-100 hover:text-red-600 transition-colors"
                        title="Details"
                    >
                        <Eye size={20} />
                    </button>
                </div>
              </div>

              <div className="mb-1">
                <h4 className="font-medium text-gray-800 truncate text-sm" title={job.id}>
                    {job.id}
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                    {job.created_at ? new Date(job.created_at).toLocaleString('de-DE') : ''}
                </p>
                <div className="mt-2 text-xs text-slate-600 space-y-1">
                    <div className="flex justify-between">
                        <span>Bögen</span>
                        <span className="font-medium">{stats.pages ?? '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Gesamtstücke</span>
                        <span className="font-medium">{stats.totalPieces ?? '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Aufträge</span>
                        <span className="font-medium">{Array.isArray(job.order_ids) ? job.order_ids.length : '-'}</span>
                    </div>
                </div>
                {pdfs.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                        {pdfs.map((u: string, idx: number) => (
                            <a key={u} href={u} download className="text-xs font-bold text-red-600 hover:underline flex items-center">
                                <Download size={14} className="mr-2 shrink-0" />
                                <span className="truncate">{pdfs.length > 1 ? `PDF ${idx + 1} herunterladen` : 'PDF herunterladen'}</span>
                            </a>
                        ))}
                    </div>
                )}
              </div>
            </div>
          )})}
        </div>
      )}

      {selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500">DTF Job</div>
                <div className="font-mono text-sm">{selectedJob.id}</div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => deleteJob(selectedJob.id)}
                  className="text-sm font-bold text-red-600 hover:text-red-700 flex items-center"
                  title="Job löschen (inkl. PDFs)"
                >
                  <Trash2 size={16} className="mr-2" />
                  Löschen
                </button>
                <button onClick={() => setSelectedJob(null)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto max-h-[70vh]">
              {detailsLoading ? (
                <div className="text-center py-10 text-gray-500">Lade…</div>
              ) : (
                <>
                  {Array.isArray(selectedJob.pages) && selectedJob.pages.length > 0 ? (
                    <div className="space-y-6">
                      {selectedJob.pages.map((p: any) => {
                        const placements = Array.isArray(p.placements) ? p.placements : [];
                        const pageThumb = p.pdf_url ? `${p.pdf_url}_thumb.png` : '';
                        const pageThumbLg = p.pdf_url ? `${p.pdf_url}_thumb_lg.png` : '';
                        const counts: Record<string, number> = {};
                        for (const pl of placements) {
                          const key = String(pl.name || pl.url || 'Datei');
                          counts[key] = (counts[key] || 0) + 1;
                        }
                        return (
                          <div key={p.index} className="border border-slate-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-bold text-slate-800">Bogen {Number(p.index) + 1}</div>
                              <div className="text-xs text-slate-500">
                                {Math.round((p.width_mm || 0))}×{Math.round((p.height_mm || 0))} mm · {Math.round(((p.utilization || 0) * 100))}%
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <div style={checkerStyle} className="w-28 h-28 border border-slate-200 rounded bg-white overflow-hidden shrink-0 flex items-center justify-center">
                                {pageThumb ? (
                                  <img
                                    src={pageThumb}
                                    alt=""
                                    className="w-full h-full object-contain"
                                    style={thumbFilterStyle}
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    onMouseEnter={() => setHoverThumb(pageThumbLg || pageThumb)}
                                    onMouseLeave={() => setHoverThumb(null)}
                                  />
                                ) : (
                                  <div className="text-xs text-slate-400">Kein Thumb</div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-700 space-y-1">
                              {Object.entries(counts).map(([k, v]) => (
                                <div key={k} className="flex justify-between">
                                  <span className="truncate pr-4" title={k}>{k}</span>
                                  <span className="font-mono">{v}x</span>
                                </div>
                              ))}
                            </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-gray-500">Keine Detaildaten vorhanden.</div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {hoverThumb && (
        <div className="fixed inset-0 z-[60] pointer-events-none">
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div style={checkerStyle} className="bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden max-w-[min(1100px,calc(100vw-48px))]">
              <img src={hoverThumb} alt="" className="w-full h-auto block" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
