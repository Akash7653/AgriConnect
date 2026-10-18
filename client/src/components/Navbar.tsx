import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sprout,
  ShoppingCart,
  Sun,
  Moon,
  Globe,
  User as UserIcon,
  LogOut,
  ChevronDown,
  LayoutDashboard,
  Truck,
  ShieldCheck,
  Building2,
  Sparkles,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useLanguage } from '../context/LanguageContext.js';
import { useTheme } from '../context/ThemeContext.js';
import { useCart } from '../context/CartContext.js';
import { UserRole } from '../types/index.js';

interface NavbarProps {
  onOpenAuth: () => void;
  onOpenAI: () => void;
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAuth,
  onOpenAI,
  onToggleSidebar,
  sidebarCollapsed,
}) => {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { totalItems } = useCart();
  const navigate = useNavigate();

  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getDashboardRoute = (role: UserRole) => {
    switch (role) {
      case 'farmer':
        return '/farmer/dashboard';
      case 'business':
        return '/b2b/procurement';
      case 'logistics':
        return '/logistics/dashboard';
      case 'admin':
        return '/admin/dashboard';
      default:
        return '/buyer/dashboard';
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full max-w-full overflow-visible border-b border-slate-200/60 dark:border-slate-800/80 liquid-glass transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 w-full">
        {/* Left Section: Sidenav Toggle + Brand Logo */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Desktop Sidenav Collapse Toggle (Active when logged in) */}
          {user && onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="hidden md:flex p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={sidebarCollapsed ? 'Expand Sidenav' : 'Collapse Sidenav'}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <PanelLeftClose className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              )}
            </button>
          )}

          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-agri-600 to-forest flex items-center justify-center text-white shadow-md shadow-agri-700/20 group-hover:scale-105 transition-transform shrink-0">
              <Sprout className="w-5 h-5 text-emerald-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-forest dark:text-emerald-400">
                  AgriConnect
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-tight truncate hidden xs:block">
                From Farm to Every Table
              </p>
            </div>
          </Link>
        </div>

        {/* Desktop Nav Links (Visible on screens >= 1024px) */}
        <nav className="hidden lg:flex items-center gap-3 xl:gap-6 text-xs xl:text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Link to="/marketplace" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition">
            {t('navMarketplace')}
          </Link>
          <Link
            to="/b2b/procurement"
            className="flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
          >
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span>{t('navB2B')}</span>
          </Link>
          <Link to="/farmer/dashboard" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition">
            {t('navForFarmers')}
          </Link>
          {user?.role === 'logistics' && (
            <Link to="/logistics/dashboard" className="flex items-center gap-1 hover:text-emerald-600">
              <Truck className="w-4 h-4" />
              <span>{t('navLogistics')}</span>
            </Link>
          )}
          {user?.role === 'admin' && (
            <Link to="/admin/dashboard" className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>{t('navAdmin')}</span>
            </Link>
          )}
        </nav>

        {/* Right Action Icons */}
        <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
          {/* AI Advisor Button */}
          <button
            onClick={onOpenAI}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 transition shadow-sm shrink-0"
            title="Ask AI Farm Advisor"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse shrink-0" />
            <span className="hidden sm:inline">AI Advisor</span>
          </button>

          {/* Language Selector Dropdown (Fixed Overflow) */}
          <div className="relative">
            <button
              onClick={() => {
                setLangMenuOpen(!langMenuOpen);
                setRoleMenuOpen(false);
              }}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1 text-xs font-bold"
              title="Change Language"
            >
              <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="uppercase">{language}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {langMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setLangMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-44 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl py-1.5 text-xs z-50">
                  <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-400">
                    Select Language
                  </div>
                  <button
                    onClick={() => {
                      setLanguage('en');
                      setLangMenuOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 hover:bg-emerald-50 dark:hover:bg-slate-800 flex items-center justify-between ${
                      language === 'en' ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>English</span>
                    {language === 'en' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  </button>
                  <button
                    onClick={() => {
                      setLanguage('te');
                      setLangMenuOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 hover:bg-emerald-50 dark:hover:bg-slate-800 flex items-center justify-between ${
                      language === 'te' ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>తెలుగు (Telugu)</span>
                    {language === 'te' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  </button>
                  <button
                    onClick={() => {
                      setLanguage('hi');
                      setLangMenuOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 hover:bg-emerald-50 dark:hover:bg-slate-800 flex items-center justify-between ${
                      language === 'hi' ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>हिंदी (Hindi)</span>
                    {language === 'hi' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Toggle Light/Dark Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Shopping Cart Button */}
          <Link
            to="/cart"
            className="relative p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="View Cart"
          >
            <ShoppingCart className="w-5 h-5 text-forest dark:text-emerald-400" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-emerald-600 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center animate-bounce shadow">
                {totalItems}
              </span>
            )}
          </Link>

          {/* User Sign In / Profile Avatar */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => {
                  setRoleMenuOpen(!roleMenuOpen);
                  setLangMenuOpen(false);
                }}
                className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold hover:border-emerald-500 transition"
              >
                <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {user.name.charAt(0)}
                </div>
                <div className="text-left hidden sm:block max-w-[80px] xl:max-w-[120px]">
                  <p className="leading-none font-bold truncate text-[11px]">{user.name}</p>
                  <p className="text-[9px] text-emerald-600 dark:text-emerald-400 uppercase font-bold truncate">{user.role}</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {roleMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setRoleMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl py-2 text-xs z-50">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                      <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{user.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                    </div>

                    <Link
                      to={getDashboardRoute(user.role)}
                      onClick={() => setRoleMenuOpen(false)}
                      className="w-full text-left px-3.5 py-2 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-800 flex items-center gap-2 font-medium"
                    >
                      <LayoutDashboard className="w-4 h-4 text-emerald-600" />
                      <span>My Dashboard</span>
                    </Link>

                    <button
                      onClick={() => {
                        logout();
                        setRoleMenuOpen(false);
                        navigate('/');
                      }}
                      className="w-full text-left px-3.5 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 font-medium"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-forest hover:bg-forest-light text-white text-xs font-semibold shadow-md shadow-forest/20 transition-all hover:scale-[1.02] shrink-0"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">{t('navSignIn')}</span>
              <span className="xs:hidden">Login</span>
            </button>
          )}

          {/* Tablet/Mobile Full Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Responsive Slide-Down Drawer for Tablet/Mobile Nav Items */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl px-4 py-3 space-y-2 text-xs font-semibold shadow-2xl animate-in slide-in-from-top-2 duration-200">
          <Link
            to="/marketplace"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-800"
          >
            <Sprout className="w-4 h-4 text-emerald-600" />
            <span>{t('navMarketplace')}</span>
          </Link>
          <Link
            to="/b2b/procurement"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-800"
          >
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span>{t('navB2B')}</span>
          </Link>
          <Link
            to="/farmer/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-800"
          >
            <LayoutDashboard className="w-4 h-4 text-emerald-600" />
            <span>{t('navForFarmers')}</span>
          </Link>
          {user?.role === 'logistics' && (
            <Link
              to="/logistics/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-800"
            >
              <Truck className="w-4 h-4 text-emerald-600" />
              <span>{t('navLogistics')}</span>
            </Link>
          )}
          {user?.role === 'admin' && (
            <Link
              to="/admin/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 p-2 rounded-xl text-purple-600 dark:text-purple-400 hover:bg-purple-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{t('navAdmin')}</span>
            </Link>
          )}
        </div>
      )}
    </header>
  );
};
