// src/components/CategorySidebar.jsx
import React from 'react';
import '../CategorySidebar.css';

const CategorySidebar = ({ categories, products, activeCategoryId, onCategorySelect }) => {
  // ✅ Защита от undefined
  const categoryList = Array.isArray(categories) ? categories : [];
  const validProducts = Array.isArray(products) ? products : [];

  // 🔍 Создаём Set с groupId всех товаров
  const productGroupIds = new Set(
        validProducts.filter(p => p.groupId).map(p => p.groupId)
  );

  // ✅ Фильтруем: оставляем только категории, в которых есть товары
  const filteredCategories = categoryList.filter(group =>
    productGroupIds.has(group.id)
  );

  return (
    <div className="category-sidebar">
      <h3 className="category-sidebar__title">Категории</h3>
      <ul className="category-sidebar__list">
        <li
          className={`category-sidebar__item ${!activeCategoryId ? 'active' : ''}`}
          onClick={() => onCategorySelect(null)}
        >
          Все товары
        </li>
        {filteredCategories.length === 0 ? (
          <li className="category-sidebar__item disabled">Нет доступных категорий</li>
        ) : (
          filteredCategories.map((group) => (
            <li
              key={group.id}
              className={`category-sidebar__item ${activeCategoryId === group.id ? 'active' : ''}`}
              onClick={() => onCategorySelect(group.id)}
            >
              {group.name}
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default CategorySidebar;