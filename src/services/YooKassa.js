import { Router } from 'express';
import { YooCheckout } from '@a2seven/yoo-checkout';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { updateLocalStock } from './syncService.js';

dotenv.config();
const router = Router();

const PENDING_ORDERS_PATH = path.join(process.cwd(), 'pendingOrders.json');
const ASSEMBLY_ORDERS_PATH = path.join(process.cwd(), 'assemblyOrders.json');
const COMPLETED_ORDERS_PATH = path.join(process.cwd(), 'orders.json');

const readFile = (p) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8') || '{}'); }
  catch { return {}; }
};
const writeFile = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2));

const YooKassa = new YooCheckout({ shopId: process.env.YOUKASSA_ID, secretKey: process.env.YOUKASSA_KEY });

// 1. СОЗДАНИЕ ПЛАТЕЖА
router.post('/payment', async (req, res) => {
  try {
    const { id: orderId, cart, totalWithReserve, subtotal, deliveryCost, ...customerData } = req.body;

    // ПРОВЕРКА НА ВЕСОВЫЕ ТОВАРЫ
    const hasWeight = cart.some(item => item.unit === 'Kilogram');

    const receiptItems = cart.map(item => ({
      description: item.name.substring(0, 128),
      quantity: String(item.quantity),
      amount: { value: Number(item.price).toFixed(2), currency: 'RUB' },
      vat_code: '1',
      payment_mode: 'full_prepayment',
      payment_subject: 'commodity',
      measure: item.unit === 'Kilogram' ? 'kilogram' : 'piece'
    }));

    if (hasWeight) {
      const reserve = parseFloat((totalWithReserve - subtotal).toFixed(2));
      if (reserve > 0) receiptItems.push({
        description: 'Резерв за вес',
        quantity: '1',
        amount: { value: reserve.toFixed(2), currency: 'RUB' },
        vat_code: '1',
        payment_mode: 'full_prepayment',
        payment_subject: 'service',
        measure: 'piece'
      });
    }

    if (deliveryCost > 0) receiptItems.push({
      description: 'Доставка',
      quantity: '1',
      amount: { value: Number(deliveryCost).toFixed(2), currency: 'RUB' },
      vat_code: '1',
      payment_mode: 'full_prepayment',
      payment_subject: 'service',
      measure: 'piece'
    });

    const finalAmount = receiptItems.reduce((sum, item) => sum + (Math.round(Number(item.amount.value) * 100) * Number(item.quantity)), 0) / 100;

    const createPayload = {
      amount: { value: finalAmount.toFixed(2), currency: 'RUB' },
      // ГЛАВНОЕ: Списываем сразу (true), если веса НЕТ. Если вес ЕСТЬ — холдируем (false).
      capture: !hasWeight,
      confirmation: { type: 'redirect', return_url: 'https://fasol-nvrsk.ru' },
      description: `Заказ №${orderId}`,
      metadata: { orderId: String(orderId), hasWeight: String(hasWeight) },
      receipt: { customer: { phone: customerData.phone }, items: receiptItems }
    };

    const payment = await YooKassa.createPayment(createPayload, uuidv4());
    const pending = readFile(PENDING_ORDERS_PATH);
    pending[payment.id] = { ...req.body, date: new Date().toISOString() };
    writeFile(PENDING_ORDERS_PATH, pending);

    res.json({ payment });
  } catch (error) {
    console.error('Payment Error:', error);
    res.status(400).json({ error: error.message });
  }
});

// 2. ОБРАБОТКА УВЕДОМЛЕНИЙ (WEBHOOK)
router.post('/payment/notifications', async (req, res) => {
  try {
    const { event, object: obj } = req.body;
    if (!obj) return res.status(200).send('OK');

    const orderId = obj.metadata?.orderId;
    const pending = readFile(PENDING_ORDERS_PATH);
    const orderData = pending[obj.id];

    if (!orderData) return res.status(200).send('OK');

    // СЦЕНАРИЙ А: Весовой товар (Заморожено) -> В сборку
    if (event === 'payment.waiting_for_capture') {
      const assembly = readFile(ASSEMBLY_ORDERS_PATH);
      assembly[orderId] = { ...orderData, paymentId: obj.id, status: 'new', date: new Date().toISOString() };
      writeFile(ASSEMBLY_ORDERS_PATH, assembly);
      delete pending[obj.id];
      writeFile(PENDING_ORDERS_PATH, pending);
      console.log(`[Webhook] Заказ №${orderId} (ВЕСОВОЙ) отправлен на сборку.`);
    }
    // СЦЕНАРИЙ Б: Обычный товар (Списано сразу) -> В оплаченные
    else if (event === 'payment.succeeded') {
      const completed = readFile(COMPLETED_ORDERS_PATH);
      completed[orderId] = {
        ...orderData,
        status: 'new',
        total: obj.amount.value,
        date: new Date().toISOString()
      };
      writeFile(COMPLETED_ORDERS_PATH, completed);
      delete pending[obj.id];
      writeFile(PENDING_ORDERS_PATH, pending);
      await updateLocalStock(orderData.cart);
      console.log(`[Webhook] Заказ №${orderId} (ШТУЧНЫЙ) сразу оплачен.`);
    }

    res.status(200).send('OK');
  } catch (error) {
    res.status(200).send('OK');
  }
});

// 3. ПОДТВЕРЖДЕНИЕ СБОРКИ (CAPTURE)
router.post('/payment/capture', async (req, res) => {
  try {
    const { orderId, finalCart } = req.body;
    const assembly = readFile(ASSEMBLY_ORDERS_PATH);
    const orderData = assembly[orderId];
    if (!orderData) return res.status(404).send('Заказ не найден');

    const itemsTotal = finalCart.reduce((sum, item) => (sum * 100 + (Number(item.price) * 100 * Number(item.quantity))) / 100, 0);
    const finalTotal = itemsTotal + (orderData.deliveryCost || 0);

    const capturePayload = {
      amount: { value: finalTotal.toFixed(2), currency: 'RUB' },
      receipt: {
        customer: { phone: orderData.phone },
        items: [...finalCart.map(item => ({
          description: item.name,
          quantity: Number(item.quantity).toFixed(3),
          amount: { value: Number(item.price).toFixed(2), currency: 'RUB' },
          vat_code: '1', measure: item.unit === 'Kilogram' ? 'kilogram' : 'piece'
        }))]
      }
    };

    if (orderData.deliveryCost > 0) {
      capturePayload.receipt.items.push({
        description: 'Доставка', quantity: '1.000',
        amount: { value: Number(orderData.deliveryCost).toFixed(2), currency: 'RUB' },
        vat_code: '1', measure: 'piece'
      });
    }

    await YooKassa.capturePayment(orderData.paymentId, capturePayload, uuidv4());

    // Переносим в оплаченные
    const completed = readFile(COMPLETED_ORDERS_PATH);
    completed[orderId] = {
      ...orderData,
      cart: finalCart,
      total: finalTotal.toFixed(2),
      itemsTotal,
      status: 'in_progress',
      date: new Date().toISOString()
    };
    writeFile(COMPLETED_ORDERS_PATH, completed);

    delete assembly[orderId];
    writeFile(ASSEMBLY_ORDERS_PATH, assembly);
    await updateLocalStock(finalCart);

    res.json({ success: true });
  } catch (error) {
    console.error('Capture Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;