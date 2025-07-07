// src/components/Modal.js
import React,{useEffect} from 'react';
import ReactDOM from 'react-dom';
import '../Modal.css'; // Стили для модального окна

const Modal = ({ isOpen, onClose, children }) => {

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.getElementById('root') // Портал рендерит модальное окно в корневой элемент
  );
};

export default Modal;
