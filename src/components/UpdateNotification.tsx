import React from 'react';
import { RefreshCw, Zap, X } from 'lucide-react';

interface UpdateNotificationProps {
  isOpen: boolean;
  onReload: () => void;
  onClose: () => void;
}

export default function UpdateNotification({ isOpen, onReload, onClose }: UpdateNotificationProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all scale-100 border-t-4 border-red-600">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center space-x-3">
              <div className="bg-red-100 p-2 rounded-full">
                <Zap className="text-red-600 h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">
                Update verfügbar
              </h3>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="space-y-3">
            <p className="text-gray-600 leading-relaxed">
              Eine neue Version der <span className="font-semibold text-red-600">Maintextildruck Management App</span> ist verfügbar.
            </p>
            <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
              Bitte laden Sie die Seite neu, um die neuesten Funktionen, Fehlerbehebungen und Verbesserungen zu erhalten.
            </p>
          </div>
        </div>
        
        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 transition-all shadow-sm"
          >
            Später
          </button>
          <button
            onClick={onReload}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded-lg shadow-md hover:shadow-lg transform active:scale-95 transition-all flex items-center"
          >
            <RefreshCw size={16} className="mr-2 animate-spin-slow" />
            Jetzt aktualisieren
          </button>
        </div>
      </div>
    </div>
  );
}
