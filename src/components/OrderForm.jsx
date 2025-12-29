import React, { useState, useCallback, useMemo, useEffect } from 'react';
import './../OrderForm.css';
import YandexMap from './YandexMap';
import '../YandexMap.css';

const OrderForm = ({ onSubmit, onClose, totalAmount }) => {
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+7');
  const [address, setAddress] = useState('');
  const [comment, setComment] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddressInZone, setIsAddressInZone] = useState(false);

  const timeSlots = ['10:00–12:00', '12:00–15:00', '15:00–18:00', '18:00–20:00'];

  // 1. ЛОГИКА ВАЛИДАЦИИ (собираем все ошибки в один объект)
  const formErrors = useMemo(() => {
    const errors = {};
    
    if (customerName.trim() && customerName.trim().length < 2) {
      errors.name = 'Имя слишком короткое';
    } else if (!customerName.trim()) {
      errors.name = 'Введите имя';
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 11) {
      errors.phone = 'Введите номер полностью';
    }

    if (address.trim() && !isAddressInZone) {
      errors.address = 'Этот адрес вне зоны доставки';
    } else if (!address.trim()) {
      errors.address = 'Введите адрес доставки';
    }

    if (!deliveryTime) {
      errors.deliveryTime = 'Выберите время';
    }

    return errors;
  }, [customerName, phoneNumber, address, isAddressInZone, deliveryTime]);

  // Проверка: валидна ли форма (нет ли ключей в объекте ошибок)
  const isFormValid = Object.keys(formErrors).length === 0;

  const handlePhoneChange = (e) => {
    const input = e.target.value;
    if (!input.startsWith('+7')) {
      setPhoneNumber('+7');
      return;
    }
    const digits = input.slice(2).replace(/\D/g, '').slice(0, 10);
    setPhoneNumber('+7' + digits);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    await onSubmit({
      name: customerName,
      phone: phoneNumber,
      address,
      comment: comment.trim(),
      deliveryTime,
    });
    setIsSubmitting(false);
  };

  return (
    <div className="order-form-container">
      <div className="order-form-header">
        <h2>Оформление заказа</h2>
        <button type="button" onClick={onClose} className="close-button">&times;</button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Имя */}
        <div className={`form-group ${formErrors.name ? 'has-error' : ''}`}>
          <label>Имя:</label>
          <input 
            type="text" 
            value={customerName} 
            onChange={(e) => setCustomerName(e.target.value)} 
          />
          {formErrors.name && <span className="error-message">{formErrors.name}</span>}
        </div>

        {/* Телефон */}
        <div className={`form-group ${formErrors.phone ? 'has-error' : ''}`}>
          <label>Телефон:</label>
          <input 
            type="tel" 
            value={phoneNumber} 
            onChange={handlePhoneChange} 
          />
          {formErrors.phone && <span className="error-message">{formErrors.phone}</span>}
        </div>

        {/* Адрес */}
        <div className={`form-group ${formErrors.address ? 'has-error' : ''}`}>
          <label>Адрес доставки:</label>
          <input 
            type="text" 
            value={address} 
            onChange={(e) => setAddress(e.target.value)} 
          />
          {formErrors.address && <span className="error-message">{formErrors.address}</span>}
        </div>

        {/* Время */}
        <div className={`form-group ${formErrors.deliveryTime ? 'has-error' : ''}`}>
          <label>Время доставки:</label>
          <select value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)}>
            <option value="">Выберите интервал</option>
            {timeSlots.map(slot => <option key={slot} value={slot}>{slot}</option>)}
          </select>
          {formErrors.deliveryTime && <span className="error-message">{formErrors.deliveryTime}</span>}
        </div>

        <div className="map-section">
          <YandexMap
            address={address}
            onZoneCheck={setIsAddressInZone}
            center={[44.665, 37.79]}
            zoom={12}
            kmlUrl="/map.kml"
          />
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className={`submit-button ${!isFormValid ? 'button-disabled' : ''}`}
            disabled={!isFormValid || isSubmitting}
          >
            {isSubmitting ? 'Оформляем...' : `Оплатить ${totalAmount.toFixed(2)} ₽`}
          </button>
        </div>
      </form>
    </div>
  );
};

export default OrderForm;