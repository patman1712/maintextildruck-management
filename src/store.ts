
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
  customerId?: string; // Optional for now to support legacy orders
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  deadline: string;
  status: 'active' | 'completed' | 'cancelled' | 'archived';
  steps: OrderSteps;
  createdAt: string;
  description?: string;
  employees: string[];
  files: { name: string; type: 'preview' | 'print' | 'vector'; url?: string; file?: File; customName?: string }[];
}

interface AppState {
  orders: Order[];
  customers: Customer[];
  loading: boolean;
  fetchData: () => Promise<void>;
  addOrder: (order: Order) => Promise<void>;
  addCustomer: (customer: Customer) => Promise<void>;
  updateCustomer: (id: string, updatedCustomer: Partial<Customer>) => Promise<void>;
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

      // Map Supabase data to frontend interface
      const mappedOrders: Order[] = (ordersData.data || []).map((o: any) => ({
        id: o.id,
        title: o.title,
        customerId: o.customerId,
        customerName: o.customer_name,
        customerEmail: o.customer_email,
        customerPhone: o.customer_phone,
        customerAddress: o.customer_address,
        deadline: o.deadline,
        status: o.status,
        steps: {
          processing: o.processing,
          produced: o.produced,
          invoiced: o.invoiced
        },
        createdAt: o.created_at,
        description: o.description,
        employees: o.employees || [],
        files: o.files || []
      }));

      if (customersData.success && ordersData.success) {
        set({ 
          customers: customersData.data, 
          orders: mappedOrders 
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
      
      const orderPayload = {
        id: order.id,
        title: order.title,
        customer_id: order.customerId,
        customer_name: order.customerName,
        customer_email: order.customerEmail,
        customer_phone: order.customerPhone,
        customer_address: order.customerAddress,
        deadline: order.deadline,
        status: order.status,
        processing: order.steps.processing,
        produced: order.steps.produced,
        invoiced: order.steps.invoiced,
        description: order.description,
        employees: order.employees,
        files: order.files
      };

      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
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

  updateCustomer: async (id, updatedCustomer) => {
    try {
      set((state) => ({
        customers: state.customers.map((c) => (c.id === id ? { ...c, ...updatedCustomer } : c))
      }));

      await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCustomer)
      });
    } catch (error) {
      console.error('Error updating customer:', error);
    }
  },

  updateOrder: async (id, updatedOrder) => {
    try {
      set((state) => ({
        orders: state.orders.map((o) => (o.id === id ? { ...o, ...updatedOrder } : o))
      }));

      const updatePayload: any = {};
      if (updatedOrder.title !== undefined) updatePayload.title = updatedOrder.title;
      if (updatedOrder.customerId !== undefined) updatePayload.customer_id = updatedOrder.customerId;
      if (updatedOrder.customerName !== undefined) updatePayload.customer_name = updatedOrder.customerName;
      if (updatedOrder.customerEmail !== undefined) updatePayload.customer_email = updatedOrder.customerEmail;
      if (updatedOrder.customerPhone !== undefined) updatePayload.customer_phone = updatedOrder.customerPhone;
      if (updatedOrder.customerAddress !== undefined) updatePayload.customer_address = updatedOrder.customerAddress;
      if (updatedOrder.deadline !== undefined) updatePayload.deadline = updatedOrder.deadline;
      if (updatedOrder.status !== undefined) updatePayload.status = updatedOrder.status;
      if (updatedOrder.description !== undefined) updatePayload.description = updatedOrder.description;
      if (updatedOrder.employees !== undefined) updatePayload.employees = updatedOrder.employees;
      if (updatedOrder.files !== undefined) updatePayload.files = updatedOrder.files;
      if (updatedOrder.steps) {
        if (updatedOrder.steps.processing !== undefined) updatePayload.processing = updatedOrder.steps.processing;
        if (updatedOrder.steps.produced !== undefined) updatePayload.produced = updatedOrder.steps.produced;
        if (updatedOrder.steps.invoiced !== undefined) updatePayload.invoiced = updatedOrder.steps.invoiced;
      }

      await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
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
