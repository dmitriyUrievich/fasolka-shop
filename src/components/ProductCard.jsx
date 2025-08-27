import React, { useState, useMemo, useRef } from 'react';
import '../ProductCard.css';
import { createImageLoader } from '../utils/imageUtils';

const capitalizeFirstLetter = (string) =>
  string ? string.charAt(0).toUpperCase() + string.slice(1) : '';

const ProductCard = ({ product, cartItems, addToCart, updateCartQuantity, ageConfirmed, onConfirmAge }) => {
  const { id, name: rawName, sellPricePerUnit, rests, productType } = product || {};

  const imageLoaderRef = useRef(null);

  if (!imageLoaderRef.current || imageLoaderRef.current.productId !== id) {
    const hasValidId = id != null && id !== 'undefined' && id !== '';
    if (!hasValidId) {
      imageLoaderRef.current = {
        productId: id,
        getCurrentUrl: () => '/img/fallback.webp',
        handleImageError: () => false,
        isFallback: () => true,
      };
    } else {
      const loader = createImageLoader(id, rawName);
      loader.productId = id; // Для отладки
      imageLoaderRef.current = loader;
    }
  }

  const [imageSrc, setImageSrc] = useState(() => imageLoaderRef.current.getCurrentUrl());

  const containsLighterKeyword = (text) => {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return lowerText.includes('зажигалк') || lowerText.includes('зажагк');
  };

  const onImageError = () => {
    //console.error(`[ImageError] Не удалось загрузить: ${imageSrc}`);
    const loader = imageLoaderRef.current;
    if (loader?.handleImageError) {
      loader.handleImageError(); // Меняем состояние
      const newSrc = loader.getCurrentUrl();
      //console.log(`[ImageError] Переключаем на: ${newSrc}`);
      setImageSrc(newSrc);
    }
  };

  const name = capitalizeFirstLetter(rawName);
  const price = sellPricePerUnit;
  const disableBuyTypes = ['Tobacco'];
  const ageRestrictedTypes = ['Tobacco', 'LightAlcohol', 'Cigarettes', 'Softdrinks'];
  
  const disableBuy = disableBuyTypes.includes(productType);
  const isAgeRestricted = ageRestrictedTypes.includes(productType) || containsLighterKeyword(rawName);

  const itemInCart = cartItems.find((item) => item.id === id);
  const quantity = itemInCart ? itemInCart.quantityInCart : 0;
  const total = quantity * price;

  return (
    <div className="product-card">
      <div className="product-card__image-wrapper">
        <img
          src={imageSrc}
          loading="lazy"
          alt={name || 'Товар без названия'}
          className={`product-card__image ${isAgeRestricted && !ageConfirmed ? 'product-card__image--blur' : ''}`}
          onError={onImageError}
        />
        {isAgeRestricted && !ageConfirmed && (
          <div className="product-card__age-overlay">
            <div className="age-text">Только для лиц старше 18 лет</div>
          </div>
        )}
      </div>
      <div className="product-card__content">
        <h3 className="product-card__name">{name}</h3>
        {import.meta.env.DEV && <p>{id}-{productType}</p>}
        <p className="product-card__price">
          {price ? `${price.toLocaleString('ru-RU')} ₽` : 'Цена не указана'}
        </p>
        <p className="product-card__quantity">
          {rests > 5 ? 'Товара много' : `Осталось ${rests} шт.`}
        </p>
        {isAgeRestricted && !ageConfirmed ? (
          <button className="product-card__button" onClick={onConfirmAge}>
            Подтвердить возраст
          </button>
        ) : (
          <>
            {quantity > 0 ? (
              <div className="quantity-control">
                <button
                  className="btn-quantity"
                  aria-label="Уменьшить количество"
                  onClick={() => updateCartQuantity(product.id, quantity - 1)}
                  disabled={quantity === 0}
                >
                  −
                </button>

                <div className="quantity-info">
                  <div className="quantity">{quantity}</div>
                  <div className="total-price">{total.toLocaleString('ru-RU')} ₽</div>
                </div>

                <button
                  className="btn-quantity"
                  aria-label="Увеличить количество"
                  onClick={() => addToCart(product)}
                  disabled={quantity >= rests || rests === 0 || disableBuy}
                >
                  +
                </button>
              </div>
            ) : (
              <button
                className="product-card__button"
                disabled={rests === 0 || disableBuy}
                onClick={() => addToCart(product)}
                title={disableBuy ? 'Покупка данного товара запрещена' : ''}
              >
                {rests > 0 && !disableBuy ? 'Добавить в корзину' : 'Только в магазине'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProductCard;