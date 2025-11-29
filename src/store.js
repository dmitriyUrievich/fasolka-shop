// src/store.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware'; // Для сохранения в localStorage
import getPortion from './utils/getPortion';

export const useCartStore = create(
  persist(
    (set) => ({
      items: [], // Наше состояние
      
      // Наши действия (actions)
      addToCart: (productToAdd) => set((state) => {
        const { id, unit, rests } = productToAdd;
        const portion = unit === 'Kilogram' ? getPortion(productToAdd.name, unit) : null;
        const step = portion ? portion.weightInGrams / 1000 : unit === 'Kilogram' ? 0.1 : 1;
        const existing = state.items.find((item) => item.id === id);
        
        if (existing) {
          const newQty = Math.min(existing.quantityInCart + step, existing.rests);
          return { items: state.items.map((item) => item.id === id ? { ...item, quantityInCart: newQty } : item) };
        }
        if (rests >= step) {
          return { items: [...state.items, { ...productToAdd, quantityInCart: step }] };
        }
        return state;
      }),

      updateCartQuantity: (productId, newQuantity) => set((state) => ({
        items: state.items.map((item) => {
          if (item.id === productId) {
              // ... ваша логика из App.js ...
              return newQuantity <= 0 ? null : { ...item, quantityInCart: Math.min(newQuantity, item.rests) };
          }
          return item;
        }).filter(Boolean)
      })),

      removeFromCart: (productId) => set((state) => ({
        items: state.items.filter((item) => item.id !== productId)
      })),

      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'cart-storage',
    }
  )
);