import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, ShoppingCart, Archive, Users, Folder, LogOut, Menu, X, Shield, User } from "lucide-react";
import { useAppStore } from "@/store";

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const currentUser = useAppStore((state) => state.currentUser);
  const logout = useAppStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-slate-900">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-white text-slate-800 transition-all duration-300 flex flex-col shadow-xl z-20 border-r border-gray-200`}
      >
        <div className="h-16 flex items-center justify-center border-b border-gray-200 bg-gradient-to-r from-red-800 to-red-600">
          {sidebarOpen ? (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-red-700 font-bold text-sm shadow-md">M</div>
              <span className="font-bold tracking-wider text-lg text-white">MAIN<span className="text-red-200 text-xs ml-1">TD</span></span>
            </div>
          ) : (
             <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-red-700 font-bold text-xl shadow-md">M</div>
          )}
        </div>

        <nav className="flex-1 py-6 space-y-2 px-2 overflow-y-auto">
          <NavItem icon={<LayoutDashboard />} label="Dashboard" to="/dashboard" isOpen={sidebarOpen} />
          <NavItem icon={<FileText />} label="Auftrag erfassen" to="/dashboard/orders/new" isOpen={sidebarOpen} />
          <NavItem icon={<Folder />} label="Aktuelle Aufträge" to="/dashboard/orders" isOpen={sidebarOpen} />
          <NavItem icon={<Archive />} label="Fertige Aufträge" to="/dashboard/orders/finished" isOpen={sidebarOpen} />
          <NavItem icon={<ShoppingCart />} label="Warenbestellung" to="/dashboard/inventory" isOpen={sidebarOpen} />
          <NavItem icon={<Users />} label="Kundendateien" to="/dashboard/customers" isOpen={sidebarOpen} />
          
          {currentUser?.role === 'admin' && (
             <NavItem icon={<Shield />} label="Mitarbeiter" to="/dashboard/employees" isOpen={sidebarOpen} />
          )}
        </nav>

        <div className="p-4 border-t border-gray-200 space-y-2">
          <Link to="/dashboard/profile" className="flex items-center w-full space-x-2 text-slate-500 hover:text-red-600 transition-colors p-2 rounded hover:bg-red-50">
             <User size={20} />
             {sidebarOpen && <span>Mein Profil</span>}
          </Link>

          <button onClick={handleLogout} className="flex items-center w-full space-x-2 text-slate-500 hover:text-red-600 transition-colors p-2 rounded hover:bg-red-50">
            <LogOut size={20} />
            {sidebarOpen && <span>Abmelden</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-6 border-b border-gray-200">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-600 hover:text-gray-900 focus:outline-none">
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          
          <div className="flex items-center space-x-4">
             <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-800">{currentUser?.name || 'Benutzer'}</p>
                <p className="text-xs text-gray-500">{currentUser?.role === 'admin' ? 'Administrator' : 'Mitarbeiter'}</p>
             </div>
             <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold border-2 border-red-50">
                {currentUser?.name?.charAt(0) || 'U'}
             </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-6">
           <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavItem({ icon, label, to, isOpen }: { icon: React.ReactNode, label: string, to: string, isOpen: boolean }) {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== "/dashboard" && location.pathname.startsWith(to));

  return (
    <Link
      to={to}
      className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 group ${
        isActive
          ? "bg-gradient-to-r from-red-700 to-red-600 text-white shadow-md" 
          : "text-slate-500 hover:bg-red-50 hover:text-red-700"
      }`}
    >
      <span className={`${isActive ? "text-white" : "text-slate-400 group-hover:text-red-700"}`}>{icon}</span>
      {isOpen && <span className={`font-medium whitespace-nowrap ${isActive ? "text-white" : "text-slate-600 group-hover:text-red-700"}`}>{label}</span>}
    </Link>
  );
}
