import React, { useState, useEffect } from 'react';
import {
  Sprout,
  Plus,
  Package,
  Clock,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  Truck,
  IndianRupee,
  Calendar,
  Layers,
  MapPin,
  RefreshCw,
  Edit,
  X,
} from 'lucide-react';
import api from '../services/api.js';
import { CropListing, Order, PayoutRecord } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { getSocket } from '../services/socket.js';

export const FarmerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'listings' | 'orders' | 'payouts' | 'demand'>('listings');
  const [listings, setListings] = useState<CropListing[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payouts, setPayouts] = useState<{ summary: any; ledgers: PayoutRecord[] }>({
    summary: null,
    ledgers: [],
  });
  const [loading, setLoading] = useState(true);

  // New crop modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCrop, setNewCrop] = useState({
    cropName: '',
    variety: '',
    category: 'Vegetables',
    description: '',
    qualityGrade: 'A',
    pricePerUnit: '',
    unit: 'kg',
    availableQuantity: '',
    minOrderQuantity: '1',
    harvestDate: new Date().toISOString().split('T')[0],
    expectedShelfLifeDays: '5',
    isOrganicCertified: false,
    village: user?.address?.villageOrCity || 'Dharmavaram',
    district: user?.address?.district || 'Anantapur',
    state: user?.address?.state || 'Andhra Pradesh',
    pinCode: user?.address?.pinCode || '515671',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cropsRes, ordersRes, payoutsRes] = await Promise.all([
        api.get('/crops/my-crops'),
        api.get('/orders/farmer'),
        api.get('/payouts/my-ledger'),
      ]);

      if (cropsRes.data.listings) setListings(cropsRes.data.listings);
      if (ordersRes.data.orders) setOrders(ordersRes.data.orders);
      if (payoutsRes.data.ledgers) {
        setPayouts({
          summary: payoutsRes.data.summary,
          ledgers: payoutsRes.data.ledgers,
        });
      }
    } catch (err) {
      console.error('Error fetching farmer dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Listen to real-time order alerts via Socket.IO
    const socket = getSocket();
    const handleNewOrder = (data: any) => {
      console.log('⚡ Real-time Order Alert received on Farmer Dashboard:', data);
      fetchData();
    };

    socket.on('order:new', handleNewOrder);
    return () => {
      socket.off('order:new', handleNewOrder);
    };
  }, []);

  const handleCreateCrop = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        cropName: newCrop.cropName,
        variety: newCrop.variety,
        category: newCrop.category,
        description: newCrop.description,
        qualityGrade: newCrop.qualityGrade,
        pricePerUnitPaise: Math.round(parseFloat(newCrop.pricePerUnit) * 100),
        unit: newCrop.unit,
        availableQuantity: parseInt(newCrop.availableQuantity, 10),
        minOrderQuantity: parseInt(newCrop.minOrderQuantity, 10),
        harvestDate: new Date(newCrop.harvestDate).toISOString(),
        expectedShelfLifeDays: parseInt(newCrop.expectedShelfLifeDays, 10),
        village: newCrop.village,
        district: newCrop.district,
        state: newCrop.state,
        pinCode: newCrop.pinCode,
        isOrganicCertified: newCrop.isOrganicCertified,
        images: [
          newCrop.category === 'Vegetables'
            ? 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80'
            : newCrop.category === 'Fruits'
            ? 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=800&q=80'
            : 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
        ],
      };

      const res = await api.post('/crops', payload);
      if (res.data.success) {
        setShowAddModal(false);
        fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to publish crop');
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string, note: string) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status, note });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update order status');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-forest via-agri-900 to-forest-light text-white rounded-3xl p-8 sm:p-10 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-400/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Verified Farmer & FPO Dashboard</span>
          </div>
          <h1 className="text-3xl font-extrabold">{user?.name}’s Farm Operations</h1>
          <p className="text-xs text-slate-300">
            {user?.address?.villageOrCity}, {user?.address?.district} • 90% direct transparent payout rate
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition hover:scale-105 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Publish New Crop Listing</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-subtle space-y-1">
          <span className="text-xs text-slate-500 font-medium">Active Crop Listings</span>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{listings.length}</p>
          <span className="text-[11px] text-emerald-600 font-semibold">Available on marketplace</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-subtle space-y-1">
          <span className="text-xs text-slate-500 font-medium">Orders Received</span>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{orders.length}</p>
          <span className="text-[11px] text-agri-600 font-semibold">Direct buyer orders</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-subtle space-y-1">
          <span className="text-xs text-slate-500 font-medium">Total 90% Earned Payouts</span>
          <p className="text-2xl font-extrabold text-emerald-600">
            ₹{((payouts.summary?.totalFarmerSharePaise || 0) / 100).toFixed(2)}
          </p>
          <span className="text-[11px] text-slate-400">Direct to bank / UPI</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-subtle space-y-1">
          <span className="text-xs text-slate-500 font-medium">Settled to Account</span>
          <p className="text-2xl font-extrabold text-forest dark:text-emerald-400">
            ₹{((payouts.summary?.totalSettledPaise || 0) / 100).toFixed(2)}
          </p>
          <span className="text-[11px] text-emerald-600 font-semibold">Verified UTR transfers</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab('listings')}
          className={`pb-3 flex items-center gap-2 transition ${
            activeTab === 'listings'
              ? 'border-b-2 border-agri-600 text-agri-700 dark:text-emerald-400 font-extrabold'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>My Crop Inventory ({listings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 flex items-center gap-2 transition ${
            activeTab === 'orders'
              ? 'border-b-2 border-agri-600 text-agri-700 dark:text-emerald-400 font-extrabold'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Incoming Orders ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('payouts')}
          className={`pb-3 flex items-center gap-2 transition ${
            activeTab === 'payouts'
              ? 'border-b-2 border-agri-600 text-agri-700 dark:text-emerald-400 font-extrabold'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <IndianRupee className="w-4 h-4" />
          <span>Transparent Payout Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('demand')}
          className={`pb-3 flex items-center gap-2 transition ${
            activeTab === 'demand'
              ? 'border-b-2 border-agri-600 text-agri-700 dark:text-emerald-400 font-extrabold'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Buyer Demand Insights</span>
        </button>
      </div>

      {/* TAB 1: CROP LISTINGS INVENTORY */}
      {activeTab === 'listings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Live Managed Produce
            </h3>
            <span className="text-xs text-slate-500">
              Changes reflect instantly in buyer marketplace
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Produce</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Price / Unit</th>
                    <th className="py-3 px-4">Available Stock</th>
                    <th className="py-3 px-4">Quality Grade</th>
                    <th className="py-3 px-4">Harvest Date</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {listings.map((crop) => (
                    <tr key={crop._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={crop.images?.[0] || 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?auto=format&fit=crop&w=200&q=80'}
                            alt={crop.cropName}
                            className="w-10 h-10 rounded-lg object-cover bg-slate-100"
                          />
                          <div>
                            <p className="font-bold text-slate-900 dark:text-slate-100">{crop.cropName}</p>
                            <p className="text-[10px] text-slate-400">{crop.variety || 'Standard'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{crop.category}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                        ₹{(crop.pricePerUnitPaise / 100).toFixed(2)}/{crop.unit}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-emerald-600">
                          {crop.availableQuantity} {crop.unit}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">
                          Grade {crop.qualityGrade}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(crop.harvestDate).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            crop.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {crop.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INCOMING & ACTIVE ORDERS */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
            Fulfillment Queue
          </h3>

          <div className="space-y-4">
            {orders.map((ord) => (
              <div
                key={ord._id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-subtle space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
                      Order #{ord.orderNumber}
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Buyer: {ord.buyerName} • Delivery Slot: {ord.deliverySlot?.timeWindow}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-extrabold uppercase bg-agri-50 dark:bg-slate-800 text-agri-700 dark:text-agri-300 border border-agri-200 dark:border-slate-700">
                      {ord.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {/* Items in this order */}
                <div className="space-y-2 text-xs">
                  {ord.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {item.quantity} {item.unit} × {item.cropName} (Grade {item.qualityGrade})
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        ₹{(item.totalPaise / 100).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Farmer Status Action Buttons */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 items-center justify-between">
                  <div className="text-xs">
                    <span className="text-slate-400">Target Farmer 90% Share: </span>
                    <span className="font-extrabold text-emerald-600">
                      ₹{(ord.pricing.farmerPayoutPaise / 100).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    {ord.status === 'confirmed' && (
                      <button
                        onClick={() =>
                          handleUpdateOrderStatus(ord._id, 'accepted', 'Farmer confirmed crop quality and availability')
                        }
                        className="px-3 py-1.5 rounded-xl bg-agri-700 hover:bg-agri-800 text-white font-bold text-xs shadow"
                      >
                        Accept Order
                      </button>
                    )}

                    {ord.status === 'accepted' && (
                      <button
                        onClick={() =>
                          handleUpdateOrderStatus(ord._id, 'preparing', 'Harvesting & sorting produce into clean crates')
                        }
                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow"
                      >
                        Start Packing & Sorting
                      </button>
                    )}

                    {ord.status === 'preparing' && (
                      <button
                        onClick={() =>
                          handleUpdateOrderStatus(ord._id, 'ready_for_pickup', 'Packed in farm gate dock ready for logistics pickup')
                        }
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow"
                      >
                        Mark Ready for Logistics Pickup
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: TRANSPARENT PAYOUT LEDGER */}
      {activeTab === 'payouts' && (
        <div className="space-y-4">
          <div className="bg-cream-100 dark:bg-slate-800/60 p-4 rounded-2xl border border-cream-300 dark:border-slate-700 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Verified Settlement Account: <strong>{payouts.summary?.bankDetails?.bankName || 'HDFC Bank'}</strong> • A/C ending in <strong>{payouts.summary?.bankDetails?.accountNumber?.slice(-4) || '0394'}</strong> • UPI: <strong>{payouts.summary?.bankDetails?.upiId || 'nandhufarm@oksbi'}</strong>
              </span>
            </div>
            <span className="font-bold text-emerald-700 dark:text-emerald-400">90% Value Share Policy</span>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Order Ref</th>
                    <th className="py-3 px-4">Gross Sale</th>
                    <th className="py-3 px-4 text-emerald-600">Farmer Share (90%)</th>
                    <th className="py-3 px-4 text-slate-400">Platform (8%)</th>
                    <th className="py-3 px-4 text-slate-400">Reserve (2%)</th>
                    <th className="py-3 px-4">Settlement Status</th>
                    <th className="py-3 px-4">UTR / Bank Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {payouts.ledgers.map((p) => (
                    <tr key={p._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {p.orderNumber}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                        ₹{(p.grossProductValuePaise / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-emerald-600">
                        ₹{(p.farmerPayoutPaise / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        ₹{(p.platformCommissionPaise / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        ₹{(p.operationsReservePaise / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.settlementStatus === 'settled'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {p.settlementStatus.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {p.transactionReference || 'Pending Batch'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BUYER DEMAND INSIGHTS */}
      {activeTab === 'demand' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-subtle space-y-3">
            <span className="text-2xl">🔥</span>
            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              High Velocity Demand: Tomatoes & Onions
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Hyderabad & Bangalore hotel kitchens are placing recurring bulk RFQs for Grade A Hybrid
              Tomatoes at ₹38-42/kg. FPOs with standard crated packaging are receiving 100% fulfillments.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-subtle space-y-3">
            <span className="text-2xl">🌾</span>
            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Aged Sona Masoori Rice Premium
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Supermarket procurement teams are offering a 12% premium for 12-month aged Sona Masoori
              rice with moisture content &lt;14%.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-subtle space-y-3">
            <span className="text-2xl">🌿</span>
            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Organic Certification Multiplier
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Listing your produce with 'Organic Certified' status increases household buyer order
              frequency by 2.4x.
            </p>
          </div>
        </div>
      )}

      {/* Add Crop Listing Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-gradient-to-r from-forest to-agri-800 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Publish New Crop to Marketplace</h3>
                <p className="text-xs text-slate-300">Produce will be available immediately to buyers</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCrop} className="p-6 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Crop Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCrop.cropName}
                    onChange={(e) => setNewCrop({ ...newCrop, cropName: e.target.value })}
                    placeholder="e.g. Fresh Hybrid Tomatoes"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Variety / Cultivar
                  </label>
                  <input
                    type="text"
                    value={newCrop.variety}
                    onChange={(e) => setNewCrop({ ...newCrop, variety: e.target.value })}
                    placeholder="e.g. Saaho 3251"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={newCrop.category}
                    onChange={(e) => setNewCrop({ ...newCrop, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Vegetables">Vegetables</option>
                    <option value="Fruits">Fruits</option>
                    <option value="Grains & Cereals">Grains & Cereals</option>
                    <option value="Pulses">Pulses</option>
                    <option value="Spices">Spices</option>
                    <option value="Greens & Herbs">Greens & Herbs</option>
                    <option value="Organic Special">Organic Special</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Quality Grade *
                  </label>
                  <select
                    value={newCrop.qualityGrade}
                    onChange={(e) => setNewCrop({ ...newCrop, qualityGrade: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="A+">Grade A+</option>
                    <option value="A">Grade A</option>
                    <option value="B+">Grade B+</option>
                    <option value="B">Grade B</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Selling Unit *
                  </label>
                  <select
                    value={newCrop.unit}
                    onChange={(e) => setNewCrop({ ...newCrop, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="kg">kg</option>
                    <option value="quintal">quintal</option>
                    <option value="box">box</option>
                    <option value="bunch">bunch</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Price in ₹ per {newCrop.unit} *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={newCrop.pricePerUnit}
                    onChange={(e) => setNewCrop({ ...newCrop, pricePerUnit: e.target.value })}
                    placeholder="e.g. 40.00"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                  <span className="text-[10px] text-emerald-600 mt-0.5 block">
                    You receive 90% (₹{(parseFloat(newCrop.pricePerUnit || '0') * 0.9).toFixed(2)})
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Available Quantity ({newCrop.unit}) *
                  </label>
                  <input
                    type="number"
                    required
                    value={newCrop.availableQuantity}
                    onChange={(e) => setNewCrop({ ...newCrop, availableQuantity: e.target.value })}
                    placeholder="e.g. 500"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description & Harvest Quality Notes *
                </label>
                <textarea
                  rows={3}
                  required
                  value={newCrop.description}
                  onChange={(e) => setNewCrop({ ...newCrop, description: e.target.value })}
                  placeholder="Describe farm origin, harvest time, moisture, and crispness..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Harvest Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newCrop.harvestDate}
                    onChange={(e) => setNewCrop({ ...newCrop, harvestDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Shelf Life (Days)
                  </label>
                  <input
                    type="number"
                    value={newCrop.expectedShelfLifeDays}
                    onChange={(e) => setNewCrop({ ...newCrop, expectedShelfLifeDays: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={newCrop.isOrganicCertified}
                  onChange={(e) => setNewCrop({ ...newCrop, isOrganicCertified: e.target.checked })}
                  className="rounded border-slate-300 text-agri-600 focus:ring-agri-500"
                />
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Certified Organic Produce (Grown without synthetic pesticides)
                </span>
              </label>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-agri-700 hover:bg-agri-800 text-white font-bold text-xs shadow-md transition"
              >
                Publish Crop to Live Marketplace
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
