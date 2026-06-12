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

    // 1. СОРТИРОВКА ПО ВРЕМЕНИ (Сначала новые)
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

    // 2. ОТМЕНА ЗАКАЗА
    const handleCancelOrder = async (orderId, isPaid = false) => {
        const result = await Swal.fire({
            title: 'Отменить заказ?',
            text: isPaid ? "Внимание! Заказ уже оплачен. Деньги нужно будет возвращать в кабинете ЮKassa вручную!" : "Заказ будет удален из текущего списка.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Да, отменить',
            confirmButtonColor: '#ff4757',
            cancelButtonText: 'Нет'
        });

        if (result.isConfirmed) {
            try {
                // Используем смену статуса на 'canceled' или удаление
                await adminService.updateStatus(orderId, 'canceled');
                Swal.fire('Отменено', 'Статус заказа изменен', 'success');
                loadData();
            } catch (e) {
                Swal.fire('Ошибка', 'Не удалось отменить заказ', 'error');
            }
        }
    };

    const handleUpdateWeight = async (orderId, itemIndex, currentName) => {
        const { value: grams } = await Swal.fire({
            title: `⚖️ Вес: ${currentName}`,
            input: 'number',
            inputLabel: 'Введите вес в ГРАММАХ',
            showCancelButton: true,
            confirmButtonText: 'Сохранить',
            confirmButtonColor: '#2ecc71'
        });

        if (grams) {
            try {
                await adminService.updateWeight(orderId, itemIndex, grams / 1000);
                loadData();
                Swal.fire({ title: 'Обновлено', icon: 'success', timer: 1000, showConfirmButton: false });
            } catch (e) { Swal.fire('Ошибка', e.message, 'error'); }
        }
    };

    const handleCapture = async (orderId) => {
        const result = await Swal.fire({
            title: 'Списать средства?',
            text: 'Это подтвердит платеж в ЮKassa и переведет заказ в оплаченные',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Да, списать',
            confirmButtonColor: '#2ecc71'
        });

        if (result.isConfirmed) {
            setLoading(true);
            try {
                await adminService.captureOrder(orderId);
                // Делаем небольшую паузу, чтобы сервер успел перезаписать JSON файлы
                setTimeout(() => {
                    loadData();
                    Swal.fire('Успех', 'Оплата списана', 'success');
                }, 1000);
            } catch (e) {
                Swal.fire('Ошибка', e.response?.data?.message || e.message, 'error');
            }
            setLoading(false);
        }
    };

    const handleStatusChange = async (orderId, newStatus) => {
        try {
            await adminService.updateStatus(orderId, newStatus);
            loadData();
        } catch (e) { Swal.fire('Ошибка', 'Не удалось обновить статус', 'error'); }
    };

    if (!hydrated) return null;

    if (!isAuthenticated) {
        return (
            <div className="admin-login-container">
                <div className="login-box">
                    <img src="/log-header.webp" alt="Logo" className="login-logo" />
                    <h2>Вход в управление</h2>
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

    return (
        <div className="admin-layout">
            <header className="admin-nav">
                <div className="admin-nav-content">
                    <div className="admin-logo-block">
                        <img src="/log-header.webp" alt="Logo" />
                        <div className="logo-text">
                            <span className="brand-name">ФАСОЛЬ</span>
                            <span className="panel-type">ПАНЕЛЬ УПРАВЛЕНИЯ</span>
                        </div>
                    </div>
                    <div className="admin-nav-actions">
                        <button className="refresh-btn" onClick={loadData} disabled={loading}>
                            {loading ? '...' : '🔄 Обновить'}
                        </button>
                        <button onClick={handleLogout} className="logout-btn">Выйти</button>
                    </div>
                </div>
            </header>

            <main className="admin-container">
                {/* 1. Сборка */}
                <section className="orders-section">
                    <div className="section-header">
                        <span className="section-icon">⚖️</span>
                        <h2>Ожидают сборки (Весовые)</h2>
                    </div>
                    {sortedAssembly.length === 0 ? (
                        <p className="empty-msg">Нет заказов на сборку</p>
                    ) : (
                        <div className="admin-grid">
                            {sortedAssembly.map(order => (
                                <div key={order.id} className="admin-order-card assembly-card">
                                    <div className="card-header">
                                        <span className="order-id">№{order.id}</span>
                                        <span className="order-time">{order.date ? new Date(order.date).toLocaleTimeString() : ''}</span>
                                    </div>
                                    <div className="card-body">
                                        <p className="customer-name">{order.customer_name}</p>
                                        <p className="customer-phone">{order.phone}</p>
                                        <ul className="items-list">
                                            {order.cart?.map((item, idx) => (
                                                <li key={idx}>
                                                    <span className="item-name">{item.name}</span>
                                                    <div className="item-details">
                                                        <span className="item-qty">{item.quantity} {item.unit === 'Kilogram' ? 'кг' : 'шт'}</span>
                                                        {item.unit === 'Kilogram' && (
                                                            <button className="btn-weight" onClick={() => handleUpdateWeight(order.id, idx, item.name)}>⚖️</button>
                                                        )}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="card-footer-flex">
                                        <button className="btn-cancel-small" onClick={() => handleCancelOrder(order.id, false)}>Отменить</button>
                                        <button className="capture-btn" onClick={() => handleCapture(order.id)} disabled={loading}>
                                            ✅ Списать
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* 2. Оплаченные */}
                <section className="orders-section">
                    <div className="section-header">
                        <span className="section-icon">📦</span>
                        <h2>Оплаченные заказы</h2>
                    </div>
                    {sortedCompleted.length === 0 ? (
                        <p className="empty-msg">Оплаченных заказов пока нет</p>
                    ) : (
                        <div className="admin-grid">
                            {sortedCompleted.map(order => (
                                <div key={order.id} className={`admin-order-card status-${order.status}`}>
                                    <div className="card-header">
                                        <span className="order-id">№{order.id}</span>
                                        <select
                                            className="status-select"
                                            value={order.status}
                                            onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                        >
                                            <option value="new">🆕 Новый</option>
                                            <option value="in_progress">👨‍🍳 В работе</option>
                                            <option value="completed">✅ Завершён</option>
                                            <option value="canceled">❌ Отменён</option>
                                        </select>
                                    </div>
                                    <div className="card-body">
                                        <p className="customer-name">{order.customer_name} ({order.phone})</p>
                                        <p className="order-address">📍 {order.address}</p>

                                        <div className="order-price-details">
                                            <p>Товары: <strong>{order.itemsTotal || (order.total - (order.deliveryCost || 0))} ₽</strong></p>
                                            {order.deliveryCost > 0 && <p>Доставка: <strong>{order.deliveryCost} ₽</strong></p>}
                                            <p className="final-total">Итого списано: <span>{order.total} ₽</span></p>
                                        </div>

                                        <button className="btn-cancel-small link-style" onClick={() => handleCancelOrder(order.id, true)}>
                                            Отменить / Возврат
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

export default React.memo(AdminPage);