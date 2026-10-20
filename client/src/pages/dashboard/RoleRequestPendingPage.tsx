import { ArrowRight, Clock3, LogOut, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const roleLabels = {
  farmer: 'Farmer / Seller',
  buyer: 'Buyer',
  business: 'Business buyer',
  logistics: 'Delivery partner',
} as const;

export function RoleRequestPendingPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const requestedRole = user?.requestedRole;
  const requestedLabel = requestedRole ? roleLabels[requestedRole] : 'requested';

  function handleSignOut() {
    signOut();
    navigate('/login', { replace: true });
  }

  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-ivory px-4 py-8 text-forest">
      <section className="w-full max-w-lg rounded-3xl border border-forest/10 bg-white p-6 shadow-sm sm:p-9">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-agri-emerald/15 text-agri-green">
          <Clock3 className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-agri-green">Access request received</p>
        <h1 className="mt-2 font-display text-3xl leading-tight">Your {requestedLabel} access is pending review.</h1>
        <p className="mt-4 text-sm leading-relaxed text-charcoal/70">
          Your selected role was submitted successfully. Until an administrator approves it,
          this account has Buyer access only; seller inventory and delivery tools are not enabled.
        </p>
        <div className="mt-5 flex gap-3 rounded-2xl bg-forest/5 p-4 text-sm text-charcoal/70">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-agri-green" aria-hidden="true" />
          <p>
            After approval, sign out and sign in again to load your updated role and permissions.
          </p>
        </div>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/dashboard/marketplace"
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-forest px-4 text-sm font-semibold text-ivory hover:bg-agri-green"
          >
            Continue with Buyer access <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-forest/15 px-4 text-sm font-semibold text-forest hover:bg-forest/5"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </button>
        </div>
      </section>
    </main>
  );
}
