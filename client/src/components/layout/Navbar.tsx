import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, Compass, Home, LayoutGrid, Menu, Search, ShoppingBag, X, UserRound } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { classNames } from '@/utils';
import { ModeSwitch } from './ModeSwitch';
import { useAuth } from '@/hooks/useAuth';

const navLinks = [
  { label: 'The network', href: '/#about' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Partnerships', href: '/#partnerships' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const { user, isAuthenticated } = useAuth();
  const isShopper = isAuthenticated && (user?.role === 'buyer' || user?.role === 'business');
  const mobileHome = isLanding && (!user || isShopper);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [location.pathname]);

  const solid = scrolled || !isLanding;

  return (
    <>
      <header
        className={classNames(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
          mobileHome ? 'hidden lg:block' : '',
          solid
            ? 'bg-forest/95 backdrop-blur-md border-b border-white/5 py-3'
            : 'bg-transparent py-5'
        )}
      >
        <div className="mx-auto max-w-9xl px-5 sm:px-8 flex items-center justify-between">
          <Link to="/" aria-label="AgriConnect home">
            <Logo variant="light" size="md" />
          </Link>

            <nav className="hidden lg:flex items-center gap-7">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-[11px] uppercase tracking-wide text-ivory/70 hover:text-ivory transition-colors font-medium"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <ModeSwitch />
            <Link
              to="/login"
              className="text-[11px] uppercase tracking-wide text-ivory/80 hover:text-ivory font-medium px-3 py-2 transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="group text-[11px] uppercase tracking-wide font-semibold text-ivory flex items-center gap-1.5 px-2 py-2 hover:text-agri-emerald transition-colors"
            >
              Get Started
              <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>

          <button
            className="lg:hidden text-ivory p-2"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 bg-forest lg:hidden pt-24 px-6 pb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
          >
            <nav className="flex flex-col gap-1">
              {navLinks.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  className="py-3 text-lg text-ivory/90 border-b border-white/5 font-display"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </a>
              ))}
            </nav>
            <div className="mt-6 flex flex-col gap-3">
              <ModeSwitch />
              <Link
                to="/login"
                className="text-center py-3 rounded-full border border-ivory/30 text-ivory font-medium"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="text-center py-3 rounded-full bg-agri-emerald text-forest font-semibold"
              >
                Get Started
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isShopper ? (
        <nav aria-label="Buyer navigation" className="fixed bottom-0 left-0 right-0 z-50 border-t border-forest/10 bg-ivory/95 px-2 pt-2 pb-[max(0.55rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(22,35,28,0.08)] backdrop-blur-xl lg:hidden">
          <div className="relative mx-auto grid max-w-lg grid-cols-5 gap-1">
            <ShopperNavLink to="/" label="Home" active={isLanding}><Home className="h-5 w-5" /></ShopperNavLink>
            <ShopperNavLink to="/dashboard/marketplace#categories" label="Categories" active={location.pathname === '/dashboard/marketplace' && location.hash === '#categories'}><LayoutGrid className="h-5 w-5" /></ShopperNavLink>
            <ShopperNavLink to="/dashboard/marketplace#product-search" label="Search" active={location.pathname === '/dashboard/marketplace' && location.hash === '#product-search'}><Search className="h-5 w-5" /></ShopperNavLink>
            <ShopperNavLink to="/dashboard/orders" label="Orders" active={location.pathname === '/dashboard/orders'}><ShoppingBag className="h-5 w-5" /></ShopperNavLink>
            <ShopperNavLink to="/dashboard" label="Account" active={location.pathname === '/dashboard'}><UserRound className="h-5 w-5" /></ShopperNavLink>
          </div>
        </nav>
      ) : (
        (!isAuthenticated && <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-ivory/10 bg-forest/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
          <div className="mx-auto grid max-w-md grid-cols-3 gap-1 rounded-2xl border border-ivory/15 bg-forest/80 p-1">
            <a href="/" className="flex flex-col items-center gap-1 py-1 text-[10px] uppercase tracking-wide text-ivory/75"><Home className="h-4 w-4" /> Home</a>
            <a href="/#how-it-works" className="flex flex-col items-center gap-1 py-1 text-[10px] uppercase tracking-wide text-ivory/75"><Compass className="h-4 w-4" /> Explore</a>
            <Link to="/login" className="flex flex-col items-center gap-1 py-1 text-[10px] uppercase tracking-wide text-ivory/75"><UserRound className="h-4 w-4" /> Account</Link>
          </div>
        </nav>)
      )}
    </>
  );
}

function ShopperNavLink({ to, label, active, children }: { to: string; label: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={classNames(
        'flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-agri-green',
        active ? 'font-semibold text-agri-green' : 'text-charcoal/60 hover:bg-forest/5'
      )}
    >
      {children}<span>{label}</span>
    </Link>
  );
}
