import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
export default defineConfig(({ mode }) => {

  return {
    plugins: [react(),],
    ssr: {
    noExternal: ['react-helmet-async'],
    },
  server: {
    host: '0.0.0.0',

    hmr: mode === 'development' ? {
      host: 'localhost',
      protocol: 'ws',
    } : {
      host: 'fasol-nvrsk.ru',
      protocol: 'wss',
    },
  }
  };
});
