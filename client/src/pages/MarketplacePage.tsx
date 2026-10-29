import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ShoppingCart, Trash2, Minus, Plus, X, ShoppingBag, Loader2, CheckCircle2, Sparkles, Sprout } from 'lucide-react';
import { ProductCard } from '@/components/marketplace/ProductCard';
import { LocationSelector } from '@/components/marketplace/LocationSelector';
import { ProductsService } from '@/services/products';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { getLocationServiceability } from '@/services/location';
import { PaymentService, playPaymentSuccessSound, type CheckoutPaymentMethod, type DeliveryAddress } from '@/services/payment';
import { subscribeRealtime } from '@/services/realtime';
import type { CropProduct, ProductCategory, User } from '@/types';
import { formatCurrency, classNames } from '@/utils';

const categories: { value: ProductCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'vegetables', label: 'Vegetables' },
  { value: 'fruits', label: 'Fruits' },
  { value: 'grains', label: 'Grains & cereals' },
  { value: 'pulses', label: 'Pulses' },
  { value: 'spices', label: 'Spices' },
  { value: 'herbs', label: 'Greens & herbs' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'organic-special', label: 'Organic Special' },
];

const categoryBySlug: Partial<Record<string, ProductCategory>> = {
  vegetables: 'vegetables',
  fruits: 'fruits',
  grains: 'grains',
  pulses: 'pulses',
  spices: 'spices',
  herbs: 'herbs',
  dairy: 'dairy',
  'organic-special': 'organic-special',
};

export function MarketplacePage() {
  const [products, setProducts] = useState<CropProduct[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('category') ?? '';
  const category: ProductCategory | 'all' = categoryBySlug[categoryParam] ?? 'all';
  const query = searchParams.get('search') ?? '';
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [retryCount, setRetryCount] = useState(0);
  const [catalogueCategories, setCatalogueCategories] = useState<Set<ProductCategory>>(new Set());
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [successOrder, setSuccessOrder] = useState('');
  const [successAmountPaise, setSuccessAmountPaise] = useState<number | null>(null);
  const [successPaymentMethod, setSuccessPaymentMethod] = useState<CheckoutPaymentMethod>('razorpay');
  const checkoutIdempotencyKey = useRef<string | null>(null);
  const { session, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { items, totalItems, totalAmount, remove, setQuantity, clear } = useCart();
  const availableCategories = categories.filter((entry) =>
    entry.value === 'all' || catalogueCategories.has(entry.value)
  );

  function updateSearch(search: string) {
    const next = new URLSearchParams(searchParams);
    if (search) next.set('search', search);
    else next.delete('search');
    setSearchParams(next, { replace: true });
  }

  function updateCategory(value: ProductCategory | 'all') {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete('category');
    else next.set('category', value);
    setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  async function startPayment(address: DeliveryAddress, paymentMethod: CheckoutPaymentMethod) {
    if (!session) return;
    setCheckoutBusy(true);
    setCheckoutError('');
    try {
      checkoutIdempotencyKey.current ??= crypto.randomUUID();
      const order = await PaymentService.createOrder(
        session,
        items,
        address,
        paymentMethod,
        checkoutIdempotencyKey.current
      );
      checkoutIdempotencyKey.current = null;
      if (order.paymentMethod === 'cod') {
        clear();
        setSuccessPaymentMethod('cod');
        setSuccessAmountPaise(order.amountPaise);
        setCheckoutOpen(false);
        setCartOpen(false);
        setSuccessOrder(order.orderNumber);
        showToast(`Order ${order.orderNumber} placed. Pay cash on delivery.`, 'success');
        return;
      }
      await PaymentService.openCheckout(
        order,
        session,
        (orderNumber, amountPaise) => {
          clear();
          setCheckoutOpen(false);
          setCartOpen(false);
          setSuccessPaymentMethod('razorpay');
          setSuccessAmountPaise(amountPaise);
          PaymentService.recordPayment({
            orderNumber,
            amount: amountPaise / 100,
            currency: 'INR',
            paidAt: new Date().toISOString(),
            buyerEmail: session.user.email,
            status: 'captured',
          });
          playPaymentSuccessSound();
          setSuccessOrder(orderNumber);
          showToast(`Order ${orderNumber} placed successfully.`, 'success');
        },
        (message) => {
          setCheckoutError(message);
          showToast(message, 'error');
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start payment.';
      setCheckoutError(message);
      showToast(message, 'error');
    } finally {
      setCheckoutBusy(false);
    }
  }

  useEffect(() => {
    if (!session || !['buyer', 'business'].includes(session.user.role)) {
      setProducts([]);
      setLoading(false);
      setError('The marketplace is available to buyer accounts.');
      return;
    }
    setLoading(true);
    setError('');
    ProductsService.list(session, {
      category: category === 'all' ? undefined : category,
      query: debouncedQuery || undefined,
      state: session.user.address?.state,
      district: session.user.address?.district,
      limit: 100,
    })
      .then(setProducts)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Could not load products. Please try again.'))
      .finally(() => setLoading(false));
  }, [category, debouncedQuery, retryCount, session]);

  useEffect(() => {
    if (!session || !['buyer', 'business'].includes(session.user.role)) return;
    let active = true;
    ProductsService.list(session, {
      state: session.user.address?.state,
      district: session.user.address?.district,
      limit: 100,
    }).then((catalogue) => {
      if (active) setCatalogueCategories(new Set(catalogue.map((product) => product.category)));
    }).catch(() => {
      if (active) setCatalogueCategories(new Set());
    });
    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    if (location.hash === '#cart') setCartOpen(true);
    if (location.hash === '#product-search') {
      document.getElementById('product-search')?.focus();
    }
    if (location.hash === '#categories') {
      document.getElementById('categories')?.scrollIntoView({ block: 'start' });
    }
  }, [location.hash]);

  useEffect(() => {
    if (!session) return;
    return subscribeRealtime(session.token, () => {
      ProductsService.list(session, {
        category: category === 'all' ? undefined : category,
        query: debouncedQuery || undefined,
        state: session.user.address?.state,
        district: session.user.address?.district,
      }).then(setProducts).catch(() => setError('Live inventory refresh failed.'));
    });
  }, [category, debouncedQuery, session]);

  return (
    <div className="min-w-0 max-w-full overflow-hidden bg-ivory">
      <div className="min-w-0 max-w-full pt-6 pb-12">
        <div className="mx-auto min-w-0 max-w-9xl px-4 sm:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
            <div>
              <p className="eyebrow text-agri-green mb-3">Marketplace</p>
              <h1 className="font-display font-light text-forest text-4xl sm:text-5xl tracking-tightest">
                Fresh from verified farms.
              </h1>
              <p className="mt-3 text-charcoal/60 text-pretty max-w-lg">
                Browse produce listed by verified farmers and FPOs across India, with transparent
                pricing and secure checkout.
              </p>
            </div>
            <button
              onClick={() => setCartOpen(true)}
              className="relative hidden self-start items-center gap-2 rounded-full bg-forest px-5 py-3 text-ivory transition-colors hover:bg-agri-emerald hover:text-forest sm:inline-flex sm:self-auto"
            >
              <ShoppingCart className="h-4 w-4" />
              Cart
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-agri-emerald text-forest text-xs font-bold h-5 w-5 rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>
          </div>

          <div className="sticky top-[68px] z-10 -mx-4 mb-5 bg-ivory/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0 lg:mb-8 lg:flex lg:flex-row lg:gap-4">
            <div className="relative flex-1 scroll-mt-28">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal/40" />
              <input
                id="product-search"
                value={query}
                onChange={(e) => updateSearch(e.target.value)}
                placeholder="Search crops, farmers, regions…"
                aria-label="Search crops, farmers, or regions"
                className="w-full rounded-full border border-forest/15 bg-white/60 pl-11 pr-4 py-3 text-forest placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-agri-emerald"
              />
              {query && <button type="button" onClick={() => updateSearch('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-charcoal/50 hover:bg-forest/5"><X className="h-4 w-4" /></button>}
            </div>
            <div id="categories" className="mt-3 flex min-w-0 max-w-full scroll-mt-28 gap-2 overflow-x-auto pb-1 lg:mt-0 lg:flex-wrap">
              {availableCategories.map((c) => (
                <button
                  key={c.value}
                  onClick={() => updateCategory(c.value)}
                  className={classNames(
                    'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                    category === c.value
                      ? 'bg-forest text-ivory'
                      : 'bg-white/60 text-charcoal/70 border border-forest/15 hover:border-forest/30'
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div className="py-24 flex items-center justify-center text-charcoal/50">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading produce…
            </div>
          )}
          {error && !loading && (
            <div className="py-16 text-center">
              <p role="alert" className="text-red-700">{error}</p>
              <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="mt-3 min-h-10 rounded-xl border border-forest/15 px-4 text-sm font-semibold text-forest">Retry</button>
            </div>
          )}
          {!loading && !error && products && products.length === 0 && (
            <div className="py-24 text-center">
              <ShoppingBag className="h-10 w-10 mx-auto text-charcoal/30 mb-4" />
              <p className="text-charcoal/60">No products match your search.</p>
            </div>
          )}
          {!loading && !error && products && products.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => setCartOpen(true)}
        className="fixed bottom-24 right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-forest text-ivory shadow-cinematic transition-colors hover:bg-agri-emerald hover:text-forest sm:hidden"
        aria-label="Open cart"
      >
        <ShoppingCart className="h-5 w-5" />
        {totalItems > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-agri-emerald text-xs font-bold text-forest">
            {totalItems}
          </span>
        )}
      </button>

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={items}
        totalAmount={totalAmount}
        onRemove={remove}
        onSetQuantity={setQuantity}
        onClear={() => {
          clear();
          showToast('Cart cleared.', 'info');
        }}
        isAuthenticated={isAuthenticated}
        checkoutOpen={checkoutOpen}
        checkoutBusy={checkoutBusy}
        checkoutError={checkoutError}
        profile={session?.user}
        onCheckout={() => {
          if (!isAuthenticated) {
            navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
            return;
          }
          setCheckoutError('');
          setCheckoutOpen(true);
        }}
        onPay={startPayment}
        onBackToCart={() => setCheckoutOpen(false)}
      />

      <AnimatePresence>
        {successOrder && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-forest/35 px-5 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative w-full max-w-sm rounded-3xl bg-ivory p-8 text-center shadow-cinematic"
              initial={{ opacity: 0, scale: 0.82, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            >
              <motion.div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-agri-emerald/15 text-agri-emerald"
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 14 }}
              >
                <CheckCircle2 className="h-9 w-9" strokeWidth={1.7} />
              </motion.div>
              <Sparkles className="absolute right-10 top-8 h-5 w-5 text-agri-emerald" />
              <h2 className="mt-5 font-display text-3xl text-forest">
                {successPaymentMethod === 'cod' ? 'Order placed' : 'Payment confirmed'}
              </h2>
              <p className="mt-2 text-sm text-charcoal/65">
                Order <span className="font-semibold text-forest">{successOrder}</span>{' '}
                {successPaymentMethod === 'cod'
                  ? 'is confirmed. Pay the order total in cash when it is delivered.'
                  : 'is now being prepared.'}
              </p>
              {successAmountPaise !== null && <p className="mt-3 text-sm font-semibold text-forest">Server-confirmed total: {formatCurrency(successAmountPaise / 100)}</p>}
              <button
                onClick={() => setSuccessOrder('')}
                className="mt-7 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-ivory transition-colors hover:bg-agri-emerald hover:text-forest"
              >
                Continue shopping
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: ReturnType<typeof useCart>['items'];
  totalAmount: number;
  onRemove: (id: string) => void;
  onSetQuantity: (id: string, qty: number) => void;
  onClear: () => void;
  isAuthenticated: boolean;
  checkoutOpen: boolean;
  checkoutBusy: boolean;
  checkoutError: string;
  profile?: User;
  onCheckout: () => void;
  onPay: (address: DeliveryAddress, paymentMethod: CheckoutPaymentMethod) => void;
  onBackToCart: () => void;
}

function CartDrawer({
  open,
  onClose,
  items,
  totalAmount,
  onRemove,
  onSetQuantity,
  onClear,
  isAuthenticated,
  checkoutOpen,
  checkoutBusy,
  checkoutError,
  profile,
  onCheckout,
  onPay,
  onBackToCart,
}: CartDrawerProps) {
  const { updateAddress: persistProfileAddress } = useAuth();
  const [address, setAddress] = useState<DeliveryAddress>(() => ({
    recipientName: profile?.fullName ?? '',
    phone: profile?.phone ?? '',
    addressLine1: profile?.address?.street ?? '',
    city: profile?.address?.villageOrCity ?? '',
    district: profile?.address?.district ?? '',
    state: profile?.address?.state ?? '',
    pinCode: profile?.address?.pinCode ?? '',
  }));
  const editedFields = useRef(new Set<keyof DeliveryAddress>());
  const profileId = useRef(profile?.id);
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('razorpay');
  const [deliveryEstimate, setDeliveryEstimate] = useState('');
  const [locationSaveError, setLocationSaveError] = useState('');

  useEffect(() => {
    if (profileId.current === profile?.id) return;
    profileId.current = profile?.id;
    editedFields.current.clear();
    setAddress({
      recipientName: profile?.fullName ?? '',
      phone: profile?.phone ?? '',
      addressLine1: profile?.address?.street ?? '',
      city: profile?.address?.villageOrCity ?? '',
      district: profile?.address?.district ?? '',
      state: profile?.address?.state ?? '',
      pinCode: profile?.address?.pinCode ?? '',
    });
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const savedAddress: Partial<DeliveryAddress> = {
      recipientName: profile.fullName,
      phone: profile.phone,
      addressLine1: profile.address?.street,
      city: profile.address?.villageOrCity,
      district: profile.address?.district,
      state: profile.address?.state,
      pinCode: profile.address?.pinCode,
    };
    setAddress((current) => {
      const next = { ...current };
      for (const [field, value] of Object.entries(savedAddress) as [keyof DeliveryAddress, string | undefined][]) {
        if (value && !editedFields.current.has(field)) next[field] = value;
      }
      return next;
    });
  }, [profile]);

  useEffect(() => {
    let active = true;
    if (!checkoutOpen || address.city.trim().length < 2 || address.state.trim().length < 2 || address.pinCode.trim().length < 5) {
      setDeliveryEstimate('');
      return;
    }
    const timeout = window.setTimeout(() => {
      getLocationServiceability({
        city: address.city.trim(),
        state: address.state.trim(),
        pinCode: address.pinCode.trim(),
      })
        .then((result) => {
          if (!active) return;
          if (!result.configured) {
            setDeliveryEstimate('Delivery coverage has not been configured yet. An administrator must enable this area before orders can be placed.');
          } else if (result.serviceable === false) {
            setDeliveryEstimate('Delivery is not currently available for this PIN code.');
          } else if (result.serviceable === true && result.zone?.estimatedDeliveryDays) {
            const days = result.zone.estimatedDeliveryDays;
            setDeliveryEstimate(`Estimated delivery within ${days} ${days === 1 ? 'day' : 'days'} after order confirmation. Timing may vary.`);
          } else if (result.serviceable === true) {
            setDeliveryEstimate('Delivery is available, but an estimated delivery time is not configured.');
          } else {
            setDeliveryEstimate('We couldn’t confirm delivery to this location yet.');
          }
        })
        .catch(() => {
          if (active) setDeliveryEstimate('Could not check the delivery estimate. Availability will be confirmed when the order is placed.');
        });
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [address.city, address.state, address.pinCode, checkoutOpen]);

  function updateAddress(field: keyof DeliveryAddress, value: string) {
    editedFields.current.add(field);
    setAddress((current) => ({ ...current, [field]: value }));
  }

  function submitPayment(event: React.FormEvent) {
    event.preventDefault();
    onPay(address, paymentMethod);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-charcoal/50 z-[70]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-ivory z-[71] flex flex-col pb-[env(safe-area-inset-bottom)]"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between p-5 border-b border-forest/10">
              <h2 className="font-display text-xl text-forest flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" /> Your Cart
              </h2>
              <button onClick={onClose} className="text-charcoal/60 hover:text-forest p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            {checkoutOpen ? (
              <form onSubmit={submitPayment} className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <button type="button" onClick={onBackToCart} className="text-sm text-agri-green hover:text-forest">
                    ← Back to cart
                  </button>
                  <h3 className="font-display text-2xl text-forest mt-4">Delivery details</h3>
                  <p className="text-sm text-charcoal/60 mt-1">Your details are sent securely with the order.</p>
                </div>
                <LocationSelector
                  onResolved={async (resolved) => {
                    if (!profile) {
                      setLocationSaveError('Sign in to save a delivery location.');
                      return false;
                    }
                    try {
                      await persistProfileAddress({
                        ...profile.address,
                        street: resolved.displayName,
                        villageOrCity: resolved.city,
                        district: resolved.district,
                        state: resolved.state,
                        pinCode: resolved.pinCode,
                      });
                      const suggestion: DeliveryAddress = {
                        recipientName: profile.fullName ?? '',
                        phone: profile.phone ?? '',
                        addressLine1: resolved.displayName,
                        city: resolved.city,
                        district: resolved.district,
                        state: resolved.state,
                        pinCode: resolved.pinCode,
                      };
                      setAddress((current) => {
                        const next = { ...current };
                        for (const [field, value] of Object.entries(suggestion) as [keyof DeliveryAddress, string][]) {
                          if (value && !editedFields.current.has(field)) next[field] = value;
                        }
                        return next;
                      });
                      setLocationSaveError('');
                      return true;
                    } catch (error) {
                      setLocationSaveError(error instanceof Error ? error.message : 'Could not save this delivery location.');
                      return false;
                    }
                  }}
                />
                {locationSaveError && <p role="alert" className="text-xs text-red-700">{locationSaveError}</p>}
                {deliveryEstimate && <p role="status" className="rounded-lg bg-agri-emerald/10 px-3 py-2 text-xs text-forest">{deliveryEstimate}</p>}
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ['recipientName', 'Full name'],
                    ['phone', 'Phone'],
                    ['addressLine1', 'Address'],
                    ['city', 'City'],
                    ['district', 'District'],
                    ['state', 'State'],
                    ['pinCode', 'PIN code'],
                  ] as const).map(([field, label]) => (
                    <label key={field} className={field === 'addressLine1' ? 'col-span-2' : ''}>
                      <span className="text-xs font-medium text-charcoal/70">{label}</span>
                      <input
                        required
                        value={address[field]}
                        onChange={(event) => updateAddress(field, event.target.value)}
                        className="mt-1 w-full rounded-lg border border-forest/15 bg-white px-3 py-2.5 text-sm text-forest focus:outline-none focus:ring-2 focus:ring-agri-emerald"
                      />
                    </label>
                  ))}
                </div>
                <fieldset className="space-y-2 rounded-xl border border-forest/10 bg-white/60 p-3">
                  <legend className="px-1 text-xs font-semibold text-charcoal/70">Payment method</legend>
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="checkout-payment-method"
                      value="razorpay"
                      checked={paymentMethod === 'razorpay'}
                      onChange={() => setPaymentMethod('razorpay')}
                      className="mt-1 accent-agri-green"
                    />
                    <span><strong className="text-forest">Pay online</strong><span className="block text-xs text-charcoal/60">Secure checkout with Razorpay</span></span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="checkout-payment-method"
                      value="cod"
                      checked={paymentMethod === 'cod'}
                      onChange={() => setPaymentMethod('cod')}
                      className="mt-1 accent-agri-green"
                    />
                    <span><strong className="text-forest">Cash on delivery</strong><span className="block text-xs text-charcoal/60">Pay in cash when your order arrives</span></span>
                  </label>
                </fieldset>
                {checkoutError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{checkoutError}</p>}
                <div className="space-y-2 rounded-xl bg-white/70 p-4 text-sm">
                  <div className="flex justify-between text-charcoal/60">
                    <span>Estimated produce subtotal</span><span>{formatCurrency(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-charcoal/60">
                    <span>Delivery</span><span>Calculated by server</span>
                  </div>
                  <div className="flex justify-between border-t border-forest/10 pt-2 font-semibold text-forest">
                    <span>Final amount</span><span>Confirmed before payment</span>
                  </div>
                  <p className="text-xs text-charcoal/55">Prices, available stock, serviceability and delivery charges are verified by AgriConnect when you place the order.</p>
                </div>
                <button
                  type="submit"
                  disabled={checkoutBusy}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-agri-emerald py-3.5 font-semibold text-forest hover:bg-forest hover:text-ivory disabled:opacity-50 transition-colors"
                >
                  {checkoutBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {checkoutBusy
                    ? paymentMethod === 'cod' ? 'Placing order…' : 'Preparing secure checkout…'
                    : paymentMethod === 'cod' ? 'Place cash-on-delivery order' : 'Continue to secure payment'}
                </button>
              </form>
            ) : items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-charcoal/50 p-8">
                <ShoppingBag className="h-10 w-10 mb-4 text-charcoal/30" />
                <p>Your cart is empty.</p>
                <p className="text-sm mt-1">Add produce from the marketplace.</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {items.map((item) => (
                    <div key={item.productId} className="flex gap-3">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="h-16 w-16 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-forest/5 text-agri-green"><Sprout className="h-6 w-6" aria-hidden="true" /></div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-forest">{item.name}</p>
                        <p className="text-sm text-charcoal/60">
                          {formatCurrency(item.pricePerUnit)}/{item.unit}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSetQuantity(item.productId, item.quantity - 1)}
                            disabled={item.quantity <= item.minOrderQuantity}
                            aria-label={`Decrease ${item.name} quantity`}
                            className="h-8 w-8 rounded-full border border-forest/20 flex items-center justify-center hover:bg-forest hover:text-ivory transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => onSetQuantity(item.productId, item.quantity + 1)}
                            disabled={item.quantity >= item.availableQuantity}
                            aria-label={`Increase ${item.name} quantity`}
                            className="h-8 w-8 rounded-full border border-forest/20 flex items-center justify-center hover:bg-forest hover:text-ivory transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => onRemove(item.productId)}
                            className="ml-auto text-charcoal/40 hover:text-red-500"
                            aria-label="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <p className="font-display text-forest">
                        {formatCurrency(item.pricePerUnit * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-forest/10 p-5 space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-charcoal/60">
                      <span>Estimated subtotal</span><span>{formatCurrency(totalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-charcoal/60">
                      <span>Delivery</span><span>Calculated at checkout</span>
                    </div>
                    <div className="flex justify-between border-t border-forest/10 pt-2 text-sm font-semibold text-forest">
                      <span>Final total</span><span>Server verified</span>
                    </div>
                  </div>
                  {!isAuthenticated && (
                    <p className="text-xs text-soil-dark bg-soil/5 rounded-lg p-3">
                      Sign in before checkout to securely place and pay for your order.
                    </p>
                  )}
                  <button
                    onClick={onCheckout}
                    className="w-full rounded-full bg-forest py-3.5 text-sm font-semibold text-ivory hover:bg-agri-emerald hover:text-forest transition-colors"
                  >
                    {isAuthenticated ? 'Continue to payment' : 'Sign in to purchase'}
                  </button>
                  <button
                    onClick={onClear}
                    className="w-full text-sm text-charcoal/60 hover:text-red-500 transition-colors"
                  >
                    Clear cart
                  </button>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
