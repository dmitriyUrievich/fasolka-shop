// src/components/CategorySidebar.jsx
import React, { useState, useEffect } from 'react';
import '../CategorySidebar.css';
import getIcon from '../utils/IconMap'

const CategorySidebar = ({ categories, products, activeCategoryId, onCategorySelect }) => {
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  const categoryList = Array.isArray(categories) ? categories : [];
  const validProducts = Array.isArray(products) ? products : [];

  // Фильтрация товаров в наличии
  const productsInStock = validProducts.filter(p => (p.rests || 0) > 0);
  const productGroupIds = new Set(productsInStock.filter(p => p.groupId).map(p => p.groupId));

  // Фильтрация категорий
  const isBlacklisted = (name) =>
    ['ОБОРУДОВАНИЕ', 'Вода 19л', 'ПИКНИК', 'ХОЛОДНЫЙ ЧАЙ', 'Без группы', 'Пасха','Сигареты']
      .some(word => name.includes(word) || word === name);

  const filteredCategories = categoryList
    .filter(cat => cat.name && !isBlacklisted(cat.name))
    .filter(cat => productGroupIds.has(cat.id));

  // Подсчёт товаров
  const productCountByGroupId = new Map();
  let totalCount = 0;

  productsInStock.forEach(p => {
    if (p.groupId && productGroupIds.has(p.groupId)) {
      const count = productCountByGroupId.get(p.groupId) || 0;
      productCountByGroupId.set(p.groupId, count + 1);
      totalCount++;
    }
  });

  const getProductCount = (id) => productCountByGroupId.get(id) || 0;

  // Построение дерева
  const categoryMap = new Map();
  const rootCategories = [];

  filteredCategories.forEach(cat => {
    categoryMap.set(cat.id, { ...cat, children: [] });
  });

  filteredCategories.forEach(cat => {
    if (cat.parentId && categoryMap.has(cat.parentId)) {
      categoryMap.get(cat.parentId).children.push(categoryMap.get(cat.id));
    } else {
      rootCategories.push(categoryMap.get(cat.id));
    }
  });

  const topLevel = rootCategories.sort((a, b) => a.name.localeCompare(b.name));

  // Авто-раскрытие при активной подкатегории
  useEffect(() => {
    const activeParentId = activeCategoryId
      ? categoryList.find(cat => cat.id === activeCategoryId)?.parentId
      : null;

    if (activeParentId) {
      setExpandedCategories(prev => new Set(prev).add(activeParentId));
    }
  }, [activeCategoryId, categoryList]);

  // Обработчики кликов
  const handleParentClick = (parentId) => {
    onCategorySelect(parentId);
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });

  };

  const handleChildClick = (childId) => {
    onCategorySelect(childId);
  };

  const isActive = (id) => id === activeCategoryId;

  return (
    <div className="category-sidebar">
      <div className="category-item all-categories" onClick={() => {
        onCategorySelect(null);
        setExpandedCategories(new Set());
      }}>
        <div className="category-item-content">
          <span className="icon">🛒</span>
          <span className="category-text">Все товары</span>
        </div>
        <span className="count">({totalCount})</span>
      </div>

      <div className="category-sidebar__scrollable">
        {topLevel.map(parent => (
          <React.Fragment key={parent.id}>
            <div
              className={`category-item ${isActive(parent.id) ? 'active' : ''}`}
              onClick={() => handleParentClick(parent.id)}
            >
              <div className="category-item-content">
                <span className="icon">{getIcon(parent.name)}</span>
                <span className="category-text">{parent.name}</span>
              </div>
              <span className="count">({getProductCount(parent.id)})</span>
            </div>

            {parent.children.length > 0 && expandedCategories.has(parent.id) && (
              <ul className="sub-category-list">
                {parent.children.map(child => (
                  <li
                    key={child.id}
                    className={`sub-category-item ${isActive(child.id) ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleChildClick(child.id);
                    }}
                  >
                    <div className="category-item-content">
                      <span className="icon">{getIcon(child.name)}</span>
                      <span className="category-text">{child.name}</span>
                    </div>
                    <span className="count">({getProductCount(child.id)})</span>
                  </li>
                ))}
              </ul>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default CategorySidebar;