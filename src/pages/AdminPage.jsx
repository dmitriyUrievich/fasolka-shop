import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Swal from 'sweetalert2';
import { useHydration } from '../hooks/useHydration';
import adminService from '../services/adminService';
import { useNavigate } from "react-router-dom";
import '../AdminPage.css';

const AdminPage = () => {
    const hydrated = useHydration();
    const navigate = useNavigate();

    // Состояние вкладок: 'assembly' (сборка) или 'history' (оплаченные)
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

    // Списки заказов с сортировкой
    const assemblyList = useMemo(() => Object.values(orders.assembly || {})
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)), [orders.assembly]);

    const completedList = useMemo(() => Object.values(orders.completed || {})
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)), [orders.completed]);

    useEffect(() => {
        if (hydrated) {
            const token = localStorage.getItem('admin_token');
            if (token) { setIsAuthenticated(true); loadData(); }
        }
    }, [hydrated, loadData]);

    // Обработчики (Login, Weight, Capture, Status, Cancel) - те же, что были раньше
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
            text: `Итоговая сумма: ${currentTotal} ₽`,
            icon: 'question',
            showCancelButton: true
        });

        if (res.isConfirmed) {
            setLoading(true);
            try {
                await adminService.captureOrder(orderId, order.cart);
                setTimeout(() => { loadData(); setActiveTab('history'); }, 1500); // После списания перекидываем в историю
                Swal.fire('Успех', 'Заказ оплачен и перемещен в историю', 'success');
            } catch (e) { Swal.fire('Ошибка', 'Не удалось списать', 'error'); }
            setLoading(false);
        }
    };

    if (!hydrated) return null;

    if (!isAuthenticated) {
        return (
            <div className="admin-login-container">
                <div className="login-box">
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
                    <div className="admin-logo-block"><span>ФАСОЛЬ</span></div>

                    {/* ПЕРЕКЛЮЧАТЕЛЬ ТАБОВ */}
                    <nav className="admin-tabs">
                        <button
                            className={`tab-btn ${activeTab === 'assembly' ? 'active' : ''}`}
                            onClick={() => setActiveTab('assembly')}
                        >
                            На сборке <span className="tab-count">{assemblyList.length}</span>
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                            onClick={() => setActiveTab('history')}
                        >
                            Оплачено / В работе <span className="tab-count">{completedList.length}</span>
                        </button>
                    </nav>

                    <div className="admin-nav-actions">
                        <button className="refresh-btn" onClick={loadData}>🔄</button>
                        <button onClick={adminService.logout} className="logout-btn">Выйти</button>
                    </div>
                </div>
            </header>

            <main className="admin-container">
                {activeTab === 'assembly' ? (
                    <section className="orders-section animate-fade">
                        <div className="section-header"><h2>⏳ Требуют взвешивания</h2></div>
                        {assemblyList.length === 0 ? <p className="empty-msg">Новых заказов с весовыми товарами нет</p> : (
                            <div className="admin-grid">
                                {assemblyList.map(order => (
                                    <div key={order.id} className="admin-order-card assembly-card highlight">
                                        <div className="card-header">
                                            <strong>Заказ №{order.id}</strong>
                                            <span>{new Date(order.date).toLocaleTimeString()}</span>
                                        </div>
                                        <div className="card-body">
                                            <p className="customer-info">👤 {order.customer_name} <br/> 📞 {order.phone}</p>
                                            <p className="order-address">📍 {order.address}</p>
                                            {order.comment && <div className="order-comment-box">💬 {order.comment}</div>}
                                            <OrderItems cart={order.cart} orderId={order.id} canAdjust={true} />
                                            <div className="card-footer-flex">
                                                <button className="btn-cancel" onClick={() => adminService.cancelOrder(order.id).then(loadData)}>Отмена</button>
                                                <button className="capture-btn" onClick={() => handleCapture(order.id)} disabled={loading}>✅ Списать оплату</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                ) : (
                    <section className="orders-section animate-fade">
                        <div className="section-header"><h2>📦 Готовы к отправке / Доставлены</h2></div>
                        <div className="admin-grid">
                            {completedList.map(order => (
                                <div key={order.id} className={`admin-order-card status-${order.status}`}>
                                    <div className="card-header">
                                        <strong>№{order.id}</strong>
                                        <select className="status-select" value={order.status} onChange={(e) => adminService.updateStatus(order.id, e.target.value).then(loadData)}>
                                            <option value="new">🆕 Новый (Оплачен)</option>
                                            <option value="in_progress">👨‍🍳 В работе / Курьер</option>
                                            <option value="completed">✅ Доставлен</option>
                                        </select>
                                    </div>
                                    <div className="card-body">
                                        <p className="customer-info">{order.customer_name} | {order.phone}</p>
                                        <p className="order-address">{order.address}</p>
                                        <OrderItems cart={order.cart} />
                                        <div className="total-line">
                                            <p className="final-sum">ИТОГО СПИСАНО: <strong>{order.total} ₽</strong></p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
};

export default React.memo(AdminPage);