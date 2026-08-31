import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './index.css';
import { applySkin, loadStoredSkin } from './lib/skins';

// Paletu zapíšeme na <html> ešte pred prvým renderom, aby stránka nenaskočila
// v cudzích farbách a aby Tailwind mal svoje CSS premenné hneď k dispozícii.
applySkin(loadStoredSkin());

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
