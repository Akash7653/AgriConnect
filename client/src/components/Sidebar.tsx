import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Sprout,
  Store,
  LayoutDashboard,
  ShoppingCart,
  Building2,
  Truck,
  ShieldCheck,
  Sparkles,
  LogOut,
  Sun,
  Moon,
  Globe,
  CheckCircle2,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useLanguage } from '../context/LanguageContext.js';
import { useTheme } from '../context/ThemeContext.js';
import { useCart } from '../context/CartContext.js';

interface SidebarProps {
  onOpenAI: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenAI, collapsed, onToggleCollapse }) => {
  const { user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const getRoleBadge = () => {
    switch (user.role) {
      case 'farmer':
        return { label: '🌾 Farmer', color: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' };
      case 'buyer':
        return { label: '🛒 Buyer', color: 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800' };
      case 'business':
        return { label: '🏨 B2B Commercial', color: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800' };
      case 'logistics':
        return { label: '🚚 Logistics Fleet', color: 'bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-800' };
      case 'admin':
        return { label: '👑 Admin', color: 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800' };
      default:
        return { label: 'User', color: 'bg-slate-100 text-slate-800' };
    }
  };

  const badge = getRoleBadge();

  const getNavLinks = () => {
    switch (user.role) {
      case 'farmer':
        return [
          { label: 'Farmer Dashboard', to: '/farmer/dashboard', icon: LayoutDashboard },
          { label: 'Marketplace', to: '/marketplace', icon: Store },
          { label: 'B2B Bulk Portal', to: '/b2b/procurement', icon: Building2 },
        ];
      case 'buyer':
        return [
          { label: 'Marketplace', to: '/marketplace', icon: Store },
          { label: 'My Orders', to: '/buyer/dashboard', icon: Package },
          { label: 'Cart Checkout', to: '/cart', icon: ShoppingCart, badge: totalItems },
          { label: 'B2B Procurement', to: '/b2b/procurement', icon: Building2 },
        ];
      case 'business':
        return [
          { label: 'B2B Portal', to: '/b2b/procurement', icon: Building2 },
          { label: 'Marketplace', to: '/marketplace', icon: Store },
          { label: 'Orders & Invoices', to: '/buyer/dashboard', icon: Package },
        ];
      case 'logistics':
        return [
          { label: 'Logistics Dashboard', to: '/logistics/dashboard', icon: Truck },
          { label: 'Marketplace', to: '/marketplace', icon: Store },
        ];
      case 'admin':
        return [
          { label: 'Admin Analytics', to: '/admin/dashboard', icon: ShieldCheck },
          { label: 'Marketplace', to: '/marketplace', icon: Store },
          { label: 'B2B Portal', to: '/b2b/procurement', icon: Building2 },
        ];
      default:
        return [
          { label: 'Marketplace', to: '/marketplace', icon: Store },
          { label: 'Cart', to: '/cart', icon: ShoppingCart },
        ];
    }
  };

  const navLinks = getNavLinks();

  return (
    <aside
      aria-label="Desktop Side Navigation"
      className={`hidden md:flex flex-col fixed top-0 left-0 bottom-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border-r border-slate-200/60 dark:border-slate-800 select-none shadow-xl transition-all duration-300 ease-in-out ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header with Sidenav Collapse Button */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/60">
        <NavLink to="/" className="flex items-center gap-2 group min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-agri-600 to-forest flex items-center justify-center text-white shadow-md shadow-agri-700/20 group-hover:scale-105 transition-transform shrink-0">
            <Sprout className="w-5 h-5 text-emerald-200" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="font-extrabold text-base tracking-tight text-forest dark:text-emerald-400 block truncate">
                AgriConnect
              </span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-none">
                Real-Time
              </p>
            </div>
          )}
        </NavLink>

        {/* Sidebar Collapse Toggle Button */}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* User Profile Card */}
      <div className="p-3 border-b border-slate-200/50 dark:border-slate-800/60">
        <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
            {user.name.charAt(0)}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1">
                <span className="truncate">{user.name}</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              </p>
              <div className={`mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold inline-block border ${badge.color}`}>
                {badge.label}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Navigation Links */}
      <nav className="flex-1 px-2.5 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
        {!collapsed && (
          <p className="px-3 text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500 mb-2">
            Navigation
          </p>
        )}
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.to;

          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={`flex items-center ${
                collapsed ? 'justify-center px-2 py-3' : 'justify-between px-3 py-2.5'
              } rounded-xl text-xs font-semibold transition-all group relative ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/20'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900'
              }`}
              title={collapsed ? link.label : undefined}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                {!collapsed && <span className="truncate">{link.label}</span>}
              </div>
              {link.badge !== undefined && link.badge > 0 && (
                <span
                  className={`${
                    collapsed
                      ? 'absolute -top-1 -right-1 min-w-[16px] h-4 text-[9px]'
                      : 'min-w-[18px] h-[18px] text-[10px]'
                  } px-1 bg-emerald-500 text-white font-extrabold rounded-full flex items-center justify-center`}
                >
                  {link.badge}
                </span>
              )}
            </NavLink>
          );
        })}

        {/* Global Cart Link if not in list */}
        {user.role !== 'buyer' && (
          <NavLink
            to="/cart"
            className={`flex items-center ${
              collapsed ? 'justify-center px-2 py-3' : 'justify-between px-3 py-2.5'
            } rounded-xl text-xs font-semibold transition-all relative ${
              location.pathname === '/cart'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
            title={collapsed ? 'Cart' : undefined}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <ShoppingCart className="w-5 h-5 shrink-0 text-slate-500" />
              {!collapsed && <span>Cart</span>}
            </div>
            {totalItems > 0 && (
              <span
                className={`${
                  collapsed
                    ? 'absolute -top-1 -right-1 min-w-[16px] h-4 text-[9px]'
                    : 'min-w-[18px] h-[18px] text-[10px]'
                } px-1 bg-emerald-500 text-white font-extrabold rounded-full flex items-center justify-center`}
              >
                {totalItems}
              </span>
            )}
          </NavLink>
        )}

        {/* AI Farm Advisor Trigger */}
        <div className="pt-3">
          <button
            onClick={onOpenAI}
            className={`w-full flex items-center ${
              collapsed ? 'justify-center p-3' : 'gap-2.5 px-3 py-2.5'
            } rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-500/20 transition-all text-left`}
            title={collapsed ? 'AI Agricultural Co-Pilot' : undefined}
          >
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse shrink-0" />
            {!collapsed && <span className="truncate">AI Farm Advisor</span>}
          </button>
        </div>
      </nav>

      {/* Footer Controls: Language, Theme & Logout */}
      <div className="p-3 border-t border-slate-200/50 dark:border-slate-800/60 space-y-2">
        <div className={`flex items-center ${collapsed ? 'flex-col gap-2' : 'justify-between px-1'}`}>
          {/* Language Cycler */}
          <button
            onClick={() => {
              const langs = ['en', 'te', 'hi'] as const;
              const nextIndex = (langs.indexOf(language as any) + 1) % langs.length;
              setLanguage(langs[nextIndex]);
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-bold uppercase flex items-center gap-1"
            title="Switch Language (EN / TE / HI)"
          >
            <Globe className="w-4 h-4" />
            {!collapsed && <span>{language}</span>}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            title="Toggle Light/Dark Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Sign Out */}
          <button
            onClick={() => {
              logout();
              navigate('/');
            }}
            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition text-xs font-semibold flex items-center gap-1"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>Exit</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};
