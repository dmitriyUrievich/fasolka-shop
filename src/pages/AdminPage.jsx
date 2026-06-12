import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { useHydration } from '../hooks/useHydration';
import adminService from '../services/adminService';
import '../AdminPage.css';
import {useNavigate} from "react-router-dom";

const AdminPage = () => {
    const hydrated = useHydration();
    const navigate = useNavigate();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [orders, setOrders] = useState({ assembly: {}, completed: {} });
    const [loading, setLoading] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        navigate('/'); // Мгновенный переход через React Router
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await adminService.getOrders();
            setOrders(data);
        } catch (e) {
            if (e.response?.status === 401 || e.response?.status === 403) {
                setIsAuthenticated(false);
                localStorage.removeItem('admin_token');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (hydrated) {
            const token = localStorage.getItem('admin_token');
            if (token) {
                setIsAuthenticated(true);
                loadData();
            }
            // Удаляем глобальный лоадер если он есть
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
                Swal.fire('Успех', 'Оплата подтверждена', 'success');
                loadData();
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

    const hasAssembly = Object.keys(orders.assembly || {}).length > 0;
    const hasCompleted = Object.keys(orders.completed || {}).length > 0;

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
                    {!hasAssembly ? (
                        <p className="empty-msg">Нет заказов на сборку</p>
                    ) : (
                        <div className="admin-grid">
                            {Object.values(orders.assembly).map(order => (
                                <div key={order.id} className="admin-order-card assembly-card">
                                    <div className="card-header">
                                        <span className="order-id">№{order.id}</span>
                                        <span className="order-time">{order.deliveryTime}</span>
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
                                    <button className="capture-btn" onClick={() => handleCapture(order.id)} disabled={loading}>
                                        ✅ Списать и подтвердить
                                    </button>
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
                    {!hasCompleted ? (
                        <p className="empty-msg">Оплаченных заказов пока нет</p>
                    ) : (
                        <div className="admin-grid">
                            {Object.values(orders.completed).map(order => (
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
                                        </select>
                                    </div>
                                    <div className="card-body">
                                        <p className="customer-name">{order.customer_name}</p>
                                        <p className="order-address">📍 {order.address}</p>
                                        <p className="order-total">Сумма: <strong>{order.total} ₽</strong></p>
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

export default AdminPage;