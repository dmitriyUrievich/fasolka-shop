// src/components/OrderForm.js
import React, { useState, useCallback } from 'react';
import './../OrderForm.css';
import YandexMap from './YandexMap';
import '../YandexMap.css';
import {Select} from "../ui/Select.jsx";
import {Textarea} from "../ui/Textarea.jsx";
import {InputField} from "../ui/InputField.jsx";

const OrderForm = ({ onSubmit, onClose, totalAmount }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    comment: '',
    deliveryTime: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddressInZone, setIsAddressInZone] = useState(false);

  const timeSlots = [
    '10:00–12:00',
    '12:00–15:00',
    '15:00–18:00',
    '18:00–20:00',
  ];


  const handleChange = (e) => {
    const { id, value } = e.target;
    let cleanValue = value;

    if (id === 'phone') cleanValue = value.replace(/[^\d+]/g, '');

    setFormData(prev => ({ ...prev, [id]: cleanValue }));
  };

  const validate = useCallback(() => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Введите имя.';
    if (!formData.phone.trim()) {
      newErrors.phone = 'Введите телефон.';
    } else if (!/^\+?\d{9,15}$/.test(formData.phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Некорректный номер.';
    }
    if (!formData.address.trim()) newErrors.address = 'Введите адрес.';
    if (!isAddressInZone) newErrors.address = 'Адрес должен быть в зоне доставки.';
    if (!formData.deliveryTime) newErrors.deliveryTime = 'Выберите интервал доставки.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, isAddressInZone]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        comment: formData.comment.trim() || null,
      });
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
      <form onSubmit={handleSubmit}>
        <InputField
            label="Имя:"
            id="name"
            value={formData.name}
            onChange={handleChange}
            error={errors.name}
            required
        />
        <InputField
            label="Телефон:"
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            error={errors.phone}
            required
        />

        <InputField
            label="Адрес:"
            id="address"
            value={formData.address}
            onChange={handleChange}
            error={errors.address}
            required
        />

        <Textarea
            label="Комментарий к заказу (по желанию):"
            id="comment"
            value={formData.comment}
            onChange={handleChange}
            rows="3"
            placeholder="Оставить у двери."
        />

        <Select
            label="Желаемое время доставки:"
            id="deliveryTime"
            value={formData.deliveryTime}
            onChange={handleChange}
            options={timeSlots}
            placeholder="Выберите интервал"
            error={errors.deliveryTime}
            required
        />

        <div className='map-section'>
          <YandexMap
            address={formData.address}
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