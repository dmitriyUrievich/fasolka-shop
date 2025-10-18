// Файл: src/services/YooKassa.js

import { Router } from 'express';
import { YooCheckout } from '@a2seven/yoo-checkout';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { sendOrderForAssemblyNotification, sendPaidOrderNotification } from './api_Telegram.js';
import fs from 'fs';
import path from 'path';

dotenv.config();

const router = Router();

const YOUKASSA_SECRET_KEY = process.env.YOUKASSA_KEY;
const YOUKASSA_SHOP_ID = process.env.YOUKASSA_ID;

if (!YOUKASSA_SECRET_KEY || !YOUKASSA_SHOP_ID) {
  throw new Error('Учетные данные YooKassa не заданы в .env файле.');
}

// Два файла для хранения: один для ожидающих оплаты, другой для ожидающих сборки
const pendingOrdersPath = path.resolve('pendingOrders.json');
const assemblyOrdersPath = path.resolve('assemblyOrders.json');

const readFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return data ? JSON.parse(data) : {};
  } catch (error) { console.error(`Ошибка чтения ${filePath}:`, error); return {}; }
};
const writeFile = (filePath, data) => fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

const YooKassa = new YooCheckout({ shopId: YOUKASSA_SHOP_ID, secretKey: YOUKASSA_SECRET_KEY });

// ШАГ 1: Создание платежа с ХОЛДИРОВАНИЕМ
router.post('/payment', async (req, res) => {
  try {
    const { id: orderId, cart, ...customerData } = req.body;

    // --- НАЧАЛО ИСПРАВЛЕНИЯ: Пересчитываем все суммы на бэкенде ---
    let realTotal = 0;
    let totalWithReserve = 0;

    cart.forEach(item => {
      const itemTotal = Number(item.price) * Number(item.quantity);
      realTotal += itemTotal;
      if (item.unit === 'Kilogram') {
        totalWithReserve += itemTotal * 1.15;
      } else {
        totalWithReserve += itemTotal;
      }
    });
    
    realTotal = parseFloat(realTotal.toFixed(2));
    totalWithReserve = parseFloat(totalWithReserve.toFixed(2));
    const reserveDifference = parseFloat((totalWithReserve - realTotal).toFixed(2));
    // --- КОНЕЦ ИСПРАВЛЕНИЯ ---

    const createPayload = {
      amount: {
        value: totalWithReserve.toFixed(2),
        currency: 'RUB',
      },
      capture: false,
      confirmation: { type: 'redirect', return_url: 'https://fasol-nvrsk.ru' },
      description: `Заказ №${orderId} (резервирование средств)`,
      metadata: { orderId },
      receipt: {
        customer: { phone: customerData.phone },
        items: cart.map(item => ({
          description: item.name.substring(0, 128),
          quantity: item.quantity.toString(),
          amount: { value: Number(item.price).toFixed(2), currency: 'RUB' },
          vat_code: '1',
          payment_mode: 'full_prepayment',
          payment_subject: 'commodity',
        })),
      }
    };
    
    if (reserveDifference > 0) {
      createPayload.receipt.items.push({
        description: 'Резервирование средств за весовой товар',
        quantity: '1.00',
        amount: { value: reserveDifference.toFixed(2), currency: 'RUB' },
        vat_code: '1',
        payment_mode: 'full_prepayment',
        payment_subject: 'service',
      });
    }

    const payment = await YooKassa.createPayment(createPayload, uuidv4());

    const pendingOrders = readFile(pendingOrdersPath);
    pendingOrders[payment.id] = { id: orderId, totalWithReserve, cart, ...customerData };
    writeFile(pendingOrdersPath, pendingOrders);

    res.json({ payment });
  } catch (error) {
    console.error('Ошибка при создании платежа:', error.data || error);
    res.status(400).json({ error: error.data || { message: 'Неизвестная ошибка' } });
  }
});

// ШАГ 2: Уведомление от ЮKassa о том, что деньги ЗАХОЛДИРОВАНЫ
router.post('/payment/notifications', async (req, res) => {
  try {
    const notification = req.body;
    if (notification.event === 'payment.succeeded' && notification.object.status === 'succeeded') {
      const paymentId = notification.object.id;
      const pendingOrders = readFile(pendingOrdersPath);
      const orderData = pendingOrders[paymentId];
      if (orderData) {
        console.log(`[Webhook] Средства для заказа №${orderData.id} успешно захолдированы.`);
        const assemblyOrders = readFile(assemblyOrdersPath);
        assemblyOrders[orderData.id] = { ...orderData, paymentId: paymentId };
        writeFile(assemblyOrdersPath, assemblyOrders);
        delete pendingOrders[paymentId];
        writeFile(pendingOrdersPath, pendingOrders);
        await sendOrderForAssemblyNotification(orderData);
      }
    }
    res.status(200).json('OK');
  } catch (error) {
    console.error('[Webhook] Ошибка обработки уведомления:', error);
    res.status(200).json('OK');
  }
});

// ШАГ 3: Эндпоинт для подтверждения списания ТОЧНОЙ суммы
router.post('/payment/capture', async (req, res) => {
  try {
    const { orderId, finalCart } = req.body;
    if (!orderId || !finalCart) return res.status(400).json({ message: 'Нет ID или финальной корзины.' });
    
    const assemblyOrders = readFile(assemblyOrdersPath);
    const orderData = assemblyOrders[orderId];
    if (!orderData) return res.status(404).json({ message: 'Заказ не найден.' });

    const finalTotal = finalCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const capturePayload = { amount: { value: finalTotal.toFixed(2), currency: 'RUB' } };

    await YooKassa.capturePayment(orderData.paymentId, capturePayload, uuidv4());
    console.log(`[Capture] Списание для заказа №${orderId} на сумму ${finalTotal.toFixed(2)} успешно.`);
    
    const finalOrderData = { ...orderData, cart: finalCart, total: finalTotal };
    await sendPaidOrderNotification(finalOrderData);

    delete assemblyOrders[orderId];
    writeFile(assemblyOrdersPath, assemblyOrders);

    res.status(200).json({ success: true, message: 'Списание подтверждено.' });
  } catch (error) {
    console.error('[Capture] Ошибка при списании:', error.data || error);
    res.status(500).json({ error: error.data || { message: 'Ошибка сервера' } });
  }
});

export default router;