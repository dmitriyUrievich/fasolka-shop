import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import '../YandexMap.css'
import '../MainPage.css';

import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";
import ProductList from '../components/ProductList';
import CategoryDrawer from '../components/CategoryDrawer';

import { useProducts } from '../hooks/useProducts';
import { useMediaQuery } from '../hooks/useMediaQuery';

import { useCartStore } from '../store';
import { calculateOrderTotals } from '../utils/orderUtils';
import { prepareOrderData, createPayment } from '../services/orderService';

import YandexMap from "../components/YandexMap.jsx";
import {useHydration} from "../hooks/useHydration.js";

const CartBasket = React.lazy(() => import('../components/CartBasket'));
const Modal = React.lazy(() => import('../components/Modal.jsx'));
const OrderForm = React.lazy(() => import('../components/OrderForm.jsx'));

function MainPage({ initialData }) {
    const hydrated = useHydration()
    const { products, catalogGroups, loading } = useProducts(initialData);

    const isDesktopRaw = useMediaQuery('(min-width: 1024px)');
    const clearCart = useCartStore(state => state.clearCart);

    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState('none');
    const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);

    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
    const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);

    const [orderTotal, setOrderTotal] = useState(0);

    const isDesktop = hydrated ? isDesktopRaw : false;

    // Закрытие окон по Esc
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                setIsCategoryMenuOpen(false);
                setIsCartOpen(false);
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    // Переход от корзины к оформлению
    const handleProceedToOrder = () => {
        const cartItems = useCartStore.getState().items;
        const { finalAmountForPayment } = calculateOrderTotals(cartItems);

        setOrderTotal(parseFloat(finalAmountForPayment.toFixed(2)));
        setIsCartOpen(false);
        setIsOrderFormOpen(true);
    };

    const handleCategoryToggle = (id) => {
        if (id === null) {
            setSelectedCategoryIds([]);
            return;
        }
        setSelectedCategoryIds(prev =>
            prev.includes(id)
                ? prev.filter(item => item !== id)
                : [...prev, id]
        );
    };

    // Финальная отправка заказа
    const handleSubmitOrder = async (customerData) => {
        const cartItems = useCartStore.getState().items;

        if (cartItems.length === 0) {
            Swal.fire('Корзина пуста', 'Добавьте товары перед оплатой.', 'warning');
            return;
        }

        try {
            const orderData = prepareOrderData(customerData, cartItems);
            const paymentUrl = await createPayment(orderData);

            if (paymentUrl) {
                window.open(paymentUrl, '_blank');
                Swal.fire({
                    title: '🎉 Заказ создан!',
                    html: `Заказ <b>№${orderData.id}</b> ожидает оплаты в новой вкладке.`,
                    icon: 'success'
                });
                clearCart();
                setIsOrderFormOpen(false);
            }
        } catch (error) {
            Swal.fire('Ошибка оплаты', error.message, 'error');
        }
    };

    return (
        <div className="app-container">
            <Header
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                sortOption={sortOption}
                onSortChange={setSortOption}
                onMenuToggle={() => setIsCategoryMenuOpen(prev => !prev)}
                onCartToggle={() => setIsCartOpen(prev => !prev)}
                categories={catalogGroups}
                onCategorySelect={(id) => {
                    handleCategoryToggle(id);
                    setSearchTerm('');
                }}
            />
            {/* Модальное меню категорий */}
            <CategoryDrawer
                isOpen={isCategoryMenuOpen}
                onClose={() => setIsCategoryMenuOpen(false)}
                products={products}
                categories={catalogGroups}
                activeCategoryIds={selectedCategoryIds}
                onCategorySelect={(id) => {
                    handleCategoryToggle(id);
                    if (hydrated && !isDesktop) setIsCategoryMenuOpen(false);
                }}
            />

            <div className="app-layout">
                <div className="products-and-cart-container">
                    <main className="app-main">
                        <div className="main-content-wrapper">

                            <ProductList
                                products={products}
                                categories={catalogGroups}
                                catalogGroups={catalogGroups}
                                loading={loading}
                                searchTerm={searchTerm}
                                sortOption={sortOption}
                                selectedCategoryIds={selectedCategoryIds}
                                listHeader={
                                    (selectedCategoryIds.length > 0 || searchTerm) && !loading ? (
                                        <div className="product-list-header-container">
                                            {selectedCategoryIds.map(catId => {
                                                const category = catalogGroups.find(g => g.id === catId);
                                                if (!category) return null;
                                                return (
                                                    <div className="filter-badge" key={catId}>
                                                        <span className="filter-text">{category.name}</span>
                                                        <button
                                                            className="filter-reset-btn"
                                                            onClick={() => handleCategoryToggle(catId)}
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                );
                                            })}

                                            {searchTerm && (
                                                <div className="filter-badge">
                                                    <span className="filter-text">Поиск: "{searchTerm}"</span>
                                                    <button className="filter-reset-btn" onClick={() => setSearchTerm('')}>×</button>
                                                </div>
                                            )}

                                            {selectedCategoryIds.length > 1 && (
                                                <button className="clear-all-filters" onClick={() => setSelectedCategoryIds([])}>
                                                    Очистить всё
                                                </button>
                                            )}
                                        </div>
                                    ) : null
                                }
                            />

                        </div>

                        <div className="map-section">
                            <h2 className="map-title">Наш Магазин на Карте</h2>
                            {hydrated && (
                                <YandexMap
                                    center={[44.675898, 37.642492]}
                                    zoom={12}
                                    placemark={[44.675898, 37.642492]}
                                    placemarkHint="Фасоль"
                                    placemarkBalloon="Мы находимся по адресу: пер. Торпедный д1."
                                />
                            )}
                        </div>

                    </main>

                    {/* Корзина на десктопе */}
                    {hydrated && isDesktop && isCartOpen && (
                        <aside className="cart-sidebar">
                            <React.Suspense fallback={<div>Загрузка корзины...</div>}>
                                <CartBasket
                                    isSidebar={true}
                                    onClose={() => setIsCartOpen(false)}
                                    onClearCart={() => { clearCart(); setIsCartOpen(false); }}
                                    onProceedToOrder={handleProceedToOrder}
                                />
                            </React.Suspense>
                        </aside>
                    )}
                </div>
            </div>

            {/* Мобильная корзина */}
            {hydrated && !isDesktop && isCartOpen && (
                <React.Suspense fallback={null}>
                    <Modal isOpen={isCartOpen} onClose={() => setIsCartOpen(false)}>
                        <CartBasket
                            isSidebar={false}
                            onClearCart={() => { clearCart(); setIsCartOpen(false); }}
                            onProceedToOrder={handleProceedToOrder}
                            onClose={() => setIsCartOpen(false)}
                        />
                    </Modal>
                </React.Suspense>
            )}

            { hydrated && isOrderFormOpen && (
                <React.Suspense fallback={null}>
                    <Modal isOpen={isOrderFormOpen} onClose={() => setIsOrderFormOpen(false)}>
                        <OrderForm onSubmit={handleSubmitOrder} onClose={() => setIsOrderFormOpen(false)} totalAmount={orderTotal}/>
                    </Modal>
                </React.Suspense>
            )}

            <Footer/>
        </div>
    );
}

export default MainPage;