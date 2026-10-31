import { useEffect, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Link, useNavigate } from 'react-router-dom';
import { Package, ShoppingCart, Clock, ArrowRight, Plus, Users, FileText, CheckCircle2, Truck, Box, Eye } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Tooltip } from '../../components/ui/Tooltip';
import { formatDate, formatOrderStatus } from '../../common/utils';
import { dashboardApi } from '../../api/dashboardApi';

export default function Dashboard() {
  const { orders, currentUser, loadOrders } = useStore();
  const [period, setPeriod] = useState('today');
  const [topProducts, setTopProducts] = useState([]);
  const [topProductsLoading, setTopProductsLoading] = useState(true);
  const [topProductsError, setTopProductsError] = useState('');
  const now = new Date();
  const topProductsDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const timezoneOffset = now.getTimezoneOffset();
  const cachedTopProducts = dashboardApi.getCachedTopSellingProducts(period, topProductsDate, timezoneOffset);
  const displayedTopProducts = cachedTopProducts?.items ?? topProducts;
  const [summary, setSummary] = useState({
    periodOrders: 0,
    periodSales: 0,
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    totalOrders: 0,
    totalSales: 0,
  });

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        const offset = now.getTimezoneOffset();

        const data = await dashboardApi.getSummary(period, dateStr, offset);
        if (data) {
          setSummary(data);
        }
      } catch (err) {
        console.error('Failed to load dashboard summary:', err);
      }
    };

    fetchSummary();
  }, [period]);

  useEffect(() => {
    let isCurrentRequest = true;

    const fetchTopProducts = async () => {
      setTopProductsLoading(true);
      setTopProductsError('');
      try {
        const data = await dashboardApi.getTopSellingProducts(period, topProductsDate, timezoneOffset);
        if (isCurrentRequest) {
          setTopProducts(data?.items ?? []);
        }
      } catch (err) {
        console.error('Failed to load top-selling products:', err);
        if (isCurrentRequest) {
          setTopProductsError(err instanceof Error ? err.message : 'Unable to load top-selling products.');
        }
      } finally {
        if (isCurrentRequest) {
          setTopProductsLoading(false);
        }
      }
    };

    fetchTopProducts();
    return () => {
      isCurrentRequest = false;
    };
  }, [period, topProductsDate, timezoneOffset]);

  const navigate = useNavigate();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const periodLabel = period === '1week' ? '1 Week' : period === '1month' ? '1 Month' : 'Today';
  const periodOrderTitle = period === '1week' ? "1 Week's Orders" : period === '1month' ? "1 Month's Orders" : "Today's Orders";
  const periodSub = period === '1week' ? "this week" : period === '1month' ? "this month" : "today";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting}, ${currentUser?.name || 'Admin'}!`}
        subtitle="Here's what's happening with your honey business."
        rightContent={
          <Button icon={Plus} onClick={() => navigate('/new-order')}>
            New Order
          </Button>
        }
      />

      {/* Period Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 text-sm">Order Overview</span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {periodLabel}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {period === 'today' && "Showing real-time metrics for today's orders."}
            {period === '1week' && "Showing aggregated metrics for the past 7 days."}
            {period === '1month' && "Showing aggregated metrics for the past 30 days."}
          </p>
        </div>

        <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 shrink-0 self-start sm:self-auto">
          {[
            { id: 'today', label: 'Today' },
            { id: '1week', label: '1 Week' },
            { id: '1month', label: '1 Month' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriod(item.id)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all ${
                period === item.id
                  ? 'bg-white text-slate-900 border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 border border-transparent'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards — 4-col grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Orders"
          value={summary.totalOrders}
          icon={ShoppingCart}
          iconBg="bg-slate-100"
          iconColor="text-slate-600"
          sub={`₹ ${Number(summary.totalSales || 0).toLocaleString()} total`}
        />
        <StatCard
          title={periodOrderTitle}
          value={summary.periodOrders ?? summary.todaysOrders ?? 0}
          icon={Clock}
          iconBg="bg-slate-100"
          iconColor="text-slate-600"
          sub={`₹ ${Number(summary.periodSales ?? summary.todaysSales ?? 0).toLocaleString()} ${periodSub}`}
        />
        <StatCard
          title="Pending"
          value={summary.pending ?? summary.todaysPending ?? 0}
          icon={Box}
          iconBg="bg-slate-100"
          iconColor="text-slate-600"
          sub={`Need attention (${periodSub})`}
        />
        <StatCard
          title="Delivered"
          value={summary.delivered ?? summary.todaysDelivered ?? 0}
          icon={CheckCircle2}
          iconBg="bg-slate-100"
          iconColor="text-slate-600"
          sub={`Completed (${periodSub})`}
        />
      </div>

      {/* Second row stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Processing"
          value={summary.processing ?? summary.todaysProcessing ?? 0}
          icon={Package}
          iconBg="bg-slate-100"
          iconColor="text-slate-600"
          sub={`Being packed (${periodSub})`}
        />
        <StatCard
          title="Shipped"
          value={summary.shipped ?? summary.todaysShipped ?? 0}
          icon={Truck}
          iconBg="bg-slate-100"
          iconColor="text-slate-600"
          sub={`In transit (${periodSub})`}
        />
        <Card className="col-span-2 lg:col-span-1 flex items-center justify-between p-5 bg-slate-50">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Quick Action</p>
            <p className="font-bold text-slate-900 text-sm">Create a new order</p>
          </div>
          <Button size="icon" onClick={() => navigate('/new-order')}>
            <Plus size={16} strokeWidth={2.5} />
          </Button>
        </Card>
      </div>

      {/* Main content: Table + Quick Actions */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Orders Table */}
        <Card className="xl:col-span-2 flex flex-col">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <Link to="/orders" className="text-slate-600 text-xs font-bold flex items-center gap-1 hover:text-slate-900 transition-colors">
              View All <ArrowRight size={13} />
            </Link>
          </CardHeader>
          <div className="flex-1 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Order No.</TableHead>
                  <TableHead className="text-left">Customer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-left">Date</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.slice(0, 10).map(order => {
                  const customerName = order.recipientName || order.customerName || order.deliveryAddress?.recipientName || 'Customer';
                  const customerPhone = order.customerMobile || order.deliveryAddress?.phone || order.deliveryAddress?.primaryMobile || '';
                  return (
                    <TableRow key={order.edid || order.id}>
                      <TableCell className="font-semibold text-slate-800">{order.orderNumber || '-'}</TableCell>
                      <TableCell>
                        <span>{customerName}</span>
                        {customerPhone && <span className="text-slate-400 text-xs ml-1 font-normal">({customerPhone})</span>}
                      </TableCell>
                      <TableCell className="text-right font-medium">₹{order.totalAmount}</TableCell>
                      <TableCell className="text-center">{formatOrderStatus(order.status)}</TableCell>
                      <TableCell>{order.createdAt ? formatDate(order.createdAt) : '-'}</TableCell>
                      <TableCell className="text-center">
                        <Tooltip content="View Order">
                          <Button
                            variant="ghost"
                            size="icon"
                            icon={Eye}
                            onClick={() => {
                              const orderUrl = order.orderNumber ? `/orders/${order.orderNumber}/${order.edid || order.id}` : `/orders/${order.edid || order.id}`;
                              navigate(orderUrl, { state: { order } });
                            }}
                          />
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan="6" className="py-16 text-center text-slate-400 text-sm font-medium">
                      No orders yet. Create your first order!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Right: Quick Actions + Top Products */}
        <div className="flex flex-col gap-4">
          {/* Quick Actions */}
          <Card>
            <CardContent>
              <CardTitle className="mb-3">Quick Actions</CardTitle>
              <div className="space-y-1.5">
                <QuickAction icon={Plus} title="New Order" desc="Create a customer order" onClick={() => navigate('/new-order')} />
                <QuickAction icon={Users} title="Customers" desc="View and manage customers" onClick={() => navigate('/customers')} />
                <QuickAction icon={Package} title="Products" desc="Manage products" onClick={() => navigate('/products')} />
                <QuickAction icon={FileText} title="All Orders" desc="Track orders" onClick={() => navigate('/orders')} />
              </div>
            </CardContent>
          </Card>

          {/* Top Products */}
          <Card className="flex-1">
            <CardContent>
              <div className="flex justify-between items-center mb-4">
                <CardTitle>Top Selling</CardTitle>
                <Link to="/sales" className="text-slate-600 text-xs font-bold hover:text-slate-900 transition-colors">View All</Link>
              </div>
              <div className="space-y-3">
                {topProductsLoading && !cachedTopProducts ? (
                  <div aria-hidden="true" className="space-y-3 animate-pulse">
                    {[0, 1, 2].map(index => (
                      <div key={index}>
                        {index > 0 && <div className="mb-3 w-full h-px bg-slate-100"></div>}
                        <div className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-slate-100"></div>
                            <div className="space-y-2">
                              <div className="h-3 w-24 rounded bg-slate-200"></div>
                              <div className="h-2 w-14 rounded bg-slate-100"></div>
                            </div>
                          </div>
                          <div className="h-3 w-16 rounded bg-slate-200"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : topProductsError ? (
                  <p role="alert" className="py-4 text-center text-xs font-medium text-rose-600">{topProductsError}</p>
                ) : displayedTopProducts.length > 0 ? (
                  displayedTopProducts.map((product, index) => (
                    <div key={product.productId}>
                      {index > 0 && <div className="w-full h-px bg-slate-100"></div>}
                      <TopProduct
                        name={product.productName}
                        sold={`${Number(product.qtySold || 0).toLocaleString()} sold`}
                        price={`₹ ${Number(product.revenue || 0).toLocaleString('en-IN')}`}
                      />
                    </div>
                  ))
                ) : (
                  <p className="py-4 text-center text-xs font-medium text-slate-500">No product sales for this period.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, iconBg, iconColor, sub }) {
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={20} strokeWidth={2} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">{title}</p>
        <p className="text-2xl font-black text-slate-900 leading-tight">{value}</p>
        {sub && <p className="text-[10px] font-medium text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

function QuickAction({ icon: Icon, title, desc, onClick }) {
  return (
    <div onClick={onClick} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 cursor-pointer transition-all group">
      <div className="w-8 h-8 rounded border border-slate-200 flex items-center justify-center shrink-0 bg-white text-slate-500 group-hover:text-slate-900 group-hover:border-slate-900 transition-colors">
        <Icon size={14} strokeWidth={2.5} />
      </div>
      <div className="min-w-0">
        <h4 className="font-bold text-slate-900 text-xs group-hover:text-slate-900 transition-colors">{title}</h4>
        <p className="text-[10px] font-medium text-slate-500 truncate">{desc}</p>
      </div>
    </div>
  );
}

function TopProduct({ name, sold, price }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-slate-50 border border-slate-200 rounded flex items-center justify-center">
          <img src="/logo.png" alt={name} className="w-5 h-5 object-contain opacity-50 grayscale mix-blend-multiply" />
        </div>
        <div>
          <h4 className="font-bold text-slate-900 text-xs">{name}</h4>
          <p className="text-[10px] font-medium text-slate-500">{sold}</p>
        </div>
      </div>
      <div className="font-bold text-slate-900 text-sm">{price}</div>
    </div>
  );
}
