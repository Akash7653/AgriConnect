import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const STORAGE_KEY = 'agriconnect-color-mode';

export function ModeSwitch({ compact = false }: { compact?: boolean }) {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', dark);
  }, [dark]);

  function toggleMode() {
    const next = !dark;
    setDark(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
    } catch (error) {
      console.warn('Color mode preference could not be saved.', error);
    }
    document.documentElement.classList.toggle('dark-mode', next);
  }

  return (
    <button
      type="button"
      onClick={toggleMode}
      className={compact
        ? 'h-10 w-10 inline-flex items-center justify-center rounded-full border border-ivory/20 text-ivory hover:bg-ivory/10 transition-colors'
        : 'self-start inline-flex items-center gap-2 rounded-full border border-ivory/20 px-3 py-2 text-[10px] uppercase tracking-wide text-ivory/80 hover:bg-ivory/10 transition-colors'}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {!compact && <span>{dark ? 'Light' : 'Dark'}</span>}
    </button>
  );
}