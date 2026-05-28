import React from 'react';

export default function AdminPage() {
    return (
        <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>
            <h1>Админ-панель</h1>
            <p style={{ fontSize: '24px', color: 'green' }}>Hello World</p>
            <hr />
            <a href="/" style={{ color: 'blue', textDecoration: 'underline' }}>Вернуться на сайт</a>
        </div>
    );
}