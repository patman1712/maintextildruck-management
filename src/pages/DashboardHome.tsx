import { Folder, FileText, Archive, ShoppingCart } from "lucide-react";

export default function DashboardHome() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Aktive Aufträge" value="12" icon={<Folder className="text-blue-500" />} color="border-l-4 border-blue-500" />
        <StatCard title="Neue Bestellungen" value="5" icon={<FileText className="text-green-500" />} color="border-l-4 border-green-500" />
        <StatCard title="Fertige Aufträge" value="128" icon={<Archive className="text-purple-500" />} color="border-l-4 border-purple-500" />
        <StatCard title="Materialbedarf" value="3" icon={<ShoppingCart className="text-red-500" />} color="border-l-4 border-red-500" />
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
        <h2 className="text-xl font-bold mb-4 text-slate-800">Willkommen im Management System</h2>
        <p className="text-gray-600">Wählen Sie einen Bereich aus dem Menü, um zu beginnen.</p>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: string, icon: React.ReactNode, color: string }) {
  return (
    <div className={`bg-white p-6 rounded-lg shadow-sm flex items-center justify-between ${color}`}>
      <div>
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</p>
        <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
      </div>
      <div className="p-3 bg-gray-50 rounded-full">
        {icon}
      </div>
    </div>
  );
}
