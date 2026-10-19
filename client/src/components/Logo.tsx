import { classNames } from '@/utils';

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: { mark: 'h-7 w-7', text: 'text-lg' },
  md: { mark: 'h-9 w-9', text: 'text-xl' },
  lg: { mark: 'h-12 w-12', text: 'text-3xl' },
};

export function Logo({ className, showWordmark = true, variant = 'dark', size = 'md' }: LogoProps) {
  const s = sizes[size];
  return (
    <div className={classNames('flex items-center gap-2.5', className)}>
      <span className={classNames('relative inline-block', s.mark)}>
        <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
          <path
            d="M32 14 L50 52 H40 L32 32 L24 52 H14 Z"
            fill="none"
            stroke={variant === 'light' ? '#F7F5ED' : '#246B45'}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path d="M22 44 H42" stroke="#38A169" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </span>
      {showWordmark && (
        <span
          className={classNames(
            'font-display font-semibold tracking-tightest',
            s.text,
            variant === 'light' ? 'text-ivory' : 'text-forest'
          )}
        >
          Agri<span className="text-agri-emerald">Connect</span>
        </span>
      )}
    </div>
  );
}
