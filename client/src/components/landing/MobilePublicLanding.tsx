import { ArrowRight, BadgeCheck, Leaf, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PublicMobileNavigation } from '@/components/layout/PublicMobileNavigation';

const fieldImage = 'https://images.pexels.com/photos/19392425/pexels-photo-19392425.jpeg?auto=compress&cs=tinysrgb&w=1200';

export function MobilePublicLanding() {
  return (
    <>
    <main className="min-h-screen bg-ivory pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-16 text-forest">
      <div className="mx-auto max-w-2xl px-4 py-4 sm:px-6">
        <section className="relative isolate flex min-h-[26rem] flex-col justify-end overflow-hidden rounded-3xl bg-forest px-5 py-6 text-ivory">
          <img
            src={fieldImage}
            alt="A farmer tending crops in a green field"
            className="absolute inset-0 -z-20 h-full w-full object-cover"
            fetchPriority="high"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-forest via-forest/70 to-forest/10" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-agri-emerald">A clearer path from farm to table</p>
          <h1 className="mt-3 max-w-lg font-display text-4xl leading-[1.05] sm:text-5xl">
            Good food starts with the people who grow it.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ivory/80">
            Discover produce listed by farmers, compare current prices, and follow your order through delivery.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/shop"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-agri-emerald px-4 text-sm font-semibold text-forest"
            >
              Browse produce <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/register?role=farmer"
              className="inline-flex min-h-11 items-center rounded-xl border border-white/40 px-4 text-sm font-semibold text-ivory"
            >
              Join as a farmer
            </Link>
          </div>
        </section>

        <section className="mt-6" aria-labelledby="public-marketplace-title">
          <div className="mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-agri-green">The AgriConnect marketplace</p>
            <h2 id="public-marketplace-title" className="mt-1 font-display text-2xl">A more connected food journey</h2>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <article className="flex items-start gap-3 rounded-2xl border border-forest/10 bg-white p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-agri-emerald/15 text-agri-green">
                <Leaf className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-semibold">Explore real farm listings</h3>
                <p className="mt-1 text-sm leading-relaxed text-charcoal/65">Browse available products with seller-provided prices, quantities, and details.</p>
              </div>
            </article>
            <article className="flex items-start gap-3 rounded-2xl border border-forest/10 bg-white p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-agri-emerald/15 text-agri-green">
                <BadgeCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-semibold">Know who you are buying from</h3>
                <p className="mt-1 text-sm leading-relaxed text-charcoal/65">See farmer information on listings and review product availability before adding to cart.</p>
              </div>
            </article>
            <article className="flex items-start gap-3 rounded-2xl border border-forest/10 bg-white p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-agri-emerald/15 text-agri-green">
                <Truck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-semibold">Follow your order</h3>
                <p className="mt-1 text-sm leading-relaxed text-charcoal/65">Sign in to place an order and use your account to check its progress.</p>
              </div>
            </article>
          </div>
        </section>

        <section className="mt-6 rounded-2xl bg-forest p-5 text-ivory">
          <h2 className="font-display text-2xl">Growing or buying?</h2>
          <p className="mt-2 text-sm leading-relaxed text-ivory/75">Choose the account that fits you. Farmer access requests are reviewed before seller tools are enabled.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/register?role=buyer" className="inline-flex min-h-11 items-center rounded-xl bg-agri-emerald px-4 text-sm font-semibold text-forest">
              Create buyer account
            </Link>
            <Link to="/register?role=farmer" className="inline-flex min-h-11 items-center rounded-xl border border-ivory/30 px-4 text-sm font-semibold text-ivory">
              Register as a farmer
            </Link>
          </div>
        </section>
      </div>
    </main>
    <PublicMobileNavigation />
    </>
  );
}
