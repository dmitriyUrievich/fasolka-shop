// src/components/YandexMap.js

import React, { useEffect, useRef, useState } from 'react';
import { kml } from '@tmcw/togeojson'; // Убедитесь, что эта библиотека установлена: npm install @tmcw/togeojson

const MAP_SCRIPT_ID = 'yandex-maps-script';
const API_KEY = '4abf5f7f-8f77-4fe3-a958-ff7b22c0ff1e';

// --- Помощник для загрузки API, вынесен наружу для чистоты ---
const loadYandexMaps = () => {
  return new Promise((resolve, reject) => {
    if (window.ymaps) {
      window.ymaps.ready(() => resolve(window.ymaps));
      return;
    }

    const existingScript = document.getElementById(MAP_SCRIPT_ID);
    if (existingScript) {
      const waitForYmaps = () => {
        if (window.ymaps) {
          window.ymaps.ready(() => resolve(window.ymaps));
        } else {
          setTimeout(waitForYmaps, 100);
        }
      };
      waitForYmaps();
      return;
    }

    const script = document.createElement('script');
    script.id = MAP_SCRIPT_ID;
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${API_KEY}&lang=ru_RU`;
    script.async = true;
    script.onload = () => window.ymaps.ready(() => resolve(window.ymaps));
    script.onerror = () => reject(new Error('Failed to load Yandex Maps'));
    document.head.appendChild(script);
  });
};
// +++ НОВЫЙ МОДУЛЬ (ФУНКЦИЯ-ПОМОЩНИК) +++
/**
 * Меняет порядок координат в массиве с [долгота, широта] на [широта, долгота].
 */
const swapCoordinatesInPolygon = (coordinates) => {
  if (!coordinates || !Array.isArray(coordinates)) {
    return [];
  }
  return coordinates.map(ring =>
    ring.map(point => [point[1], point[0]])
  );
};

const YandexMap = ({ address, onZoneCheck, center, zoom, placemark, kmlUrl }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polygonRef = useRef(null); // Ссылка на полигон для проверки
  const addressMarkerRef = useRef(null); // Ссылка на метку адреса
  
  const [mapStatus, setMapStatus] = useState('loading');
  const [checkResult, setCheckResult] = useState(null); // 'in_zone' | 'not_in_zone' | 'not_found'

  // --- Эффект для инициализации карты ---
  useEffect(() => {
    let isMounted = true;

    const initializeMap = async () => {
      try {
        const ymaps = await loadYandexMaps();
        setMapStatus('loaded');

        if (!isMounted || !mapRef.current || mapInstanceRef.current) return;

        const myMap = new ymaps.Map(mapRef.current, {
          center,
          zoom,
          controls: ['zoomControl', 'fullscreenControl'],
        });
        mapInstanceRef.current = myMap;

        // Добавление метки магазина
        if (placemark) {
          myMap.geoObjects.add(new ymaps.Placemark(placemark, 
            { hintContent: 'Наш магазин "Фасоль"', balloonContent: 'пер. Торпедный, д 1' },
            { preset: 'islands#greenDotIcon' }
          ));
        }

        // Загрузка и отрисовка KML
        if (kmlUrl) {
          const response = await fetch(kmlUrl);
          const kmlText = await response.text();
          const dom = new DOMParser().parseFromString(kmlText, 'text/xml');
          const geoJson = kml(dom);

          // Находим первый полигон в GeoJSON
          const polygonFeature = geoJson.features.find(f => f.geometry.type === 'Polygon');
          if (polygonFeature) {
            
            // +++ ИСПОЛЬЗОВАНИЕ НОВОГО МОДУЛЯ +++
            // Меняем порядок координат перед передачей в API Яндекса
            const correctCoordinates = swapCoordinatesInPolygon(polygonFeature.geometry.coordinates);

            const deliveryPolygon = new ymaps.GeoObject({
                geometry: {
                    type: "Polygon",
                    // Используем исправленные координаты
                    coordinates: correctCoordinates, 
                },
            }, {
                fillColor: '#42A5f5',
                fillOpacity: 0.3,
                strokeColor: '#3f51b5',
                strokeWidth: 2,
            });

            polygonRef.current = deliveryPolygon; // Сохраняем полигон
            myMap.geoObjects.add(deliveryPolygon);
            myMap.setBounds(deliveryPolygon.geometry.getBounds());
          }
        }
      } catch (error) {
        console.error('❌ Не удалось инициализировать карту:', error);
        setMapStatus('error');
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
  }, [center, zoom, placemark, kmlUrl]);

  // --- Эффект для проверки адреса ---
  useEffect(() => {
    // Используем таймер, чтобы не отправлять запросы на каждую букву
    const handler = setTimeout(async () => {
      if (address && address.length > 5 && window.ymaps && polygonRef.current) {
        try {
          const ymaps = await loadYandexMaps();
          const res = await ymaps.geocode(address);
          const firstGeoObject = res.geoObjects.get(0);

          // Удаляем старую метку адреса, если она есть
          if (addressMarkerRef.current) {
            mapInstanceRef.current.geoObjects.remove(addressMarkerRef.current);
          }

          if (firstGeoObject) {
            const coords = firstGeoObject.geometry.getCoordinates();
            const isInside = polygonRef.current.geometry.contains(coords);

            // Добавляем новую метку адреса
            addressMarkerRef.current = new ymaps.Placemark(coords, 
                { iconCaption: firstGeoObject.getAddressLine() }, 
                { preset: 'islands#redDotIconWithCaption' }
            );
            mapInstanceRef.current.geoObjects.add(addressMarkerRef.current);

            if (isInside) {
              setCheckResult('in_zone');
              onZoneCheck(true);
            } else {
              setCheckResult('not_in_zone');
              onZoneCheck(false);
            }
          } else {
            setCheckResult('not_found');
            onZoneCheck(false);
          }
        } catch (e) {
            console.error("Ошибка геокодирования", e);
            onZoneCheck(false);
        }
      }
    }, 800); // Задержка в 800ms

    return () => {
      clearTimeout(handler);
    };
  }, [address, onZoneCheck]);

  return (
    <div className="yandex-map-wrapper">
      <div ref={mapRef} className="yandex-map-container"></div>
      {mapStatus === 'loading' && (
        <div className="map-placeholder"><p>Загружаем карту...</p></div>
      )}
      {mapStatus === 'error' && (
        <div className="map-placeholder"><p>Не удалось загрузить карту.</p></div>
      )}
      <div className="map-check-result">
          {checkResult === 'in_zone' && <p className="success">✅ Адрес находится в зоне доставки.</p>}
          {checkResult === 'not_in_zone' && <p className="error">❌ Увы, этот адрес вне зоны нашей доставки.</p>}
          {checkResult === 'not_found' && <p className="warning">⚠️ Не удалось найти адрес. Попробуйте уточнить.</p>}
      </div>
    </div>
  );
};

export default YandexMap;