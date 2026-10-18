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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useLanguage, Language } from '../context/LanguageContext.js';
import { useTheme } from '../context/ThemeContext.js';
import { useCart } from '../context/CartContext.js';
import { UserRole } from '../types/index.js';

interface NavbarProps {
  onOpenAuth: () => void;
  onOpenAI: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAuth, onOpenAI }) => {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { totalItems } = useCart();
  const navigate = useNavigate();

  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);

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
    <header className="sticky top-0 z-40 w-full max-w-full overflow-hidden border-b border-slate-200/50 dark:border-slate-800/60 liquid-glass transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 w-full">
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

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-700 dark:text-slate-200">
          <Link to="/marketplace" className="hover:text-agri-600 dark:hover:text-agri-400 transition">
            {t('navMarketplace')}
          </Link>
          <Link to="/b2b/procurement" className="flex items-center gap-1.5 hover:text-agri-600 dark:hover:text-agri-400 transition">
            <Building2 className="w-4 h-4 text-agri-600" />
            <span>{t('navB2B')}</span>
          </Link>
          {user?.role === 'farmer' ? (
            <Link to="/farmer/dashboard" className="text-agri-700 dark:text-agri-300 font-semibold flex items-center gap-1">
              <LayoutDashboard className="w-4 h-4" />
              <span>{t('navForFarmers')}</span>
            </Link>
          ) : (
            <Link to="/farmer/dashboard" className="hover:text-agri-600 dark:hover:text-agri-400 transition">
              {t('navForFarmers')}
            </Link>
          )}
          {user?.role === 'logistics' && (
            <Link to="/logistics/dashboard" className="flex items-center gap-1 hover:text-agri-600 dark:hover:text-agri-400">
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
            className="flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 transition shadow-sm shrink-0"
            title="Ask AI Farm Advisor"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse shrink-0" />
            <span className="hidden sm:inline">AI Advisor</span>
          </button>

          {/* Language Selector */}
          <div className="relative">
            <button
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1 text-xs font-semibold"
            >
              <Globe className="w-4 h-4 text-agri-700 dark:text-agri-400" />
              <span className="uppercase">{language}</span>
            </button>
            {langMenuOpen && (
              <div className="absolute right-0 mt-2 w-32 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 text-sm z-50">
                <button
                  onClick={() => {
                    setLanguage('en');
                    setLangMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-agri-50 dark:hover:bg-slate-800 flex items-center justify-between ${
                    language === 'en' ? 'font-bold text-agri-700' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>English</span>
                  {language === 'en' && <span>✓</span>}
                </button>
                <button
                  onClick={() => {
                    setLanguage('te');
                    setLangMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-agri-50 dark:hover:bg-slate-800 flex items-center justify-between ${
                    language === 'te' ? 'font-bold text-agri-700' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>తెలుగు (Telugu)</span>
                  {language === 'te' && <span>✓</span>}
                </button>
                <button
                  onClick={() => {
                    setLanguage('hi');
                    setLangMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-agri-50 dark:hover:bg-slate-800 flex items-center justify-between ${
                    language === 'hi' ? 'font-bold text-agri-700' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>हिंदी (Hindi)</span>
                  {language === 'hi' && <span>✓</span>}
                </button>
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Toggle Light/Dark Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Shopping Cart Button */}
          <Link
            to="/cart"
            className="relative p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="View Cart"
          >
            <ShoppingCart className="w-5 h-5 text-forest dark:text-emerald-400" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-emerald-600 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center animate-bounce shadow">
                {totalItems}
              </span>
            )}
          </Link>

          {/* User / Sign In */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                className="flex items-center gap-2 py-1.5 px-3 rounded-xl bg-agri-50 dark:bg-slate-800 border border-agri-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold hover:border-agri-400 transition"
              >
                <div className="w-6 h-6 rounded-full bg-agri-600 text-white flex items-center justify-center text-xs font-bold">
                  {user.name.charAt(0)}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="leading-none font-bold truncate max-w-[100px]">{user.name}</p>
                  <p className="text-[10px] text-agri-700 dark:text-agri-300 uppercase font-semibold">{user.role}</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {roleMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 text-sm z-50">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{user.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>

                  <Link
                    to={getDashboardRoute(user.role)}
                    onClick={() => setRoleMenuOpen(false)}
                    className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-agri-50 dark:hover:bg-slate-800 flex items-center gap-2"
                  >
                    <LayoutDashboard className="w-4 h-4 text-agri-600" />
                    <span>My Dashboard</span>
                  </Link>

                  <button
                    onClick={() => {
                      logout();
                      setRoleMenuOpen(false);
                      navigate('/');
                    }}
                    className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-agri-700 hover:bg-agri-800 text-white text-xs font-semibold shadow-md shadow-agri-800/20 transition-all hover:scale-[1.02]"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>{t('navSignIn')}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
