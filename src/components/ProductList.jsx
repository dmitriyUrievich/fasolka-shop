// src/components/ProductList.jsx
import React, { useState, useMemo, useEffect } from 'react';
import ProductCard from './ProductCard';
import Pagination from './Pagination';
import '../ProductList.css';
import getPortion from '../utils/getPortion';
const storageKey = 'ageConfirmedGlobal';
import { createImageLoader } from '../utils/imageUtils';
import YandexMap from './YandexMap'
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css'

const ProductList = ({
  products,
  categories,
  loading,
  searchTerm,
  sortOption,
  selectedCategoryId,
  listHeader,
  showOnlyFallback,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const handleConfirmAge = () => {
    setAgeConfirmed(true);
    localStorage.setItem(storageKey, 'true');
  };
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'true') {
      setAgeConfirmed(true);
    }
  }, []); 

const specialOfferCategoryId = useMemo(() => {
    if (!Array.isArray(categories)) {
      return null;
    }
    const specialCategory = categories.find(cat => cat.name === 'АКЦИЯ МЕСЯЦА');
    return specialCategory ? specialCategory.id : null;
  }, [categories]);

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

  const filteredProducts = useMemo(() => {
    const initialFilter = products.filter((product) => {
      if (!product) return false;

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

    if (showOnlyFallback) {
      return initialFilter.filter((product) => {
        if (!product || !product.id) return false;
        
        const loader = createImageLoader(product.id, product.name);
        
        return loader.isFallback();
      });
    }

    return initialFilter;

  }, [products, selectedCategoryId, searchTerm, blacklistedCategoryIds, showOnlyFallback]);

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      switch (sortOption) {
        case 'price-asc':
          return parseFloat(a.sellPricePerUnit) - parseFloat(b.sellPricePerUnit);
        case 'price-desc':
          return parseFloat(b.sellPricePerUnit) - parseFloat(a.sellPricePerUnit);
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
    return (
      <div className="product-grid">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="product-card-skeleton">
            <Skeleton height={200} style={{ borderRadius: '15px 15px 0 0' }} />
            <div style={{ padding: '12px 14px' }}>
              <Skeleton count={2} />
              <Skeleton height={44} style={{ marginTop: '1rem', borderRadius: '15px' }} />
            </div>
          </div>
        ))}
      </div>
    );
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
          {currentItems.map((product,index) => (
            <ProductCard
              key={product.id}
              product={product}
              ageConfirmed={ageConfirmed}
              isPriority={index < 2}
              onConfirmAge={handleConfirmAge}
              isDiscount={product.groupId === specialOfferCategoryId}
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
        <YandexMap
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