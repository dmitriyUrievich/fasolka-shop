import React from 'react';
import ReactDOMServer from 'react-dom/server';
import App from './src/App';

export function render(initialData) {

  const appHtml = ReactDOMServer.renderToString(
    <React.StrictMode>
        <App initialData={initialData} />
    </React.StrictMode>
  );

  return { appHtml };
}
