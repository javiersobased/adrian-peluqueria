import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { SmoothScroll } from './components/SmoothScroll.tsx';
import './index.css';
import 'sileo/styles.css';

const rootEl = document.getElementById('root')!;

createRoot(rootEl).render(
  <StrictMode>
    <SmoothScroll>
      <App />
    </SmoothScroll>
  </StrictMode>
);
