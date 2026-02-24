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
import AdminSettings from "@/pages/AdminSettings";
import PublicOrderProof from "@/pages/PublicOrderProof";
import ImageVector from "@/pages/ImageVector";
import FAQ from "@/pages/FAQ";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAppStore } from "@/store";
import { useEffect } from "react";

export default function App() {
  const fetchData = useAppStore((state) => state.fetchData);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/proof/:token" element={<PublicOrderProof />} />
        
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<DashboardHome />} />
          <Route path="orders/new" element={<NewOrder />} />
          <Route path="orders" element={<OrderList />} />
          <Route path="invoices" element={<InvoiceList />} />
          <Route path="orders/finished" element={<OrderList filter="completed" />} />
          <Route path="orders/:id" element={<OrderDetails />} />
          <Route path="orders/:id/edit" element={<EditOrder />} />
          <Route path="customers" element={<CustomerList />} />
          <Route path="customers/:id" element={<CustomerDetails />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="dtf" element={<DTFOrdering />} />
          <Route path="dtf/pdfs" element={<DTFPdfs />} />
          <Route path="dtf/archive" element={<FileArchive />} />
          <Route path="vector" element={<ImageVector />} />
          <Route path="employees" element={<Employees />} />
          <Route path="admin" element={<AdminSettings />} />
          <Route path="profile" element={<Profile />} />
          <Route path="faq" element={<FAQ />} />
          <Route path="*" element={<div className="p-8 text-center text-gray-500">Diese Seite ist noch in Arbeit...</div>} />
        </Route>
      </Routes>
    </Router>
  );
}
