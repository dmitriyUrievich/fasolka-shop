// src/store.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import getPortion from './utils/getPortion';

export const useCartStore = create(
    persist(
        (set) => ({
            items: [],

            addToCart: (productToAdd) => set((state) => {
                const { id, unit, rests, productType } = productToAdd;

                // Проверяем, является ли товар "бесконечным" (блюдо или пицца)
                const isAlwaysAvailable = productType === 'TechCard';

                const portion = unit === 'Kilogram' ? getPortion(productToAdd.name, unit) : null;
                const step = portion ? portion.weightInGrams / 1000 : unit === 'Kilogram' ? 0.1 : 1;

                const existing = state.items.find((item) => item.id === id);

                if (existing) {
                    // Если товар уже в корзине, прибавляем шаг, но не выше остатка (для пицц лимит - 999)
                    const limit = isAlwaysAvailable ? 999 : existing.rests;
                    const newQty = Math.min(existing.quantityInCart + step, limit);

                    return {
                        items: state.items.map((item) =>
                            item.id === id ? { ...item, quantityInCart: newQty } : item
                        )
                    };
                }

                // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: разрешаем добавление, если это TechCard ИЛИ если хватает остатка
                if (isAlwaysAvailable || rests >= step) {
                    return { items: [...state.items, { ...productToAdd, quantityInCart: step }] };
                }

                return state;
            }),

            updateCartQuantity: (productId, newQuantity) => set((state) => ({
                items: state.items.map((item) => {
                    if (item.id === productId) {
                        const isAlwaysAvailable = item.productType === 'TechCard';
                        const limit = isAlwaysAvailable ? 999 : item.rests;

                        return newQuantity <= 0
                            ? null
                            : { ...item, quantityInCart: Math.min(newQuantity, limit) };
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