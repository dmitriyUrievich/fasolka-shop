// src/components/YandexMap.js
import React, { useEffect, useRef } from 'react';
import '../YandexMap.css'; // Стили для карты

const YandexMap = ({ center, zoom, placemark, placemarkHint, placemarkBalloon }) => {
  const mapRef = useRef(null); // Ссылка на DOM-элемент карты

  useEffect(() => {
    // Проверяем, что API Яндекс.Карт загружен
    if (window.ymaps) {
      window.ymaps.ready(() => {
        // Инициализация карты
        const myMap = new window.ymaps.Map(mapRef.current, {
          center: center, // Центр карты
          zoom: zoom,     // Уровень масштабирования
          controls: ['zoomControl', 'fullscreenControl'] // Элементы управления картой
        }, {
          searchControlProvider: 'yandex#search' // Поиск
        });

        // Добавление метки на карту, если указаны координаты
        if (placemark && placemark.length === 2) {
          const myPlacemark = new window.ymaps.Placemark(placemark, {
            hintContent: placemarkHint || 'Местоположение магазина', // Подсказка при наведении
            balloonContent: placemarkBalloon || 'Наш фермерский магазин' // Содержимое балуна при клике
          }, {
            // Опции для метки (например, цвет иконки)
            preset: 'islands#greenDotIcon' // Зеленая точка
          });
          myMap.geoObjects.add(myPlacemark);
        }

        // Сохраняем экземпляр карты для возможного дальнейшего использования
        mapRef.current.mapInstance = myMap;
      });
    } else {
      console.error('Яндекс.Карты API не загружен. Убедитесь, что скрипт подключен в public/index.html');
    }

    // Очистка при размонтировании компонента
    return () => {
      if (mapRef.current && mapRef.current.mapInstance) {
        mapRef.current.mapInstance.destroy();
      }
    };
  }, [center, zoom, placemark, placemarkHint, placemarkBalloon]); // Зависимости useEffect

  return (
    <div ref={mapRef} className="yandex-map-container">
      {/* Здесь будет рендериться карта */}
    </div>
  );
};

export default YandexMap;
