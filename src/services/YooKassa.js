import { Router } from 'express';
import { YooCheckout } from '@a2seven/yoo-checkout';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
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
    const { 
      id: orderId, cart, subtotal, totalWithReserve, deliveryCost, ...customerData 
    } = req.body;

    const receiptItems = cart.map(item => ({
      description: item.name.substring(0, 128),
      quantity: item.quantity.toString(),
      amount: { value: Number(item.price).toFixed(2), currency: 'RUB' },
      vat_code: '1',
      payment_mode: 'full_prepayment',
      payment_subject: 'commodity',
      measure: item.unit === 'Kilogram' ? 'kilogram' : 'piece'
    }));

      const reserveDifference = parseFloat((totalWithReserve - subtotal).toFixed(2));
    if (reserveDifference > 0) {
      receiptItems.push({
        description: 'Резервирование средств за весовой товар',
        quantity: '1',
        amount: { value: reserveDifference.toFixed(2), currency: 'RUB' },
        vat_code: '1',
        payment_mode: 'full_prepayment',
        payment_subject: 'service',
        measure: 'piece'
      });
    }

    // Шаг 3: Добавляем доставку как отдельную позицию в чек, если она есть.
    if (deliveryCost > 0) {
      receiptItems.push({
        description: 'Доставка',
        quantity: '1',
        amount: { value: deliveryCost.toFixed(2), currency: 'RUB' },
        vat_code: '1',
        payment_mode: 'full_prepayment',
        payment_subject: 'service',
        measure: 'piece'
      });
    }

    const finalAmount = receiptItems.reduce((sum, item) => {
        const itemTotal = Number(item.amount.value) * 100 * Number(item.quantity);
        return (sum * 100 + itemTotal) / 100;
    }, 0);

    if (finalAmount <= 0) {
      return res.status(400).json({ message: 'Некорректная итоговая сумма для оплаты.' });
    }

    const createPayload = {
      amount: { value: finalAmount.toFixed(2), currency: 'RUB' }, 
      confirmation: { type: 'redirect', return_url: 'https://fasol-nvrsk.ru' },
      description: `Заказ №${orderId} (резервирование средств)`,
      metadata: { orderId },
      receipt: {
        customer: { phone: customerData.phone },
        items: receiptItems
      }
    };
    
    const payment = await YooKassa.createPayment(createPayload, uuidv4());
    
    const pendingOrders = readFile(pendingOrdersPath);
    pendingOrders[payment.id] = req.body;
    writeFile(pendingOrdersPath, pendingOrders);

    res.json({ payment });

  } catch (error) {
    console.error('Ошибка при создании платежа:', error.data || error);
    res.status(400).json({ error: error.data || { message: 'Неизвестная ошибка' } });
  }
});
// ------------------
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
const completedOrdersPath = path.resolve('orders.json'); // Путь к оплаченным заказам

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

    // 1. Считаем сумму товаров (без доставки)
    const itemsTotal = finalCart.reduce((sum, item) => {
      return (sum * 100 + (Number(item.price) * 100 * Number(item.quantity))) / 100;
    }, 0);

    const deliveryCost = orderData.deliveryCost || 0;
    const finalTotalWithDelivery = itemsTotal + deliveryCost;

    // 2. Формируем чек для ЮKassa
    const finalReceipt = {
      customer: { phone: orderData.phone },
      items: finalCart.map(item => ({
        description: item.name.substring(0, 128),
        // Округляем количество до 3 знаков (важно для веса!)
        quantity: Number(item.quantity).toFixed(3),
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
        description: `Доставка: ${orderData.address || ''}`.substring(0, 128),
        quantity: '1.00',
        amount: { value: deliveryCost.toFixed(2), currency: 'RUB' },
        vat_code: '1',
        payment_mode: 'full_prepayment',
        payment_subject: 'service',
        measure: 'piece'
      });
    }

    const capturePayload = {
      amount: { value: Number(finalTotalWithDelivery).toFixed(2), currency: 'RUB' },
      receipt: finalReceipt
    };

    console.log(`\n--- [Capture] Итоговая сумма товаров: ${itemsTotal.toFixed(2)} ₽ ---`);
    console.log(`--- [Capture] К списанию (с доставкой): ${finalTotalWithDelivery.toFixed(2)} ₽ ---`);

    // 3. Списание в ЮKassa
    await YooKassa.capturePayment(orderData.paymentId, capturePayload, uuidv4());

    // 4. ВАЖНО: Сохраняем в список ОПЛАЧЕННЫХ заказов (orders.json)
    const completedOrders = readFile(completedOrdersPath);
    completedOrders[orderId] = {
      ...orderData,
      cart: finalCart,
      total: finalTotalWithDelivery,
      itemsTotal: itemsTotal, // Сохраняем сумму без доставки для аналитики
      status: 'new',
      date: new Date().toISOString() // Для сортировки по времени
    };
    writeFile(completedOrdersPath, completedOrders);

    // 5. Удаляем из папки сборки
    delete assemblyOrders[orderId];
    writeFile(assemblyOrdersPath, assemblyOrders);

    // 6. Обновляем остатки в магазине
    await updateLocalStock(finalCart);

    console.log(`[Capture] Заказ №${orderId} успешно обработан и сохранен.`);
    res.status(200).json({ success: true, message: 'Оплата списана, заказ в списке оплаченных.' });

  } catch (error) {
    console.error('[Capture Error]:', error.data || error);
    res.status(500).json({ error: error.data || { message: 'Ошибка сервера при списании' } });
  }
});

export default router;