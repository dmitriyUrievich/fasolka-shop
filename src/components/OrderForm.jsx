// src/components/OrderForm.js
import React, { useState, useCallback } from 'react';
import './../OrderForm.css';

const OrderForm = ({ onSubmit, onClose,totalAmount }) => {
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [comment, setComment] = useState('');
  const [deliveryTime, setDeliveryTime] = useState(''); // теперь это строка-интервал
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    
    // Опционально: сделать выбор времени обязательным
  if (!deliveryTime) newErrors.deliveryTime = 'Выберите интервал доставки.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [customerName, phoneNumber, address, deliveryTime]);

  // Стандартный обработчик отправки формы
  const handleSubmit = async (e) => {
    e.preventDefault(); // Предотвращаем стандартную перезагрузку страницы
    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Собираем данные и вызываем onSubmit из родительского компонента
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
      // isSubmitting будет управляться из родительского компонента 
      // через закрытие модального окна, но на всякий случай оставим
      setIsSubmitting(false);
    }
  };


  return (
   <div className="order-form-container">
      {/* <-- 3. Кнопка "Отмена" заменена на крестик вверху */}
      <button type="button" onClick={onClose} className="close-button" aria-label="Закрыть">
        &times;
      </button>

      <h2 id="form-title">Оформление заказа</h2>
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

        <div className="form-actions">        
          <button
            type="submit"
            className="submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Отправка...' : `Перейти к оплате ${totalAmount.toFixed(2)} ₽`}
          </button>
        </div>
      </form>
    </div>
  );
};

export default React.memo(OrderForm);