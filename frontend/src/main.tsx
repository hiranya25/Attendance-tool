import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';
import { startStackTables } from './lib/stackTables';
import { applyTheme, savedTheme } from './lib/theme';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

applyTheme(savedTheme());
startStackTables();
