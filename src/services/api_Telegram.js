import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
dotenv.config();

 // const card = {
//   "id": "ORDER6",
//   "customer_name": "Лиза",
//   "phone": "+79998887766",
//   "address": "г. Москва, ул. Пушкина, д. 1, кв. 2",
//   "total": 1780,
//   "cart": [
//     { "name": "Кофе", "quantity": 1, "price": 580 },
//     { "name": "Печенье", "quantity": 2, "price": 600 }
//   ]
// } 

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || '')
  .split(',')
  .map(id => id.trim())
  .filter(id => id);

if (ALLOWED_CHAT_IDS.length === 0) {
  console.warn('⚠️ ВНИМАНИЕ: Не заданы разрешённые CHAT_ID');
}

console.log('TOKEN----:', TOKEN);
console.log('Разрешённые CHAT_ID:', ALLOWED_CHAT_IDS);

// Проверка авторизации пользователя
function isAuthorized(chatId) {
  return ALLOWED_CHAT_IDS.includes(chatId.toString());
}

const bot = new TelegramBot(TOKEN, { polling: true });
const orders = new Map();

/**
 * Отправляет уведомление об успешной оплате заказа в Telegram.
 * @param {object} orderData - Полные данные заказа, сохраненные при создании платежа.
 */
export const sendPaidOrderNotification = async (orderData) => {
  // Формируем список товаров из корзины
  const cartText = orderData.cart.map((item, i) => {
    const unitLabel = item.unit === 'Kilogram' ? 'кг' : 'шт';
    return `${i + 1}) ${item.name} — ${item.quantity}${unitLabel} × ${item.price}₽ = ${(item.quantity * item.price).toFixed(2)}₽`;
  }).join('\n');

  // Формируем дополнительные поля
  const commentText = orderData.comment ? `\n💬 Комментарий: ${orderData.comment}` : '';
  const deliveryText = orderData.deliveryTime ? `\n⏰ Время доставки: ${orderData.deliveryTime}` : '';

  const message = `
✅ <b>Поступила новая ОПЛАТА</b>

🧾 Номер заказа: <code>${orderData.id}</code>
👤 Имя: ${orderData.customer_name}
📞 Телефон: ${orderData.phone}
🏠 Адрес: ${orderData.address}
${deliveryText}
${commentText}

📦 <b>Корзина:</b>
${cartText}

💰 <b>Итого: ${orderData.total.toFixed(2)} ₽</b>
  `.trim();

  try {
    // Сохраняем заказ в локальное хранилище для дальнейшего управления через бота
    // Статус "new" означает, что заказ новый и ожидает обработки.
    orders.set(orderData.id.toString(), { ...orderData, status: 'new' });

    // Отправляем сообщение всем разрешенным админам
    const promises = ALLOWED_CHAT_IDS.map(chatId => 
      bot.sendMessage(chatId, message, { parse_mode: 'HTML' })
    );
    await Promise.all(promises);
    console.log(`[Telegram] Уведомление об оплаченном заказе №${orderData.id} успешно отправлено.`);
  } catch (error) {
    console.error(`[Telegram] Ошибка отправки уведомления для заказа №${orderData.id}:`, error);
  }
};

export default function initializeBot(app) {

// Русские названия статусов
const STATUS_LABEL = {
  new: 'Новый',
  in_progress: 'В работе',
  completed: 'Завершён'
};

// Обработка всех текстовых сообщений
bot.on('message', async (msg) => {
  const chatId = msg.chat.id.toString();

  if (!isAuthorized(chatId)) {
    return bot.sendMessage(chatId, '🚫 Доступ запрещён. Обратитесь к администратору.');
  }

  if (msg.text === '/start') {
    const keyboard = [
      ['Все заказы'],
      ['Новые заказы', 'В работе']
    ];
    bot.sendMessage(chatId, 'Привет! Выберите действие:', {
      reply_markup: {
        keyboard,
        resize_keyboard: true
      }
    });
  }
});

// Команда: Все заказы (new + in_progress)
bot.onText(/^Все заказы$/, (msg) => {
  const chatId = msg.chat.id.toString();
  if (!isAuthorized(chatId)) {
    return bot.sendMessage(chatId, '🚫 Доступ запрещён.');
  }

  const list = Array.from(orders.values()).filter(o => 
    o.status === 'new' || o.status === 'in_progress'
  );

  if (list.length === 0) {
    return bot.sendMessage(chatId, 'Заказов нет.');
  }

  list.forEach(o => {
    const text = `
📋 Заказ ${o.id}
Имя: ${o.customer_name}
Адрес: ${o.address}
Телефон: ${o.phone}
Статус: ${STATUS_LABEL[o.status]}
    `.trim();

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

// Команда: Новые заказы
bot.onText(/^Новые заказы$/, (msg) => {
  const chatId = msg.chat.id.toString();
  if (!isAuthorized(chatId)) {
    return bot.sendMessage(chatId, '🚫 Доступ запрещён.');
  }

  const list = Array.from(orders.values()).filter(o => o.status === 'new');
  if (list.length === 0) {
    return bot.sendMessage(chatId, 'Нет новых заказов.');
  }

  list.forEach(o => {
    const text = `
📋 Заказ ${o.id}
Имя: ${o.customer_name}
Адрес: ${o.address}
Телефон: ${o.phone}
Статус: ${STATUS_LABEL[o.status]}
    `.trim();

    bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: 'Взять в работу', callback_data: `get_${o.id}` }]]
      }
    });
  });
});

// Команда: В работе
bot.onText(/^В работе$/, (msg) => {
  const chatId = msg.chat.id.toString();
  if (!isAuthorized(chatId)) {
    return bot.sendMessage(chatId, '🚫 Доступ запрещён.');
  }

  const list = Array.from(orders.values()).filter(o => o.status === 'in_progress');
  if (list.length === 0) {
    return bot.sendMessage(chatId, 'Нет заказов в работе.');
  }

  list.forEach(o => {
    const text = `
📋 Заказ ${o.id}
Имя: ${o.customer_name}
Адрес: ${o.address}
Телефон: ${o.phone}
Статус: ${STATUS_LABEL[o.status]}
    `.trim();

    bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: 'Завершить заказ', callback_data: `done_${o.id}` }]]
      }
    });
  });
});

// Обработка нажатий на inline-кнопки
bot.on('callback_query', async (q) => {
  const chatId = q.message.chat.id.toString();
  if (!isAuthorized(chatId)) {
    return bot.answerCallbackQuery(q.id, {
      text: 'У вас нет доступа к этому боту.',
      show_alert: true
    });
  }

  const [action, id] = q.data.split('_');
  const o = orders.get(id);

  if (!o) {
    return bot.answerCallbackQuery(q.id, {
      text: 'Заказ не найден',
      show_alert: true
    });
  }

  if (action === 'get' && o.status === 'new') {
    o.status = 'in_progress';
  } else if (action === 'done' && o.status === 'in_progress') {
    o.status = 'completed';
  } else {
    return bot.answerCallbackQuery(q.id, {
      text: 'Невозможно выполнить',
      show_alert: true
    });
  }

  orders.set(id, o);

  const text = `
📋 Заказ ${o.id}
Имя: ${o.customer_name}
Адрес: ${o.address}
Телефон: ${o.phone}
Статус: ${STATUS_LABEL[o.status]}${o.status === 'completed' ? ' ✅' : ''}
  `.trim();

  const buttons = [];
  if (o.status === 'new') {
    buttons.push([{ text: 'Взять в работу', callback_data: `get_${o.id}` }]);
  } else if (o.status === 'in_progress') {
    buttons.push([{ text: 'Завершить заказ', callback_data: `done_${o.id}` }]);
  }

  await bot.editMessageText(text, {
    chat_id: q.message.chat.id,
    message_id: q.message.message_id,
    parse_mode: 'HTML',
    reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : undefined
  });

  bot.answerCallbackQuery(q.id);
});

// HTTP-эндпоинт для приёма новых заказов
app.post('/order', async (req, res) => {
  const o = req.body;

  // Валидация обязательных полей
  if (!o?.id || !o.customer_name || !o.phone || !o.address || !o.total || !Array.isArray(o.cart)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Неверный формат заказа' 
    });
  }

  // Установка статуса
  o.status = 'new';
  orders.set(o.id, o);

  // Формируем список товаров
  let cartText = '';
  o.cart.forEach((it, i) => {
    const unitLabel = it.unit === 'Kilogram' ? 'кг' : 'шт';
    cartText += `${i + 1}) ${it.name} — ${it.quantity}${unitLabel} × ${it.price}₽ = ${(it.quantity * it.price).toFixed(2)}₽\n`;
  });

  // Подготовка дополнительных полей
  const commentText = o.comment ? `\n💬 Комментарий: ${o.comment}` : '';
  const deliveryText = o.deliveryTime ? `\n⏰ Время доставки: ${o.deliveryTime}` : '';

  // Полное сообщение в Telegram
  const msg = `
🛒 <b>Новый заказ</b>

🧾 Номер: <code>${o.id}</code>
👤 Имя: ${o.customer_name}
🏠 Адрес: ${o.address}
📞 Телефон: ${o.phone}
 ${deliveryText}
 ${commentText}

📦 <b>Корзина:</b>
${cartText}

💰 <b>Итого:</b> ${o.total.toFixed(2)}₽
📌 Статус: ${STATUS_LABEL[o.status]}
  `.trim();

  try {
    // Отправляем всем разрешённым чатам
    await Promise.all(
      ALLOWED_CHAT_IDS.map(chatId =>
        bot.sendMessage(chatId, msg, { parse_mode: 'HTML' }).catch(err => {
          console.error(`Ошибка отправки в чат ${chatId}:`, err.message);
        })
      )
    );

    res.status(200).json({ message: 'Заказ успешно обработан' });
  } catch (e) {
    console.error('Ошибка отправки сообщения в Telegram:', e);
    res.status(500).json({ success: false, message: 'Ошибка отправки уведомления' });
  }
});
}
