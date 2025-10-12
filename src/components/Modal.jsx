// src/components/Modal.js
import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import '../Modal.css';

const Modal = ({ isOpen, onClose, children, shouldCloseOnOverlayClick = true }) => {
  const modalRef = useRef();

  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e) => e.key === 'Escape' && onClose();
    const handleOverlayClick = (e) => {
      if (shouldCloseOnOverlayClick && e.target === e.currentTarget) {
        onClose();
      }
    };

    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusableElements?.[0];
    const last = focusableElements?.[focusableElements.length - 1];

    const handleTab = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleEsc);
    document.addEventListener('keydown', handleTab);

    modalRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.removeEventListener('keydown', handleTab);
    };
  }, [isOpen, onClose, shouldCloseOnOverlayClick]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={shouldCloseOnOverlayClick ? onClose : undefined}
    >
        {children}
    </div>,
    document.getElementById('root')
  );
};

export default React.memo(Modal);