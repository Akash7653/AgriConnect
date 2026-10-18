import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  SlidersHorizontal,
  Sparkles,
  MapPin,
  RefreshCw,
  X,
  Package,
} from 'lucide-react';
import api from '../services/api.js';
import { CropListing } from '../types/index.js';
import { CropCard } from '../components/CropCard.js';
import { CropDetailModal } from '../components/CropDetailModal.js';
import { getSocket } from '../services/socket.js';

const CATEGORIES = [
  'All',
  'Vegetables',
  'Fruits',
  'Grains & Cereals',
  'Pulses',
  'Spices',
  'Greens & Herbs',
  'Organic Special',
];

const GRADES = ['All', 'A+', 'A', 'B+', 'B'];

export const MarketplacePage: React.FC = () => {
  const [crops, setCrops] = useState<CropListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedGrade, setSelectedGrade] = useState('All');
  const [onlyOrganic, setOnlyOrganic] = useState(false);
  const [sortBy, setSortBy] = useState('createdAt');
  const [selectedCrop, setSelectedCrop] = useState<CropListing | null>(null);

  const fetchListings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedCategory !== 'All') params.append('category', selectedCategory);
      if (selectedGrade !== 'All') params.append('grade', selectedGrade);
      if (onlyOrganic) params.append('organic', 'true');
      if (sortBy) params.append('sortBy', sortBy);

      const res = await api.get(`/crops?${params.toString()}`);
      if (res.data.listings) {
        setCrops(res.data.listings);
      }
    } catch (err) {
      console.error('Error fetching marketplace listings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, [selectedCategory, selectedGrade, onlyOrganic, sortBy]);

  // Real-time stock availability updates via Socket.IO
  useEffect(() => {
    const socket = getSocket();

    const handleLiveInventory = (data: { listingId: string; availableQuantity: number; status: string }) => {
      setCrops((prev) =>
        prev.map((c) => {
          if (c._id === data.listingId) {
            return {
              ...c,
              availableQuantity: data.availableQuantity,
              status: data.status as any,
            };
          }
          return c;
        })
      );
    };

    socket.on('inventory:updated', handleLiveInventory);
    return () => {
      socket.off('inventory:updated', handleLiveInventory);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchListings();
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory('All');
    setSelectedGrade('All');
    setOnlyOrganic(false);
    setSortBy('createdAt');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-forest via-agri-900 to-forest-light text-white rounded-3xl p-8 sm:p-10 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-400/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Direct Farm Sourcing • Zero Intermediary Markups</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Produce Marketplace
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Freshly harvested vegetables, fruits, pulses, and organic grains directly from verified
            farmers and FPOs with guaranteed 90% farmer payout.
          </p>
        </div>

        {/* Live Status indicator */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-xs space-y-1.5 shrink-0">
          <div className="flex items-center gap-2 text-emerald-300 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Real-Time Concurrency Active</span>
          </div>
          <p className="text-slate-300">Live inventory synced with farm pickups</p>
          <div className="text-[11px] text-slate-400 font-mono">
            {crops.filter((c) => c.availableQuantity > 0).length} active farm batches available
          </div>
        </div>
      </div>

      {/* Search and Category Quick Filter Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by crop name (e.g. Tomato, Sona Masoori, Onion), variety, or description..."
              className="w-full pl-10 pr-24 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 shadow-subtle focus:outline-none focus:ring-2 focus:ring-agri-500"
            />
            <button
              type="submit"
              className="absolute right-2 top-1.5 px-3 py-1.5 rounded-xl bg-agri-700 hover:bg-agri-800 text-white text-xs font-semibold shadow transition"
            >
              Search
            </button>
          </form>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-200 shadow-subtle outline-none"
            >
              <option value="createdAt">Newest Harvest First</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="quantity_desc">Available Stock (Highest)</option>
            </select>
          </div>
        </div>

        {/* Categories Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-agri-700 text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Quality Grade & Organic Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-slate-500 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </span>

            {/* Quality Grade */}
            <div className="flex items-center gap-1">
              <span className="text-slate-400">Quality:</span>
              {GRADES.map((g) => (
                <button
                  key={g}
                  onClick={() => setSelectedGrade(g)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition ${
                    selectedGrade === g
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {g === 'All' ? 'All' : `Grade ${g}`}
                </button>
              ))}
            </div>

            {/* Organic Switch */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyOrganic}
                onChange={(e) => setOnlyOrganic(e.target.checked)}
                className="rounded border-slate-300 text-agri-600 focus:ring-agri-500"
              />
              <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>Certified Organic Only</span>
              </span>
            </label>
          </div>

          {(search || selectedCategory !== 'All' || selectedGrade !== 'All' || onlyOrganic) && (
            <button
              onClick={clearFilters}
              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-semibold"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Crop Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4 animate-pulse"
            >
              <div className="aspect-[4/3] bg-slate-200 dark:bg-slate-800 rounded-xl" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
              <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      ) : crops.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-agri-50 dark:bg-slate-800 text-agri-600 flex items-center justify-center mx-auto">
            <Package className="w-8 h-8 text-agri-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            No crop listings match your current filters
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search keywords, clearing selected category filters, or checking back
            as new morning harvest batches are listed by farmers.
          </p>
          <button
            onClick={clearFilters}
            className="px-4 py-2 rounded-xl bg-agri-700 text-white text-xs font-bold shadow hover:bg-agri-800 transition"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {crops.map((crop) => (
            <CropCard key={crop._id} crop={crop} onSelect={(c) => setSelectedCrop(c)} />
          ))}
        </div>
      )}

      {/* Crop Detail Modal */}
      <CropDetailModal crop={selectedCrop} onClose={() => setSelectedCrop(null)} />
    </div>
  );
};
