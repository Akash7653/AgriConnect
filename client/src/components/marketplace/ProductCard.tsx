import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Plus, MapPin, Sprout, X } from 'lucide-react';
import type { CropProduct } from '@/types';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/useToast';
import { formatCurrency, classNames } from '@/utils';
import { Badge } from '@/components/ui';

export function ProductCard({ product, index }: { product: CropProduct; index: number }) {
  const { add, items } = useCart();
  const { showToast } = useToast();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [quantity, setQuantity] = useState(product.minOrderQuantity);
  const cartQuantity = items.find((item) => item.productId === product.id)?.quantity ?? 0;
  const canPurchase = product.stockKg >= product.minOrderQuantity;

  function addToCart() {
    if (!Number.isFinite(quantity) || quantity < product.minOrderQuantity || quantity > product.stockKg) {
      showToast('Choose a quantity within the available stock.', 'error');
      return;
    }
    if (cartQuantity + quantity > product.stockKg) {
      showToast(`Only ${Math.max(0, product.stockKg - cartQuantity)} ${product.unit} remain available to add.`, 'error');
      return;
    }
    add(product, quantity);
    showToast(`${product.name} added to cart.`, 'success');
    setDetailsOpen(false);
  }

  return (
    <motion.article
      className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-forest/10 bg-white transition-colors hover:border-forest/20 sm:rounded-2xl"
      initial={index < 6 ? { opacity: 0, y: 8 } : false}
      whileInView={index < 6 ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true }}
      transition={{ duration: 0.25 }}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-forest/5">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-agri-green" aria-label="Product image unavailable">
            <Sprout className="h-12 w-12" aria-hidden="true" />
          </div>
        )}
        <div className="absolute top-3 left-3 flex gap-2">
          {product.isOrganic && <Badge tone="emerald">Organic</Badge>}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-5">
        <button type="button" onClick={() => setDetailsOpen(true)} className="text-left font-display text-base text-forest hover:underline sm:text-lg">{product.name}</button>
        <p className="text-sm text-charcoal/60 mt-1 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" /> {product.origin}
        </p>
        <p className="text-xs text-charcoal/50 mt-1 flex items-center gap-1.5">
          <Sprout className="h-3.5 w-3.5" /> by {product.farmerName}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 border-t border-forest/8 pt-3">
          <div>
            <p className="font-display text-lg text-forest sm:text-2xl">
              {formatCurrency(product.pricePerUnit, product.currency)}
              <span className="text-sm text-charcoal/50 font-sans">/{product.unit}</span>
            </p>
            <p className={classNames('mt-1 text-xs', product.stockKg > 0 ? 'text-agri-green' : 'text-red-700')}>
              {product.stockKg > 0 ? `${product.stockKg} ${product.unit} available` : 'Out of stock'}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {cartQuantity > 0 && <span className="text-[10px] font-medium text-agri-green">{cartQuantity} in cart</span>}
            <button
              type="button"
              onClick={addToCart}
              disabled={!canPurchase || cartQuantity + product.minOrderQuantity > product.stockKg}
              className="min-h-10 rounded-xl bg-forest px-3 text-xs font-semibold text-ivory transition-colors hover:bg-agri-emerald hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-agri-green disabled:cursor-not-allowed disabled:bg-charcoal/20 disabled:text-charcoal/55"
              aria-label={`Add ${product.name} to cart`}
            >
              {canPurchase ? `Add ${product.minOrderQuantity} ${product.unit}` : 'Unavailable'}
            </button>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {detailsOpen && (
          <motion.div className="fixed inset-0 z-[100] flex items-end justify-center bg-forest/70 p-0 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailsOpen(false); }}>
            <motion.section role="dialog" aria-modal="true" aria-label={`${product.name} details`} className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-ivory pb-[env(safe-area-inset-bottom)] shadow-cinematic sm:rounded-2xl sm:pb-0" initial={{ y: 12, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 12, scale: 0.98 }}>
              <div className="flex items-center justify-between p-4">
                <h2 className="font-display text-xl text-forest">{product.name}</h2>
                <button type="button" onClick={() => setDetailsOpen(false)} aria-label="Close product details" className="rounded-full p-2 text-forest hover:bg-forest/10"><X className="h-5 w-5" /></button>
              </div>
              {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="max-h-80 w-full object-cover" /> : <div className="flex h-48 items-center justify-center bg-forest/5 text-agri-green"><Sprout className="h-14 w-14" aria-hidden="true" /></div>}
              <div className="space-y-3 p-5">
                <p className="text-sm text-charcoal/65">{product.description || 'Fresh produce listed directly by the farmer.'}</p>
                <p className="text-sm text-charcoal/65">From {product.farmerName} · {product.origin || 'Location not provided'}</p>
                <p className="font-display text-xl text-forest">{formatCurrency(product.pricePerUnit, product.currency)} / {product.unit} · {product.stockKg} {product.unit} available</p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-sm text-charcoal/70">Quantity ({product.unit})
                    <input aria-label={`Quantity for ${product.name}`} type="number" min={product.minOrderQuantity} max={product.stockKg} step="any" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="ml-2 w-28 rounded-lg border border-forest/15 bg-white px-3 py-2" />
                  </label>
                  <button type="button" onClick={addToCart} disabled={!canPurchase || !Number.isFinite(quantity) || quantity < product.minOrderQuantity || quantity > product.stockKg || cartQuantity + quantity > product.stockKg} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-ivory disabled:opacity-40"><Plus className="h-4 w-4" />Add to cart</button>
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

export function ProductCardPlaceholder() {
  return (
    <Link
      to="/dashboard/marketplace"
      className="group rounded-2xl overflow-hidden bg-forest text-ivory p-8 flex flex-col justify-between hover:bg-forest-800 transition-colors"
    >
      <p className="eyebrow text-agri-emerald">Marketplace</p>
      <div>
        <p className="font-display text-2xl mt-3">Browse fresh produce from verified farmers.</p>
        <p className="text-ivory/60 text-sm mt-2">Vegetables, fruits, grains, pulses, herbs and more.</p>
      </div>
      <p className="mt-6 text-agri-emerald text-sm font-semibold flex items-center gap-1.5">
        Explore <Plus className="h-4 w-4" />
      </p>
    </Link>
  );
}
