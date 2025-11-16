// Файл: server.js
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
    // В режиме разработки используем Vite Dev Server как middleware
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom'
    });
    app.use(vite.middlewares);
  } else {
    // В режиме продакшена раздаем статику из dist/client
    app.use(express.static(path.resolve(__dirname, 'dist/client'), { index: false }));
  }

// --- Настройка CORS (без изменений) ---
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

if (isProd) {
  initializeBot(syncProductsFromApi);
  console.log('🤖 Telegram-бот запущен в режиме продакшен.');
} else {
  console.log('🔧 Telegram-бот НЕ запущен в режиме разработки.');
}

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

app.get(/.*/, async (req, res, next) => {
    const url = req.originalUrl;
    
    // Пропускаем API запросы
    if (url.startsWith('/api')) {
      return next();
    }
    
    try {
      let template, render;

      if (!isProd) {
        // 1. Читаем index.html
        template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        // 2. Применяем Vite HTML-трансформации
        template = await vite.transformIndexHtml(url, template);
        // 3. Загружаем серверный entry-файл
        render = (await vite.ssrLoadModule('/entry-server.jsx')).render;
      } else {
        template = fs.readFileSync(path.resolve(__dirname, 'dist/client/index.html'), 'utf-8');
        // В продакшене импортируем уже собранный модуль
        render = (await import('./dist/server/entry-server.js')).render;
      }

      // 4. Получаем данные для пре-рендеринга
      const initialData = await getLocalProducts();

      // 5. Рендерим приложение в HTML
      const { appHtml } = render(initialData);

      // 6. Встраиваем данные и HTML в шаблон
      const html = template
        .replace(`<!--ssr-outlet-->`, appHtml)
        .replace(
          '</head>',
          `<script>window.__INITIAL_DATA__ = ${JSON.stringify(initialData)}</script></head>`
        );
      // 7. Отправляем HTML клиенту
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);

    } catch (e) {
      if(vite) vite.ssrFixStacktrace(e);
      console.error(e);
      res.status(500).end(e.message);
    }
  });

  app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    syncProductsFromApi();
    setInterval(syncProductsFromApi, 30 * 60 * 1000);
  });
}

createServer();