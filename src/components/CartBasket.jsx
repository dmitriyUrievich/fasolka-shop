// src/components/Cart.js
import React from 'react';
import '../CartBasket.css'; // Стили для корзины

const CartBasket = ({ CartBaskets, removeFromCart, updateCartQuantity, onClose }) => {
  // Вычисляем общую сумму товаров в корзине
  const totalAmount = CartBaskets.reduce(
    (total, item) => total + (item.sellPricePerUnit || 0) * item.quantityInCart,
    0
  );

  return (
    <div className="cart-container">
      <div className="cart-header">
        <h2>Ваша Корзина</h2>
        <button className="cart-close-button" onClick={onClose}>
          &times; {/* Символ крестика для закрытия */}
        </button>
      </div>

      {CartBaskets.length === 0 ? (
        <p className="cart-empty-message">Ваша корзина пуста.</p>
      ) : (
        <div className="cart-items-list">
          {CartBaskets.map((item) => (
            <div key={item.id} className="cart-item">
              <img
                // Заглушка для изображения товара в корзине
                src={`https://placehold.co/60x60/9BE16C/3B82F6?text=${encodeURIComponent(item.name.split(' ')[0])}`}
                alt={item.name}
                className="cart-item-image"
              />
              <div className="cart-item-details">
                <h4 className="cart-item-name">{item.name}</h4>
                <p className="cart-item-price">
                  {(item.sellPricePerUnit || 0).toLocaleString('ru-RU')} ₽ / шт.
                </p>
                <div className="cart-item-quantity-control">
                  <button
                    onClick={() => updateCartQuantity(item.id, item.quantityInCart - 1)}
                    disabled={item.quantityInCart <= 1} // Отключаем кнопку, если количество 1
                  >
                    -
                  </button>
                  <span>{item.quantityInCart}</span>
                  <button
                    onClick={() => updateCartQuantity(item.id, item.quantityInCart + 1)}
                    disabled={item.quantityInCart >= item.rests} // Нельзя добавить больше, чем есть в наличии
                  >
                    +
                  </button>
                </div>
              </div>
              <button className="cart-item-remove" onClick={() => removeFromCart(item.id)}>
                Удалить
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="cart-summary">
        <p className="cart-total">Итого: <span>{totalAmount.toLocaleString('ru-RU')} ₽</span></p>
        <button className="cart-checkout-button" disabled={CartBaskets.length === 0}>
          Оформить заказ ({totalAmount.toLocaleString('ru-RU')} ₽)
        </button>
      </div>
    </div>
  );
};

export default CartBasket;
