import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Sprout, Truck, Store, ShoppingBag, ArrowRight } from 'lucide-react';

const footerLinks = [
  {
    title: 'Platform',
    links: [
      { label: 'For Farmers', to: '/register?role=farmer' },
      { label: 'B2B Procurement', to: '/register?role=buyer' },
      { label: 'Logistics Partners', to: '/register?role=logistics' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/#about' },
      { label: 'How It Works', to: '/#how-it-works' },
      { label: 'Partnerships', to: '/#partnerships' },
      { label: 'Sign in', to: '/login' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-charcoal text-ivory/80">
      <div className="mx-auto max-w-9xl px-5 sm:px-8 py-16 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Logo variant="light" size="lg" />
            <p className="mt-5 text-ivory/60 max-w-sm leading-relaxed text-pretty">
              From Farm to Every Table — an intelligent agricultural network connecting farmers,
              FPOs, businesses and households across India.
            </p>
            <div className="mt-6 flex items-center gap-5 text-ivory/50">
              <Sprout className="h-5 w-5" />
              <Truck className="h-5 w-5" />
              <Store className="h-5 w-5" />
              <ShoppingBag className="h-5 w-5" />
            </div>
          </div>

          {footerLinks.map((col) => (
            <div key={col.title}>
              <h4 className="eyebrow text-agri-emerald mb-5">{col.title}</h4>
              <ul className="space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      to={l.to}
                      className="text-ivory/70 hover:text-ivory transition-colors text-sm inline-flex items-center gap-1.5 group"
                    >
                      <ArrowRight className="h-3.5 w-3.5 opacity-0 -ml-5 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h4 className="eyebrow text-agri-emerald mb-5">Join the Network</h4>
            <p className="text-ivory/60 text-sm mb-5">
              Whether you grow, buy, or move produce — there's a place for you in AgriConnect.
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-agri-emerald text-forest font-semibold px-5 py-3 rounded-full hover:bg-ivory transition-colors text-sm"
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between gap-4 text-xs text-ivory/40">
          <p>© {new Date().getFullYear()} AgriConnect. From Farm to Every Table.</p>
          <p>A frontend concept. Not affiliated with any live backend unless configured.</p>
        </div>
      </div>
    </footer>
  );
}
