import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api', // Используем относительный путь, который перехватит прокси
});

export const getShops = async () => {
  try {
    const response = await apiClient.get('/shops');
    // console.log('[API] Ответ shops:', response.data); // Логируем полный ответ
    return response.data.items || [];
  } catch (error) {
    console.error('[API Error] Ошибка при получении магазинов:', error.response?.data || error.message);
    throw error;
  }
};

const getProducts = async (shopId) => {
  try {
    const response = await apiClient.get(`/shops/${shopId}/products`);
    // console.log(`[API] Ответ products для магазина ${shopId}:`, response.data.items.);
    return response.data.items || [];
  } catch (error) {
    console.error(`[API Error] Ошибка при получении товаров для магазина ${shopId}:`, error.response?.data || error.message);
    throw error;
  }
};

export const getCatalog = async (shopId) => {
  try {
    const response = await apiClient.get(`/shops/${shopId}/product-groups`);
    //console.log(`[API] Ответ product-groups для магазина ${shopId}:`, response.data);
    return response.data.items || [];
  } catch (error) {
    console.error(`[API Error] Ошибка при получении каталога для магазина ${shopId}:`, error.response?.data || error.message);
    throw error;
  }
};


const getProductRests = async (shopId) => {
  try {
    const response = await apiClient.get(`/shops/${shopId}/product-rests`);
   return response.data.results || response.data.items || [];
  } catch (error) {
    console.error(`[API Error] Ошибка при получении остатков для магазина ${shopId}:`, error.response?.data || error.message);
    throw error;
  }
};

// Главная функция, которая объединяет все данные
export const fetchProductsWithRests = async () => {
  try {
    const shopsArray = await getShops();

    // Проверяем, что массив не пустой и содержит ID
    if (!shopsArray || shopsArray.length === 0 || !shopsArray[0] || !shopsArray[0].id) {
      const errorMessage = 'API не вернул ни одной торговой точки или ее ID. Проверьте права вашего API-ключа или доступность API.';
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    const firstShop = shopsArray[0];
    const shopId = firstShop.id;

    const [products, rests] = await Promise.all([
      getProducts(shopId),
      getProductRests(shopId),
    ]);

    const restsMap = new Map();
    if (Array.isArray(rests)) { // Убедимся, что rests - это массив
      rests.forEach(rest => {
        // Дополнительные проверки на существование полей перед добавлением в карту
        if (rest && rest.productId !== undefined && rest.rest !== undefined) {
          restsMap.set(rest.productId, rest.rest);
        } else {
          console.warn('[Processing] Найден неполный объект остатка, пропускаем:', rest);
        }
      });
    } else {
      console.error('[Processing] Переменная "rests" не является массивом:', rests);
      // Если rests не массив, restsMap останется пустой
    }

    const mergedProducts = products.map(product => {
      // Убедимся, что product и product.id существуют
      const currentProductId = product && product.id !== undefined ? product.id : null;
      // Используем restsMap для получения остатка, если currentProductId валиден
      const rests = currentProductId !== null
                       ? restsMap.get(currentProductId) || 0
                       : 0; // Если product.id нет, остаток 0

      // Используем product.sellPrice как есть, если существует
      const sellPrice = product && product.sellPrice !== undefined
                        ? product.sellPrice
                        : undefined; // Если sellPrice нет, оставляем undefined
      return {
        ...product,
        rests: rests,
        sellPrice: sellPrice // Гарантируем, что sellPrice всегда присутствует
      };
    });
    return mergedProducts;

  } catch (error) {
    // Улучшаем обработку ошибок для более информативного вывода
    const errorMessage = error.response
      ? `Ошибка API: ${error.response.status} ${error.response.statusText} - ${error.response.data?.message || 'Неизвестная ошибка API'}`
      : `Ошибка сети или обработки: ${error.message}`;

    console.error("Ошибка при получении данных из Контур.Маркет:", errorMessage, error);
    throw new Error(errorMessage); // Пробрасываем ошибку дальше
  }
};
