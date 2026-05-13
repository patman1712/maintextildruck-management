import { useAppStore, Order } from "@/store";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export default function OrdersTrash() {
  const fetchData = useAppStore((state) => state.fetchData);
  const currentUser = useAppStore((state) => state.currentUser);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAccess = currentUser?.role === "admin";

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orders?trash=true", {
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Konnte Papierkorb nicht laden.");

      const mapped: Order[] = (data.data || []).map((o: any) => ({
        id: o.id,
        title: o.title,
        orderNumber: o.orderNumber,
        customerId: o.customerId,
        customerName: o.customer_name,
        customerContactPerson: o.customer_contact_person,
        customerEmail: o.customer_email,
        customerPhone: o.customer_phone,
        customerAddress: o.customer_address,
        deadline: o.deadline,
        status: o.status,
        steps: {
          processing: !!o.processing,
          produced: !!o.produced,
          invoiced: !!o.invoiced,
        },
        printStatus: o.printStatus,
        createdAt: o.created_at,
        description: o.description,
        employees: o.employees || [],
        files: o.files || [],
        deletedAt: o.deletedAt ?? o.deleted_at ?? null,
        deletedBy: o.deletedBy ?? o.deleted_by ?? null,
      }));

      setOrders(mapped);
    } catch (e: any) {
      setError(e?.message || "Fehler beim Laden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canAccess) return;
    load();
  }, [canAccess]);

  const rows = useMemo(() => {
    return [...orders].sort((a, b) => {
      const at = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
      const bt = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
      return bt - at;
    });
  }, [orders]);

  const handleRestore = async (id: string) => {
    try {
      await fetch(`/api/orders/${id}/restore`, { method: "POST" });
      await fetchData();
      setOrders((prev) => prev.filter((o) => o.id !== id));
    } catch (e) {
      await load();
    }
  };

  const handleEmpty = async () => {
    if (!confirm("Papierkorb wirklich leeren? Gelöschte Aufträge werden endgültig entfernt.")) return;
    try {
      const res = await fetch("/api/orders/trash/empty", { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Papierkorb leeren fehlgeschlagen.");
      await fetchData();
      await load();
    } catch (e: any) {
      alert(e?.message || "Papierkorb leeren fehlgeschlagen.");
    }
  };

  if (!canAccess) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-lg shadow p-6 text-gray-700">
          Kein Zugriff.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Papierkorb</h1>
          <p className="text-sm text-gray-500">Gelöschte Aufträge können wiederhergestellt oder endgültig entfernt werden.</p>
        </div>
        <button
          onClick={handleEmpty}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          disabled={loading || rows.length === 0}
        >
          <Trash2 size={18} />
          Papierkorb leeren
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {loading ? "Lade..." : `${rows.length} Aufträge im Papierkorb`}
          </div>
          <button
            onClick={load}
            className="text-sm text-gray-600 hover:text-gray-900"
            disabled={loading}
          >
            Aktualisieren
          </button>
        </div>

        {error && (
          <div className="px-6 py-4 bg-red-50 text-red-700 text-sm border-b border-red-100">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Auftrag</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kunde</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gelöscht am</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gelöscht von</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aktion</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map((o) => {
                const deletedAt = o.deletedAt ? new Date(o.deletedAt).toLocaleString("de-DE") : "—";
                const deletedBy = o.deletedBy || "—";
                const title = o.orderNumber ? `${o.orderNumber} – ${o.title}` : o.title;
                return (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{title}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{o.customerName}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{deletedAt}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{deletedBy}</td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleRestore(o.id)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm transition-colors"
                      >
                        <ArchiveRestore size={16} />
                        Wiederherstellen
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && !loading && (
                <tr>
                  <td className="px-6 py-10 text-center text-sm text-gray-500" colSpan={5}>
                    Papierkorb ist leer.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

