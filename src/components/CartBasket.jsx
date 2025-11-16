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

  const { subtotal, reserveAmount, hasWeightedItems } = useMemo(() => {
    let calculatedSubtotal = 0;
    let calculatedReserve = 0;
    const weighted = cartItems.some(item => item.unit === 'Kilogram');

    cartItems.forEach(item => {
      const itemTotal = (parseFloat(item.sellPricePerUnit.replace(',', '.')) || 0) * item.quantityInCart;
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
    if (subtotal < 1000) {
      return { cost: null, text: 'от 1000 ₽', showFreeHint: false };
    }
    if (subtotal >= 3000) {
      return { cost: 0, text: 'Бесплатно 🎁', showFreeHint: false };
    }
    return { cost: 200, text: '200 ₽', showFreeHint: true };
  }, [subtotal]);

    const requiresAgeVerification = useMemo(() => {
    // Проверяем, есть ли в корзине хотя бы один товар с типом 'Softdrinks'
    return cartItems.some(item => item.productType === 'Softdrinks');
  }, [cartItems]);

  const { cost: deliveryCost, text: deliveryText, showFreeHint } = deliveryInfo;
  const isOrderValid = deliveryCost !== null;
  const totalWithReserve = isOrderValid ? subtotal + reserveAmount + deliveryCost : 0;
console.log('----',cartItems)
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
                {showFreeHint && (
          <p className="cart-delivery-hint">
            💡 Добавьте ещё на{' '}
            <strong>{(3000 - subtotal).toLocaleString('ru-RU')} ₽</strong>,{' '}
            чтобы получить <strong>бесплатную доставку</strong>!
          </p>
        )}

        {requiresAgeVerification && (
            <div className="cart-warning-message">
                <p>Для получения заказа, содержащего товары 18+, потребуется документ, удостоверяющий личность.</p>
            </div>
        )}

        {hasWeightedItems && (
            <div className="cart-warning-message" >
            <p className="cart-reserve-info">
            Резерв за весовой товар (+15%): <span>+{reserveAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽</span>
          </p>
               <p>Мы резервируем эту сумму для весовых товаров с запасом. </p> 
                <p>После взвешивания остаток автоматически вернется вам на карту.</p>
            </div>
        )}

        {isOrderValid && (
          <p className="cart-total">
            {hasWeightedItems ? 'Итого к оплате' : 'Итого'}: <span>{totalWithReserve.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽</span>
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