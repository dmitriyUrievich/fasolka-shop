// src/components/ProductList.jsx
import React, { useState, useMemo, useEffect } from 'react';
import ProductCard from './ProductCard';
import Pagination from './Pagination';
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
  selectedCategoryIds,
  listHeader,
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

        // 1. Находим ID категории выпечки один раз для всего фильтра
        const bakeryCategory = categories.find(cat =>
            (cat.name || cat.Name || "").toUpperCase().trim() === 'ВЫПЕЧКА'
        );
        const bakeryId = bakeryCategory?.id || bakeryCategory?.Id;

        return products.filter((product) => {
            if (!product) return false;

            const pGroupId = product.groupId || product.GroupId;
            const pName = product.name || product.Name || "";
            const pType = product.productType || product.ProductType;

            // Исключаем технические товары (пакеты)
            if (pName.toUpperCase().includes("ПАКЕТ-МАЙКА FASOL")) return false;

            // Поиск по названию
            if (searchTerm && !pName.toLowerCase().includes(searchTerm.toLowerCase())) return false;

            // Фильтр по выбранным категориям
            const matchesCategory = selectedCategoryIds.length > 0
                ? selectedCategoryIds.includes(pGroupId)
                : true;
            if (!matchesCategory) return false;

            // Если это составное блюдо (TechCard) ИЛИ товар из категории ВЫПЕЧКА,
            // мы считаем его всегда доступным (готовится под заказ)
            if (pType === 'TechCard' || (bakeryId && pGroupId === bakeryId)) {
                return true;
            }

            // Для всех остальных товаров проверяем реальный остаток
            const r = parseFloat(product.rests || 0);
            const isAvailable = product.unit !== 'Kilogram' ? r > 0 : r >= 0.1;

            return isAvailable;
        });
        // Добавляем categories в зависимости, чтобы фильтр обновился при загрузке каталога
    }, [products, selectedCategoryIds, searchTerm, categories]);

    const sortedProducts = useMemo(() => {
        const list = [...filteredProducts];

        // 1. Находим ID категории выпечки (кейс-независимо)
        const bakeryCategory = categories.find(cat =>
            (cat.name || cat.Name || "").toUpperCase().trim() === 'ВЫПЕЧКА'
        );
        const bakeryId = bakeryCategory?.id || bakeryCategory?.Id;

        return list.sort((a, b) => {
            // --- ПРАВИЛО 0: Ручная сортировка (если пользователь сам выбрал цену) ---
            if (sortOption === 'price-asc') return parseFloat(a.sellPricePerUnit) - parseFloat(b.sellPricePerUnit);
            if (sortOption === 'price-desc') return parseFloat(b.sellPricePerUnit) - parseFloat(a.sellPricePerUnit);

            // --- ПРАВИЛО 1: Приоритет категории "Выпечка" ---
            // Это условие работает только если НЕ выбрана конкретная категория (на главной)
            if (selectedCategoryIds.length === 0 && bakeryId) {
                const isBakeryA = (a.groupId || a.GroupId) === bakeryId;
                const isBakeryB = (b.groupId || b.GroupId) === bakeryId;

                if (isBakeryA && !isBakeryB) return -1; // Товар A (выпечка) выше
                if (!isBakeryA && isBakeryB) return 1;  // Товар B (выпечка) выше
            }

            // --- ПРАВИЛО 2: Популярность (Default) ---
            const scoreA = Number(a.popularityScore || 0);
            const scoreB = Number(b.popularityScore || 0);

            if (scoreB !== scoreA) {
                return scoreB - scoreA; // У кого больше продаж, тот выше
            }

            // --- ПРАВИЛО 3: Наличие ---
            const hasRestA = (a.rests || 0) > 0 ? 1 : 0;
            const hasRestB = (b.rests || 0) > 0 ? 1 : 0;
            if (hasRestB !== hasRestA) return hasRestB - hasRestA;

            // --- ПРАВИЛО 4: По алфавиту ---
            return (a.name || "").localeCompare(b.name || "");
        });
    }, [filteredProducts, sortOption, categories, selectedCategoryIds]);

  useEffect(() => setCurrentPage(1), [searchTerm, sortOption, selectedCategoryIds]);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

    const currentItems = useMemo(() => {
        const lastIdx = currentPage * itemsPerPage;
        return sortedProducts.slice(lastIdx - itemsPerPage, lastIdx);
    }, [sortedProducts, currentPage, itemsPerPage]);


    useEffect(() => {
        if (currentItems.length > 0 && !loading) {
            console.group(`📄 Анализ страницы №${currentPage}`);
            console.log(`Показано товаров: ${currentItems.length} (из ${sortedProducts.length})`);

            const tableData = currentItems.map((product, index) => {
                // Вычисляем реальное место товара в общем списке
                const globalRank = (currentPage - 1) * itemsPerPage + index + 1;

                return {
                    "Место": globalRank,
                    "Название": product.name || product.Name,
                    "Популярность (Score)": product.popularityScore || 0,
                    "Остаток": product.rests,
                    "ID": product.id
                };
            });

            console.table(tableData);

            // Дополнительная проверка на ошибки сортировки
            const scores = currentItems.map(p => p.popularityScore || 0);
            const isSorted = scores.every((val, i) => i === 0 || val <= scores[i - 1]);

            if (!isSorted) {
                console.warn("⚠️ Внимание: Порядок популярности на этой странице нарушен!");
            } else {
                console.log("✅ Сортировка по популярности верна (идет на убывание).");
            }

            console.groupEnd();
        }
    }, [currentPage, currentItems, loading, sortedProducts.length, itemsPerPage]);

    const bakeryCategories = categories.filter(cat =>
        (cat.name || cat.Name || "").toUpperCase().trim() === 'ВЫПЕЧКА'
    );
    console.log('Найденные категории ВЫПЕЧКА:', bakeryCategories);


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