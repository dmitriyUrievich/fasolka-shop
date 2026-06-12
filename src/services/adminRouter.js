import { Router } from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
const SECRET = process.env.JWT_SECRET;
const ADMIN_PASS = process.env.ADMIN_PASSWORD;

const ASSEMBLY_ORDERS_PATH = path.resolve('assemblyOrders.json');
const COMPLETED_ORDERS_PATH = path.resolve('orders.json');

// Вспомогательные функции для файлов
const readFile = (filePath) => {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf8') || '{}');
};
const writeFile = (filePath, data) => fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

// Middleware проверки токена
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Токен отсутствует' });

    jwt.verify(token, SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Сессия истекла. Войдите заново.' });
        req.user = user;
        next();
    });
};

// 1. Вход
router.post('/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASS) {
        const token = jwt.sign({ role: 'admin' }, SECRET, { expiresIn: '24h' });
        res.json({ token });
    } else {
        res.status(401).json({ message: 'Неверный пароль' });
    }
});

// 2. Получение данных
router.get('/admin/orders', authMiddleware, (req, res) => {
    const assembly = readFile(ASSEMBLY_ORDERS_PATH);
    const completed = readFile(COMPLETED_ORDERS_PATH);
    res.json({ assembly, completed });
});

// 3. Изменение веса (как в боте)
router.post('/admin/update-weight', authMiddleware, (req, res) => {
    const { orderId, itemIndex, newWeightKg } = req.body;
    const orders = readFile(ASSEMBLY_ORDERS_PATH);
    if (orders[orderId]) {
        const item = orders[orderId].cart[itemIndex];
        if (!item.originalQuantity) item.originalQuantity = item.quantity;
        item.quantity = newWeightKg;
        writeFile(ASSEMBLY_ORDERS_PATH, orders);
        res.json({ success: true });
    } else {
        res.status(404).json({ message: 'Заказ не найден' });
    }
});

// 4. Списание средств (Capture)
router.post('/admin/capture', authMiddleware, async (req, res) => {
    const { orderId } = req.body;
    try {
        const orders = readFile(ASSEMBLY_ORDERS_PATH);
        const orderData = orders[orderId];
        if (!orderData) return res.status(404).json({ message: 'Заказ не найден' });

        // Вызываем ваш роут в YooKassa.js
        const API_URL = `http://localhost:${process.env.PORT || 3000}`;
        await axios.post(`${API_URL}/api/payment/capture`, {
            orderId,
            finalCart: orderData.cart
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ message: e.response?.data?.message || e.message });
    }
});

// 5. Изменение статуса
router.post('/admin/update-status', authMiddleware, (req, res) => {
    const { orderId, newStatus } = req.body;
    const orders = readFile(COMPLETED_ORDERS_PATH);
    if (orders[orderId]) {
        orders[orderId].status = newStatus;
        writeFile(COMPLETED_ORDERS_PATH, orders);
        res.json({ success: true });
    } else {
        res.status(404).json({ message: 'Заказ не найден' });
    }
});

export default router;