import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Swal from 'sweetalert2';
import { useHydration } from '../hooks/useHydration';
import adminService from '../services/adminService';
import { useNavigate } from "react-router-dom";
import '../AdminPage.css';

const AdminPage = () => {
    const hydrated = useHydration();
    const navigate = useNavigate();

    // Ссылки для звука и отслеживания новых заказов
    const audioRef = useRef(null);
    const prevOrdersCount = useRef({ assembly: null, active: null });

    const [activeTab, setActiveTab] = useState('assembly');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [orders, setOrders] = useState({ assembly: {}, completed: {} });
    const [loading, setLoading] = useState(false);

    // Функция уведомления (Звук + Всплывашка)
    const playNotification = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.play().catch(() => {
                console.log("Браузер заблокировал звук. Нужен клик по странице.");
            });
        }
        Swal.fire({
            title: 'Новый заказ!',
            text: 'Данные в панели обновлены',
            icon: 'info',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 4000,
            timerProgressBar: true,
            background: '#2ecc71',
            color: '#fff'
        });
    }, []);

    // Основная функция загрузки данных
    const loadData = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const data = await adminService.getOrders();

            // Считаем текущее кол-во заказов для сравнения
            const currentAssemblyCount = Object.keys(data.assembly || {}).length;
            const currentActiveCount = Object.values(data.completed || {}).filter(o => o.status === 'new').length;

            // Если данных стало больше, чем было — сигнализируем
            if (prevOrdersCount.current.assembly !== null) {
                if (currentAssemblyCount > prevOrdersCount.current.assembly ||
                    currentActiveCount > prevOrdersCount.current.active) {
                    playNotification();
                }
            }

            // Обновляем счетчики в REF
            prevOrdersCount.current = { assembly: currentAssemblyCount, active: currentActiveCount };
            setOrders(data || { assembly: {}, completed: {} });

        } catch (e) {
            console.error('[Admin] Ошибка загрузки данных:', e);
            if (e.response?.status === 401 || e.response?.status === 403) {
                setIsAuthenticated(false);
                localStorage.removeItem('admin_token');
            }
        } finally {
            setLoading(false);
        }
    }, [playNotification]);

    // Инициализация при входе
    useEffect(() => {
        if (hydrated) {
            audioRef.current = new Audio('/notification.mp3');

            const token = localStorage.getItem('admin_token');
            if (token) {
                setIsAuthenticated(true);
                loadData();

                // Авто-обновление каждые 30 секунд
                const interval = setInterval(() => loadData(true), 30000);
                return () => clearInterval(interval);
            }
            // Удаляем глобальный лоадер (если он есть в index.html)
            document.getElementById('global-loader')?.remove();
        }
    }, [hydrated, loadData]);

    // --- ФОРМИРОВАНИЕ СПИСКОВ (СОРТИРОВКА) ---
    const assemblyList = useMemo(() => Object.values(orders.assembly || {})
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)), [orders.assembly]);

    const workList = useMemo(() => Object.values(orders.completed || {})
        .filter(o => o.status !== 'completed' && o.status !== 'canceled')
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)), [orders.completed]);

    const historyList = useMemo(() => Object.values(orders.completed || {})
        .filter(o => o.status === 'completed' || o.status === 'canceled')
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)), [orders.completed]);

    // --- ОБРАБОТЧИКИ ДЕЙСТВИЙ ---

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            await adminService.login(password);
            setIsAuthenticated(true);
            loadData();
        } catch (e) {
            Swal.fire('Ошибка', 'Неверный пароль администратора', 'error');
        }
    };

    const handleUpdateWeight = async (orderId, idx, name) => {
        const { value: grams } = await Swal.fire({
            title: `⚖️ Вес: ${name}`,
            input: 'number',
            inputLabel: 'Введите точный вес в ГРАММАХ',
            showCancelButton: true,
            confirmButtonColor: '#2ecc71'
        });
        if (grams) {
            await adminService.updateWeight(orderId, idx, grams / 1000);
            loadData(true);
            Swal.fire({ title: 'Обновлено', icon: 'success', timer: 800, showConfirmButton: false });
        }
    };

    const handleCapture = async (orderId) => {
        const order = orders.assembly[orderId];
        const itemsTotal = order.cart.reduce((s, i) => s + (i.price * i.quantity), 0);
        const currentTotal = (itemsTotal + (order.deliveryCost || 0)).toFixed(2);

        const res = await Swal.fire({
            title: 'Списать оплату?',
            text: `Сумма: ${currentTotal} ₽. Заказ будет перемещен в раздел "В работе"`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Да, списать',
            confirmButtonColor: '#2ecc71'
        });

        if (res.isConfirmed) {
            setLoading(true);
            try {
                await adminService.captureOrder(orderId, order.cart);
                setTimeout(() => {
                    loadData();
                    setActiveTab('active');
                }, 1000);
                Swal.fire('Успешно', 'Средства списаны', 'success');
            } catch (e) {
                Swal.fire('Ошибка', 'Не удалось провести оплату в ЮKassa', 'error');
            }
            setLoading(false);
        }
    };

    const handleCancelOrder = async (orderId) => {
        const res = await Swal.fire({
            title: 'Удалить заказ?',
            text: 'Заказ будет полностью удален из базы данных!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Да, удалить',
            confirmButtonColor: '#ff4757'
        });
        if (res.isConfirmed) {
            await adminService.cancelOrder(orderId);
            loadData(true);
            Swal.fire('Удалено', '', 'success');
        }
    };

    const handleStatusChange = async (orderId, newStatus) => {
        await adminService.updateStatus(orderId, newStatus);
        loadData(true);
    };

    // Вспомогательный компонент списка товаров
    const OrderItems = ({ cart, orderId, canAdjust }) => (
        <ul className="items-list">
            {cart?.map((item, idx) => (
                <li key={idx} className={item.unit === 'Kilogram' ? 'weighted-row' : ''}>
                    <span className="item-name">{item.name}</span>
                    <div className="item-details">
                        <span className="item-qty">
                            {item.unit === 'Kilogram' ? `${(item.quantity * 1000).toFixed(0)}г` : `${item.quantity}шт`}
                        </span>
                        {canAdjust && item.unit === 'Kilogram' && (
                            <button className="btn-weight" onClick={() => handleUpdateWeight(orderId, idx, item.name)} title="Изменить вес">⚖️</button>
                        )}
                    </div>
                </li>
            ))}
        </ul>
    );

    if (!hydrated) return null;

    if (!isAuthenticated) {
        return (
            <div className="admin-login-container">
                <div className="login-box animate-fade">
                    <img src="/log-header.webp" alt="Logo" className="login-logo" />
                    <h2>ФАСОЛЬ АДМИН</h2>
                    <form onSubmit={handleLogin} className="login-form">
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль" autoFocus />
                        <button type="submit">Войти</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-layout">
            <header className="admin-nav">
                <div className="admin-nav-content">
                    <div className="admin-logo-group" onClick={() => navigate('/')}>
                        <img src="/log-header.webp" alt="Logo" className="admin-nav-logo" />
                        <div className="admin-nav-text">
                            <span className="admin-nav-title">ФАСОЛЬ</span>
                            <span className="admin-nav-badge">Панель управления</span>
                        </div>
                    </div>

                    <nav className="admin-tabs">
                        <button className={`tab-btn ${activeTab === 'assembly' ? 'active' : ''}`} onClick={() => setActiveTab('assembly')}>
                            Сборка <span className="tab-count">{assemblyList.length}</span>
                        </button>
                        <button className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`} onClick={() => setActiveTab('active')}>
                            В работе <span className="tab-count">{workList.length}</span>
                        </button>
                        <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
                            История <span className="tab-count gray">{historyList.length}</span>
                        </button>
                    </nav>

                    <div className="admin-nav-actions">
                        <button className="refresh-btn" onClick={() => loadData()} disabled={loading}>{loading ? '...' : '🔄'}</button>
                        <button onClick={() => adminService.logout()} className="logout-btn">Выйти</button>
                    </div>
                </div>
            </header>

            <main className="admin-container">
                {/* 1. ВКЛАДКА СБОРКИ */}
                {activeTab === 'assembly' && (
                    <section className="orders-section animate-fade">
                        <div className="section-header"><h2>⏳ Ожидают взвешивания</h2></div>
                        {assemblyList.length === 0 ? <p className="empty-msg">Новых весовых заказов нет</p> : (
                            <div className="admin-grid">
                                {assemblyList.map(order => (
                                    <div key={order.id} className="admin-order-card assembly-card highlight">
                                        <div className="card-header">
                                            <strong>Заказ №{order.id}</strong>
                                            <span>{order.date ? new Date(order.date).toLocaleTimeString() : ''}</span>
                                        </div>
                                        <div className="card-body">
                                            <p className="customer-info">👤 {order.customer_name} | {order.phone}</p>
                                            <p className="order-address">📍 {order.address}</p>
                                            <div className="order-delivery-time">⏰ Привезти к: <strong>{order.deliveryTime || 'Как можно скорее'}</strong></div>
                                            {order.comment && <div className="order-comment-box">💬 {order.comment}</div>}
                                            <OrderItems cart={order.cart} orderId={order.id} canAdjust={true} />
                                            <div className="card-footer-flex">
                                                <button className="btn-cancel" onClick={() => handleCancelOrder(order.id)}>Отмена</button>
                                                <button className="capture-btn" onClick={() => handleCapture(order.id)} disabled={loading}>✅ Списать</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* 2. ВКЛАДКА В РАБОТЕ */}
                {activeTab === 'active' && (
                    <section className="orders-section animate-fade">
                        <div className="section-header"><h2>👨‍🍳 В работе / Курьер</h2></div>
                        {workList.length === 0 ? <p className="empty-msg">Активных заказов нет</p> : (
                            <div className="admin-grid">
                                {workList.map(order => (
                                    <div key={order.id} className={`admin-order-card status-${order.status}`}>
                                        <div className="card-header">
                                            <strong>№{order.id}</strong>
                                            <select className="status-select" value={order.status} onChange={(e) => handleStatusChange(order.id, e.target.value)}>
                                                <option value="new">🆕 Новый</option>
                                                <option value="in_progress">👨‍🍳 В работе</option>
                                                <option value="completed">✅ Завершить</option>
                                            </select>
                                        </div>
                                        <div className="card-body">
                                            <p className="customer-info">👤 {order.customer_name} <br/> 📞 {order.phone}</p>
                                            <p className="order-address">📍 {order.address}</p>
                                            <div className="order-delivery-time">⏰ Привезти к: <strong>{order.deliveryTime || 'Ближайшее'}</strong></div>
                                            {order.comment && <div className="order-comment-box">💬 {order.comment}</div>}
                                            <OrderItems cart={order.cart} />
                                            <div className="total-line">
                                                <p className="final-sum">ИТОГО: <strong>{order.total} ₽</strong></p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* 3. ВКЛАДКА ИСТОРИЯ */}
                {activeTab === 'history' && (
                    <section className="orders-section animate-fade">
                        <div className="section-header"><h2>✅ История завершенных</h2></div>
                        {historyList.length === 0 ? <p className="empty-msg">История пуста</p> : (
                            <div className="admin-grid">
                                {historyList.map(order => (
                                    <div key={order.id} className="admin-order-card history-card">
                                        <div className="card-header">
                                            <strong>№{order.id}</strong>
                                            <span className={`status-pill ${order.status}`}>{order.status === 'completed' ? 'Выполнен' : 'Отменен'}</span>
                                        </div>
                                        <div className="card-body">
                                            <p className="customer-info">{order.customer_name} | {order.date ? new Date(order.date).toLocaleDateString('ru-RU') : 'Нет даты'}</p>
                                            <p className="order-address">📍 {order.address}</p>
                                            <OrderItems cart={order.cart} />
                                            <p className="total-line">Сумма: <strong>{order.total} ₽</strong></p>
                                            <button className="btn-delete-link" onClick={() => handleCancelOrder(order.id)}>Удалить из базы</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}
            </main>
        </div>
    );
};

export default React.memo(AdminPage);