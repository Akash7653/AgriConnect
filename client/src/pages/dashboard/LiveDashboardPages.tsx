import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Loader2, PackagePlus, RefreshCw } from 'lucide-react';
import { DashboardShell, StatCard } from '@/components/dashboard/DashboardShell';
import { useAuth } from '@/hooks/useAuth';
import { request } from '@/services/api';
import { subscribeRealtime } from '@/services/realtime';
import { formatCurrency, formatDate } from '@/utils';

interface OrderItem {
  cropName: string;
  quantity: number;
  unit: string;
  farmerName?: string;
}

interface MarketplaceOrder {
  _id: string;
  orderNumber: string;
  status: string;
  buyerName?: string;
  items: OrderItem[];
  pricing: { finalPayablePaise: number };
  deliveryAddress?: { recipientName: string; addressLine1: string; city: string; pinCode: string; phone: string };
  logistics?: { assignedPartnerId?: string; partnerName?: string };
  createdAt: string;
}

interface Listing {
  _id: string;
  cropName: string;
  category: string;
  unit: string;
  pricePerUnitPaise: number;
  availableQuantity: number;
  status: string;
}

interface Analytics {
  totalUsers: number;
  totalFarmers: number;
  verifiedFarmers: number;
  totalListings: number;
  totalOrders: number;
  deliveredOrdersCount: number;
  cancelledOrdersCount: number;
  financials: { gmvPaise: number; platformRevenuePaise: number; farmerPayoutsPaise: number };
}

interface LogisticsAgent { _id: string; name: string; }
interface CustomerAccount { _id: string; name: string; email: string; role: string; }

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-xl border border-forest/10 bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg text-forest">{title}</h2>{action}
      </div>
      {children}
    </section>
  );
}

function StateMessage({ loading, error, empty }: { loading: boolean; error: string; empty: boolean }) {
  if (loading) return <p className="flex items-center gap-2 py-5 text-sm text-charcoal/55"><Loader2 className="h-4 w-4 animate-spin" />Loading live account data…</p>;
  if (error) return <p className="py-5 text-sm text-red-700" role="alert">{error}</p>;
  if (empty) return <p className="py-5 text-sm text-charcoal/55">No records yet.</p>;
  return null;
}

function OrderList({ orders, children }: { orders: MarketplaceOrder[]; children?: (order: MarketplaceOrder) => ReactNode }) {
  if (!orders.length) return <p className="py-5 text-sm text-charcoal/55">No orders yet.</p>;
  return (
    <div className="divide-y divide-forest/10">
      {orders.map((order) => (
        <article key={order._id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-forest">{order.orderNumber}</p>
            <p className="mt-1 text-sm text-charcoal/60">{order.items.map((item) => `${item.cropName} × ${item.quantity} ${item.unit}`).join(', ')}</p>
            <p className="mt-1 text-xs capitalize text-charcoal/45">{order.status.replace(/_/g, ' ')} · {formatDate(order.createdAt)}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-forest">{formatCurrency(order.pricing.finalPayablePaise / 100)}</span>
            {children?.(order)}
          </div>
        </article>
      ))}
    </div>
  );
}

function useDashboardData<T>(path: string) {
  const { session } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    try {
      setData(await request<T>(path, { token: session.token }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load account data.');
    } finally {
      setLoading(false);
    }
  }, [path, session]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!session) return;
    return subscribeRealtime(session.token, () => { void load(); });
  }, [load, session]);
  return { data, loading, error, reload: load };
}

const listingCategories = ['Vegetables', 'Fruits', 'Grains & Cereals', 'Pulses', 'Spices', 'Greens & Herbs', 'Organic Special'];

function CreateListingForm({ onCreated }: { onCreated: () => void }) {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ cropName: '', category: 'Vegetables', description: '', price: '', unit: 'kg', quantity: '', village: '', district: '', state: '', pinCode: '' });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      await request('/crops', {
        method: 'POST', token: session.token,
        body: JSON.stringify({
          cropName: form.cropName, category: form.category, description: form.description,
          pricePerUnitPaise: Math.round(Number(form.price) * 100), unit: form.unit,
          availableQuantity: Number(form.quantity), minOrderQuantity: 1,
          harvestDate: new Date().toISOString(), expectedShelfLifeDays: 5,
          village: form.village, district: form.district, state: form.state, pinCode: form.pinCode,
          isOrganicCertified: false,
        }),
      });
      setForm({ cropName: '', category: 'Vegetables', description: '', price: '', unit: 'kg', quantity: '', village: '', district: '', state: '', pinCode: '' });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish listing.');
    } finally {
      setBusy(false);
    }
  }

  const textField = (key: keyof typeof form, label: string, type = 'text') => (
    <label className="block text-xs text-charcoal/65">{label}<input required type={type} min={type === 'number' ? '1' : undefined} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full rounded-lg border border-forest/15 bg-ivory px-3 py-2 text-sm text-forest" /></label>
  );

  return (
    <Panel title="Publish a crop listing">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        {textField('cropName', 'Crop name')}
        <label className="block text-xs text-charcoal/65">Category<select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="mt-1 w-full rounded-lg border border-forest/15 bg-ivory px-3 py-2 text-sm text-forest">{listingCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
        {textField('price', 'Price per unit (₹)', 'number')}{textField('quantity', 'Available quantity', 'number')}
        <label className="block text-xs text-charcoal/65">Unit<select value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))} className="mt-1 w-full rounded-lg border border-forest/15 bg-ivory px-3 py-2 text-sm text-forest">{['kg', 'bunch', 'box', 'crate', 'quintal'].map((unit) => <option key={unit}>{unit}</option>)}</select></label>
        {textField('village', 'Village')}{textField('district', 'District')}{textField('state', 'State')}{textField('pinCode', 'PIN code')}
        <label className="block text-xs text-charcoal/65 sm:col-span-2">Description<textarea required minLength={10} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="mt-1 min-h-20 w-full rounded-lg border border-forest/15 bg-ivory px-3 py-2 text-sm text-forest" /></label>
        {error && <p className="text-sm text-red-700 sm:col-span-2" role="alert">{error}</p>}
        <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-ivory disabled:opacity-50 sm:col-span-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}{busy ? 'Publishing…' : 'Publish listing'}</button>
      </form>
    </Panel>
  );
}

export function FarmerDashboard() {
  const { session } = useAuth();
  const listings = useDashboardData<{ listings: Listing[] }>('/crops/my-crops');
  const orders = useDashboardData<{ orders: MarketplaceOrder[] }>('/orders/farmer');
  async function advance(order: MarketplaceOrder) {
    if (!session) return;
    const next: Record<string, string> = { confirmed: 'accepted', accepted: 'preparing', preparing: 'ready_for_pickup' };
    const status = next[order.status];
    if (!status) return;
    await request(`/orders/${order._id}/status`, { method: 'PATCH', token: session.token, body: JSON.stringify({ status, note: `Seller moved order to ${status.replace(/_/g, ' ')}` }) });
    await orders.reload();
  }
  const listingRows = listings.data?.listings ?? [];
  const orderRows = orders.data?.orders ?? [];
  return (
    <DashboardShell role="farmer" title="Farm operations" subtitle="Manage live listings and orders from your farm.">
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4"><StatCard label="Active listings" value={listingRows.filter((item) => item.status === 'active').length} tone="emerald" /><StatCard label="Incoming orders" value={orderRows.filter((order) => ['confirmed', 'accepted', 'preparing'].includes(order.status)).length} /><StatCard label="Delivered orders" value={orderRows.filter((order) => order.status === 'delivered').length} tone="soil" /><StatCard label="Available units" value={listingRows.reduce((sum, item) => sum + item.availableQuantity, 0)} /></div>
      <div className="grid gap-6 xl:grid-cols-2"><CreateListingForm onCreated={() => void listings.reload()} /><Panel title="My listings" action={<button onClick={() => void listings.reload()} aria-label="Refresh listings" className="text-agri-green"><RefreshCw className="h-4 w-4" /></button>}><StateMessage loading={listings.loading} error={listings.error} empty={!listings.loading && !listings.error && listingRows.length === 0} />{listingRows.map((listing) => <div key={listing._id} className="flex justify-between gap-3 border-b border-forest/10 py-3 text-sm"><div><p className="font-medium text-forest">{listing.cropName}</p><p className="text-xs text-charcoal/55">{formatCurrency(listing.pricePerUnitPaise / 100)}/{listing.unit} · {listing.status}</p></div><span>{listing.availableQuantity} {listing.unit}</span></div>)}</Panel></div>
      <Panel title="Orders needing action"><StateMessage loading={orders.loading} error={orders.error} empty={!orders.loading && !orders.error && orderRows.length === 0} /><OrderList orders={orderRows}>{(order) => ['confirmed', 'accepted', 'preparing'].includes(order.status) ? <button onClick={() => void advance(order)} className="rounded-lg bg-agri-emerald px-3 py-2 text-xs font-semibold text-forest">{order.status === 'confirmed' ? 'Accept order' : order.status === 'accepted' ? 'Start preparing' : 'Ready for pickup'}</button> : null}</OrderList></Panel>
    </DashboardShell>
  );
}

export function BuyerDashboard() {
  const data = useDashboardData<{ orders: MarketplaceOrder[] }>('/orders/buyer');
  const orders = data.data?.orders ?? [];
  return <DashboardShell role="buyer" title="My orders" subtitle="Live orders and payment-confirmed purchases."><div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3"><StatCard label="Total orders" value={orders.length} tone="emerald" /><StatCard label="In progress" value={orders.filter((order) => !['delivered', 'cancelled'].includes(order.status)).length} /><StatCard label="Delivered" value={orders.filter((order) => order.status === 'delivered').length} /></div><Panel title="Order history"><StateMessage loading={data.loading} error={data.error} empty={!data.loading && !data.error && orders.length === 0} /><OrderList orders={orders} /></Panel></DashboardShell>;
}

export function LogisticsDashboard() {
  const { session } = useAuth();
  const data = useDashboardData<{ orders: MarketplaceOrder[] }>('/logistics/deliveries');
  const orders = data.data?.orders ?? [];
  const [actionError, setActionError] = useState('');
  async function claim(orderId: string) {
    if (!session) return;
    setActionError('');
    try { await request(`/logistics/claim/${orderId}`, { method: 'POST', token: session.token }); await data.reload(); }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Could not claim delivery.'); }
  }
  async function complete(orderId: string) {
    if (!session) return;
    const confirmation = window.prompt('Enter recipient name as delivery confirmation:');
    if (!confirmation?.trim()) return;
    setActionError('');
    try {
      await request(`/logistics/complete/${orderId}`, { method: 'POST', token: session.token, body: JSON.stringify({ recipientSignature: confirmation.trim() }) });
      await data.reload();
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Could not complete delivery.'); }
  }
  return <DashboardShell role="logistics" title="Delivery operations" subtitle="Claim ready orders and confirm handoff to the buyer."><div className="mb-6 grid grid-cols-2 gap-4"><StatCard label="Available / assigned" value={orders.length} tone="emerald" /><StatCard label="In progress" value={orders.filter((order) => ['picked_up', 'out_for_delivery'].includes(order.status)).length} /></div><Panel title="Dispatch queue"><StateMessage loading={data.loading} error={data.error} empty={!data.loading && !data.error && orders.length === 0} />{actionError && <p className="mb-3 text-sm text-red-700" role="alert">{actionError}</p>}<OrderList orders={orders}>{(order) => order.logistics?.assignedPartnerId ? <button onClick={() => void complete(order._id)} className="rounded-lg bg-agri-emerald px-3 py-2 text-xs font-semibold text-forest">Mark delivered</button> : <button onClick={() => void claim(order._id)} className="rounded-lg bg-forest px-3 py-2 text-xs font-semibold text-ivory">Claim delivery</button>}</OrderList></Panel></DashboardShell>;
}

export function AdminDashboard() {
  const analytics = useDashboardData<{ analytics: Analytics }>('/admin/analytics');
  const orderData = useDashboardData<{ orders: MarketplaceOrder[] }>('/admin/orders');
  const agentData = useDashboardData<{ users: LogisticsAgent[] }>('/admin/users?role=logistics&status=active');
  const customerData = useDashboardData<{ users: CustomerAccount[] }>('/admin/users?role=buyer&status=active');
  const { session } = useAuth();
  const [selectedAgent, setSelectedAgent] = useState('');
  const [assignmentError, setAssignmentError] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [approvedRole, setApprovedRole] = useState('farmer');
  const [farm, setFarm] = useState({ farmName: '', village: '', district: '', state: '', pinCode: '' });
  const [approvalError, setApprovalError] = useState('');
  const metrics = analytics.data?.analytics;
  async function assign(orderId: string) {
    if (!session || !selectedAgent) return;
    setAssignmentError('');
    try {
      await request(`/admin/orders/${orderId}/assign-delivery`, { method: 'POST', token: session.token, body: JSON.stringify({ deliveryAgentId: selectedAgent }) });
      await orderData.reload();
    } catch (error) {
      setAssignmentError(error instanceof Error ? error.message : 'Could not assign delivery.');
    }
  }
  async function approveRole(event: FormEvent) {
    event.preventDefault();
    if (!session || !selectedCustomer) return;
    setApprovalError('');
    try {
      await request(`/admin/users/${selectedCustomer}/role`, {
        method: 'PATCH', token: session.token,
        body: JSON.stringify({ role: approvedRole, ...(approvedRole === 'farmer' ? { farm } : {}) }),
      });
      setSelectedCustomer('');
      setFarm({ farmName: '', village: '', district: '', state: '', pinCode: '' });
      await Promise.all([customerData.reload(), analytics.reload()]);
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : 'Could not approve account role.');
    }
  }
  const orders = orderData.data?.orders ?? [];
  const agents = agentData.data?.users ?? [];
  return <DashboardShell role="admin" title="Operations control" subtitle="Live platform totals from the application database."><div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3"><StatCard label="Users" value={metrics?.totalUsers ?? '—'} /><StatCard label="Farmers" value={metrics?.totalFarmers ?? '—'} tone="emerald" /><StatCard label="Verified farmers" value={metrics?.verifiedFarmers ?? '—'} /><StatCard label="Active listings" value={metrics?.totalListings ?? '—'} /><StatCard label="Orders" value={metrics?.totalOrders ?? '—'} /><StatCard label="Delivered" value={metrics?.deliveredOrdersCount ?? '—'} /></div><Panel title="Financial overview"><StateMessage loading={analytics.loading} error={analytics.error} empty={!analytics.loading && !analytics.error && !metrics} />{metrics && <div className="grid gap-4 sm:grid-cols-3"><StatCard label="GMV" value={formatCurrency(metrics.financials.gmvPaise / 100)} /><StatCard label="Platform commission" value={formatCurrency(metrics.financials.platformRevenuePaise / 100)} tone="emerald" /><StatCard label="Seller payouts accrued" value={formatCurrency(metrics.financials.farmerPayoutsPaise / 100)} tone="soil" /></div>}</Panel><Panel title="Approve account access"><form onSubmit={approveRole} className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-charcoal/65">Customer account<select required value={selectedCustomer} onChange={(event) => setSelectedCustomer(event.target.value)} className="mt-1 w-full rounded-lg border border-forest/15 bg-ivory px-3 py-2 text-sm"><option value="">Select customer</option>{(customerData.data?.users ?? []).map((user) => <option key={user._id} value={user._id}>{user.name} · {user.email}</option>)}</select></label><label className="text-xs text-charcoal/65">Approved capability<select value={approvedRole} onChange={(event) => setApprovedRole(event.target.value)} className="mt-1 w-full rounded-lg border border-forest/15 bg-ivory px-3 py-2 text-sm"><option value="farmer">Farmer / FPO</option><option value="business">Business buyer</option><option value="logistics">Delivery partner</option></select></label>{approvedRole === 'farmer' && (Object.keys(farm) as Array<keyof typeof farm>).map((field) => <label key={field} className="text-xs capitalize text-charcoal/65">{field}<input required value={farm[field]} onChange={(event) => setFarm((current) => ({ ...current, [field]: event.target.value }))} className="mt-1 w-full rounded-lg border border-forest/15 bg-ivory px-3 py-2 text-sm" /></label>)}{approvalError && <p className="text-sm text-red-700 sm:col-span-2" role="alert">{approvalError}</p>}<button disabled={!selectedCustomer} className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-ivory disabled:opacity-40">Approve account</button></form></Panel><Panel title="Live order control"><StateMessage loading={orderData.loading} error={orderData.error} empty={!orderData.loading && !orderData.error && orders.length === 0} />{assignmentError && <p className="mb-3 text-sm text-red-700" role="alert">{assignmentError}</p>}<OrderList orders={orders}>{(order) => order.status === 'ready_for_pickup' && !order.logistics?.assignedPartnerId ? <div className="flex gap-2"><select aria-label={`Delivery agent for ${order.orderNumber}`} value={selectedAgent} onChange={(event) => setSelectedAgent(event.target.value)} className="max-w-36 rounded-lg border border-forest/15 px-2 py-1 text-xs"><option value="">Assign driver</option>{agents.map((agent) => <option key={agent._id} value={agent._id}>{agent.name}</option>)}</select><button onClick={() => void assign(order._id)} disabled={!selectedAgent} className="rounded-lg bg-forest px-3 py-2 text-xs font-semibold text-ivory disabled:opacity-40">Assign</button></div> : order.logistics?.partnerName ? <span className="text-xs text-charcoal/55">Driver: {order.logistics.partnerName}</span> : null}</OrderList></Panel></DashboardShell>;
}
