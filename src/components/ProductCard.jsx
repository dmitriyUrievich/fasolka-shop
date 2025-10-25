// components/ProductCard.js
import React, { useState, useRef } from 'react';
import '../ProductCard.css';
import { createImageLoader } from '../utils/imageUtils';
import getPortion from '../utils/getPortion';

const capitalizeFirstLetter = (string) =>
  string ? string.charAt(0).toUpperCase() + string.slice(1) : '';

const ProductCard = ({ product, cartItems, addToCart, updateCartQuantity, ageConfirmed, onConfirmAge, isDiscount  }) => {
  const { id, name: rawName, sellPricePerUnit, rests, productType, unit } = product || {};

  const imageLoaderRef = useRef(null);

  // --- Обработка изображения (без изменений) ---
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
      loader.productId = id;
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
    const loader = imageLoaderRef.current;
    if (loader?.handleImageError) {
      loader.handleImageError();
      const newSrc = loader.getCurrentUrl();
      setImageSrc(newSrc);
    }
  };

  const name = capitalizeFirstLetter(rawName);
  const price = parseFloat(sellPricePerUnit) || 0;
  const disableBuyTypes = ['Tobacco'];
  const ageRestrictedTypes = ['Tobacco', 'LightAlcohol', 'Cigarettes'];
  
  const disableBuy = disableBuyTypes.includes(productType);
  const isAgeRestricted = ageRestrictedTypes.includes(productType) || containsLighterKeyword(rawName);

  const itemInCart = cartItems.find((item) => item.id === id);
  const quantity = itemInCart ? parseFloat(itemInCart.quantityInCart) : 0;
  const total = quantity * price;

  // 🔹 Определяем порцию ТОЛЬКО для Kilogram
  const portion = unit === 'Kilogram' ? getPortion(rawName, unit) : null;

  // 🔹 Сообщение об остатке — зависит от unit
  const getRestsMessage = () => {
    const amount = rests;

    if (unit === 'Kilogram') {
      if (amount > 5) return 'Товара много';
      if (amount > 0) return `Осталось ${parseFloat(amount).toFixed(1)} кг`;
      return 'Нет в наличии';
    }

    if (amount > 5) return 'Осталось много';
    if (amount > 0) return `Осталось ${Math.floor(amount)} шт.`;
    return 'Нет в наличии';
  };

  // 🔹 Поведение зависит от unit
  const isWeighted = unit === 'Kilogram';

  // 🔹 Для кг: шаг — порция или 0.1 кг. Для штук — шаг 1.
  const increment = isWeighted && portion
    ? portion.weightInGrams / 1000 // шаг в кг
    : isWeighted
      ? 0.1 // шаг 100 грамм
      : 1;

  const decrement = increment;

  const maxAvailable = isWeighted
    ? rests
    : Math.floor(rests);

  const nextStepAvailable = quantity + increment <= maxAvailable;

  return (
    <div className="product-card">
      <div className="product-card__image-wrapper">
        {isDiscount && (
          <div className="product-card__special-offer">
            <span>Акция</span>
          </div>
        )}
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
        {import.meta.env.DEV && <p>{id}</p>}
        <p className="product-card__price">
          {price ? `${price.toLocaleString('ru-RU')} ₽` : 'Цена не указана'}
        </p>

        {/* 🔹 Порция — только для кг */}
        {portion && (
          <p className="product-card__portion">
            <small>Порция: {portion.portionLabelShort}</small>
          </p>
        )}

        <p className="product-card__quantity">
          {getRestsMessage()}
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
                  onClick={() => updateCartQuantity(product.id, quantity - decrement)}
                  disabled={quantity === 0}
                >
                  −
                </button>

                <div className="quantity-info">
                  <div className="quantity">
                    {isWeighted
                      ? `${quantity.toFixed(3)} кг`
                      : `${Math.round(quantity)} шт.`}
                  </div>
                  <div className="total-price">{total.toLocaleString('ru-RU')} ₽</div>
                </div>

                  <button
                    className="btn-quantity"
                    aria-label="Увеличить количество"
                    onClick={() => addToCart(product)}
                    disabled={!nextStepAvailable || disableBuy}
                  >
                    +
                  </button>
                  {(!nextStepAvailable && !disableBuy) && (
                    <span className="tooltip-text">Товара нет</span>
                  )}
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