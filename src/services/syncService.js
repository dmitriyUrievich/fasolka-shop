// Файл: services/syncService.js
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const PRODUCTS_DB_PATH = path.join(process.cwd(), 'src', 'products.json');
const KONTUR_API_BASE_URL = 'https://api.kontur.ru/market/v1';
const getApiHeaders = () => ({
    'X-Kontur-Apikey': process.env.KONTUR_API_KEY,
    'Content-Type': 'application/json',
});

const getShops = async () => {
    const response = await fetch(`${KONTUR_API_BASE_URL}/shops`, { headers: getApiHeaders() });
    if (!response.ok) throw new Error(`Ошибка получения магазинов: ${response.statusText}`);
    const data = await response.json();
    return data.items || [];
};

const getProducts = async (shopId) => {
    const response = await fetch(`${KONTUR_API_BASE_URL}/shops/${shopId}/products`, { headers: getApiHeaders() });
    if (!response.ok) throw new Error(`Ошибка получения товаров: ${response.statusText}`);
    const data = await response.json();
    return data.items || [];
};

const getProductRests = async (shopId) => {
    const response = await fetch(`${KONTUR_API_BASE_URL}/shops/${shopId}/product-rests`, { headers: getApiHeaders() });
    if (!response.ok) throw new Error(`Ошибка получения остатков: ${response.statusText}`);
    const data = await response.json();
    return data.results || data.items || [];
};

const getCatalog = async (shopId) => {
    const response = await fetch(`${KONTUR_API_BASE_URL}/shops/${shopId}/product-groups`, { headers: getApiHeaders() });
    if (!response.ok) throw new Error(`Ошибка получения каталога: ${response.statusText}`);
    const data = await response.json();
    return data.items || [];
};

export const syncProductsFromApi = async () => {
    try {
        console.log('Начало синхронизации с Контур.Маркет...');

        // 1. Получаем ID магазина
        const shops = await getShops();
        if (!shops || shops.length === 0 || !shops[0]?.id) {
            throw new Error('API не вернул ни одной торговой точки или ее ID.');
        }
        const shopId = shops[0].id;
        console.log(`Работаем с магазином ID: ${shopId}`);

        // 2. Параллельно запрашиваем товары, остатки и каталог
        const [products, rests, catalog] = await Promise.all([
            getProducts(shopId),
            getProductRests(shopId),
            getCatalog(shopId),
        ]);
        console.log(`Получено: ${products.length} товаров, ${rests.length} остатков, ${catalog.length} категорий.`);

        // 3. Создаем карту остатков для быстрого доступа
        const restsMap = new Map();
        if (Array.isArray(rests)) {
            rests.forEach(rest => {
                if (rest && rest.productId !== undefined && rest.rest !== undefined) {
                    restsMap.set(rest.productId, rest.rest);
                }
            });
        }

        // 4. Объединяем товары с их остатками
        const mergedProducts = products.map(product => ({
            ...product,
            rests: restsMap.get(product.id) || 0,
        }));

        // 5. Собираем все в один объект для сохранения
        const dataToStore = {
            products: mergedProducts,
            catalog: catalog,
            lastSync: new Date().toISOString()
        };

        // 6. Перезаписываем наш локальный файл
        await fs.writeFile(PRODUCTS_DB_PATH, JSON.stringify(dataToStore, null, 2));

        console.log(`Синхронизация завершена. Загружено ${mergedProducts.length} товаров.`);
        return { success: true, message: `Загружено ${mergedProducts.length} товаров.` };

    } catch (error) {
        console.error('Критическая ошибка во время синхронизации:', error.message);
        return { success: false, message: error.message };
    }
};

export const getLocalProducts = async () => {
    try {
        const data = await fs.readFile(PRODUCTS_DB_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return { products: [], catalog: [], lastSync: null };
        }
        console.error("Ошибка чтения локальной базы продуктов:", error);
        throw error;
    }
};

export const updateLocalStock = async (cartItems) => {
    console.log('[Stock] Начинаем списание остатков для заказа...');
    try {
        const data = await getLocalProducts();
        
        // Для быстрого поиска товаров используем Map
        const productsMap = new Map(data.products.map(p => [p.id, p]));

        let updatedCount = 0;
        cartItems.forEach(itemInCart => {
            const productToUpdate = productsMap.get(itemInCart.id);
            
            if (productToUpdate) {
                // Вычитаем заказанное количество, не даем остаткам уйти в минус
                const newRest = Math.max(0, productToUpdate.rests - Number(itemInCart.quantity));
                productToUpdate.rests = newRest;
                productsMap.set(itemInCart.id, productToUpdate);
                updatedCount++;
            }
        });

        // Если были обновления, конвертируем Map обратно в массив и перезаписываем файл
        if (updatedCount > 0) {
            data.products = Array.from(productsMap.values());
            await fs.writeFile(PRODUCTS_DB_PATH, JSON.stringify(data, null, 2));
            console.log(`[Stock] Успешно списано ${updatedCount} позиций из локальной базы.`);
        } else {
            console.log('[Stock] Не найдено товаров для списания в локальной базе.');
        }

    } catch (error) {
        console.error('[Stock Error] Критическая ошибка: не удалось обновить остатки в файле products.json:', error);
    }
    
}