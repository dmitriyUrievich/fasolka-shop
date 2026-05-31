import React, { useState, useEffect, Suspense } from 'react';
import Swal from 'sweetalert2';

import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import ProductList from './components/ProductList';
import CategoryDrawer from './components/CategoryDrawer';

import { useProducts } from './hooks/useProducts';
import { useMediaQuery } from './hooks/useMediaQuery';

import { useCartStore } from './store';
import { calculateOrderTotals } from './utils/orderUtils';
import { prepareOrderData, createPayment } from './services/orderService';

import './App.css';
import YandexMap from "./components/YandexMap.jsx";
import './YandexMap.css'
import {useHydration} from "./hooks/useHydration.js";

const CartBasket = React.lazy(() => import('./components/CartBasket.jsx'));
const Modal = React.lazy(() => import('./components/Modal.jsx'));
const OrderForm = React.lazy(() => import('./components/OrderForm.jsx'));

function App({ initialData }) {
  const hydrated = useHydration()
  const { products, catalogGroups, loading } = useProducts(initialData);

  const isDesktopRaw = useMediaQuery('(min-width: 1024px)');
  const clearCart = useCartStore(state => state.clearCart);


  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('none');
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);

  const [orderTotal, setOrderTotal] = useState(0);

  const isDesktop = hydrated ? isDesktopRaw : false;

// Удаляем лоадер
  useEffect(() => {
    if (hydrated) {
      // Когда гидратация завершена, находим лоадер и скрываем его
      const loader = document.getElementById('global-loader');
      if (loader) {
        loader.classList.add('fade-out');

        setTimeout(() => {
          loader.remove();
        }, 500);
      }
    }
  }, [hydrated]);

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
      />
      {/* Модальное меню категорий */}
      <CategoryDrawer
          isOpen={isCategoryMenuOpen}
          onClose={() => setIsCategoryMenuOpen(false)}
          products={products}
          categories={catalogGroups}
          activeCategoryId={selectedCategoryId}
          onCategorySelect={(id) => {
            setSelectedCategoryId(id);
            if ( hydrated && !isDesktop) setIsCategoryMenuOpen(false);
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
                selectedCategoryId={selectedCategoryId}
                //showOnlyFallback={showOnlyFallback}
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

            <div className="map-section">
              <h2 className="map-title">Наш Магазин на Карте</h2>
              <YandexMap
                  center={[44.675898, 37.642492]}
                  zoom={12}
                  placemark={[44.675898, 37.642492]}
                  placemarkHint="Фасоль"
                  placemarkBalloon="Мы находимся по адресу: пер. Торпедный д4."
              />
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

export default App;