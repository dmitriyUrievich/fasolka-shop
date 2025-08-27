// App.js (оптимизированная версия)
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import ProductList from './components/ProductList';
import { generateDailyOrderId } from './utils/orderUtils';
import Swal from 'sweetalert2';

// 🔹 Ленивая загрузка тяжёлых компонентов
const CartBasket = React.lazy(() => import('./components/CartBasket'));
const Modal = React.lazy(() => import('./components/Modal'));
const OrderForm = React.lazy(() => import('./components/OrderForm'));


function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('none');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  // 🔹 Инициализация корзины
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem('cartItems');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 🔹 Дебаунс для localStorage (не пишем 100 раз в секунду)
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('cartItems', JSON.stringify(cartItems));
    }, 300);

    return () => clearTimeout(timer);
  }, [cartItems]);

  // 🔹 Определение десктопа
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 🔹 Добавление в корзину
  const addToCart = useCallback((productToAdd) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === productToAdd.id);
      if (existing) {
        return prev.map((item) =>
          item.id === productToAdd.id
            ? { ...item, quantityInCart: Math.min(item.quantityInCart + 1, item.rests) }
            : item
        );
      }
      return productToAdd.rests > 0 ? [...prev, { ...productToAdd, quantityInCart: 1 }] : prev;
    });
  }, []);

  // 🔹 Удаление из корзины
  const removeFromCart = useCallback((productId) => {
    setCartItems((prev) => prev.filter((item) => item.id !== productId));
  }, []);

  // 🔹 Обновление количества
  const updateCartQuantity = useCallback((productId, newQuantity) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.id === productId) {
            const qty = Math.max(0, Math.min(newQuantity, item.rests));
            return qty === 0 ? null : { ...item, quantityInCart: qty };
          }
          return item;
        })
        .filter(Boolean)
    );
  }, []);

  // 🔹 Подсчёт корзины (мемоизировано)
  const totalCartItems = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantityInCart, 0),
    [cartItems]
  );

  const totalCartPrice = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.sellPricePerUnit * item.quantityInCart, 0),
    [cartItems]
  );

  // 🔹 Открытие формы заказа
  const handleProceedToOrder = () => {
    setIsCartOpen(false);
    setIsOrderFormOpen(true);
  };

  const handleCloseOrderForm = () => setIsOrderFormOpen(false);

  // 🔹 Отправка заказа
  const handleSubmitOrder = async (customerData) => {
    const orderData = {
      id: generateDailyOrderId(),
      customer_name: customerData.name,
      phone: customerData.phone,
      address: customerData.address,
      total: totalCartPrice,
      cart: cartItems.map((item) => ({
        name: item.name,
        quantity: item.quantityInCart,
        price: item.sellPricePerUnit,
      })),
    };

    try {
      const response = await fetch('/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      if (response.ok) {
        Swal.fire({
          title: '🎉 Заказ оформлен!',
          text: `Ваш заказ №${orderData.id} отправлен. Спасибо!`,
          icon: 'success',
          confirmButtonText: 'Ок',
          background: '#f8f9fa',
        });
        setCartItems([]);
        setIsOrderFormOpen(false);
      } else {
        const text = await response.text();
        Swal.fire({
          title: 'Ошибка',
          text: `Ошибка: ${text || response.statusText}`,
          icon: 'error',
          confirmButtonText: 'Понятно',
        });
      }
    } catch (error) {
      Swal.fire({
        title: 'Сетевая ошибка',
        text: 'Проверьте интернет и попробуйте снова.',
        icon: 'error',
      });
    }
  };

  const clearCart = (onClose) => {
    setCartItems([]);
    if (onClose) onClose();
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">
            <svg className="app-title-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2-1.343-2-3-2zM9 14V8m6 6V8m-3 6v2m-3-2c-.828 0-1.5.672-1.5 1.5S7.172 17 8 17s1.5-.672 1.5-1.5S8.828 14 8 14zM16 14c-.828 0-1.5.672-1.5 1.5S15.172 17 16 17s1.5-.672 1.5-1.5S16.828 14 16 14z"></path>
            </svg>
            Фасолька
          </h1>
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
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
                <option value="no-image">Товары без фото</option>
              </select>
              <div className="select-arrow">
                <svg className="select-arrow-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>

            <button className="cart-icon-button" onClick={() => setIsCartOpen(true)}>
              <svg className="cart-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
              {totalCartItems > 0 && <span className="cart-item-count">{totalCartItems}</span>}
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="main-content-wrapper">
          <ProductList
            searchTerm={searchTerm}
            sortOption={sortOption}
            cartItems={cartItems}
            updateCartQuantity={updateCartQuantity}
            addToCart={addToCart}
          />
        </div>

        {isDesktop && isCartOpen && (
          <aside className="cart-sidebar">
            <React.Suspense fallback={<div>Загрузка корзины...</div>}>
              <CartBasket
                isSidebar={true}
                onClose={() => setIsCartOpen(false)}
                onClick={() => clearCart(() => setIsCartOpen(false))}
                cartItems={cartItems}
                removeFromCart={removeFromCart}
                updateCartQuantity={updateCartQuantity}
                totalPrice={totalCartPrice}
                onProceedToOrder={handleProceedToOrder}
              />
            </React.Suspense>
          </aside>
        )}
      </main>

{/* Футер — оставить обязательно */}
<footer className="app-footer">
  <div className="footer-content">
    {/* === О нас === */}
    <div className="footer-section about-us">
      <h3>О нас</h3>
      <p>
        Добро пожаловать в наш магазин! У нас вы можете ознакомиться с широким ассортиментом
        свежих, натуральных продуктов от местных фермеров, выращенных с любовью и заботой.
        Оформляйте заказы онлайн, и мы организуем быструю и надежную доставку прямо к вашему столу.
        Наша миссия — принести лучшее от природы к вам домой!
      </p>
    </div>

    {/* === Контакты === */}
    <div className="footer-section contact-info">
      <h3>Контакты</h3>
      <p>
        <svg className="footer-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"></path>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </svg>
        пер. Торпедный, 1, Южная Озереевка
      </p>
      <p>
        <svg className="footer-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
        </svg>
        <a href="tel:+79887693665" className="footer-link">+7 (988) 769-36-65</a>
      </p>
      <p>
        <svg className="footer-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-9 13h9a2 2 0 002-2V7a2 2 0 00-2-2H3a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
        </svg>
        <a href="mailto:elena.skryl@bk.ru" className="footer-link">elena.skryl@bk.ru</a>
      </p>
    </div>

    {/* === Часы работы === */}
    <div className="footer-section hours">
      <h3>Часы работы</h3>
      <p>Ежедневно: <time>9:00 — 21:00</time></p>
    </div>
  </div>

  {/* === Копирайт === */}
  <div className="footer-bottom">
    <p>&copy; {new Date().getFullYear()} Фасолька. Все права защищены.</p>
  </div>
  </footer>

      {/* 🔹 Модальное окно корзины (мобильная) */}
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

      {/* 🔹 Модальное окно заказа */}
      {isOrderFormOpen && (
        <React.Suspense fallback={null}>
          <Modal isOpen={isOrderFormOpen} onClose={handleCloseOrderForm}>
            <OrderForm onSubmit={handleSubmitOrder} onClose={handleCloseOrderForm} />
          </Modal>
        </React.Suspense>
      )}
    </div>
  );
}

export default App;