import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sprout,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  HeartHandshake,
  Truck,
  Sparkles,
  CheckCircle2,
  Building2,
  Users,
  ChevronRight,
  HelpCircle,
  BarChart3,
  Layers,
  ArrowDown,
  RotateCw,
  Award,
  Clock,
  MapPin,
  Flame,
} from 'lucide-react';
import api from '../services/api.js';
import { CropListing } from '../types/index.js';
import { CropCard } from '../components/CropCard.js';
import { CropDetailModal } from '../components/CropDetailModal.js';
import { useLanguage } from '../context/LanguageContext.js';
import { SupplyChainTransformationScene } from '../components/3d/SupplyChainTransformation.js';
import { ProduceShowcaseCanvas } from '../components/3d/ProduceShowcaseCanvas.js';

interface LandingPageProps {
  onOpenAuthWithRole: (role: 'farmer' | 'buyer' | 'business') => void;
  onOpenAI: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuthWithRole, onOpenAI }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [featuredCrops, setFeaturedCrops] = useState<CropListing[]>([]);
  const [selectedCrop, setSelectedCrop] = useState<CropListing | null>(null);
  const [networkMode, setNetworkMode] = useState<'agriconnect' | 'traditional'>('agriconnect');
  const [showcaseProduce, setShowcaseProduce] = useState<'mango' | 'tomato' | 'capsicum' | 'wheat'>('mango');

  useEffect(() => {
    api
      .get('/crops?limit=6')
      .then((res) => {
        if (res.data.listings) {
          setFeaturedCrops(res.data.listings);
        }
      })
      .catch((err) => console.error('Failed to load featured crops:', err));
  }, []);

  return (
    <div className="space-y-24 sm:space-y-32 pb-24 overflow-hidden">
      {/* ========================================================
          1. FIRST IMPRESSION: FULL-SCREEN CINEMATIC 3D HERO
         ======================================================== */}
      <section className="relative min-h-[92vh] flex flex-col justify-between pt-6 sm:pt-10 overflow-hidden">
        {/* Background Ambient Glow Orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-[140px] pointer-events-none -z-10 animate-ambient-glow" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full z-10 flex flex-col items-center text-center space-y-6">
          {/* Small Top Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 backdrop-blur-md shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              The Future of Agricultural Commerce
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </div>

          {/* Main Cinematic Editorial Headline */}
          <div className="space-y-3 max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight text-forest dark:text-slate-100 uppercase leading-[1.05]">
              From Farm <br />
              <span className="text-liquid-shimmer">To Every Table.</span>
            </h1>
            <p className="text-base sm:text-xl text-slate-600 dark:text-slate-300 font-medium max-w-2xl mx-auto leading-relaxed pt-2">
              One connected network bringing farmers, fresh produce, and buyers together through smarter technology.
            </p>
          </div>

          {/* Primary & Secondary Call to Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2 w-full sm:w-auto">
            <Link
              to="/marketplace"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-forest hover:bg-forest-light text-white font-bold text-sm shadow-xl shadow-forest/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 group"
            >
              <span>Explore Marketplace</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button
              onClick={() => onOpenAuthWithRole('farmer')}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl liquid-glass text-slate-900 dark:text-slate-100 font-bold text-sm shadow-subtle hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Sprout className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Join as Farmer (90% Payout)</span>
            </button>
          </div>
        </div>

        {/* Floating Value Proposition Metrics over Living 3D Canvas */}
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 sm:mt-12 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-left">
            <div className="p-4 sm:p-5 rounded-2xl liquid-glass shadow-subtle hover:scale-[1.02] transition-transform">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider block">Farmer Share</span>
              <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">90% Value</p>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">vs 33% in traditional mandi</span>
            </div>
            <div className="p-4 sm:p-5 rounded-2xl liquid-glass shadow-subtle hover:scale-[1.02] transition-transform">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider block">Fulfillment Speed</span>
              <p className="text-2xl sm:text-3xl font-black text-forest dark:text-emerald-400 mt-1">&lt;12 Hours</p>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">Harvest to doorstep transit</span>
            </div>
            <div className="p-4 sm:p-5 rounded-2xl liquid-glass shadow-subtle hover:scale-[1.02] transition-transform">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider block">Intermediaries</span>
              <p className="text-2xl sm:text-3xl font-black text-forest dark:text-emerald-400 mt-1">0 Brokers</p>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">Direct farm-to-table network</span>
            </div>
            <div className="p-4 sm:p-5 rounded-2xl liquid-glass shadow-subtle hover:scale-[1.02] transition-transform">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider block">Platform Model</span>
              <p className="text-2xl sm:text-3xl font-black text-forest dark:text-emerald-400 mt-1">8% Fixed</p>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">Audited transparent fee</span>
            </div>
          </div>
        </div>

        {/* Subtle Animated Scroll Indicator */}
        <div className="flex flex-col items-center justify-center pt-8 text-slate-400 dark:text-slate-500 space-y-2">
          <span className="text-[11px] font-semibold tracking-widest uppercase">Scroll to Explore Story</span>
          <ArrowDown className="w-4 h-4 animate-bounce text-emerald-600 dark:text-emerald-400" />
        </div>
      </section>

      {/* ========================================================
          SECTION 2 & 3: THE PROBLEM & THE AGRICONNECT TRANSFORMATION
          (Supply Chain 3D Interactive Network)
         ======================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl liquid-glass-card p-6 sm:p-12 space-y-10">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-200/60 dark:border-slate-800 pb-8">
            <div className="space-y-3 max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                The Supply Chain Revolution
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
                {networkMode === 'agriconnect' ? (
                  <span>One Network. Every Farm. Every Buyer.</span>
                ) : (
                  <span className="text-rose-600 dark:text-rose-400">A Better Way from Farm to Market.</span>
                )}
              </h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                {networkMode === 'agriconnect'
                  ? 'AgriConnect replaces fragmented intermediaries with a direct digital network. Cultivators receive 90% transparent value, while buyers enjoy farm-fresh harvests delivered within 12 hours.'
                  : 'Traditional mandi chains trap farmers behind 5 layers of commission agents, causing 40% post-harvest spoilage and paying cultivators less than 33% of final consumer price.'}
              </p>
            </div>

            {/* Mode Switcher Toggle */}
            <div className="inline-flex p-1.5 rounded-2xl bg-slate-200/80 dark:bg-slate-800/90 border border-slate-300/60 dark:border-slate-700">
              <button
                onClick={() => setNetworkMode('agriconnect')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  networkMode === 'agriconnect'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                🌱 AgriConnect (Direct Network)
              </button>
              <button
                onClick={() => setNetworkMode('traditional')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  networkMode === 'traditional'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                ⚠️ Traditional Mandi (5 Middlemen)
              </button>
            </div>
          </div>

          {/* 3D Scene Visualization Container */}
          <div className="relative rounded-2xl bg-slate-950/90 border border-slate-800 p-4 sm:p-6 shadow-inner">
            <SupplyChainTransformationScene mode={networkMode} />

            {/* Interactive Legend Overlays */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
              {networkMode === 'agriconnect' ? (
                <>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-emerald-400 font-bold block uppercase">Farmer Share</span>
                    <span className="text-lg font-black text-white">90% Direct</span>
                    <span className="text-[10px] text-slate-400 block">Bank/UPI settlement</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-emerald-400 font-bold block uppercase">Transit Time</span>
                    <span className="text-lg font-black text-white">&lt;12 Hours</span>
                    <span className="text-[10px] text-slate-400 block">Harvest to doorstep</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-emerald-400 font-bold block uppercase">Middleman Cuts</span>
                    <span className="text-lg font-black text-white">0% Leakage</span>
                    <span className="text-[10px] text-slate-400 block">Fully disintermediated</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-emerald-400 font-bold block uppercase">Traceability</span>
                    <span className="text-lg font-black text-white">100% GI Batch</span>
                    <span className="text-[10px] text-slate-400 block">GPS crop origin</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/40">
                    <span className="text-[10px] text-rose-400 font-bold block uppercase">Farmer Share</span>
                    <span className="text-lg font-black text-white">Barely 33%</span>
                    <span className="text-[10px] text-rose-300/80 block">Severely undercut</span>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/40">
                    <span className="text-[10px] text-rose-400 font-bold block uppercase">Transit Time</span>
                    <span className="text-lg font-black text-white">48 - 72 Hours</span>
                    <span className="text-[10px] text-rose-300/80 block">Long mandi queues</span>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/40">
                    <span className="text-[10px] text-rose-400 font-bold block uppercase">Post-Harvest Loss</span>
                    <span className="text-lg font-black text-white">35% - 40%</span>
                    <span className="text-[10px] text-rose-300/80 block">Spoiled in transit</span>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/40">
                    <span className="text-[10px] text-rose-400 font-bold block uppercase">Consumer Markup</span>
                    <span className="text-lg font-black text-white">+150% Markup</span>
                    <span className="text-[10px] text-rose-300/80 block">Inflated by brokers</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION 4: FRESHNESS IN MOTION (Interactive 3D Produce)
         ======================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-3 mb-10">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
            Freshness in Motion
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-slate-100">
            Certified Grade A+ Fresh Produce
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Interact with our 3D produce models. Every harvest comes with verified farm origin, harvest time, and transparent pricing.
          </p>
        </div>

        {/* 3D Showcase Studio Card */}
        <div className="rounded-3xl liquid-glass-card p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left: Interactive 3D Model Canvas */}
          <div className="lg:col-span-7 relative bg-gradient-to-br from-slate-900 via-forest-dark to-slate-950 rounded-2xl p-6 border border-slate-800 overflow-hidden shadow-2xl">
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
                Interactive 3D Inspector
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">Drag to rotate 360°</span>
            </div>

            <ProduceShowcaseCanvas type={showcaseProduce} />

            {/* Produce Switcher Buttons */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {[
                { id: 'mango', name: 'Alphonso Mango', icon: '🥭' },
                { id: 'tomato', name: 'Heirloom Tomato', icon: '🍅' },
                { id: 'capsicum', name: 'Emerald Pepper', icon: '🫑' },
                { id: 'wheat', name: 'Golden Wheat', icon: '🌾' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setShowcaseProduce(p.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    showcaseProduce === p.id
                      ? 'bg-emerald-500 text-white shadow-md scale-105'
                      : 'bg-white/10 hover:bg-white/20 text-slate-300'
                  }`}
                >
                  <span>{p.icon}</span>
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Produce Provenance Metadata */}
          <div className="lg:col-span-5 space-y-6">
            {showcaseProduce === 'mango' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <Award className="w-4 h-4" />
                  <span>GI-TAGGED RATNAGIRI ALPHONSO</span>
                </div>
                <h3 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                  Ratnagiri King Alphonso Mango
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Naturally tree-ripened on coastal red laterite soil. Rich in aroma, beta-carotene, and natural sugars with zero carbide treatment.
                </p>
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <span className="text-[10px] text-slate-500 block">Quality Grade</span>
                    <span className="font-extrabold text-emerald-600">Export Grade A+</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <span className="text-[10px] text-slate-500 block">Farm Source</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">Ratnagiri Orchards</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <span className="text-[10px] text-slate-500 block">Harvest Date</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">This Morning (6 AM)</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <span className="text-[10px] text-slate-500 block">Direct Price</span>
                    <span className="font-extrabold text-emerald-600">₹650 / dozen</span>
                  </div>
                </div>
              </div>
            )}

            {showcaseProduce === 'tomato' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400">
                  <Award className="w-4 h-4" />
                  <span>PREMIUM VINE-RIPENED HYBRID</span>
                </div>
                <h3 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                  Kolar Red Vine Tomato
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Firm texture, high lycopene content, and balanced acidity. Harvested at optimum color break stage for maximum shelf life.
                </p>
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <span className="text-[10px] text-slate-500 block">Brix Rating</span>
                    <span className="font-extrabold text-emerald-600">5.4 Brix (Sweet)</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <span className="text-[10px] text-slate-500 block">Cultivation</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">Drip-Irrigated Polyhouse</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <span className="text-[10px] text-slate-500 block">Location</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">Kolar, Karnataka</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <span className="text-[10px] text-slate-500 block">Direct Price</span>
                    <span className="font-extrabold text-emerald-600">₹38 / kg</span>
                  </div>
                </div>
              </div>
            )}

            {showcaseProduce === 'capsicum' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <Award className="w-4 h-4" />
                  <span>HYDROPONIC EMERALD BELL PEPPER</span>
                </div>
                <h3 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                  Crisp Green Bell Pepper
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Thick-walled, crunchy texture with rich Vitamin C and chlorogenic acid. Ideal for gourmet salads and high-temperature stir-fries.
                </p>
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <span className="text-[10px] text-slate-500 block">Wall Thickness</span>
                    <span className="font-extrabold text-emerald-600">6.5 mm (Crisp)</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <span className="text-[10px] text-slate-500 block">Method</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">Soilless Hydroponics</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <span className="text-[10px] text-slate-500 block">Origin</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">Pune Valley Agritech</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <span className="text-[10px] text-slate-500 block">Direct Price</span>
                    <span className="font-extrabold text-emerald-600">₹65 / kg</span>
                  </div>
                </div>
              </div>
            )}

            {showcaseProduce === 'wheat' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-yellow-600 dark:text-yellow-400">
                  <Award className="w-4 h-4" />
                  <span>SEHORE SHARBATI GOLD GRAIN</span>
                </div>
                <h3 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                  Madhya Pradesh Sharbati Wheat
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  The acclaimed golden grain grown in the black cotton soil of Sehore. Heavy grain weight, golden luster, and naturally sweet taste.
                </p>
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <span className="text-[10px] text-slate-500 block">Protein Content</span>
                    <span className="font-extrabold text-emerald-600">14.2% Premium</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <span className="text-[10px] text-slate-500 block">Processing</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">Sun-Dried & Stone-Sorted</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <span className="text-[10px] text-slate-500 block">FPO Group</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">Narmada Valley Farmers</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <span className="text-[10px] text-slate-500 block">Direct Price</span>
                    <span className="font-extrabold text-emerald-600">₹44 / kg</span>
                  </div>
                </div>
              </div>
            )}

            <Link
              to="/marketplace"
              className="w-full py-3.5 rounded-2xl bg-forest hover:bg-forest-light text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
            >
              <span>Order Certified Harvest from Marketplace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION 5: THE INTELLIGENCE LAYER (Multilingual AI)
         ======================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>AgriConnect AI Co-Pilot</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-slate-100 leading-tight">
              Agronomy Advice, APMC Signals & Demand Forecasts
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              AgriConnect’s built-in agricultural intelligence assists cultivators with yield protection, APMC mandi trends, and buyer demand matching in real time.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl liquid-glass border border-slate-200 dark:border-slate-800">
                <span className="text-xl mb-1 block">🗣️</span>
                <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 mb-1">
                  English, Telugu & Hindi
                </h4>
                <p className="text-[11px] text-slate-500">
                  Communicate in your regional mother tongue for seamless agricultural guidance.
                </p>
              </div>

              <div className="p-4 rounded-2xl liquid-glass border border-slate-200 dark:border-slate-800">
                <span className="text-xl mb-1 block">📈</span>
                <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 mb-1">
                  Real Demand Insights
                </h4>
                <p className="text-[11px] text-slate-500">
                  Insights based on live platform order velocity and institutional procurement bids.
                </p>
              </div>
            </div>

            <button
              onClick={onOpenAI}
              className="px-6 py-3.5 rounded-2xl bg-forest dark:bg-emerald-600 text-white font-bold text-xs shadow-md hover:scale-105 transition-all flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-emerald-300" />
              <span>Launch AI Agricultural Co-Pilot</span>
            </button>
          </div>

          {/* AI Interactive Chat Sample Mockup */}
          <div className="bg-slate-950 text-white rounded-3xl p-6 shadow-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
              <span className="flex items-center gap-2 font-bold text-emerald-400">
                <Sparkles className="w-4 h-4" />
                <span>AgriConnect Farm Intelligence (Live)</span>
              </span>
              <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                Telugu • English • Hindi
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-900 p-3 rounded-xl rounded-br-none ml-auto max-w-[85%] text-slate-200 border border-slate-800">
                🌾 టమోటా పంటకు ప్రస్తుత మార్కెట్ ధర మరియు నాణ్యత గ్రేడ్ ఏమిటి?
              </div>

              <div className="bg-emerald-950/80 border border-emerald-800/80 p-3.5 rounded-xl rounded-bl-none max-w-[90%] text-emerald-100 space-y-1.5">
                <p className="font-bold text-emerald-300">🌱 AgriConnect మార్కెట్ విశ్లేషణ (తెలుగు):</p>
                <p className="text-[11px] leading-relaxed">
                  ప్రస్తుతం గ్రేడ్-A నాణ్యత కలిగిన టమోటాలకు హోటళ్ళు మరియు సూపర్ మార్కెట్ల నుండి అధిక డిమాండ్ ఉంది. రైతులకు కిలోకు ₹38.50 వరకు నేరుగా 90% వాటా అందుతుంది.
                </p>
              </div>

              <div className="bg-slate-900 p-3 rounded-xl rounded-br-none ml-auto max-w-[85%] text-slate-200 border border-slate-800">
                🌿 How to protect stored onions from post-harvest rot?
              </div>

              <div className="bg-emerald-950/80 border border-emerald-800/80 p-3.5 rounded-xl rounded-bl-none max-w-[90%] text-emerald-100 space-y-1.5">
                <p className="font-bold text-emerald-300">🌱 Agronomy Storage Advisory:</p>
                <p className="text-[11px] leading-relaxed">
                  Ensure 10-14 days field curing until necks are dry. Maintain well-ventilated slatted crates with &lt;65% relative humidity to preserve Grade A rating for 60+ days.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION 6: THE WORKING MARKETPLACE (Live Crop Listings)
         ======================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Direct Farm Offerings</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100">
              Live Crop Availability & Pricing
            </h2>
          </div>
          <Link
            to="/marketplace"
            className="text-xs font-bold text-agri-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            <span>View All Produce ({featuredCrops.length}+ Listings)</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredCrops.map((crop) => (
            <CropCard key={crop._id} crop={crop} onSelect={(c) => setSelectedCrop(c)} />
          ))}
        </div>
      </section>

      {/* ========================================================
          TRANSPARENT 90/8/2 AUDITABLE VALUE SPLIT
         ======================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-forest via-forest-light to-forest-dark text-white rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-6">
              <span className="text-xs font-bold tracking-widest uppercase text-emerald-300">
                Radical Transparency
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight">
                Every Rupee Accounted For. 90% Direct to the Farmer.
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Traditional domestic vegetable value chains see farmers pocket barely 33% (tomatoes) to 37% (potatoes) due to 4-5 layers of intermediaries. AgriConnect establishes an auditable marketplace model where farmers receive the clear majority of customer spend.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Configurable by platform administrators, never hidden in fine print.</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Immutable pricing snapshots saved with every order in integer paise.</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Settlements released directly to farmer bank accounts or UPI VPA.</span>
                </div>
              </div>
            </div>

            {/* Split Visual Card */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 space-y-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-300 pb-2 border-b border-white/10">
                Example: ₹1,000 Order Value Split
              </h4>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/30">
                  <div>
                    <p className="font-extrabold text-white text-sm">🌾 Farmer / FPO Share (90%)</p>
                    <p className="text-[11px] text-emerald-200">Direct crop payout to verified cultivator</p>
                  </div>
                  <span className="text-xl font-black text-emerald-300">₹900.00</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <div>
                    <p className="font-bold text-white">🌱 AgriConnect Platform (8%)</p>
                    <p className="text-[11px] text-slate-300">Technology, AI advisor, sales & coordination</p>
                  </div>
                  <span className="text-base font-bold text-slate-200">₹80.00</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <div>
                    <p className="font-bold text-white">⚙️ Payment & Ops Reserve (2%)</p>
                    <p className="text-[11px] text-slate-300">Razorpay Test Gateway fees, dispute & refunds reserve</p>
                  </div>
                  <span className="text-base font-bold text-slate-200">₹20.00</span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/10 text-slate-300 text-[11px]">
                  <span>🚚 Delivery:</span>
                  <span>Separately customer-paid / Free on orders &gt;₹500</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION 7: FINAL CALL TO ACTION
         ======================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl liquid-glass-card p-8 sm:p-16 text-center space-y-6 relative overflow-hidden">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>Join the Connected Agricultural Future</span>
          </div>

          <h2 className="text-4xl sm:text-6xl font-black text-forest dark:text-slate-100 tracking-tight leading-tight">
            Grow Together. <br />
            <span className="text-liquid-shimmer">Connect Every Table.</span>
          </h2>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-xl mx-auto">
            Whether you cultivate crops or feed a community, AgriConnect gives you fair pricing, rapid fulfillment, and verified transparency.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              to="/marketplace"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-forest hover:bg-forest-light text-white font-bold text-sm shadow-xl shadow-forest/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span>Explore Marketplace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              onClick={() => onOpenAuthWithRole('farmer')}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl liquid-glass text-slate-900 dark:text-slate-100 font-bold text-sm hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Sprout className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Become a Farmer Partner</span>
            </button>
          </div>
        </div>
      </section>

      {/* Crop Detail Modal Popup */}
      <CropDetailModal crop={selectedCrop} onClose={() => setSelectedCrop(null)} />
    </div>
  );
};
