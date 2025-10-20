// Файл: server.js
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import paymentRouter from './services/YooKassa.js';
import initializeBot from './services/api_Telegram.js'; 
import { syncProductsFromApi, getLocalProducts } from './services/syncService.js';

dotenv.config();
const PORT = process.env.PORT || 3000;
const app = express();

const allowedOrigins = [
  'https://fasol-nvrsk.ru',      // Ваш основной домен
  'http://localhost:5173',       // Адрес для локальной разработки
];

const corsOptions = {
  origin: function (origin, callback) {
    // Если источник запроса есть в нашем списке, разрешаем его
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // Если источника нет в списке, отклоняем запрос
      callback(new Error('Not allowed by CORS'));
    }
  },
  optionsSuccessStatus: 200 // для старых браузеров
};

app.use(cors(corsOptions));
app.use(express.json());

// initializeBot(app);
initializeBot(syncProductsFromApi);

// 2. Подключаем роутер для платежей с префиксом /api
app.use('/api', paymentRouter);

app.get('/api/products-data', async (req, res) => {
    try {
        const data = await getLocalProducts();
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка получения данных о товарах' });
    }
});

// 3. Запускаем сервер
app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
});