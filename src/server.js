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

// --- Настройка CORS (без изменений) ---
const allowedOrigins = [
  'https://fasol-nvrsk.ru',
  'http://localhost:5173',
];
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

initializeBot(syncProductsFromApi);


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


app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
  syncProductsFromApi();
  setInterval(syncProductsFromApi, 30 * 60 * 1000);
});