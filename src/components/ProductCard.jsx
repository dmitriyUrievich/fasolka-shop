import React, { useMemo, useCallback } from 'react';
import getPortion from '../utils/getPortion';
import { useCartStore } from '../store';
import { useProductImage } from '../hooks/useProductImage';
import { QuantityControl } from './QuantityControl.jsx';
import * as Utils from '../utils/ProductCardUtils';
import '../ProductCard.css';


const ProductCard = React.memo(({ product, ageConfirmed, onConfirmAge, isDiscount, isPriority }) => {
  const { id, name: rawName, sellPricePerUnit, rests, productType, unit } = product || {};

  const addToCart = useCartStore(state => state.addToCart);
  const updateCartQuantity = useCartStore(state => state.updateCartQuantity);
  const quantity = useCartStore(state => state.items.find(item => item.id === id)?.quantityInCart || 0);


  const { imageSrc, isFallbackState, onImageError } = useProductImage(id, rawName);
  const isTechCard = product.productType === 'TechCard';
  const name = useMemo(() => Utils.capitalize(rawName), [rawName]);
  const isWeighted = unit === 'Kilogram';
  const portion = useMemo(() => (isWeighted ? getPortion(rawName, unit) : null), [rawName, unit, isWeighted]);

  const { price, total } = useMemo(() => {
    const p = parseFloat(sellPricePerUnit.replace(',', '.'));
    return { price: p, total: quantity * p };
  }, [quantity, sellPricePerUnit]);

  const { isAgeRestricted, disableBuy } = useMemo(() => ({
    isAgeRestricted: Utils.AGE_RESTRICTED_TYPES.includes(productType) || Utils.isLighter(rawName),
    disableBuy: Utils.DISABLE_BUY_TYPES.includes(productType),
  }), [productType, rawName]);

  const { decrement, nextStepAvailable } = useMemo(() => {
    const inc = isWeighted && portion ? portion.weightInGrams / 1000 : isWeighted ? 0.1 : 1;
    // Если это техкарта, то следующий шаг всегда доступен, иначе проверяем по остаткам
    const isAvailableByRest = isTechCard ? true : quantity + inc <= (isWeighted ? rests : Math.floor(rests));

    return { decrement: inc, nextStepAvailable: isAvailableByRest };
  }, [isWeighted, portion, rests, quantity, isTechCard]);

  const srcSet = useMemo(() => Utils.generateSrcSet(imageSrc, isFallbackState), [imageSrc, isFallbackState]);

  const handleAddToCart = useCallback(() => addToCart(product), [addToCart, product]);
  const handleDecrement = useCallback(() => updateCartQuantity(id, quantity - decrement), [id, quantity, decrement, updateCartQuantity]);

  return (
      <div className="product-card">
        <div className="product-card__image-wrapper">
          {/* Плашка Акция (слева) */}
          {isDiscount && (
              <div className="product-card__badge product-card__badge--discount">
                <span>Акция</span>
              </div>
          )}

          {/* Плашка Под заказ (справа) */}
          {(product.productType === 'TechCard' || product.rests >= 999) && (
              <div className="product-card__badge product-card__badge--fresh">
                <span>Под заказ</span>
              </div>
          )}

          <img
              src={imageSrc}
              srcSet={srcSet}
              sizes="(max-width: 480px) 50vw, 25vw"
              loading={isPriority ? undefined : 'lazy'}
              alt={name}
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
          <p className="product-card__price">{price} ₽</p>
          <p className="product-card__quantity">{/* Логика restsMessage */}</p>

          {isAgeRestricted && !ageConfirmed ? (
              <button className="product-card__button" onClick={onConfirmAge}>Подтвердить возраст</button>
          ) : disableBuy || productType === 'LightAlcohol' ? (
              <button className="product-card__button" disabled>Только в магазине</button>
          ) : (
              <>
                {quantity > 0 ? (
                    <QuantityControl
                        quantity={quantity} total={total} isWeighted={isWeighted}
                        onDecrement={handleDecrement} onIncrement={handleAddToCart}
                        nextAvailable={nextStepAvailable} disableBuy={disableBuy}
                    />
                ) : (
                    <button
                        className="product-card__button"
                        // Кнопка активна, если это техкарта ИЛИ остаток > 0
                        disabled={(!isTechCard && rests <= 0) || disableBuy}
                        onClick={handleAddToCart}
                    >
                      {(isTechCard || rests > 0) && !disableBuy ? 'Добавить в корзину' : 'Нет в наличии'}
                    </button>
                )}
              </>
          )}
        </div>
      </div>
  );
});

export default ProductCard