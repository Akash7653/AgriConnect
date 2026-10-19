import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Plus, Star, MapPin, Sprout } from 'lucide-react';
import type { CropProduct } from '@/types';
import { useCart } from '@/hooks/useCart';
import { formatCurrency, classNames } from '@/utils';
import { Badge } from '@/components/ui';

export function ProductCard({ product, index }: { product: CropProduct; index: number }) {
  const { add } = useCart();

  return (
    <motion.article
      className="group bg-white rounded-2xl overflow-hidden border border-forest/8 hover:border-forest/20 transition-all hover:shadow-cinematic flex flex-col"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-forest/5">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
          loading="lazy"
        />
        <div className="absolute top-3 left-3 flex gap-2">
          {product.isOrganic && <Badge tone="emerald">Organic</Badge>}
        </div>
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-forest/80 text-ivory px-2.5 py-1 rounded-full text-xs">
          <Star className="h-3 w-3 fill-agri-emerald text-agri-emerald" />
          {product.rating}
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-display text-lg text-forest">{product.name}</h3>
        <p className="text-sm text-charcoal/60 mt-1 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" /> {product.origin}
        </p>
        <p className="text-xs text-charcoal/50 mt-1 flex items-center gap-1.5">
          <Sprout className="h-3.5 w-3.5" /> by {product.farmerName}
        </p>

        <div className="mt-4 flex items-end justify-between pt-4 border-t border-forest/8 mt-auto">
          <div>
            <p className="font-display text-2xl text-forest">
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
            onClick={() => add(product, 1)}
            className="h-10 w-10 rounded-full bg-forest text-ivory flex items-center justify-center hover:bg-agri-emerald hover:text-forest transition-colors"
            aria-label={`Add ${product.name} to cart`}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>
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
