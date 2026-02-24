import { useState, useEffect } from 'react';
import { useAppStore } from '@/store';
import { HelpCircle, Plus, Trash2, ChevronDown, ChevronUp, Download, Upload, Edit2, Save, X } from 'lucide-react';

export default function FAQ() {
  const currentUser = useAppStore((state) => state.currentUser);
  
  // FAQ State
  const [faqs, setFaqs] = useState<any[]>([]);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [isAddingFaq, setIsAddingFaq] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");

  // FAQ Edit State
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");

  // Download State
  const [downloads, setDownloads] = useState<any[]>([]);
  const [isAddingDownload, setIsAddingDownload] = useState(false);
  const [downloadTitle, setDownloadTitle] = useState("");
  const [downloadDesc, setDownloadDesc] = useState("");
  const [downloadFile, setDownloadFile] = useState<File | null>(null);

  useEffect(() => {
    loadFaqs();
    loadDownloads();
  }, []);

  const loadFaqs = () => {
    fetch('/api/faqs')
      .then(r => r.json())
      .then(d => {
        if(d.success) setFaqs(d.data);
      })
      .catch(err => console.error("Failed to load FAQs", err));
  };

  const loadDownloads = () => {
    fetch('/api/downloads')
      .then(r => r.json())
      .then(d => {
        if(d.success) setDownloads(d.data);
      })
      .catch(err => console.error("Failed to load downloads", err));
  };

  const handleAddFaq = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          const res = await fetch('/api/faqs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ question: newQuestion, answer: newAnswer })
          });
          if (res.ok) {
              setNewQuestion("");
              setNewAnswer("");
              setIsAddingFaq(false);
              loadFaqs();
          }
      } catch (err) {
          console.error(err);
      }
  };

  const handleDeleteFaq = async (id: string) => {
      if (!confirm("FAQ wirklich löschen?")) return;
      await fetch(`/api/faqs/${id}`, { method: 'DELETE' });
      loadFaqs();
  };

  const startEditFaq = (faq: any) => {
    setEditingFaqId(faq.id);
    setEditQuestion(faq.question);
    setEditAnswer(faq.answer);
    setOpenFaq(faq.id); 
  };

  const handleUpdateFaq = async (id: string) => {
    try {
        const res = await fetch(`/api/faqs/${id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ question: editQuestion, answer: editAnswer })
        });
        if(res.ok) {
            setEditingFaqId(null);
            loadFaqs();
        }
    } catch(e) {
        console.error(e);
    }
  };

  const handleAddDownload = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!downloadFile) return;
      
      const formData = new FormData();
      formData.append('title', downloadTitle);
      formData.append('description', downloadDesc);
      formData.append('file', downloadFile);
      
      try {
          const res = await fetch('/api/downloads', { method: 'POST', body: formData });
          if (res.ok) {
              setDownloadTitle("");
              setDownloadDesc("");
              setDownloadFile(null);
              setIsAddingDownload(false);
              loadDownloads();
          }
      } catch (err) {
          console.error(err);
      }
  };

  const handleDeleteDownload = async (id: string) => {
      if (!confirm("Download wirklich löschen? Die Datei wird vom Server entfernt.")) return;
      await fetch(`/api/downloads/${id}`, { method: 'DELETE' });
      loadDownloads();
  };

  if (!currentUser) return null;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
        <HelpCircle className="mr-3 text-red-600" />
        Hilfe & FAQ
      </h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-800">
                Häufig gestellte Fragen
            </h3>
            {currentUser.role === 'admin' && (
                <button 
                    onClick={() => setIsAddingFaq(!isAddingFaq)}
                    className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded flex items-center transition-colors"
                >
                    <Plus size={14} className="mr-1" />
                    Neuer Eintrag
                </button>
            )}
        </div>

        {isAddingFaq && (
            <form onSubmit={handleAddFaq} className="bg-gray-50 p-4 rounded mb-6 border border-gray-200 animate-in slide-in-from-top-2">
                <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frage</label>
                    <input 
                        type="text" 
                        className="w-full border rounded p-2 text-sm focus:ring-red-500 focus:border-red-500"
                        value={newQuestion}
                        onChange={(e) => setNewQuestion(e.target.value)}
                        placeholder="z.B. Wie erstelle ich einen neuen Auftrag?"
                        required
                    />
                </div>
                <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Antwort</label>
                    <textarea 
                        className="w-full border rounded p-2 text-sm focus:ring-red-500 focus:border-red-500"
                        rows={3}
                        value={newAnswer}
                        onChange={(e) => setNewAnswer(e.target.value)}
                        placeholder="..."
                        required
                    ></textarea>
                </div>
                <div className="flex justify-end space-x-2">
                    <button type="button" onClick={() => setIsAddingFaq(false)} className="text-gray-500 text-sm px-3 py-1">Abbrechen</button>
                    <button type="submit" className="bg-red-600 text-white text-sm px-3 py-1 rounded hover:bg-red-700">Speichern</button>
                </div>
            </form>
        )}

        <div className="space-y-2">
            {faqs.length > 0 ? (
                faqs.map(faq => (
                    <div key={faq.id} className="border border-gray-200 rounded overflow-hidden">
                        {editingFaqId === faq.id ? (
                            <div className="p-4 bg-blue-50 border-l-4 border-blue-500">
                                <div className="mb-2">
                                    <label className="block text-xs font-bold text-blue-700 uppercase mb-1">Frage bearbeiten</label>
                                    <input 
                                        className="w-full border border-blue-200 p-2 rounded font-medium text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                                        value={editQuestion} 
                                        onChange={e => setEditQuestion(e.target.value)} 
                                    />
                                </div>
                                <div className="mb-3">
                                    <label className="block text-xs font-bold text-blue-700 uppercase mb-1">Antwort bearbeiten</label>
                                    <textarea 
                                        className="w-full border border-blue-200 p-2 rounded text-sm text-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                                        rows={4} 
                                        value={editAnswer} 
                                        onChange={e => setEditAnswer(e.target.value)} 
                                    />
                                </div>
                                <div className="flex justify-end space-x-2">
                                    <button 
                                        onClick={() => setEditingFaqId(null)} 
                                        className="text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded text-sm flex items-center transition-colors"
                                    >
                                        <X size={14} className="mr-1"/> Abbrechen
                                    </button>
                                    <button 
                                        onClick={() => handleUpdateFaq(faq.id)} 
                                        className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded text-sm flex items-center transition-colors shadow-sm"
                                    >
                                        <Save size={14} className="mr-1"/> Speichern
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <button 
                                    onClick={() => setOpenFaq(openFaq === faq.id ? null : faq.id)}
                                    className="w-full flex justify-between items-center p-3 bg-gray-50 hover:bg-gray-100 text-left transition-colors"
                                >
                                    <span className="font-medium text-gray-800">{faq.question}</span>
                                    <div className="flex items-center text-gray-500">
                                        {openFaq === faq.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                </button>
                                {openFaq === faq.id && (
                                    <div className="p-3 bg-white text-sm text-gray-600 border-t border-gray-200 relative">
                                        <p className="whitespace-pre-wrap pr-16">{faq.answer}</p>
                                        {currentUser.role === 'admin' && (
                                            <div className="absolute top-2 right-2 flex space-x-1 bg-white/80 p-1 rounded backdrop-blur-sm border border-gray-100 shadow-sm">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); startEditFaq(faq); }}
                                                    className="text-gray-400 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50 transition-colors"
                                                    title="Bearbeiten"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <div className="w-px bg-gray-200 my-1"></div>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteFaq(faq.id); }}
                                                    className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors"
                                                    title="Löschen"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                ))
            ) : (
                <p className="text-gray-500 text-sm italic text-center py-4">Keine FAQs vorhanden.</p>
            )}
        </div>
      </div>

      {/* Downloads Section */}
      <div className="bg-white rounded-lg shadow p-6 mt-8">
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
                <Download size={18} className="mr-2 text-red-600" />
                Downloads & Ressourcen
            </h3>
            {currentUser.role === 'admin' && (
                <button 
                    onClick={() => setIsAddingDownload(!isAddingDownload)}
                    className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded flex items-center transition-colors"
                >
                    <Plus size={14} className="mr-1" />
                    Datei hinzufügen
                </button>
            )}
        </div>

        {isAddingDownload && (
            <form onSubmit={handleAddDownload} className="bg-gray-50 p-4 rounded mb-6 border border-gray-200 animate-in slide-in-from-top-2">
                <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Titel</label>
                    <input 
                        type="text" 
                        className="w-full border rounded p-2 text-sm focus:ring-red-500 focus:border-red-500"
                        value={downloadTitle}
                        onChange={(e) => setDownloadTitle(e.target.value)}
                        placeholder="z.B. DTF Farbprofil"
                        required
                    />
                </div>
                <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                    <input 
                        type="text" 
                        className="w-full border rounded p-2 text-sm focus:ring-red-500 focus:border-red-500"
                        value={downloadDesc}
                        onChange={(e) => setDownloadDesc(e.target.value)}
                        placeholder="Kurze Beschreibung..."
                    />
                </div>
                <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Datei</label>
                    <input 
                        type="file" 
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
                        onChange={(e) => setDownloadFile(e.target.files ? e.target.files[0] : null)}
                        required
                    />
                </div>
                <div className="flex justify-end space-x-2">
                    <button type="button" onClick={() => setIsAddingDownload(false)} className="text-gray-500 text-sm px-3 py-1">Abbrechen</button>
                    <button type="submit" className="bg-red-600 text-white text-sm px-3 py-1 rounded hover:bg-red-700">Hochladen</button>
                </div>
            </form>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {downloads.map(download => (
                <div key={download.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 transition-colors group relative">
                    <div>
                        <h4 className="font-medium text-gray-800">{download.title}</h4>
                        {download.description && <p className="text-sm text-gray-500 mt-1">{download.description}</p>}
                        <p className="text-xs text-gray-400 mt-1 truncate max-w-[200px]" title={download.file_name}>{download.file_name}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <a 
                            href={`/downloads/${download.file_name}`} 
                            download={download.file_name}
                            className="bg-gray-100 text-gray-600 p-2 rounded-full group-hover:bg-red-50 group-hover:text-red-600 transition-colors"
                            title="Herunterladen"
                        >
                            <Download size={20} />
                        </a>
                        {currentUser.role === 'admin' && (
                            <button 
                                onClick={() => handleDeleteDownload(download.id)}
                                className="text-gray-400 hover:text-red-600 p-1"
                                title="Löschen"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                </div>
            ))}
            {downloads.length === 0 && (
                <div className="col-span-full text-center py-8 text-gray-500 italic">
                    Keine Downloads verfügbar.
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
