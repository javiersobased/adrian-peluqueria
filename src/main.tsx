import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const rootEl = document.getElementById('root')!;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const missingEnv = !supabaseUrl || !supabaseAnonKey;

// Loading the real app (and therefore src/lib/supabase.ts, which calls
// createClient at import time) is deferred behind this check. If the
// Supabase env vars are missing — e.g. a fresh Vercel project that hasn't
// had them added yet — we show a clear, actionable message instead of a
// blank black screen with a cryptic "Invalid supabaseUrl" console error.
if (missingEnv) {
  rootEl.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0a;color:#e4e4e7;font-family:system-ui,-apple-system,sans-serif;padding:24px;text-align:center;">
      <div style="max-width:440px;">
        <div style="width:52px;height:52px;border-radius:16px;background:linear-gradient(135deg,#d4af37,#e6c84e,#b8941f);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-weight:800;font-size:22px;color:#0a0a0a;">!</div>
        <h1 style="font-size:18px;font-weight:700;margin:0 0 10px;">Configuración incompleta</h1>
        <p style="font-size:13px;color:#a1a1aa;line-height:1.6;margin:0;">
          Faltan las variables de entorno de Supabase (<code style="color:#e6c84e;">VITE_SUPABASE_URL</code> y
          <code style="color:#e6c84e;">VITE_SUPABASE_ANON_KEY</code>).<br /><br />
          Añádelas en Vercel → Settings → Environment Variables y vuelve a desplegar.
        </p>
      </div>
    </div>
  `;
} else {
  import('./App.tsx').then(({ default: App }) => {
    createRoot(rootEl).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  });
}
