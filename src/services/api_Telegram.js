import dotenv from 'dotenv';
import express from 'express';
import TelegramBot from 'node-telegram-bot-api';

dotenv.config();
const app = express();
app.use(express.json());

const card = {
  "id": "ORDER6",
  "customer_name": "Лиза",
  "phone": "+79998887766",
  "address": "г. Москва, ул. Пушкина, д. 1, кв. 2",
  "total": 1780,
  "cart": [
    { "name": "Кофе", "quantity": 1, "price": 580 },
    { "name": "Печенье", "quantity": 2, "price": 600 }
  ]
}

const PORT = 3000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const bot = new TelegramBot(TOKEN, { polling: true });
const orders = new Map();

// Русские названия статусов
const STATUS_LABEL = {
  new: 'Новый',
  in_progress: 'В работе',
  completed: 'Завершён'
};

// Бот отвечает только вам
bot.on('message', async msg => {
  if (msg.chat.id.toString() !== CHAT_ID) {
    return bot.sendMessage(msg.chat.id, '🚫 Доступ запрещён');
  }
});

// /start — клавиатура на русском
bot.onText(/\/start/, msg => {
  const chatId = msg.chat.id;
  const keyboard = [
    ['Все заказы'],
    ['Новые заказы', 'В работе']
  ];
  bot.sendMessage(chatId, 'Привет! Выберите действие:', {
    reply_markup: { keyboard, resize_keyboard: true }
  });
});

// «Все заказы» — показываем только new и in_progress
bot.onText(/^Все заказы$/, msg => {
  const chatId = msg.chat.id;
  const list = Array.from(orders.values()).filter(o => o.status === 'new' || o.status === 'in_progress');
  if (!list.length) {
    return bot.sendMessage(chatId, 'Заказов нет.');
  }
  list.forEach(o => {
    const text =
      `📋 Заказ ${o.id}\n` +
      `Имя: ${o.customer_name}\n` +
      `Адрес: ${o.address}\n` +
      `Телефон: ${o.phone}\n` +
      `Статус: ${STATUS_LABEL[o.status]}`;
    const buttons = [];
    if (o.status === 'new') {
      buttons.push([{ text: 'Взять в работу', callback_data: `get_${o.id}` }]);
    } else {
      buttons.push([{ text: 'Завершить заказ', callback_data: `done_${o.id}` }]);
    }
    bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  });
});

// «Новые заказы»
bot.onText(/^Новые заказы$/, msg => {
  const chatId = msg.chat.id;
  const list = Array.from(orders.values()).filter(o => o.status === 'new');
  if (!list.length) {
    return bot.sendMessage(chatId, 'Нет новых заказов.');
  }
  list.forEach(o => {
    const text =
      `📋 Заказ ${o.id}\n` +
      `Имя: ${o.customer_name}\n` +
      `Адрес: ${o.address}\n` +
      `Телефон: ${o.phone}\n` +
      `Статус: ${STATUS_LABEL[o.status]}`;
    bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: 'Взять в работу', callback_data: `get_${o.id}` }]]
      }
    });
  });
});

// «В работе»
bot.onText(/^В работе$/, msg => {
  const chatId = msg.chat.id;
  const list = Array.from(orders.values()).filter(o => o.status === 'in_progress');
  if (!list.length) {
    return bot.sendMessage(chatId, 'Нет заказов в работе.');
  }
  list.forEach(o => {
    const text =
      `📋 Заказ ${o.id}\n` +
      `Имя: ${o.customer_name}\n` +
      `Адрес: ${o.address}\n` +
      `Телефон: ${o.phone}\n` +
      `Статус: ${STATUS_LABEL[o.status]}`;
    bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: 'Завершить заказ', callback_data: `done_${o.id}` }]]
      }
    });
  });
});

// inline‑кнопка «Взять в работу» и «Завершить заказ»
bot.on('callback_query', async q => {
  const [action, id] = q.data.split('_');
  const o = orders.get(id);
  if (!o) {
    return bot.answerCallbackQuery(q.id, { text: 'Заказ не найден', show_alert: true });
  }
  if (action === 'get' && o.status === 'new') {
    o.status = 'in_progress';
  } else if (action === 'done' && o.status === 'in_progress') {
    o.status = 'completed';
  } else {
    return bot.answerCallbackQuery(q.id, { text: 'Невозможно выполнить', show_alert: true });
  }
  orders.set(id, o);

  // обновлённый текст
  const text =
    `📋 Заказ ${o.id}\n` +
    `Имя: ${o.customer_name}\n` +
    `Адрес: ${o.address}\n` +
    `Телефон: ${o.phone}\n` +
    `Статус: ${STATUS_LABEL[o.status]}` +
    (o.status === 'completed' ? ' ✅' : '');
  // кнопки
  const buttons = [];
  if (o.status === 'new') {
    buttons.push([{ text: 'Взять в работу',   callback_data: `get_${o.id}` }]);
  } else if (o.status === 'in_progress') {
    buttons.push([{ text: 'Завершить заказ', callback_data: `done_${o.id}` }]);
  }
  await bot.editMessageText(text, {
    chat_id: q.message.chat.id,
    message_id: q.message.message_id,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: buttons }
  });
  bot.answerCallbackQuery(q.id);
});

// HTTP‑эндпоинт для новых заказов
app.post('/order', async (req, res) => {
  const o = req.body;
  if (!o?.id || !o.customer_name || !o.phone || !o.address || !o.total || !Array.isArray(o.cart)) {
    return res.status(400).json({ success: false, message: 'Неверный формат заказа' });
  }
  o.status = 'new';
  orders.set(o.id, o);

  let cartText = '';
  o.cart.forEach((it, i) => {
    cartText += `${i + 1}) ${it.name} — ${it.quantity}×${it.price}₽ = ${it.quantity * it.price}₽\n`;
  });

  const msg =
    `🛒 Новый заказ\n\n` +
    `Номер: ${o.id}\n` +
    `Имя: ${o.customer_name}\n` +
    `Адрес: ${o.address}\n` +
    `Телефон: ${o.phone}\n\n` +
    `Корзина:\n${cartText}\n` +
    `Итого: ${o.total}₽\n` +
    `Статус: ${STATUS_LABEL[o.status]}`;

  try {
    await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'HTML' });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Ошибка отправки' });
  }
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
