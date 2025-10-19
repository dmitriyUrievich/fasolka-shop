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
  // Шаг 1: Рассчитываем все суммы в одном месте
  const { subtotal, reserveAmount, hasWeightedItems } = useMemo(() => {
    let calculatedSubtotal = 0;
    let calculatedReserve = 0;
    const weighted = cartItems.some(item => item.unit === 'Kilogram');

    cartItems.forEach(item => {
      const itemTotal = (item.sellPricePerUnit || 0) * item.quantityInCart;
      calculatedSubtotal += itemTotal;
      if (item.unit === 'Kilogram') {
        calculatedReserve += itemTotal * 0.15;
      }
    });

    return {
      subtotal: calculatedSubtotal,
      reserveAmount: calculatedReserve,
      hasWeightedItems: weighted,
    };
  }, [cartItems]);

 // Шаг 2: Расчет доставки ведется от РЕАЛЬНОЙ стоимости товаров (subtotal)
  const deliveryInfo = useMemo(() => {
    if (subtotal < 10) {
      return { cost: null, text: 'от 1000 ₽', showFreeHint: false };
    }
    if (subtotal >= 3000) {
      return { cost: 0, text: 'Бесплатно 🎁', showFreeHint: false };
    }
    return { cost: 200, text: '200 ₽', showFreeHint: true };
  }, [subtotal]);

  // Шаг 3: Финальная сумма для показа включает резерв
  const { cost: deliveryCost, text: deliveryText, showFreeHint } = deliveryInfo;
  const isOrderValid = deliveryCost !== null;
  const totalWithReserve = isOrderValid ? subtotal + reserveAmount : 0 //+ deliveryCost : 0;

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
          Товары: <span>{subtotal.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽</span>
        </p>

        <p className={`cart-delivery-info ${!isOrderValid ? 'cart-delivery-info--warning' : ''}`}>
          🚚 Доставка: <span>{deliveryText}</span>
        </p>
        
        {/* Новая строка, которая появляется только для весовых товаров */}
        {hasWeightedItems && (
          <p className="cart-reserve-info">
            Резерв за вес (+15%): <span>+{reserveAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽</span>
          </p>
        )}

        {showFreeHint && (
          <p className="cart-delivery-hint">
            💡 Добавьте ещё на{' '}
            <strong>{(3000 - subtotal).toLocaleString('ru-RU')} ₽</strong>,{' '}
            чтобы получить <strong>бесплатную доставку</strong>!
          </p>
        )}
        
        {/* Новый текст-пояснение */}
        {hasWeightedItems && (
            <div className="cart-warning-message" style={{ /* стили можно вынести в CSS */ }}>
                Мы резервируем эту сумму для весовых товаров с 
                запасом. После взвешивания с карты спишется только точная стоимость.
            </div>
        )}

        {isOrderValid && (
          <p className="cart-total">
            {hasWeightedItems ? 'Итого к резервированию' : 'Итого'}: <span>{totalWithReserve.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽</span>
          </p>
        )}

        <button
          className="cart-checkout-button"
          disabled={!isOrderValid}
          onClick={isOrderValid ? onProceedToOrder : undefined}
        >
          {subtotal < 1000 ? `Ещё ${(1000 - subtotal).toFixed()} ₽ до заказа` : 'Далее'}
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