import { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, ShoppingCart, Archive, Users, Folder, LogOut, Menu, X, Shield, User, Printer, Zap } from "lucide-react";
import { useAppStore } from "@/store";

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { id: 'orders_new', label: 'Auftrag erfassen', to: '/dashboard/orders/new', icon: FileText },
  { id: 'orders', label: 'Aktuelle Aufträge', to: '/dashboard/orders', icon: Folder },
  { id: 'orders_finished', label: 'Fertige Aufträge', to: '/dashboard/orders/finished', icon: Archive },
  { id: 'inventory', label: 'Warenbestellung', to: '/dashboard/inventory', icon: ShoppingCart },
  { id: 'dtf', label: 'DTF-Bestellen', to: '/dashboard/dtf', icon: Printer },
  { id: 'dtf_pdfs', label: 'Fertige DTF PDFs', to: '/dashboard/dtf/pdfs', icon: FileText },
  { id: 'dtf_archive', label: 'Datei-Archiv', to: '/dashboard/dtf/archive', icon: Archive },
  { id: 'vector', label: 'Bildvektor', to: '/dashboard/vector', icon: Zap },
  { id: 'customers', label: 'Kundendateien', to: '/dashboard/customers', icon: Users },
];

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const currentUser = useAppStore((state) => state.currentUser);
  const logout = useAppStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [menuSettings, setMenuSettings] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/settings').then(res => res.json()).then(data => {
      if(data.success && data.settings) {
          if (data.settings.logo) setLogoUrl(data.settings.logo);
          if (data.settings.menu_config) {
              try { setMenuSettings(JSON.parse(data.settings.menu_config)); } catch(e){}
          }
      }
    });
  }, []);

  // Close mobile menu on route change
  if (mobileMenuOpen) {
    // We can't use useEffect here directly inside render loop for logic that might trigger re-renders
    // but we can listen to location changes in a useEffect
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-slate-900 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-30
          bg-gradient-to-b from-red-900 to-red-700 text-white transition-all duration-300 flex flex-col shadow-xl border-r border-red-800
          ${mobileMenuOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0"}
          ${sidebarOpen ? "md:w-64" : "md:w-20"}
        `}
      >
        <div className="h-16 flex items-center justify-center border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center space-x-2 px-4">
            {(sidebarOpen || mobileMenuOpen) ? (
              logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-12 max-w-[180px] object-contain" />
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full bg-red-700 flex items-center justify-center text-white font-bold text-sm shadow-md">M</div>
                  <span className="font-bold tracking-wider text-lg text-slate-800">MAIN<span className="text-red-600 text-xs ml-1">TD</span></span>
                </>
              )
            ) : (
              logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-10 w-10 object-contain" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-red-700 flex items-center justify-center text-white font-bold text-xl shadow-md">M</div>
              )
            )}
          </div>
        </div>

        <nav className="flex-1 py-6 space-y-2 px-2 overflow-y-auto">
          {MENU_ITEMS.map(item => {
              const isHidden = menuSettings[item.id] === false;
              // Hide if hidden (for everyone, including admin)
              if (isHidden) return null;
              
              const Icon = item.icon;
              return (
                  <NavItem 
                      key={item.id}
                      icon={<Icon />} 
                      label={item.label} 
                      to={item.to} 
                      isOpen={sidebarOpen || mobileMenuOpen} 
                      onClick={() => setMobileMenuOpen(false)} 
                  />
              );
          })}
          
          {currentUser?.role === 'admin' && (
             <>
                <NavItem icon={<Shield />} label="Mitarbeiter" to="/dashboard/employees" isOpen={sidebarOpen || mobileMenuOpen} onClick={() => setMobileMenuOpen(false)} />
                <NavItem icon={<Shield />} label="Einstellungen" to="/dashboard/admin" isOpen={sidebarOpen || mobileMenuOpen} onClick={() => setMobileMenuOpen(false)} />
             </>
          )}
        </nav>

        <div className="p-4 border-t border-red-800 space-y-2 shrink-0">
          <Link to="/dashboard/profile" onClick={() => setMobileMenuOpen(false)} className="flex items-center w-full space-x-2 text-red-200 hover:text-white transition-colors p-2 rounded hover:bg-white/10">
             <User size={20} />
             {(sidebarOpen || mobileMenuOpen) && <span>Mein Profil</span>}
          </Link>

          <button onClick={handleLogout} className="flex items-center w-full space-x-2 text-red-200 hover:text-white transition-colors p-2 rounded hover:bg-white/10">
            <LogOut size={20} />
            {(sidebarOpen || mobileMenuOpen) && <span>Abmelden</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Header */}
        <header className="h-16 bg-gradient-to-r from-red-800 to-red-600 shadow-md flex items-center justify-between px-4 md:px-6 border-b border-red-700 shrink-0">
          <div className="flex items-center">
            {/* Mobile Hamburger */}
            <button onClick={() => setMobileMenuOpen(true)} className="text-white hover:text-red-100 focus:outline-none md:hidden mr-4">
              <Menu size={24} />
            </button>
            
            {/* Desktop Toggle */}
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white hover:text-red-100 focus:outline-none hidden md:block">
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
          
          <div className="flex items-center space-x-3 md:space-x-4">
             <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-white">{currentUser?.name || 'Benutzer'}</p>
                <p className="text-xs text-red-100">{currentUser?.role === 'admin' ? 'Administrator' : 'Mitarbeiter'}</p>
             </div>
             <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white flex items-center justify-center text-red-700 font-bold border-2 border-red-200 text-sm md:text-base shadow-sm">
                {currentUser?.name?.charAt(0) || 'U'}
             </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-4 md:p-6 bg-gray-50 w-full">
           <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavItem({ icon, label, to, isOpen, onClick }: { icon: React.ReactNode, label: string, to: string, isOpen: boolean, onClick?: () => void }) {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== "/dashboard" && location.pathname.startsWith(to));

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 group ${
        isActive
          ? "bg-white text-red-700 font-bold shadow-md" 
          : "text-red-100 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className={`${isActive ? "text-red-700" : "text-red-300 group-hover:text-white"} min-w-[24px]`}>{icon}</span>
      {isOpen && <span className={`font-medium whitespace-nowrap ${isActive ? "text-red-700" : "text-red-100 group-hover:text-white"}`}>{label}</span>}
    </Link>
  );
}
