// src/components/CategorySidebar.jsx
import React, { useState, useEffect } from 'react';
import '../CategorySidebar.css';

const CategorySidebar = ({ categories, products, activeCategoryId, onCategorySelect }) => {
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  // ✅ Защита от undefined
  const categoryList = Array.isArray(categories) ? categories : [];
  const validProducts = Array.isArray(products) ? products : [];

  // 🔍 Фильтруем только товары с остатком > 0
  const productsInStock = validProducts.filter(p => {
    const quantity = p.rests|| 0;
    return quantity > 0;
  });

  // 🔍 Создаём Set с groupId только тех товаров, которые в наличии
  const productGroupIds = new Set(
    productsInStock.filter(p => p.groupId).map(p => p.groupId)
  );
console.log('productsInStock',productsInStock)
  // 🧹 Фильтрация: убираем ненужные категории
  const isBlacklisted = (name) =>
    [
      'ОБОРУДОВАНИЕ',
      'Вода 19л',
      'ПИКНИК',
      'ХОЛОДНЫЙ ЧАЙ',
      'Без группы',
      'Пасха',
    ].some(word => name.includes(word) || word === name);

  const filteredCategories = categoryList
    .filter(group => group.name && !isBlacklisted(group.name))
    .filter(group => productGroupIds.has(group.id)); // только категории с товарами в наличии

  // 🔍 Счётчики: только для товаров с остатком > 0
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

  // 🌲 Построение дерева
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

  // 🎨 Иконки (можно улучшить — см. ниже)
  const getIcon = (name) => {
    const iconMap = {
      'Кондитерские изделия': '🍰',
      'Напитки': '🥤',
      'Молочные продукты': '🥛',
      'Хлеб и хлебобулочные изделия': '🍞',
      'Фрукты': '🍎',
      'Овощи': '🥦',
      'Мясо, рыба, птица': '🥩',
      'Рыба и морепродукты': '🐟',
      'Птица': '🍗',
      'Колбасы': '🌭',
      'Консервы': '🥫',
      'Бакалея': '🥜',
      'Товары для дома': '🏠',
      'Товары для детей': '👶',
      'Алкоголь': '🍷',
      'Вода': '💧',
      'Соки': '🍹',
      'Газировка': '🥤',
      'Замороженные продукты': '❄️',
      'Яйцо': '🥚',
      'Сыры': '🧀',
      'Специи': '🌶️',
      'Чай/кофе': '☕',
      'Корм для животных': '🐾',
    };
    return iconMap[name] || '🏷️';
  };

  // ✅ Автораскрытие при активной подкатегории
  useEffect(() => {
    const activeParentId = activeCategoryId
      ? categoryList.find(cat => cat.id === activeCategoryId)?.parentId
      : null;

    const newExpanded = new Set();
    if (activeParentId) {
      newExpanded.add(activeParentId);
    }
    setExpandedCategories(newExpanded);
  }, [activeCategoryId]);

  // 🔹 Обработчик клика по главной категории
  const handleParentClick = (parentId) => {
    onCategorySelect(parentId);

    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(parentId)) {
      newExpanded.delete(parentId);
    } else {
      newExpanded.add(parentId);
    }
    setExpandedCategories(newExpanded);
  };

  // 🔹 Обработчик клика по подкатегории
  const handleChildClick = (childId) => {
    onCategorySelect(childId);
  };

  // 🔹 Проверка активности
  const isActive = (id) => id === activeCategoryId;

  return (
    <div className="category-sidebar">
      {/* Все товары с счётчиком (только в наличии) */}
      <div
        className={`category-item ${!activeCategoryId ? 'active' : ''}`}
        onClick={() => {
          onCategorySelect(null);
          setExpandedCategories(new Set());
        }}
      >
        <span>
          <span className="icon">🛒</span>
          <span>Все товары</span>
          <span className="count">({totalCount})</span>
        </span>
      </div>

      {/* Главные категории */}
      {topLevel.map(parent => (
        <React.Fragment key={parent.id}>
          {/* Родительская категория */}
          <div
            className={`category-item ${isActive(parent.id) ? 'active' : ''}`}
            onClick={() => handleParentClick(parent.id)}
          >
            <span>
              <span className="icon">{getIcon(parent.name)}</span>
              <span>{parent.name}</span>
              <span className="count">({getProductCount(parent.id)})</span>
            </span>
            <span className={`arrow ${expandedCategories.has(parent.id) ? 'open' : ''}`}>▶</span>
          </div>

          {/* Подкатегории */}
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
                  <span>
                    <span className="icon">{getIcon(child.name)}</span>
                    <span>{child.name}</span>
                    <span className="count">({getProductCount(child.id)})</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default CategorySidebar;