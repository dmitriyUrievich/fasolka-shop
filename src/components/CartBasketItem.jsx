// src/components/CartBasketItem.js
import React, { useState, useEffect } from 'react';
import '../CartBasketItem.css';
import { createImageLoader } from '../utils/imageUtils';

const CartBasketItem = ({ item, updateCartQuantity, removeFromCart }) => {
  const [imageSrc, setImageSrc] = useState(() => createImageLoader(item.id, item.name).getCurrentUrl());

  useEffect(() => {
    const loader = createImageLoader(item.id, item.name);
    setImageSrc(loader.getCurrentUrl());
  }, [item.id, item.name]);

  const onImageError = () => {
    const loader = createImageLoader(item.id, item.name);
    if (loader.handleImageError()) {
      setImageSrc(loader.getCurrentUrl());
    }
  };

  return (
    <div className="cart-item">
      <img
        src={imageSrc}
        alt={item.name || 'Товар'}
        onError={onImageError}
        className="cart-item-image"
        loading="lazy"
        width="80"
        height="80"
      />
      <div className="cart-item-details">
        <h4 className="cart-item-name">{item.name}</h4>
        <p className="cart-item-price">
          {(item.sellPricePerUnit || 0).toLocaleString('ru-RU')} ₽ / шт.
        </p>
        <div className="cart-item-quantity-control">
          <button
            onClick={() => updateCartQuantity(item.id, item.quantityInCart - 1)}
            disabled={item.quantityInCart <= 1}
            aria-label="Уменьшить количество"
          >
            −
          </button>
          <span>{item.quantityInCart}</span>
          <button
            onClick={() => updateCartQuantity(item.id, item.quantityInCart + 1)}
            disabled={item.quantityInCart >= item.rests}
            aria-label="Увеличить количество"
          >
            +
          </button>
        </div>
      </div>
      <button
        className="cart-item-remove"
        onClick={() => removeFromCart(item.id)}
        aria-label={`Удалить ${item.name}`}
      >
        Удалить
      </button>
    </div>
  );
};

// 🔹 Мемоизация
export default React.memo(CartBasketItem, (prevProps, nextProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.quantityInCart === nextProps.item.quantityInCart &&
    prevProps.item.rests === nextProps.item.rests &&
    prevProps.item.sellPricePerUnit === nextProps.item.sellPricePerUnit
  );
});