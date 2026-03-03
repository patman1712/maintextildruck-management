import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import DashboardLayout from "@/pages/Dashboard";
import DashboardHome from "@/pages/DashboardHome";
import NewOrder from "@/pages/NewOrder";
import OrderList from "@/pages/OrderList";
import InvoiceList from "@/pages/InvoiceList";
import EditOrder from "@/pages/EditOrder";
import OrderDetails from "@/pages/OrderDetails";
import CustomerList from "@/pages/CustomerList";
import CustomerDetails from "@/pages/CustomerDetails";
import Employees from "@/pages/Employees";
import Profile from "@/pages/Profile";
import Inventory from "@/pages/Inventory";
import DTFOrdering from "@/pages/DTFOrdering";
import DTFPdfs from "@/pages/DTFPdfs";
import FileArchive from "@/pages/FileArchive";
import BackgroundRemover from "@/pages/BackgroundRemover";
import PreviewGenerator from "@/pages/PreviewGenerator";
import AdminSettings from "@/pages/AdminSettings";
import PublicOrderProof from "@/pages/PublicOrderProof";
import ImageVector from "@/pages/ImageVector";
import FAQ from "@/pages/FAQ";
import OnlineShops from "@/pages/OnlineShops/OnlineShops";
import ShopFrontend from "@/pages/OnlineShops/ShopFrontend";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAppStore } from "@/store";
import { useEffect, useRef, useState } from "react";
import UpdateNotification from "@/components/UpdateNotification";

export default function App() {
  const fetchData = useAppStore((state) => state.fetchData);
  const initialLoadTime = useRef(Date.now());
  const versionCheckInterval = useRef<any>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    fetchData();

    // Version Check Function
    const checkVersion = async () => {
        try {
            const res = await fetch('/api/health');
            const data = await res.json();
            
            if (data.success && data.startTime) {
                const serverStartTime = data.startTime;
                
                // Logic: If the server started significantly later than this page loaded,
                // it means a redeployment happened.
                // We add a 60s buffer to avoid reload loops if client/server times are slightly off or during the deployment window itself.
                if (serverStartTime > (initialLoadTime.current + 60000)) {
                    console.log("New version detected.");
                    setUpdateAvailable(true);
                }
            }
        } catch (e) {
            console.error("Version check failed", e);
        }
    };

    // Check every 2 minutes
    const intervalId = setInterval(checkVersion, 2 * 60 * 1000);
    
    // Also check shortly after load (e.g. 10s) to catch if we loaded a cached old version
    setTimeout(checkVersion, 10000);

    return () => {
        clearInterval(intervalId);
    };
  }, [fetchData]);

  return (
    <>
      <UpdateNotification 
        isOpen={updateAvailable} 
        onReload={() => window.location.reload()} 
        onClose={() => setUpdateAvailable(false)} 
      />
      <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/proof/:token" element={<PublicOrderProof />} />
        <Route path="/shop/:shopId" element={<ShopFrontend />} />
        
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<DashboardHome />} />
          <Route path="orders/new" element={<NewOrder />} />
          <Route path="orders" element={<OrderList source="manual" />} />
          <Route path="invoices" element={<InvoiceList />} />
          <Route path="orders/finished" element={<OrderList filter="completed" source="manual" />} />
          <Route path="orders/online" element={<OrderList source="online" />} />
          <Route path="orders/online/finished" element={<OrderList filter="completed" source="online" />} />
          <Route path="orders/:id" element={<OrderDetails />} />
          <Route path="orders/:id/edit" element={<EditOrder />} />
          <Route path="customers" element={<CustomerList />} />
          <Route path="customers/:id" element={<CustomerDetails />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="dtf" element={<DTFOrdering />} />
          <Route path="dtf/pdfs" element={<DTFPdfs />} />
          <Route path="dtf/archive" element={<FileArchive />} />
          <Route path="freisteller" element={<BackgroundRemover />} />
          <Route path="preview-generator" element={<PreviewGenerator />} />
          <Route path="vector" element={<ImageVector />} />
          <Route path="employees" element={<Employees />} />
          <Route path="shops" element={<OnlineShops />} />
          <Route path="admin" element={<AdminSettings />} />
          <Route path="profile" element={<Profile />} />
          <Route path="faq" element={<FAQ />} />
          <Route path="*" element={<div className="p-8 text-center text-gray-500">Diese Seite ist noch in Arbeit...</div>} />
        </Route>
      </Routes>
    </Router>
    </>
  );
}
