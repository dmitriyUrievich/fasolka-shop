import { useState, useEffect } from 'react';
import { getChequesForMonth } from '../services/konturMarketApi.js';
import { calculatePopularityMap } from '../utils/popularityUtils';

const CACHE_KEY_PREFIX = 'market_popularity_';
const UPDATE_HOUR = 22; // Время обновления — 22:00

/**
 * Функция для получения метки времени последнего прошедшего 22:00
 */
const getLastUpdateBoundary = () => {
    const now = new Date();
    const boundary = new Date(now);

    boundary.setHours(UPDATE_HOUR, 0, 0, 0);

    // Если сейчас еще не наступило 22:00, значит актуальная граница обновления была вчера
    if (now < boundary) {
        boundary.setDate(boundary.getDate() - 1);
    }

    return boundary.getTime();
};

export const usePopularity = (shopId) => {
    const [popularityMap, setPopularityMap] = useState({});
    const [isPopularityLoading, setIsPopularityLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            if (!shopId) return;

            const cacheKey = `${CACHE_KEY_PREFIX}${shopId}`;
            const cached = localStorage.getItem(cacheKey);
            const lastUpdateBoundary = getLastUpdateBoundary();

            if (cached) {
                try {
                    const { map, timestamp } = JSON.parse(cached);

                    // Данные считаются свежими, если они были сохранены ПОСЛЕ последнего 22:00
                    const isFresh = timestamp > lastUpdateBoundary;

                    if (isFresh) {
                        console.log(`[Popularity] Используем кэш. Следующее обновление сегодня в ${UPDATE_HOUR}:00`);
                        setPopularityMap(map);
                        setIsPopularityLoading(false);
                        return;
                    }
                    console.log(`[Popularity] Кэш устарел (был создан до 22:00). Обновляем...`);
                } catch (e) {
                    console.error("Ошибка парсинга кэша", e);
                }
            }

            // Если кэша нет или он создан до контрольной точки 22:00
            setIsPopularityLoading(true);
            try {
                const cheques = await getChequesForMonth(shopId);
                const map = calculatePopularityMap(cheques);

                localStorage.setItem(cacheKey, JSON.stringify({
                    map,
                    timestamp: Date.now() // Сохраняем момент создания
                }));

                setPopularityMap(map);
            } catch (err) {
                console.error("Ошибка при обновлении популярности:", err);
            } finally {
                setIsPopularityLoading(false);
            }
        };

        loadData();
    }, [shopId]);

    return { popularityMap, isPopularityLoading };
};