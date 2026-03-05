
import { create } from 'zustand';

export interface ShopCustomer {
  id: string;
  shop_id: string;
  email: string;
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
}

interface ShopState {
  currentCustomer: ShopCustomer | null;
  cart: CartItem[];
  isCartOpen: boolean;
  login: (customer: ShopCustomer) => void;
  logout: () => void;
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  setCartOpen: (open: boolean) => void;
}

export const useShopStore = create<ShopState>((set) => ({
  currentCustomer: JSON.parse(localStorage.getItem('shopCustomer') || 'null'),
  cart: JSON.parse(localStorage.getItem('shopCart') || '[]'),
  isCartOpen: false,
  
  login: (customer) => {
    set({ currentCustomer: customer });
    localStorage.setItem('shopCustomer', JSON.stringify(customer));
  },
  
  logout: () => {
    set({ currentCustomer: null });
    localStorage.removeItem('shopCustomer');
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
      
      localStorage.setItem('shopCart', JSON.stringify(updatedCart));
      return { cart: updatedCart, isCartOpen: true }; // Automatically open cart when adding
    });
  },

  removeFromCart: (id) => {
    set((state) => {
      const updatedCart = state.cart.filter(item => item.id !== id);
      localStorage.setItem('shopCart', JSON.stringify(updatedCart));
      return { cart: updatedCart };
    });
  },

  updateQuantity: (id, quantity) => {
    set((state) => {
      const updatedCart = state.cart.map(item => 
        item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item
      );
      localStorage.setItem('shopCart', JSON.stringify(updatedCart));
      return { cart: updatedCart };
    });
  },

  clearCart: () => {
    set({ cart: [] });
    localStorage.removeItem('shopCart');
  },
}));
