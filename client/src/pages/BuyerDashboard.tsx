import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Package,
  Clock,
  CheckCircle2,
  Truck,
  FileText,
  Repeat,
  MapPin,
  Calendar,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  X,
} from 'lucide-react';
import api from '../services/api.js';
import { Order } from '../types/index.js';
import { useCart } from '../context/CartContext.js';
import { getSocket } from '../services/socket.js';

export const BuyerDashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const orderSuccessId = searchParams.get('orderSuccess');

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);
  const { addToCart } = useCart();

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders/buyer');
      if (res.data.orders) {
        setOrders(res.data.orders);
      }
    } catch (err) {
      console.error('Error fetching buyer orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // Listen to real-time order status updates via Socket.IO
    const socket = getSocket();
    const handleStatusUpdate = (data: any) => {
      console.log('⚡ Buyer Dashboard: Real-time Order status update:', data);
      setOrders((prev) =>
        prev.map((o) => (o._id === data.orderId ? { ...o, status: data.status } : o))
      );
    };

    socket.on('order:status_updated', handleStatusUpdate);
    return () => {
      socket.off('order:status_updated', handleStatusUpdate);
    };
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'out_for_delivery':
      case 'picked_up':
        return 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse';
      case 'preparing':
      case 'ready_for_pickup':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'cancelled':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStepProgress = (status: string) => {
    const steps = ['confirmed', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'out_for_delivery', 'delivered'];
    const index = steps.indexOf(status);
    return index >= 0 ? index + 1 : 1;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Order Placed Success Banner */}
      {orderSuccessId && (
        <div className="p-4 rounded-3xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Order Confirmed & Stock Reserved!</h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Farmers have received your order alert. Track live harvesting and logistics progress below in real-time.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              window.history.replaceState({}, '', '/buyer/dashboard');
            }}
            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
            Household Buyer Orders
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time fulfillment tracking, farm origins, and digital invoices.
          </p>
        </div>

        <Link
          to="/marketplace"
          className="px-4 py-2.5 rounded-2xl bg-agri-700 hover:bg-agri-800 text-white font-bold text-xs shadow flex items-center gap-2 self-start sm:self-auto"
        >
          <span>Browse Fresh Produce</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-40 animate-pulse"
            />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-agri-50 dark:bg-slate-800 text-agri-600 flex items-center justify-center mx-auto">
            <Package className="w-8 h-8 text-agri-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No orders placed yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Experience direct farm produce with guaranteed freshness and fair value for farmers.
          </p>
          <Link
            to="/marketplace"
            className="px-4 py-2 rounded-xl bg-agri-700 text-white text-xs font-bold shadow hover:bg-agri-800 transition inline-block"
          >
            Explore Marketplace
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((ord) => {
            const currentStep = getStepProgress(ord.status);
            return (
              <div
                key={ord._id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-subtle space-y-6"
              >
                {/* Order Top Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black text-slate-900 dark:text-slate-100">
                        Order #{ord.orderNumber}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase border ${getStatusBadge(
                          ord.status
                        )}`}
                      >
                        {ord.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Placed on {new Date(ord.createdAt).toLocaleString()} • Slot: {ord.deliverySlot?.timeWindow}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedOrderForInvoice(ord)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition"
                    >
                      <FileText className="w-3.5 h-3.5 text-agri-600" />
                      <span>View Invoice</span>
                    </button>

                    <Link
                      to="/marketplace"
                      className="px-3 py-1.5 rounded-xl bg-agri-50 dark:bg-slate-800 text-agri-700 dark:text-emerald-400 hover:bg-agri-100 font-semibold text-xs flex items-center gap-1.5 transition"
                    >
                      <Repeat className="w-3.5 h-3.5" />
                      <span>Reorder Produce</span>
                    </Link>
                  </div>
                </div>

                {/* Real-Time Live Order Progress Tracker */}
                <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-emerald-600 animate-pulse" />
                      <span>Live Farm-to-Table Transit Status</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Step {currentStep} of 7
                    </span>
                  </div>

                  {/* Visual Stepper */}
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 pt-2">
                    {[
                      { key: 'confirmed', label: 'Confirmed' },
                      { key: 'accepted', label: 'Farm Accepted' },
                      { key: 'preparing', label: 'Crated & Sorted' },
                      { key: 'ready_for_pickup', label: 'Dock Ready' },
                      { key: 'picked_up', label: 'Picked Up' },
                      { key: 'out_for_delivery', label: 'Out for Delivery' },
                      { key: 'delivered', label: 'Delivered' },
                    ].map((step, idx) => {
                      const isComplete = currentStep > idx;
                      const isCurrent = currentStep === idx + 1;
                      return (
                        <div key={step.key} className="text-center space-y-1.5">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              isComplete
                                ? 'bg-emerald-500'
                                : isCurrent
                                ? 'bg-emerald-400 animate-pulse'
                                : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                          />
                          <p
                            className={`text-[10px] truncate ${
                              isComplete || isCurrent
                                ? 'font-bold text-slate-900 dark:text-slate-100'
                                : 'text-slate-400'
                            }`}
                          >
                            {step.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Items and Transparent Pricing */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start text-xs">
                  {/* Items list */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                      Items in this delivery
                    </h4>
                    <div className="space-y-2">
                      {ord.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800"
                        >
                          <div>
                            <p className="font-bold text-slate-900 dark:text-slate-100">
                              {item.cropName} ({item.quantity} {item.unit})
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Farm: {item.farmLocation} • Grade {item.qualityGrade}
                            </p>
                          </div>
                          <span className="font-extrabold text-slate-900 dark:text-slate-100">
                            ₹{(item.totalPaise / 100).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Delivery & Pricing Breakdown */}
                  <div className="space-y-3 bg-cream-100 dark:bg-slate-800/60 p-4 rounded-2xl border border-cream-300 dark:border-slate-700">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                      Transparent Bill & Farmer Payout
                    </h4>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>Produce Gross:</span>
                        <span className="font-bold">
                          ₹{(ord.pricing.grossProductValuePaise / 100).toFixed(2)}
                        </span>
                      </div>

                      <div className="flex justify-between text-emerald-700 dark:text-emerald-300 font-semibold">
                        <span>Farmer Payout (90%):</span>
                        <span>₹{(ord.pricing.farmerPayoutPaise / 100).toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between text-slate-500">
                        <span>Platform & Ops Reserve:</span>
                        <span>
                          ₹{(((ord.pricing.platformCommissionPaise + ord.pricing.operationsReservePaise)) / 100).toFixed(2)}
                        </span>
                      </div>

                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>Delivery Fee:</span>
                        <span>
                          {ord.pricing.deliveryFeePaise === 0 ? 'FREE' : `₹${(ord.pricing.deliveryFeePaise / 100).toFixed(2)}`}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-cream-200 dark:border-slate-700 flex justify-between font-extrabold text-sm text-slate-900 dark:text-slate-100">
                        <span>Total Paid:</span>
                        <span className="text-emerald-700 dark:text-emerald-400">
                          ₹{(ord.pricing.finalPayablePaise / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Digital Invoice Modal */}
      {selectedOrderForInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl text-forest dark:text-emerald-400">AgriConnect</span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                  TAX INVOICE
                </span>
              </div>
              <button
                onClick={() => setSelectedOrderForInvoice(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-slate-400 font-semibold">INVOICE NUMBER</p>
                <p className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  INV-{selectedOrderForInvoice.orderNumber}
                </p>
                <p className="text-slate-400 font-semibold mt-2">DATE OF ISSUE</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {new Date(selectedOrderForInvoice.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="text-right">
                <p className="text-slate-400 font-semibold">BILLED TO</p>
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  {selectedOrderForInvoice.buyerName}
                </p>
                <p className="text-slate-500">{selectedOrderForInvoice.deliveryAddress?.addressLine1}</p>
                <p className="text-slate-500">
                  {selectedOrderForInvoice.deliveryAddress?.city}, {selectedOrderForInvoice.deliveryAddress?.pinCode}
                </p>
              </div>
            </div>

            <table className="w-full text-xs text-left">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                <tr>
                  <th className="py-2">Item Description</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Rate</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {selectedOrderForInvoice.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 font-medium text-slate-800 dark:text-slate-200">
                      {item.cropName} (Grade {item.qualityGrade})
                    </td>
                    <td className="py-2.5 text-right text-slate-600 dark:text-slate-300">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-2.5 text-right text-slate-600 dark:text-slate-300">
                      ₹{(item.unitPricePaise / 100).toFixed(2)}
                    </td>
                    <td className="py-2.5 text-right font-bold text-slate-900 dark:text-slate-100">
                      ₹{(item.totalPaise / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-1 text-xs text-right">
              <p className="text-slate-500">
                Produce Gross: ₹{(selectedOrderForInvoice.pricing.grossProductValuePaise / 100).toFixed(2)}
              </p>
              <p className="text-slate-500">
                Direct Delivery: ₹{(selectedOrderForInvoice.pricing.deliveryFeePaise / 100).toFixed(2)}
              </p>
              <p className="text-base font-extrabold text-forest dark:text-emerald-400 pt-1">
                Total Paid: ₹{(selectedOrderForInvoice.pricing.finalPayablePaise / 100).toFixed(2)}
              </p>
            </div>

            <button
              onClick={() => window.print()}
              className="w-full py-2.5 rounded-xl bg-agri-700 hover:bg-agri-800 text-white font-bold text-xs shadow"
            >
              Print / Save PDF Invoice
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
