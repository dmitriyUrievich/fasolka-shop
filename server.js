import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import paymentRouter from './src/services/YooKassa.js';
import cron from 'node-cron';
import { syncProductsFromApi, getLocalProducts } from './src/services/syncService.js';
import adminRouter from './src/services/adminRouter.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

async function createServer() {
  const app = express();
  let vite;

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom'
    });
    app.use(vite.middlewares);
  }

  // 1. МИДЛВАРЫ
  const allowedOrigins = ['https://fasol-nvrsk.ru', 'http://localhost:5173', `http://localhost:${PORT}`];
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error('Not allowed by CORS'));
    }
  }));
  app.use(express.json());

  // 2. СТАТИКА
  const publicPath = isProd ? path.resolve(__dirname, 'dist/client') : path.resolve(__dirname, 'public');
  app.use(express.static(publicPath, { index: false }));

  // Обработка картинок с fallback
  app.get('/img/:filename', (req, res, next) => {
    const filePath = path.join(publicPath, 'img', req.params.filename);
    if (fs.existsSync(filePath)) return next();
    res.status(200).sendFile(path.join(publicPath, 'img', 'fallback.webp'));
  });

  // Быстрая синхронизация остатков (30 мин)
  setInterval(() => syncProductsFromApi(false), 30 * 60 * 1000);

  // Полный пересчет популярности (ночью в 03:00)
  cron.schedule('0 3 * * *', () => syncProductsFromApi(true));

  // 4. API РОУТЫ
  const apiRouter = express.Router();

  // внешний админ-роутер (там логин, заказы, веса и статусы)
  apiRouter.use(adminRouter);

  // Роут для фронтенда (получение товаров)
  apiRouter.get('/products-data', async (req, res) => {
    try {
      const data = await getLocalProducts();
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ message: 'Ошибка получения данных' });
    }
  });

  apiRouter.use(paymentRouter);
  app.use('/api', apiRouter);

  // 5. SSR LOGIC (catch-all)
  app.get(/.*/, async (req, res, next) => {
    const url = req.originalUrl;
    const isHtmlRequest = req.headers.accept?.includes('text/html');
    const isFileRequest = url.includes('.');

    if (url.startsWith('/api') || url.startsWith('/@') || (!isHtmlRequest && isFileRequest)) {
      return next();
    }

    try {
      let template, render;
      if (!isProd) {
        template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        render = (await vite.ssrLoadModule('/entry-server.jsx')).render;
      } else {
        template = fs.readFileSync(path.resolve(__dirname, 'dist/client/index.html'), 'utf-8');
        render = (await import('./dist/server/entry-server.js')).render;
      }

      const initialData = await getLocalProducts();
      const { appHtml } = render(url, initialData);

      const html = template
          .replace(`<!--ssr-outlet-->`, appHtml)
          .replace('</head>', `<script>window.__INITIAL_DATA__ = ${JSON.stringify(initialData)}</script></head>`);

      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (e) {
      if (vite) vite.ssrFixStacktrace(e);
      res.status(500).end(e.message);
    }
  });

  app.listen(PORT, () => {
    console.log(`✅ Сервер готов: http://localhost:${PORT}`);
  });
}

createServer();