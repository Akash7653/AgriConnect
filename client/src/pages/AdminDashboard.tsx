import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  Sprout,
  Package,
  TrendingUp,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Layers,
  IndianRupee,
  Activity,
  FileSpreadsheet,
} from 'lucide-react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [payoutsList, setPayoutsList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'payouts' | 'rules' | 'audit'>('overview');

  // Config settings form
  const [farmerSharePct, setFarmerSharePct] = useState(90);
  const [platformCommissionPct, setPlatformCommissionPct] = useState(8);
  const [opsReservePct, setOpsReservePct] = useState(2);
  const [defaultDeliveryFee, setDefaultDeliveryFee] = useState(40);
  const [configSuccess, setConfigSuccess] = useState('');

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, usersRes, payoutsRes, auditRes] = await Promise.all([
        api.get('/admin/analytics'),
        api.get('/admin/users'),
        api.get('/payouts/all'),
        api.get('/admin/audit-logs'),
      ]);

      if (analyticsRes.data.analytics) {
        setAnalytics(analyticsRes.data.analytics);
        const s = analyticsRes.data.analytics.settings;
        if (s) {
          setFarmerSharePct(s.farmerSharePct);
          setPlatformCommissionPct(s.platformCommissionPct);
          setOpsReservePct(s.opsReservePct);
          setDefaultDeliveryFee(s.defaultDeliveryFeePaise / 100);
        }
      }
      if (usersRes.data.users) setUsersList(usersRes.data.users);
      if (payoutsRes.data.ledgers) setPayoutsList(payoutsRes.data.ledgers);
      if (auditRes.data.logs) setAuditLogs(auditRes.data.logs);
    } catch (err: any) {
      console.error('Admin API error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleVerifyFarmer = async (userId: string) => {
    try {
      await api.patch(`/admin/users/${userId}/verify`, { status: 'verified' });
      fetchAdminData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Verification failed');
    }
  };

  const handleSettlePayout = async (ledgerId: string) => {
    const utr = prompt('Enter Bank / UPI NEFT UTR Reference for this farmer payout settlement:', `NEFT-UTR-${Date.now()}`);
    if (!utr) return;

    try {
      await api.post(`/payouts/settle/${ledgerId}`, { transactionReference: utr });
      fetchAdminData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Settlement failed');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSuccess('');
    try {
      const res = await api.post('/admin/settings', {
        farmerSharePct: Number(farmerSharePct),
        platformCommissionPct: Number(platformCommissionPct),
        opsReservePct: Number(opsReservePct),
        defaultDeliveryFeePaise: Math.round(Number(defaultDeliveryFee) * 100),
        freeDeliveryThresholdPaise: 50000,
      });

      if (res.data.success) {
        setConfigSuccess('Marketplace commercial rules updated successfully and logged in audit trail.');
        fetchAdminData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update rules');
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="max-w-md mx-auto my-20 p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Restricted Administration Access</h2>
        <p className="text-xs text-slate-500">
          This portal requires server-side Administrator authorization. Please switch to the Admin demo account via the top bar to inspect these features.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-forest-dark to-slate-950 text-white rounded-3xl p-8 sm:p-10 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-semibold border border-purple-400/30">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            <span>Master Governance & Financial Controller</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            AgriConnect Platform Administration
          </h1>
          <p className="text-xs text-slate-300">
            Real-time GMV tracking, 90/8/2 transparent commission ledgers, farmer verification, and security audit logs.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-xs space-y-1.5 shrink-0">
          <p className="text-slate-300">Current Marketplace Configuration:</p>
          <p className="text-emerald-300 font-extrabold text-sm">
            Farmer: {farmerSharePct}% • Platform: {platformCommissionPct}% • Ops: {opsReservePct}%
          </p>
          <p className="text-slate-400 text-[10px]">Delivery: ₹{defaultDeliveryFee} (Free &gt;₹500)</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 text-xs font-bold">
        {[
          { id: 'overview', label: 'Platform Analytics & GMV', icon: TrendingUp },
          { id: 'users', label: `Farmer KYC & Users (${usersList.length})`, icon: Users },
          { id: 'payouts', label: `Payout Ledgers & Settlements (${payoutsList.length})`, icon: IndianRupee },
          { id: 'rules', label: 'Marketplace Commission Rules', icon: Settings },
          { id: 'audit', label: `Security Audit Logs (${auditLogs.length})`, icon: Activity },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 flex items-center gap-2 transition ${
              activeTab === tab.id
                ? 'border-b-2 border-purple-600 text-purple-700 dark:text-purple-400 font-extrabold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW & GMV */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-subtle space-y-1">
              <span className="text-xs text-slate-500 font-medium">Gross Merchandise Value (GMV)</span>
              <p className="text-2xl font-black text-slate-900 dark:text-slate-100">
                ₹{((analytics?.financials?.gmvPaise || 0) / 100).toFixed(2)}
              </p>
              <span className="text-[10px] text-emerald-600 font-semibold">Total consumer order value</span>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-subtle space-y-1">
              <span className="text-xs text-slate-500 font-medium">Farmer Direct Share (90%)</span>
              <p className="text-2xl font-black text-emerald-600">
                ₹{((analytics?.financials?.farmerPayoutsPaise || 0) / 100).toFixed(2)}
              </p>
              <span className="text-[10px] text-slate-400">Total earned by cultivators</span>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-subtle space-y-1">
              <span className="text-xs text-slate-500 font-medium">AgriConnect Revenue (8%)</span>
              <p className="text-2xl font-black text-purple-600 dark:text-purple-400">
                ₹{((analytics?.financials?.platformRevenuePaise || 0) / 100).toFixed(2)}
              </p>
              <span className="text-[10px] text-slate-400">Platform commission revenue</span>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-subtle space-y-1">
              <span className="text-xs text-slate-500 font-medium">Ops & Payment Reserve (2%)</span>
              <p className="text-2xl font-black text-slate-700 dark:text-slate-300">
                ₹{((analytics?.financials?.operationsReservePaise || 0) / 100).toFixed(2)}
              </p>
              <span className="text-[10px] text-slate-400">Transaction buffer reserve</span>
            </div>
          </div>

          {/* Operational Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs">
              <span className="text-slate-500">Verified Farmers</span>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {analytics?.verifiedFarmers} / {analytics?.totalFarmers}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs">
              <span className="text-slate-500">Total Orders Processed</span>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {analytics?.totalOrders}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs">
              <span className="text-slate-500">Fulfillment Success</span>
              <p className="text-xl font-bold text-emerald-600 mt-1">
                {analytics?.fulfillmentRate}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs">
              <span className="text-slate-500">Active Crop Listings</span>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {analytics?.totalListings}
              </p>
            </div>
          </div>

          {/* Top Selling Commodities Breakdown */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-subtle space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
              Top Selling Commodities by Trade Volume
            </h3>
            <div className="space-y-3">
              {analytics?.topSellingItems?.map((item: any, idx: number) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{item.name}</span>
                    <span className="font-semibold text-slate-600 dark:text-slate-400">
                      {item.count} units • ₹{(item.valuePaise / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-agri-600 rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(15, (item.valuePaise / (analytics?.financials?.gmvPaise || 1)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USER & FARMER KYC MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">KYC / Verified</th>
                    <th className="py-3 px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {usersList.map((u) => (
                    <tr key={u._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900 dark:text-slate-100">{u.name}</p>
                        <p className="text-[10px] text-slate-400">{u.email}</p>
                      </td>
                      <td className="py-3 px-4 uppercase font-semibold text-slate-600 dark:text-slate-300">
                        {u.role}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">{u.phone}</td>
                      <td className="py-3 px-4 text-slate-500">
                        {u.address?.villageOrCity}, {u.address?.district}
                      </td>
                      <td className="py-3 px-4">
                        {u.isVerified ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 w-fit block">
                            Pending Review
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {!u.isVerified && u.role === 'farmer' ? (
                          <button
                            onClick={() => handleVerifyFarmer(u._id)}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow"
                          >
                            Verify KYC
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Approved</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PAYOUT SETTLEMENTS */}
      {activeTab === 'payouts' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Order Ref</th>
                    <th className="py-3 px-4">Farmer Cultivator</th>
                    <th className="py-3 px-4">Gross Sale</th>
                    <th className="py-3 px-4 text-emerald-600">Farmer 90% Share</th>
                    <th className="py-3 px-4 text-purple-600">8% Platform</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Settlement Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {payoutsList.map((l) => (
                    <tr key={l._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {l.orderNumber}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        {l.farmerName}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                        ₹{(l.grossProductValuePaise / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-emerald-600">
                        ₹{(l.farmerPayoutPaise / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-purple-600 font-semibold">
                        ₹{(l.platformCommissionPaise / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            l.settlementStatus === 'settled'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {l.settlementStatus.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {l.settlementStatus !== 'settled' ? (
                          <button
                            onClick={() => handleSettlePayout(l._id)}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow"
                          >
                            Disburse Bank UTR
                          </button>
                        ) : (
                          <span className="font-mono text-[10px] text-slate-400">
                            {l.transactionReference}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: MARKETPLACE COMMISSION RULES */}
      {activeTab === 'rules' && (
        <div className="max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8 shadow-subtle space-y-6">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
              Configure Platform Fee Rules
            </h3>
            <p className="text-xs text-slate-500">
              Proposed business model from 2026 Startup Proposal. Must sum to exactly 100%.
            </p>
          </div>

          {configSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
              {configSuccess}
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                🌾 Farmer / FPO Value Share Percentage (%)
              </label>
              <input
                type="number"
                required
                min="50"
                max="99"
                value={farmerSharePct}
                onChange={(e) => setFarmerSharePct(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
              />
              <span className="text-[10px] text-slate-400">Default base model: 90%</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                🌱 AgriConnect Marketplace Commission (%)
              </label>
              <input
                type="number"
                required
                min="1"
                max="40"
                value={platformCommissionPct}
                onChange={(e) => setPlatformCommissionPct(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
              />
              <span className="text-[10px] text-slate-400">Default base model: 8%</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ⚙️ Payment & Operations Reserve (%)
              </label>
              <input
                type="number"
                required
                min="0"
                max="10"
                value={opsReservePct}
                onChange={(e) => setOpsReservePct(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
              />
              <span className="text-[10px] text-slate-400">Default base model: 2%</span>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between font-bold text-slate-800 dark:text-slate-200">
              <span>Total Percentage Allocation:</span>
              <span
                className={
                  farmerSharePct + platformCommissionPct + opsReservePct === 100
                    ? 'text-emerald-600'
                    : 'text-red-500'
                }
              >
                {farmerSharePct + platformCommissionPct + opsReservePct}% (Must be 100%)
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                🚚 Base Delivery Fee (₹)
              </label>
              <input
                type="number"
                required
                value={defaultDeliveryFee}
                onChange={(e) => setDefaultDeliveryFee(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
              />
              <span className="text-[10px] text-slate-400">Free delivery on orders above ₹500</span>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition"
            >
              Update Marketplace Commercial Rules
            </button>
          </form>
        </div>
      )}

      {/* TAB 5: SECURITY AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Target Resource</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                  {auditLogs.map((log) => (
                    <tr key={log._id}>
                      <td className="py-2.5 px-4 text-slate-400">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                        {log.action}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                        {log.userName || 'System'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 uppercase">{log.role || 'API'}</td>
                      <td className="py-2.5 px-4 text-slate-500">{log.targetResource || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
