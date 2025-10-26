import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import './App.css';
import ProductList from './components/ProductList';
import CategorySidebar from './components/CategorySidebar';
import { generateDailyOrderId } from './utils/orderUtils';
import getPortion from './utils/getPortion';
import Swal from 'sweetalert2';

const CartBasket = React.lazy(() => import('./components/CartBasket'));
const Modal = React.lazy(() => import('./components/Modal'));
const OrderForm = React.lazy(() => import('./components/OrderForm'));

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('none');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [showOnlyFallback, setShowOnlyFallback] = useState(false);
  const [products, setProducts] = useState([]);
  const [catalogGroups, setCatalogGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem('cartItems');
      if (!saved) {
        return []; 
      }
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Не удалось прочитать корзину из localStorage:", error);
      return []; 
    }
  });
useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('cartItems', JSON.stringify(cartItems));
    }, 300);
    return () => clearTimeout(timer);
  }, [cartItems]);

  // Адаптивность
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      try {
        // Для продакшена - относительный путь /api/products-data или полный https://домен.ru/api/products-data
        const response = await fetch('/api/products-data'); 
        
        if (!response.ok) {
          throw new Error(`Ошибка сети: ${response.statusText}`);
        }
        
        const data = await response.json();

        setProducts(data.products || []);
        setCatalogGroups(data.catalog || []);
      } catch (err) {
        console.error('Ошибка загрузки данных с сервера:', err);
        Swal.fire({
          title: 'Ошибка',
          text: 'Не удалось загрузить каталог товаров. Попробуйте обновить страницу.',
          icon: 'error',
        });
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
  }, []);

 const cartCalculations = useMemo(() => {
    let subtotal = 0;
    let totalWithReserve = 0;
  
    cartItems.forEach(item => {
      const itemTotal = item.sellPricePerUnit * item.quantityInCart;
      subtotal += itemTotal;
  
      if (item.unit === 'Kilogram') {
        totalWithReserve += itemTotal * 1.15;
      } else {
        totalWithReserve += itemTotal;
      }
    });

    // Расчет доставки (логика из CartBasket.js)
    let deliveryCost = 0;
    if (subtotal > 0 && subtotal < 1000) {
      // Сумма меньше минимальной, доставка невозможна (но для расчета оставим 200)
       deliveryCost = 200;
    } else if (subtotal >= 1000 && subtotal < 3000) {
       deliveryCost = 200;
    } else {
      // subtotal >= 3000 или корзина пуста
       deliveryCost = 0;
    }
    
    const finalAmountForPayment = totalWithReserve + deliveryCost;

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      totalWithReserve: parseFloat(totalWithReserve.toFixed(2)),
      finalAmountForPayment: parseFloat(finalAmountForPayment.toFixed(2))
    };
  }, [cartItems]);

  // Работа с корзиной
  const addToCart = useCallback((productToAdd) => {
    setCartItems((prev) => {
      const { id, unit, rests } = productToAdd;
      const portion = unit === 'Kilogram' ? getPortion(productToAdd.name, unit) : null;
      const step = portion ? portion.weightInGrams / 1000 : unit === 'Kilogram' ? 0.1 : 1;

      const existing = prev.find((item) => item.id === id);
      if (existing) {
        const newQty = Math.min(existing.quantityInCart + step, existing.rests);
        return prev.map((item) =>
          item.id === id ? { ...item, quantityInCart: newQty } : item
        );
      }

      if (rests >= step) {
        return [...prev, { ...productToAdd, quantityInCart: step }];
      }

      return prev;
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCartItems((prev) => prev.filter((item) => item.id !== productId));
  }, []);

const updateCartQuantity = useCallback((productId, newQuantity) => {
  setCartItems((prev) =>
    prev.map((item) => {
        if (item.id === productId) {
          const portion = item.unit === 'Kilogram' ? getPortion(item.name, item.unit) : null;
          const step = portion ? portion.weightInGrams / 1000 : item.unit === 'Kilogram' ? 0.1 : 1;

          let qty = Math.max(0, newQuantity);
          if (item.unit !== 'Kilogram' && !portion) {
            qty = Math.floor(qty); // штуки — только целые
          } else {
            qty = ((qty / step) * step).toFixed(2);
          }

          qty = Math.min(qty, item.rests);

          return qty === 0 ? null : { ...item, quantityInCart: qty };
        }
        return item;
      })
      .filter(Boolean)
  );
}, []);

  const totalCartItems = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantityInCart, 0),
    [cartItems]
  );

  const handleProceedToOrder = () => {
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
    if (cartItems.length === 0) {
      Swal.fire('Корзина пуста', 'Пожалуйста, добавьте товары в корзину.', 'warning');
      return;
    }
    const { subtotal, totalWithReserve,finalAmountForPayment  } = cartCalculations;
    const deliveryCost = finalAmountForPayment - totalWithReserve;
    const orderData = {
      id: generateDailyOrderId(),
      customer_name: customerData.name,
      phone: customerData.phone,
      address: customerData.address,
      comment: customerData.comment,
      deliveryTime: customerData.deliveryTime,
      subtotal: subtotal,
      totalWithReserve: totalWithReserve,// Сумма с запасом (ХОЛДИРОВАНИЯ)
      amountToPay: finalAmountForPayment, // общая сумма 
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
      setCartItems([]);
      handleCloseOrderForm();
    }
  };

  const onClearCart = () => {
    setCartItems([]);
    setIsCartOpen(false);
  };

  // Закрытие по Esc
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

  return (
    <> 
    <Helmet>
      <title>Фасоль — ваш магазни продуктов</title>
      <meta name="description" content="Свежие овощи, фрукты, мясо и молочка с доставкой от фермеров." />
      <meta name="keywords" content="доставка овощей и фруктов, продуктовый магазин, молочка, мясо, Южная Озереевка" />
      
      {/* Open Graph — динамически (если нужно) */}
      <meta property="og:title" content="Фасоль — Свежие продукты с доставкой" />
      <meta property="og:description" content="Закажите свежие продукты с доставкой на дом." />
      <meta property="og:image" content="%PUBLIC_URL%/basket.jpg" />
      <meta property="og:url" content="https://fasol-nvrsk.ru/" />
    </Helmet>
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

          {/* Логотип */}
          <h1 className="app-title">
            <img src="/log-header.png" className="logo-header" alt="Логотип Фасоль" />   
          </h1>

          {/* Мобильная корзина */}
          <button
            className="cart-icon-button mobile-cart"
            onClick={() => setIsCartOpen(prev => !prev)}
            aria-label="Корзина"
          >
            <svg className="cart-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {totalCartItems > 0 && <span className="cart-item-count">{Math.ceil(totalCartItems)}</span>}
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
              {/* <div className="fallback-toggle-container">
                <input 
                  type="checkbox" 
                  id="fallback-toggle"
                  className="fallback-toggle-checkbox"
                  checked={showOnlyFallback} 
                  onChange={(e) => setShowOnlyFallback(e.target.checked)} 
                />
                <label htmlFor="fallback-toggle" className="fallback-toggle-label">
                  Без фото
                </label>
              </div> */}
            <button
              className="cart-icon-button desktop-cart"
              onClick={() => setIsCartOpen(prev => !prev)}
              aria-label="Корзина"
            >
              <svg className="cart-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {totalCartItems > 0 && <span className="cart-item-count">{Math.ceil(totalCartItems)}</span>}
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
                cartItems={cartItems}
                updateCartQuantity={updateCartQuantity}
                addToCart={addToCart}
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
                  cartItems={cartItems}
                  removeFromCart={removeFromCart}
                  updateCartQuantity={updateCartQuantity}
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
              cartItems={cartItems}
              onClearCart={onClearCart}
              removeFromCart={removeFromCart}
              updateCartQuantity={updateCartQuantity}
              onProceedToOrder={handleProceedToOrder}
              onClose={() => setIsCartOpen(false)}
            />
          </Modal>
        </React.Suspense>
      )}

      {/* Форма заказа */}
      {isOrderFormOpen && (
        <React.Suspense fallback={null}>
          <Modal isOpen={isOrderFormOpen} onClose={handleCloseOrderForm}>
            <OrderForm onSubmit={handleSubmitOrder} onClose={handleCloseOrderForm} totalAmount={cartCalculations.finalAmountForPayment}/>
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
          <p>&copy; {new Date().getFullYear()} Фасоль. Все права защищены.</p>
        </div>
      </footer>
    </div>
    </>
  );
}

export default App;