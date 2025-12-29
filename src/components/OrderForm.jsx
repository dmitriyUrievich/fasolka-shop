// src/components/OrderForm.js
import React, { useState, useCallback, useEffect } from 'react';
import './../OrderForm.css';
import YandexMap from './YandexMap';
import '../YandexMap.css';

const OrderForm = ({ onSubmit, onClose, totalAmount }) => {
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+7');
  const [address, setAddress] = useState('');
  const [comment, setComment] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddressInZone, setIsAddressInZone] = useState(false);

  const timeSlots = [
    '10:00–12:00',
    '12:00–15:00',
    '15:00–18:00',
    '18:00–20:00',
  ];
// 1. Обработка ввода телефона (всегда начинается с +7)
  const handlePhoneChange = (e) => {
    const input = e.target.value;
    if (!input.startsWith('+7')) {
      setPhoneNumber('+7');
      return;
    }
    // Оставляем только цифры после +7 и ограничиваем до 10 штук
    const digits = input.slice(2).replace(/\D/g, '').slice(0, 10);
    setPhoneNumber('+7' + digits);
  };

  // 2. Валидация в реальном времени через useMemo
  const validation = useMemo(() => {
    if (!customerName.trim()) return { isValid: false, error: 'Введите ваше имя' };
    if (phoneNumber.length < 12) return { isValid: false, error: 'Введите полный номер телефона' };
    if (!address.trim()) return { isValid: false, error: 'Введите адрес доставки' };
    if (!isAddressInZone) return { isValid: false, error: 'Адрес вне зоны доставки (см. карту)' };
    if (!deliveryTime) return { isValid: false, error: 'Выберите интервал доставки' };
    
    return { isValid: true, error: null };
  }, [customerName, phoneNumber, address, isAddressInZone, deliveryTime]);

  // 3. Отправка формы
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validation.isValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: customerName,
        phone: phoneNumber,
        address,
        comment: comment.trim() || null,
        deliveryTime: deliveryTime || null,
      });
    } catch (error) {
      console.error("Ошибка формы:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="order-form-container">
      <div className="order-form-header">
        <h2 id="form-title">Оформление заказа</h2>
        <button type="button" onClick={onClose} className="close-button" aria-label="Закрыть">
          &times;
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* Имя */}
        <div className="form-group">
          <label htmlFor="customerName">Имя:</label>
          <input
            type="text"
            id="customerName"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Ваше имя"
            required
          />
        </div>

        {/* Телефон */}
        <div className="form-group">
          <label htmlFor="phoneNumber">Телефон:</label>
          <input
            type="tel"
            id="phoneNumber"
            value={phoneNumber}
            onChange={handlePhoneChange}
            required
          />
        </div>

        {/* Адрес */}
        <div className="form-group">
          <label htmlFor="address">Адрес:</label>
          <input
            type="text"
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Улица, дом, квартира"
            required
          />
        </div>

        {/* Время доставки */}
        <div className="form-group">
          <label htmlFor="deliveryTime">Желаемое время доставки:</label>
          <select
            id="deliveryTime"
            value={deliveryTime}
            onChange={(e) => setDeliveryTime(e.target.value)}
            required
          >
            <option value="">Выберите интервал</option>
            {timeSlots.map((slot) => (
              <option key={slot} value={slot}>{slot}</option>
            ))}
          </select>
        </div>

        {/* Карта */}
        <div className="map-section">
          <YandexMap
            address={address}
            onZoneCheck={setIsAddressInZone}
            center={[44.665, 37.79]}
            zoom={12}
            kmlUrl="/map.kml"
          />
        </div>

        {/* Комментарий */}
        <div className="form-group">
          <label htmlFor="comment">Комментарий (необязательно):</label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows="2"
            placeholder="Код домофона, подъезд..."
          />
        </div>

        {/* Футер с кнопкой и ошибкой */}
        <div className="form-actions-footer">
          {/* Показываем ошибку только если пользователь начал что-то вводить и форма не валидна */}
          {!validation.isValid && (address || customerName) && (
            <div className="validation-error-bubble">
              {validation.error}
            </div>
          )}

          <button
            type="submit"
            className={`submit-button ${!validation.isValid ? 'disabled' : ''}`}
            disabled={!validation.isValid || isSubmitting}
          >
            {isSubmitting ? 'Загрузка...' : `Перейти к оплате ${totalAmount.toFixed(2)} ₽`}
          </button>

          <p className="legal-info-mini">
            Нажимая «Перейти к оплате», вы принимаете условия соглашения.
          </p>
        </div>
      </form>
    </div>
  );
};

export default React.memo(OrderForm);