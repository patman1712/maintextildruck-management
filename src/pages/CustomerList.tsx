import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "@/store";
import { Users, Search, Mail, Phone, MapPin, ArrowRight } from "lucide-react";

export default function CustomerList() {
  const customers = useAppStore((state) => state.customers);
  const loading = useAppStore((state) => state.loading);
  const fetchData = useAppStore((state) => state.fetchData);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
          Kundendateien
        </h1>
        
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
      </div>

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
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2 truncate" title={customer.name}>
                {customer.name}
              </h3>
              
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
