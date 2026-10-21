import type { ComponentType } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  FarmerDashboard,
  FarmerInsightsPage,
  FarmerListingsPage,
  FarmerOrdersPage,
  FarmerPayoutsPage,
  BuyerDashboard,
  LogisticsDashboard,
  AdminDashboard,
} from '@/pages/dashboard/LiveDashboardPages';
import { MarketplacePage } from '@/pages/MarketplacePage';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { navByRole } from '@/components/dashboard/DashboardShell';
import { RoleRequestPendingPage } from '@/pages/dashboard/RoleRequestPendingPage';

const dashboards: Record<UserRole, ComponentType> = {
  farmer: FarmerDashboard,
  buyer: BuyerDashboard,
  business: BuyerDashboard,
  logistics: LogisticsDashboard,
  admin: AdminDashboard,
};

export function DashboardRoute() {
  const [params] = useSearchParams();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();

  const roleParam = import.meta.env.DEV ? params.get('role') as UserRole | null : null;
  const role: UserRole = isAuthenticated && user
    ? user.role
    : roleParam && roleParam in dashboards
    ? roleParam
    : 'farmer';

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (user?.status === 'pending_verification' && user.requestedRole) {
    return <RoleRequestPendingPage />;
  }

  const Dash = dashboards[role] ?? FarmerDashboard;
  const section = location.pathname.split('/')[2];

  if (!section) return <Dash />;

  if (section === 'marketplace') {
    if (role !== 'buyer' && role !== 'business') {
      return <Navigate to="/dashboard" replace />;
    }
    return (
      <DashboardShell
        role={role}
        title="Marketplace"
        subtitle="Browse produce available to your role."
      >
        <MarketplacePage />
      </DashboardShell>
    );
  }

  if (role === 'farmer') {
    if (section === 'listings') return <FarmerListingsPage />;
    if (section === 'orders') return <FarmerOrdersPage />;
    if (section === 'payouts') return <FarmerPayoutsPage />;
    if (section === 'insights') return <FarmerInsightsPage />;
  }

  if (role === 'admin' && section === 'users') return <AdminDashboard />;
  if (role === 'admin' && section === 'orders') return <AdminDashboard />;

  const item = navByRole[role].find((navItem) => navItem.to.endsWith(`/${section}`));
  if (!item) return <Navigate to="/dashboard" replace />;
  return <Dash />;
}
