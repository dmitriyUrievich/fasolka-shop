// ProductList.js (с кэшированием и оптимизациями)
import React, { useState, useEffect, useMemo } from 'react';
import ProductCard from './ProductCard';
import Pagination from './Pagination';
import Map from './Map';
import { fetchProductsWithRests } from '../services/konturMarketApi';
import '../ProductList.css';

// 🔹 Настройки кэша
const CACHE_KEY = 'products_cache_v3';
const CACHE_TTL = 10 * 60 * 1000; // 10 минут

const ProductList = ({ searchTerm, sortOption, addToCart, cartItems, updateCartQuantity }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;
  const storageKey = 'ageConfirmedGlobal';
  const [productsWithoutImage, setProductsWithoutImage] = useState(new Set());

  const [ageConfirmed, setAgeConfirmed] = useState(() => localStorage.getItem(storageKey) === 'true');

  const handleConfirmAge = () => {
    setAgeConfirmed(true);
    localStorage.setItem(storageKey, 'true');
  };

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'true') setAgeConfirmed(true);
  }, []);

  useEffect(() => {
    const loadProducts = async () => {
      // 🔹 Попробуем взять из кэша
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL) {
            setProducts(data);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Кэш повреждён');
        }
      }

      // 🔹 Загружаем с сервера
      try {
        setLoading(true);
        setError(null);
        const data = await fetchProductsWithRests();
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
        setProducts(data);
      } catch (err) {
        setError('Не удалось загрузить товары');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

// 🟩 Храним ID товаров, у которых используется fallback (нет фото)
    const handleImageStatus = (productId, hasNoImage) => {
    setProductsWithoutImage(prev => {
      const newSet = new Set(prev);
      if (hasNoImage) {
        newSet.add(productId);
      } else {
        newSet.delete(productId);
      }
      return newSet;
    });
  };

  // 🔹 Фильтрация и сортировка (мемоизированы)
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      if (!product) return false;
      const matchesSearch = searchTerm
        ? product.name.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      return matchesSearch && product.rests > 0;
    });
  }, [products, searchTerm]);

  // 🟨 Получить массив товаров без фото
    const getProductsMissingImage = () => {
    return products.filter(p => productsWithoutImage.has(p.id));
  };




  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      switch (sortOption) {
        case 'price-asc': return a.sellPricePerUnit - b.sellPricePerUnit;
        case 'price-desc': return b.sellPricePerUnit - a.sellPricePerUnit;
        case 'quantity-asc': return a.rests - b.rests;
        case 'quantity-desc': return b.rests - a.rests;
        default: return 0;
      }
    });
  }, [filteredProducts, sortOption]);

  // 🔹 Сброс страницы при поиске/сортировке
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortOption]);

  // 🔹 Пагинация
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
        <div className="product-grid">
          {currentItems.map(product => (
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
          placemarkHint="Фасолька - Фермерский Рынок"
          placemarkBalloon="Свежие продукты от местных фермеров!"
        />
      </div>
    </>
  );
};

export default React.memo(ProductList);