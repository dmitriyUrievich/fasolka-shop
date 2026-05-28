import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ShopPage from './pages/ShopPage';
import AdminPage from './pages/AdminPage';
import './App.css';

function App({ initialData }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('none');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [showOnlyFallback, setShowOnlyFallback] = useState(false);
  const [products, setProducts] = useState(initialData?.products || []);
  const [catalogGroups, setCatalogGroups] = useState(initialData?.catalog || []);
  const [loading, setLoading] = useState(!initialData);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const hydrated = useHydration();
  const [orderTotal, setOrderTotal] = useState(0);

  const totalCartItems = useCartStore(state => state.items.reduce((sum, item) => sum + item.quantityInCart, 0));
  const clearCart = useCartStore(state => state.clearCart);
    
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!initialData) {
      const loadAllData = async () => {
        setLoading(true);
        try {
          const response = await fetch('/api/products-data');
          if (!response.ok) throw new Error(`Ошибка сети: ${response.statusText}`);
          const data = await response.json();
          setProducts(data.products || []);
          setCatalogGroups(data.catalog || []);
        } catch (err) {
          console.error('Ошибка загрузки данных:', err);
          Swal.fire({ title: 'Ошибка', text: 'Не удалось загрузить каталог товаров.', icon: 'error' });
        } finally {
          setLoading(false);
        }
      };
      loadAllData();
    }
  }, [initialData]);

  // Закрытие по Esc (только на клиенте) - ПРАВИЛЬНО
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setIsCategoryMenuOpen(false);
        setIsCartOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const handleProceedToOrder = () => {
    const cartItems = useCartStore.getState().items;

   const { finalAmountForPayment } = calculateOrderTotals(cartItems);

    setOrderTotal(parseFloat(finalAmountForPayment.toFixed(2)));
    setIsCartOpen(false);
    setIsOrderFormOpen(true);
  };

  const handleCloseOrderForm = () => setIsOrderFormOpen(false);

 const createYooKassaPayment = async (orderData) => {
    try {
      const response = await fetch(`/api/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Ошибка сервера' }));
        throw new Error(errorData.message || 'Ошибка сети');
      }

      const data = await response.json();
      const confirmationUrl = data?.payment?.confirmation?.confirmation_url;

      if (confirmationUrl) {
        // ДЛЯ IPHONE/SAFARI: Используем текущее окно, чтобы избежать блокировки всплывающих окон
        window.location.href = confirmationUrl; 
        return true;
      } else {
        throw new Error('Ссылка на оплату не получена');
      }
    } catch (error) {
      console.error("Ошибка при создании платежа:", error);
      Swal.fire({ 
        title: 'Ошибка', 
        text: 'Не удалось перейти к оплате: ' + error.message, 
        icon: 'error',
        confirmButtonColor: '#28a745'
      });
      return false;
    }
  };

 const handleSubmitOrder = async (customerData) => {
    const { items: cartItems } = useCartStore.getState();
    
    if (cartItems.length === 0) {
      Swal.fire('Корзина пуста', 'Добавьте товары перед оплатой', 'warning');
      return;
    }

    // Показываем индикатор загрузки, пока ждем ответ от ЮKassa
    Swal.fire({
      title: 'Оформление...',
      text: 'Создаем ваш заказ и переходим к оплате',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
    
    const { subtotal, totalWithReserve, deliveryCost, finalAmountForPayment } = calculateOrderTotals(cartItems);

    const orderData = {
      id: generateDailyOrderId(),
      customer_name: customerData.name,
      phone: customerData.phone,
      address: customerData.address,
      comment: customerData.comment,
      deliveryTime: customerData.deliveryTime,
      subtotal: parseFloat(subtotal.toFixed(2)),
      totalWithReserve: parseFloat(totalWithReserve.toFixed(2)),
      amountToPay: parseFloat(finalAmountForPayment.toFixed(2)),
      deliveryCost: deliveryCost, 
      cart: cartItems.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantityInCart,
        price: item.sellPricePerUnit,
        unit: item.unit,
      })),
    };

   const isPaymentInitiated = await createYooKassaPayment(orderData);
    if (isPaymentInitiated) {
      Swal.fire({
        title: '🎉 Заказ создан!',
        html: `Ваш заказ <b>№${orderData.id}</b> принят и ожидает оплаты.<br>Окно для оплаты должно было открыться в новой вкладке.`,
        icon: 'success',
        confirmButtonText: 'Отлично!',
      });
      clearCart();
      handleCloseOrderForm();
    }
  };
  const onClearCart = () => {
    clearCart();
    setIsCartOpen(false);
  };

  return (
      <Routes>
        {/* Главная страница магазина */}
        <Route path="/" element={<ShopPage initialData={initialData} />} />

        {/* Страница админки */}
        <Route path="/admin" element={<AdminPage />} />

        {/* 404 - Страница не найдена (опционально) */}
        <Route path="*" element={<div><h1>404</h1><p>Страница не найдена</p><a href="/">На главную</a></div>} />
      </Routes>
  );
}

export default App;