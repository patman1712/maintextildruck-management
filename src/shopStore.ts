
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

interface ShopState {
  currentCustomer: ShopCustomer | null;
  login: (customer: ShopCustomer) => void;
  logout: () => void;
}

export const useShopStore = create<ShopState>((set) => ({
  currentCustomer: JSON.parse(localStorage.getItem('shopCustomer') || 'null'),
  login: (customer) => {
    set({ currentCustomer: customer });
    localStorage.setItem('shopCustomer', JSON.stringify(customer));
  },
  logout: () => {
    set({ currentCustomer: null });
    localStorage.removeItem('shopCustomer');
  },
}));
