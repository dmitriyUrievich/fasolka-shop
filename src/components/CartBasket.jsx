// src/components/CartBasket.js
import React, { useMemo } from 'react';
import '../CartBasket.css';
import CartBasketItem from './CartBasketItem';

const CartBasket = ({ 
  cartItems = [], 
  removeFromCart, 
  onClearCart, 
  updateCartQuantity, 
  onClose, 
  onProceedToOrder 
}) => {
  // 🔹 Мемоизация суммы
  const subtotal = useMemo(() => {
    return cartItems.reduce(
      (sum, item) => sum + (item.sellPricePerUnit || 0) * item.quantityInCart,
      0
    );
  }, [cartItems]);

  // 🔹 Мемоизация доставки
  const deliveryInfo = useMemo(() => {
    if (subtotal < 1000) {
      return { cost: null, text: 'от 1000 ₽', showFreeHint: false };
    }
    if (subtotal >= 3000) {
      return { cost: 0, text: 'Бесплатно 🎁', showFreeHint: false };
    }
    return { cost: 200, text: '200 ₽', showFreeHint: true };
  }, [subtotal]);

  const { cost: deliveryCost, text: deliveryText, showFreeHint } = deliveryInfo;
  const isOrderValid = deliveryCost !== null;
  const total = isOrderValid ? subtotal + deliveryCost : 0;

  return (
    <div className="cart-container">
      <div className="cart-header">
        <h2>Ваш заказ 🛒</h2>
        <button className="cart-close-button" onClick={onClose} aria-label="Закрыть корзину">
          &times;
        </button>
      </div>

      <button
        className="cart-clear-button"
        onClick={onClearCart}
        disabled={cartItems.length === 0}
        title={cartItems.length === 0 ? 'Корзина уже пуста' : 'Очистить корзину'}
      >
        Очистить
      </button>

      {cartItems.length === 0 ? (
        <p className="cart-empty-message">Ваша корзина пуста.</p>
      ) : (
        <div className="cart-items-list">
          {cartItems.map((item) => (
            <CartBasketItem
              key={item.id}
              item={item}
              removeFromCart={removeFromCart}
              updateCartQuantity={updateCartQuantity}
            />
          ))}
        </div>
      )}

      <div className="cart-summary">
        <p className="cart-subtotal">
          Товары: <span>{subtotal.toLocaleString('ru-RU')} ₽</span>
        </p>

        <p className={`cart-delivery-info ${!isOrderValid ? 'cart-delivery-info--warning' : ''}`}>
          🚚 Доставка: <span>{deliveryText}</span>
        </p>

        {showFreeHint && (
          <p className="cart-delivery-hint">
            💡 Добавьте ещё на{' '}
            <strong>{(3000 - subtotal).toLocaleString('ru-RU')} ₽</strong>,{' '}
            чтобы получить <strong>бесплатную доставку</strong>!
          </p>
        )}

        {isOrderValid && (
          <p className="cart-total">
            Итого: <span>{total.toLocaleString('ru-RU')} ₽</span>
          </p>
        )}

        <button
          className="cart-checkout-button"
          disabled={!isOrderValid}
          onClick={isOrderValid ? onProceedToOrder : undefined}
        >
          {subtotal < 1000 ? `Ещё ${1000 - subtotal.toFixed()} ₽ до заказа` : 'Далее'}
        </button>
      </div>
    </div>
  );
};

// 🔹 Добавляем memo
export default React.memo(CartBasket, (prevProps, nextProps) => {
  return (
    prevProps.cartItems.length === nextProps.cartItems.length &&
    prevProps.cartItems.every((item, i) =>
      item.id === nextProps.cartItems[i]?.id &&
      item.quantityInCart === nextProps.cartItems[i]?.quantityInCart &&
      item.rests === nextProps.cartItems[i]?.rests
    ) &&
    prevProps.onProceedToOrder === nextProps.onProceedToOrder
  );
});