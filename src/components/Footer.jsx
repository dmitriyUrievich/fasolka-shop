import React from 'react';

const Footer = () => {
    return (
        <footer className="app-footer">
            <div className="footer-content">
                <div className="footer-section about-us">
                    <h3>О нас</h3>
                    <p>Добро пожаловать в наш магазин! У нас вы можете ознакомиться с широким ассортиментом свежих, натуральных продуктов, а так же заказать доставку.</p>
                </div>
                <div className="footer-section contact-info">
                    <h3>Контакты организации </h3>
                    <p>
                        <svg className="footer-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        Южная Озереевка, пер. Торпедный, д 1,
                    </p>
                    <p>
                        <svg className="footer-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg> <a href="tel:+79887693665" className="footer-link">
                        Телефон +7 (988) 769-36-65
                    </a>
                    </p>
                    <p>
                        <svg className="footer-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-9 13h9a2 2 0 002-2V7a2 2 0 00-2-2H3a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg> <a href="mailto:elena.skryl@bk.ru" className="footer-link">
                        Email elena.skryl@bk.ru
                    </a>
                    </p>
                </div>
                <div className="footer-section hours">
                    <h3>Часы работы</h3>
                    <p>Ежедневно: <time>9:00 — 21:00</time></p>
                </div>
                <div className="footer-section legal-info">
                    <h3>Документы и реквизиты</h3>
                    <p>ИП Скрыль Елена Вячеславовна</p>
                    <p>ИНН 231511737721</p>
                    <p>ОГРНИП 323237500297466</p>
                    <ul className="legal-links">
                        <li>
                            <a href="/user-agreement.pdf" target="_blank" rel="noopener noreferrer" className="footer-link">
                                Пользовательское соглашение
                            </a>
                        </li>
                        <li>
                            <a href="/privacy-policy.pdf" target="_blank" rel="noopener noreferrer" className="footer-link">
                                Политика конфиденциальности
                            </a>
                        </li>
                    </ul>
                </div>

            </div>
            <div className="footer-bottom">
                <p suppressHydrationWarning={true} >&copy; 2026 Фасоль. Все права защищены.</p>
            </div>
        </footer>
    );
};

export default Footer;