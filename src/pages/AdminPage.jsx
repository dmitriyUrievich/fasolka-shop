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
    const prevOrdersCount = useRef({ assembly: 0, active: 0 });

    const [activeTab, setActiveTab] = useState('assembly');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [orders, setOrders] = useState({ assembly: {}, completed: {} });
    const [loading, setLoading] = useState(false);

    // Функция для запуска уведомления (звук + текст)
    const playNotification = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.play().catch(() => {
                console.log("Автовоспроизведение звука заблокировано браузером. Требуется клик.");
            });
        }
        Swal.fire({
            title: 'Новый заказ!',
            text: 'В панель управления поступили новые данные',
            icon: 'info',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 5000,
            timerProgressBar: true,
            background: '#2ecc71',
            color: '#fff'
        });
    }, []);

    const loadData = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const data = await adminService.getOrders();

            // Проверка на новые заказы для уведомления
            const currentAssemblyCount = Object.keys(data.assembly || {}).length;
            const currentActiveCount = Object.values(data.completed || {}).filter(o => o.status === 'new').length;

            // Если это не первая загрузка и заказов стало больше - сигналим
            if (prevOrdersCount.current.assembly !== null) {
                if (currentAssemblyCount > prevOrdersCount.current.assembly ||
                    currentActiveCount > prevOrdersCount.current.active) {
                    playNotification();
                }
            }

            // Сохраняем текущее кол-во для следующего сравнения
            prevOrdersCount.current = {
                assembly: currentAssemblyCount,
                active: currentActiveCount
            };

            setOrders(data || { assembly: {}, completed: {} });
        } catch (e) {
            if (e.response?.status === 401 || e.response?.status === 403) {
                setIsAuthenticated(false);
                localStorage.removeItem('admin_token');
            }
        } finally {
            setLoading(false);
        }
    }, [playNotification]);

    // Инициализация при загрузке
    useEffect(() => {
        if (hydrated) {
            // Инициализируем аудио объект
            audioRef.current = new Audio('/notification.mp3');

            const token = localStorage.getItem('admin_token');
            if (token) {
                setIsAuthenticated(true);
                loadData();

                // Настройка автообновления каждые 30 секунд
                const interval = setInterval(() => {
                    loadData(true);
                }, 30000);

                return () => clearInterval(interval);
            }
            document.getElementById('global-loader')?.remove();
        }
    }, [hydrated, loadData]);

    // Списки заказов
    const assemblyList = useMemo(() => Object.values(orders.assembly || {})
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)), [orders.assembly]);

    const workList = useMemo(() => Object.values(orders.completed || {})
        .filter(o => o.status !== 'completed' && o.status !== 'canceled')
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)), [orders.completed]);

    const historyList = useMemo(() => Object.values(orders.completed || {})
        .filter(o => o.status === 'completed' || o.status === 'canceled')
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)), [orders.completed]);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            await adminService.login(password);
            setIsAuthenticated(true);
            loadData();
        } catch (e) {
            Swal.fire('Ошибка', 'Неверный пароль', 'error');
        }
    };

    const handleUpdateWeight = async (orderId, idx, name) => {
        const { value: grams } = await Swal.fire({
            title: `⚖️ ${name}`,
            input: 'number',
            inputLabel: 'Введите точный вес в ГРАММАХ',
            showCancelButton: true,
            confirmButtonColor: '#2ecc71'
        });
        if (grams) {
            await adminService.updateWeight(orderId, idx, grams / 1000);
            loadData(true);
        }
    };

    const handleCapture = async (orderId) => {
        const order = orders.assembly[orderId];
        const currentTotal = (order.cart.reduce((s, i) => s + (i.price * i.quantity), 0) + (order.deliveryCost || 0)).toFixed(2);

        const res = await Swal.fire({
            title: 'Списать оплату?',
            text: `Сумма к списанию: ${currentTotal} ₽`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Списать',
            confirmButtonColor: '#2ecc71'
        });

        if (res.isConfirmed) {
            setLoading(true);
            try {
                await adminService.captureOrder(orderId, order.cart);
                setTimeout(() => {
                    loadData();
                    setActiveTab('active');
                }, 1500);
                Swal.fire('Успех', 'Оплата списана. Заказ в работе.', 'success');
            } catch (e) {
                Swal.fire('Ошибка', 'Не удалось списать средства', 'error');
            }
            setLoading(false);
        }
    };

    if (!hydrated) return null;

    if (!isAuthenticated) {
        return (
            <div className="admin-login-container">
                <div className="login-box">
                    <img src="/log-header.webp" alt="Logo" className="login-logo" />
                    <h2>ФАСОЛЬ АДМИН</h2>
                    <form onSubmit={handleLogin} className="login-form">
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Пароль администратора"
                            autoFocus
                        />
                        <button type="submit">Войти</button>
                    </form>
                </div>
            </div>
        );
    }

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
                            <button className="btn-weight" onClick={() => handleUpdateWeight(orderId, idx, item.name)}>⚖️</button>
                        )}
                    </div>
                </li>
            ))}
        </ul>
    );

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
                        <button className="refresh-btn" onClick={() => loadData()}>🔄</button>
                        <button onClick={() => adminService.logout()} className="logout-btn">Выйти</button>
                    </div>
                </div>
            </header>

            <main className="admin-container">
                {activeTab === 'assembly' && (
                    <section className="orders-section animate-fade">
                        <div className="section-header"><h2>⏳ Ожидают взвешивания</h2></div>
                        {assemblyList.length === 0 ? <p className="empty-msg">Весовых заказов нет</p> : (
                            <div className="admin-grid">
                                {assemblyList.map(order => (
                                    <div key={order.id} className="admin-order-card assembly-card">
                                        <div className="card-header">
                                            <span className="order-id">№{order.id}</span>
                                            <span className="order-time">{new Date(order.date).toLocaleTimeString()}</span>
                                        </div>
                                        <div className="card-body">
                                            <p className="customer-info">👤 {order.customer_name} | {order.phone}</p>
                                            <p className="order-address">📍 {order.address}</p>
                                            <p className="order-delivery-time">⏰ Привезти к: <strong>{order.deliveryTime}</strong></p>
                                            {order.comment && <div className="order-comment-box">💬 {order.comment}</div>}
                                            <OrderItems cart={order.cart} orderId={order.id} canAdjust={true} />
                                            <div className="card-footer-flex">
                                                <button className="btn-cancel" onClick={() => adminService.cancelOrder(order.id).then(() => loadData(true))}>Отмена</button>
                                                <button className="capture-btn" onClick={() => handleCapture(order.id)} disabled={loading}>✅ Списать</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {activeTab === 'active' && (
                    <section className="orders-section animate-fade">
                        <div className="section-header"><h2>👨‍🍳 В работе / Курьер</h2></div>
                        {workList.length === 0 ? <p className="empty-msg">Активных заказов нет</p> : (
                            <div className="admin-grid">
                                {workList.map(order => (
                                    <div key={order.id} className={`admin-order-card status-${order.status}`}>
                                        <div className="card-header">
                                            <strong>№{order.id}</strong>
                                            <select className="status-select" value={order.status} onChange={(e) => adminService.updateStatus(order.id, e.target.value).then(() => loadData(true))}>
                                                <option value="new">🆕 Новый</option>
                                                <option value="in_progress">👨‍🍳 В работе</option>
                                                <option value="completed">✅ Завершить</option>
                                            </select>
                                        </div>
                                        <div className="card-body">
                                            <p className="customer-info">👤 {order.customer_name} <br/> 📞 {order.phone}</p>
                                            <p className="order-address">📍 {order.address}</p>
                                            <p className="order-delivery-time">⏰ Привезти к: <strong>{order.deliveryTime}</strong></p>
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
                                            {order.comment && <div className="order-comment-box">💬 {order.comment}</div>}
                                            <OrderItems cart={order.cart} />
                                            <p className="total-line">Сумма: <strong>{order.total} ₽</strong></p>
                                            <button className="btn-delete-link" onClick={() => adminService.cancelOrder(order.id).then(() => loadData(true))}>Удалить из базы</button>
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