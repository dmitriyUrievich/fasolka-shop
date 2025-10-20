import { Router } from 'express';
import { YooCheckout } from '@a2seven/yoo-checkout';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { sendOrderForAssemblyNotification, sendPaidOrderNotification } from './api_Telegram.js';
import fs from 'fs';
import path from 'path';
import { updateLocalStock } from './syncService.js';

dotenv.config();

const router = Router();

const YOUKASSA_SECRET_KEY = process.env.YOUKASSA_KEY;
const YOUKASSA_SHOP_ID = process.env.YOUKASSA_ID;

if (!YOUKASSA_SECRET_KEY || !YOUKASSA_SHOP_ID) {
  throw new Error('Учетные данные YooKassa не заданы в .env файле.');
}

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

router.post('/payment', async (req, res) => {
  try {
    // 1. Получаем ВСЕ необходимые данные от фронтенда
    const { 
      id: orderId, 
      cart, 
      subtotal,           // Чистая стоимость товаров
      totalWithReserve,   // Стоимость товаров + резерв
      deliveryCost,       // Стоимость доставки
      amountToPay,        // Итоговая сумма для ХОЛДА (totalWithReserve + deliveryCost)
      ...customerData 
    } = req.body;

    // 2. Проверка, что итоговая сумма корректна
    if (!amountToPay || amountToPay <= 0) {
      return res.status(400).json({ message: 'Некорректная сумма для оплаты.' });
    }

    // 3. Вычисляем разницу для "Резервирования"
    const reserveDifference = parseFloat((totalWithReserve - subtotal).toFixed(2));

    // 4. Формируем payload для ЮKassa
    const createPayload = {
      amount: {
        value: amountToPay.toFixed(2), // <-- Используем ПОЛНУЮ сумму для холдирования
        currency: 'RUB',
      },
      capture: false, // Двухстадийная оплата
      confirmation: { type: 'redirect', return_url: 'https://fasol-nvrsk.ru/thank-you' },
      description: `Заказ №${orderId} (резервирование средств)`,
      metadata: { orderId },
      receipt: {
        customer: { phone: customerData.phone },
        // Сначала добавляем в чек все реальные товары
        items: cart.map(item => ({
          description: item.name.substring(0, 128),
          quantity: item.quantity.toString(),
          amount: { value: Number(item.price).toFixed(2), currency: 'RUB' },
          vat_code: '1',
          payment_mode: 'full_prepayment',
          payment_subject: 'commodity',
          measure: item.unit === 'Kilogram' ? 'kilogram' : 'piece'
        })),
      }
    };
    
    // 5. Добавляем в чек позицию "Резервирование", если она есть
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

    // 6. Добавляем в чек позицию "Доставка", если она есть
    if (deliveryCost > 0) {
      createPayload.receipt.items.push({
        description: 'Доставка',
        quantity: '1.00',
        amount: { value: deliveryCost.toFixed(2), currency: 'RUB' },
        vat_code: '1',
        payment_mode: 'full_prepayment',
        payment_subject: 'service',
      });
    }

    // 7. Отправляем запрос в ЮKassa
    const payment = await YooKassa.createPayment(createPayload, uuidv4());

    // 8. Сохраняем ВЕСЬ заказ, чтобы иметь доступ ко всем данным позже
    const pendingOrders = readFile(pendingOrdersPath);
    pendingOrders[payment.id] = req.body; // Сохраняем всё, что пришло с фронтенда
    writeFile(pendingOrdersPath, pendingOrders);

    res.json({ payment });

  } catch (error) {
   console.error('Ошибка при создании платежа:', error.data || error);
    res.status(400).json({ error: error.data || { message: 'Неизвестная ошибка' } });
  }
});

router.post('/payment/notifications', async (req, res) => {
  console.log('-----------------------------------------');
  console.log(`[Webhook] ${new Date().toISOString()} - Получено новое уведомление!`);
  console.log('Тело уведомления:', JSON.stringify(req.body, null, 2));

  try {
    const notification = req.body;

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

router.post('/payment/capture', async (req, res) => {
  try {
    const { orderId, finalCart } = req.body;
    if (!orderId || !finalCart) {
      return res.status(400).json({ message: 'Нет ID заказа или финальной корзины.' });
    }
    
    const assemblyOrders = readFile(assemblyOrdersPath);
    const orderData = assemblyOrders[orderId];
    if (!orderData) {
      return res.status(404).json({ message: 'Заказ для списания не найден.' });
    }

    // --- НАЧАЛО ИЗМЕНЕНИЙ ---

    // 1. Считаем итоговую стоимость ТОЛЬКО товаров из финальной (взвешенной) корзины
    const finalItemsTotal = finalCart.reduce((sum, item) => {
        // Используем более безопасный метод для работы с деньгами, чтобы избежать ошибок с плавающей точкой
        return (sum * 100 + (Number(item.price) * 100 * Number(item.quantity))) / 100;
    }, 0);

    // 2. Достаем стоимость доставки из данных заказа, сохраненных при холдировании
    // (Если deliveryCost не было, считаем его равным 0)
    const deliveryCost = orderData.deliveryCost || 0;

    // 3. Считаем НАСТОЯЩУЮ итоговую сумму для списания
    const finalTotalWithDelivery = finalItemsTotal + deliveryCost;

    // 4. Формируем финальный чек, который ТАКЖЕ включает доставку
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
    if (deliveryCost > 0) {
        finalReceipt.items.push({
            description: 'Доставка',
            quantity: '1.00',
            amount: { value: deliveryCost.toFixed(2), currency: 'RUB' },
            vat_code: '1',
            payment_mode: 'full_prepayment',
            payment_subject: 'service'
        });
    }

    // 5. Создаем payload для списания с правильной суммой и чеком
    const capturePayload = { 
        amount: { 
            value: Number(finalTotalWithDelivery).toFixed(2), // <-- Используем сумму С доставкой
            currency: 'RUB' 
        },
        receipt: finalReceipt
    };

    // Отправляем запрос на списание в ЮKassa
    await YooKassa.capturePayment(orderData.paymentId, capturePayload, uuidv4());
    console.log(`[Capture] Списание для заказа №${orderId} на сумму ${finalTotalWithDelivery.toFixed(2)} успешно.`);
    
    // Вызываем списание остатков из локальной базы данных
    await updateLocalStock(finalCart);

    // Готовим финальные данные для уведомления в Telegram
    const finalOrderData = { ...orderData, cart: finalCart, total: finalTotalWithDelivery };
    await sendPaidOrderNotification(finalOrderData);

    // Очищаем заказ из файла "на сборке"
    delete assemblyOrders[orderId];
    writeFile(assemblyOrdersPath, assemblyOrders);

    res.status(200).json({ success: true, message: 'Списание подтверждено.' });
  } catch (error) {
    console.error('[Capture] Ошибка при списании:', error.data || error);
    res.status(500).json({ error: error.data || { message: 'Ошибка сервера' } });
  }
});

export default router;