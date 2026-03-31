
import { create } from 'zustand';

export interface ShopCustomer {
  id: string;
  shop_id: string;
  email: string;
  customer_number?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  street?: string;
  zip?: string;
  city?: string;
  phone?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  productNumber?: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  size?: string;
  color?: string;
  personalization?: string;
  weight?: number;
  supplierId?: string;
}

interface ShopState {
  activeShopId: string | null;
  currentCustomer: ShopCustomer | null;
  cart: CartItem[];
  isCartOpen: boolean;
  setActiveShop: (shopId: string) => void;
  login: (customer: ShopCustomer) => void;
  logout: () => void;
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  setCartOpen: (open: boolean) => void;
}

const safeJsonParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const cartKeyForShop = (shopId: string | null) => (shopId ? `shopCart:${shopId}` : 'shopCart');
const customerKeyForShop = (shopId: string | null) => (shopId ? `shopCustomer:${shopId}` : 'shopCustomer');

export const useShopStore = create<ShopState>((set) => ({
  activeShopId: null,
  currentCustomer: safeJsonParse(localStorage.getItem('shopCustomer'), null),
  cart: safeJsonParse(localStorage.getItem('shopCart'), []),
  isCartOpen: false,

  setActiveShop: (shopId) => {
    const scopedCartKey = cartKeyForShop(shopId);
    const scopedCustomerKey = customerKeyForShop(shopId);

    let cart = safeJsonParse<CartItem[]>(localStorage.getItem(scopedCartKey), []);
    let customer = safeJsonParse<ShopCustomer | null>(localStorage.getItem(scopedCustomerKey), null);

    const legacyCart = safeJsonParse<CartItem[]>(localStorage.getItem('shopCart'), []);
    if (cart.length === 0 && legacyCart.length > 0 && !localStorage.getItem(scopedCartKey)) {
      cart = legacyCart;
      localStorage.setItem(scopedCartKey, JSON.stringify(legacyCart));
      localStorage.removeItem('shopCart');
    }

    const legacyCustomer = safeJsonParse<ShopCustomer | null>(localStorage.getItem('shopCustomer'), null);
    if (!customer && legacyCustomer && legacyCustomer.shop_id === shopId && !localStorage.getItem(scopedCustomerKey)) {
      customer = legacyCustomer;
      localStorage.setItem(scopedCustomerKey, JSON.stringify(legacyCustomer));
      localStorage.removeItem('shopCustomer');
    }

    set({ activeShopId: shopId, cart, currentCustomer: customer, isCartOpen: false });
  },
  
  login: (customer) => {
    set({ currentCustomer: customer });
    const shopId = customer.shop_id;
    localStorage.setItem(customerKeyForShop(shopId), JSON.stringify(customer));
  },
  
  logout: () => {
    set({ currentCustomer: null });
    set((state) => {
      localStorage.removeItem(customerKeyForShop(state.activeShopId));
      localStorage.removeItem('shopCustomer');
      return { currentCustomer: null };
    });
  },

  setCartOpen: (open) => set({ isCartOpen: open }),

  addToCart: (newItem) => {
    set((state) => {
      // Check if item with same ID already exists (ID should be unique for product+options combo)
      const existingItemIndex = state.cart.findIndex(item => item.id === newItem.id);
      
      let updatedCart;
      if (existingItemIndex > -1) {
        updatedCart = [...state.cart];
        updatedCart[existingItemIndex].quantity += newItem.quantity;
      } else {
        updatedCart = [...state.cart, newItem];
      }
      
      localStorage.setItem(cartKeyForShop(state.activeShopId), JSON.stringify(updatedCart));
      return { cart: updatedCart, isCartOpen: true }; // Automatically open cart when adding
    });
  },

  removeFromCart: (id) => {
    set((state) => {
      const updatedCart = state.cart.filter(item => item.id !== id);
      localStorage.setItem(cartKeyForShop(state.activeShopId), JSON.stringify(updatedCart));
      return { cart: updatedCart };
    });
  },

  updateQuantity: (id, quantity) => {
    set((state) => {
      const updatedCart = state.cart.map(item => 
        item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item
      );
      localStorage.setItem(cartKeyForShop(state.activeShopId), JSON.stringify(updatedCart));
      return { cart: updatedCart };
    });
  },

  clearCart: () => {
    set((state) => {
      localStorage.removeItem(cartKeyForShop(state.activeShopId));
      localStorage.removeItem('shopCart');
      return { cart: [] };
    });
  },
}));
