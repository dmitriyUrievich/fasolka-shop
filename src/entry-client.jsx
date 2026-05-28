import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';

ReactDOM.hydrateRoot(
    document.getElementById('root'),
    <React.StrictMode>
        <BrowserRouter>
            <App initialData={window.__INITIAL_DATA__} />
        </BrowserRouter>
    </React.StrictMode>
);