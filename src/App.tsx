import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import DashboardLayout from "@/pages/Dashboard";
import DashboardHome from "@/pages/DashboardHome";
import NewOrder from "@/pages/NewOrder";
import OrderList from "@/pages/OrderList";
import EditOrder from "@/pages/EditOrder";
import OrderDetails from "@/pages/OrderDetails";
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
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="orders/new" element={<NewOrder />} />
          <Route path="orders" element={<OrderList />} />
          <Route path="orders/finished" element={<OrderList filter="completed" />} />
          <Route path="orders/:id" element={<OrderDetails />} />
          <Route path="orders/:id/edit" element={<EditOrder />} />
          <Route path="*" element={<div className="p-8 text-center text-gray-500">Diese Seite ist noch in Arbeit...</div>} />
        </Route>
      </Routes>
    </Router>
  );
}
