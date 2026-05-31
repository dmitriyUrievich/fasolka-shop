// utils/orderUtils.js
export const calculateOrderTotals = (cartItems) => {
  let subtotal = 0;
  let totalWithReserve = 0;

  cartItems.forEach(item => {
    // Преобразуем цену "123,45" в число 123.45
    const price = typeof item.sellPricePerUnit === 'string'
        ? parseFloat(item.sellPricePerUnit.replace(',', '.'))
        : item.sellPricePerUnit;

    const itemTotal = price * item.quantityInCart;
    subtotal += itemTotal;

    // Резерв 15% для весового товара
    totalWithReserve += (item.unit === 'Kilogram') ? itemTotal * 1.15 : itemTotal;
  });

  // Логика доставки
  let deliveryCost = 0;
  if (subtotal > 0 && subtotal < 3000) {
    deliveryCost = 200;
  }

  return {
    subtotal,
    totalWithReserve,
    deliveryCost,
    finalAmountForPayment: totalWithReserve + deliveryCost
  };
};

export const generateDailyOrderId = () => {
  const now = new Date();
  const today = now.toISOString().split('T')[0]; // Формат "YYYY-MM-DD"

  // Получаем сохранённые данные из localStorage
  const stored = localStorage.getItem('dailyOrderState');
  let state = null;

  try {
    if (stored) {
      state = JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to parse dailyOrderState from localStorage', e);
  }

  // Проверяем, новый ли день
  let currentNumber;
  if (state && state.date === today) {
    // Тот же день — продолжаем счёт
    currentNumber = state.lastNumber;
  } else {
    // Новый день — генерируем случайное число от 1 до 1000
    currentNumber = Math.floor(Math.random() * 1000) + 1;
  }

  // Увеличиваем номер (с переполнением: 1000 → 1)
  const nextNumber = currentNumber === 1000 ? 1 : currentNumber + 1;

  // Сохраняем новое состояние
  const newState = {
    date: today,
    lastNumber: nextNumber,
  };

  try {
    localStorage.setItem('dailyOrderState', JSON.stringify(newState));
  } catch (e) {
    console.warn('Failed to save dailyOrderState to localStorage', e);
  }

  return `${currentNumber}`;
};