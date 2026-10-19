import { DashboardShell, StatCard, DataTable, StatusPill } from '@/components/dashboard/DashboardShell';
import { DEMO_FARMER_ORDERS, DEMO_FARMER_PAYOUTS, DEMO_PRODUCTS, DEMO_LOGISTICS_TASKS } from '@/data/demoData';
import { formatCurrency, formatDate } from '@/utils';
import { Sprout, Wallet, ShoppingBag, TrendingUp } from 'lucide-react';

export function FarmerDashboard() {
  return (
    <DashboardShell
      role="farmer"
      title="Farm Overview"
      subtitle="Your listings, orders and payouts at a glance."
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Listings" value={DEMO_PRODUCTS.length} hint="Across categories" tone="emerald" />
        <StatCard label="Incoming Orders" value={DEMO_FARMER_ORDERS.length} hint="2 awaiting action" />
        <StatCard label="Pending Payout" value={formatCurrency(3168)} hint="From 1 order" tone="soil" />
        <StatCard label="Total Stock" value={`${DEMO_PRODUCTS.reduce((s, p) => s + p.stockKg, 0)} kg`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <h2 className="font-display text-lg text-forest mb-4 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-agri-green" /> Recent Orders
          </h2>
          <DataTable
            columns={[
              { key: 'id', label: 'Order' },
              { key: 'buyer', label: 'Buyer' },
              { key: 'amount', label: 'Amount' },
              { key: 'status', label: 'Status' },
            ]}
            rows={DEMO_FARMER_ORDERS.map((o) => ({
              id: <span className="font-mono text-xs">{o.id.slice(-6)}</span>,
              buyer: o.buyerName,
              amount: formatCurrency(o.totalAmount),
              status: <StatusPill status={o.status} />,
            }))}
          />
        </div>
        <div>
          <h2 className="font-display text-lg text-forest mb-4 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-agri-green" /> Payout Ledger
          </h2>
          <DataTable
            columns={[
              { key: 'crop', label: 'Crop' },
              { key: 'amount', label: 'Amount' },
              { key: 'date', label: 'Date' },
              { key: 'status', label: 'Status' },
            ]}
            rows={DEMO_FARMER_PAYOUTS.map((p) => ({
              crop: p.cropName,
              amount: formatCurrency(p.amount),
              date: formatDate(p.date),
              status: <StatusPill status={p.status} />,
            }))}
          />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg text-forest mb-4 flex items-center gap-2">
          <Sprout className="h-5 w-5 text-agri-green" /> Active Listings
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DEMO_PRODUCTS.slice(0, 6).map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-forest/8 p-5">
              <div className="flex items-center justify-between">
                <p className="font-display text-forest">{p.name}</p>
                <span className="text-xs bg-agri-emerald/10 text-agri-emerald px-2 py-0.5 rounded-full">
                  {p.stockKg} {p.unit}
                </span>
              </div>
              <p className="text-sm text-charcoal/55 mt-1">{formatCurrency(p.pricePerUnit)}/{p.unit}</p>
              <p className="text-xs text-charcoal/40 mt-2">Harvested {formatDate(p.harvestDate)}</p>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}

export function BuyerDashboard() {
  return (
    <DashboardShell
      role="buyer"
      title="Procurement Overview"
      subtitle="Your orders, suppliers and invoices."
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Orders" value={2} tone="emerald" />
        <StatCard label="Saved Suppliers" value={5} />
        <StatCard label="This Month" value={formatCurrency(18450)} tone="soil" />
        <StatCard label="Repeat Orders" value={12} hint="Last 90 days" />
      </div>
      <h2 className="font-display text-lg text-forest mb-4">Recent Orders</h2>
      <DataTable
        columns={[
          { key: 'id', label: 'Order' },
          { key: 'farmer', label: 'Farmer' },
          { key: 'items', label: 'Items' },
          { key: 'amount', label: 'Total' },
          { key: 'status', label: 'Status' },
          { key: 'delivery', label: 'Delivery' },
        ]}
        rows={[
          ...DEMO_FARMER_ORDERS.map((o) => ({
            id: <span className="font-mono text-xs">{o.id.slice(-6)}</span>,
            farmer: o.farmerName,
            items: `${o.items.length} item(s)`,
            amount: formatCurrency(o.totalAmount),
            status: <StatusPill status={o.status} />,
            delivery: o.deliveryDate ? formatDate(o.deliveryDate) : '—',
          })),
        ]}
      />
    </DashboardShell>
  );
}

export function LogisticsDashboard() {
  return (
    <DashboardShell
      role="logistics"
      title="Operations Overview"
      subtitle="Pickups and deliveries assigned to your zone."
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Assigned Tasks" value={3} tone="emerald" />
        <StatCard label="In Progress" value={1} />
        <StatCard label="Completed" value={1} />
        <StatCard label="Cargo Today" value={`${240} kg`} tone="soil" />
      </div>
      <h2 className="font-display text-lg text-forest mb-4">Task Assignments</h2>
      <DataTable
        columns={[
          { key: 'id', label: 'Task' },
          { key: 'type', label: 'Type' },
          { key: 'route', label: 'Route' },
          { key: 'cargo', label: 'Cargo' },
          { key: 'scheduled', label: 'Scheduled' },
          { key: 'status', label: 'Status' },
        ]}
        rows={DEMO_LOGISTICS_TASKS.map((t) => ({
          id: <span className="font-mono text-xs">{t.id.slice(-4)}</span>,
          type: <span className="capitalize">{t.type}</span>,
          route: `${t.origin.split(',')[0]} → ${t.destination.split(',')[0]}`,
          cargo: `${t.cargoKg} kg`,
          scheduled: formatDate(t.scheduledAt),
          status: <StatusPill status={t.status} />,
        }))}
      />
    </DashboardShell>
  );
}

export function AdminDashboard() {
  return (
    <DashboardShell
      role="admin"
      title="Platform Overview"
      subtitle="Network health and operational metrics."
    >
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Farmers" value={1284} tone="emerald" />
        <StatCard label="Verified Farmers" value={1042} hint="81% verified" />
        <StatCard label="Active Buyers" value={3180} />
        <StatCard label="Live Listings" value={4920} />
        <StatCard label="Orders This Week" value={612} tone="emerald" />
        <StatCard label="Open Disputes" value={4} tone="soil" />
      </div>
      <h2 className="font-display text-lg text-forest mb-4 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-agri-green" /> Recent Marketplace Orders
      </h2>
      <DataTable
        columns={[
          { key: 'id', label: 'Order' },
          { key: 'buyer', label: 'Buyer' },
          { key: 'farmer', label: 'Farmer' },
          { key: 'amount', label: 'Amount' },
          { key: 'status', label: 'Status' },
        ]}
        rows={DEMO_FARMER_ORDERS.map((o) => ({
          id: <span className="font-mono text-xs">{o.id.slice(-6)}</span>,
          buyer: o.buyerName,
          farmer: o.farmerName,
          amount: formatCurrency(o.totalAmount),
          status: <StatusPill status={o.status} />,
        }))}
      />
    </DashboardShell>
  );
}
