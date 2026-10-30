import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './app/store';
import App from './App';
import './styles.css';
import { isDesktop } from './app/desktop';
document.documentElement.dataset.desktop = String(isDesktop());
document.documentElement.dataset.inputModality = 'pointer';
document.documentElement.dataset.view =
  new URLSearchParams(window.location.search).get('view') === 'panel' ? 'panel' : 'workspace';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
);
