
import React from 'react';
import '../ProductCard.css'; // Импорт стилей для ProductCard

const ProductCard = ({ product,addToCart }) => {

  const capitalizeFirstLetter = (string) => {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
  };
 
  const name = capitalizeFirstLetter(product?.name);
  const price = product?.sellPricePerUnit;
  const rests = product?.rests;
   console.log('product',name,price,rests)

  // Заглушка для изображения
  const imageUrl = `https://placehold.co/300x200/9BE16C/3B82F6?text=${encodeURIComponent(name.split(' ')[0])}`;

  return (
    <div className="product-card">
      <img src={imageUrl} alt={name} className="product-card__image" />
      <div className="product-card__content">
        <h3 className="product-card__name">{name}</h3>
        <p className="product-card__price">
          {price ? `${price.toLocaleString('ru-RU')} ₽` : 'Цена не указана'}
        </p>
        <p className="product-card__quantity"> {rests>5 ? 'Товара много' : 'Осталось ' + rests + 'шт'}.</p>
        <button
          className="product-card__button"
          disabled={rests === 0}
           onClick={() => addToCart(product)}
        >
          {rests > 0 ? 'Добавить в корзину' : 'Нет в наличии'}
        </button>
      </div>
    </div>
  );
};

export default ProductCard;