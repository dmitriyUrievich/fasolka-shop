import React, { useState, useRef, useMemo, useCallback,useEffect } from 'react';
import '../ProductCard.css';
import { createImageLoader } from '../utils/imageUtils';
import getPortion from '../utils/getPortion';
import { useCartStore } from '../store';

const CAPITALIZE_FIRST_LETTER = (string) =>
  string ? string.charAt(0).toUpperCase() + string.slice(1) : '';

const CONTAINS_LIGHTER_KEYWORD = (text) => {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return lowerText.includes('зажигалк') || lowerText.includes('зажагк');
};

const GENERATE_SRC_SET = (baseSrc) => {
    if (!baseSrc || baseSrc.includes('fallback')) return null;
    
    const lastDotIndex = baseSrc.lastIndexOf('.');
    const pathWithoutExt = lastDotIndex === -1 ? baseSrc : baseSrc.slice(0, lastDotIndex);
    
    return `${pathWithoutExt}-150w.webp 150w, ${pathWithoutExt}-250w.webp 250w`;
}

const DISABLE_BUY_TYPES = ['Tobacco'];
const AGE_RESTRICTED_TYPES = ['Tobacco', 'LightAlcohol', 'Cigarettes'];

const ProductCard = React.memo(({ product, ageConfirmed, onConfirmAge, isDiscount, isPriority }) => {
  const { id, name: rawName, sellPricePerUnit, rests, productType, unit } = product || {};

  const addToCart = useCartStore(state => state.addToCart);
  const updateCartQuantity = useCartStore(state => state.updateCartQuantity);
  const quantity = useCartStore(state => state.items.find(item => item.id === id)?.quantityInCart || 0);


  const imageLoaderRef = useRef(null);
  const [imageSrc, setImageSrc] = useState('/img/fallback.webp');

  useEffect(() => {
    const hasValidId = id != null && id !== 'undefined' && id !== '';
    if (!hasValidId) {
      imageLoaderRef.current = { productId: id, getCurrentUrl: () => '/img/fallback.webp', handleImageError: () => false, isFallback: () => true };
    } else {
      const loader = createImageLoader(id, rawName);
      loader.productId = id;
      imageLoaderRef.current = loader;
    }
    setImageSrc(imageLoaderRef.current.getCurrentUrl());
  }, [id, rawName]);


  const { price, total } = useMemo(() => {
    const p = parseFloat(sellPricePerUnit.replace(',', '.'));
    const t = quantity * p; 
    return { price: p, total: t };
  }, [quantity, sellPricePerUnit]);

  const name = useMemo(() => CAPITALIZE_FIRST_LETTER(rawName), [rawName]);
  const portion = useMemo(() => (unit === 'Kilogram' ? getPortion(rawName, unit) : null), [rawName, unit]);
  const isWeighted = useMemo(() => unit === 'Kilogram', [unit]);

  const { isAgeRestricted, disableBuy } = useMemo(() => ({
    isAgeRestricted: AGE_RESTRICTED_TYPES.includes(productType) || CONTAINS_LIGHTER_KEYWORD(rawName),
    disableBuy: DISABLE_BUY_TYPES.includes(productType),
  }), [productType, rawName]);
  
  const restsMessage = useMemo(() => {
    const amount = rests;
    if (unit === 'Kilogram') {
      if (amount > 5) return 'Товара много';
      if (amount > 0) return `Осталось ${parseFloat(amount).toFixed(1)} кг`;
      return 'Нет в наличии';
    }
    if (amount > 5) return 'Осталось много';
    if (amount > 0) return `Осталось ${Math.floor(amount)} шт.`;
    return 'Нет в наличии';
  }, [rests, unit]);

  const { decrement, nextStepAvailable } = useMemo(() => {
    const inc = isWeighted && portion ? portion.weightInGrams / 1000 : isWeighted ? 0.1 : 1;
    const max = isWeighted ? rests : Math.floor(rests);
    return {
      decrement: inc,
      nextStepAvailable: quantity + inc <= max,
    };
  }, [isWeighted, portion, rests, quantity]);

  const srcSet = useMemo(() => GENERATE_SRC_SET(imageSrc), [imageSrc]);

  const onImageError = useCallback(() => {
    const loader = imageLoaderRef.current;
    if (loader?.handleImageError) {
      loader.handleImageError();
      const newSrc = loader.getCurrentUrl();
      setImageSrc(newSrc);
    }
  }, []);

  const handleAddToCart = useCallback(() => addToCart(product), [addToCart, product]);
  const handleDecrement = useCallback(() => updateCartQuantity(id, quantity - decrement), [id, quantity, decrement, updateCartQuantity])
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
          srcSet={srcSet}
          sizes="(max-width: 480px) 50vw, (max-width: 768px) 33vw, 25vw"
          loading={isPriority ? undefined : 'lazy'}
          fetchPriority={isPriority ? 'high' : undefined}
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
        <p className="product-card__name">{name}</p>
        {import.meta.env.DEV && <p>{id}</p>}
        <p className="product-card__price">{price} ₽</p>
        {portion && <p className="product-card__portion"><small>Порция: {portion.portionLabelShort}</small></p>}
        <p className="product-card__quantity">{restsMessage}</p>

        {isAgeRestricted && !ageConfirmed ? (
          <button className="product-card__button" onClick={onConfirmAge}>Подтвердить возраст</button>
        ) : productType === 'LightAlcohol' ? (
          <button className="product-card__button" disabled title="Продажа алкоголя осуществляется только в магазине">Только в магазине</button>
        ) : (
          <>
            {quantity > 0 ? (
              <div className="quantity-control">
                <button className="btn-quantity" aria-label="Уменьшить количество товара" onClick={handleDecrement} disabled={quantity === 0}>−</button>
                <div className="quantity-info">
                  <div className="quantity">{isWeighted ? `${quantity.toFixed(3)} кг` : `${Math.round(quantity)} шт.`}</div>
                  <div className="total-price">{total.toLocaleString('ru-RU')} ₽</div>
                </div>
                <button className="btn-quantity" aria-label="Увеличить количество товара" onClick={handleAddToCart} disabled={!nextStepAvailable || disableBuy}>+</button>
                {(!nextStepAvailable && !disableBuy) && (<span className="tooltip-text">Товара нет</span>)}
              </div>
            ) : (
              <button className="product-card__button" disabled={rests === 0 || disableBuy} onClick={handleAddToCart} title={disableBuy ? 'Покупка данного товара запрещена' : ''}>
                {rests > 0 && !disableBuy ? 'Добавить в корзину' : 'Нет в наличии'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
});

export default ProductCard;
