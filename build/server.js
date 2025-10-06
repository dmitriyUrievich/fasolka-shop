// Файл: server.js
import dotenv from 'dotenv';
dotenv.config();
import cors from 'cors';
import express from 'express';
import initializeBot from './services/api_Telegram.js';
import paymentRouter from './services/YooKassa.js';
const PORT = process.env.PORT || 3000;
const app = express();
const allowedOrigins = [
    'https://fasol-nvrsk.ru', // Ваш основной домен
    'http://localhost:5173', // Адрес для локальной разработки
    // Сюда можно добавить другие домены, если потребуется
];
const corsOptions = {
    origin: function (origin, callback) {
        // Если источник запроса есть в нашем списке, разрешаем его
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        }
        else {
            // Если источника нет в списке, отклоняем запрос
            callback(new Error('Not allowed by CORS'));
        }
    },
    optionsSuccessStatus: 200 // для старых браузеров
};
app.use(cors(corsOptions));
app.use(express.json());
initializeBot(app);
// 2. Подключаем роутер для платежей с префиксом /api
app.use('/api', paymentRouter);
// 3. Запускаем сервер
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
});
