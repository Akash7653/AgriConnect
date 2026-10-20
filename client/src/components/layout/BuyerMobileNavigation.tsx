import type { ReactNode } from 'react';
import { Home, LayoutGrid, ShoppingBag, ShoppingCart } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '@/hooks/useCart';
import { classNames } from '@/utils';

export function BuyerMobileNavigation() {
  const location = useLocation();
  const { totalItems } = useCart();
  const inMarketplace = location.pathname === '/dashboard/marketplace';

  return (
    <nav
      aria-label="Buyer navigation"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-forest/10 bg-ivory/95 px-2 pt-2 pb-[max(0.55rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(22,35,28,0.08)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
        <BuyerNavLink to="/" label="Home" active={location.pathname === '/'}>
          <Home className="h-5 w-5" />
        </BuyerNavLink>
        <BuyerNavLink
          to="/dashboard/marketplace#categories"
          label="Categories"
          active={inMarketplace && location.hash === '#categories'}
        >
          <LayoutGrid className="h-5 w-5" />
        </BuyerNavLink>
        <BuyerNavLink to="/dashboard/orders" label="Orders" active={location.pathname === '/dashboard/orders'}>
          <ShoppingBag className="h-5 w-5" />
        </BuyerNavLink>
        <BuyerNavLink
          to="/dashboard/marketplace#cart"
          label="Cart"
          active={inMarketplace && location.hash === '#cart'}
          badge={totalItems}
        >
          <ShoppingCart className="h-5 w-5" />
        </BuyerNavLink>
      </div>
    </nav>
  );
}

function BuyerNavLink({
  to,
  label,
  active,
  badge,
  children,
}: {
  to: string;
  label: string;
  active: boolean;
  badge?: number;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      aria-label={label === 'Cart' ? `Cart, ${badge ?? 0} items` : label}
      className={classNames(
        'relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-agri-green',
        active ? 'font-semibold text-agri-green' : 'text-charcoal/60 hover:bg-forest/5'
      )}
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
