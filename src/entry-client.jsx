import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const initialData = window.__INITIAL_DATA__;
const rootElement = document.getElementById('root');

ReactDOM.hydrateRoot(
    rootElement,
    <React.StrictMode>
        <App initialData={initialData} />
    </React.StrictMode>
);