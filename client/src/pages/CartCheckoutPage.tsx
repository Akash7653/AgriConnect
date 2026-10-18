import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Trash2,
  Plus,
  Minus,
  MapPin,
  Clock,
  ShieldCheck,
  CreditCard,
  Building,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Truck,
  HeartHandshake,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useCart } from '../context/CartContext.js';
import { useAuth } from '../context/AuthContext.js';
import api from '../services/api.js';

export const CartCheckoutPage: React.FC = () => {
  const {
    items,
    updateQuantity,
    removeFromCart,
    clearCart,
    totalItems,
    grossValuePaise,
    farmerPayoutPaise,
    platformFeePaise,
    deliveryFeePaise,
    finalPayablePaise,
  } = useCart();

  const { user } = useAuth();
  const navigate = useNavigate();

  // Form states
  const [recipientName, setRecipientName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [addressLine1, setAddressLine1] = useState(user?.address?.street || 'Flat 402, Green Valley Enclave');
  const [city, setCity] = useState(user?.address?.villageOrCity || 'Hyderabad');
  const [district, setDistrict] = useState(user?.address?.district || 'Hyderabad');
  const [state, setState] = useState(user?.address?.state || 'Telangana');
  const [pinCode, setPinCode] = useState(user?.address?.pinCode || '500081');
  const [deliverySlot, setDeliverySlot] = useState('07:00 AM - 11:00 AM');
  const [paymentMethod, setPaymentMethod] = useState<'upi_instant' | 'razorpay_sandbox' | 'cod_verified'>('upi_instant');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-agri-50 dark:bg-slate-800 text-agri-600 dark:text-agri-400 flex items-center justify-center mx-auto shadow-sm">
          <Truck className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            Your produce cart is currently empty
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Browse our farm marketplace to discover freshly harvested fruits, vegetables, grains,
            and organic produce directly from verified farmers.
          </p>
        </div>
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-agri-700 hover:bg-agri-800 text-white font-bold text-xs shadow-md transition"
        >
          <span>Explore Farm Marketplace</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Please sign in or use a demo account to complete your farm order.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const orderPayload = {
        items: items.map((i) => ({
          listingId: i.listing._id,
          quantity: i.quantity,
        })),
        deliveryAddress: {
          recipientName,
          phone,
          addressLine1,
          city,
          district,
          state,
          pinCode,
        },
        deliverySlot: {
          date: new Date().toISOString().split('T')[0],
          timeWindow: deliverySlot,
        },
        paymentMethod,
        idempotencyKey: `IDEM-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      };

      if (paymentMethod === 'razorpay_sandbox') {
        // Step 1: Create Razorpay Order on server
        const rzpRes = await api.post('/payment/create-order', orderPayload);
        if (!rzpRes.data.success) {
          throw new Error(rzpRes.data.message || 'Failed to initialize Razorpay payment');
        }

        const { razorpayOrderId, amountPaise, keyId, orderNumber, orderId } = rzpRes.data;

        // Step 2: Open Razorpay Standard Checkout
        if (typeof (window as any).Razorpay === 'function') {
          const options = {
            key: keyId,
            amount: amountPaise,
            currency: 'INR',
            name: 'AgriConnect',
            description: `Order #${orderNumber} (Test Mode)`,
            image: 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?auto=format&fit=crop&w=200&q=80',
            order_id: razorpayOrderId,
            prefill: {
              name: recipientName,
              email: user.email,
              contact: phone,
            },
            theme: {
              color: '#166534',
            },
            handler: async (response: any) => {
              setVerifying(true);
              try {
                // Step 3: Server-side cryptographic signature verification
                const verifyRes = await api.post('/payment/verify', {
                  orderId,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                });

                if (verifyRes.data.success) {
                  confetti({
                    particleCount: 90,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#16a34a', '#10b981', '#f59e0b', '#22c55e'],
                  });
                  clearCart();
                  navigate(`/buyer/dashboard?orderSuccess=${orderId}`);
                } else {
                  setError('Payment verification pending or failed. Please check your order history.');
                }
              } catch (verifyErr: any) {
                setError(verifyErr.response?.data?.message || 'Payment signature verification failed.');
              } finally {
                setVerifying(false);
              }
            },
            modal: {
              ondismiss: () => {
                setLoading(false);
                setError('Payment modal was closed. You can retry anytime.');
              },
            },
          };

          const rzp = new (window as any).Razorpay(options);
          rzp.on('payment.failed', (resp: any) => {
            setError(`Payment Failed: ${resp.error?.description || 'Transaction unsuccessful'}`);
            setLoading(false);
          });
          rzp.open();
          return;
        }
      }

      // Fallback direct order placement (UPI instant or COD verified)
      const res = await api.post('/orders', orderPayload);

      if (res.data.success && res.data.order) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#16a34a', '#10b981', '#f59e0b', '#22c55e'],
        });

        clearCart();
        navigate(`/buyer/dashboard?orderSuccess=${res.data.order._id}`);
      }
    } catch (err: any) {
      console.error('Order checkout error:', err);
      setError(
        err.response?.data?.message ||
          'Failed to reserve stock. Some items in your cart may have been purchased by another buyer. Please adjust quantities.'
      );
    } finally {
      if (paymentMethod !== 'razorpay_sandbox') {
        setLoading(false);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
          Cart & Direct Farm Checkout
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Review your farm-fresh items and finalize your transparent agricultural order.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Cart items and Delivery details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cart Items List */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-subtle space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Cart Items ({totalItems} Units)
              </h2>
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Live Stock Synced</span>
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((item) => {
                const itemTotal = ((item.listing.pricePerUnitPaise * item.quantity) / 100).toFixed(2);
                return (
                  <div key={item.listing._id} className="py-4 flex items-center gap-4">
                    <img
                      src={item.listing.images?.[0] || 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?auto=format&fit=crop&w=400&q=80'}
                      alt={item.listing.cropName}
                      className="w-16 h-16 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                        {item.listing.cropName}
                      </h4>
                      <p className="text-xs text-slate-500">
                        ₹{(item.listing.pricePerUnitPaise / 100).toFixed(2)}/{item.listing.unit} • Grade {item.listing.qualityGrade}
                      </p>
                      <p className="text-[11px] text-emerald-600 font-medium">
                        Farm: {item.listing.location.village}, {item.listing.location.district}
                      </p>
                    </div>

                    {/* Quantity Selector */}
                    <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 p-0.5">
                      <button
                        onClick={() => updateQuantity(item.listing._id, item.quantity - 1)}
                        className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-slate-900 dark:text-slate-100">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.listing._id, item.quantity + 1)}
                        disabled={item.quantity >= item.listing.availableQuantity}
                        className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                        ₹{itemTotal}
                      </p>
                      <button
                        onClick={() => removeFromCart(item.listing._id)}
                        className="text-[11px] text-red-500 hover:text-red-700 mt-1 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delivery & Address Form */}
          <form id="checkout-form" onSubmit={handlePlaceOrder} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-subtle space-y-6">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>Delivery Address & Contact Details</span>
              </h3>
              <p className="text-xs text-slate-500">Produce will be delivered directly from the farm gate in fresh crated packing.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Recipient Name
                </label>
                <input
                  type="text"
                  required
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-agri-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Contact Phone Number
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-agri-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Street Address / Flat / Building
                </label>
                <input
                  type="text"
                  required
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="e.g. Flat 402, Green Valley Enclave, Road No 12"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-agri-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  City / Village
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Hyderabad"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-agri-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  PIN Code
                </label>
                <input
                  type="text"
                  required
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  placeholder="e.g. 500081"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-agri-500"
                />
              </div>
            </div>

            {/* Delivery Time Window */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Preferred Fresh Delivery Slot</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: '07:00 AM - 11:00 AM', label: 'Morning Fresh (07 AM - 11 AM)' },
                  { id: '02:00 PM - 06:00 PM', label: 'Afternoon (02 PM - 06 PM)' },
                  { id: '06:00 PM - 09:00 PM', label: 'Evening (06 PM - 09 PM)' },
                ].map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setDeliverySlot(slot.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border text-left transition ${
                      deliverySlot === slot.id
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 font-bold'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Method Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                <span>Select Payment Method (Sandbox / Verified)</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'upi_instant', label: 'UPI Sandbox (GPay / PhonePe / Paytm)' },
                  { id: 'razorpay_sandbox', label: 'Razorpay Sandbox Gateway' },
                  { id: 'cod_verified', label: 'Cash on Farm Delivery (Verified)' },
                ].map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setPaymentMethod(pm.id as any)}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border text-left transition ${
                      paymentMethod === pm.id
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 font-bold'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: Order Summary & Transparent Value Split Breakdown */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-subtle space-y-6">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">
              Order Pricing Summary
            </h3>

            {/* Itemized Calculation */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 text-slate-600 dark:text-slate-400">
                <span>Gross Produce Value:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  ₹{(grossValuePaise / 100).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between py-1 text-slate-600 dark:text-slate-400">
                <span>Direct Transit Delivery:</span>
                <span>
                  {deliveryFeePaise === 0 ? (
                    <span className="text-emerald-600 font-bold">FREE (Above ₹500)</span>
                  ) : (
                    <span>₹{(deliveryFeePaise / 100).toFixed(2)}</span>
                  )}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-baseline text-sm font-extrabold text-slate-900 dark:text-slate-100">
                <span>Final Payable:</span>
                <span className="text-xl text-forest dark:text-emerald-400">
                  ₹{(finalPayablePaise / 100).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Transparent Platform Split Transparency Card */}
            <div className="p-4 rounded-2xl bg-cream-100 dark:bg-slate-800/80 border border-cream-300 dark:border-slate-700 space-y-2.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-agri-800 dark:text-agri-300 flex items-center gap-1.5">
                <HeartHandshake className="w-3.5 h-3.5 text-emerald-600" />
                <span>AgriConnect Transparent Split</span>
              </h4>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between text-emerald-700 dark:text-emerald-300 font-bold">
                  <span>🌾 Farmer Payout Share (90%):</span>
                  <span>₹{(farmerPayoutPaise / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>🌱 AgriConnect Platform Fee (8%):</span>
                  <span>₹{(platformFeePaise / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>⚙️ Operations & Payment Reserve (2%):</span>
                  <span>₹{((grossValuePaise * 0.02) / 100).toFixed(2)}</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 pt-1 border-t border-cream-200 dark:border-slate-700">
                Verified zero-middleman policy. Saved directly to the immutable payout ledger.
              </p>
            </div>

            {/* Checkout Action Button */}
            <button
              type="submit"
              form="checkout-form"
              disabled={loading || verifying}
              className={`w-full py-3.5 rounded-2xl text-white font-extrabold text-sm shadow-xl transition-all flex items-center justify-center gap-2 ${
                paymentMethod === 'razorpay_sandbox'
                  ? 'bg-emerald-700 hover:bg-emerald-800 shadow-emerald-700/20 hover:scale-[1.02]'
                  : 'bg-agri-700 hover:bg-agri-800 shadow-agri-700/20 hover:scale-[1.02]'
              } disabled:opacity-50`}
            >
              {verifying ? (
                <span>Verifying Cryptographic Payment Signature...</span>
              ) : loading ? (
                <span>Reserving Stock & Connecting Gateway...</span>
              ) : paymentMethod === 'razorpay_sandbox' ? (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Pay Now (Razorpay Test Mode) • ₹{(finalPayablePaise / 100).toFixed(2)}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Place Order • ₹{(finalPayablePaise / 100).toFixed(2)}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
