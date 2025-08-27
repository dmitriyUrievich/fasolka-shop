// utils/orderUtils.js

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