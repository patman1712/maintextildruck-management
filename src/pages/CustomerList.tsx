import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "@/store";
import { Users, Search, Mail, Phone, MapPin, ArrowRight, Plus, X, Save } from "lucide-react";

export default function CustomerList() {
  const customers = useAppStore((state) => state.customers);
  const loading = useAppStore((state) => state.loading);
  const fetchData = useAppStore((state) => state.fetchData);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', contact_person: '', email: '', phone: '', address: '' });

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name) return;
    
    // Generate simple ID
    const id = Math.random().toString(36).substr(2, 9);
    
    try {
        await fetch('/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, ...newCustomer })
        });
        fetchData();
        setIsAdding(false);
        setNewCustomer({ name: '', contact_person: '', email: '', phone: '', address: '' });
    } catch (err) {
        console.error("Failed to create customer", err);
        alert("Fehler beim Erstellen des Kunden");
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Lade Kundendaten...</div>;

  const filteredCustomers = customers.filter((customer) => {
    return customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           customer.email.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center">
          <Users className="mr-2 text-red-600" />
          Kunden
        </h1>
        
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-auto">
              <input 
                type="text" 
                placeholder="Kunden suchen..." 
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 w-full md:w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            <button 
                onClick={() => setIsAdding(true)}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center justify-center transition-colors shadow-sm whitespace-nowrap"
            >
                <Plus size={18} className="mr-2" />
                Neuer Kunde
            </button>
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800">Neuen Kunden anlegen</h2>
                    <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleCreateCustomer}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vereinsname / Firmenname *</label>
                            <input 
                                className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-500 focus:border-red-500"
                                value={newCustomer.name}
                                onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                                required
                                placeholder="z.B. Sportverein XY"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ansprechpartner / Team</label>
                            <input 
                                className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-500 focus:border-red-500"
                                value={newCustomer.contact_person}
                                onChange={e => setNewCustomer({...newCustomer, contact_person: e.target.value})}
                                placeholder="z.B. Max Mustermann"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                            <input 
                                type="email"
                                className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-500 focus:border-red-500"
                                value={newCustomer.email}
                                onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
                                placeholder="kontakt@beispiel.de"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                            <input 
                                className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-500 focus:border-red-500"
                                value={newCustomer.phone}
                                onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                                placeholder="+49 123 456789"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                            <textarea 
                                className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-500 focus:border-red-500"
                                rows={3}
                                value={newCustomer.address}
                                onChange={e => setNewCustomer({...newCustomer, address: e.target.value})}
                                placeholder="Straße, PLZ, Ort"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <button 
                            type="button" 
                            onClick={() => setIsAdding(false)}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                        >
                            Abbrechen
                        </button>
                        <button 
                            type="submit"
                            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center"
                        >
                            <Save size={18} className="mr-2" />
                            Speichern
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.length > 0 ? (
          filteredCustomers.map((customer) => (
            <Link 
              key={customer.id} 
              to={`/dashboard/customers/${customer.id}`}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center text-red-700 font-bold text-lg border border-red-100">
                  {customer.name.charAt(0).toUpperCase()}
                </div>
                <ArrowRight className="text-gray-300 group-hover:text-red-600 transition-colors" size={20} />
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate" title={customer.name}>
                {customer.name}
              </h3>
              {customer.contact_person && (
                  <p className="text-sm text-gray-600 mb-2 truncate flex items-center">
                      <Users size={14} className="mr-2 flex-shrink-0" />
                      {customer.contact_person}
                  </p>
              )}
              
              <div className="space-y-2 text-sm text-gray-500">
                {customer.email && (
                  <div className="flex items-center truncate">
                    <Mail size={14} className="mr-2 flex-shrink-0" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center truncate">
                    <Phone size={14} className="mr-2 flex-shrink-0" />
                    <span className="truncate">{customer.phone}</span>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-start">
                    <MapPin size={14} className="mr-2 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{customer.address}</span>
                  </div>
                )}
              </div>
            </Link>
          ))
        ) : (
          <div className="col-span-full text-center py-12 bg-white rounded-lg border border-dashed border-gray-300 text-gray-500">
            Keine Kunden gefunden.
          </div>
        )}
      </div>
    </div>
  );
}
