import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Trash2, Minus, Plus, X, ShoppingBag, Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import { ProductCard } from '@/components/marketplace/ProductCard';
import { ProductsService } from '@/services/products';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { PaymentService, playPaymentSuccessSound, type DeliveryAddress } from '@/services/payment';
import type { CropProduct, ProductCategory } from '@/types';
import { formatCurrency, classNames } from '@/utils';

const categories: { value: ProductCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'vegetables', label: 'Vegetables' },
  { value: 'fruits', label: 'Fruits' },
  { value: 'grains', label: 'Grains' },
  { value: 'pulses', label: 'Pulses' },
  { value: 'herbs', label: 'Herbs' },
];

export function MarketplacePage() {
  const [products, setProducts] = useState<CropProduct[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<ProductCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [successOrder, setSuccessOrder] = useState('');
  const { session, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { items, totalItems, totalAmount, remove, setQuantity, clear } = useCart();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  async function startPayment(address: DeliveryAddress) {
    if (!session) return;
    setCheckoutBusy(true);
    setCheckoutError('');
    try {
      const order = await PaymentService.createOrder(session, items, address);
      await PaymentService.openCheckout(
        order,
        session,
        (orderNumber, amountPaise) => {
          clear();
          setCheckoutOpen(false);
          setCartOpen(false);
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
    setLoading(true);
    setError('');
    ProductsService.list({
      category: category === 'all' ? undefined : category,
      query: query || undefined,
    })
      .then(setProducts)
      .catch(() => setError('Could not load products. Please try again.'))
      .finally(() => setLoading(false));
  }, [category, query]);

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

          <div className="flex flex-col lg:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search crops, farmers, regions…"
                className="w-full rounded-full border border-forest/15 bg-white/60 pl-11 pr-4 py-3 text-forest placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-agri-emerald"
              />
            </div>
            <div className="flex min-w-0 max-w-full flex-wrap gap-2 pb-1">
              {categories.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
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
              <p className="text-red-500">{error}</p>
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
              <h2 className="mt-5 font-display text-3xl text-forest">Payment confirmed</h2>
              <p className="mt-2 text-sm text-charcoal/65">
                Order <span className="font-semibold text-forest">{successOrder}</span> is now being prepared.
              </p>
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
  onCheckout: () => void;
  onPay: (address: DeliveryAddress) => void;
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
  onCheckout,
  onPay,
  onBackToCart,
}: CartDrawerProps) {
  const [address, setAddress] = useState<DeliveryAddress>({
    recipientName: '',
    phone: '',
    addressLine1: '',
    city: '',
    district: '',
    state: '',
    pinCode: '',
  });

  function updateAddress(field: keyof DeliveryAddress, value: string) {
    setAddress((current) => ({ ...current, [field]: value }));
  }

  function submitPayment(event: React.FormEvent) {
    event.preventDefault();
    onPay(address);
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
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-ivory z-[71] flex flex-col"
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
                {checkoutError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{checkoutError}</p>}
                <button
                  type="submit"
                  disabled={checkoutBusy}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-agri-emerald py-3.5 font-semibold text-forest hover:bg-forest hover:text-ivory disabled:opacity-50 transition-colors"
                >
                  {checkoutBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {checkoutBusy ? 'Preparing secure checkout…' : `Pay ${formatCurrency(totalAmount)}`}
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
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-16 w-16 rounded-xl object-cover"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-forest">{item.name}</p>
                        <p className="text-sm text-charcoal/60">
                          {formatCurrency(item.pricePerUnit)}/{item.unit}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => onSetQuantity(item.productId, item.quantity - 1)}
                            className="h-7 w-7 rounded-full border border-forest/20 flex items-center justify-center hover:bg-forest hover:text-ivory transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => onSetQuantity(item.productId, item.quantity + 1)}
                            className="h-7 w-7 rounded-full border border-forest/20 flex items-center justify-center hover:bg-forest hover:text-ivory transition-colors"
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
                  <div className="flex justify-between items-center">
                    <span className="text-charcoal/60">Total</span>
                    <span className="font-display text-2xl text-forest">
                      {formatCurrency(totalAmount)}
                    </span>
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
