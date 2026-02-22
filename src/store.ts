
import { create } from 'zustand';

export interface OrderSteps {
  processing: boolean; // In Bearbeitung
  produced: boolean;   // Fertig Produziert
  invoiced: boolean;   // Rechnung geschrieben
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

export interface Order {
  id: string;
  title: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  deadline: string;
  status: 'active' | 'completed' | 'cancelled';
  steps: OrderSteps;
  createdAt: string;
  description?: string;
  employees: string[];
  files: { name: string; type: 'preview' | 'print' | 'vector'; url?: string }[];
}

interface AppState {
  orders: Order[];
  customers: Customer[];
  loading: boolean;
  fetchData: () => Promise<void>;
  addOrder: (order: Order) => Promise<void>;
  addCustomer: (customer: Customer) => Promise<void>;
  updateOrder: (id: string, updatedOrder: Partial<Order>) => Promise<void>;
  updateOrderStatus: (id: string, status: Order['status']) => Promise<void>;
  toggleOrderStep: (id: string, step: keyof OrderSteps) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  orders: [],
  customers: [],
  loading: false,

  fetchData: async () => {
    set({ loading: true });
    try {
      const customersRes = await fetch('/api/customers');
      const customersData = await customersRes.json();
      
      const ordersRes = await fetch('/api/orders');
      const ordersData = await ordersRes.json();

      if (customersData.success && ordersData.success) {
        set({ 
          customers: customersData.data, 
          orders: ordersData.data 
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      set({ loading: false });
    }
  },

  addOrder: async (order) => {
    try {
      set((state) => ({ orders: [order, ...state.orders] }));
      
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });
    } catch (error) {
      console.error('Error adding order:', error);
    }
  },

  addCustomer: async (customer) => {
    try {
      set((state) => ({ customers: [...state.customers, customer] }));
      
      await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customer)
      });
    } catch (error) {
      console.error('Error adding customer:', error);
    }
  },

  updateOrder: async (id, updatedOrder) => {
    try {
      set((state) => ({
        orders: state.orders.map((o) => (o.id === id ? { ...o, ...updatedOrder } : o))
      }));

      await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedOrder)
      });
    } catch (error) {
      console.error('Error updating order:', error);
    }
  },

  updateOrderStatus: async (id, status) => {
    try {
      set((state) => ({
        orders: state.orders.map((o) => (o.id === id ? { ...o, status } : o))
      }));
      
      await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  },

  toggleOrderStep: async (id, step) => {
    const state = get();
    const order = state.orders.find(o => o.id === id);
    if (!order) return;

    const newSteps = { ...order.steps, [step]: !order.steps[step] };
    
    let newStatus = order.status;
    if (newSteps.processing && newSteps.produced && newSteps.invoiced) {
      newStatus = 'completed';
    } else if (order.status === 'completed') {
      newStatus = 'active';
    }

    set((state) => ({
      orders: state.orders.map((o) => (o.id === id ? { ...o, steps: newSteps, status: newStatus } : o))
    }));

    try {
      await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steps: newSteps, // Backend needs to handle steps object or individual fields
          // My backend implementation handles individual fields, so I need to send them individually or update backend
          // Let's send individual fields to match backend implementation
          processing: newSteps.processing,
          produced: newSteps.produced,
          invoiced: newSteps.invoiced,
          status: newStatus
        })
      });
    } catch (error) {
      console.error('Error toggling step:', error);
    }
  },
}));
