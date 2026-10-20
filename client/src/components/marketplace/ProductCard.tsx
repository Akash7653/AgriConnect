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
  const { add } = useCart();
  const { showToast } = useToast();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [quantity, setQuantity] = useState(product.minOrderQuantity);

  function addToCart() {
    add(product, quantity);
    showToast(`${product.name} added to cart.`, 'success');
    setDetailsOpen(false);
  }

  return (
    <motion.article
      className="group flex flex-col overflow-hidden rounded-xl border border-forest/8 bg-white transition-all hover:border-forest/20 hover:shadow-cinematic sm:rounded-2xl"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-forest/5">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
            loading="lazy"
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

        <div className="mt-4 flex items-end justify-between pt-4 border-t border-forest/8 mt-auto">
          <div>
            <p className="font-display text-xl text-forest sm:text-2xl">
              {formatCurrency(product.pricePerUnit, product.currency)}
              <span className="text-sm text-charcoal/50 font-sans">/{product.unit}</span>
            </p>
            <p
              className={classNames(
                'text-xs mt-1',
                product.stockKg > 100 ? 'text-agri-emerald' : 'text-soil'
              )}
            >
              {product.stockKg} {product.unit} available
            </p>
          </div>
          <button
            onClick={addToCart}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest text-ivory transition-colors hover:bg-agri-emerald hover:text-forest sm:h-10 sm:w-10"
            aria-label={`Add ${product.name} to cart`}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {detailsOpen && (
          <motion.div className="fixed inset-0 z-[100] flex items-center justify-center bg-forest/70 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailsOpen(false); }}>
            <motion.section role="dialog" aria-modal="true" aria-label={`${product.name} details`} className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-ivory shadow-cinematic" initial={{ y: 12, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 12, scale: 0.98 }}>
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
                  <button type="button" onClick={addToCart} disabled={!Number.isFinite(quantity) || quantity < product.minOrderQuantity || quantity > product.stockKg} className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-ivory disabled:opacity-40"><Plus className="h-4 w-4" />Add to cart</button>
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
