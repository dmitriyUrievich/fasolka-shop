// src/components/ProductList.jsx
import React, { useState, useMemo, useEffect } from 'react';
import ProductCard from './ProductCard';
import Pagination from './Pagination';

import getPortion from '../utils/getPortion';
import { createImageLoader } from '../utils/imageUtils';

import Skeleton from 'react-loading-skeleton';
const storageKey = 'ageConfirmedGlobal';

import 'react-loading-skeleton/dist/skeleton.css'
import '../ProductList.css';

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
        const blacklistNames = ['ОБОРУДОВАНИЕ', 'Без группы'];
        const ids = new Set();
        if (Array.isArray(categories)) {
            categories.forEach(cat => {
                const name = cat.name || cat.Name;
                const id = cat.id || cat.Id;
                if (name && blacklistNames.some(bn => name.includes(blacklistNames))) {
                    ids.add(id);
                }
            });
        }
        return ids;
    }, [categories]);
    const filteredProducts = useMemo(() => {
        if (!products || !Array.isArray(products)) return [];

        return products.filter((product) => {
            if (!product) return false;

            // 1. УНИФИКАЦИЯ ПОЛЕЙ (берем или маленькую, или большую букву)
            const pName = product.name || product.Name || "";
            const pGroupId = product.groupId || product.GroupId;
            const pType = product.productType || product.ProductType;
            const pUnit = product.unit || product.Unit;

            // ВАЖНО: Пробуем все варианты названия остатка
            const rawRests = product.rests !== undefined ? product.rests : (product.Rests !== undefined ? product.Rests : product.Rest);
            const pRests = parseFloat(rawRests || 0);

            // 2. ФИЛЬТР: Черный список категорий
            if (pGroupId && blacklistedCategoryIds.has(pGroupId)) return false;

            // 3. ФИЛЬТР: Табак
            if (pType === 'Tobacco') return false;

            // 4. ФИЛЬТР: Поиск
            if (searchTerm && !pName.toLowerCase().includes(searchTerm.toLowerCase())) return false;

            // 5. ФИЛЬТР: Категория
            if (selectedCategoryId && pGroupId !== selectedCategoryId) return false;

            // 6. ФИЛЬТР: Остатки (isAvailable)
            // ВРЕМЕННО: Если товары не появились, замените всё внутри на "return true"
            const isAvailable = (() => {
                if (pUnit !== 'Kilogram') return pRests > 0;
                const portion = getPortion(pName, pUnit);
                const minRest = portion ? portion.weightInGrams / 1000 : 0.1;
                return pRests >= minRest;
            })();

            return isAvailable;
        });
    }, [products, selectedCategoryId, searchTerm, blacklistedCategoryIds]);

    //console.log('--------filteredProducts', filteredProducts);

    const sortedProducts = useMemo(() => {
        const list = [...filteredProducts];

        const result = list.sort((a, b) => {
            if (sortOption === 'price-asc') return parseFloat(a.sellPricePerUnit) - parseFloat(b.sellPricePerUnit);
            if (sortOption === 'price-desc') return parseFloat(b.sellPricePerUnit) - parseFloat(a.sellPricePerUnit);
            if (sortOption === 'quantity-asc') return a.rests - b.rests;
            if (sortOption === 'quantity-desc') return b.rests - a.rests;

            const scoreA = a.popularityScore || 0;
            const scoreB = b.popularityScore || 0;
            if (scoreB !== scoreA) return scoreB - scoreA;

            return (a.name || "").localeCompare(b.name || "");
        });

        // --- БЛОК АНАЛИЗА ДАННЫХ В КОНСОЛИ ---
        if (result.length > 0) {
            console.group('📊 Проверка популярности товаров');
            console.log('Всего товаров после фильтров:', result.length);

            // Берем топ-20 для проверки
            const debugTable = result.slice(0, 20).map((p, index) => ({
                "№": index + 1,
                "Название": p.name || p.Name,
                "Продано (Score)": p.popularityScore || 0,
                "Остаток": p.rests,
                "Цена": p.sellPricePerUnit,
                "ID": p.id
            }));

            console.table(debugTable);

            // Лог товаров с продажами, которые могли не попасть в топ
            const withSales = result.filter(p => (p.popularityScore || 0) > 0).length;
            console.log(`Товаров с продажами > 0 на текущей странице/фильтре: ${withSales}`);
            console.groupEnd();
        }
        // -------------------------------------

        return result;
    }, [filteredProducts, sortOption]);

    console.log('--------sortedProducts', sortedProducts);
  useEffect(() => setCurrentPage(1), [searchTerm, sortOption, selectedCategoryId]);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

    const currentItems = useMemo(() => {
        const lastIdx = currentPage * itemsPerPage;
        return sortedProducts.slice(lastIdx - itemsPerPage, lastIdx);
    }, [sortedProducts, currentPage, itemsPerPage]);

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

    </>
  );
};

export default React.memo(ProductList);