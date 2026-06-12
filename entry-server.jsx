import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { StaticRouter } from 'react-router-dom'
import App from './src/App.jsx';

export function render(url, initialData) {
    const appHtml = ReactDOMServer.renderToString(
        <React.StrictMode>
            <StaticRouter location={url}>
                <App initialData={initialData} />
            </StaticRouter>
        </React.StrictMode>
    );
    return { appHtml };
}
