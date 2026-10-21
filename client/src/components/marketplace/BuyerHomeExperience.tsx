import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronDown, MapPin, Search, ShoppingCart, Sprout, X } from 'lucide-react';
import { LocationSelector } from '@/components/marketplace/LocationSelector';
import { ProductCard } from '@/components/marketplace/ProductCard';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { request } from '@/services/api';
import { ProductsService } from '@/services/products';
import type { CropProduct, ProductCategory } from '@/types';
import { classNames, formatCurrency } from '@/utils';

const categoryNames: Record<ProductCategory, string> = {
  vegetables: 'Vegetables',
  fruits: 'Fruits',
  grains: 'Grains & Cereals',
  pulses: 'Pulses',
  spices: 'Spices',
  dairy: 'Dairy',
  herbs: 'Greens & Herbs',
  'organic-special': 'Organic Special',
};

interface StorefrontCampaign {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: ProductCategory;
  ctaLabel: string;
}

export function BuyerHomeExperience() {
  const { session, updateAddress } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const [products, setProducts] = useState<CropProduct[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState('');
  const [campaigns, setCampaigns] = useState<StorefrontCampaign[]>([]);
  const [campaignError, setCampaignError] = useState('');
  const [locationOpen, setLocationOpen] = useState(false);
  const [manualLocation, setManualLocation] = useState({ city: '', district: '', state: '', pinCode: '' });
  const [guestLocation, setGuestLocation] = useState<{ city: string; district: string; state: string; pinCode: string } | null>(() => {
    try {
      const saved = localStorage.getItem('agriconnect-delivery-location');
      if (!saved) return null;
      const location = JSON.parse(saved) as { city?: unknown; district?: unknown; state?: unknown; pinCode?: unknown };
      if (
        typeof location.city === 'string' &&
        typeof location.district === 'string' &&
        typeof location.state === 'string' &&
        typeof location.pinCode === 'string'
      ) {
        return { city: location.city, district: location.district, state: location.state, pinCode: location.pinCode };
      }
      console.warn('Saved delivery location was incomplete and has been ignored.');
    } catch (error) {
      console.warn('Saved delivery location could not be read.', error);
    }
    return null;
  });
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | undefined>();
  const [locationError, setLocationError] = useState('');
  const [serviceabilityMessage, setServiceabilityMessage] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);

  useEffect(() => {
    const state = routeLocation.state;
    if (
      typeof state === 'object' &&
      state !== null &&
      'openDeliveryLocation' in state &&
      state.openDeliveryLocation === true
    ) {
      setLocationOpen(true);
      navigate(routeLocation.pathname, { replace: true, state: null });
    }
  }, [navigate, routeLocation.pathname, routeLocation.state]);

  const user = session?.user;
  const address = user?.address;
  const deliveryState = address?.state || guestLocation?.state;
  const deliveryDistrict = address?.district || guestLocation?.district;
  const addressLabel = [address?.villageOrCity, address?.district, address?.state].filter(Boolean).join(', ')
    || [guestLocation?.city, guestLocation?.district, guestLocation?.state].filter(Boolean).join(', ');
  const categories = useMemo(() => {
    const present = new Set(products.map((product) => product.category));
    return (Object.keys(categoryNames) as ProductCategory[])
      .filter((category) => present.has(category))
      .map((category) => ({ category, label: categoryNames[category] }));
  }, [products]);
  const suggestions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return [];
    return products
      .filter((product) => product.name.toLowerCase().includes(term))
      .slice(0, 4);
  }, [products, query]);
  const availableCampaigns = useMemo(() => {
    const availableCategories = new Set(products.map((product) => product.category));
    return campaigns.filter((campaign) => availableCategories.has(campaign.category));
  }, [campaigns, products]);
  const featuredProducts = useMemo(() => {
    const seenCategories = new Set<ProductCategory>();
    return products.filter((product) => {
      if (seenCategories.has(product.category)) return false;
      seenCategories.add(product.category);
      return true;
    }).slice(0, 4);
  }, [products]);

  useEffect(() => {
    let active = true;
    request<{ campaigns: StorefrontCampaign[] }>('/storefront/campaigns')
      .then((result) => {
        if (active) {
          setCampaigns(result.campaigns);
          setCampaignError('');
        }
      })
      .catch(() => {
        if (active) setCampaignError('Promotional campaigns could not be loaded.');
      });
    return () => { active = false; };
  }, [retryCount]);

  useEffect(() => {
    let active = true;
    if (session && !['buyer', 'business'].includes(session.user.role)) {
      setProducts([]);
      setLoading(false);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    const timeout = window.setTimeout(() => {
      ProductsService.list(session, {
        category: categoryFilter,
        query: query.trim() || undefined,
        state: deliveryState,
        district: deliveryDistrict,
        limit: session ? 100 : 24,
      })
        .then((items) => { if (active) setProducts(items); })
        .catch((loadError: unknown) => {
          if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load available listings.');
        })
        .finally(() => { if (active) setLoading(false); });
    }, query.trim() ? 250 : 0);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [session, query, categoryFilter, deliveryDistrict, deliveryState, retryCount]);

  async function saveLocation(location: { city: string; district: string; state: string; pinCode: string; displayName?: string }): Promise<boolean> {
    setSavingLocation(true);
    setLocationError('');
    setServiceabilityMessage('');
    try {
      let statusMessage = 'Delivery serviceability could not be verified. Confirm availability during checkout.';
      try {
        const result = await request<{
          configured: boolean;
          serviceable: boolean;
          zone?: { estimatedDeliveryDays?: number };
        }>(
          `/serviceability?${new URLSearchParams({ city: location.city, state: location.state, pinCode: location.pinCode })}`
        );
        statusMessage = !result.configured
          ? 'Delivery serviceability is not configured yet. Availability will be confirmed at checkout.'
          : result.serviceable
            ? result.zone?.estimatedDeliveryDays
              ? `Estimated delivery within ${result.zone.estimatedDeliveryDays} ${result.zone.estimatedDeliveryDays === 1 ? 'day' : 'days'} after order confirmation. Timing may vary.`
              : 'This PIN code is in a supported delivery area. Delivery timing is not configured.'
            : 'Delivery is not currently available for this PIN code.';
      } catch {
        statusMessage = 'Delivery serviceability could not be verified. Confirm availability during checkout.';
      }
      if (session) {
        await updateAddress({
          ...session.user.address,
          street: location.displayName ?? session.user.address?.street,
          villageOrCity: location.city,
          district: location.district,
          state: location.state,
          pinCode: location.pinCode,
        });
      } else {
        setGuestLocation(location);
        try {
          localStorage.setItem('agriconnect-delivery-location', JSON.stringify({
            city: location.city,
            district: location.district,
            state: location.state,
            pinCode: location.pinCode,
          }));
        } catch (storageError) {
          setLocationError('This location is selected for now, but could not be saved on this device.');
          console.error('Could not persist guest delivery location.', storageError);
          return false;
        }
      }
      setServiceabilityMessage(statusMessage);
      setLocationOpen(false);
      return true;
    } catch (saveError) {
      setLocationError(saveError instanceof Error ? saveError.message : 'Could not save this delivery location.');
      return false;
    } finally {
      setSavingLocation(false);
    }
  }

  function browseCategory(category?: ProductCategory, search?: string) {
    if (!session) {
      setCategoryFilter(category);
      setQuery(search ?? '');
      document.getElementById('fresh-listings-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    navigate(`/dashboard/marketplace${params.size ? `?${params}` : ''}#categories`);
  }

  return (
    <main className="min-h-screen bg-ivory pb-[calc(5.5rem+env(safe-area-inset-bottom))] text-forest">
      <div className="mx-auto max-w-7xl px-4 pt-[4.25rem] sm:px-6 lg:pt-24">
        <header className="flex items-center justify-end gap-2 border-b border-forest/10 pb-2">
          <button
            type="button"
            onClick={() => { setManualLocation({ city: address?.villageOrCity ?? '', district: address?.district ?? '', state: address?.state ?? '', pinCode: address?.pinCode ?? '' }); setLocationOpen(true); }}
            className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-forest/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-agri-green"
            aria-label="Change delivery location"
          >
            <MapPin className="h-5 w-5 shrink-0 text-agri-green" />
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-charcoal/55">Deliver to</span>
              <span className="block max-w-[55vw] truncate text-sm font-semibold">{addressLabel || 'Choose your location'}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard/marketplace#cart')}
            aria-label={`Open cart, ${totalItems} items`}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-forest/10 bg-white"
          >
            <ShoppingCart className="h-5 w-5" />
            {totalItems > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-agri-emerald px-1 text-[10px] font-bold">{totalItems}</span>}
          </button>
        </header>

        {serviceabilityMessage && (
          <p className="mt-2 flex items-center gap-1 text-xs text-charcoal/65" aria-live="polite">
            <CheckCircle2 className="h-3.5 w-3.5 text-agri-green" />{serviceabilityMessage}
          </p>
        )}

        <section className="sticky top-0 z-30 -mx-4 mt-3 bg-ivory/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6" aria-label="Catalogue search">
          <label className="relative block">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-charcoal/45" />
            <input
              id="home-product-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search vegetables, grains, fruits…"
              aria-label="Search available products"
              className="min-h-12 w-full rounded-2xl border border-forest/15 bg-white pl-12 pr-11 text-base shadow-sm outline-none placeholder:text-charcoal/45 focus:border-agri-green focus:ring-2 focus:ring-agri-green/20"
            />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-charcoal/55 hover:bg-forest/5"><X className="h-4 w-4" /></button>}
          </label>
          {suggestions.length > 0 && (
            <div className="absolute left-4 right-4 top-full z-10 rounded-b-2xl border border-forest/10 bg-white p-2 shadow-lg sm:left-6 sm:right-6">
              {suggestions.map((product) => (
                <button key={product.id} type="button" onClick={() => browseCategory(product.category, product.name)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-forest/5">
                  <Search className="h-4 w-4 text-charcoal/40" /><span className="truncate text-sm">{product.name}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {!session ? (
          <section className="relative mt-3 overflow-hidden rounded-3xl bg-gradient-to-br from-forest via-[#24563a] to-[#3f7a47] px-5 py-6 text-ivory shadow-lg sm:px-9 sm:py-8">
            <div className="absolute -right-12 -top-10 h-48 w-48 rounded-full border-[24px] border-white/5" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-agri-emerald">Fresh finds, straight from farms</p>
            <h1 className="mt-2 max-w-xl font-display text-3xl leading-tight sm:text-4xl">Your daily market, grown nearby.</h1>
            <p className="mt-2 max-w-xl text-sm text-ivory/75">Browse real farmer listings, see current prices and stock, and choose what goes in your basket.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/register" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-agri-emerald px-4 text-sm font-semibold text-forest">Create a buyer account <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/login?redirect=%2Fdashboard%2Fmarketplace" className="inline-flex min-h-11 items-center rounded-xl border border-white/25 px-4 text-sm font-semibold text-ivory">Sign in</Link>
            </div>
            <p className="mt-3 text-[11px] text-ivory/60">Sign in is required to place an order. Delivery availability is confirmed at checkout.</p>
          </section>
        ) : (
          <section className="mt-3 rounded-3xl bg-forest px-5 py-6 text-ivory sm:px-9 sm:py-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-agri-emerald">AgriConnect marketplace</p>
              <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h1 className="font-display text-3xl leading-tight sm:text-4xl">Fresh listings from verified farms.</h1>
                  <p className="mt-2 max-w-xl text-sm text-ivory/70">See current seller prices and stock. Delivery availability is confirmed at checkout.</p>
                </div>
                <button type="button" onClick={() => browseCategory()} className="inline-flex min-h-10 shrink-0 items-center gap-2 self-start rounded-xl border border-ivory/25 px-4 text-sm font-medium hover:bg-white/10">Browse all <ArrowRight className="h-4 w-4" /></button>
              </div>
          </section>
        )}

            {categories.length > 0 && (
              <section id="home-categories" className="mt-6 scroll-mt-24" aria-labelledby="home-categories-title">
                <div className="mb-3 flex items-center justify-between">
                  <h2 id="home-categories-title" className="font-display text-xl">Shop by category</h2>
                  <button type="button" onClick={() => browseCategory()} className="text-xs font-semibold text-agri-green">All listings</button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {categories.map(({ category, label }) => (
                    <button key={category} type="button" onClick={() => browseCategory(category)} className="flex min-w-[100px] flex-col items-center gap-2 rounded-2xl border border-forest/10 bg-white px-4 py-4 text-center hover:border-agri-green">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-agri-emerald/15 text-agri-green"><Sprout className="h-6 w-6" /></span>
                      <span className="text-xs font-medium leading-tight">{label}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {(availableCampaigns.length > 0 || featuredProducts.length > 0) && (
              <section className="mt-6" aria-label={availableCampaigns.length > 0 ? 'Promotional campaigns' : 'Featured listings'}>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-agri-green">
                      {availableCampaigns.length > 0 ? 'From AgriConnect' : 'From the live catalogue'}
                    </p>
                    <h2 className="font-display text-xl">
                      {availableCampaigns.length > 0 ? 'Offers and campaigns' : 'Explore featured produce'}
                    </h2>
                  </div>
                </div>
                {campaignError && (
                  <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-800">
                    <span>{campaignError}</span>
                    <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="font-semibold underline">Retry</button>
                  </div>
                )}
                <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3" aria-label="Swipe to browse featured items">
                  {availableCampaigns.length > 0
                    ? availableCampaigns.map((campaign) => (
                      <article key={campaign.id} className="relative h-48 min-w-[min(88vw,28rem)] snap-start overflow-hidden rounded-2xl bg-forest text-white sm:h-56">
                        <img src={campaign.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-r from-forest/95 via-forest/70 to-forest/10" />
                        <div className="relative flex h-full max-w-[85%] flex-col items-start justify-center p-5 sm:p-7">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-agri-emerald">{categoryNames[campaign.category]}</p>
                          <h3 className="mt-2 font-display text-2xl leading-tight sm:text-3xl">{campaign.title}</h3>
                          <p className="mt-1 line-clamp-2 text-xs text-white/80 sm:text-sm">{campaign.description}</p>
                          <button type="button" onClick={() => browseCategory(campaign.category)} className="mt-3 min-h-9 rounded-lg bg-white px-3 text-xs font-semibold text-forest">
                            {campaign.ctaLabel}
                          </button>
                        </div>
                      </article>
                    ))
                    : featuredProducts.map((product) => (
                      <article key={product.id} className="relative h-48 min-w-[min(88vw,28rem)] snap-start overflow-hidden rounded-2xl bg-forest text-white sm:h-56">
                        {product.imageUrl && <img src={product.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
                        <div className="absolute inset-0 bg-gradient-to-r from-forest/95 via-forest/70 to-forest/10" />
                        <div className="relative flex h-full max-w-[85%] flex-col items-start justify-center p-5 sm:p-7">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-agri-emerald">{categoryNames[product.category]} · Available now</p>
                          <h3 className="mt-2 font-display text-2xl leading-tight sm:text-3xl">{product.name}</h3>
                          <p className="mt-1 line-clamp-2 text-xs text-white/80 sm:text-sm">
                            {product.farmerName} · {product.stockKg} {product.unit} available · {formatCurrency(product.pricePerUnit, product.currency)}/{product.unit}
                          </p>
                          <button type="button" onClick={() => browseCategory(product.category)} className="mt-3 min-h-9 rounded-lg bg-white px-3 text-xs font-semibold text-forest">
                            Shop this category
                          </button>
                        </div>
                      </article>
                    ))}
                </div>
              </section>
            )}

            <section className="mt-7 scroll-mt-24" aria-labelledby="fresh-listings-title">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-agri-green">Recently listed</p>
                  <h2 id="fresh-listings-title" className="font-display text-2xl">Available produce</h2>
                </div>
                {products.length > 6 && <button type="button" onClick={() => browseCategory()} className="shrink-0 text-xs font-semibold text-agri-green">View all</button>}
              </div>
              {loading ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 4 }, (_, index) => <div key={index} className="aspect-[4/5] animate-pulse rounded-2xl bg-forest/10" />)}
                </div>
              ) : error ? (
                <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <p>{error}</p>
                  <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="mt-2 font-semibold underline">Retry</button>
                </div>
              ) : products.length === 0 ? (
                <div className="rounded-2xl border border-forest/10 bg-white p-5 text-sm text-charcoal/65">
                  No active listings match this search or delivery area. Try another search or update your location.
                </div>
              ) : (
                <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                  {products.slice(0, 6).map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}
                </div>
              )}
            </section>
      </div>

      {locationOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-charcoal/50 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLocationOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="delivery-location-heading" className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-ivory p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-cinematic sm:rounded-3xl sm:pb-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="delivery-location-heading" className="font-display text-2xl">Delivery location</h2>
              <button type="button" onClick={() => setLocationOpen(false)} aria-label="Close location selector" className="rounded-full p-2 hover:bg-forest/5"><X className="h-5 w-5" /></button>
            </div>
            <LocationSelector onResolved={(resolved) => {
              const fields = { city: resolved.city, district: resolved.district, state: resolved.state, pinCode: resolved.pinCode };
              setManualLocation(fields);
              return saveLocation({ ...fields, displayName: resolved.displayName });
            }} />
            <form onSubmit={(event) => { event.preventDefault(); void saveLocation(manualLocation); }} className="mt-4 space-y-3">
              <p className="text-sm font-semibold">Or enter it manually</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['city', 'City / locality'],
                  ['district', 'District'],
                  ['state', 'State'],
                  ['pinCode', 'PIN code'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="text-xs font-medium text-charcoal/70">
                    {label}
                    <input required minLength={key === 'pinCode' ? 5 : 2} value={manualLocation[key]} onChange={(event) => setManualLocation((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-forest/15 bg-white px-3 text-sm text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-agri-green" />
                  </label>
                ))}
              </div>
              {locationError && <p role="alert" className="text-sm text-red-700">{locationError}</p>}
              <button type="submit" disabled={savingLocation} className={classNames('min-h-11 w-full rounded-xl bg-forest px-4 text-sm font-semibold text-ivory hover:bg-agri-green disabled:opacity-50')}>
                {savingLocation ? 'Saving location…' : 'Save delivery location'}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
