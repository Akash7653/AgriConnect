import { classNames } from '@/utils';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: 'bg-agri-emerald text-forest hover:bg-ivory',
  secondary: 'bg-forest text-ivory hover:bg-forest-800',
  outline: 'border border-forest/20 text-forest hover:bg-forest hover:text-ivory',
  ghost: 'text-forest hover:bg-forest/5',
};

const sizes: Record<Size, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
};

export function Button({ variant = 'primary', size = 'md', className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={classNames(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-agri-emerald focus-visible:ring-offset-2',
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export function Input({ label, error, icon, className, id, ...rest }: InputProps) {
  const inputId = id ?? rest.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-forest mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal/40">{icon}</span>
        )}
        <input
          id={inputId}
          className={classNames(
            'w-full rounded-xl border bg-white/60 px-4 py-3 text-forest placeholder:text-charcoal/40 transition-colors dark-mode-input',
            'focus:outline-none focus:ring-2 focus:ring-agri-emerald focus:border-agri-emerald',
            error ? 'border-red-400' : 'border-forest/15',
            icon ? 'pl-11' : false,
            className
          )}
          {...rest}
        />
      </div>
      {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
    </div>
  );
}

export function Badge({
  children,
  tone = 'green',
}: {
  children: ReactNode;
  tone?: 'green' | 'emerald' | 'soil' | 'muted';
}) {
  const tones = {
    green: 'bg-forest/10 text-agri-green',
    emerald: 'bg-agri-emerald/15 text-agri-emerald',
    soil: 'bg-soil/10 text-soil',
    muted: 'bg-charcoal/10 text-charcoal/60',
  };
  return (
    <span className={classNames('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium', tones[tone])}>
      {children}
    </span>
  );
}
