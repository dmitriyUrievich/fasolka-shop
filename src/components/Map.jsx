// src/components/YandexMap.js
import React, { useEffect, useRef } from 'react';
import '../YandexMap.css';

const MAP_SCRIPT_ID = 'yandex-maps-script';
const API_KEY = '4abf5f7f-8f77-4fe3-a958-ff7b22c0ff1e';

const Map = ({ center, zoom, placemark, placemarkHint, placemarkBalloon }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const loadYandexMaps = () => {
    return new Promise((resolve, reject) => {
      // 1. Если API уже загружено — резолвим
      if (window.ymaps) {
        resolve(window.ymaps);
        return;
      }

      // 2. Если скрипт уже в DOM — не добавляем второй раз
      const existingScript = document.getElementById(MAP_SCRIPT_ID);
      if (existingScript) {
        console.warn('Yandex Maps script already in DOM, waiting for ready...');
        // Всё равно ждём готовности
        const waitForYmaps = () => {
          if (window.ymaps) {
            window.ymaps.ready(() => resolve(window.ymaps));
          } else {
            setTimeout(waitForYmaps, 50);
          }
        };
        waitForYmaps();
        return;
      }

      // 3. Генерируем уникальный callback
      const callbackName = 'ymapsCallback_' + Date.now();

      window[callbackName] = () => {
        delete window[callbackName];
        window.ymaps.ready(() => resolve(window.ymaps));
      };

      // 4. Создаём скрипт
      const script = document.createElement('script');
      script.id = MAP_SCRIPT_ID;
      script.type = 'text/javascript';
      script.src = `https://api-maps.yandex.ru/2.1/?apikey=${API_KEY}&lang=ru_RU&callback=${callbackName}`;
      script.async = true;

      script.onerror = () => {
        console.error('❌ Ошибка загрузки Яндекс.Карт');
        delete window[callbackName];
        document.body.removeChild(script);
        reject(new Error('Failed to load Yandex Maps'));
      };

      document.body.appendChild(script);
    });
  };

  useEffect(() => {
    let isMounted = true;

    const initializeMap = async () => {
      try {
        await loadYandexMaps();

        if (!isMounted || !mapRef.current) return;

        // Проверяем, не создана ли уже карта
        if (mapInstanceRef.current) return;

        const myMap = new window.ymaps.Map(mapRef.current, {
          center,
          zoom,
          controls: ['zoomControl', 'fullscreenControl'],
        }, {
          searchControlProvider: 'yandex#search',
        });

        mapInstanceRef.current = myMap;

        if (placemark && Array.isArray(placemark) && placemark.length === 2) {
          const myPlacemark = new window.ymaps.Placemark(placemark, {
            hintContent: placemarkHint || 'Местоположение магазина',
            balloonContent: placemarkBalloon || 'Ваш фермерский магазин',
          }, {
            preset: 'islands#greenDotIcon',
          });
          myMap.geoObjects.add(myPlacemark);
        }
      } catch (error) {
        console.error('❌ Не удалось инициализировать карту:', error);
      }
    };

    initializeMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
    };
  }, [center, zoom, placemark, placemarkHint, placemarkBalloon]);

  return (
    <div className="yandex-map-wrapper">
      <div ref={mapRef} className="yandex-map-container"></div>
      {!window.ymaps && (
        <div className="map-placeholder">
          <p>Загружаем карту...</p>
        </div>
      )}
    </div>
  );
};

export default Map;