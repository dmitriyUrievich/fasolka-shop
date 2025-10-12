// src/components/ProductList.jsx
import React, { useState, useMemo, useEffect } from 'react';
import ProductCard from './ProductCard';
import Pagination from './Pagination';
import Map from './Map';
import '../ProductList.css';
import getPortion from '../utils/getPortion';
const storageKey = 'ageConfirmedGlobal';
import { createImageLoader } from '../utils/imageUtils';

const ProductList = ({
  products,
  categories,
  loading,
  searchTerm,
  sortOption,
  cartItems,
  updateCartQuantity,
  addToCart,
  selectedCategoryId,
  listHeader,
  showOnlyFallback,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;

  const [ageConfirmed, setAgeConfirmed] = useState(() => localStorage.getItem(storageKey) === 'true');

  const handleConfirmAge = () => {
    setAgeConfirmed(true);
    localStorage.setItem(storageKey, 'true');
  };

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'true') setAgeConfirmed(true);
  }, []);

 const blacklistedCategoryIds = useMemo(() => {
    const blacklistNames = ['ОБОРУДОВАНИЕ', 'Без группы',];
    const ids = new Set();
    if (Array.isArray(categories)) {
      categories.forEach(cat => {
        if (blacklistNames.some(name => cat.name && (cat.name.includes(name) || cat.name === name))) {
          ids.add(cat.id);
        }
      });
    }
    return ids;
  }, [categories]);

  // 🔹 Фильтрация: учитываем unit и минимальный остаток
  const filteredProducts = useMemo(() => {
    // Шаг 1: Основная фильтрация
    const initialFilter = products.filter((product) => {
      if (!product) return false;
      
      // Отфильтровываем товары из "черного списка" категорий
      if (product.groupId && blacklistedCategoryIds.has(product.groupId)) {
        return false;
      }
      
      if (product.productType === 'Tobacco') return false;

      const matchesCategory = selectedCategoryId
        ? product.groupId === selectedCategoryId
        : true;

      const matchesSearch = searchTerm
        ? product.name.toLowerCase().includes(searchTerm.toLowerCase())
        : true;

      const isAvailable = (() => {
        if (product.unit !== 'Kilogram') {
          return product.rests > 0;
        }
        const portion = getPortion(product.name, product.unit);
        if (portion) {
          const minRest = portion.weightInGrams / 1000;
          return product.rests >= minRest;
        }
        return product.rests >= 0.1;
      })();

      return matchesCategory && matchesSearch && isAvailable;
    });

    // Шаг 2: Дополнительная фильтрация по дефолтным фото (если включен режим)
    if (showOnlyFallback) {
      return initialFilter.filter((product) => {
        if (!product || !product.id) return false;
        
        // Создаем загрузчик для проверки, дефолтное ли фото
        const loader = createImageLoader(product.id, product.name);
        
        // Используем метод isFallback() из вашей утилиты
        return loader.isFallback();
      });
    }

    // Если режим не включен, возвращаем результат основной фильтрации
    return initialFilter;

  }, [products, selectedCategoryId, searchTerm, blacklistedCategoryIds, showOnlyFallback]);

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      switch (sortOption) {
        case 'price-asc':
          return a.sellPricePerUnit - b.sellPricePerUnit;
        case 'price-desc':
          return b.sellPricePerUnit - a.sellPricePerUnit;
        case 'quantity-asc':
          return a.rests - b.rests;
        case 'quantity-desc':
          return b.rests - a.rests;
        default:
          return 0;
      }
    });
  }, [filteredProducts, sortOption]);

  useEffect(() => setCurrentPage(1), [searchTerm, sortOption, selectedCategoryId]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedProducts.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (loading) {
    return <div className="status-message loading">Загрузка товаров...</div>;
  }

  if (sortedProducts.length === 0) {
    return (
      <div className="no-products-message">
        <p>Ничего не найдено.</p>
        <p>Попробуйте изменить запрос.</p>
      </div>
    );
  }

  return (
    <>
      <div className="product-list-container">
        {listHeader && <>{listHeader}</>}
        <div className="product-grid">
          {currentItems.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              addToCart={addToCart}
              ageConfirmed={ageConfirmed}
              onConfirmAge={handleConfirmAge}
              cartItems={cartItems}
              updateCartQuantity={updateCartQuantity}
            />
          ))}
        </div>

        <div className="pagination-footer">
          <Pagination
            itemsPerPage={itemsPerPage}
            totalItems={sortedProducts.length}
            paginate={paginate}
            currentPage={currentPage}
          />
        </div>
      </div>
     <div className="map-section">
        <h2 className="map-title">Наш Магазин на Карте</h2>
        <Map
          center={[44.675898, 37.642492]}
          zoom={12}
          placemark={[44.675898, 37.642492]}
          placemarkHint="Фасоль"
          placemarkBalloon="Мы находимся по адресу: пер. Торпедный д4."
        />
      </div>
    </>
  );
};

export default React.memo(ProductList);