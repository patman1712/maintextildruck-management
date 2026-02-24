import { useState, useEffect } from 'react';
import { useAppStore } from '@/store';
import { HelpCircle, Plus, Trash2, ChevronDown, ChevronUp, Download } from 'lucide-react';

export default function FAQ() {
  const currentUser = useAppStore((state) => state.currentUser);
  
  const [faqs, setFaqs] = useState<any[]>([]);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [isAddingFaq, setIsAddingFaq] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");

  useEffect(() => {
    loadFaqs();
  }, []);

  const loadFaqs = () => {
    fetch('/api/faqs')
      .then(r => r.json())
      .then(d => {
        if(d.success) setFaqs(d.data);
      })
      .catch(err => console.error("Failed to load FAQs", err));
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
                                <p className="whitespace-pre-wrap">{faq.answer}</p>
                                {currentUser.role === 'admin' && (
                                    <div className="absolute top-2 right-2">
                                        <button 
                                            onClick={() => handleDeleteFaq(faq.id)}
                                            className="text-gray-400 hover:text-red-600 p-1"
                                            title="Löschen"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
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
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
            <Download size={18} className="mr-2 text-red-600" />
            Downloads & Ressourcen
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                <div>
                    <h4 className="font-medium text-gray-800">DTF Farbprofil (FOGRA39)</h4>
                    <p className="text-sm text-gray-500 mt-1">Standard ICC Profil für CMYK.</p>
                </div>
                <a 
                    href="/downloads/FOGRA39.icc" 
                    download="FOGRA39.icc"
                    className="bg-gray-100 text-gray-600 p-2 rounded-full group-hover:bg-red-50 group-hover:text-red-600 transition-colors"
                    title="Herunterladen"
                >
                    <Download size={20} />
                </a>
            </div>
        </div>
      </div>
    </div>
  );
}
