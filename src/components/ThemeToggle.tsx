import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('adrian_theme');
      if (saved === 'dark') return 'dark';
      return 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const isLight = theme === 'light';
    document.documentElement.classList.toggle('light-mode', isLight);
    localStorage.setItem('adrian_theme', theme);

    // Update meta theme-color for mobile address bar
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isLight ? '#faf8f5' : '#0a0a0a');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const isLight = theme === 'light';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      title={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      className="theme-toggle-btn group relative flex h-11 w-11 items-center justify-center rounded-full transition-all duration-300 active:scale-95 shadow-lg backdrop-blur-xl border"
    >
      {isLight ? (
        <Moon className="h-5 w-5 text-stone-800 transition-transform duration-300 group-hover:-rotate-12" />
      ) : (
        <Sun className="h-5 w-5 text-zinc-300 transition-transform duration-300 group-hover:rotate-45 group-hover:text-gold" />
      )}

      {/* Discreet tooltip */}
      <span className="theme-toggle-tooltip pointer-events-none absolute right-14 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100 shadow-md">
        {isLight ? 'Modo oscuro' : 'Modo claro'}
      </span>
    </button>
  );
}
