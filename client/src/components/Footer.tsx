import React from 'react';
import { Link } from 'react-router-dom';
import { Sprout, ShieldCheck, HeartHandshake, PhoneCall, Mail } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-forest-dark text-slate-300 pt-16 pb-10 border-t border-forest-light/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-slate-800">
          {/* Brand & Vision */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                <Sprout className="w-5 h-5 text-emerald-100" />
              </div>
              <span className="font-extrabold text-xl text-white tracking-tight">AgriConnect</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              From Farm to Every Table. An agricultural technology platform connecting farmers, FPOs, households,
              restaurants, supermarkets, and logistics partners into one transparent supply chain.
            </p>
            <div className="pt-2 text-[11px] text-emerald-400 font-semibold flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Startup Proposal 2026 • Founder: Nandhu</span>
            </div>
          </div>

          {/* Platform Split Explainer */}
          <div>
            <h4 className="text-sm font-semibold text-white tracking-wider uppercase mb-4 flex items-center gap-1.5">
              <HeartHandshake className="w-4 h-4 text-emerald-400" />
              <span>Transparent Split</span>
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex justify-between py-1 border-b border-slate-800">
                <span>Farmer / FPO Payout:</span>
                <span className="font-bold text-emerald-400">90% of value</span>
              </li>
              <li className="flex justify-between py-1 border-b border-slate-800">
                <span>AgriConnect Platform:</span>
                <span className="font-semibold text-slate-200">8% commission</span>
              </li>
              <li className="flex justify-between py-1 border-b border-slate-800">
                <span>Ops / Payment Reserve:</span>
                <span className="font-semibold text-slate-200">2% reserve</span>
              </li>
              <li className="flex justify-between py-1">
                <span>Delivery:</span>
                <span className="text-slate-300">Customer paid / Free &gt;₹500</span>
              </li>
            </ul>
          </div>

          {/* Portals & Workflows */}
          <div>
            <h4 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">Ecosystem Portals</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/marketplace" className="hover:text-emerald-400 transition">
                  Household Fresh Marketplace
                </Link>
              </li>
              <li>
                <Link to="/b2b/procurement" className="hover:text-emerald-400 transition">
                  B2B Hotel & Restaurant Procurement
                </Link>
              </li>
              <li>
                <Link to="/farmer/dashboard" className="hover:text-emerald-400 transition">
                  Farmer Inventory & Payout Portal
                </Link>
              </li>
              <li>
                <Link to="/logistics/dashboard" className="hover:text-emerald-400 transition">
                  Logistics & Fresh Cold-Chain Transit
                </Link>
              </li>
              <li>
                <Link to="/admin/dashboard" className="hover:text-emerald-400 transition">
                  Platform Admin & Ledger Audit
                </Link>
              </li>
            </ul>
          </div>

          {/* Regional Hubs & Contact */}
          <div>
            <h4 className="text-sm font-semibold text-white tracking-wider uppercase mb-4 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Farm Clusters</span>
            </h4>
            <p className="text-xs text-slate-400 mb-3">
              Pilot launching across Anantapur, Warangal, Nashik, and Guntur farming clusters directly serving urban demand hubs.
            </p>
            <div className="space-y-2 text-xs text-slate-400">
              <p className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-emerald-400" />
                <span>support@agriconnect.in</span>
              </p>
              <p className="flex items-center gap-2">
                <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                <span>+91 1800-AGRI-DIRECT</span>
              </p>
            </div>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© 2026 AgriConnect Inc. All rights reserved. “One Connected Network. Every Farm. Every Buyer.”</p>
          <div className="flex items-center gap-6">
            <span className="hover:text-slate-400">e-NAM & AgriStack Aligned</span>
            <span className="hover:text-slate-400">Razorpay Sandbox Enabled</span>
            <span className="hover:text-slate-400">Zero Intermediary Leakage</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
