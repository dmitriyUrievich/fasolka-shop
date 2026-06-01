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

  // 1. ИНИЦИАЛИЗАЦИЯ VITE (в режиме разработки)
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom'
    });
    // Мидлвары Vite должны быть в самом начале для HMR и обработки ресурсов
    app.use(vite.middlewares);
  }

  // 2. ОБЩИЕ МИДЛВАРЫ
  const allowedOrigins = ['https://fasol-nvrsk.ru', 'http://localhost:5173', `http://localhost:${PORT}`];
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error('Not allowed by CORS'));
    }
  }));
  app.use(express.json());

  // 3. СТАТИЧЕСКИЕ ФАЙЛЫ (КАРТИНКИ И Т.Д.)
  // Это критически важный блок. Мы указываем Express, где искать файлы.
  const publicPath = isProd
      ? path.resolve(__dirname, 'dist/client')
      : path.resolve(__dirname, 'public');

  app.use(express.static(publicPath, { index: false }));

  app.get('/img/:filename', (req, res, next) => {
    const { filename } = req.params;
    const filePath = path.join(publicPath, 'img', filename);

    // Проверяем, существует ли файл физически
    if (fs.existsSync(filePath)) {
      // Если файл есть, просто идем дальше (его отдаст express.static или res.sendFile)
      return next();
    } else {
      // Если файла НЕТ, вместо 404 отдаем заглушку
      const fallbackPath = path.join(publicPath, 'img', 'fallback.webp');
      // Важно: возвращаем файл заглушки с кодом 200
      return res.status(200).sendFile(fallbackPath);
    }
  });


  // 4. ЛОГИКА СИНХРОНИЗАЦИИ (ТОЛЬКО ПРОД)
// В server.js найдите место запуска синхронизации
  if (isProd) {
    //initializeBot(syncProductsFromApi);
    setInterval(syncProductsFromApi, 30 * 60 * 1000);
  }

  // ЗАПУСКАЕМ И ЖДЕМ ПЕРВУЮ СИНХРОНИЗАЦИЮ ПЕРЕД ТЕМ КАК СЕРВЕР СТАНЕТ ДОСТУПЕН
  console.log('⏳ Первая синхронизация данных...');
  await syncProductsFromApi();
  console.log('✅ Данные готовы.');

  const testData = await getLocalProducts();
  console.log('Первый товар после синхронизации (server.js):', JSON.stringify(testData.products?.[0], null, 2));


  // 5. API РОУТЫ
  const apiRouter = express.Router();
  apiRouter.get('/products-data', async (req, res) => {
    try {
      const data = await getLocalProducts();
      console.log(`[API] Отправка данных клиенту. Товаров: ${data?.products?.length || 0}`);
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ message: 'Ошибка получения данных' });
    }
  });
  apiRouter.use(paymentRouter);
  app.use('/api', apiRouter);



  // 6. ОСНОВНОЙ РОУТ ДЛЯ SSR (РЕАКТ-ПРИЛОЖЕНИЕ)
  app.get(/.*/, async (req, res, next) => {
    const url = req.originalUrl;

    // Проверяем: это запрос за HTML или за файлом?
    const isHtmlRequest = req.headers.accept && req.headers.accept.includes('text/html');
    const isFileRequest = url.includes('.');

    // Если это API, запрос к ресурсу Vite или запрос за файлом (картинка, js, css)
    // мы выходим из этого роута и передаем управление дальше (в static или 404)
    if (url.startsWith('/api') || url.startsWith('/@') || (!isHtmlRequest && isFileRequest)) {
      return next();
    }

    try {
      let template, render;

      if (!isProd) {
        // Читаем шаблон напрямую и трансформируем его через Vite
        template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        render = (await vite.ssrLoadModule('/entry-server.jsx')).render;
      } else {
        // В продакшене используем собранные файлы
        template = fs.readFileSync(path.resolve(__dirname, 'dist/client/index.html'), 'utf-8');
        render = (await import('./dist/server/entry-server.js')).render;
      }

      const initialData = await getLocalProducts();
      const { appHtml } = render(url, initialData);

      // Вставляем отрендеренный HTML и данные в шаблон
      const html = template
          .replace(`<!--ssr-outlet-->`, appHtml)
          .replace(
              '</head>',
              `<script>window.__INITIAL_DATA__ = ${JSON.stringify(initialData)}</script></head>`
          );

      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);

    } catch (e) {
      if (vite) vite.ssrFixStacktrace(e);
      console.error('Ошибка SSR:', e.stack);
      res.status(500).end(e.message);
    }
  });

  app.listen(PORT, () => {
    console.log(`✅ Сервер готов: http://localhost:${PORT}`);
  });
}

createServer();