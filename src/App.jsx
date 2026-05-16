import React, { useState, useEffect } from 'react';
import { useHydration } from './useHydration';
import ProductList from './components/ProductList';
import CategorySidebar from './components/CategorySidebar';
import { generateDailyOrderId } from './utils/orderUtils';
import Swal from 'sweetalert2';
import './App.css';
import { useCartStore } from './store'

const CartBasket = React.lazy(() => import('/src/components/CartBasket.jsx'));
const Modal = React.lazy(() => import('/src/components/Modal.jsx'));
const OrderForm = React.lazy(() => import('/src/components/OrderForm.jsx'));

const calculateOrderTotals = (cartItems) => {
  let subtotal = 0;
  let totalWithReserve = 0;
  cartItems.forEach(item => {
    const itemTotal = parseFloat(item.sellPricePerUnit.replace(',', '.')) * item.quantityInCart;
    subtotal += itemTotal;
    totalWithReserve += (item.unit === 'Kilogram') ? itemTotal * 1.15 : itemTotal;
  });
  let cartCost = 1000
  let deliveryCost = 0;
  if (subtotal > 0 && subtotal < cartCost) deliveryCost = 200;
  else if (subtotal >= cartCost && subtotal < 3000) deliveryCost = 200;

  const finalAmountForPayment = totalWithReserve + deliveryCost;
  return { subtotal, totalWithReserve, deliveryCost, finalAmountForPayment };
}

function App({ initialData }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('none');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [showOnlyFallback, setShowOnlyFallback] = useState(false);
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
          if (!response.ok) throw new Error(`Ошибка сети: ${response.statusText}`);
          const data = await response.json();
          setProducts(data.products || []);
          setCatalogGroups(data.catalog || []);
        } catch (err) {
          console.error('Ошибка загрузки данных:', err);
          Swal.fire({ title: 'Ошибка', text: 'Не удалось загрузить каталог товаров.', icon: 'error' });
        } finally {
          setLoading(false);
        }
      };
      loadAllData();
    }
  }, [initialData]);

  // Закрытие по Esc (только на клиенте) - ПРАВИЛЬНО
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

  const handleProceedToOrder = () => {
    const cartItems = useCartStore.getState().items;

   const { finalAmountForPayment } = calculateOrderTotals(cartItems);

    setOrderTotal(parseFloat(finalAmountForPayment.toFixed(2)));
    setIsCartOpen(false);
    setIsOrderFormOpen(true);
  };

  const handleCloseOrderForm = () => setIsOrderFormOpen(false);

  const createYooKassaPayment = async (orderData) => {
    try {
      const response = await fetch(`/api/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Не удалось прочитать ошибку сервера' }));
        throw new Error(errorData.message || 'Ошибка сети при создании платежа');
      }
      const data = await response.json();
      const confirmationUrl = data?.payment?.confirmation?.confirmation_url;
      if (confirmationUrl) {
        window.open(confirmationUrl, '_blank');
        return true;
      } else {
        throw new Error('Не получена ссылка на оплату');
      }
    } catch (error) {
      console.error("Ошибка при создании платежа:", error);
      Swal.fire({ title: 'Ошибка оплаты', text: error.message, icon: 'error' });
      return false;
    }
  };

 const handleSubmitOrder = async (customerData) => {
    const { items: cartItems } = useCartStore.getState();
    if (cartItems.length === 0) {
      Swal.fire('Корзина пуста', 'Пожалуйста, добавьте товары в корзину.', 'warning');
      return;
    }
    
    const { subtotal, totalWithReserve, deliveryCost, finalAmountForPayment } = calculateOrderTotals(cartItems);

    const orderData = {
      id: generateDailyOrderId(),
      customer_name: customerData.name,
      phone: customerData.phone,
      address: customerData.address,
      comment: customerData.comment,
      deliveryTime: customerData.deliveryTime,
      subtotal: parseFloat(subtotal.toFixed(2)),
      totalWithReserve: parseFloat(totalWithReserve.toFixed(2)),
      amountToPay: parseFloat(finalAmountForPayment.toFixed(2)),
      deliveryCost: deliveryCost, 
      cart: cartItems.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantityInCart,
        price: item.sellPricePerUnit,
        unit: item.unit,
      })),
    };

   const isPaymentInitiated = await createYooKassaPayment(orderData);
    if (isPaymentInitiated) {
      Swal.fire({
        title: '🎉 Заказ создан!',
        html: `Ваш заказ <b>№${orderData.id}</b> принят и ожидает оплаты.<br>Окно для оплаты должно было открыться в новой вкладке.`,
        icon: 'success',
        confirmButtonText: 'Отлично!',
      });
      clearCart();
      handleCloseOrderForm();
    }
  };
  const onClearCart = () => {
    clearCart();
    setIsCartOpen(false);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          {/* Бургер — слева */}
          <button
            className="category-icon-button"
            onClick={() => setIsCategoryMenuOpen(prev => !prev)}
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
            onClick={() => setIsCartOpen(prev => !prev)}
            aria-label="Корзина"
          >
            <svg className="cart-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {hydrated && totalCartItems > 0 && <span className="cart-item-count">{Math.ceil(totalCartItems)}</span>}
          </button>

          {/* Поиск + сортировка + ДЕСКТОПНАЯ корзина */}
          <div className="header-controls">
            <div className="search-container">
              <input
                type="text"
                placeholder="Найти продукт..."
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
                onChange={(e) => setSortOption(e.target.value)}
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
              onClick={() => setIsCartOpen(prev => !prev)}
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

      {/* Модальное меню категорий */}
      {isCategoryMenuOpen && (
        <div className="category-menu-sidebar" onClick={e => e.stopPropagation()}>
          <div className="category-menu-header">
            <h3>Категории</h3>
            <button
              className="category-menu-close"
              onClick={() => setIsCategoryMenuOpen(false)}
              aria-label="Закрыть меню"
            >
              ×
            </button>
          </div>
          <CategorySidebar
            products={products}
            categories={catalogGroups}
            activeCategoryId={selectedCategoryId}
            onCategorySelect={(id) => {
              setSelectedCategoryId(id);
              if (!isDesktop) {
                setIsCategoryMenuOpen(false);
              }
            }}
          />
        </div>
      )}

      {/* Основной макет: товары + корзина справа */}
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
                selectedCategoryId={selectedCategoryId}
                showOnlyFallback={showOnlyFallback}
                listHeader={
                  (selectedCategoryId || searchTerm) && !loading ? (
                    <div className="product-list-header">
                      {selectedCategoryId ? (
                        <>
                          Категория:{" "}
                          <strong>
                            {catalogGroups.find((g) => g.id === selectedCategoryId)?.name || "Неизвестно"}
                          </strong>
                        </>
                      ) : (
                        <>
                          Поиск: <strong>"{searchTerm}"</strong>
                        </>
                      )}
                    </div>
                  ) : null
                }
              />
            </div>
          </main>

          {/* Корзина на десктопе */}
          {isDesktop && isCartOpen && (
            <aside className="cart-sidebar">
              <React.Suspense fallback={<div>Загрузка корзины...</div>}>
                <CartBasket
                  isSidebar={true}
                  onClose={() => setIsCartOpen(false)}
                  onClearCart={onClearCart}
                  onProceedToOrder={handleProceedToOrder}
                />
              </React.Suspense>
            </aside>
          )}
        </div>
      </div>

      {/* Мобильная корзина */}
      {!isDesktop && isCartOpen && (
        <React.Suspense fallback={null}>
          <Modal isOpen={isCartOpen} onClose={() => setIsCartOpen(false)}>
            <CartBasket
              isSidebar={false}
              onClearCart={onClearCart}
              onProceedToOrder={handleProceedToOrder}
              onClose={() => setIsCartOpen(false)}
            />
          </Modal>
        </React.Suspense>
      )}

      {isOrderFormOpen && (
        <React.Suspense fallback={null}>
          <Modal isOpen={isOrderFormOpen} onClose={handleCloseOrderForm}>
            <OrderForm onSubmit={handleSubmitOrder} onClose={handleCloseOrderForm} totalAmount={orderTotal}/>
          </Modal>
        </React.Suspense>
      )}

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-section about-us">
            <h3>О нас</h3>
            <p>Добро пожаловать в наш магазин! У нас вы можете ознакомиться с широким ассортиментом свежих, натуральных продуктов, а так же заказать доставку.</p>
          </div>
          <div className="footer-section contact-info">
            <h3>Контакты организации </h3>
            <p>
              <svg className="footer-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> 
              Южная Озереевка, пер. Торпедный, д 1,
            </p>
            <p>
              <svg className="footer-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg> <a href="tel:+79887693665" className="footer-link">
              Телефон +7 (988) 769-36-65
              </a>
            </p>
            <p>
              <svg className="footer-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-9 13h9a2 2 0 002-2V7a2 2 0 00-2-2H3a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg> <a href="mailto:elena.skryl@bk.ru" className="footer-link">
              Email elena.skryl@bk.ru
              </a>
            </p>
          </div>
          <div className="footer-section hours">
            <h3>Часы работы</h3>
            <p>Ежедневно: <time>9:00 — 21:00</time></p>
          </div>
          <div className="footer-section legal-info">
            <h3>Документы и реквизиты</h3>
            <p>ИП Скрыль Елена Вячеславовна</p> 
            <p>ИНН 231511737721</p>
            <p>ОГРНИП 323237500297466</p>
          <ul className="legal-links">
            <li>
              <a href="/user-agreement.pdf" target="_blank" rel="noopener noreferrer" className="footer-link">
                Пользовательское соглашение
              </a>
            </li>
            <li>
              <a href="/privacy-policy.pdf" target="_blank" rel="noopener noreferrer" className="footer-link">
                Политика конфиденциальности
              </a>
            </li>
          </ul>
          </div>

        </div>
        <div className="footer-bottom">
          <p suppressHydrationWarning={true} >&copy; 2025 Фасоль. Все права защищены.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;