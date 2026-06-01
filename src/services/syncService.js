import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const PRODUCTS_DB_PATH = path.join(process.cwd(), 'src', 'products.json');
const KONTUR_API_BASE_URL = 'https://api.kontur.ru/market/v1';

const getApiHeaders = () => ({
    'x-kontur-apikey': process.env.KONTUR_API_KEY,
    'Content-Type': 'application/json',
});

const getVal = (obj, key) => {
    if (!obj) return undefined;
    const realKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
    return realKey ? obj[realKey] : undefined;
};

const calculateAnalytics = (cheques, rawProducts) => {
    const popularityMap = {};
    let totalRevenue = 0;
    let totalItemsSold = 0;

    if (!cheques || cheques.length === 0) {
        console.warn('[Analytics] Массив чеков ПУСТОЙ.');
        return { popularityMap, stats: { totalRevenue: 0, totalCheques: 0 } };
    }

    // --- ВОТ ЭТОТ ВЫВОД НАМ НУЖЕН ---
    //console.log('==========================================');
    //console.log('[DEBUG] ПОЛНАЯ СТРУКТУРА ПЕРВОГО ЧЕКА:');
    //console.log(JSON.stringify(cheques[0], null, 2));
    //console.log('==========================================');

    // Карта для сопоставления
    const productById = new Map();
    const productByCode = new Map();

    rawProducts.forEach(p => {
        const id = String(getVal(p, 'id') || '').toLowerCase();
        const code = String(getVal(p, 'code') || '');
        if (id) productById.set(id, id);
        if (code) productByCode.set(code, id);
    });

    cheques.forEach(cheque => {
        const isRefund = String(getVal(cheque, 'isRefund')).toLowerCase() === 'true';
        const coeff = isRefund ? -1 : 1;

        const price = parseFloat(getVal(cheque, 'totalPrice') || 0);
        totalRevenue += (price * coeff);

        const lines = getVal(cheque, 'lines') || [];
        lines.forEach(line => {
            const lId = String(getVal(line, 'productId') || '').toLowerCase();
            const lCode = String(getVal(line, 'productCode') || '');

            const finalId = productById.get(lId) || productByCode.get(lCode);

            if (finalId) {
                const count = parseFloat(getVal(line, 'count') || 0);
                popularityMap[finalId] = (popularityMap[finalId] || 0) + (count * coeff);
                if (!isRefund) totalItemsSold += count;
            }
        });
    });

    return {
        popularityMap,
        stats: {
            totalRevenue: Math.round(totalRevenue),
            totalCheques: cheques.length,
            totalItemsSold: Math.round(totalItemsSold)
        }
    };
};

/**
 * УНИВЕРСАЛЬНЫЙ ЗАГРУЗЧИК С ПАГИНАЦИЕЙ
 */
const fetchAllPagesBackend = async (url, name, params = {}) => {
    let allItems = [];
    let offset = 0;
    const limit = 1000;
    const seenIds = new Set();

    try {
        while (true) {
            const queryParams = new URLSearchParams({ ...params, limit, offset }).toString();
            const fullUrl = `${url}?${queryParams}`;
            console.log(`[Fetch] ${name} request: ${fullUrl}`);

            const response = await fetch(fullUrl, { headers: getApiHeaders(), timeout: 30000 });

            // Детальное логирование ответа
            console.log(`[Fetch] ${name} status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[Fetch] ${name} error body: ${errorText}`);
                break;
            }

            const data = await response.json();
            console.log(`[Fetch] ${name} response keys:`, Object.keys(data));

            // Для остатков специально проверяем наличие Items
            const items = data.Items || data.items || data.results || [];
            console.log(`[Fetch] ${name} items count in response: ${items.length}`);

            if (!Array.isArray(items) || items.length === 0) {
                console.log(`[Fetch] ${name} нет элементов, завершаем пагинацию`);
                break;
            }

            // Дедубликация по ID (для остатков используем ProductId)
            const newItems = items.filter(item => {
                const id = item.ProductId || item.productId || item.Id || item.id;
                if (!id) {
                    console.warn(`[Fetch] ${name} элемент без ID:`, item);
                    return false;
                }
                const idStr = String(id);
                if (seenIds.has(idStr)) return false;
                seenIds.add(idStr);
                return true;
            });

            if (newItems.length === 0) {
                console.log(`[Fetch] ${name} все элементы уже были загружены (дубликаты), завершаем`);
                break;
            }

            allItems.push(...newItems);
            console.log(`   [Fetch] ${name}: +${newItems.length} (Всего: ${allItems.length})`);

            // Условие выхода: если пришло меньше, чем limit, значит это последняя страница
            if (items.length < limit) break;
            offset += items.length;
        }

        console.log(`[Fetch] ${name} итого получено: ${allItems.length}`);
        return allItems;
    } catch (err) {
        console.error(`   [Error] ${name}: ${err.message}`);
        return allItems;
    }
};


export const syncProductsFromApi = async () => {
    try {
        console.log('\n[Sync] === ЗАПУСК СИНХРОНИЗАЦИИ ===');

        // 1. Получаем магазин
        const shopsRes = await fetch(`${KONTUR_API_BASE_URL}/shops`, { headers: getApiHeaders() });
        const shopsData = await shopsRes.json();
        const shops = shopsData.Items || shopsData.items || [];
        if (!shops.length) throw new Error('Магазин не найден');
        const shopId = shops[0].Id || shops[0].id;

        // 2. Скачиваем данные последовательно
        const products = await fetchAllPagesBackend(`${KONTUR_API_BASE_URL}/shops/${shopId}/products`, 'Товары');
        const rests = await fetchAllPagesBackend(`${KONTUR_API_BASE_URL}/shops/${shopId}/product-rests`, 'Остатки');
        const catalog = await fetchAllPagesBackend(`${KONTUR_API_BASE_URL}/shops/${shopId}/product-groups`, 'Каталог');
        console.log('=======prod-rest-matha-faka-----',rests.length)

        const now = new Date();
        const dateTo = now.toISOString().split('T')[0];
        const dateFrom = new Date();
        dateFrom.setDate(now.getDate() - 30);

        console.log(`[Sync] Запрос чеков за период: ${dateFrom.toISOString().split('T')[0]} - ${dateTo}`);

        const cheques = await fetchAllPagesBackend(
            `${KONTUR_API_BASE_URL}/shops/${shopId}/cheques`,
            'Чеки',
            { dateFrom: dateFrom.toISOString().split('T')[0], dateTo }
        );

        // 3. Считаем аналитику (внутри этой функции теперь лог чека)
        const { popularityMap, stats } = calculateAnalytics(cheques, products);

        // 4. Мержим
        const restsMap = new Map();

        rests.forEach(r => {
            // В Контуре GUID остатка может быть в productId или ProductId
            const pId = String(r.ProductId || r.productId || "").toLowerCase().trim();
            // Само значение остатка может быть в Rest или rest
            const val = r.Rest !== undefined ? r.Rest : r.rest;
            if (pId) restsMap.set(pId, parseFloat(val || 0));
        });

        let scored = 0;
        const mergedProducts = products.map(p => {
            const guid = String(getVal(p, 'id') || '').toLowerCase();
            const score = popularityMap[guid] || 0;
            if (score > 0) scored++;
            let obj = {
                ...p,
                id: getVal(p, 'id'),
                rests: restsMap.get(guid) || 0,
                popularityScore: score
            }
            return obj
        });

        // 5. Сохраняем
        const dataToStore = { products: mergedProducts, catalog, analytics: stats, lastSync: new Date().toISOString() };
        await fs.mkdir(path.dirname(PRODUCTS_DB_PATH), { recursive: true });
        await fs.writeFile(PRODUCTS_DB_PATH, JSON.stringify(dataToStore, null, 2));

        console.log(`[Sync] ФИНАЛ. Всего товаров: ${mergedProducts.length}`);

    } catch (error) {
        console.error('[Sync Error]:', error);
    }

};

export const getLocalProducts = async () => {
    try {
        const data = await fs.readFile(PRODUCTS_DB_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return { products: [], catalog: [], analytics: {} };
    }
};

export const updateLocalStock = async (cartItems) => {
    try {
        const data = await getLocalProducts();
        if (!data.products.length) return;
        const productsMap = new Map(data.products.map(p => [p.id, p]));
        cartItems.forEach(item => {
            const p = productsMap.get(item.id);
            if (p) p.rests = Math.max(0, p.rests - Number(item.quantity));
        });
        await fs.writeFile(PRODUCTS_DB_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('[Stock Error]:', error);
    }
};