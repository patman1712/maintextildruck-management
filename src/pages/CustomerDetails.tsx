import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store";
import { ArrowLeft, User, FileText, Download, Printer, Phone, Mail, MapPin, Edit, Save, X } from "lucide-react";

export default function CustomerDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const customers = useAppStore((state) => state.customers);
  const orders = useAppStore((state) => state.orders);
  const loading = useAppStore((state) => state.loading);
  const fetchData = useAppStore((state) => state.fetchData);
  const updateCustomer = useAppStore((state) => state.updateCustomer);
  
  // Local state for editing
  const [isEditing, setIsEditing] = useState(false);
  const [editedCustomer, setEditedCustomer] = useState<{name: string, email: string, phone: string, address: string} | null>(null);
  
  const [customer, setCustomer] = useState(customers.find(c => c.id === id));
  const [customerOrders, setCustomerOrders] = useState(orders.filter(o => o.customerName === customer?.name));

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (loading) return;
    const foundCustomer = customers.find(c => c.id === id);
    if (foundCustomer) {
      setCustomer(foundCustomer);
      setEditedCustomer({
        name: foundCustomer.name,
        email: foundCustomer.email,
        phone: foundCustomer.phone,
        address: foundCustomer.address
      });
      // Filter orders by customer name (as we don't store customer ID in orders yet)
      setCustomerOrders(orders.filter(o => o.customerName === foundCustomer.name));
    } else {
      navigate("/dashboard/customers");
    }
  }, [id, customers, orders, navigate, loading]);

  const handleSave = async () => {
    if (!editedCustomer || !customer) return;
    
    await updateCustomer(customer.id, editedCustomer);
    setCustomer({ ...customer, ...editedCustomer });
    setIsEditing(false);
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Lade Kundendaten...</div>;
  if (!customer) return null;

  // Extract all print files (DTF) from customer's orders
  // Check if files exist and are arrays before filtering
  const printFiles = customerOrders.flatMap(order => 
    (order.files || [])
      .filter(f => f.type === 'print')
      .map(f => ({ ...f, orderTitle: order.title, orderDate: order.createdAt }))
  );

  const downloadFile = async (file: { name: string, url?: string }) => {
    if (!file.url) {
      alert(`Keine URL für ${file.name} vorhanden.`);
      return;
    }

    try {
      const response = await fetch(file.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(file.url, '_blank');
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ArrowLeft size={18} className="mr-1" /> Zurück zur Übersicht
      </button>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="bg-gray-50 px-8 py-6 border-b border-gray-200 flex items-center">
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold text-2xl mr-6 border border-red-200">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            {isEditing ? (
              <input 
                type="text" 
                value={editedCustomer?.name || ""} 
                onChange={(e) => setEditedCustomer(prev => ({...prev!, name: e.target.value}))}
                className="text-2xl font-bold text-slate-800 border border-gray-300 rounded px-2 py-1 w-full max-w-md focus:ring-red-500 focus:border-red-500"
              />
            ) : (
              <h1 className="text-2xl font-bold text-slate-800">{customer.name}</h1>
            )}
            <p className="text-gray-500 text-sm mt-1">Kunde seit {new Date().getFullYear()}</p>
          </div>
          
          <div className="ml-4">
            {isEditing ? (
              <div className="flex space-x-2">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                  title="Abbrechen"
                >
                  <X size={20} />
                </button>
                <button 
                  onClick={handleSave}
                  className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-full transition-colors"
                  title="Speichern"
                >
                  <Save size={20} />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsEditing(true)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                title="Bearbeiten"
              >
                <Edit size={20} />
              </button>
            )}
          </div>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Kontaktdaten</h3>
            <div className="space-y-4">
              <div className="flex items-center text-gray-700">
                <Mail className="mr-3 text-gray-400" size={20} />
                {isEditing ? (
                  <input 
                    type="email" 
                    value={editedCustomer?.email || ""} 
                    onChange={(e) => setEditedCustomer(prev => ({...prev!, email: e.target.value}))}
                    className="border border-gray-300 rounded px-2 py-1 w-full focus:ring-red-500 focus:border-red-500"
                    placeholder="E-Mail Adresse"
                  />
                ) : (
                  customer.email ? (
                    <a href={`mailto:${customer.email}`} className="hover:text-red-600 transition-colors">{customer.email}</a>
                  ) : (
                    <span className="text-gray-400 italic">Keine E-Mail hinterlegt</span>
                  )
                )}
              </div>
              
              <div className="flex items-center text-gray-700">
                <Phone className="mr-3 text-gray-400" size={20} />
                {isEditing ? (
                  <input 
                    type="tel" 
                    value={editedCustomer?.phone || ""} 
                    onChange={(e) => setEditedCustomer(prev => ({...prev!, phone: e.target.value}))}
                    className="border border-gray-300 rounded px-2 py-1 w-full focus:ring-red-500 focus:border-red-500"
                    placeholder="Telefonnummer"
                  />
                ) : (
                  customer.phone ? (
                    <a href={`tel:${customer.phone}`} className="hover:text-red-600 transition-colors">{customer.phone}</a>
                  ) : (
                    <span className="text-gray-400 italic">Keine Telefonnummer hinterlegt</span>
                  )
                )}
              </div>
              
              <div className="flex items-start text-gray-700">
                <MapPin className="mr-3 mt-1 text-gray-400" size={20} />
                {isEditing ? (
                  <textarea 
                    value={editedCustomer?.address || ""} 
                    onChange={(e) => setEditedCustomer(prev => ({...prev!, address: e.target.value}))}
                    className="border border-gray-300 rounded px-2 py-1 w-full focus:ring-red-500 focus:border-red-500"
                    placeholder="Adresse"
                    rows={3}
                  />
                ) : (
                  customer.address ? (
                    <span className="whitespace-pre-line">{customer.address}</span>
                  ) : (
                    <span className="text-gray-400 italic">Keine Adresse hinterlegt</span>
                  )
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Statistik</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center border border-blue-100">
                <span className="block text-2xl font-bold text-blue-700">{customerOrders.length}</span>
                <span className="text-sm text-blue-600">Aufträge Gesamt</span>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center border border-green-100">
                <span className="block text-2xl font-bold text-green-700">
                  {customerOrders.filter(o => o.status === 'completed').length}
                </span>
                <span className="text-sm text-green-600">Abgeschlossen</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DTF Files Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="px-8 py-6 border-b border-gray-200 bg-red-50">
          <h2 className="text-xl font-bold text-red-800 flex items-center">
            <Printer className="mr-2" />
            Gespeicherte Druckdaten (DTF)
          </h2>
          <p className="text-sm text-red-600 mt-1">
            Alle fertigen Druckdaten aus vergangenen Aufträgen dieses Kunden
          </p>
        </div>

        <div className="p-8">
          {printFiles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {printFiles.map((file, idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <div className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded uppercase tracking-wide">
                      DTF / PNG
                    </div>
                    <button 
                      onClick={() => downloadFile(file)}
                      className="text-gray-400 hover:text-red-600 transition-colors p-1"
                      title="Herunterladen"
                    >
                      <Download size={20} />
                    </button>
                  </div>
                  
                  <div className="h-32 bg-gray-100 rounded mb-3 flex items-center justify-center overflow-hidden border border-gray-100">
                    {file.url ? (
                      <img src={file.url} alt={file.name} className="w-full h-full object-contain" />
                    ) : (
                      <Printer size={32} className="text-gray-300" />
                    )}
                  </div>

                  <h4 className="font-medium text-gray-800 truncate mb-1" title={file.name}>
                    {file.name}
                  </h4>
                  <p className="text-xs text-gray-500 flex items-center">
                    <FileText size={12} className="mr-1" />
                    Aus: {file.orderTitle}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(file.orderDate).toLocaleDateString('de-DE')}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
              <Printer size={48} className="mx-auto text-gray-300 mb-4" />
              <p>Keine Druckdaten (DTF) für diesen Kunden gefunden.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
