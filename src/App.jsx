// src/App.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import './App.css';
import ProductList from './components/ProductList';
import CategorySidebar from './components/CategorySidebar';
import { generateDailyOrderId } from './utils/orderUtils';
import getPortion from './utils/getPortion';
import Swal from 'sweetalert2';
import { fetchProductsWithRests, getCatalog, getShops } from './services/konturMarketApi';
const apiUrl = import.meta.env.API_URL;

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
    if (isCartOpen && !isDesktop) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isCartOpen, isDesktop]);

  // Загрузка данных
  useEffect(() => {
    const loadAllData = async () => {
      const CACHE_TTL = 10 * 60 * 1000;
      const now = Date.now();

      const cachedProducts = localStorage.getItem('products_cache_v3');
      const cachedCatalog = localStorage.getItem('catalog_cache_v2');

      let productsData = null;
      let catalogData = null;

      if (cachedProducts) {
        try {
          const { data, timestamp } = JSON.parse(cachedProducts);
          if (now - timestamp < CACHE_TTL) productsData = data;
        } catch (e) {
          console.warn('Кэш продуктов повреждён');
        }
      }

      if (cachedCatalog) {
        try {
          const { data, timestamp } = JSON.parse(cachedCatalog);
          if (now - timestamp < CACHE_TTL) catalogData = data;
        } catch (e) {
          console.warn('Кэш каталога повреждён');
        }
      }

      if (productsData && catalogData) {
        setProducts(productsData);
        setCatalogGroups(catalogData);
        setLoading(false);
        return;
      }

      try {
        const shops = await getShops();
        if (!shops || shops.length === 0 || !shops[0]?.id) {
          throw new Error('Не удалось получить ID магазина');
        }

        const shopId = shops[0].id;
        const [fetchedProducts, fetchedCatalog] = await Promise.all([
          fetchProductsWithRests(),
          getCatalog(shopId),
        ]);

        setProducts(fetchedProducts);
        setCatalogGroups(fetchedCatalog);

        localStorage.setItem('products_cache_v3', JSON.stringify({ data: fetchedProducts, timestamp: now }));
        localStorage.setItem('catalog_cache_v2', JSON.stringify({ data: fetchedCatalog, timestamp: now }));
      } catch (err) {
        console.error('Ошибка загрузки данных:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
  }, []);

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
            // Для кг: округляем к ближайшему шагу (вниз)
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

  const totalCartPrice = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.sellPricePerUnit * item.quantityInCart, 0),
    [cartItems]
  );

  const handleProceedToOrder = () => {
    setIsCartOpen(false);
    setIsOrderFormOpen(true);
  };

  const handleCloseOrderForm = () => setIsOrderFormOpen(false);

  // 1. Выносим отправку в Telegram в отдельную функцию для переиспользования
  const sendOrderToTelegram = async (orderData) => {
    try {
      const response = await fetch('/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });
      if (!response.ok) {
        // Если не удалось отправить в Telegram, выбрасываем ошибку, чтобы остановить процесс
        const errorText = await response.text();
        throw new Error(`Ошибка отправки в Telegram: ${errorText || response.statusText}`);
      }
      return true; // Возвращаем true в случае успеха
    } catch (error) {
      console.error("Сетевая ошибка при отправке в Telegram:", error);
      Swal.fire({
        title: 'Сетевая ошибка',
        text: 'Не удалось отправить заказ. Проверьте интернет и попробуйте снова.',
        icon: 'error',
      });
      return false; 
    }
  };

  const createYooKassaPayment = async (orderData) => {
    try {
      const response = await fetch(`${apiUrl}/api/payment`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        value:orderData.total,
        orderId:orderData.id,
       })
      })
      if (!response.ok) {
         const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка сети при создании платежа');
      }
      const data = await response.json();
      const confirmationUrl = data?.payment?.confirmation?.confirmation_url;
      if (confirmationUrl) {
        window.open(confirmationUrl, '_blank');
        return true; 
      } else {
        throw new Error('Не получена ссылка на оплату от платежного шлюза');
      }
    } catch (error) {
      console.error("Ошибка при создании платежа:", error);
      Swal.fire({
        title: 'Ошибка оплаты',
        text: error.message || 'Не удалось создать ссылку на оплату. Попробуйте другой способ или свяжитесь с нами.',
        icon: 'error',
      });
      return false; 
    }
  };


  const handleSubmitOrder = async (customerData) => {
  
    const orderData = {
      id: generateDailyOrderId(),
      customer_name: customerData.name,
      phone: customerData.phone,
      address: customerData.address,
      comment: customerData.comment,          
      deliveryTime: customerData.deliveryTime,  
      total: totalCartPrice,
      cart: cartItems.map((item) => ({
        name: item.name,
        quantity: item.quantityInCart,
        price: item.sellPricePerUnit,
        unit: item.unit, 
      })),
    };

    let isPaymentInitiated = false; // Флаг платежа

    switch (customerData.paymentMethod) {
      case 'PSB':
        console.log( 'Click payment PSB' );
        break;
      case 'SberPay':
        console.log( 'Click payment SberPay' );
        break;
      case 'Card':
        console.log( 'Click payment YouKassa' );
        await createYooKassaPayment(orderData);
        break;
      
      default:
        console.error(`Неизвестный метод оплаты: ${customerData.paymentMethod}`);
        Swal.fire({ title: 'Ошибка', text: 'Выбран неизвестный метод оплаты.', icon: 'error' });
        return;
    }

    if (!isPaymentInitiated) {
      return; 
    }

    await sendOrderToTelegram(orderData);
    
  if (isPaymentInitiated) {
      Swal.fire({
        title: '🎉 Заказ оформлен!',
        html: `Ваш заказ <b>№${orderData.id}</b> отправлен.<br>Пожалуйста, запомните номер.<br> Окно для оплаты должно открыться в новой вкладке.`,
        icon: 'success',
        confirmButtonText: 'Отлично!',
      });
      setCartItems([]);
      handleCloseOrderForm();
    };
    } 
  // --- КОНЕЦ ОБНОВЛЕННОГО БЛОКА ЛОГИКИ ---
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
                catalogGroups={catalogGroups}
                loading={loading}
                searchTerm={searchTerm}
                sortOption={sortOption}
                cartItems={cartItems}
                updateCartQuantity={updateCartQuantity}
                addToCart={addToCart}
                selectedCategoryId={selectedCategoryId}
                // Передаём кастомный заголовок
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

          {/* Корзина справа на десктопе */}
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
                  totalPrice={totalCartPrice}
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
              removeFromCart={removeFromCart}
              updateCartQuantity={updateCartQuantity}
              totalPrice={totalCartPrice}
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
            <OrderForm onSubmit={handleSubmitOrder} onClose={handleCloseOrderForm}/>
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
            <h3>Контакты</h3>
            <p><svg className="footer-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> пер. Торпедный, 1, Южная Озереевка</p>
            <p><svg className="footer-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg> <a href="tel:+79887693665" className="footer-link">+7 (988) 769-36-65</a></p>
            <p><svg className="footer-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-9 13h9a2 2 0 002-2V7a2 2 0 00-2-2H3a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg> <a href="mailto:elena.skryl@bk.ru" className="footer-link">elena.skryl@bk.ru</a></p>
          </div>
          <div className="footer-section hours">
            <h3>Часы работы</h3>
            <p>Ежедневно: <time>9:00 — 21:00</time></p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Фасолька. Все права защищены.</p>
        </div>
      </footer>
    </div>
    </>
  );
}

export default App;