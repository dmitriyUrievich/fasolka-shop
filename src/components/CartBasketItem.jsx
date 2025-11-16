// src/components/CartBasketItem.js
import React, { useState, useEffect,useMemo  } from 'react';
import '../CartBasketItem.css';
import { createImageLoader } from '../utils/imageUtils';
import getPortion from '../utils/getPortion';
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
  const price = parseFloat(item.sellPricePerUnit.replace(',', '.'));
    
  const portion = item.unit === 'Kilogram' ? getPortion(item.name, item.unit) : null;
  const unitLabel = item.unit === 'Kilogram' ? `кг` : `шт.`;
  const step = portion ? portion.weightInGrams / 1000 : item.unit === 'Kilogram' ? 0.1 : 1;
 
  const itemTotalPrice = useMemo(() => {
    return (price || 0) * item.quantityInCart;
  }, [price, item.quantityInCart]);


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
        <div className="cart-item-header">
        <h4 className="cart-item-name">{item.name}</h4>
          <button
            className="cart-item-remove-inline"
            onClick={() => removeFromCart(item.id)}
            aria-label={`Удалить ${item.name}`}
          >
              &#10006;
           </button>
          </div>
        <p className="cart-item-price">
          {price} ₽ / {unitLabel}
        </p>
        <div className="cart-item-footer">
        <div className="cart-item-quantity-control">
          <button
            onClick={() => updateCartQuantity(item.id, item.quantityInCart - step)}
            disabled={item.quantityInCart <= step}
            aria-label="Уменьшить количество"
          >
            −
          </button>
          <span>
            {item.unit === 'Kilogram'
              ? `${item.quantityInCart.toFixed(3)} кг`
              : `${Math.round(item.quantityInCart)} шт.`}
          </span>

           <div className="tooltip">
              <button
                onClick={() => updateCartQuantity(item.id, item.quantityInCart + step)}
                disabled={item.quantityInCart + step > item.rests}
                aria-label="Увеличить количество"
              >
                +
              </button>
              {item.quantityInCart + step > item.rests && (
                <span className="tooltip-text">Товара больше нет</span>
              )}
            </div>
          </div>
            <p className="cart-item-total-price">
            {itemTotalPrice.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
          </p>
        </div>
      </div>
    </div>
  );
};

// 🔹 Мемоизация
export default React.memo(CartBasketItem, (prevProps, nextProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.quantityInCart === nextProps.item.quantityInCart &&
    prevProps.item.rests === nextProps.item.rests &&
    prevProps.price === nextProps.item.sellPricePerUnit
  );
});