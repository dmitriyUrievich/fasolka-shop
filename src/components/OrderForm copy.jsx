// src/components/OrderForm.js
import React, { useState, useCallback, useEffect } from 'react';
import './../OrderForm.css';
import YandexMap from './YandexMap';
import '../YandexMap.css';

const OrderForm = ({ onSubmit, onClose, totalAmount }) => {
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
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

  // Очистка ошибки конкретного поля при изменении его значения
  const clearError = (field) => {
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = useCallback(() => {
    const newErrors = {};
    
    // Валидация имени
    if (!customerName.trim()) {
      newErrors.name = 'Пожалуйста, введите ваше имя';
    }

    // Валидация телефона (минимум 11 цифр для корректной работы API)
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (!cleanPhone) {
      newErrors.phone = 'Введите номер телефона';
    } else if (cleanPhone.length < 11) {
      newErrors.phone = 'Номер слишком короткий (минимум 11 цифр)';
    }

    // Валидация адреса
    if (!address.trim()) {
      newErrors.address = 'Введите адрес доставки';
    } else if (!isAddressInZone) {
      newErrors.address = 'Этот адрес находится вне зоны нашей доставки';
    }
    
    // Валидация времени
    if (!deliveryTime) {
      newErrors.deliveryTime = 'Выберите удобный интервал доставки';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [customerName, phoneNumber, address, deliveryTime, isAddressInZone]);

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    
    if (!validate()) {
      // Скролл к первой ошибке (опционально)
      return;
    }

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
        console.error("Ошибка при обработке формы:", error);
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
        {/* Поле: Имя */}
        <div className={`form-group ${errors.name ? 'has-error' : ''}`}>
          <label htmlFor="customerName">Имя:</label>
          <input 
            type="text" 
            id="customerName" 
            value={customerName} 
            onChange={(e) => { setCustomerName(e.target.value); clearError('name'); }} 
            className={errors.name ? 'input-error' : ''} 
            placeholder="Иван Иванов"
            required 
          />
          {errors.name && <span className="error-message">{errors.name}</span>}
        </div>

        {/* Поле: Телефон */}
        <div className={`form-group ${errors.phone ? 'has-error' : ''}`}>
          <label htmlFor="phoneNumber">Телефон:</label>
          <input 
            type="tel" 
            id="phoneNumber" 
            value={phoneNumber} 
            onChange={(e) => { setPhoneNumber(e.target.value); clearError('phone'); }} 
            className={errors.phone ? 'input-error' : ''} 
            placeholder="+7 (999) 000-00-00"
            required 
          />
          {errors.phone && <span className="error-message">{errors.phone}</span>}
        </div>

        {/* Поле: Адрес */}
        <div className={`form-group ${errors.address ? 'has-error' : ''}`}>
          <label htmlFor="address">Адрес:</label>
          <input 
            type="text" 
            id="address" 
            value={address} 
            onChange={(e) => { setAddress(e.target.value); clearError('address'); }} 
            className={errors.address ? 'input-error' : ''} 
            placeholder="Улица, дом, квартира"
            required 
          />
          {errors.address && <span className="error-message">{errors.address}</span>}
        </div>

        {/* Комментарий */}
        <div className="form-group">
          <label htmlFor="comment">Комментарий к заказу:</label>
          <textarea 
            id="comment" 
            value={comment} 
            onChange={(e) => setComment(e.target.value)} 
            className="textarea-input" 
            rows="2" 
            placeholder="Например: код домофона или где оставить пакет" 
          />
        </div>

        {/* Время доставки */}
        <div className={`form-group ${errors.deliveryTime ? 'has-error' : ''}`}>
          <label htmlFor="deliveryTime">Желаемое время доставки:</label>
          <select 
            id="deliveryTime" 
            value={deliveryTime} 
            onChange={(e) => { setDeliveryTime(e.target.value); clearError('deliveryTime'); }} 
            className={errors.deliveryTime ? 'input-error' : ''} 
            required 
          >
            <option value="">Выберите интервал</option>
            {timeSlots.map((slot) => (<option key={slot} value={slot}>{slot}</option>))}
          </select>
          {errors.deliveryTime && (<span className="error-message">{errors.deliveryTime}</span>)}
        </div>

        {/* Карта */}
        <div className='map-section'>
          <YandexMap
            address={address}
            onZoneCheck={(isInZone) => {
              setIsAddressInZone(isInZone);
              if (isInZone) clearError('address');
            }}
            center={[44.665, 37.79]}
            zoom={12}
            placemark={[44.67590828940214, 37.64249692460607]}
            kmlUrl="/map.kml"
          />
        </div>

        <div className="form-agreement-text">
          Нажимая «Перейти к оплате», вы соглашаетесь с условиями{' '}
          <a href="/user-agreement.pdf" target="_blank" rel="noopener noreferrer">Пользовательского соглашения</a>
          {' '}и{' '}
          <a href="/privacy-policy.pdf" target="_blank" rel="noopener noreferrer">Политикой конфиденциальности</a>.
        </div>

        <div className="form-actions">        
          <button
            type="submit"
            className={`submit-button ${!isAddressInZone ? 'disabled' : ''}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Оформляем...' : `Перейти к оплате ${totalAmount.toFixed(2)} ₽`}
          </button>
          {!isAddressInZone && address.trim() && !errors.address && (
            <p className="hint-message">Укажите адрес внутри зеленой зоны на карте</p>
          )}
        </div>
      </form>
    </div>
  );
};

export default React.memo(OrderForm);