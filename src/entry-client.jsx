// src/entry-client.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

const initialData = window.__INITIAL_DATA__

ReactDOM.hydrateRoot(
    document.getElementById('root'),
    <BrowserRouter>
        <App initialData={initialData} />
    </BrowserRouter>
)