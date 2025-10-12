// Файл: src/services/YooKassa.js

import { Router } from 'express';
import { YooCheckout } from '@a2seven/yoo-checkout';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { sendPaidOrderNotification } from './api_Telegram.js';
import fs from 'fs';
import path from 'path';

dotenv.config();

const router = Router();

const YOUKASSA_SECRET_KEY = process.env.YOUKASSA_KEY;
const YOUKASSA_SHOP_ID = process.env.YOUKASSA_ID;

if (!YOUKASSA_SECRET_KEY || !YOUKASSA_SHOP_ID) {
  // Выбрасываем ошибку, чтобы остановить сервер при неверной конфигурации
  throw new Error('Учетные данные YooKassa не заданы в .env файле.');
}
const pendingOrdersPath = path.resolve('pendingOrders.json');

const readPendingOrders = () => {
  if (!fs.existsSync(pendingOrdersPath)) {
    return {};
  }
  const data = fs.readFileSync(pendingOrdersPath);
  return JSON.parse(data);
};

// 4. Функция для записи заказов в файл
const writePendingOrders = (orders) => {
  fs.writeFileSync(pendingOrdersPath, JSON.stringify(orders, null, 2));
};

const YooKassa = new YooCheckout({
  shopId: YOUKASSA_SHOP_ID,
  secretKey: YOUKASSA_SECRET_KEY,
});

router.post('/payment', async (req, res) => {
  try {
   
    const { id: orderId, total, cart, customer_name, phone, address, deliveryTime, comment } = req.body;

    const createPayload = {
      amount: {
        value: Number(total).toFixed(2),
        currency: 'RUB',
      },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: 'https://fasol-nvrsk.ru',
      },
      description: `Заказ №${orderId}`,
      metadata: {
        orderId: orderId,
      },
      receipt: {
        customer: {
          phone: phone,
        },
        items: cart.map(item => ({
          description: item.name,
          quantity: item.quantity.toString(),
          amount: {
            value: Number(item.price).toFixed(2),
            currency: 'RUB'
          },
          vat_code: '1',
        })),
      }
    };

    const payment = await YooKassa.createPayment(createPayload, uuidv4());

   const pendingOrders = readPendingOrders();
    pendingOrders[payment.id] = {
      id: orderId, total, cart, customer_name, phone, address, deliveryTime, comment,
    };
    console.log(`[Payment] Создан платеж для заказа №${orderId} с paymentId: ${payment.id}`);
    
    // Отправляем клиенту объект с платежом (включая confirmation_url)
    res.json({ payment });

  } catch (error) {
    console.error('Ошибка при создании платежа:', error.data || error);
    res.status(400).json({ error: error.data || { message: 'Неизвестная ошибка' } });
  }
});

// Роут для приема вебхуков (уведомлений) от ЮKassa
router.post('/payment/notifications', async (req, res) => {
  console.log('[Webhook] ПОЛУЧЕН ЗАПРОС НА /api/payment/notifications. Тело запроса:', req.body);
  try {
    const notification = req.body;
    if (notification.event === 'payment.succeeded' && notification.object.status === 'succeeded') {
      const paymentId = notification.object.id;
      
      // Находим заказ в нашем временном хранилище
      const pendingOrders = readPendingOrders();
      const orderData = pendingOrders[paymentId];
      
      if (orderData) {
        console.log(`[Webhook] Найден заказ №${orderData.id} для оплаченного paymentId ${paymentId}`);
        
        // Вызываем функцию для отправки уведомления в Telegram
        await sendPaidOrderNotification(orderData);
        
        // Удаляем обработанный заказ из хранилища
        delete pendingOrders[paymentId];
        
      } else {
        console.warn(`[Webhook] Не найден заказ для оплаченного paymentId: ${paymentId}. Возможно, он уже был обработан.`);
      }
    }
    
    res.status(200).json('OK');

  } catch (error) {
    console.error('[Webhook] Ошибка обработки уведомления:', error);
    res.status(200).json('OK');
  }
});

export default router;