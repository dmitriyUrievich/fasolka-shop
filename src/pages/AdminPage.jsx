import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Swal from 'sweetalert2';
import { useHydration } from '../hooks/useHydration';
import adminService from '../services/adminService';
import '../AdminPage.css';
import { useNavigate } from "react-router-dom";

const AdminPage = () => {
    const hydrated = useHydration();
    const navigate = useNavigate();

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
        } finally {
            setLoading(false);
        }
    }, []);

    // Сортировка: Сначала новые
    const sortedAssembly = useMemo(() => {
        return Object.values(orders.assembly || {})
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }, [orders.assembly]);

    const sortedCompleted = useMemo(() => {
        return Object.values(orders.completed || {})
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }, [orders.completed]);

    useEffect(() => {
        if (hydrated) {
            const token = localStorage.getItem('admin_token');
            if (token) {
                setIsAuthenticated(true);
                loadData();
            }
            document.getElementById('global-loader')?.remove();
        }
    }, [hydrated, loadData]);

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

    // РЕАЛЬНАЯ ОТМЕНА (Удаление)
    const handleCancelOrder = async (orderId) => {
        const result = await Swal.fire({
            title: 'Удалить заказ?',
            text: "Это действие нельзя отменить!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Да, удалить',
            confirmButtonColor: '#ff4757'
        });

        if (result.isConfirmed) {
            try {
                await adminService.cancelOrder(orderId);
                Swal.fire('Удалено', '', 'success');
                loadData();
            } catch (e) {
                Swal.fire('Ошибка', 'Не удалось удалить заказ', 'error');
            }
        }
    };

    const handleUpdateWeight = async (orderId, itemIndex, currentName) => {
        const { value: grams } = await Swal.fire({
            title: `⚖️ Вес: ${currentName}`,
            input: 'number',
            inputLabel: 'Введите вес в ГРАММАХ',
            showCancelButton: true
        });

        if (grams) {
            await adminService.updateWeight(orderId, itemIndex, grams / 1000);
            loadData();
        }
    };

    const handleCapture = async (orderId) => {
        const result = await Swal.fire({ title: 'Списать средства?', showCancelButton: true });
        if (result.isConfirmed) {
            setLoading(true);
            try {
                await adminService.captureOrder(orderId);
                setTimeout(() => loadData(), 1000);
                Swal.fire('Списано', '', 'success');
            } catch (e) { Swal.fire('Ошибка', '', 'error'); }
            setLoading(false);
        }
    };

    const handleStatusChange = async (orderId, newStatus) => {
        await adminService.updateStatus(orderId, newStatus);
        loadData();
    };

    if (!hydrated) return null;

    if (!isAuthenticated) {
        return (
            <div className="admin-login-container">
                <div className="login-box">
                    <h2>Админ-панель</h2>
                    <form onSubmit={handleLogin} className="login-form">
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль" autoFocus />
                        <button type="submit">Войти</button>
                    </form>
                </div>
            </div>
        );
    }

    // Вспомогательный компонент для списка товаров
    const OrderCartList = ({ cart, orderId, canAdjust = false }) => (
        <ul className="items-list">
            {cart?.map((item, idx) => (
                <li key={idx}>
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
                    <span className="brand-name">ФАСОЛЬ АДМИН</span>
                    <div className="admin-nav-actions">
                        <button className="refresh-btn" onClick={loadData}>🔄 Обновить</button>
                        <button onClick={() => { localStorage.removeItem('admin_token'); navigate('/'); }} className="logout-btn">Выйти</button>
                    </div>
                </div>
            </header>

            <main className="admin-container">
                {/* БЛОК СБОРКИ */}
                <section className="orders-section">
                    <h2>⏳ Ожидают сборки </h2>
                    <div className="admin-grid">
                        {sortedAssembly.map(order => (
                            <div key={order.id} className="admin-order-card assembly-card">
                                <div className="card-header">
                                    <strong>№{order.id}</strong>
                                    <span>{new Date(order.date).toLocaleTimeString()}</span>
                                </div>
                                <div className="card-body">
                                    <p className="customer-main">{order.customer_name} | {order.phone}</p>
                                    <p className="order-address">🏠 {order.address}</p>

                                    {order.comment && (
                                        <div className="order-comment-box">
                                            <strong>💬 Комментарий:</strong> {order.comment}
                                        </div>
                                    )}

                                    <OrderCartList cart={order.cart} orderId={order.id} canAdjust={true} />

                                    <div className="card-actions-row">
                                        <button className="btn-cancel" onClick={() => handleCancelOrder(order.id)}>Удалить</button>
                                        <button className="capture-btn" onClick={() => handleCapture(order.id)} disabled={loading}>✅ Списать</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* БЛОК ОПЛАЧЕННЫХ */}
                <section className="orders-section">
                    <h2>📦 Оплаченные заказы</h2>
                    <div className="admin-grid">
                        {sortedCompleted.map(order => (
                            <div key={order.id} className={`admin-order-card status-${order.status}`}>
                                <div className="card-header">
                                    <strong>№{order.id}</strong>
                                    <select value={order.status} onChange={(e) => handleStatusChange(order.id, e.target.value)}>
                                        <option value="new">Новый</option>
                                        <option value="in_progress">В работе</option>
                                        <option value="completed">Готов</option>
                                    </select>
                                </div>
                                <div className="card-body">
                                    <p className="customer-main">{order.customer_name} | {order.phone}</p>

                                    {order.comment && (
                                        <div className="order-comment-box">
                                            <strong>💬:</strong> {order.comment}
                                        </div>
                                    )}

                                    <OrderCartList cart={order.cart} />

                                    <p className="total-line">Итого: <strong>{order.total} ₽</strong></p>
                                    <button className="btn-delete-link" onClick={() => handleCancelOrder(order.id)}>Удалить из истории</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
};

export default React.memo(AdminPage);