import type { ReactNode } from 'react';
import { Home, ShoppingCart, Store, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';

export function PublicMobileNavigation() {
  const { isAuthenticated } = useAuth();
  const { totalItems } = useCart();
  const cartPath = '/dashboard/marketplace#cart';

  return (
    <nav
      aria-label="Mobile landing navigation"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-forest/10 bg-ivory/95 px-2 pt-2 pb-[max(0.55rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(22,35,28,0.08)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
        <LandingNavLink to="/" label="Home" active>
          <Home className="h-5 w-5" />
        </LandingNavLink>
        <LandingNavLink to="/shop" label="Shop">
          <Store className="h-5 w-5" />
        </LandingNavLink>
        <LandingNavLink to={cartPath} label="Cart" badge={totalItems}>
          <ShoppingCart className="h-5 w-5" />
        </LandingNavLink>
        <LandingNavLink to={isAuthenticated ? '/dashboard' : '/login'} label="Account">
          <UserRound className="h-5 w-5" />
        </LandingNavLink>
      </div>
    </nav>
  );
}

function LandingNavLink({
  to,
  label,
  active = false,
  badge,
  children,
}: {
  to: string;
  label: string;
  active?: boolean;
  badge?: number;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      aria-label={label === 'Cart' ? `Cart, ${badge ?? 0} items` : label}
      className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-agri-green ${
        active ? 'font-semibold text-agri-green' : 'text-charcoal/60 hover:bg-forest/5'
      }`}
    >
      {children}
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute right-[calc(50%-1.15rem)] top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-agri-emerald px-1 text-[9px] font-bold text-forest">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}
