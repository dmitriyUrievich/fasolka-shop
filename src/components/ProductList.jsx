// src/components/ProductList.jsx
import React, { useState, useMemo,useEffect } from 'react';
import ProductCard from './ProductCard';
import Pagination from './Pagination';
import Map from './Map';
import '../ProductList.css';

const storageKey = 'ageConfirmedGlobal';

const ProductList = ({
  products,
  loading,
  searchTerm,
  sortOption,
  cartItems,
  updateCartQuantity,
  addToCart,
  selectedCategoryId,
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

  // 🔹 Фильтрация
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (!product) return false;
      const matchesCategory = selectedCategoryId
        ? product.groupId === selectedCategoryId
        : true;
      const matchesSearch = searchTerm
        ? product.name.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      return matchesCategory && matchesSearch && product.rests > 0;
    });
  }, [products, selectedCategoryId, searchTerm]);

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
  console.log('length',products)
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
      <p>length {products.length }</p> 
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

      {/* <div className="map-section">
        <h2 className="map-title">Наш Магазин на Карте</h2>
        <Map
          center={[44.675898, 37.642492]}
          zoom={12}
          placemark={[44.675898, 37.642492]}
          placemarkHint="Фасолька - Фермерский Рынок"
          placemarkBalloon="Свежие продукты от местных фермеров!"
        />
      </div> */}
    </>
  );
};

export default React.memo(ProductList);