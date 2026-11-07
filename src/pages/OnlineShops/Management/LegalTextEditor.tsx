import React, { useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

// Toolbar-Konfiguration als stabile Konstante (verhindert Re-Instanziierung des Editors)
const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'clean'],
  ],
};

interface LegalTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * Editor für Rechtstexte mit Umschalter zwischen visueller Bearbeitung (Quill)
 * und direktem HTML-Quelltext, damit HTML-Code eingefügt/bearbeitet werden kann.
 */
const LegalTextEditor: React.FC<LegalTextEditorProps> = ({ value, onChange, placeholder }) => {
  const [mode, setMode] = useState<'visual' | 'html'>('visual');

  const btnClass = (active: boolean) =>
    `px-3 py-1 text-xs font-medium rounded transition-colors ${
      active ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    }`;

  return (
    <div>
      <div className="flex justify-end gap-1 mb-1">
        <button type="button" onClick={() => setMode('visual')} className={btnClass(mode === 'visual')}>
          Visuell
        </button>
        <button type="button" onClick={() => setMode('html')} className={btnClass(mode === 'html')}>
          HTML-Quelltext
        </button>
      </div>

      {mode === 'visual' ? (
        <div className="bg-white rounded overflow-hidden border border-slate-300">
          <ReactQuill
            theme="snow"
            value={value || ''}
            onChange={onChange}
            placeholder={placeholder}
            modules={QUILL_MODULES}
          />
        </div>
      ) : (
        <div className="border border-slate-300 rounded overflow-hidden">
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            spellCheck={false}
            className="w-full h-56 p-3 font-mono text-xs text-slate-800 resize-y focus:outline-none"
          />
          <div className="bg-slate-50 border-t border-slate-200 px-3 py-1 text-xs text-slate-500">
            HTML-Code direkt einfügen/bearbeiten – wird auf der Shop-Seite als HTML gerendert.
          </div>
        </div>
      )}
    </div>
  );
};

export default LegalTextEditor;
