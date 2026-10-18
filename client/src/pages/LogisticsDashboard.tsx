import React, { useState, useEffect } from 'react';
import {
  Truck,
  MapPin,
  Calendar,
  CheckCircle2,
  Clock,
  Navigation,
  Phone,
  Package,
  ShieldCheck,
  Check,
  AlertCircle,
  X,
} from 'lucide-react';
import api from '../services/api.js';
import { Order } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';

export const LogisticsDashboard: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderForDelivery, setSelectedOrderForDelivery] = useState<Order | null>(null);

  // Delivery confirmation form
  const [signatureName, setSignatureName] = useState('');
  const [otpCode, setOtpCode] = useState('1234');
  const [deliveryNotes, setDeliveryNotes] = useState('All crated produce delivered in fresh, undamaged condition.');

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const res = await api.get('/logistics/deliveries');
      if (res.data.orders) setOrders(res.data.orders);
    } catch (err) {
      console.error('Error fetching logistics deliveries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const handleClaim = async (orderId: string) => {
    try {
      await api.post(`/logistics/claim/${orderId}`);
      fetchDeliveries();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to claim delivery');
    }
  };

  const handleCompleteDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForDelivery) return;

    try {
      await api.post(`/logistics/complete/${selectedOrderForDelivery._id}`, {
        recipientSignature: signatureName || 'Recipient Glass Signature',
        otp: otpCode,
        notes: deliveryNotes,
      });

      setSelectedOrderForDelivery(null);
      fetchDeliveries();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to confirm delivery');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Banner */}
      <div className="bg-gradient-to-r from-forest via-agri-900 to-forest-light text-white rounded-3xl p-8 sm:p-10 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-400/30">
            <Truck className="w-3.5 h-3.5" />
            <span>Active Cold-Chain Logistics Hub</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Logistics & Delivery Operations
          </h1>
          <p className="text-xs text-slate-300">
            Fast temperature-controlled farm gate collection and verified last-mile delivery tracking.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-xs space-y-1 shrink-0">
          <p className="font-bold text-emerald-300">Driver Partner:</p>
          <p className="text-white font-extrabold">{user?.name || 'Suresh Express Fleet'}</p>
          <p className="text-slate-300">Active Transit Fleet • Warangal-Hyderabad Corridor</p>
        </div>
      </div>

      {/* Deliveries List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
            Assigned & Available Farm Collections ({orders.length})
          </h2>
          <span className="text-xs text-slate-500">Live dispatch status updates</span>
        </div>

        {loading ? (
          <div className="h-40 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
        ) : orders.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-3">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No pending deliveries right now
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              New farm orders will appear here as soon as farmers prepare produce crates and mark them
              ready for pickup.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((ord) => {
              const isClaimedByMe = ord.logistics?.assignedPartnerId === user?.id;
              return (
                <div
                  key={ord._id}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-subtle space-y-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-black text-slate-900 dark:text-slate-100">
                          Consignment #{ord.orderNumber}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {ord.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Slot: {ord.deliverySlot?.timeWindow} • Placed {new Date(ord.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {!ord.logistics?.assignedPartnerId && ord.status === 'ready_for_pickup' && (
                        <button
                          onClick={() => handleClaim(ord._id)}
                          className="px-4 py-2 rounded-xl bg-agri-700 hover:bg-agri-800 text-white font-bold text-xs shadow flex items-center gap-1.5 transition"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Accept & Claim Pickup</span>
                        </button>
                      )}

                      {ord.status === 'picked_up' && (
                        <button
                          onClick={() => setSelectedOrderForDelivery(ord)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow flex items-center gap-1.5 transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Deliver with Proof</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Route Details: Farm Gate to Customer Table */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    {/* Origin: Farm Gate Collection */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Pickup: Farm Gate Origin</span>
                      </span>
                      <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {ord.items[0]?.farmerName || 'Cultivator'}
                      </p>
                      <p className="text-slate-600 dark:text-slate-400">
                        Farm: {ord.items[0]?.farmLocation}
                      </p>
                      <div className="pt-1 text-[11px] text-slate-500">
                        Cargo: {ord.items.map((i) => `${i.quantity} ${i.unit} ${i.cropName}`).join(', ')}
                      </div>
                    </div>

                    {/* Destination: Customer Doorstep */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Destination: Delivery Table</span>
                      </span>
                      <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {ord.deliveryAddress?.recipientName}
                      </p>
                      <p className="text-slate-600 dark:text-slate-400">
                        {ord.deliveryAddress?.addressLine1}, {ord.deliveryAddress?.city} • PIN {ord.deliveryAddress?.pinCode}
                      </p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1 pt-1">
                        <Phone className="w-3 h-3" />
                        <span>{ord.deliveryAddress?.phone}</span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Proof of Delivery Modal */}
      {selectedOrderForDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                Confirm Proof of Delivery
              </h3>
              <button
                onClick={() => setSelectedOrderForDelivery(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleCompleteDelivery} className="space-y-4 text-xs">
              <p className="text-slate-500">
                Record verification for Order #{selectedOrderForDelivery.orderNumber} delivered to{' '}
                <strong>{selectedOrderForDelivery.deliveryAddress?.recipientName}</strong>.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Recipient Signature / Name Confirmed
                </label>
                <input
                  type="text"
                  required
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder="e.g. Priya Sharma (Verified on Glass)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Delivery OTP
                </label>
                <input
                  type="text"
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="4-digit OTP"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Condition / Delivery Notes
                </label>
                <textarea
                  rows={2}
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition"
              >
                Submit Verified Proof & Release Settlement
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
