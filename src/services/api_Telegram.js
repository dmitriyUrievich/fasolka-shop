// Файл: src/services/api_Telegram.js

import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || '').split(',').map(id => id.trim()).filter(id => id);
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

const ASSEMBLY_ORDERS_PATH = path.join(process.cwd(), 'assemblyOrders.json');
const COMPLETED_ORDERS_PATH = path.join(process.cwd(), 'orders.json');

// --- Вспомогательные функции для работы с файлами-БД ---
const readFile = (filePath) => {
    if (!fs.existsSync(filePath)) return {};
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return data ? JSON.parse(data) : {};
    } catch (error) {
        console.error(`Ошибка чтения файла ${filePath}:`, error);
        return {};
    }
};
const writeFile = (filePath, data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// --- Инициализация бота и состояния ---
const bot = new TelegramBot(TOKEN, { polling: true });

// { chatId: { action: 'adjust_weight', orderId: '...', itemIndex: '...', messageId: '...' } }
const userState = {};

const buildAssemblyMessageAndOptions = (orderData) => {
    const cartText = orderData.cart.map((item, i) => {
        const isWeighted = item.unit === 'Kilogram';
        const quantityLabel = isWeighted ? `${(item.quantity * 1000).toFixed(0)} гр.` : `${item.quantity} шт.`;
        const originalLabel = isWeighted && item.originalQuantity ? ` (было ~${(item.originalQuantity * 1000).toFixed(0)} гр.)` : (isWeighted ? ` (заказано ~${(item.quantity * 1000).toFixed(0)} гр.)` : '');
        return `${i + 1}) ${item.name} — <b>${quantityLabel}</b>${originalLabel}`;
    }).join('\n');
    
    const finalTotal = orderData.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const message = `
        🛒 <b>Заказ на сборку:</b> <code>${orderData.id}</code>
        👤 ${orderData.customer_name}, ${orderData.phone}
        🏠 ${orderData.address}
        ⏰ ${orderData.deliveryTime || 'Не указано'}
        ${orderData.comment ? `\n💬 Комментарий: ${orderData.comment}`: ''}

        📦 <b>Корзина:</b>
        ${cartText}

        💰 <b>Итого к списанию: ~${finalTotal.toFixed(2)} ₽</b>
        <i>(Заморожено на карте: ${Number(orderData.totalWithReserve).toFixed(2)} ₽)</i>
    `.trim();

  // можно зарегистрировать чеки без ккт, это способ без офд(), в настройках ккт в раздел и там меняете на без ккт (при закрытии есть чеки не зарегистрированные, будет расхождение, нужно отказаться от чека коррекции, нужно обнулить )
  // раз в неделю ручным актом списания 

    const buttons = orderData.cart
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.unit === 'Kilogram')
        .map(({ item, index }) => ([{
            text: `⚖️ Изменить: ${item.name.substring(0, 25)}...`,
            callback_data: `adjust_${orderData.id}_${index}`
        }]));
        
    buttons.push([{ text: '✅ Подтвердить и списать', callback_data: `capture_${orderData.id}` }]);

    return { message, options: { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } } };
};


/** Создает текст и кнопки для УЖЕ ОПЛАЧЕННОГО заказа */
const buildPaidOrderMessageAndOptions = (orderData) => {
    const STATUS_LABEL = { new: 'Новый', in_progress: 'В работе', completed: 'Завершён' };
    const cartText = orderData.cart.map((item, i) =>
        `${i + 1}) ${item.name} — ${item.quantity} ${item.unit === 'Kilogram' ? 'кг' : 'шт.'} × ${item.price}₽`
    ).join('\n');

    const message = `
${orderData.status === 'completed' ? '✅ <b>Заказ ЗАВЕРШЁН</b>' : '📋 <b>Заказ в работе</b>'}
🧾 Номер: <code>${orderData.id}</code>
👤 Имя: ${orderData.customer_name}
📞 Телефон: ${orderData.phone}
🏠 Адрес: ${orderData.address}
📌 Статус: <b>${STATUS_LABEL[orderData.status]}</b>

📦 <b>Корзина:</b>
${cartText}
💰 <b>Списано: ${orderData.total.toFixed(2)} ₽</b>
    `.trim();

    let buttons = [];
    if (orderData.status === 'new') {
        buttons.push([{ text: 'Взять в работу', callback_data: `get_${orderData.id}` }]);
    } else if (orderData.status === 'in_progress') {
        buttons.push([{ text: 'Завершить заказ', callback_data: `done_${orderData.id}` }]);
    }

    return { message, options: { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } } };
};


// --- Функции, вызываемые извне (из YooKassa.js) ---

export const sendOrderForAssemblyNotification = async (orderData) => {
    const { message, options } = buildAssemblyMessageAndOptions(orderData);
    for (const chatId of ALLOWED_CHAT_IDS) {
        await bot.sendMessage(chatId, message, options);
    }
};

export const sendPaidOrderNotification = async (finalOrderData) => {
    let orders = readFile(COMPLETED_ORDERS_PATH);
    // Сразу сохраняем финальные данные и статус "new"
    orders[finalOrderData.id] = { ...finalOrderData, status: 'new' };
    writeFile(COMPLETED_ORDERS_PATH, orders);

    // --- Новый, более правильный конструктор сообщения ---
    const cartText = finalOrderData.cart.map((item, i) =>
        `${i + 1}) ${item.name} — ${item.quantity} ${item.unit === 'Kilogram' ? 'кг' : 'шт.'} × ${item.price}₽`
    ).join('\n');

    const message = `
      ✅ <b>Поступил новый Заказ</b>
      🧾 Номер: <code>${finalOrderData.id}</code>
      👤 Имя: ${finalOrderData.customer_name}
      📞 Телефон: ${finalOrderData.phone}
      🏠 Адрес: ${finalOrderData.address}
      📌 Статус: <b>Новый</b>

      📦 <b>Корзина:</b>
      ${cartText}
      💰 <b>Списано: ${finalOrderData.total.toFixed(2)} ₽</b>
    `.trim();

    const options = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [[{ text: 'Взять в работу', callback_data: `get_${finalOrderData.id}` }]]
        }
    };

    for (const chatId of ALLOWED_CHAT_IDS) {
        await bot.sendMessage(chatId, message, options);
    }
};

// --- Внутренняя логика бота ---

const capturePayment = async (orderId) => {
    const assemblyOrders = readFile(ASSEMBLY_ORDERS_PATH);
    const orderData = assemblyOrders[orderId];
    if (!orderData) throw new Error('Заказ уже обработан или не найден');
    await axios.post(`${API_BASE_URL}/api/payment/capture`, { orderId, finalCart: orderData.cart });
};


export default function initializeBot(syncProductsFromApi) {
    /**
     * Обработчик текстовых сообщений (для ввода веса и команд)
     */
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id.toString();
        if (!ALLOWED_CHAT_IDS.includes(chatId)) {
        return bot.sendMessage(chatId, '🚫 Доступ запрещён.');
    }
        const state = userState[chatId];

        // --- Логика ввода веса ---
        if (state && state.action === 'adjust_weight') {
            const newWeightGrams = parseInt(msg.text, 10);
            if (isNaN(newWeightGrams) || newWeightGrams < 0) {
                bot.sendMessage(chatId, '❌ Неверный формат. Введите вес в ГРАММАХ (например, 450 или 1200).');
                return;
            }
            const newWeightKg = newWeightGrams / 1000; // Конвертируем в КГ для расчетов

            const { orderId, itemIndex, messageId } = state;
            const assemblyOrders = readFile(ASSEMBLY_ORDERS_PATH);
            const order = assemblyOrders[orderId];

            if (order) {
                const item = order.cart[itemIndex];
                if (item.originalQuantity === undefined) item.originalQuantity = item.quantity;
                item.quantity = newWeightKg;
                writeFile(ASSEMBLY_ORDERS_PATH, assemblyOrders);
                
                const { message, options } = buildAssemblyMessageAndOptions(order);
                try {
                    await bot.editMessageText(message, { chat_id: chatId, message_id: messageId, ...options });
                    bot.sendMessage(chatId, `✅ Вес для "${item.name}" обновлен на ${newWeightGrams} гр.`);
                } catch (e) { /* Игнорируем ошибку, если сообщение не изменилось */ }
            }
            delete userState[chatId];
            return;
        }

        // --- Обработка команд ---
        if (msg.text === '/start') {
            const keyboard = [['Все заказы'], ['Новые заказы', 'В работе']];
            bot.sendMessage(chatId, 'Привет! Выберите действие:', { reply_markup: { keyboard, resize_keyboard: true } });
        }

        if (msg.text === '/sync') {
            await bot.sendMessage(chatId, '🚀 Начинаю синхронизацию товаров с Контур.Маркет...');
            
            const result = await syncProductsFromApi();

            if (result.success) {
                await bot.sendMessage(chatId, `✅ Синхронизация успешно завершена. ${result.message}`);
            } else {
                await bot.sendMessage(chatId, `❌ Произошла ошибка во время синхронизации: ${result.message}`);
            }
            return;
        }

    });
    
    bot.on('callback_query', async (q) => {
        const chatId = q.message.chat.id.toString();
        if (!ALLOWED_CHAT_IDS.includes(chatId)) {
            return bot.answerCallbackQuery(q.id, { text: '🚫 У вас нет доступа.', show_alert: true });
        }

        const [action, orderId, itemIndexStr] = q.data.split('_');

        // --- БЛОК 1: Логика для заказов НА СБОРКЕ ---
        if (action === 'adjust' || action === 'capture') {
            const assemblyOrders = readFile(ASSEMBLY_ORDERS_PATH);
            const orderData = assemblyOrders[orderId];

            if (!orderData) {
                return bot.answerCallbackQuery(q.id, { text: 'Этот заказ уже подтвержден или не найден.', show_alert: true });
            }

            if (action === 'adjust') {
                const itemIndex = parseInt(itemIndexStr, 10);
                const item = orderData.cart[itemIndex];
                if (!item) return bot.answerCallbackQuery(q.id, { text: 'Товар в заказе не найден.', show_alert: true });
                
                userState[chatId] = { action: 'adjust_weight', orderId, itemIndex, messageId: q.message.message_id };
                bot.answerCallbackQuery(q.id);
                bot.sendMessage(chatId, `✏️ Введите точный вес в ГРАММАХ для товара "${item.name}":`);
            }
            
            if (action === 'capture') {
                try {
                    await bot.answerCallbackQuery(q.id, { text: 'Отправляю запрос на списание...' });
                    await capturePayment(orderId);
                    await bot.editMessageText(`✅ Заказ №${orderId} успешно оплачен и передан в работу.`, { chat_id: chatId, message_id: q.message.message_id });
                } catch (error) {
                    bot.answerCallbackQuery(q.id, { text: `⚠️ Ошибка: ${error.message}`, show_alert: true });
                }
            }
            return; // Завершаем выполнение, так как действие обработано
        }

        // --- БЛОК 2: Логика для ОПЛАЧЕННЫХ заказов ---
        if (action === 'get' || action === 'done') {
            const orders = readFile(COMPLETED_ORDERS_PATH);
            const order = orders[orderId];

            if (!order) {
                return bot.answerCallbackQuery(q.id, { text: 'Заказ не найден в списке оплаченных.', show_alert: true });
            }
            
            if (action === 'get') {
                order.status = 'in_progress';
            } else if (action === 'done') {
                order.status = 'completed';
            }

            writeFile(COMPLETED_ORDERS_PATH, orders);
            
            const { message, options } = buildPaidOrderMessageAndOptions(order);
            await bot.editMessageText(message, { chat_id: chatId, message_id: q.message.message_id, ...options });
            bot.answerCallbackQuery(q.id);
            return; // Завершаем выполнение
        }

        // Если действие не подошло ни под одну категорию
        bot.answerCallbackQuery(q.id, { text: 'Неизвестное действие.', show_alert: true });
    });

    /**
     * Обработчики кнопок-команд для просмотра оплаченных заказов
     */
    const createOrderListHandler = (filterFn, emptyMessage) => (msg) => {
        const chatId = msg.chat.id.toString();
        const orders = readFile(COMPLETED_ORDERS_PATH);
        const list = Object.values(orders).filter(filterFn);
        if (list.length === 0) {
            bot.sendMessage(chatId, emptyMessage);
            return;
        }
        list.forEach(order => {
            const { message, options } = buildPaidOrderMessageAndOptions(order);
            bot.sendMessage(chatId, message, options);
        });
    };

    bot.onText(/^Все заказы$/, createOrderListHandler(
        o => o.status === 'new' || o.status === 'in_progress',
        'Активных заказов нет.'
    ));
    bot.onText(/^Новые заказы$/, createOrderListHandler(
        o => o.status === 'new',
        'Нет новых заказов.'
    ));
    bot.onText(/^В работе$/, createOrderListHandler(
        o => o.status === 'in_progress',
        'Нет заказов в работе.'
    ));
}