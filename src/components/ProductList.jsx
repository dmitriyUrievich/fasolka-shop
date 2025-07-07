// src/ProductList.js
import React, { useState, useEffect } from 'react';
import ProductCard from './ProductCard';
import Pagination from './Pagination';
import YandexMap from './YandexMap'; // Импорт компонента карты
import { fetchProductsWithRests } from '../services/konturMarketApi';
import '../ProductList.css'; // Импорт стилей для ProductList

const ProductList = ({ searchTerm, sortOption, addToCart }) => { // Принимаем addToCart
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchProductsWithRests();
        setProducts(data);
      } catch (err) {
        setError(err.message || 'Не удалось загрузить товары. Проверьте соединение и настройки API.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, []);

  // Фильтрация товаров: сначала по поисковому запросу, затем по наличию (quantity > 0)
  const filteredProducts = products.filter(product => {
    // Добавляем проверку на существование product перед доступом к его свойствам
    if (!product) {
      console.warn('Обнаружен неопределенный/null продукт в списке, пропускаем.');
      return false; // Пропускаем неопределенные или null продукты
    }
    const matchesSearch = searchTerm
      ? product.name.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
    // Добавляем условие: показывать только товары с количеством > 0
    const isInStock = product.rests > 0; // Используем product.rests для проверки наличия
    return matchesSearch && isInStock;
  });

  // Сортировка товаров (логика сохранена)
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortOption) {
      case 'price-asc':
        return a.sellPricePerUnit - b.sellPricePerUnit; // Используем sellPricePerUnit
      case 'price-desc':
        return b.sellPricePerUnit - a.sellPricePerUnit; // Используем sellPricePerUnit
      case 'quantity-asc':
        return a.rests - b.rests; // Используем rests
      case 'quantity-desc':
        return b.rests - a.rests; // Используем rests
      default:
        return 0;
    }
  });

  // Сброс страницы при изменении фильтров или сортировки (логика сохранена)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortOption]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedProducts.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Сообщения о состоянии загрузки или ошибке
  if (loading) {
    return <div className="status-message loading">Загрузка товаров...</div>;
  }

  if (error) {
    return <div className="status-message error-message">Ошибка: {error}</div>;
  }

  return (
    <>
      <div className="product-list-container">
        {/* Если отфильтрованных и отсортированных товаров нет */}
        {sortedProducts.length === 0 ? (
          <div className="no-products-message">
            Товары по вашему запросу не найдены или отсутствуют в наличии.
          </div>
        ) : (
          <div className="product-grid">
            {currentItems.map(product => (
              // Дополнительная проверка перед рендерингом ProductCard
              product ? (
                <ProductCard key={product.id} product={product} addToCart={addToCart} onClose={() => setIsCartOpen(false)}/>
              ) : (
                console.warn('Пропущен неопределенный/null продукт при рендеринге.')
              )
            ))}
          </div>
        )}
        <div className="pagination-footer">
          <Pagination
            itemsPerPage={itemsPerPage}
            totalItems={sortedProducts.length} // Общее количество для пагинации теперь - отфильтрованные товары
            paginate={paginate}
            currentPage={currentPage}
          />
        </div>
      </div>
      {/* Добавляем компонент Яндекс.Карт после списка товаров */}
      <div className="map-section">
        <h2 className="map-title">Наш Магазин на Карте</h2>
        <YandexMap
          center={[44.7335, 37.7479]} // Координаты Южной Озереевки
          zoom={12}
          placemark={[44.7335, 37.7479]} // Координаты метки (тоже Южная Озереевка)
          placemarkHint="Фасолька - Фермерский Рынок"
          placemarkBalloon="Свежие продукты от местных фермеров!"
        />
      </div>
    </>
  );
};

export default ProductList;
