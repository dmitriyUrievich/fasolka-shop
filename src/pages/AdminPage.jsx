import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Swal from 'sweetalert2';
import { useHydration } from '../hooks/useHydration';
import adminService from '../services/adminService';
import { useNavigate } from "react-router-dom";
import '../AdminPage.css';

const AdminPage = () => {
    const hydrated = useHydration();
    const navigate = useNavigate();

    // Теперь 3 вкладки: 'assembly' (сборка), 'active' (в работе), 'history' (завершенные)
    const [activeTab, setActiveTab] = useState('assembly');

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [orders, setOrders] = useState({ assembly: {}, completed: {} });
    const [loading, setLoading] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await adminService.getOrders();
            setOrders(data || { assembly: {}, completed: {} });
        } catch (e) {
            if (e.response?.status === 401 || e.response?.status === 403) {
                setIsAuthenticated(false);
                localStorage.removeItem('admin_token');
            }
        } finally { setLoading(false); }
    }, []);

    // Распределение заказов по спискам
    const assemblyList = useMemo(() => Object.values(orders.assembly || {})
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)), [orders.assembly]);

    const workList = useMemo(() => Object.values(orders.completed || {})
        .filter(o => o.status !== 'completed' && o.status !== 'canceled')
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)), [orders.completed]);

    const historyList = useMemo(() => Object.values(orders.completed || {})
        .filter(o => o.status === 'completed' || o.status === 'canceled')
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)), [orders.completed]);

    useEffect(() => {
        if (hydrated) {
            const token = localStorage.getItem('admin_token');
            if (token) { setIsAuthenticated(true); loadData(); }
            document.getElementById('global-loader')?.remove();
        }
    }, [hydrated, loadData]);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            await adminService.login(password);
            setIsAuthenticated(true);
            loadData();
        } catch (e) { Swal.fire('Ошибка', 'Неверный пароль', 'error'); }
    };

    const handleUpdateWeight = async (orderId, idx, name) => {
        const { value: grams } = await Swal.fire({ title: `⚖️ ${name}`, input: 'number', inputLabel: 'Вес в граммах', showCancelButton: true });
        if (grams) {
            await adminService.updateWeight(orderId, idx, grams / 1000);
            loadData();
        }
    };

    const handleCapture = async (orderId) => {
        const order = orders.assembly[orderId];
        const currentTotal = (order.cart.reduce((s, i) => s + (i.price * i.quantity), 0) + (order.deliveryCost || 0)).toFixed(2);

        const res = await Swal.fire({
            title: 'Списать оплату?',
            text: `Итоговая сумма: ${currentTotal} ₽. Заказ перейдет в статус "В работе".`,
            icon: 'question',
            showCancelButton: true
        });

        if (res.isConfirmed) {
            setLoading(true);
            try {
                await adminService.captureOrder(orderId, order.cart);
                setTimeout(() => {
                    loadData();
                    setActiveTab('active'); // Переключаем на вкладку "В работе"
                }, 1500);
                Swal.fire('Успех', 'Оплата списана. Заказ в списке активных.', 'success');
            } catch (e) { Swal.fire('Ошибка', 'Не удалось списать', 'error'); }
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
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль" autoFocus />
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
                        <span className="item-qty">{item.unit === 'Kilogram' ? `${(item.quantity * 1000).toFixed(0)}г` : `${item.quantity}шт`}</span>
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
                            <span className="admin-nav-badge">АДМИН</span>
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
                            История
                        </button>
                    </nav>

                    <div className="admin-nav-actions">
                        <button className="refresh-btn" onClick={loadData} title="Обновить данные">🔄</button>
                        <button onClick={() => { adminService.logout(); }} className="logout-btn">Выйти</button>
                    </div>
                </div>
            </header>

            <main className="admin-container">
                {/* ВКЛАДКА 1: СБОРКА */}
                {activeTab === 'assembly' && (
                    <section className="orders-section animate-fade">
                        <div className="section-header"><h2>⏳ Ожидают взвешивания</h2></div>
                        {assemblyList.length === 0 ? <p className="empty-msg">Нет заказов для взвешивания</p> : (
                            <div className="admin-grid">
                                {assemblyList.map(order => (
                                    <div key={order.id} className="admin-order-card assembly-card highlight">
                                        <div className="card-header">
                                            <strong>Заказ №{order.id}</strong>
                                            <span>{new Date(order.date).toLocaleTimeString()}</span>
                                        </div>
                                        <div className="card-body">
                                            <p className="customer-info">👤 {order.customer_name} | {order.phone}</p>
                                            <p className="order-address">📍 {order.address}</p>
                                            {order.comment && <div className="order-comment-box">💬 {order.comment}</div>}
                                            <OrderItems cart={order.cart} orderId={order.id} canAdjust={true} />
                                            <div className="card-footer-flex">
                                                <button className="btn-cancel" onClick={() => adminService.cancelOrder(order.id).then(loadData)}>Отмена</button>
                                                <button className="capture-btn" onClick={() => handleCapture(order.id)} disabled={loading}>✅ Списать</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* ВКЛАДКА 2: В РАБОТЕ */}
                {activeTab === 'active' && (
                    <section className="orders-section animate-fade">
                        <div className="section-header"><h2>👨‍🍳 Заказы в работе / Доставка</h2></div>
                        {workList.length === 0 ? <p className="empty-msg">Нет активных заказов</p> : (
                            <div className="admin-grid">
                                {workList.map(order => (
                                    <div key={order.id} className={`admin-order-card status-${order.status}`}>
                                        <div className="card-header">
                                            <strong>№{order.id}</strong>
                                            <select className="status-select" value={order.status} onChange={(e) => adminService.updateStatus(order.id, e.target.value).then(loadData)}>
                                                <option value="new">🆕 Новый (Оплачен)</option>
                                                <option value="in_progress">👨‍🍳 В работе</option>
                                                <option value="completed">✅ Завершить</option>
                                            </select>
                                        </div>
                                        <div className="card-body">
                                            <p className="customer-info">{order.customer_name} | {order.phone}</p>
                                            <p className="order-address">📍 {order.address}</p>
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

                {/* ВКЛАДКА 3: ИСТОРИЯ */}
                {activeTab === 'history' && (
                    <section className="orders-section animate-fade">
                        <div className="section-header"><h2>✅ История (Завершенные)</h2></div>
                        {historyList.length === 0 ? <p className="empty-msg">История пуста</p> : (
                            <div className="admin-grid">
                                {historyList.map(order => (
                                    <div key={order.id} className="admin-order-card history-card">
                                        <div className="card-header">
                                            <strong>№{order.id}</strong>
                                            <span className={`status-pill ${order.status}`}>{order.status === 'completed' ? 'Выполнен' : 'Отменен'}</span>
                                        </div>
                                        <div className="card-body">
                                            <p className="customer-info">{order.customer_name} | {new Date(order.date).toLocaleDateString()}</p>
                                            <OrderItems cart={order.cart} />
                                            <p className="total-line">Сумма: <strong>{order.total} ₽</strong></p>
                                            <button className="btn-delete-link" onClick={() => adminService.cancelOrder(order.id).then(loadData)}>Удалить из базы</button>
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