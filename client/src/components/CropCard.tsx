import React, { useState } from 'react';
import {
  MapPin,
  Calendar,
  Sparkles,
  Plus,
  Minus,
  Check,
  Package,
} from 'lucide-react';
import { CropListing } from '../types/index.js';
import { useCart } from '../context/CartContext.js';

interface CropCardProps {
  crop: CropListing;
  onSelect: (crop: CropListing) => void;
}

export const CropCard: React.FC<CropCardProps> = ({ crop, onSelect }) => {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(crop.minOrderQuantity || 1);
  const [added, setAdded] = useState(false);

  const priceRupees = (crop.pricePerUnitPaise / 100).toFixed(2);
  const farmerPayoutRupees = ((crop.pricePerUnitPaise * 0.9) / 100).toFixed(2);
  const isAvailable = crop.availableQuantity > 0 && crop.status === 'active';

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAvailable) return;
    addToCart(crop, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quantity < crop.availableQuantity) {
      setQuantity((q) => q + 1);
    }
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quantity > (crop.minOrderQuantity || 1)) {
      setQuantity((q) => q - 1);
    }
  };

  return (
    <div
      onClick={() => onSelect(crop)}
      className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-subtle hover:shadow-premium hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between"
    >
      <div>
        {/* Produce Image & Badges */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          <img
            src={crop.images?.[0] || 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?auto=format&fit=crop&w=800&q=80'}
            alt={crop.cropName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />

          {/* Quality Grade & Organic Badges */}
          <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-sm flex items-center gap-1">
              <span>Grade {crop.qualityGrade}</span>
            </span>
            {crop.isOrganicCertified && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-sm flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                <span>Organic</span>
              </span>
            )}
          </div>

          {/* Category Chip */}
          <div className="absolute top-2.5 right-2.5">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm text-slate-800 dark:text-slate-200 shadow-sm">
              {crop.category}
            </span>
          </div>

          {/* Origin Location Pill on image */}
          <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-white text-xs">
            <span className="flex items-center gap-1 drop-shadow-md text-[11px] font-medium truncate">
              <MapPin className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span>
                {crop.location.village}, {crop.location.district}
              </span>
            </span>
            <span className="text-[10px] bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded font-mono">
              {crop.unit}
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-snug group-hover:text-agri-600 dark:group-hover:text-agri-400 transition-colors">
                {crop.cropName}
              </h3>
              {crop.variety && (
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Variety: {crop.variety}
                </p>
              )}
            </div>
          </div>

          {/* Farmer & Harvest details */}
          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
            <p className="truncate">
              <span className="text-slate-400 font-normal">Farm: </span>
              <span className="font-semibold text-agri-800 dark:text-agri-300">
                {crop.farmerProfileId?.farmName || crop.farmerId?.name || 'Direct Farm Partner'}
              </span>
            </p>
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>Harvest: {new Date(crop.harvestDate).toLocaleDateString()}</span>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {crop.expectedShelfLifeDays}d shelf life
              </span>
            </div>
          </div>

          {/* Pricing & Farmer Split Snapshot */}
          <div className="bg-cream-100 dark:bg-slate-800/60 rounded-xl p-2.5 border border-cream-300 dark:border-slate-700/60">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Buyer Price</span>
                <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                  ₹{priceRupees}
                  <span className="text-xs font-normal text-slate-500">/{crop.unit}</span>
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 block">
                  Farmer Receives (90%)
                </span>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{farmerPayoutRupees}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions: Availability & Add To Cart */}
      <div className="p-4 pt-0">
        <div className="flex items-center justify-between pb-2 text-xs">
          <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Package className="w-3.5 h-3.5" />
            <span>Available:</span>
          </span>
          {isAvailable ? (
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              {crop.availableQuantity} {crop.unit} in stock
            </span>
          ) : (
            <span className="font-bold text-red-500">Sold Out</span>
          )}
        </div>

        {isAvailable ? (
          <div className="flex items-center gap-2">
            {/* Quantity Stepper */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 p-0.5"
            >
              <button
                onClick={handleDecrement}
                disabled={quantity <= (crop.minOrderQuantity || 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 transition"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-8 text-center text-xs font-bold text-slate-800 dark:text-slate-100">
                {quantity}
              </span>
              <button
                onClick={handleIncrement}
                disabled={quantity >= crop.availableQuantity}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 transition"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Add to Cart Button */}
            <button
              onClick={handleAdd}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                added
                  ? 'bg-emerald-600 text-white'
                  : 'bg-agri-700 hover:bg-agri-800 text-white hover:shadow-md'
              }`}
            >
              {added ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Added!</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Cart</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <button
            disabled
            className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed text-center"
          >
            Out of Stock
          </button>
        )}
      </div>
    </div>
  );
};
