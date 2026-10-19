import { createContext, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { classNames } from '@/utils';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles: Record<ToastTone, { icon: typeof CheckCircle2; className: string }> = {
  success: { icon: CheckCircle2, className: 'text-agri-emerald' },
  error: { icon: XCircle, className: 'text-red-400' },
  info: { icon: Info, className: 'text-sky-300' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  function showToast(message: string, tone: ToastTone = 'info') {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }].slice(-3));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3400);
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed bottom-24 right-4 z-[120] flex w-[calc(100vw-2rem)] max-w-sm flex-col items-end gap-2 sm:bottom-6">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const tone = toneStyles[toast.tone];
            const Icon = tone.icon;
            return (
              <motion.div
                key={toast.id}
                className="pointer-events-auto flex items-center gap-3 rounded-xl border border-white/10 bg-forest px-4 py-3 text-sm text-ivory shadow-cinematic"
                initial={{ opacity: 0, x: 20, y: 10 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <Icon className={classNames('h-5 w-5 shrink-0', tone.className)} />
                <span className="flex-1">{toast.message}</span>
                <button
                  type="button"
                  className="text-ivory/50 hover:text-ivory"
                  onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}