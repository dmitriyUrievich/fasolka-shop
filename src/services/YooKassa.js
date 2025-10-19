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

// ШАГ 1: Создание платежа с ХОЛДИРОВАНИЕМ и ПРАВИЛЬНЫМ чеком
router.post('/payment', async (req, res) => {
  try {
    const { id: orderId, cart, ...customerData } = req.body;

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
          // --- ИСПРАВЛЕНИЕ №1 ---
          // Добавляем единицу измерения в зависимости от типа товара
          measure: item.unit === 'Kilogram' ? 'kilogram' : 'piece'
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
        // Для услуг единица измерения не нужна, но можно указать 'pc' для совместимости
        measure: 'piece'
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
  console.log('-----------------------------------------');
  console.log(`[Webhook] ${new Date().toISOString()} - Получено новое уведомление!`);
  console.log('Тело уведомления:', JSON.stringify(req.body, null, 2));

  try {
    const notification = req.body;

    // Реагируем на событие успешного холдирования
    if (notification.event === 'payment.waiting_for_capture' && notification.object?.status === 'waiting_for_capture') {
      const paymentId = notification.object.id;
      console.log(`[Webhook] Это успешное холдирование для платежа ID: ${paymentId}`);

      const pendingOrders = readFile(pendingOrdersPath);
      const orderData = pendingOrders[paymentId];

      if (orderData) {
        console.log(`[Webhook] Найден ожидающий заказ №${orderData.id}. Начинаю обработку.`);
        
        const assemblyOrders = readFile(assemblyOrdersPath);
        assemblyOrders[orderData.id] = { ...orderData, paymentId: paymentId };
        writeFile(assemblyOrdersPath, assemblyOrders);
        console.log(`[Webhook] Заказ №${orderData.id} перенесен в файл сборки (assemblyOrders.json).`);

        delete pendingOrders[paymentId];
        writeFile(pendingOrdersPath, pendingOrders);
        console.log(`[Webhook] Заказ удален из файла ожидания (pendingOrders.json).`);
        
        console.log(`[Webhook] Вызываю функцию отправки уведомления в Telegram для заказа №${orderData.id}...`);
        await sendOrderForAssemblyNotification(orderData);
        console.log(`[Webhook] Уведомление для заказа №${orderData.id} успешно отправлено.`);

      } else {
        console.warn(`[Webhook] ВНИМАНИЕ: Получено уведомление для платежа ${paymentId}, но соответствующий заказ не найден в pendingOrders.json. Возможно, он уже обработан.`);
      }
    } else {
      console.log(`[Webhook] Получено уведомление, но это не 'payment.waiting_for_capture'. Событие: "${notification.event}", Статус: "${notification.object?.status}". Игнорируем.`);
    }

    res.status(200).send('OK');

  } catch (error) {
    console.error('[Webhook] КРИТИЧЕСКАЯ ОШИБКА при обработке уведомления:', error);
    res.status(200).send('OK');
  }
  console.log('-----------------------------------------\n');
});

// ШАГ 3: Эндпоинт для подтверждения списания ТОЧНОЙ суммы с ПРАВИЛЬНЫМ чеком
router.post('/payment/capture', async (req, res) => {
  try {
    const { orderId, finalCart } = req.body;
    if (!orderId || !finalCart) return res.status(400).json({ message: 'Нет ID или финальной корзины.' });
    
    const assemblyOrders = readFile(assemblyOrdersPath);
    const orderData = assemblyOrders[orderId];
    if (!orderData) return res.status(404).json({ message: 'Заказ не найден.' });

    const finalTotal = finalCart.reduce((sum, item) => {
        return (sum * 100 + (item.price * 100 * item.quantity)) / 100;
    }, 0);
    
    // Формируем новый, финальный чек для отправки в налоговую
    const finalReceipt = {
        customer: { phone: orderData.phone },
        items: finalCart.map(item => ({
          description: item.name.substring(0, 128),
          quantity: item.quantity.toString(),
          amount: { 
            value: Number(item.price).toFixed(2), 
            currency: 'RUB' 
          },
          vat_code: '1',
          payment_mode: 'full_prepayment',
          payment_subject: 'commodity',
          measure: item.unit === 'Kilogram' ? 'kilogram' : 'piece'
        })),
    };

    const capturePayload = { 
        amount: { 
            value: finalTotal.toFixed(2), 
            currency: 'RUB' 
        },
        receipt: finalReceipt
    };

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