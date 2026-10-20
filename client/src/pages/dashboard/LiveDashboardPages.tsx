import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ImagePlus, Loader2, PackagePlus, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { DashboardShell, StatCard } from '@/components/dashboard/DashboardShell';
import { useAuth } from '@/hooks/useAuth';
import { request } from '@/services/api';
import { removeProductImage, uploadProductImage } from '@/services/products';
import { subscribeRealtime } from '@/services/realtime';
import { formatCurrency, formatDate } from '@/utils';

interface OrderItem {
  listingId?: string;
  farmerId?: string;
  cropName: string;
  quantity: number;
  unit: string;
  farmerName?: string;
  totalPaise?: number;
}

interface MarketplaceOrder {
  _id: string;
  orderNumber: string;
  status: string;
  buyerName?: string;
  items: OrderItem[];
  pricing: { finalPayablePaise: number };
  payment?: { gateway: string; status: string };
  deliveryAddress?: { recipientName?: string; addressLine1?: string; city?: string; district?: string; state?: string; pinCode?: string; phone?: string };
  logistics?: {
    assignedPartnerId?: string;
    partnerName?: string;
    assignmentHistory?: Array<{ deliveryAgentName: string; assignedAt: string; previousAgentName?: string }>;
  };
  statusHistory?: Array<{ status: string; note?: string; timestamp: string }>;
  createdAt: string;
}

interface Listing {
  _id: string;
  cropName: string;
  category: string;
  description?: string;
  unit: string;
  pricePerUnitPaise: number;
  availableQuantity: number;
  minOrderQuantity?: number;
  status: string;
  viewsCount?: number;
  createdAt?: string;
  harvestDate?: string;
  location?: { village: string; district: string; state: string; pinCode: string };
  images?: string[];
  imageAssets?: Array<{ url: string; publicId: string; contentType: string; bytes: number; uploadedAt: string }>;
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
interface CustomerAccount {
  _id: string;
  name: string;
  email: string;
  role: string;
  requestedRole?: string;
  requestedFarm?: { farmName: string; village: string; district: string; state: string; pinCode: string; };
  isVerified?: boolean;
  status?: string;
}
interface FarmerPayoutLedger {
  _id: string;
  orderNumber: string;
  grossProductValuePaise: number;
  farmerPayoutPaise: number;
  settlementStatus: string;
  transactionReference?: string;
  createdAt: string;
  settledAt?: string;
}
interface FarmerPayoutSummary {
  totalGrossPaise: number;
  totalFarmerSharePaise: number;
  totalSettledPaise: number;
  pendingSettlementPaise: number;
}

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
            {order.payment?.gateway === 'cod_verified' && (
              <p className="mt-1 text-xs font-medium text-soil-dark">
                Cash on delivery · {order.payment.status === 'captured' ? 'cash collected' : 'payment due'}
              </p>
            )}
            {order.statusHistory?.length ? (
              <p className="mt-1 text-xs text-charcoal/45">
                Updated: {order.statusHistory.slice(-3).map((entry) => `${entry.status.replace(/_/g, ' ')}${entry.note ? ` — ${entry.note}` : ''}`).join(' · ')}
              </p>
            ) : null}
            {order.logistics?.assignmentHistory?.length ? (
              <p className="mt-1 text-xs text-charcoal/45">
                Delivery history: {order.logistics.assignmentHistory.map((entry) => `${entry.previousAgentName ? `${entry.previousAgentName} → ` : ''}${entry.deliveryAgentName} (${formatDate(entry.assignedAt)})`).join(' · ')}
              </p>
            ) : order.logistics?.partnerName ? <p className="mt-1 text-xs text-charcoal/45">Delivery partner: {order.logistics.partnerName}</p> : null}
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

function useDashboardData<T>(path: string, pollIntervalMs = 30_000) {
  const { session } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async (showLoading = true) => {
    if (!session) return;
    if (showLoading) setLoading(true);
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
    const unsubscribe = subscribeRealtime(session.token, () => { void load(false); });
    const interval = pollIntervalMs > 0 ? window.setInterval(() => { void load(false); }, pollIntervalMs) : undefined;
    return () => {
      unsubscribe();
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [load, pollIntervalMs, session]);
  return { data, loading, error, reload: () => load(true) };
}

const listingCategories = ['Vegetables', 'Fruits', 'Grains & Cereals', 'Pulses', 'Spices', 'Greens & Herbs', 'Organic Special'];

function CreateListingForm({ listing, onCreated, onCancel }: { listing?: Listing; onCreated: () => void; onCancel?: () => void }) {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [progress, setProgress] = useState(0);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [form, setForm] = useState({
    cropName: listing?.cropName ?? '',
    category: listing?.category ?? 'Vegetables',
    description: listing?.description ?? '',
    price: listing ? String(listing.pricePerUnitPaise / 100) : '',
    unit: listing?.unit ?? 'kg',
    quantity: listing ? String(listing.availableQuantity) : '',
    minOrderQuantity: String(listing?.minOrderQuantity ?? 1),
    status: listing?.status ?? 'active',
    village: listing?.location?.village ?? session?.user.address?.villageOrCity ?? '',
    district: listing?.location?.district ?? session?.user.address?.district ?? '',
    state: listing?.location?.state ?? session?.user.address?.state ?? '',
    pinCode: listing?.location?.pinCode ?? session?.user.address?.pinCode ?? '',
  });
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!selectedImage) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(selectedImage);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedImage]);

  useEffect(() => {
    const address = session?.user.address;
    if (!address) return;
    setForm((current) => ({
      ...current,
      village: current.village || address.villageOrCity || '',
      district: current.district || address.district || '',
      state: current.state || address.state || '',
      pinCode: current.pinCode || address.pinCode || '',
    }));
  }, [session?.user.address]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        cropName: form.cropName,
        category: form.category,
        description: form.description,
        pricePerUnitPaise: Math.round(Number(form.price) * 100),
        unit: form.unit,
        availableQuantity: Number(form.quantity),
        minOrderQuantity: Number(form.minOrderQuantity),
        harvestDate: listing?.harvestDate ?? new Date().toISOString(),
        ...(listing ? { status: form.status } : {}),
        village: form.village,
        district: form.district,
        state: form.state,
        pinCode: form.pinCode,
      };
      let listingId = listing?._id;
      if (listing) {
        await request(`/crops/${listing._id}`, { method: 'PUT', token: session.token, body: JSON.stringify(payload) });
      } else {
        const created = await request<{ listing: Listing }>('/crops', {
          method: 'POST', token: session.token, body: JSON.stringify(payload),
        });
        listingId = created.listing._id;
      }
      if (selectedImage && listingId) {
        setProgress(1);
        await uploadProductImage(session, listingId, selectedImage, setProgress);
      }
      setSelectedImage(null);
      onCreated();
      setSuccess(selectedImage ? 'Product saved with its image.' : 'Product saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save product.');
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  const textField = (key: keyof typeof form, label: string, type = 'text') => (
    <label className="block text-xs text-charcoal/65">{label}<input required type={type} min={type !== 'number' ? undefined : key === 'quantity' && listing ? '0' : key === 'price' || key === 'minOrderQuantity' || key === 'quantity' ? '1' : '0'} step={type !== 'number' ? undefined : key === 'minOrderQuantity' ? '1' : 'any'} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full rounded-lg border border-forest/15 bg-ivory px-3 py-2 text-sm text-forest" /></label>
  );

  return (
    <Panel title={listing ? `Edit ${listing.cropName}` : 'Add a crop product'}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        {textField('cropName', 'Crop name')}
        <label className="block text-xs text-charcoal/65">Category<select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="mt-1 w-full rounded-lg border border-forest/15 bg-ivory px-3 py-2 text-sm text-forest">{listingCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
        {textField('price', 'Price per unit (₹)', 'number')}{textField('quantity', 'Available quantity', 'number')}{textField('minOrderQuantity', 'Minimum order quantity', 'number')}
        <label className="block text-xs text-charcoal/65">Unit<select value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))} className="mt-1 w-full rounded-lg border border-forest/15 bg-ivory px-3 py-2 text-sm text-forest">{['kg', 'bunch', 'box', 'crate', 'quintal'].map((unit) => <option key={unit}>{unit}</option>)}</select></label>
        {listing && <label className="block text-xs text-charcoal/65">Marketplace status<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="mt-1 w-full rounded-lg border border-forest/15 bg-ivory px-3 py-2 text-sm text-forest"><option value="active">Active</option><option value="paused">Inactive</option><option value="archived">Archived</option></select></label>}
        {textField('village', 'Village')}{textField('district', 'District')}{textField('state', 'State')}{textField('pinCode', 'PIN code')}
        <p className="text-xs text-charcoal/55 sm:col-span-2">Your saved farm area is filled in automatically. If it is missing or incorrect, enter the village and location manually.</p>
        <div className="space-y-2 sm:col-span-2">
          <label className="block text-xs text-charcoal/65">Product image (JPEG, PNG, or WebP; max 5 MB)
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (file && file.size > 5 * 1024 * 1024) {
                setError('Choose an image no larger than 5 MB.');
                event.target.value = '';
                return;
              }
              setError('');
              setSelectedImage(file);
            }} className="mt-1 block w-full rounded-lg border border-forest/15 bg-white px-3 py-2 text-sm" />
          </label>
          {previewUrl && <img src={previewUrl} alt="Product image preview" className="h-32 w-40 rounded-xl object-cover" />}
          {listing?.images?.map((url) => <img key={url} src={url} alt={`${listing.cropName} product`} className="h-32 w-40 rounded-xl object-cover" />)}
          {progress > 0 && <div role="status" className="text-xs text-charcoal/60">Uploading image… {progress}%<progress className="mt-1 block w-full" max="100" value={progress} /></div>}
        </div>
        <label className="block text-xs text-charcoal/65 sm:col-span-2">Description<textarea required minLength={10} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="mt-1 min-h-20 w-full rounded-lg border border-forest/15 bg-ivory px-3 py-2 text-sm text-forest" /></label>
        {error && <p className="text-sm text-red-700 sm:col-span-2" role="alert">{error}</p>}
        {success && <p className="text-sm text-green-800 sm:col-span-2" role="status">{success}</p>}
        <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-ivory disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : selectedImage ? <ImagePlus className="h-4 w-4" /> : <PackagePlus className="h-4 w-4" />}{busy ? 'Saving…' : listing ? 'Save product' : 'Publish product'}</button>
        {listing && onCancel && <button type="button" onClick={onCancel} className="rounded-lg border border-forest/15 px-4 py-2.5 text-sm text-forest">Cancel</button>}
      </form>
    </Panel>
  );
}

export function FarmerDashboard() {
  const { session } = useAuth();
  const listings = useDashboardData<{ listings: Listing[] }>('/crops/my-crops');
  const orders = useDashboardData<{ orders: MarketplaceOrder[] }>('/orders/farmer');
  const [actionError, setActionError] = useState('');
  const [busyOrder, setBusyOrder] = useState('');
  async function advance(order: MarketplaceOrder) {
    if (!session) return;
    const next: Record<string, string> = { confirmed: 'accepted', accepted: 'preparing', preparing: 'ready_for_pickup' };
    const status = next[order.status];
    if (!status) return;
    setBusyOrder(order._id);
    setActionError('');
    try {
      await request(`/orders/${order._id}/status`, { method: 'PATCH', token: session.token, body: JSON.stringify({ status, note: `Seller moved order to ${status.replace(/_/g, ' ')}` }) });
      await orders.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update this order.');
    } finally {
      setBusyOrder('');
    }
  }
  const listingRows = listings.data?.listings ?? [];
  const orderRows = orders.data?.orders ?? [];
  return (
    <DashboardShell role="farmer" title="Farm operations" subtitle="Manage live listings and orders from your farm.">
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4"><StatCard label="Active listings" value={listingRows.filter((item) => item.status === 'active').length} tone="emerald" /><StatCard label="Incoming orders" value={orderRows.filter((order) => ['confirmed', 'accepted', 'preparing'].includes(order.status)).length} /><StatCard label="Delivered orders" value={orderRows.filter((order) => order.status === 'delivered').length} tone="soil" /><StatCard label="Available units" value={listingRows.reduce((sum, item) => sum + item.availableQuantity, 0)} /></div>
      <div className="grid gap-6 xl:grid-cols-2"><CreateListingForm onCreated={() => void listings.reload()} /><Panel title="My listings" action={<button onClick={() => void listings.reload()} aria-label="Refresh listings" className="text-agri-green"><RefreshCw className="h-4 w-4" /></button>}><StateMessage loading={listings.loading} error={listings.error} empty={!listings.loading && !listings.error && listingRows.length === 0} />{listingRows.map((listing) => <div key={listing._id} className="flex justify-between gap-3 border-b border-forest/10 py-3 text-sm"><div><p className="font-medium text-forest">{listing.cropName}</p><p className="text-xs text-charcoal/55">{formatCurrency(listing.pricePerUnitPaise / 100)}/{listing.unit} · {listing.status}</p></div><span>{listing.availableQuantity} {listing.unit}</span></div>)}</Panel></div>
      <Panel title="Orders needing action"><StateMessage loading={orders.loading} error={orders.error} empty={!orders.loading && !orders.error && orderRows.length === 0} />{actionError && <p className="mb-3 text-sm text-red-700" role="alert">{actionError}</p>}<OrderList orders={orderRows}>{(order) => ['confirmed', 'accepted', 'preparing'].includes(order.status) ? <button disabled={busyOrder === order._id} onClick={() => void advance(order)} className="rounded-lg bg-agri-emerald px-3 py-2 text-xs font-semibold text-forest disabled:opacity-50">{busyOrder === order._id ? 'Updating…' : order.status === 'confirmed' ? 'Accept order' : order.status === 'accepted' ? 'Start preparing' : 'Ready for pickup'}</button> : null}</OrderList></Panel>
    </DashboardShell>
  );
}

export function FarmerListingsPage() {
  const { session } = useAuth();
  const listings = useDashboardData<{ listings: Listing[] }>('/crops/my-crops');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Listing | null>(null);

  async function updateStock(listing: Listing) {
    if (!session) return;
    const quantity = Number(quantities[listing._id]);
    if (!Number.isFinite(quantity) || quantity < 0) {
      setError('Enter a valid stock quantity of zero or more.');
      return;
    }
    setSaving(listing._id);
    setError('');
    try {
      await request(`/crops/${listing._id}`, {
        method: 'PUT',
        token: session.token,
        body: JSON.stringify({ availableQuantity: quantity }),
      });
      setQuantities((current) => {
        const updated = { ...current };
        delete updated[listing._id];
        return updated;
      });
      await listings.reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update crop stock.');
    } finally {
      setSaving('');
    }
  }

  async function archiveListing(listing: Listing) {
    if (!session || !window.confirm(`Remove ${listing.cropName} from the marketplace? Past orders will remain in order history.`)) return;
    setSaving(listing._id);
    setError('');
    try {
      await request(`/crops/${listing._id}`, { method: 'DELETE', token: session.token });
      await listings.reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not remove this product.');
    } finally {
      setSaving('');
    }
  }

  async function removeImage(listing: Listing, publicId: string) {
    if (!session) return;
    setSaving(listing._id);
    setError('');
    try {
      await removeProductImage(session, listing._id, publicId);
      await listings.reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not remove this image.');
    } finally {
      setSaving('');
    }
  }

  const rows = listings.data?.listings ?? [];
  return (
    <DashboardShell role="farmer" title="Crop listings" subtitle="Publish products, update available stock, and review your listing history.">
      <div className="grid gap-6 xl:grid-cols-2">
        {editing
          ? <CreateListingForm key={editing._id} listing={editing} onCreated={() => { setEditing(null); void listings.reload(); }} onCancel={() => setEditing(null)} />
          : <CreateListingForm onCreated={() => void listings.reload()} />}
        <Panel title="My products and history" action={<button onClick={() => void listings.reload()} aria-label="Refresh listings" className="text-agri-green"><RefreshCw className="h-4 w-4" /></button>}>
          <StateMessage loading={listings.loading} error={listings.error} empty={!listings.loading && !listings.error && rows.length === 0} />
          {error && <p className="mb-3 text-sm text-red-700" role="alert">{error}</p>}
          <div className="divide-y divide-forest/10">
            {rows.map((listing) => (
              <article key={listing._id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium text-forest">{listing.cropName}</h3>
                    <p className="mt-1 text-xs capitalize text-charcoal/55">{listing.category} · {listing.status.replace(/_/g, ' ')} · {formatCurrency(listing.pricePerUnitPaise / 100)}/{listing.unit}</p>
                  </div>
                  <span className="text-xs text-charcoal/55">{listing.viewsCount ?? 0} views</span>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="text-xs text-charcoal/65">Available stock ({listing.unit})
                    <input
                      type="number"
                      min="0"
                      step="any"
                      aria-label={`Available stock for ${listing.cropName}`}
                      value={quantities[listing._id] ?? String(listing.availableQuantity)}
                      onChange={(event) => setQuantities((current) => ({ ...current, [listing._id]: event.target.value }))}
                      className="mt-1 block w-36 rounded-lg border border-forest/15 bg-ivory px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void updateStock(listing)}
                    disabled={saving === listing._id || (quantities[listing._id] ?? String(listing.availableQuantity)) === String(listing.availableQuantity)}
                    className="rounded-lg bg-forest px-3 py-2 text-xs font-semibold text-ivory disabled:opacity-50"
                  >
                    {saving === listing._id ? 'Saving…' : 'Update stock'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(listing)}
                    className="inline-flex items-center gap-1 rounded-lg border border-forest/15 px-3 py-2 text-xs font-semibold text-forest"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  {listing.status !== 'archived' && <button
                    type="button"
                    onClick={() => void archiveListing(listing)}
                    disabled={saving === listing._id}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>}
                  {listing.createdAt && <span className="text-xs text-charcoal/45">{formatDate(listing.createdAt)}</span>}
                </div>
                {listing.imageAssets?.map((image) => <div key={image.publicId} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-forest/10 p-2">
                  <img src={image.url} alt={`${listing.cropName} product`} className="h-14 w-16 rounded object-cover" />
                  <button type="button" onClick={() => void removeImage(listing, image.publicId)} disabled={saving === listing._id} className="text-xs font-medium text-red-700 disabled:opacity-50">Remove image</button>
                </div>)}
              </article>
            ))}
          </div>
        </Panel>
      </div>
    </DashboardShell>
  );
}

export function FarmerOrdersPage() {
  const { session } = useAuth();
  const data = useDashboardData<{ orders: MarketplaceOrder[] }>('/orders/farmer');
  const [error, setError] = useState('');
  const [busyOrder, setBusyOrder] = useState('');
  const orders = data.data?.orders ?? [];
  const next: Record<string, string> = {
    confirmed: 'accepted',
    accepted: 'preparing',
    preparing: 'ready_for_pickup',
  };

  async function advance(order: MarketplaceOrder) {
    if (!session || !next[order.status]) return;
    setBusyOrder(order._id);
    setError('');
    try {
      const status = next[order.status];
      await request(`/orders/${order._id}/status`, {
        method: 'PATCH',
        token: session.token,
        body: JSON.stringify({ status, note: `Farmer updated order to ${status.replace(/_/g, ' ')}` }),
      });
      await data.reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update order status.');
    } finally {
      setBusyOrder('');
    }
  }

  return (
    <DashboardShell role="farmer" title="Farmer orders" subtitle="Track buyer orders and update preparation progress.">
      <Panel title="Order history">
        <StateMessage loading={data.loading} error={data.error} empty={!data.loading && !data.error && orders.length === 0} />
        {error && <p className="mb-3 text-sm text-red-700" role="alert">{error}</p>}
        <OrderList orders={orders}>{(order) => next[order.status] ? (
          <button type="button" disabled={busyOrder === order._id} onClick={() => void advance(order)} className="rounded-lg bg-agri-emerald px-3 py-2 text-xs font-semibold text-forest disabled:opacity-50">
            {busyOrder === order._id ? 'Updating…' : order.status === 'confirmed' ? 'Accept order' : order.status === 'accepted' ? 'Start preparing' : 'Ready for pickup'}
          </button>
        ) : order.logistics?.partnerName ? <span className="text-xs text-charcoal/55">Delivery: {order.logistics.partnerName}</span> : null}</OrderList>
      </Panel>
    </DashboardShell>
  );
}

export function FarmerPayoutsPage() {
  const data = useDashboardData<{ summary: FarmerPayoutSummary; ledgers: FarmerPayoutLedger[] }>('/payouts/my-ledger');
  const summary = data.data?.summary;
  const ledgers = data.data?.ledgers ?? [];
  return (
    <DashboardShell role="farmer" title="Payouts" subtitle="Review accrued earnings, settlements, and payout history.">
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Gross sales" value={formatCurrency((summary?.totalGrossPaise ?? 0) / 100)} />
        <StatCard label="Your share" value={formatCurrency((summary?.totalFarmerSharePaise ?? 0) / 100)} tone="emerald" />
        <StatCard label="Settled" value={formatCurrency((summary?.totalSettledPaise ?? 0) / 100)} tone="soil" />
        <StatCard label="Pending / processing" value={formatCurrency((summary?.pendingSettlementPaise ?? 0) / 100)} />
      </div>
      <Panel title="Payout history">
        <StateMessage loading={data.loading} error={data.error} empty={!data.loading && !data.error && ledgers.length === 0} />
        {ledgers.map((ledger) => (
          <div key={ledger._id} className="flex flex-col gap-2 border-b border-forest/10 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-medium text-forest">Order {ledger.orderNumber}</p><p className="text-xs capitalize text-charcoal/55">{ledger.settlementStatus.replace(/_/g, ' ')} · {formatDate(ledger.settledAt ?? ledger.createdAt)}</p>{ledger.transactionReference && <p className="text-xs text-charcoal/45">Reference: {ledger.transactionReference}</p>}</div>
            <span className="font-semibold text-forest">{formatCurrency(ledger.farmerPayoutPaise / 100)}</span>
          </div>
        ))}
      </Panel>
    </DashboardShell>
  );
}

export function FarmerInsightsPage() {
  const { session } = useAuth();
  const listingsData = useDashboardData<{ listings: Listing[] }>('/crops/my-crops');
  const ordersData = useDashboardData<{ orders: MarketplaceOrder[] }>('/orders/farmer');
  const listings = listingsData.data?.listings ?? [];
  const orders = ordersData.data?.orders ?? [];
  const sales = orders.flatMap((order) => order.items
    .filter((item) => item.farmerId === session?.user.id)
    .map((item) => ({ order, item })));
  const soldQuantity = sales.reduce((total, row) => total + row.item.quantity, 0);
  const grossSalesPaise = sales.reduce((total, row) => total + (row.item.totalPaise ?? 0), 0);
  const totalViews = listings.reduce((total, listing) => total + (listing.viewsCount ?? 0), 0);
  const loading = listingsData.loading || ordersData.loading;
  const error = listingsData.error || ordersData.error;
  return (
    <DashboardShell role="farmer" title="Farm insights" subtitle="Performance from your own listings and orders.">
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Product listings" value={listings.length} tone="emerald" />
        <StatCard label="Product views" value={totalViews} />
        <StatCard label="Units sold" value={soldQuantity} tone="soil" />
        <StatCard label="Gross sales" value={formatCurrency(grossSalesPaise / 100)} />
      </div>
      <Panel title="Product performance">
        <StateMessage loading={loading} error={error} empty={!loading && !error && listings.length === 0} />
        {listings.map((listing) => {
          const productSales = sales.filter((row) => row.item.listingId === listing._id);
          const quantity = productSales.reduce((total, row) => total + row.item.quantity, 0);
          return <div key={listing._id} className="flex flex-wrap items-center justify-between gap-2 border-b border-forest/10 py-3 text-sm"><span className="font-medium text-forest">{listing.cropName}</span><span className="text-charcoal/55">{listing.viewsCount ?? 0} views · {quantity} sold · {listing.availableQuantity} in stock</span></div>;
        })}
      </Panel>
      <div className="mt-6"><Panel title="Recent order history"><StateMessage loading={ordersData.loading} error={ordersData.error} empty={!ordersData.loading && !ordersData.error && orders.length === 0} /><OrderList orders={orders} /></Panel></div>
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
  async function complete(order: MarketplaceOrder) {
    if (!session) return;
    const confirmation = window.prompt('Enter recipient name as delivery confirmation:');
    if (!confirmation?.trim()) return;
    const isCodPaymentDue = order.payment?.gateway === 'cod_verified' && order.payment.status !== 'captured';
    if (isCodPaymentDue && !window.confirm(
      `Confirm that ₹${(order.pricing.finalPayablePaise / 100).toFixed(2)} cash has been collected from the recipient.`
    )) return;
    setActionError('');
    try {
      await request(`/logistics/complete/${order._id}`, {
        method: 'POST',
        token: session.token,
        body: JSON.stringify({ recipientSignature: confirmation.trim(), ...(isCodPaymentDue ? { cashCollected: true } : {}) }),
      });
      await data.reload();
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Could not complete delivery.'); }
  }
  async function dispatch(orderId: string) {
    if (!session) return;
    setActionError('');
    try {
      await request(`/orders/${orderId}/status`, {
        method: 'PATCH',
        token: session.token,
        body: JSON.stringify({ status: 'out_for_delivery', note: 'Delivery partner dispatched to buyer' }),
      });
      await data.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update delivery status.');
    }
  }
  return <DashboardShell role="logistics" title="Delivery operations" subtitle="Track assigned orders and confirm handoff to the buyer."><div className="mb-6 grid grid-cols-2 gap-4"><StatCard label="Assigned deliveries" value={orders.length} tone="emerald" /><StatCard label="In progress" value={orders.filter((order) => ['picked_up', 'out_for_delivery'].includes(order.status)).length} /></div><Panel title="Dispatch queue"><StateMessage loading={data.loading} error={data.error} empty={!data.loading && !data.error && orders.length === 0} />{actionError && <p className="mb-3 text-sm text-red-700" role="alert">{actionError}</p>}<OrderList orders={orders}>{(order) => order.status === 'ready_for_pickup' ? <button onClick={() => void claim(order._id)} className="rounded-lg bg-forest px-3 py-2 text-xs font-semibold text-ivory">Confirm pickup</button> : order.status === 'picked_up' ? <button onClick={() => void dispatch(order._id)} className="rounded-lg bg-agri-emerald px-3 py-2 text-xs font-semibold text-forest">Out for delivery</button> : order.status === 'out_for_delivery' ? <button onClick={() => void complete(order)} className="rounded-lg bg-agri-emerald px-3 py-2 text-xs font-semibold text-forest">Mark delivered</button> : null}</OrderList></Panel></DashboardShell>;
}

export function AdminDashboard() {
  const analytics = useDashboardData<{ analytics: Analytics }>('/admin/analytics');
  const orderData = useDashboardData<{ orders: MarketplaceOrder[] }>('/admin/orders');
  const agentData = useDashboardData<{ users: LogisticsAgent[] }>('/admin/users?role=logistics&status=active');
  const customerData = useDashboardData<{ users: CustomerAccount[] }>('/admin/users?role=buyer&status=active');
  const roleRequestData = useDashboardData<{ users: CustomerAccount[] }>('/admin/users?requestedRole=requested&status=pending_verification');
  const farmerData = useDashboardData<{ users: CustomerAccount[] }>('/admin/users?role=farmer&status=active');
  const { session } = useAuth();
  const [selectedAgent, setSelectedAgent] = useState('');
  const [assignmentError, setAssignmentError] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [approvedRole, setApprovedRole] = useState('farmer');
  const [farm, setFarm] = useState({ farmName: '', village: '', district: '', state: '', pinCode: '' });
  const [approvalError, setApprovalError] = useState('');
  const [accountError, setAccountError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [updatingOrder, setUpdatingOrder] = useState('');
  const metrics = analytics.data?.analytics;
  const adminNextStatus: Record<string, string> = {
    confirmed: 'accepted',
    accepted: 'preparing',
    preparing: 'ready_for_pickup',
  };
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
  async function updateStatus(order: MarketplaceOrder) {
    if (!session || !adminNextStatus[order.status]) return;
    const status = adminNextStatus[order.status];
    setUpdatingOrder(order._id);
    setStatusError('');
    try {
      await request(`/orders/${order._id}/status`, {
        method: 'PATCH',
        token: session.token,
        body: JSON.stringify({ status, note: `Administrator updated order to ${status.replace(/_/g, ' ')}` }),
      });
      await Promise.all([orderData.reload(), analytics.reload()]);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Could not update order status.');
    } finally {
      setUpdatingOrder('');
    }
  }
  async function setFarmerVerification(user: CustomerAccount) {
    if (!session) return;
    setAccountError('');
    try {
      await request(`/admin/users/${user._id}/verify`, {
        method: 'PATCH',
        token: session.token,
        body: JSON.stringify({ status: user.isVerified ? 'pending' : 'verified' }),
      });
      await Promise.all([farmerData.reload(), analytics.reload()]);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Could not update farmer verification.');
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
      await Promise.all([customerData.reload(), roleRequestData.reload(), analytics.reload()]);
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : 'Could not approve account role.');
    }
  }
  const orders = orderData.data?.orders ?? [];
  const agents = agentData.data?.users ?? [];
  return (
    <DashboardShell role="admin" title="Operations control" subtitle="Live platform totals from the application database.">
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Users" value={metrics?.totalUsers ?? '—'} />
        <StatCard label="Farmers" value={metrics?.totalFarmers ?? '—'} tone="emerald" />
        <StatCard label="Verified farmers" value={metrics?.verifiedFarmers ?? '—'} />
        <StatCard label="Active listings" value={metrics?.totalListings ?? '—'} />
        <StatCard label="Orders" value={metrics?.totalOrders ?? '—'} />
        <StatCard label="Delivered" value={metrics?.deliveredOrdersCount ?? '—'} />
      </div>
      <Panel title="Financial overview">
        <StateMessage loading={analytics.loading} error={analytics.error} empty={!analytics.loading && !analytics.error && !metrics} />
        {metrics && <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="GMV" value={formatCurrency(metrics.financials.gmvPaise / 100)} />
          <StatCard label="Platform commission" value={formatCurrency(metrics.financials.platformRevenuePaise / 100)} tone="emerald" />
          <StatCard label="Seller payouts accrued" value={formatCurrency(metrics.financials.farmerPayoutsPaise / 100)} tone="soil" />
        </div>}
      </Panel>
      <div className="mt-6">
        <Panel title="Approve account access">
          <form onSubmit={approveRole} className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-charcoal/65">Customer account
              <select required value={selectedCustomer} onChange={(event) => setSelectedCustomer(event.target.value)} className="mt-1 w-full rounded-lg border border-forest/15 bg-ivory px-3 py-2 text-sm">
                <option value="">Select customer</option>
                {[...(customerData.data?.users ?? []), ...(roleRequestData.data?.users ?? [])]
                  .filter((user, index, users) => users.findIndex((candidate) => candidate._id === user._id) === index)
                  .map((user) => <option key={user._id} value={user._id}>{user.name} · {user.email}{user.requestedRole ? ` · requested ${user.requestedRole}` : ''}</option>)}
              </select>
            </label>
            <label className="text-xs text-charcoal/65">Approved capability
              <select value={approvedRole} onChange={(event) => setApprovedRole(event.target.value)} className="mt-1 w-full rounded-lg border border-forest/15 bg-ivory px-3 py-2 text-sm">
                <option value="farmer">Farmer / FPO</option><option value="business">Business buyer</option><option value="logistics">Delivery partner</option>
              </select>
            </label>
            {approvedRole === 'farmer' && (Object.keys(farm) as Array<keyof typeof farm>).map((field) => (
              <label key={field} className="text-xs capitalize text-charcoal/65">{field}
                <input required value={farm[field]} onChange={(event) => setFarm((current) => ({ ...current, [field]: event.target.value }))} className="mt-1 w-full rounded-lg border border-forest/15 bg-ivory px-3 py-2 text-sm" />
              </label>
            ))}
            {approvalError && <p className="text-sm text-red-700 sm:col-span-2" role="alert">{approvalError}</p>}
            <button disabled={!selectedCustomer} className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-ivory disabled:opacity-40">Approve account</button>
          </form>
        </Panel>
      </div>
      <div className="mt-6">
        <Panel title="Pending role applications">
          <StateMessage loading={roleRequestData.loading} error={roleRequestData.error} empty={!roleRequestData.loading && !roleRequestData.error && !(roleRequestData.data?.users.length)} />
          {(roleRequestData.data?.users ?? []).map((applicant) => (
            <div key={applicant._id} className="flex flex-wrap items-center justify-between gap-2 border-b border-forest/10 py-3 text-sm">
              <span className="min-w-0 text-forest">{applicant.name} <span className="text-xs text-charcoal/55">{applicant.email} · requested {applicant.requestedRole ?? 'role'}</span></span>
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(applicant._id);
                  if (applicant.requestedRole) setApprovedRole(applicant.requestedRole);
                  setFarm(applicant.requestedFarm ?? { farmName: '', village: '', district: '', state: '', pinCode: '' });
                }}
                className="rounded-lg border border-forest/15 px-3 py-1.5 text-xs font-medium text-forest"
              >
                Review application
              </button>
            </div>
          ))}
        </Panel>
      </div>
      <div className="mt-6">
        <Panel title="Farmer and buyer accounts">
          <StateMessage
            loading={farmerData.loading || customerData.loading}
            error={farmerData.error || customerData.error}
            empty={!farmerData.loading && !customerData.loading && !farmerData.error && !customerData.error && !(farmerData.data?.users.length || customerData.data?.users.length)}
          />
          {accountError && <p className="mb-3 text-sm text-red-700" role="alert">{accountError}</p>}
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-forest">Farmers ({farmerData.data?.users.length ?? 0})</h3>
              {(farmerData.data?.users ?? []).map((farmer) => (
                <div key={farmer._id} className="flex items-center justify-between gap-3 border-b border-forest/10 py-3 text-sm">
                  <span className="min-w-0 truncate text-forest">{farmer.name} <span className="text-xs text-charcoal/55">{farmer.email}</span></span>
                  <button type="button" onClick={() => void setFarmerVerification(farmer)} className="shrink-0 rounded-lg border border-forest/15 px-3 py-1.5 text-xs font-medium text-forest">
                    {farmer.isVerified ? 'Verified · Revoke' : 'Verify farmer'}
                  </button>
                </div>
              ))}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-forest">Buyers ({customerData.data?.users.length ?? 0})</h3>
              {(customerData.data?.users ?? []).map((buyer) => (
                <div key={buyer._id} className="flex flex-wrap items-center justify-between gap-2 border-b border-forest/10 py-3 text-sm">
                  <span className="min-w-0 truncate text-forest">{buyer.name} <span className="text-xs text-charcoal/55">{buyer.email}</span></span>
                  <span className="text-xs capitalize text-charcoal/55">{buyer.status ?? 'active'}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>
      <div className="mt-6">
        <Panel title="Live order control">
          <StateMessage loading={orderData.loading} error={orderData.error} empty={!orderData.loading && !orderData.error && orders.length === 0} />
          {assignmentError && <p className="mb-3 text-sm text-red-700" role="alert">{assignmentError}</p>}
          {statusError && <p className="mb-3 text-sm text-red-700" role="alert">{statusError}</p>}
          <OrderList orders={orders}>{(order) => (
            <div className="flex flex-wrap items-center gap-2">
              {['confirmed', 'accepted', 'preparing', 'ready_for_pickup'].includes(order.status) && (
                <>
                  <select aria-label={`Delivery agent for ${order.orderNumber}`} value={selectedAgent} onChange={(event) => setSelectedAgent(event.target.value)} className="max-w-36 rounded-lg border border-forest/15 px-2 py-1 text-xs">
                    <option value="">Select driver</option>{agents.map((agent) => <option key={agent._id} value={agent._id}>{agent.name}</option>)}
                  </select>
                  <button type="button" onClick={() => void assign(order._id)} disabled={!selectedAgent} className="rounded-lg bg-forest px-3 py-2 text-xs font-semibold text-ivory disabled:opacity-40">{order.logistics?.assignedPartnerId ? 'Reassign' : 'Assign'}</button>
                </>
              )}
              {order.logistics?.partnerName && <span className="text-xs text-charcoal/55">Driver: {order.logistics.partnerName}</span>}
              {adminNextStatus[order.status] && (
                <button type="button" disabled={updatingOrder === order._id} onClick={() => void updateStatus(order)} className="rounded-lg bg-agri-emerald px-3 py-2 text-xs font-semibold text-forest disabled:opacity-50">
                  {updatingOrder === order._id ? 'Updating…' : `Mark ${adminNextStatus[order.status].replace(/_/g, ' ')}`}
                </button>
              )}
            </div>
          )}</OrderList>
        </Panel>
      </div>
    </DashboardShell>
  );
}
