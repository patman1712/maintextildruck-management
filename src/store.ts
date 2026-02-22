
import { create } from 'zustand';
import { supabase } from './lib/supabase';

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
  files: { name: string; type: 'preview' | 'print' | 'vector' }[];
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
      const { data: customersData, error: customersError } = await supabase.from('customers').select('*');
      if (customersError) throw customersError;

      const { data: ordersData, error: ordersError } = await supabase.from('orders').select('*');
      if (ordersError) throw ordersError;

      // Map Supabase data to frontend interface
      const mappedOrders: Order[] = (ordersData || []).map((o: any) => ({
        id: o.id,
        title: o.title,
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

      set({ customers: customersData as Customer[], orders: mappedOrders });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      set({ loading: false });
    }
  },

  addOrder: async (order) => {
    try {
      // Optimistic update
      set((state) => ({ orders: [order, ...state.orders] }));

      const { error } = await supabase.from('orders').insert({
        // id: order.id, // Let Supabase generate ID or use the one we generated? Better to let Supabase generate if we want UUIDs, but we generated one locally.
        // If we generated a UUID locally, we can use it.
        id: order.id,
        title: order.title,
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
        files: order.files,
        created_at: order.createdAt // Supabase handles this usually, but we can pass it
      });

      if (error) {
        console.error('Error adding order:', error);
        // Revert optimistic update? or just show error.
      }
    } catch (error) {
      console.error('Error adding order:', error);
    }
  },

  addCustomer: async (customer) => {
    try {
      set((state) => ({ customers: [...state.customers, customer] }));
      
      const { error } = await supabase.from('customers').insert({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address
      });

      if (error) console.error('Error adding customer:', error);
    } catch (error) {
      console.error('Error adding customer:', error);
    }
  },

  updateOrder: async (id, updatedOrder) => {
    try {
      set((state) => ({
        orders: state.orders.map((o) => (o.id === id ? { ...o, ...updatedOrder } : o))
      }));

      // Prepare update object for Supabase
      const updateData: any = {};
      if (updatedOrder.title !== undefined) updateData.title = updatedOrder.title;
      if (updatedOrder.customerName !== undefined) updateData.customer_name = updatedOrder.customerName;
      if (updatedOrder.customerEmail !== undefined) updateData.customer_email = updatedOrder.customerEmail;
      if (updatedOrder.customerPhone !== undefined) updateData.customer_phone = updatedOrder.customerPhone;
      if (updatedOrder.customerAddress !== undefined) updateData.customer_address = updatedOrder.customerAddress;
      if (updatedOrder.deadline !== undefined) updateData.deadline = updatedOrder.deadline;
      if (updatedOrder.status !== undefined) updateData.status = updatedOrder.status;
      if (updatedOrder.description !== undefined) updateData.description = updatedOrder.description;
      if (updatedOrder.employees !== undefined) updateData.employees = updatedOrder.employees;
      if (updatedOrder.files !== undefined) updateData.files = updatedOrder.files;
      if (updatedOrder.steps) {
        if (updatedOrder.steps.processing !== undefined) updateData.processing = updatedOrder.steps.processing;
        if (updatedOrder.steps.produced !== undefined) updateData.produced = updatedOrder.steps.produced;
        if (updatedOrder.steps.invoiced !== undefined) updateData.invoiced = updatedOrder.steps.invoiced;
      }

      const { error } = await supabase.from('orders').update(updateData).eq('id', id);
      if (error) console.error('Error updating order:', error);
    } catch (error) {
      console.error('Error updating order:', error);
    }
  },

  updateOrderStatus: async (id, status) => {
    try {
      set((state) => ({
        orders: state.orders.map((o) => (o.id === id ? { ...o, status } : o))
      }));
      
      const { error } = await supabase.from('orders').update({ status }).eq('id', id);
      if (error) console.error('Error updating order status:', error);
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  },

  toggleOrderStep: async (id, step) => {
    const state = get();
    const order = state.orders.find(o => o.id === id);
    if (!order) return;

    const newSteps = { ...order.steps, [step]: !order.steps[step] };
    
    // Auto-complete logic
    let newStatus = order.status;
    if (newSteps.processing && newSteps.produced && newSteps.invoiced) {
      newStatus = 'completed';
    } else if (order.status === 'completed') {
      newStatus = 'active';
    }

    // Optimistic update
    set((state) => ({
      orders: state.orders.map((o) => (o.id === id ? { ...o, steps: newSteps, status: newStatus } : o))
    }));

    try {
      const { error } = await supabase.from('orders').update({
        [step]: newSteps[step],
        status: newStatus
      }).eq('id', id);
      
      if (error) console.error('Error toggling step:', error);
    } catch (error) {
      console.error('Error toggling step:', error);
    }
  },
}));
