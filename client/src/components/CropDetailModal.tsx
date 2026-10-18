import React, { useState } from 'react';
import {
  X,
  MapPin,
  Calendar,
  Sparkles,
  ShieldCheck,
  Plus,
  Minus,
  Check,
  Building,
  HeartHandshake,
  Clock,
} from 'lucide-react';
import { CropListing } from '../types/index.js';
import { useCart } from '../context/CartContext.js';

interface CropDetailModalProps {
  crop: CropListing | null;
  onClose: () => void;
}

export const CropDetailModal: React.FC<CropDetailModalProps> = ({ crop, onClose }) => {
  if (!crop) return null;

  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const priceRupees = (crop.pricePerUnitPaise / 100).toFixed(2);
  const farmerPayoutRupees = ((crop.pricePerUnitPaise * 0.9) / 100).toFixed(2);
  const isAvailable = crop.availableQuantity > 0 && crop.status === 'active';

  const handleAdd = () => {
    if (!isAvailable) return;
    addToCart(crop, quantity);
    setAdded(true);
    setTimeout(() => {
      setAdded(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Bar */}
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
          <img
            src={crop.images?.[0] || 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?auto=format&fit=crop&w=800&q=80'}
            alt={crop.cropName}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-4 left-6 right-6 text-white">
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-sm flex items-center gap-1">
                <span>Grade {crop.qualityGrade}</span>
              </span>
              {crop.isOrganicCertified && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white shadow-sm flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Certified Organic</span>
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-white/20 backdrop-blur-sm text-white">
                {crop.category}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold">{crop.cropName}</h2>
            {crop.variety && (
              <p className="text-xs text-slate-300 font-medium">Cultivar / Variety: {crop.variety}</p>
            )}
          </div>
        </div>

        {/* Modal Content Scrollable */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Description */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Produce Description & Harvest Notes
            </h4>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {crop.description}
            </p>
          </div>

          {/* Farm Origin & FPO Traceability */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
            <div>
              <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                <Building className="w-4 h-4 text-emerald-600" />
                <span>Farm & Cultivator</span>
              </h5>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {crop.farmerProfileId?.farmName || crop.farmerId?.name || 'Local Farm Partner'}
              </p>
              {crop.farmerProfileId?.fpoAffiliation && (
                <p className="text-xs text-agri-700 dark:text-agri-300 font-medium mt-0.5">
                  FPO: {crop.farmerProfileId.fpoAffiliation}
                </p>
              )}
            </div>

            <div>
              <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>Farm Location</span>
              </h5>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {crop.location.village}, {crop.location.district}
              </p>
              <p className="text-xs text-slate-500">
                {crop.location.state} • PIN {crop.location.pinCode}
              </p>
            </div>

            <div>
              <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>Harvest Date</span>
              </h5>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {new Date(crop.harvestDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>

            <div>
              <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>Freshness Shelf Life</span>
              </h5>
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {crop.expectedShelfLifeDays} Days Optimal
              </p>
            </div>
          </div>

          {/* Transparent Price & Value Split Breakdown */}
          <div className="bg-cream-100 dark:bg-slate-800 rounded-2xl p-4 border border-cream-300 dark:border-slate-700">
            <h4 className="text-xs font-bold uppercase tracking-wider text-agri-800 dark:text-agri-300 mb-3 flex items-center gap-1.5">
              <HeartHandshake className="w-4 h-4 text-emerald-600" />
              <span>AgriConnect Transparent Value Split</span>
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-cream-200 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-300">Customer Price per {crop.unit}:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">₹{priceRupees}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-cream-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-300 font-semibold">
                <span>Farmer Share (90% Direct Payout):</span>
                <span>₹{farmerPayoutRupees}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-cream-200 dark:border-slate-700 text-slate-500">
                <span>Marketplace Operations & AI (8%):</span>
                <span>₹{((crop.pricePerUnitPaise * 0.08) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-500">
                <span>Payment & Reserve Overhead (2%):</span>
                <span>₹{((crop.pricePerUnitPaise * 0.02) / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Cart Action Bar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">Available Inventory</span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              {crop.availableQuantity} {crop.unit} in stock
            </span>
          </div>

          <div className="flex items-center gap-3">
            {isAvailable && (
              <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 p-1">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-10 text-center text-sm font-bold text-slate-900 dark:text-slate-100">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => Math.min(crop.availableQuantity, q + 1))}
                  disabled={quantity >= crop.availableQuantity}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={handleAdd}
              disabled={!isAvailable}
              className={`py-2.5 px-6 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-md ${
                added
                  ? 'bg-emerald-600 text-white'
                  : isAvailable
                  ? 'bg-agri-700 hover:bg-agri-800 text-white hover:scale-[1.02]'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              {added ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Added to Cart!</span>
                </>
              ) : isAvailable ? (
                <>
                  <Plus className="w-4 h-4" />
                  <span>
                    Add to Cart • ₹{((crop.pricePerUnitPaise * quantity) / 100).toFixed(2)}
                  </span>
                </>
              ) : (
                <span>Sold Out</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
