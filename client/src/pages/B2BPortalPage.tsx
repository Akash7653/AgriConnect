import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  FileCheck2,
  TrendingDown,
  Repeat,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Send,
  X,
} from 'lucide-react';
import api from '../services/api.js';
import { QuoteRequest } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';

export const B2BPortalPage: React.FC = () => {
  const { user } = useAuth();
  const [rfqs, setRfqs] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRfqModal, setShowRfqModal] = useState(false);

  const [newRfq, setNewRfq] = useState({
    cropName: '',
    category: 'Vegetables',
    requiredQuantity: '100',
    unit: 'kg',
    targetPrice: '',
    frequency: 'weekly',
    requiredByDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    address: user?.address?.street || 'Plot 12, Road No 10, Banjara Hills',
    city: user?.address?.villageOrCity || 'Hyderabad',
    district: user?.address?.district || 'Hyderabad',
    state: 'Telangana',
    pinCode: '500034',
    notes: 'Looking for Grade A produce with uniform sizing and clean crated delivery.',
  });

  const fetchRfqs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/b2b/rfq');
      if (res.data.requests) setRfqs(res.data.requests);
    } catch (err) {
      console.error('Failed to load RFQs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRfqs();
  }, []);

  const handleCreateRfq = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        cropName: newRfq.cropName,
        category: newRfq.category,
        requiredQuantity: parseInt(newRfq.requiredQuantity, 10),
        unit: newRfq.unit,
        targetPricePerUnitPaise: newRfq.targetPrice
          ? Math.round(parseFloat(newRfq.targetPrice) * 100)
          : undefined,
        frequency: newRfq.frequency,
        requiredByDate: new Date(newRfq.requiredByDate).toISOString(),
        deliveryLocation: {
          address: newRfq.address,
          city: newRfq.city,
          district: newRfq.district,
          state: newRfq.state,
          pinCode: newRfq.pinCode,
        },
        notes: newRfq.notes,
      };

      const res = await api.post('/b2b/rfq', payload);
      if (res.data.success) {
        setShowRfqModal(false);
        fetchRfqs();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to submit bulk RFQ');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-forest-dark via-forest to-agri-900 text-white rounded-3xl p-8 sm:p-10 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-400/30">
            <Building2 className="w-3.5 h-3.5" />
            <span>Institutional, Hotel & Restaurant Procurement</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            B2B Commercial Procurement Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Direct bulk farm purchasing, recurring procurement contracts, and direct RFQ bidding from
            FPOs across Warangal, Nashik, and Anantapur clusters.
          </p>
        </div>

        <button
          onClick={() => setShowRfqModal(true)}
          className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition hover:scale-105 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Post Bulk RFQ Quote Request</span>
        </button>
      </div>

      {/* B2B Perks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-subtle space-y-2">
          <div className="w-10 h-10 rounded-xl bg-agri-50 dark:bg-slate-800 text-agri-600 flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-emerald-600" />
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
            15-20% Lower Cost vs Wholesalers
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            By sourcing directly from certified farmer producer groups, institutional kitchens eliminate
            middleman layers while securing fresh morning harvests.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-subtle space-y-2">
          <div className="w-10 h-10 rounded-xl bg-agri-50 dark:bg-slate-800 text-agri-600 flex items-center justify-center">
            <Repeat className="w-5 h-5 text-emerald-600" />
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
            Guaranteed Recurring Schedules
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Set weekly or bi-weekly standing delivery schedules for high-frequency kitchen staples like
            tomatoes, onions, potatoes, and aged rice.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-subtle space-y-2">
          <div className="w-10 h-10 rounded-xl bg-agri-50 dark:bg-slate-800 text-agri-600 flex items-center justify-center">
            <FileCheck2 className="w-5 h-5 text-emerald-600" />
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
            GST Invoices & Lot Traceability
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Every bulk consignment includes full harvest origin details, FPO registration numbers, and
            compliant B2B digital invoices.
          </p>
        </div>
      </div>

      {/* Bulk RFQ List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
            Active Bulk RFQs & Farmer Quotes
          </h2>
          <span className="text-xs text-slate-500">
            Farmers and FPOs quote directly on open requirements
          </span>
        </div>

        {loading ? (
          <div className="h-40 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
        ) : rfqs.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-3">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No active bulk quote requests
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Post an RFQ for bulk agricultural supplies. Regional farmers will provide bids matching your target rates.
            </p>
            <button
              onClick={() => setShowRfqModal(true)}
              className="px-4 py-2 rounded-xl bg-agri-700 text-white font-bold text-xs shadow hover:bg-agri-800"
            >
              Post First Bulk RFQ
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rfqs.map((rfq) => (
              <div
                key={rfq._id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-subtle space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 uppercase">
                        {rfq.frequency} Demand
                      </span>
                      <h3 className="font-extrabold text-lg text-slate-900 dark:text-slate-100 mt-1">
                        {rfq.cropName} ({rfq.requiredQuantity} {rfq.unit})
                      </h3>
                      <p className="text-xs text-slate-500">Requested by: {rfq.buyerBusiness}</p>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        rfq.status === 'open'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {rfq.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400">{rfq.notes}</p>

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Required Date:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {new Date(rfq.requiredByDate).toLocaleDateString()}
                      </span>
                    </div>
                    {rfq.targetPricePerUnitPaise && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Target Budget:</span>
                        <span className="font-extrabold text-emerald-600">
                          ₹{(rfq.targetPricePerUnitPaise / 100).toFixed(2)}/{rfq.unit}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Delivery Kitchen:</span>
                      <span className="text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                        {rfq.deliveryLocation?.city}, {rfq.deliveryLocation?.district}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Farmer Quotes Received */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                    Farmer Responses ({rfq.responses?.length || 0}):
                  </span>
                  {rfq.responses?.length > 0 ? (
                    <div className="space-y-1.5">
                      {rfq.responses.map((resp, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 text-xs border border-emerald-200/60"
                        >
                          <div>
                            <p className="font-bold text-emerald-900 dark:text-emerald-200">
                              {resp.farmerName}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {resp.farmLocation} • Lead time: {resp.deliveryLeadDays} days
                            </p>
                          </div>
                          <span className="font-extrabold text-emerald-700 dark:text-emerald-300 text-sm">
                            ₹{(resp.offeredPricePerUnitPaise / 100).toFixed(2)}/{rfq.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">
                      Awaiting farmer bids from regional horticulture clusters...
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Post RFQ Modal */}
      {showRfqModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-gradient-to-r from-forest to-agri-800 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Post Bulk Procurement RFQ</h3>
                <p className="text-xs text-slate-300">Direct bids will arrive from verified farmers & FPOs</p>
              </div>
              <button
                onClick={() => setShowRfqModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRfq} className="p-6 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Commodity / Crop Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newRfq.cropName}
                    onChange={(e) => setNewRfq({ ...newRfq, cropName: e.target.value })}
                    placeholder="e.g. Tomatoes (Hybrid)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={newRfq.category}
                    onChange={(e) => setNewRfq({ ...newRfq, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Vegetables">Vegetables</option>
                    <option value="Fruits">Fruits</option>
                    <option value="Grains & Cereals">Grains & Cereals</option>
                    <option value="Pulses">Pulses</option>
                    <option value="Spices">Spices</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    min="10"
                    value={newRfq.requiredQuantity}
                    onChange={(e) => setNewRfq({ ...newRfq, requiredQuantity: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Unit
                  </label>
                  <select
                    value={newRfq.unit}
                    onChange={(e) => setNewRfq({ ...newRfq, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="kg">kg</option>
                    <option value="quintal">quintal</option>
                    <option value="box">box</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Frequency
                  </label>
                  <select
                    value={newRfq.frequency}
                    onChange={(e) => setNewRfq({ ...newRfq, frequency: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="one-time">One-Time</option>
                    <option value="weekly">Weekly Recurring</option>
                    <option value="bi-weekly">Bi-Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Price per {newRfq.unit} (₹ optional)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newRfq.targetPrice}
                    onChange={(e) => setNewRfq({ ...newRfq, targetPrice: e.target.value })}
                    placeholder="e.g. 35.00"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Required Delivery Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newRfq.requiredByDate}
                    onChange={(e) => setNewRfq({ ...newRfq, requiredByDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kitchen / Delivery Dock Address
                </label>
                <input
                  type="text"
                  required
                  value={newRfq.address}
                  onChange={(e) => setNewRfq({ ...newRfq, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Quality Requirements & Packaging Notes
                </label>
                <textarea
                  rows={2}
                  value={newRfq.notes}
                  onChange={(e) => setNewRfq({ ...newRfq, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-agri-700 hover:bg-agri-800 text-white font-bold text-xs shadow-md transition"
              >
                Submit RFQ to Farmer Producer Network
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
