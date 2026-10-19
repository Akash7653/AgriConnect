import { useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/hooks/useAuth';
import { classNames } from '@/utils';
import {
  Sprout,
  Store,
  Truck,
  LayoutDashboard,
  ShoppingBag,
  Wallet,
  Truck as TruckIcon,
  Users,
  Package,
  ClipboardList,
  LogOut,
  Info,
  MoreHorizontal,
} from 'lucide-react';
import type { UserRole } from '@/types';

export interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
}

export const navByRole: Record<UserRole, NavItem[]> = {
  farmer: [
    { label: 'Overview', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Marketplace', to: '/dashboard/marketplace', icon: Store },
    { label: 'Crop Listings', to: '/dashboard/listings', icon: Sprout },
    { label: 'Orders', to: '/dashboard/orders', icon: ShoppingBag },
    { label: 'Payouts', to: '/dashboard/payouts', icon: Wallet },
    { label: 'Insights', to: '/dashboard/insights', icon: Package },
  ],
  buyer: [
    { label: 'Overview', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Marketplace', to: '/dashboard/marketplace', icon: Store },
    { label: 'Orders', to: '/dashboard/orders', icon: ShoppingBag },
    { label: 'Suppliers', to: '/dashboard/suppliers', icon: Users },
    { label: 'Invoices', to: '/dashboard/invoices', icon: ClipboardList },
  ],
  logistics: [
    { label: 'Overview', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Marketplace', to: '/dashboard/marketplace', icon: Store },
    { label: 'Pickups', to: '/dashboard/pickups', icon: TruckIcon },
    { label: 'Deliveries', to: '/dashboard/deliveries', icon: Truck },
  ],
  admin: [
    { label: 'Overview', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Users', to: '/dashboard/users', icon: Users },
    { label: 'Marketplace', to: '/dashboard/marketplace', icon: Store },
    { label: 'Orders', to: '/dashboard/orders', icon: ShoppingBag },
  ],
};

interface DashboardShellProps {
  role: UserRole;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function DashboardShell({ role, title, subtitle, children }: DashboardShellProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const nav = navByRole[role];
  const visibleMobileNav = nav.slice(0, 3);
  const overflowMobileNav = nav.slice(3);

  function handleSignOut() {
    signOut();
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-ivory flex">
      <aside
        className={classNames(
          'hidden lg:flex sticky top-0 left-0 h-screen w-72 bg-forest text-ivory z-40 flex-col'
        )}
      >
        <div className="p-6 flex items-center justify-between">
          <Link to="/">
            <Logo variant="light" size="md" />
          </Link>
        </div>

        <div className="px-6 pb-4">
          <p className="text-xs text-ivory/40 tracking-ultra-wide uppercase">{role} dashboard</p>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                classNames(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
                  isActive
                    ? 'bg-ivory/10 text-ivory font-medium'
                    : 'text-ivory/60 hover:bg-ivory/5 hover:text-ivory'
                )
              }
            >
              <item.icon className="h-4 w-4" strokeWidth={1.5} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-ivory/10">
          {role === 'buyer' || role === 'admin' ? (
            <Link
              to="/dashboard/marketplace"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-ivory/60 hover:bg-ivory/5 hover:text-ivory transition-colors"
            >
              <Store className="h-4 w-4" strokeWidth={1.5} /> Marketplace
            </Link>
          ) : null}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-ivory/60 hover:bg-ivory/5 hover:text-ivory transition-colors"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-20 bg-ivory/90 backdrop-blur border-b border-forest/10 px-5 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="font-display text-xl sm:text-2xl text-forest tracking-tightest">{title}</h1>
              {subtitle && <p className="text-sm text-charcoal/55 hidden sm:block">{subtitle}</p>}
            </div>
          </div>
          <span className="text-xs bg-soil/10 text-soil-dark px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <Info className="h-3 w-3" /> Demo data
          </span>
        </header>

        <main className="p-5 pb-24 sm:p-8 sm:pb-24 lg:pb-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {children}
          </motion.div>
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-forest/10 bg-ivory/95 px-2 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(22,35,28,0.08)] backdrop-blur-xl lg:hidden">
          {mobileMenuOpen && (
            <div className="absolute bottom-[calc(100%+0.5rem)] left-3 right-3 rounded-2xl border border-forest/15 bg-ivory p-2 shadow-cinematic">
              <div className="grid grid-cols-2 gap-1">
                {overflowMobileNav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/dashboard'}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      classNames(
                        'flex items-center gap-2 rounded-xl px-3 py-3 text-sm transition-colors',
                        isActive ? 'bg-forest text-ivory' : 'text-forest hover:bg-forest/5'
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.7} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
                <Link
                  to="/dashboard/marketplace"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm text-forest transition-colors hover:bg-forest/5"
                >
                  <Store className="h-4 w-4 shrink-0" strokeWidth={1.7} />
                  <span>Marketplace</span>
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-2 rounded-xl px-3 py-3 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.7} />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
          <div className="mx-3 mb-1 grid max-w-2xl grid-cols-4 gap-1 rounded-2xl border border-forest/15 bg-ivory p-1 sm:mx-auto">
            {visibleMobileNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) =>
                  classNames(
                    'flex min-w-0 w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-center text-[10px] font-medium uppercase leading-tight tracking-wide transition-colors',
                    isActive ? 'bg-forest text-ivory' : 'text-charcoal/55 hover:bg-forest/5 hover:text-forest'
                  )
                }
              >
                <item.icon className="h-4 w-4" strokeWidth={1.7} />
                <span className="flex min-h-[24px] items-center justify-center">{item.label}</span>
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((isOpen) => !isOpen)}
              aria-expanded={mobileMenuOpen}
              className={classNames(
                'flex min-w-0 w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-center text-[10px] font-medium uppercase leading-tight tracking-wide transition-colors',
                mobileMenuOpen ? 'bg-forest text-ivory' : 'text-charcoal/55 hover:bg-forest/5 hover:text-forest'
              )}
            >
              <MoreHorizontal className="h-4 w-4" strokeWidth={1.7} />
              <span className="flex min-h-[24px] items-center justify-center">More</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'forest',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'forest' | 'emerald' | 'soil';
}) {
  const tones = {
    forest: 'text-forest',
    emerald: 'text-agri-emerald',
    soil: 'text-soil',
  };
  return (
    <div className="bg-white rounded-2xl border border-forest/8 p-6">
      <p className="text-sm text-charcoal/55">{label}</p>
      <p className={classNames('font-display text-3xl mt-2', tones[tone])}>{value}</p>
      {hint && <p className="text-xs text-charcoal/45 mt-2">{hint}</p>}
    </div>
  );
}

export function DataTable({
  columns,
  rows,
}: {
  columns: { key: string; label: string; className?: string }[];
  rows: Record<string, ReactNode>[];
}) {
  return (
    <div className="bg-white rounded-2xl border border-forest/8 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-forest/5 text-left">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={classNames('px-5 py-3 font-medium text-charcoal/60', c.className)}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-forest/5">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-forest/3">
                {columns.map((c) => (
                  <td key={c.key} className={classNames('px-5 py-4 text-forest', c.className)}>
                    {row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tones: Record<string, string> = {
    pending: 'bg-soil/10 text-soil-dark',
    confirmed: 'bg-agri-emerald/15 text-agri-emerald',
    harvesting: 'bg-agri-emerald/15 text-agri-emerald',
    in_transit: 'bg-forest/10 text-forest',
    delivered: 'bg-forest/15 text-forest',
    completed: 'bg-forest/15 text-forest',
    cancelled: 'bg-red-100 text-red-600',
    assigned: 'bg-soil/10 text-soil-dark',
    in_progress: 'bg-agri-emerald/15 text-agri-emerald',
    processed: 'bg-forest/10 text-forest',
    paid: 'bg-forest/15 text-forest',
  };
  const labels: Record<string, string> = {
    in_transit: 'In Transit',
    in_progress: 'In Progress',
  };
  return (
    <span
      className={classNames(
        'inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize',
        tones[status] ?? 'bg-charcoal/10 text-charcoal/60'
      )}
    >
      {labels[status] ?? status.replace('_', ' ')}
    </span>
  );
}
