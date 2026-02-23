import { useState, useEffect } from "react";
import { useAppStore } from "@/store";
import { Shield, Save, RotateCcw, AlertTriangle } from "lucide-react";

export default function AdminSettings() {
  const orders = useAppStore((state) => state.orders);
  const loading = useAppStore((state) => state.loading);
  const fetchData = useAppStore((state) => state.fetchData);
  const updateOrder = useAppStore((state) => state.updateOrder);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [nextOrderNumber, setNextOrderNumber] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [manualNextNumber, setManualNextNumber] = useState(1);

  // Calculate current max number
  useEffect(() => {
    const prefix = `${currentYear}-`;
    const currentYearOrders = orders.filter(o => 
        (o.orderNumber && o.orderNumber.startsWith(prefix))
    );

    let maxNum = 0;
    currentYearOrders.forEach(o => {
        if (o.orderNumber && o.orderNumber.startsWith(prefix)) {
            const numPart = parseInt(o.orderNumber.split('-')[1]);
            if (!isNaN(numPart) && numPart > maxNum) {
                maxNum = numPart;
            }
        }
    });

    setNextOrderNumber(maxNum + 1);
    if (!isEditing) {
        setManualNextNumber(maxNum + 1);
    }
  }, [orders, currentYear, isEditing]);

  const handleSaveCounter = async () => {
    // To "set" the counter, we essentially need to ensure the NEXT order picks this up.
    // Our logic in NewOrder.tsx calculates MAX + 1.
    // So to force the next number to be X, we need a dummy order with number X-1?
    // OR we change the logic in NewOrder to look at a setting?
    // BUT the user asked to "edit the number circle".
    // Since our logic is "Max + 1", we can't easily "reset" it to a lower number if higher numbers exist without deleting them.
    // However, we CAN create a "placeholder" system setting if we had a settings table.
    // BUT we don't have a settings table yet.
    
    // Alternative: We create a dummy order with the number (X-1) so the next one is X.
    // But that's messy.
    
    // Better approach: Since I cannot change the "Max+1" logic without a persistent storage for "Next Number",
    // I will explain to the user how it works: It always takes the highest number.
    // If they want to INCREASE it, we can create a dummy placeholder order? No.
    
    // Actually, maybe we should just create a settings table?
    // Or just let them know they can't change it easily downwards?
    
    // Wait, if they want to START at 1000 for example:
    // We can create a hidden "seed" order with number "2024-0999" so the next is "2024-1000".
    
    if (manualNextNumber <= nextOrderNumber && manualNextNumber !== 1) {
        alert("Die Nummer kann nicht niedriger gesetzt werden als die aktuell höchste vergebene Nummer (" + (nextOrderNumber - 1) + ").");
        return;
    }

    if (confirm(`Möchten Sie den Nummernkreis wirklich auf ${manualNextNumber} setzen?\nDazu wird ein technischer Platzhalter-Auftrag mit der Nummer ${currentYear}-${String(manualNextNumber - 1).padStart(4, '0')} erstellt.`)) {
        // Create placeholder order
        const seedNumber = manualNextNumber - 1;
        const seedOrderNumber = `${currentYear}-${String(seedNumber).padStart(4, '0')}`;
        
        await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: `seed-${seedOrderNumber}`,
                title: 'System-Platzhalter für Nummernkreis',
                order_number: seedOrderNumber,
                customer_name: 'System',
                status: 'archived', // Hidden
                deadline: new Date().toISOString(),
                description: 'Dieser Auftrag dient nur dazu, den Nummernkreis zu definieren. Bitte nicht löschen, solange keine höheren Nummern existieren.',
                files: [],
                employees: []
            })
        });
        
        fetchData();
        setIsEditing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
        <Shield className="mr-2 text-red-600" />
        Admin Einstellungen
      </h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2">Auftragsnummern</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <p className="text-sm text-gray-600 mb-4">
                    Hier können Sie den Nummernkreis für Aufträge verwalten.
                    Das System vergibt Nummern automatisch im Format <strong>YYYY-XXXX</strong> (z.B. {currentYear}-0001).
                </p>
                
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Aktuelles Jahr:</span>
                        <span className="text-sm font-bold">{currentYear}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Nächste Auftragsnummer:</span>
                        <span className="text-lg font-bold text-red-600">
                            {currentYear}-{String(isEditing ? manualNextNumber : nextOrderNumber).padStart(4, '0')}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col justify-center">
                {!isEditing ? (
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="bg-white border border-gray-300 text-slate-700 px-4 py-2 rounded shadow-sm hover:bg-gray-50 flex items-center justify-center"
                    >
                        <Save size={16} className="mr-2" />
                        Nummernkreis anpassen
                    </button>
                ) : (
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <label className="block text-xs font-bold text-yellow-800 mb-2 uppercase">Nächste Laufnummer setzen</label>
                        <div className="flex space-x-2 mb-3">
                            <input 
                                type="number" 
                                className="flex-1 border-yellow-300 rounded p-2 text-sm focus:ring-yellow-500 focus:border-yellow-500"
                                value={manualNextNumber}
                                onChange={(e) => setManualNextNumber(parseInt(e.target.value) || 1)}
                                min={nextOrderNumber}
                            />
                        </div>
                        <div className="flex space-x-2">
                            <button 
                                onClick={handleSaveCounter}
                                className="flex-1 bg-yellow-600 text-white px-3 py-2 rounded text-sm hover:bg-yellow-700"
                            >
                                Speichern
                            </button>
                            <button 
                                onClick={() => { setIsEditing(false); setManualNextNumber(nextOrderNumber); }}
                                className="px-3 py-2 text-yellow-700 hover:bg-yellow-100 rounded"
                            >
                                <RotateCcw size={18} />
                            </button>
                        </div>
                        <div className="mt-3 flex items-start text-xs text-yellow-700">
                            <AlertTriangle size={12} className="mr-1 mt-0.5 shrink-0" />
                            <p>Achtung: Das Hochsetzen erstellt einen unsichtbaren Platzhalter-Auftrag. Ein Zurücksetzen ist nur durch Löschen der Aufträge möglich.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}