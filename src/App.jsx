// src/App.js
import React, { useState, useEffect } from 'react';
import ProductList from './components/ProductList';
import CartBasket from './components/CartBasket'; // Импорт компонента корзины
import Modal from './components/Modal'; // Импорт компонента модального окна
import YandexMap from './components/YandexMap'; // Импорт компонента карты
import './App.css'; // Импорт стилей для App

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('none');
  const [cartItems, setCartItems] = useState([]); // Состояние для товаров в корзине
  const [isCartOpen, setIsCartOpen] = useState(false); // Состояние для открытия/закрытия корзины
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024); // Состояние для определения десктопа

  // Эффект для определения размера экрана
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Функция для добавления товара в корзину
  const addToCart = (productToAdd) => {
    setCartItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.id === productToAdd.id);

      if (existingItem) {
        // Если товар уже в корзине, увеличиваем его количество, но не больше, чем есть в наличии
        return prevItems.map((item) =>
          item.id === productToAdd.id
            ? { ...item, quantityInCart: Math.min(item.quantityInCart + 1, item.rests) } // Ограничение по остатку
            : item
        );
      } else {
        // Иначе добавляем новый товар с количеством 1, если он есть в наличии
        if (productToAdd.rests > 0) {
          return [...prevItems, { ...productToAdd, quantityInCart: 1 }];
        }
        return prevItems; // Не добавляем, если нет в наличии
      }
    });
    // Открываем корзину, если это мобильная версия
    if (!isDesktop) {
      setIsCartOpen(true);
    }
  };

  // Функция для удаления товара из корзины
  const removeFromCart = (productId) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.id !== productId));
  };

  // Функция для обновления количества товара в корзине
  const updateCartQuantity = (productId, newQuantity) => {
    setCartItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === productId) {
          const updatedQuantity = Math.max(0, Math.min(newQuantity, item.rests)); // Ограничение по остатку и не меньше 0
          if (updatedQuantity === 0) {
            return null; // Помечаем для удаления
          }
          return { ...item, quantityInCart: updatedQuantity };
        }
        return item;
      }).filter(Boolean) // Удаляем помеченные для удаления элементы
    );
  };

  // Общее количество товаров в корзине для иконки
  const totalCartItems = cartItems.reduce((total, item) => total + item.quantityInCart, 0);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">
            <svg className="app-title-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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
              <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>

            <div className="sort-container">
              <select
                className="sort-select"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
              >
                <option value="none">Без сортировки</option>
                <option value="price-asc">По цене (возрастание)</option>
                <option value="price-desc">По цене (убывание)</option>
                <option value="quantity-asc">По остатку (возрастание)</option>
                <option value="quantity-desc">По остатку (убывание)</option>
              </select>
              <div className="select-arrow">
                <svg className="select-arrow-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>

            {/* Иконка корзины - видна только на мобильных/планшетах */}
            {!isDesktop && (
              <button className="cart-icon-button" onClick={() => setIsCartOpen(true)}>
                <svg className="cart-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                {totalCartItems > 0 && <span className="cart-item-count">{totalCartItems}</span>}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="main-content-wrapper"> {/* Обертка для списка товаров и карты */}
          <ProductList
            searchTerm={searchTerm}
            sortOption={sortOption}
            addToCart={addToCart} // Передаем функцию добавления в корзину
          />
        </div>
        {/* Корзина как сайдбар на десктопе - отображается только если есть товары */}
        {isDesktop && cartItems.length > 0 && (
          <aside className="cart-sidebar">
            <CartBasket
              cartItems={cartItems}
              removeFromCart={removeFromCart}
              updateCartQuantity={updateCartQuantity}
              isSidebar={true} // Указываем, что это сайдбар
            />
          </aside>
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-section about-us">
            <h3>О нас</h3>
            <p>
              Добро пожаловать на наш Фермерский Рынок! У нас вы можете ознакомиться с широким ассортиментом
              свежих, натуральных продуктов от местных фермеров, выращенных с любовью и заботой.
              Оформляйте заказы онлайн, и мы организуем быструю и надежную доставку прямо к вашему столу.
              Наша миссия - принести лучшее от природы к вам домой!
            </p>
          </div>

          <div className="footer-section contact-info">
            <h3>Контакты</h3>
            <p>
              <svg className="footer-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              пер. Торпедный, 1, Южная Озереевка
            </p>
            <p>
              <svg className="footer-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
              +7 (999) 123-45-67
            </p>
            <p>
              <svg className="footer-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-9 13h9a2 2 0 002-2V7a2 2 0 00-2-2H3a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              imfo@farmersmarket.ru
            </p>
          </div>

          <div className="footer-section hours">
            <h3>Часы работы</h3>
            <p>Ежедневно: 9:00 - 21:00</p>
          </div>

          <div className="footer-section social">
            <h3>Мы в соцсетях</h3>
            <div className="social-links">
              <a href="#" aria-label="Facebook" className="social-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M14 13.5h2.7l.3-3.09h-3V8.04c0-.79.22-1.32 1.35-1.32H17V4.2c-.22-.03-.99-.1-2.14-.1-2.2 0-3.67 1.34-3.67 3.76v2.54H9v3.09h3V22h3V13.5z"/></svg>
              </a>
              <a href="#" aria-label="Instagram" className="social-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.74.24 2.15.42.41.19.74.45 1.08.79.34.34.6.67.79 1.08.18.4.37.98.42 2.15.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.24 1.74-.42 2.15-.19.41-.45.74-.79 1.08-.34.34-.67.6-.99.79-.4.18-.98.37-2.15.42-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.74-.24-2.15-.42-.41-.19-.74-.45-1.08-.79-.34-.34-.6-.67-.79-.99-.18-.4-.37-.98-.42-2.15-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.24-1.74.42-2.15.19-.41.45-.74.79-1.08.34-.34.67-.6.99-.79.4-.18.98-.37 2.15-.42C8.42 2.17 8.8 2.16 12 2.16zm0 2.21c-3.1 0-3.48.01-4.7.07-1.06.05-1.64.23-1.95.38-.3.14-.54.29-.75.5-.22.21-.37.45-.5.75-.15.3-.33.88-.38 1.95-.06 1.22-.07 1.6-.07 4.7s.01 3.48.07 4.7c.05 1.06.23 1.64.38 1.95.14.3.29.54.5.75.21.22.45.37.75.5.3.15.88.33 1.95.38 1.22.06 1.6.07 4.7.07s3.48-.01 4.7-.07c1.06-.05 1.64-.23 1.95-.38.3-.14.54-.29.75-.5.22-.21.37-.45.5-.75.15-.3.33-.88.38-1.95.06-1.22.07-1.6.07-4.7s-.01-3.48-.07-4.7c-.05-1.06-.23-1.64-.38-1.95-.14-.3-.29-.54-.5-.75-.21-.22-.45-.37-.75-.5-.3-.15-.88-.33-1.95-.38-1.22-.06-1.6-.07-4.7-.07zm0 3.7c-2.42 0-4.38 1.96-4.38 4.38S9.58 16.85 12 16.85s4.38-1.96 4.38-4.38S14.42 7.85 12 7.85zm0 2.21c1.2 0 2.17.97 2.17 2.17s-.97 2.17-2.17 2.17-2.17-.97-2.17-2.17.97-2.17 2.17-2.17zm6.54-6.1c0 .72-.59 1.3-1.3 1.3s-1.3-.59-1.3-1.3.59-1.3 1.3-1.3 1.3.59 1.3 1.3z"/></svg>
              </a>
              <a href="#" aria-label="Telegram" className="social-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M11.996 0C5.378 0 0 5.378 0 12s5.378 12 12 12 12-5.378 12-12S18.618 0 11.996 0zm5.553 8.324l-2.037 9.539c-.115.542-.429.673-.896.438l-3.059-2.254-1.472 1.428c-.16.155-.297.28-.616.28l.219-3.013 5.568-5.067c.24-.221-.054-.343-.377-.123L7.794 13.56l-2.936-.917c-.534-.168-.546-.575.12-1.011l11.45-7.148c.45-.281.874-.15.597.168z"/></svg>
              </a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2025 Фасолька. Все права защищены.</p>
        </div>
      </footer>

      {/* Модальное окно корзины - только для мобильных/планшетов и если корзина не пуста */}
      {!isDesktop && cartItems.length > 0 && (
        <Modal isOpen={isCartOpen} onClose={() => setIsCartOpen(false)}>
          <CartItem
            cartItems={cartItems}
            removeFromCart={removeFromCart}
            updateCartQuantity={updateCartQuantity}
            onClose={() => setIsCartOpen(false)}
            isSidebar={false} // Явно указываем, что это не сайдбар
          />
        </Modal>
      )}
    </div>
  );
}
export default App;
