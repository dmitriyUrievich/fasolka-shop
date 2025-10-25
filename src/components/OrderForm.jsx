// src/components/OrderForm.js
import React, { useState, useCallback } from 'react';
import './../OrderForm.css';
import YandexMap from './YandexMap';
import '../YandexMap.css';
const OrderForm = ({ onSubmit, onClose, totalAmount }) => {
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [comment, setComment] = useState('');
  const [deliveryTime, setDeliveryTime] = useState(''); // теперь это строка-интервал
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddressInZone, setIsAddressInZone] = useState(false);

  const timeSlots = [
    '9:00–12:00',
    '12:00–15:00',
    '15:00–18:00',
    '18:00–21:00',
  ];

  const validate = useCallback(() => {
    const newErrors = {};
    if (!customerName.trim()) newErrors.name = 'Введите имя.';
    if (!phoneNumber.trim()) {
      newErrors.phone = 'Введите телефон.';
    } else if (!/^\+?\d{9,15}$/.test(phoneNumber.replace(/\D/g, ''))) {
      newErrors.phone = 'Некорректный номер.';
    }
    if (!address.trim()) newErrors.address = 'Введите адрес.';

    if (!isAddressInZone) newErrors.address = 'Адрес должен быть в зоне доставки.';
    
  if (!deliveryTime) newErrors.deliveryTime = 'Выберите интервал доставки.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [customerName, phoneNumber, address, deliveryTime,isAddressInZone]);
  // Стандартный обработчик отправки формы
  const handleSubmit = async (e) => {
    e.preventDefault(); 
    if (!validate() || !isAddressInZone) {
      if(!isAddressInZone) alert("Пожалуйста, укажите адрес в зоне доставки.");
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
    <div className="order-form-header"> {/* 🔥 Новый контейнер-обёртка */}
        <h2 id="form-title">Оформление заказа</h2>
        <button type="button" onClick={onClose} className="close-button" aria-label="Закрыть">
            &times;
        </button>
    </div>
      <form onSubmit={handleSubmit}>     
        <div className="form-group">
          <label htmlFor="customerName">Имя:</label>
          <input type="text" id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={errors.name ? 'input-error' : ''} autoComplete="name" required />
          {errors.name && <span className="error-message">{errors.name}</span>}
        </div>
        <div className="form-group">
          <label htmlFor="phoneNumber">Телефон:</label>
          <input type="tel" id="phoneNumber" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d+]/g, ''))} className={errors.phone ? 'input-error' : ''} autoComplete="tel" required />
          {errors.phone && <span className="error-message">{errors.phone}</span>}
        </div>
        <div className="form-group">
          <label htmlFor="address">Адрес:</label>
          <input type="text" id="address" value={address} onChange={(e) => setAddress(e.target.value)} className={errors.address ? 'input-error' : ''} autoComplete="street-address" required />
          {errors.address && <span className="error-message">{errors.address}</span>}
        </div>
        <div className="form-group">
          <label htmlFor="comment">Комментарий к заказу, по желанию:</label>
          <textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} className="textarea-input" rows="3" placeholder="Например: оставить у двери." />
        </div>
        <div className="form-group">
          <label htmlFor="deliveryTime">Желаемое время доставки</label>
          <select id="deliveryTime" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} className={errors.deliveryTime ? 'input-error' : ''} required >
            <option value="">Выберите интервал</option>
            {timeSlots.map((slot) => (<option key={slot} value={slot}>{slot}</option>))}
          </select>
          {errors.deliveryTime && (<span className="error-message">{errors.deliveryTime}</span>)}
        </div>

        <div className='map-section'>
          <YandexMap
            address={address}
            onZoneCheck={setIsAddressInZone}
            center={[44.665, 37.79]}
            zoom={12}
            placemark={[44.67590828940214,37.64249692460607]}
            kmlUrl="/map.kml"
          />
        </div>
         <div className="form-agreement-text">
          Нажимая «Перейти к оплате», вы соглашаетесь с условиями{' '}
          <a href="/user-agreement.pdf" target="_blank" rel="noopener noreferrer">
            Пользовательского соглашения
          </a>{' '}
          и{' '}
          <a href="/privacy-policy.pdf" target="_blank" rel="noopener noreferrer">
            Политикой конфиденциальности
          </a>.
        </div>
        <div className="form-actions">        
          <button
            type="submit"
            className="submit-button"
            disabled={isSubmitting || !isAddressInZone}
          >
            {isSubmitting ? 'Отправка...' : `Перейти к оплате ${totalAmount.toFixed(2)} ₽`}
          </button>
        </div>
      </form>
    </div>
  );
};

export default React.memo(OrderForm);