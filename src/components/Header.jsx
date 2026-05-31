import React from 'react';
import {useHydration} from "../hooks/useHydration.js";
import {useCartStore} from "../store.js";

const Header = ({
                    searchTerm,
                    onSearchChange,
                    sortOption,
                    onSortChange,
                    onCartToggle,
                    onMenuToggle
                }) => {

    const totalCartItems = useCartStore(state => state.items.reduce((sum, item) => sum + item.quantityInCart, 0));
    const hydrated = useHydration()

    return (
        <header className="app-header">
            <div className="header-content">

                <button
                    className="category-icon-button"
                    // ИСПРАВЛЕНО: используем onMenuToggle, который пришел из App
                    onClick={onMenuToggle}
                    aria-label="Меню"
                >
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>

                <h1 className="app-title">
                    <img src="/log-header.webp" className="logo-header" alt="Логотип Фасоль" />
                </h1>

                {/* Мобильная корзина */}
                <button suppressHydrationWarning
                        className="cart-icon-button mobile-cart"
                    // ИСПРАВЛЕНО: используем onCartToggle
                        onClick={onCartToggle}
                        aria-label="Корзина"
                >
                    <svg className="cart-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    {hydrated && totalCartItems > 0 && <span className="cart-item-count">{Math.ceil(totalCartItems)}</span>}
                </button>

                <div className="header-controls">
                    <div className="search-container">
                        <input
                            type="text"
                            placeholder="Найти продукт..."
                            className="search-input"
                            value={searchTerm}
                            // ИСПРАВЛЕНО: используем onSearchChange
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                        <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>

                    <div className="sort-container">
                        <label htmlFor="product-sort"></label>
                        <select
                            className="sort-select"
                            value={sortOption}
                            // ИСПРАВЛЕНО: используем onSortChange
                            onChange={(e) => onSortChange(e.target.value)}
                        >
                            <option value="none">Без сортировки</option>
                            <option value="price-asc">По цене ↑</option>
                            <option value="price-desc">По цене ↓</option>
                            <option value="quantity-asc">Остатки ↑</option>
                            <option value="quantity-desc">Остатки ↓</option>
                        </select>
                        <div className="select-arrow">
                            <svg className="select-arrow-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                            </svg>
                        </div>
                    </div>

                    <button suppressHydrationWarning
                            className="cart-icon-button desktop-cart"
                        // ИСПРАВЛЕНО: используем onCartToggle
                            onClick={onCartToggle}
                            aria-label="Корзина"
                    >
                        <svg className="cart-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        {hydrated && totalCartItems > 0 && <span className="cart-item-count">{Math.ceil(totalCartItems)}</span>}
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;