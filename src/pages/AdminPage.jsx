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

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        navigate('/');
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await adminService.getOrders();
            // --- ЛОГИ ТЕПЕРЬ ДОЛЖНЫ БЫТЬ ТУТ ---
            console.log('[Admin] Заказы получены:', data);

            setOrders(data || { assembly: {}, completed: {} });
        } catch (e) {
            console.error('[Admin] Ошибка загрузки:', e);
            if (e.response?.status === 401 || e.response?.status === 403) {
                setIsAuthenticated(false);
                localStorage.removeItem('admin_token');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    // СОРТИРОВКА: Новые всегда сверху
    const sortedAssembly = useMemo(() => {
        return Object.values(orders.assembly || {})
            .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    }, [orders.assembly]);

    const sortedCompleted = useMemo(() => {
        return Object.values(orders.completed || {})
            .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
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

    const handleCancelOrder = async (orderId, isPaid = false) => {
        const result = await Swal.fire({
            title: 'Отменить заказ?',
            text: isPaid ? "Внимание! Заказ уже оплачен." : "Заказ будет удален из списка.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Да, отменить',
            confirmButtonColor: '#ff4757'
        });

        if (result.isConfirmed) {
            try {
                await adminService.updateStatus(orderId, 'canceled');
                Swal.fire('Отменено', '', 'success');
                loadData();
            } catch (e) { Swal.fire('Ошибка', '', 'error'); }
        }
    };

    const handleUpdateWeight = async (orderId, itemIndex, currentName) => {
        const { value: grams } = await Swal.fire({
            title: `⚖️ Вес: ${currentName}`,
            input: 'number',
            inputLabel: 'Вес в ГРАММАХ',
            showCancelButton: true
        });

        if (grams) {
            await adminService.updateWeight(orderId, itemIndex, grams / 1000);
            loadData();
        }
    };

    const handleCapture = async (orderId) => {
        const result = await Swal.fire({
            title: 'Списать средства?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Да, списать'
        });

        if (result.isConfirmed) {
            setLoading(true);
            try {
                await adminService.captureOrder(orderId);
                setTimeout(() => {
                    loadData();
                    Swal.fire('Успех', 'Оплата списана', 'success');
                }, 1000);
            } catch (e) { Swal.fire('Ошибка', 'Не удалось списать', 'error'); }
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
                    <h2>Вход в управление</h2>
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
                    <div className="admin-logo-block">
                        <img src="/log-header.webp" alt="Logo" style={{height: '30px'}} />
                        <span className="brand-name">ФАСОЛЬ ПАНЕЛЬ</span>
                    </div>
                    <div className="admin-nav-actions">
                        <button className="refresh-btn" onClick={loadData} disabled={loading}>🔄 Обновить</button>
                        <button onClick={handleLogout} className="logout-btn">Выйти</button>
                    </div>
                </div>
            </header>

            <main className="admin-container">
                <section className="orders-section">
                    <h2>⚖️ Ожидают сборки</h2>
                    {sortedAssembly.length === 0 ? <p>Пусто</p> : (
                        <div className="admin-grid">
                            {sortedAssembly.map(order => (
                                <div key={order.id} className="admin-order-card assembly-card">
                                    <div className="card-header">
                                        <strong>№{order.id}</strong>
                                        <span>{order.date ? new Date(order.date).toLocaleTimeString() : ''}</span>
                                    </div>
                                    <div className="card-body">
                                        <p>{order.customer_name} | {order.phone}</p>
                                        <ul className="items-list">
                                            {order.cart?.map((item, idx) => (
                                                <li key={idx}>
                                                    {item.name} — <b>{item.quantity} {item.unit === 'Kilogram' ? 'кг' : 'шт'}</b>
                                                    {item.unit === 'Kilogram' && (
                                                        <button className="btn-weight" onClick={() => handleUpdateWeight(order.id, idx, item.name)}>⚖️</button>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="card-footer-flex" style={{display:'flex', gap:'10px', padding:'10px'}}>
                                        <button className="btn-cancel" style={{flex:1}} onClick={() => handleCancelOrder(order.id)}>Отмена</button>
                                        <button className="capture-btn" style={{flex:2}} onClick={() => handleCapture(order.id)} disabled={loading}>✅ Списать</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="orders-section">
                    <h2>📦 Оплаченные заказы</h2>
                    <div className="admin-grid">
                        {sortedCompleted.map(order => (
                            <div key={order.id} className={`admin-order-card status-${order.status}`}>
                                <div className="card-header">
                                    <strong>№{order.id}</strong>
                                    <select className="status-select" value={order.status} onChange={(e) => handleStatusChange(order.id, e.target.value)}>
                                        <option value="new">Новый</option>
                                        <option value="in_progress">В работе</option>
                                        <option value="completed">Готов</option>
                                        <option value="canceled">Отменен</option>
                                    </select>
                                </div>
                                <div className="card-body">
                                    <p>{order.customer_name} | {order.address}</p>
                                    <p>Списано: <strong>{order.total} ₽</strong></p>
                                    <button className="btn-cancel-small" onClick={() => handleCancelOrder(order.id, true)}>Возврат</button>
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