
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

export interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'employee';
  password?: string; // Only for creating/updating, usually not returned
  createdAt?: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  supplierId: string;
  supplierName?: string; // Helper for display
  itemName: string;
  itemNumber?: string;
  color?: string;
  size?: string;
  quantity: number;
  notes?: string;
  status: 'pending' | 'ordered' | 'received';
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
  files: { name: string; type: 'preview' | 'print' | 'vector'; url?: string; file?: File; customName?: string; thumbnail?: string }[];
  orderItems?: OrderItem[]; // New field
}

export interface Supplier {
  id: string;
  name: string;
  website?: string;
  customerNumber?: string;
  notes?: string;
  email?: string;
}

interface AppState {
  orders: Order[];
  customers: Customer[];
  users: User[];
  suppliers: Supplier[];
  currentUser: User | null;
  loading: boolean;
  
  fetchData: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  
  login: (user: User) => void;
  logout: () => void;
  
  addOrder: (order: Order) => Promise<void>;
  addCustomer: (customer: Customer) => Promise<void>;
  addUser: (user: Partial<User>) => Promise<void>;
  addSupplier: (supplier: Supplier) => Promise<void>;
  
  updateCustomer: (id: string, updatedCustomer: Partial<Customer>) => Promise<void>;
  updateOrder: (id: string, updatedOrder: Partial<Order>) => Promise<void>;
  updateUser: (id: string, updatedUser: Partial<User>) => Promise<void>;
  updateSupplier: (id: string, updatedSupplier: Partial<Supplier>) => Promise<void>;
  
  addOrderItem: (orderId: string, item: Omit<OrderItem, 'id' | 'orderId' | 'status'>) => Promise<void>;
  updateOrderItem: (orderId: string, itemId: string, updates: Partial<OrderItem>) => Promise<void>;
  deleteOrderItem: (orderId: string, itemId: string) => Promise<void>;
  ensureManualOrder: () => Promise<string>;
  
  updateOrderStatus: (id: string, status: Order['status']) => Promise<void>;
  toggleOrderStep: (id: string, step: keyof OrderSteps) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  orders: [],
  customers: [],
  users: [],
  suppliers: [],
  currentUser: JSON.parse(localStorage.getItem('currentUser') || 'null'),
  loading: false,

  fetchData: async () => {
    set({ loading: true });
    try {
      const customersRes = await fetch('/api/customers');
      const customersData = await customersRes.json();
      
      const ordersRes = await fetch('/api/orders');
      const ordersData = await ordersRes.json();
      
      const orderItemsRes = await fetch('/api/orders/items/all');
      const orderItemsData = await orderItemsRes.json();
      
      const suppliersRes = await fetch('/api/suppliers');
      const suppliersData = await suppliersRes.json();

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
        files: o.files || [],
        orderItems: (orderItemsData.data || [])
            .filter((i: any) => i.order_id === o.id)
            .map((i: any) => ({
                id: i.id,
                orderId: i.order_id,
                supplierId: i.supplier_id,
                supplierName: i.supplier_name,
                itemName: i.item_name,
                itemNumber: i.item_number,
                color: i.color,
                size: i.size,
                quantity: i.quantity,
                notes: i.notes,
                status: i.status
            }))
      }));
      
      const mappedSuppliers: Supplier[] = (suppliersData.data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        website: s.website,
        customerNumber: s.customer_number,
        notes: s.notes,
        email: s.email
      }));

      if (customersData.success && ordersData.success) {
        set({ 
          customers: customersData.data, 
          orders: mappedOrders,
          suppliers: mappedSuppliers
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      set({ loading: false });
    }
  },

  fetchUsers: async () => {
    try {
      const usersRes = await fetch('/api/users');
      const usersData = await usersRes.json();
      if (usersData.success) {
        set({ users: usersData.data });
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  },

  login: (user) => {
    set({ currentUser: user });
    localStorage.setItem('currentUser', JSON.stringify(user));
  },

  logout: () => {
    set({ currentUser: null });
    localStorage.removeItem('currentUser');
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

  addSupplier: async (supplier) => {
    try {
      set((state) => ({ suppliers: [...state.suppliers, supplier] }));
      
      await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: supplier.id,
          name: supplier.name,
          website: supplier.website,
          customerNumber: supplier.customerNumber,
          notes: supplier.notes,
          email: supplier.email
        })
      });
    } catch (error) {
      console.error('Error adding supplier:', error);
    }
  },

  updateSupplier: async (id, updatedSupplier) => {
    try {
      set((state) => ({
        suppliers: state.suppliers.map((s) => (s.id === id ? { ...s, ...updatedSupplier } : s))
      }));

      await fetch(`/api/suppliers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: updatedSupplier.name,
            website: updatedSupplier.website,
            customerNumber: updatedSupplier.customerNumber,
            notes: updatedSupplier.notes,
            email: updatedSupplier.email
        })
      });
    } catch (error) {
      console.error('Error updating supplier:', error);
    }
  },

  deleteSupplier: async (id) => {
    try {
      set((state) => ({
        suppliers: state.suppliers.filter((s) => s.id !== id)
      }));
      
      await fetch(`/api/suppliers/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error deleting supplier:', error);
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

  // Order Items can now belong to a dummy "Inventory Order" if no real order exists
  // We handle this by allowing orderId to be optional or point to a special ID?
  // Actually, we can create a hidden system order for "Manual Inventory Items" or create a new order on the fly.
  // Better: Create a hidden order with ID 'inventory-manual' if it doesn't exist.
  // Helper to ensure manual inventory order exists
  ensureManualOrder: async () => {
    const manualOrderId = 'inventory-manual';
    const state = get();
    if (!state.orders.find(o => o.id === manualOrderId)) {
        await state.addOrder({
            id: manualOrderId,
            title: 'Manuelle Lagerbestellung',
            customerName: 'Intern / Lager',
            status: 'active',
            steps: { processing: true, produced: true, invoiced: true },
            createdAt: new Date().toISOString(),
            employees: [],
            files: [],
            deadline: new Date().toISOString().split('T')[0] // Dummy deadline for type safety
        });
    }
    return manualOrderId;
  },

  addOrderItem: async (orderId, item) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            supplier_id: item.supplierId,
            item_name: item.itemName,
            item_number: item.itemNumber,
            color: item.color,
            size: item.size,
            quantity: item.quantity,
            notes: item.notes
        })
      });
      const data = await res.json();
      
      if (data.success) {
        set((state) => ({
            orders: state.orders.map(o => {
                if (o.id === orderId) {
                    const newItem: OrderItem = {
                        ...item,
                        id: data.id,
                        orderId,
                        status: 'pending',
                        supplierName: state.suppliers.find(s => s.id === item.supplierId)?.name
                    };
                    return { ...o, orderItems: [...(o.orderItems || []), newItem] };
                }
                return o;
            })
        }));
      }
    } catch (error) {
      console.error('Error adding order item:', error);
    }
  },

  updateOrderItem: async (orderId, itemId, updates) => {
    try {
      set((state) => ({
        orders: state.orders.map(o => {
            if (o.id === orderId && o.orderItems) {
                return {
                    ...o,
                    orderItems: o.orderItems.map(i => i.id === itemId ? { 
                        ...i, 
                        ...updates,
                        supplierName: updates.supplierId ? state.suppliers.find(s => s.id === updates.supplierId)?.name : i.supplierName
                    } : i)
                };
            }
            return o;
        })
      }));

      const payload: any = {};
      if (updates.supplierId !== undefined) payload.supplier_id = updates.supplierId;
      if (updates.itemName !== undefined) payload.item_name = updates.itemName;
      if (updates.itemNumber !== undefined) payload.item_number = updates.itemNumber;
      if (updates.color !== undefined) payload.color = updates.color;
      if (updates.size !== undefined) payload.size = updates.size;
      if (updates.quantity !== undefined) payload.quantity = updates.quantity;
      if (updates.notes !== undefined) payload.notes = updates.notes;
      if (updates.status !== undefined) payload.status = updates.status;

      await fetch(`/api/orders/${orderId}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Error updating order item:', error);
    }
  },

  deleteOrderItem: async (orderId, itemId) => {
    try {
      set((state) => ({
        orders: state.orders.map(o => {
            if (o.id === orderId && o.orderItems) {
                return {
                    ...o,
                    orderItems: o.orderItems.filter(i => i.id !== itemId)
                };
            }
            return o;
        })
      }));

      await fetch(`/api/orders/${orderId}/items/${itemId}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Error deleting order item:', error);
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

  deleteOrder: async (id) => {
    try {
      // Instead of deleting from DB, we just set status to 'archived' if we want to keep files
      // BUT user asked to "delete" order but keep "DTF print files".
      // If we hard delete the order row, we lose the file references unless we move them to a separate table.
      // Currently files are JSON in the order row.
      
      // OPTION 1: Soft delete (set status to 'deleted' or similar) -> This keeps everything.
      // OPTION 2: Extract files to a new "File Archive" system -> Complex refactoring.
      // OPTION 3: Keep using "archived" status for deleted orders?
      
      // Let's use a soft delete approach for now, or just don't delete the physical files (which is already the case).
      // The issue is: if the order row is gone, the UI can't find the files anymore because they are inside the order JSON.
      
      // So, if we want to keep files accessible in the "Customer Area" (which looks up orders),
      // we MUST NOT delete the order row from the database.
      
      // Instead of DELETE, we will set status to 'archived' (or a new 'deleted' status that is hidden everywhere except deep archives).
      // Let's use 'archived' since we already have it and it hides orders from the main list.
      // Wait, 'archived' is used for Direct Uploads.
      // If we use 'archived' for deleted orders, they will appear in the "Customer Files" list (which is good!)
      // but they will be hidden from the main Order List (also good!).
      
      // So, "Deleting" an order effectively becomes "Archiving" it.
      
      set((state) => ({
        orders: state.orders.map((o) => (o.id === id ? { ...o, status: 'archived' } : o))
      }));
      
      await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' })
      });
      
    } catch (error) {
      console.error('Error deleting order:', error);
    }
  },

  addUser: async (user) => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
      const data = await res.json();
      if (data.success && data.user) {
        set((state) => ({ users: [...state.users, data.user] }));
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error adding user:', error);
      throw error;
    }
  },

  updateUser: async (id, updatedUser) => {
    try {
      await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser)
      });
      
      set((state) => ({
        users: state.users.map((u) => (u.id === id ? { ...u, ...updatedUser } : u)),
        // If updating current user, update session too
        currentUser: state.currentUser?.id === id ? { ...state.currentUser, ...updatedUser } : state.currentUser
      }));
      
      // If current user, update local storage
      const state = get();
      if (state.currentUser?.id === id) {
        localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
      }
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  deleteUser: async (id) => {
    try {
      await fetch(`/api/users/${id}`, {
        method: 'DELETE'
      });
      set((state) => ({
        users: state.users.filter((u) => u.id !== id)
      }));
    } catch (error) {
      console.error('Error deleting user:', error);
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
