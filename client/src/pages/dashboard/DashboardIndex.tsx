import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Sprout, Store, Truck, Shield, ArrowRight, Info } from 'lucide-react';
import type { UserRole } from '@/types';
import { Logo } from '@/components/Logo';

const roles: { role: UserRole; label: string; icon: typeof Sprout; desc: string }[] = [
  { role: 'farmer', label: 'Farmer / FPO', icon: Sprout, desc: 'Manage listings, orders and payouts' },
  { role: 'buyer', label: 'Buyer', icon: Store, desc: 'Procure produce and track orders' },
  { role: 'logistics', label: 'Logistics Partner', icon: Truck, desc: 'Handle pickups and deliveries' },
  { role: 'admin', label: 'Admin', icon: Shield, desc: 'Oversee the platform and users' },
];

export function DashboardIndex() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-forest text-ivory">
      <div className="mx-auto max-w-5xl px-5 sm:px-8 py-20">
        <div className="flex items-center justify-between mb-16">
          <Logo variant="light" size="md" />
          <Link to="/" className="text-sm text-ivory/60 hover:text-ivory flex items-center gap-1.5">
            Back to site <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <p className="eyebrow text-agri-emerald mb-4">Dashboard Preview</p>
        <h1 className="font-display font-light text-4xl sm:text-5xl lg:text-6xl tracking-tightest text-balance">
          Explore a role-specific dashboard.
        </h1>
        <p className="mt-5 text-ivory/70 max-w-xl text-pretty">
          These dashboards use clearly labelled demo data. When a backend is connected and you sign
          in, the appropriate dashboard loads for your account role.
        </p>

        <div className="mt-10 rounded-xl bg-ivory/5 border border-ivory/10 p-4 text-sm text-ivory/60 flex items-start gap-3">
          <Info className="h-5 w-5 shrink-0 text-agri-emerald" />
          <p>
            {isAuthenticated
              ? 'You are signed in. Select your dashboard below.'
              : 'You are not signed in. Authentication is disabled in development mode. Pick a role to preview its dashboard.'}
          </p>
        </div>

        <div className="mt-10 grid sm:grid-cols-2 gap-5">
          {roles.map((r) => (
            <Link
              key={r.role}
              to={`/dashboard?role=${r.role}`}
              className="group rounded-2xl border border-ivory/10 p-7 hover:bg-ivory/5 transition-colors"
            >
              <div className="flex items-center justify-between">
                <r.icon className="h-7 w-7 text-agri-emerald" strokeWidth={1.5} />
                <ArrowRight className="h-4 w-4 text-ivory/30 group-hover:text-ivory group-hover:translate-x-1 transition-all" />
              </div>
              <h2 className="font-display text-2xl mt-5">{r.label}</h2>
              <p className="text-ivory/60 text-sm mt-2">{r.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardRedirect() {
  return <Navigate to="/dashboard" replace />;
}
