// src/services/konturMarketApi.js
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api',
});

export const fetchProductsWithRests = async () => {
  try {
    const response = await apiClient.get('/products-data');

    return response.data.products || [];
  } catch (error) {
    console.error("Ошибка при получении данных от локального сервера:", error);
    return [];
  }
};

export const getCatalog = async () => {
  try {
    const response = await apiClient.get('/products-data');
    return response.data.catalog || [];
  } catch (error) {
    return [];
  }
};