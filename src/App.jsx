// src/App.jsx
import React, {useEffect} from 'react';
import { Routes, Route } from 'react-router-dom';
import MainPage from "./pages/MainPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import {useHydration} from "./hooks/useHydration.js";
import './MainPage.css'
import "./index.css"

function App({ initialData }) {
    const hydrated = useHydration();

    // Единая логика удаления лоадера для всего приложения
    useEffect(() => {
        if (hydrated) {
            const loader = document.getElementById('global-loader');
            if (loader) {
                loader.classList.add('fade-out');
                const timeout = setTimeout(() => {
                    loader.remove();
                }, 500); // время должно совпадать с длительностью анимации в CSS
                return () => clearTimeout(timeout);
            }
        }
    }, [hydrated]);
  return (
      <Routes>
        <Route path="/" element={<MainPage initialData={initialData} />} />
        <Route path="/admin" element={<AdminPage initialData={initialData} />} />
      </Routes>
  );
}

export default App;