import type { ComponentType } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  FarmerDashboard,
  BuyerDashboard,
  LogisticsDashboard,
  AdminDashboard,
} from '@/pages/dashboard/DashboardPages';
import { DashboardIndex } from '@/pages/dashboard/DashboardIndex';
import { MarketplacePage } from '@/pages/MarketplacePage';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types';
import { DashboardShell, StatCard } from '@/components/dashboard/DashboardShell';
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

  const roleParam = params.get('role') as UserRole | null;
  const role: UserRole = isAuthenticated && user
    ? user.role
    : roleParam && roleParam in dashboards
    ? roleParam
    : 'farmer';

  if (!isAuthenticated && !roleParam) {
    return <DashboardIndex />;
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

  return (
    <DashboardShell
      role={role}
      title={item.label}
      subtitle={`${item.label} workspace for your ${role} account.`}
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard label="Workspace status" value="Ready" tone="emerald" />
        <StatCard label="Role access" value="Enabled" />
        <StatCard label="Next action" value="Review" tone="soil" />
      </div>
      <div className="mt-6 rounded-2xl border border-forest/10 bg-white p-6 sm:p-8">
        <p className="eyebrow text-agri-green">{role} / {item.label}</p>
        <h2 className="mt-3 font-display text-3xl text-forest">Your {item.label.toLowerCase()} tools are ready.</h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-charcoal/60">
          This role-specific workspace is reserved for the workflows available to your account. Use
          the navigation to move between your overview and operational areas.
        </p>
      </div>
    </DashboardShell>
  );
}
