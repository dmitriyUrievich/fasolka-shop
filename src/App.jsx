import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ShopPage from './pages/ShopPage';
import AdminPage from './pages/AdminPage';
import './App.css';

function App({ initialData }) {
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