import type { ComponentType } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  FarmerDashboard,
  BuyerDashboard,
  LogisticsDashboard,
  AdminDashboard,
} from '@/pages/dashboard/LiveDashboardPages';
import { MarketplacePage } from '@/pages/MarketplacePage';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { navByRole } from '@/components/dashboard/DashboardShell';

const dashboards: Record<UserRole, ComponentType> = {
  farmer: FarmerDashboard,
  buyer: BuyerDashboard,
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
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  const Dash = dashboards[role] ?? FarmerDashboard;
  const section = location.pathname.split('/')[2];

  if (!section) return <Dash />;

  if (section === 'marketplace') {
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

  const item = navByRole[role].find((navItem) => navItem.to.endsWith(`/${section}`));
  if (!item) return <Navigate to="/dashboard" replace />;
  return <Dash />;
}
