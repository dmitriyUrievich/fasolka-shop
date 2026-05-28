import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import paymentRouter from './src/services/YooKassa.js';
import initializeBot from './src/services/api_Telegram.js';
import { syncProductsFromApi, getLocalProducts } from './src/services/syncService.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

async function createServer() {
  const app = express();
  let vite;

  if (!isProd) {
    console.log('🚀 Запуск в режиме разработки (development)...');
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom'
    });
    app.use(vite.middlewares);
  } else {
    console.log('📦 Запуск в режиме продакшена (production)...');
    app.use(express.static(path.resolve(__dirname, 'dist/client'), { index: false }));
  }

  // Настройка CORS
  const allowedOrigins = ['https://fasol-nvrsk.ru', 'http://localhost:5173', `http://localhost:${PORT}`];
  const corsOptions = {
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    optionsSuccessStatus: 200
  };
  app.use(cors(corsOptions)); 
  app.use(express.json());

  // Логика, которая должна работать ТОЛЬКО на реальном сервере
  if (isProd) {
    initializeBot(syncProductsFromApi);
    console.log('🤖 Telegram-бот запущен.');
    
    // ✅ ИЗМЕНЕНИЕ: Переносим синхронизацию сюда
    console.log('🔄 Запускаем синхронизацию товаров...');
    syncProductsFromApi();
    setInterval(syncProductsFromApi, 30 * 60 * 1000); // 30 минут

  } else {
    console.log('🔧 Telegram-бот и фоновая синхронизация НЕ запущены в режиме разработки.');
  }

  // API роуты
  const apiRouter = express.Router();
  apiRouter.get('/products-data', async (req, res) => {
    try {
        const data = await getLocalProducts();
        res.status(200).json(data);
    } catch (error) {
        console.error('Ошибка при отдаче данных о продуктах:', error);
        res.status(500).json({ message: 'Ошибка получения данных о товарах' });
    }
  });
  apiRouter.use(paymentRouter); 
  app.use('/api', apiRouter);

  // Основной роут для рендеринга React-приложения
  app.get(/.*/, async (req, res, next) => {
    const url = req.originalUrl;
    
    // Пропускаем служебные запросы Vite и API
    if (url.startsWith('/api') || url.includes('vite')) {
      return next();
    }
    
    try {
      let template, render;

      if (!isProd) {
        // Логика для разработки
        template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        render = (await vite.ssrLoadModule('/entry-server.jsx')).render;
      } else {
        // Логика для продакшена
        template = fs.readFileSync(path.resolve(__dirname, 'dist/client/index.html'), 'utf-8');
        render = (await import('./dist/server/entry-server.js')).render;
      }

      const initialData = await getLocalProducts();
      const { appHtml } = render(url, initialData);

      const html = template
        .replace(`<!--ssr-outlet-->`, appHtml)
        .replace(
          '</head>',
          `<script>window.__INITIAL_DATA__ = ${JSON.stringify(initialData)}</script></head>`
        );
      
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);

    } catch (e) {
      if(vite) vite.ssrFixStacktrace(e);
      console.error('Критическая ошибка во время рендеринга:', e);
      res.status(500).end(e.message);
    }
  });

  app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
  });
}

createServer();