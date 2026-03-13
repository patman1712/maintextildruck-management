
import { create } from 'zustand';

export interface OrderSteps {
  processing: boolean; // In Bearbeitung
  produced: boolean;   // Fertig Produziert
  invoiced: boolean;   // Rechnung geschrieben
}

export interface Customer {
  id: string;
  name: string;
  contact_person?: string;
  email: string;
  phone: string;
  address: string;
  shopwareUrl?: string;
  shopwareVersion?: '5' | '6';
  shopwareAccessKey?: string;
  shopwareSecretKey?: string;
  created_at: string;
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
  manualOrderNumber?: string; // For manual items that reference a specific order
  color?: string;
  size?: string;
  quantity: number;
  notes?: string;
  price?: number;
  status: 'pending' | 'ordered' | 'received';
  orderedBy?: string;
  orderedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
}

export interface Order {
  id: string;
  title: string;
  orderNumber?: string; // New field for formatted order number (e.g. 2024-0001)
  customerId?: string; // Optional for now to support legacy orders
  customerName: string;
  customerContactPerson?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  deadline: string;
  status: 'active' | 'completed' | 'cancelled' | 'archived' | 'manual_invoice';
  steps: OrderSteps;
  printStatus?: 'pending' | 'ordered';
  createdAt: string;
  description?: string;
  employees: string[];
  files: { 
    name: string; 
    type: 'preview' | 'print' | 'vector' | 'internal' | 'photoshop'; 
    url?: string; 
    file?: File; 
    customName?: string;
    thumbnail?: string;
    reference?: string;
    status?: 'pending' | 'ordered';
    print_status?: 'pending' | 'ordered' | 'completed'; // Add print_status to file interface
    quantity?: number;
  }[];
  orderItems?: OrderItem[]; // New field
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  approvalToken?: string;
  approvalComment?: string;
  shopwareOrderId?: string; // Shopware order ID for online orders
  trackingNumber?: string;
  labelUrl?: string;
  shippedAt?: string;
}

export interface Supplier {
  id: string;
  name: string;
  website?: string;
  customerNumber?: string;
  notes?: string;
  email?: string;
}

export interface Product {
  id: string;
  name: string;
  product_number?: string;
  source?: 'shopware' | 'manual'; // Added source
  customer_id?: string;
  supplier_id?: string;
  manufacturer_info?: string;
  description?: string;
  size?: string;
  color?: string;
  weight?: number;
  files: { 
    id?: string; // Added id
    file_url?: string; url?: string; 
    file_name?: string; name?: string;
    thumbnail_url?: string; thumbnail?: string;
    customName?: string;
    type?: 'preview' | 'print' | 'vector' | 'internal' | 'photoshop' | string; // Allow string for compatibility
    created_at?: string;
    quantity?: number; // Added quantity
  }[];
  created_at?: string;
}

export interface Shop {
  id: string;
  customer_id: string;
  name: string;
  domain_slug: string;
  custom_domain?: string; // New field for custom domain/subdomain
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  template: string;
  dhl_config?: any;
  paypal_config?: any;
  order_number_circle?: string;
  next_order_number?: number;
  invoice_number_circle?: string;
  next_invoice_number?: number;
  email_logo_url?: string; // New field for email logo
  hero_images?: string[]; // New field for hero slider
  welcome_text?: string; // New field for welcome text
  
  // Footer / Legal
  footer_logo_url?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_address?: string;
  opening_hours?: string;
  social_instagram?: string;
  social_tiktok?: string;
  social_whatsapp?: string;
  
  impressum_text?: string;
  privacy_text?: string;
  agb_text?: string;
  revocation_text?: string;
  shipping_info_text?: string;
  about_us_text?: string;
  contact_text?: string;

  created_at: string;
}

export interface ShopCategory {
  id: string;
  shop_id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  sort_order: number;
  parent_id?: string | null;
  children?: ShopCategory[]; // For UI tree structure
}

export interface ShopProductAssignment {
  id: string;
  shop_id: string;
  product_id: string;
  category_id?: string;
  price?: number;
  is_featured: boolean;
  personalization_enabled?: boolean; // NEW
  sort_order: number;
  weight?: number;
  variants?: string; // JSON string storing variant config: { "Size": { "S": { price: 10 }, "M": { price: 10 } }, "Color": ... }
  is_active: boolean | number; // NEW
  supplier_id?: string; // NEW
}

interface AppState {
  orders: Order[];
  customers: Customer[];
  products: Product[]; // Add products to state
  users: User[];
  suppliers: Supplier[];
  shops: Shop[];
  currentUser: User | null;
  loading: boolean;
  menuSettings: Record<string, boolean>;
  logoUrl: string | null;
  faviconUrl: string | null;
  
  fetchData: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  updateMenuSettings: (settings: Record<string, boolean>) => Promise<void>;
  fetchUsers: () => Promise<void>;
  
  login: (user: User) => void;
  logout: () => void;
  
  addOrder: (order: Order) => Promise<void>;
  addCustomer: (customer: Customer) => Promise<void>;
  addUser: (user: Partial<User>) => Promise<void>;
  addSupplier: (supplier: Supplier) => Promise<void>;
  addShop: (shop: Partial<Shop>) => Promise<void>;
  
  updateCustomer: (id: string, updatedCustomer: Partial<Customer>) => Promise<void>;
  updateOrder: (id: string, updatedOrder: Partial<Order>) => Promise<void>;
  updateUser: (id: string, updatedUser: Partial<User>) => Promise<void>;
  updateSupplier: (id: string, updatedSupplier: Partial<Supplier>) => Promise<void>;
  updateShop: (id: string, updatedShop: Partial<Shop>) => Promise<void>;
  deleteShop: (id: string) => Promise<void>;
  
  addOrderItem: (orderId: string, item: Omit<OrderItem, 'id' | 'orderId' | 'status'>) => Promise<void>;
  updateOrderItem: (orderId: string, itemId: string, updates: Partial<OrderItem>) => Promise<void>;
  splitOrderItem: (orderId: string, itemId: string, receivedQuantity: number, remainingNotes?: string, expectedDate?: string, receivedNotes?: string) => Promise<void>;
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
  products: [],
  shops: [],
  menuSettings: {},
  logoUrl: null,
  faviconUrl: null,
  currentUser: JSON.parse(localStorage.getItem('currentUser') || 'null'),
  loading: false,

  fetchSettings: async () => {
    try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if(data.success && data.settings) {
            set({ 
                logoUrl: data.settings.logo || null,
                faviconUrl: data.settings.favicon || null,
                menuSettings: data.settings.menu_config ? JSON.parse(data.settings.menu_config) : {}
            });
        }
    } catch(e) { console.error(e); }
  },

  updateMenuSettings: async (settings) => {
      set({ menuSettings: settings });
      await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'menu_config', value: settings })
      });
  },

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

      const shopsRes = await fetch('/api/shops');
      const shopsData = await shopsRes.json();

      // Fetch ALL products for preview generator
      const productsRes = await fetch('/api/products'); // Need to implement this endpoint or fetch per customer?
      // Actually /api/products returns ALL products if no customer ID is provided? Let's check backend.
      // If not, we might need a new endpoint or loop customers (bad).
      // Assuming for now we need to add a way to fetch all products or just fetch them on demand.
      // Let's try to fetch all products if the endpoint supports it.
      let allProducts: Product[] = [];
      try {
          const prodRes = await fetch('/api/products/all'); // New endpoint suggestion
          const prodData = await prodRes.json();
          if (prodData.success) {
             allProducts = prodData.data;
          }
      } catch (e) { console.log('Could not fetch all products', e); }

      // Map Customers
      const mappedCustomers: Customer[] = (customersData.data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        contact_person: c.contact_person,
        email: c.email,
        phone: c.phone,
        address: c.address,
        shopwareUrl: c.shopware_url,
        shopwareVersion: c.shopware_version || '6',
        shopwareAccessKey: c.shopware_access_key,
        shopwareSecretKey: c.shopware_secret_key,
        created_at: c.created_at
      }));

      // Map Supabase data to frontend interface
      const mappedOrders: Order[] = (ordersData.data || []).map((o: any) => ({
        id: o.id,
        title: o.title,
        orderNumber: o.orderNumber, // Map from backend
        customerId: o.customerId,
        customerName: o.customer_name,
        customerContactPerson: o.customer_contact_person,
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
        printStatus: o.printStatus,
        createdAt: o.created_at,
        description: o.description,
        employees: o.employees || [],
        files: o.files || [],
        approvalStatus: o.approvalStatus,
        approvedBy: o.approvedBy,
        approvedAt: o.approvedAt,
        rejectionReason: o.rejectionReason,
        approvalToken: o.approvalToken,
        approvalComment: o.approvalComment,
        shopwareOrderId: o.shopwareOrderId, // Correctly map from API response (camelCase)
        trackingNumber: o.tracking_number,
        labelUrl: o.label_url,
        shippedAt: o.shipped_at,
        orderItems: (orderItemsData.data || [])
            .filter((i: any) => i.order_id === o.id)
            .map((i: any) => ({
                id: i.id,
                orderId: i.order_id,
                supplierId: i.supplier_id,
                supplierName: i.supplier_name,
                itemName: i.item_name,
                itemNumber: i.item_number,
                manualOrderNumber: i.manual_order_number,
                color: i.color,
                size: i.size,
                quantity: i.quantity,
                notes: i.notes,
                price: i.price,
                status: i.status,
                orderedBy: i.ordered_by,
                orderedAt: i.ordered_at,
                receivedBy: i.received_by,
                receivedAt: i.received_at
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

      const mappedShops: Shop[] = shopsData.data || [];

      if (customersData.success && ordersData.success) {
        set({ 
          customers: mappedCustomers, 
          orders: mappedOrders,
          suppliers: mappedSuppliers,
          shops: mappedShops,
          products: allProducts
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
        order_number: order.orderNumber,
        customer_id: order.customerId,
        customer_name: order.customerName,
        customer_contact_person: order.customerContactPerson,
        customer_email: order.customerEmail,
        customer_phone: order.customerPhone,
        customer_address: order.customerAddress,
        deadline: order.deadline,
        status: order.status,
        processing: order.steps.processing,
        produced: order.steps.produced,
        invoiced: order.steps.invoiced,
        print_status: order.printStatus,
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

  addShop: async (shop) => {
    try {
      const res = await fetch('/api/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shop)
      });
      const data = await res.json();
      if (data.success) {
          set((state) => ({ shops: [...state.shops, data.data] }));
      }
    } catch (error) {
      console.error('Error adding shop:', error);
    }
  },

  updateShop: async (id, updatedShop) => {
    try {
      const res = await fetch(`/api/shops/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedShop)
      });
      const data = await res.json();
      if (data.success) {
        set((state) => ({
            shops: state.shops.map((s) => (s.id === id ? { ...s, ...data.data } : s))
        }));
      } else {
        console.error('Failed to update shop:', data.error);
      }
    } catch (error) {
      console.error('Error updating shop:', error);
    }
  },

  deleteShop: async (id) => {
    try {
      await fetch(`/api/shops/${id}`, {
        method: 'DELETE',
      });
      set((state) => ({
        shops: state.shops.filter((s) => s.id !== id)
      }));
    } catch (error) {
      console.error('Error deleting shop:', error);
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

      const payload: any = {};
      if (updatedCustomer.name !== undefined) payload.name = updatedCustomer.name;
      if (updatedCustomer.contact_person !== undefined) payload.contact_person = updatedCustomer.contact_person;
      if (updatedCustomer.email !== undefined) payload.email = updatedCustomer.email;
      if (updatedCustomer.phone !== undefined) payload.phone = updatedCustomer.phone;
      if (updatedCustomer.address !== undefined) payload.address = updatedCustomer.address;
      if (updatedCustomer.shopwareUrl !== undefined) payload.shopware_url = updatedCustomer.shopwareUrl;
      if (updatedCustomer.shopwareVersion !== undefined) payload.shopware_version = updatedCustomer.shopwareVersion;
      if (updatedCustomer.shopwareAccessKey !== undefined) payload.shopware_access_key = updatedCustomer.shopwareAccessKey;
      if (updatedCustomer.shopwareSecretKey !== undefined) payload.shopware_secret_key = updatedCustomer.shopwareSecretKey;

      const res = await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
          // Revert optimistic update if failed
          get().fetchData(); 
          throw new Error('Update failed');
      }
      
      // Refresh data to ensure consistency
      get().fetchData();
    } catch (error) {
      console.error('Error updating customer:', error);
      // Ensure we are in sync
      get().fetchData();
    }
  },

  updateOrder: async (id, updatedOrder) => {
    try {
      set((state) => ({
        orders: state.orders.map((o) => (o.id === id ? { ...o, ...updatedOrder } : o))
      }));

      const updatePayload: any = {};
      if (updatedOrder.title !== undefined) updatePayload.title = updatedOrder.title;
      if (updatedOrder.orderNumber !== undefined) updatePayload.order_number = updatedOrder.orderNumber;
      if (updatedOrder.customerId !== undefined) updatePayload.customer_id = updatedOrder.customerId;
      if (updatedOrder.customerName !== undefined) updatePayload.customer_name = updatedOrder.customerName;
      if (updatedOrder.customerContactPerson !== undefined) updatePayload.customer_contact_person = updatedOrder.customerContactPerson;
      if (updatedOrder.customerEmail !== undefined) updatePayload.customer_email = updatedOrder.customerEmail;
      if (updatedOrder.customerPhone !== undefined) updatePayload.customer_phone = updatedOrder.customerPhone;
      if (updatedOrder.customerAddress !== undefined) updatePayload.customer_address = updatedOrder.customerAddress;
      if (updatedOrder.deadline !== undefined) updatePayload.deadline = updatedOrder.deadline;
      if (updatedOrder.status !== undefined) updatePayload.status = updatedOrder.status;
      if (updatedOrder.printStatus !== undefined) updatePayload.print_status = updatedOrder.printStatus;
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
    const existingOrder = state.orders.find(o => o.id === manualOrderId);

    if (!existingOrder) {
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
    } else if (existingOrder.status !== 'active') {
        // If order exists but is archived/completed (e.g. accidentally deleted), reactivate it
        // so that new manual items are visible in the "Current" tab.
        await state.updateOrderStatus(manualOrderId, 'active');
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
            manual_order_number: item.manualOrderNumber,
            color: item.color,
            size: item.size,
            quantity: item.quantity,
            notes: item.notes,
            price: item.price
        })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data?.error || `Failed to add order item (HTTP ${res.status})`);
      }

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
      throw error;
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
      if (updates.manualOrderNumber !== undefined) payload.manual_order_number = updates.manualOrderNumber;
      if (updates.color !== undefined) payload.color = updates.color;
      if (updates.size !== undefined) payload.size = updates.size;
      if (updates.quantity !== undefined) payload.quantity = updates.quantity;
      if (updates.notes !== undefined) payload.notes = updates.notes;
      if (updates.price !== undefined) payload.price = updates.price;
      if (updates.status !== undefined) payload.status = updates.status;
      if ((updates as any).updatedBy) payload.updatedBy = (updates as any).updatedBy;

      await fetch(`/api/orders/${orderId}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Error updating order item:', error);
    }
  },

  splitOrderItem: async (orderId, itemId, receivedQuantity, remainingNotes, expectedDate, receivedNotes) => {
      try {
          const res = await fetch(`/api/orders/${orderId}/items/${itemId}/split`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ receivedQuantity, remainingNotes, expectedDate, receivedNotes })
          });
          const data = await res.json();
          
          if (data.success) {
              const state = get();
              // Update local state with returned items
              set((state) => ({
                  orders: state.orders.map(o => {
                      if (o.id === orderId && o.orderItems) {
                          // Remove original item (it will be replaced by updatedItem)
                          // Actually, updatedItem IS the original item but with new values
                          // newItem is the new split part
                          
                          // Map backend response to frontend interface
                          const mapItem = (i: any): OrderItem => ({
                              id: i.id,
                              orderId: i.order_id,
                              supplierId: i.supplier_id,
                              supplierName: state.suppliers.find(s => s.id === i.supplier_id)?.name,
                              itemName: i.item_name,
                              itemNumber: i.item_number,
                              manualOrderNumber: i.manual_order_number,
                              color: i.color,
                              size: i.size,
                              quantity: i.quantity,
                              notes: i.notes,
                              price: i.price,
                              status: i.status,
                              orderedBy: i.ordered_by,
                              orderedAt: i.ordered_at,
                              receivedBy: i.received_by,
                              receivedAt: i.received_at
                          });

                          const updatedItem = mapItem(data.updatedItem);
                          const newItem = data.newItem ? mapItem(data.newItem) : null;

                          return {
                              ...o,
                              orderItems: o.orderItems
                                  .map(i => i.id === itemId ? updatedItem : i) // Update original
                                  .concat(newItem ? [newItem] : []) // Add new if exists
                          };
                      }
                      return o;
                  })
              }));
          }
      } catch (error) {
          console.error('Error splitting order item:', error);
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
      const state = get();
      const order = state.orders.find(o => o.id === id);
      
      let updatedFiles = order?.files || [];

      // Clean up 'internal' files before archiving
      if (order && order.files) {
        const internalFiles = order.files.filter(f => f.type === 'internal');
        
        for (const file of internalFiles) {
            if (file.url) {
                try {
                    await fetch('/api/upload/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filePath: file.url })
                    });
                } catch (e) {
                    console.error("Failed to delete internal file", e);
                }
            }
        }
        
        // Remove internal files from the list
        updatedFiles = order.files.filter(f => f.type !== 'internal');
      }

      set((state) => ({
        orders: state.orders.map((o) => (o.id === id ? { ...o, status: 'archived', files: updatedFiles } : o))
      }));
      
      await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived', files: updatedFiles })
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
