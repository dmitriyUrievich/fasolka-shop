import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      // proxy: {
      //   // --- Существующая настройка для Kontur API ---
      //   '/api': {
      //     target: 'https://api.kontur.ru/market/v1',
      //     changeOrigin: true,
      //     rewrite: (path) => path.replace(/^\/api/, ''),
      //     configure: (proxy, options) => {
      //       proxy.on('proxyReq', (proxyReq, req, res) => {
      //         proxyReq.setHeader('x-kontur-apikey', env.KONTUR_API_KEY);
      //       });
      //     },
      //   },
      //   // --- НОВАЯ настройка для вашего локального Node.js сервера ---
      //   '/order': { // Здесь указываем путь, который использует ваш React-компонент
      //     target: 'http://localhost:3000', // Здесь указываем адрес вашего Node.js сервера
      //     changeOrigin: true, // Важно для корректной работы прокси
      //     // rewrite: (path) => path.replace(/^\/order/, '/order'), // Необязательно, если путь на бэкенде совпадает
      //   },
      // },

       proxy: {
        // --- Правило для ВАШЕГО ЛОКАЛЬНОГО сервера ---
        '/api': {
          target: 'http://localhost:3000', // Адрес вашего Node.js сервера
          changeOrigin: true,
          // Убираем /local-api, чтобы на ваш сервер пришел чистый путь /api/...
          rewrite: (path) => path.replace(/^\/local-api/, '/api'),
        },

        // --- Правило для ВНЕШНЕГО сервера Контура ---
        '/kontur-api': {
          target: 'https://api.kontur.ru/market/v1',
          changeOrigin: true,
          // Убираем /kontur-api, чтобы на сервер Контура пришел чистый путь
          rewrite: (path) => path.replace(/^\/kontur-api/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              proxyReq.setHeader('x-kontur-apikey', env.KONTUR_API_KEY);
            });
          },
        },
      },
      // Убедитесь, что порт React Dev Server'а совпадает с тем, что в ошибке (5173)
      port: 5173,
    },
  };
});