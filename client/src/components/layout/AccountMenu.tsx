import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, UserRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import type { UserRole } from '@/types';
import { classNames } from '@/utils';

const accountLinks: Record<UserRole, { label: string; to: string }[]> = {
  buyer: [
    { label: 'My dashboard', to: '/dashboard' },
    { label: 'My orders', to: '/dashboard/orders' },
    { label: 'Continue shopping', to: '/dashboard/marketplace' },
  ],
  business: [
    { label: 'My dashboard', to: '/dashboard' },
    { label: 'My orders', to: '/dashboard/orders' },
    { label: 'Continue shopping', to: '/dashboard/marketplace' },
  ],
  farmer: [
    { label: 'Farmer dashboard', to: '/dashboard' },
    { label: 'Crop listings', to: '/dashboard/listings' },
    { label: 'Orders', to: '/dashboard/orders' },
    { label: 'Payouts', to: '/dashboard/payouts' },
  ],
  admin: [
    { label: 'Admin dashboard', to: '/dashboard' },
    { label: 'Users', to: '/dashboard/users' },
    { label: 'Orders', to: '/dashboard/orders' },
  ],
  logistics: [
    { label: 'Delivery dashboard', to: '/dashboard' },
    { label: 'Pickups', to: '/dashboard/pickups' },
    { label: 'Deliveries', to: '/dashboard/deliveries' },
  ],
};

export function AccountMenu({ dark = false }: { dark?: boolean }) {
  const { user, isAuthenticated, signOut } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuId = useId();

  function handleSignOut() {
    signOut();
    setOpen(false);
    showToast('You have been signed out.', 'success');
    navigate('/');
  }

  const buttonClass = classNames(
    'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-agri-emerald',
    dark
      ? 'border-ivory/20 text-ivory hover:bg-ivory/10'
      : 'border-forest/15 bg-white/70 text-forest hover:bg-forest/5'
  );

  return (
    <div className="relative">
      <button
        type="button"
        className={buttonClass}
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-label="Open account"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
      >
        <UserRound className="h-5 w-5" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={user ? `${user.fullName || 'Account'} menu` : 'Account menu'}
          className="absolute right-0 top-[calc(100%+0.6rem)] z-[70] w-60 overflow-hidden rounded-2xl border border-forest/10 bg-ivory p-2 text-forest shadow-xl"
        >
          {isAuthenticated && user ? (
            <>
              <div className="border-b border-forest/10 px-3 py-2">
                <p className="truncate text-sm font-semibold">{user.fullName || 'AgriConnect user'}</p>
                <p className="truncate text-xs text-charcoal/55">{user.email}</p>
              </div>
              {(accountLinks[user.role] ?? accountLinks.buyer).map((item) => (
                <Link
                  key={item.to}
                  role="menuitem"
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2.5 text-sm hover:bg-forest/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-agri-green"
                >
                  {item.label}
                </Link>
              ))}
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </>
          ) : (
            <>
              <Link role="menuitem" to="/login" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm hover:bg-forest/5">
                Sign in
              </Link>
              <Link role="menuitem" to="/register" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm hover:bg-forest/5">
                Create account
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
