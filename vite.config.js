import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => { 
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: 'https://api.kontur.ru/market/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              // Используем переменную, загруженную через loadEnv
              proxyReq.setHeader('x-kontur-apikey', env.KONTUR_API_KEY);
            });
          },
        },
      },
    },
  };
});