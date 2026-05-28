import React, { useState, useEffect } from 'react';
import ProductList from '../components/ProductList';
import CategorySidebar from '../components/CategorySidebar';
import { generateDailyOrderId } from '../utils/orderUtils';
import Swal from 'sweetalert2';
import { useCartStore } from '../store';
import { useHydration } from '../useHydration';

const CartBasket = React.lazy(() => import('../components/CartBasket.jsx'));
const Modal = React.lazy(() => import('../components/Modal.jsx'));
const OrderForm = React.lazy(() => import('../components/OrderForm.jsx'));

// Вспомогательная функция расчета
const calculateOrderTotals = (cartItems) => {
    let subtotal = 0;
    let totalWithReserve = 0;
    cartItems.forEach(item => {
        const itemTotal = parseFloat(item.sellPricePerUnit.replace(',', '.')) * item.quantityInCart;
        subtotal += itemTotal;
        totalWithReserve += (item.unit === 'Kilogram') ? itemTotal * 1.15 : itemTotal;
    });
    let cartCost = 1000;
    let deliveryCost = (subtotal > 0 && subtotal < 3000) ? 200 : 0;
    return { subtotal, totalWithReserve, deliveryCost, finalAmountForPayment: totalWithReserve + deliveryCost };
};

export default function ShopPage({ initialData }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState('none');
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
    const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
    const [products, setProducts] = useState(initialData?.products || []);
    const [catalogGroups, setCatalogGroups] = useState(initialData?.catalog || []);
    const [loading, setLoading] = useState(!initialData);
    const [selectedCategoryId, setSelectedCategoryId] = useState(null);
    const [isDesktop, setIsDesktop] = useState(false);
    const hydrated = useHydration();
    const [orderTotal, setOrderTotal] = useState(0);

    const totalCartItems = useCartStore(state => state.items.reduce((sum, item) => sum + item.quantityInCart, 0));
    const clearCart = useCartStore(state => state.clearCart);

    useEffect(() => {
        const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!initialData) {
            const loadAllData = async () => {
                setLoading(true);
                try {
                    const response = await fetch('/api/products-data');
                    const data = await response.json();
                    setProducts(data.products || []);
                    setCatalogGroups(data.catalog || []);
                } catch (err) {
                    Swal.fire('Ошибка', 'Не удалось загрузить каталог.', 'error');
                } finally {
                    setLoading(false);
                }
            };
            loadAllData();
        }
    }, [initialData]);

    const handleSubmitOrder = async (customerData) => {
        const { items: cartItems } = useCartStore.getState();
        const totals = calculateOrderTotals(cartItems);

        // Логика оплаты YooKassa (сокращено для примера)
        const response = await fetch(`/api/payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...customerData, amount: totals.finalAmountForPayment })
        });
        const data = await response.json();
        if (data?.payment?.confirmation?.confirmation_url) {
            window.open(data.payment.confirmation.confirmation_url, '_blank');
            clearCart();
            setIsOrderFormOpen(false);
            Swal.fire('Заказ создан!', 'Оплатите его в новом окне.', 'success');
        }
    };

    return (
        <div className="app-container">
            <header className="app-header">
                <div className="header-content">
                    <button className="category-icon-button" onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}>
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <h1 className="app-title"><img src="/log-header.webp" className="logo-header" alt="Лого" /></h1>
                    <button className="cart-icon-button" onClick={() => setIsCartOpen(!isCartOpen)}>
                        <svg className="cart-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        {hydrated && totalCartItems > 0 && <span className="cart-item-count">{Math.ceil(totalCartItems)}</span>}
                    </button>
                </div>
            </header>

            <main className="app-main">
                <ProductList
                    products={products}
                    categories={catalogGroups}
                    loading={loading}
                    searchTerm={searchTerm}
                    selectedCategoryId={selectedCategoryId}
                />
            </main>

            {isCartOpen && (
                <React.Suspense fallback={null}>
                    <Modal isOpen={isCartOpen} onClose={() => setIsCartOpen(false)}>
                        <CartBasket
                            onProceedToOrder={() => { setIsCartOpen(false); setIsOrderFormOpen(true); }}
                            onClose={() => setIsCartOpen(false)}
                        />
                    </Modal>
                </React.Suspense>
            )}

            {isOrderFormOpen && (
                <React.Suspense fallback={null}>
                    <Modal isOpen={isOrderFormOpen} onClose={() => setIsOrderFormOpen(false)}>
                        <OrderForm onSubmit={handleSubmitOrder} onClose={() => setIsOrderFormOpen(false)} />
                    </Modal>
                </React.Suspense>
            )}

            <footer className="app-footer">
                <div className="footer-content">
                    <p>&copy; 2025 Фасоль. Южная Озереевка.</p>
                </div>
            </footer>
        </div>
    );
}