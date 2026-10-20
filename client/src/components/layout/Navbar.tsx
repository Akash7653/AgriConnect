import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { AccountMenu } from '@/components/layout/AccountMenu';
import { BuyerMobileNavigation } from '@/components/layout/BuyerMobileNavigation';
import { useAuth } from '@/hooks/useAuth';
import { classNames } from '@/utils';
import { ModeSwitch } from './ModeSwitch';

const navLinks = [
  { label: 'The network', href: '/#about' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Partnerships', href: '/#partnerships' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const { user, isAuthenticated } = useAuth();
  const isBuyer = isAuthenticated && (user?.role === 'buyer' || user?.role === 'business');
  const isMobileStorefront = isLanding && (!user || isBuyer);
  const solid = scrolled || !isLanding;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <header
        className={classNames(
          'fixed left-0 right-0 top-0 z-50 transition-all duration-300',
          isMobileStorefront
            ? 'border-b border-white/10 bg-forest/95 py-2 backdrop-blur-md lg:py-3'
            : solid
              ? 'border-b border-white/5 bg-forest/95 py-3 backdrop-blur-md'
              : 'bg-transparent py-5'
        )}
      >
        <div className="mx-auto flex max-w-9xl items-center justify-between px-4 sm:px-8">
          <Link to="/" aria-label="AgriConnect home">
            <Logo variant="light" size="md" />
          </Link>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-[11px] font-medium uppercase tracking-wide text-ivory/70 transition-colors hover:text-ivory"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <ModeSwitch />
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ivory/80 transition-colors hover:text-ivory"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ivory/80 transition-colors hover:text-ivory"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="group flex items-center gap-1.5 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-ivory transition-colors hover:text-agri-emerald"
                >
                  Get Started
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </>
            )}
            <AccountMenu dark />
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <ModeSwitch compact />
            {!isAuthenticated && (
              <Link to="/login" className="rounded-lg px-2 py-2 text-sm font-medium text-ivory">
                Sign in
              </Link>
            )}
            <AccountMenu dark />
          </div>
        </div>
      </header>

      {isBuyer && <BuyerMobileNavigation />}
    </>
  );
}
