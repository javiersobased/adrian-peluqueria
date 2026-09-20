import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { SmoothScroll } from './components/SmoothScroll.tsx';
import { Toaster } from 'sileo';
import './index.css';
import 'sileo/styles.css';


try {
  sessionStorage.removeItem('amm_chunk_recovered_v2');
} catch {}

const rootEl = document.getElementById('root')!;

createRoot(rootEl).render(
  <StrictMode>
    <SmoothScroll>
      <App />
      <Toaster
        position="top-right"
        options={{
          duration: 2000,
          fill: '#121212',
        }}
      />
    </SmoothScroll>
  </StrictMode>
);

