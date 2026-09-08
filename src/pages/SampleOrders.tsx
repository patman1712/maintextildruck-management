import React from 'react';
import { Wrench, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const SampleOrders: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Wrench className="text-yellow-600" size={32} />
        </div>
        <h1 className="text-2xl font-black uppercase italic tracking-tighter text-slate-800 mb-2">
          In Arbeit
        </h1>
        <p className="text-sm text-slate-500 mb-8 leading-relaxed">
          Die Musterbestellungen-Funktion befindet sich im Aufbau.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center px-6 py-3 bg-slate-800 text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-slate-700 shadow-lg transition-all"
        >
          <ArrowLeft size={16} className="mr-2" />
          Zurück zum Dashboard
        </Link>
      </div>
    </div>
  );
};

export default SampleOrders;
