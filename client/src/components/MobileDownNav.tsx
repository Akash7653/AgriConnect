import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Store, ShoppingCart, Building2, UserCircle2 } from 'lucide-react';
import { useCart } from '../context/CartContext.js';
import { useAuth } from '../context/AuthContext.js';

interface MobileDownNavProps {
  onOpenAuth: () => void;
}

export const MobileDownNav: React.FC<MobileDownNavProps> = ({ onOpenAuth }) => {
  const location = useLocation();
  const { totalItems } = useCart();
  const { user } = useAuth();

  const getDashboardPath = () => {
    if (!user) return null;
    switch (user.role) {
      case 'farmer':
        return '/farmer/dashboard';
      case 'buyer':
        return '/buyer/dashboard';
      case 'business':
        return '/b2b/procurement';
      case 'logistics':
        return '/logistics/dashboard';
      case 'admin':
        return '/admin/dashboard';
      default:
        return '/marketplace';
    }
  };

  const dashboardPath = getDashboardPath();

  const navItems = [
    {
      label: 'Home',
      to: '/',
      icon: Home,
      exact: true,
    },
    {
      label: 'Market',
      to: '/marketplace',
      icon: Store,
    },
    {
      label: 'Cart',
      to: '/cart',
      icon: ShoppingCart,
      badge: totalItems > 0 ? totalItems : null,
    },
    {
      label: 'B2B Bulk',
      to: '/b2b/procurement',
      icon: Building2,
    },
  ];

  return (
    <nav
      aria-label="Mobile Down Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 w-full max-w-full overflow-hidden bg-white/90 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-1 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] select-none"
    >
      <div className="w-full max-w-md mx-auto grid grid-cols-5 items-center">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`relative flex flex-col items-center justify-center min-w-0 py-1 px-0.5 rounded-lg transition-colors ${
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4px]' : 'stroke-2'}`} />
                {item.badge !== null && item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 bg-emerald-600 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center shadow-sm">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-full text-center">
                {item.label}
              </span>
              {isActive && (
                <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              )}
            </NavLink>
          );
        })}

        {/* Profile / Dashboard tab */}
        {dashboardPath ? (
          <NavLink
            to={dashboardPath}
            className={`relative flex flex-col items-center justify-center min-w-0 py-1 px-0.5 rounded-lg transition-colors ${
              location.pathname.includes('dashboard')
                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
            }`}
          >
            <UserCircle2 className="w-5 h-5 stroke-[2.2px]" />
            <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-full text-center">
              Profile
            </span>
            {location.pathname.includes('dashboard') && (
              <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            )}
          </NavLink>
        ) : (
          <button
            onClick={onOpenAuth}
            className="relative flex flex-col items-center justify-center min-w-0 py-1 px-0.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 font-medium transition-colors"
          >
            <UserCircle2 className="w-5 h-5 stroke-2" />
            <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-full text-center">
              Sign In
            </span>
          </button>
        )}
      </div>
    </nav>
  );
};
