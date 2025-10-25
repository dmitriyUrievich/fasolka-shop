import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
});

export const getShops = async () => {
  try {
    const response = await apiClient.get('/shops');
    return response.data.items || [];
  } catch (error) {
    console.error('[API Error] Ошибка при получении магазинов:', error.response?.data || error.message);
    throw error;
  }
};

const getProducts = async (shopId) => {
  try {
    const response = await apiClient.get(`/shops/${shopId}/products`);
    return response.data.items || [];
  } catch (error) {
    console.error(`[API Error] Ошибка при получении товаров для магазина ${shopId}:`, error.response?.data || error.message);
    throw error;
  }
};

export const getCatalog = async (shopId) => {
  try {
    const response = await apiClient.get(`/shops/${shopId}/product-groups`);
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

export const fetchProductsWithRests = async () => {
  try {
    const shopsArray = await getShops();
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
    if (Array.isArray(rests)) { 
      rests.forEach(rest => {
        if (rest && rest.productId !== undefined && rest.rest !== undefined) {
          restsMap.set(rest.productId, rest.rest);
        } else {
          console.warn('[Processing] Найден неполный объект остатка, пропускаем:', rest);
        }
      });
    } else {
      console.error('[Processing] Переменная "rests" не является массивом:', rests);
    }

    const mergedProducts = products.map(product => {
      const currentProductId = product && product.id !== undefined ? product.id : null;
      const rests = currentProductId !== null
                       ? restsMap.get(currentProductId) || 0
                       : 0; // Если product.id нет, остаток 0

      const sellPrice = product && product.sellPrice !== undefined
                        ? product.sellPrice
                        : undefined;
      return {
        ...product,
        rests: rests,
        sellPrice: sellPrice
      };
    });
    return mergedProducts;

  } catch (error) {
    const errorMessage = error.response
      ? `Ошибка API: ${error.response.status} ${error.response.statusText} - ${error.response.data?.message || 'Неизвестная ошибка API'}`
      : `Ошибка сети или обработки: ${error.message}`;

    console.error("Ошибка при получении данных из Контур.Маркет:", errorMessage, error);
    throw new Error(errorMessage); // Пробрасываем ошибку дальше
  }
};
