import { useState, useEffect } from 'react';
import { IndianRupee, TrendingUp, Package, BarChart2, ShoppingCart } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { PAGE_SIZE } from '../../common/utils';
import { dashboardApi } from '../../api/dashboardApi';

export default function Sales() {
  const [period, setPeriod] = useState('1month');
  const [report, setReport] = useState({
    period: '1month',
    totalRevenue: 0,
    grossProfit: 0,
    profitMargin: 0,
    totalOrders: 0,
    todaysOrders: 0,
    todaysRevenue: 0,
    productSales: []
  });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        const offset = now.getTimezoneOffset();

        const data = await dashboardApi.getSalesReport(period, dateStr, offset);
        if (data) {
          setReport(data);
          setPage(1);
        }
      } catch (err) {
        console.error('Failed to load sales report:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [period]);

  const productSales = report.productSales || [];

  // Pagination for Product Sales
  const totalPages = Math.max(1, Math.ceil(productSales.length / PAGE_SIZE));
  const pagedSales = productSales.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const periodLabel = period === 'today' ? 'Today' : period === '1week' ? '1 Week' : period === 'all' ? 'All Time' : '1 Month';
  const periodSub = period === 'today' ? 'today' : period === '1week' ? 'this week' : period === 'all' ? 'all time' : 'this month';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Report"
        subtitle="Track revenue, orders, and product performance."
      />

      {/* Period Filter Bar — Clean border, no shadow */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 text-sm">Report Period</span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {periodLabel}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {period === 'today' && "Showing sales and fulfillment metrics for today."}
            {period === '1week' && "Showing aggregated metrics for the past 7 days."}
            {period === '1month' && "Showing aggregated metrics for the past 30 days."}
            {period === 'all' && "Showing all-time recorded sales performance."}
          </p>
        </div>

        <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 shrink-0 self-start sm:self-auto">
          {[
            { id: 'today', label: 'Today' },
            { id: '1week', label: '1 Week' },
            { id: '1month', label: '1 Month' },
            { id: 'all', label: 'All Time' },
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

      {/* Stat Cards — horizontal icon+text */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={IndianRupee}
          iconBg="bg-slate-100"
          iconColor="text-slate-600"
          label={period === 'all' ? "Total Revenue" : `Revenue (${periodLabel})`}
          value={`₹ ${Number(report.totalRevenue || 0).toLocaleString()}`}
        />
        <StatCard
          icon={TrendingUp}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          label="Gross Profit"
          value={`₹ ${Number(report.grossProfit || 0).toLocaleString()}`}
          subtitle={`${Number(report.profitMargin || 0).toFixed(1)}% margin`}
        />
        <StatCard
          icon={ShoppingCart}
          iconBg="bg-slate-100"
          iconColor="text-slate-600"
          label={period === 'all' ? "Total Orders" : `Orders (${periodLabel})`}
          value={report.totalOrders || 0}
        />
        <StatCard
          icon={Package}
          iconBg="bg-slate-100"
          iconColor="text-slate-600"
          label="Today's Orders"
          value={report.todaysOrders || 0}
          subtitle={`₹ ${Number(report.todaysRevenue || 0).toLocaleString()} today`}
        />
      </div>

      {/* Product Sales Table */}
      <Card>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50/50">
          <div className="w-8 h-8 bg-white border border-slate-200 text-slate-500 rounded-lg flex items-center justify-center">
            <BarChart2 size={16} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Product Sales Performance</h3>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">Ranked by quantity sold ({periodSub})</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center w-12">#</TableHead>
                <TableHead className="text-left">Product Name</TableHead>
                <TableHead className="text-center">Qty Sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">COGS</TableHead>
                <TableHead className="text-right">Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedSales.map((ps, index) => (
                <TableRow key={ps.productId || index}>
                  <TableCell className="text-center font-semibold text-slate-500">
                    {(page - 1) * PAGE_SIZE + index + 1}
                  </TableCell>
                  <TableCell className="font-bold text-slate-900">{ps.productName}</TableCell>
                  <TableCell className="text-center font-medium">{ps.qtySold} units</TableCell>
                  <TableCell className="text-right font-medium">₹ {Number(ps.revenue || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-slate-500">₹ {Number(ps.cogs || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold text-emerald-600">₹ {Number(ps.profit || 0).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {productSales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-slate-400 font-medium">
                    {loading ? "Loading product sales data..." : "No product sales data available for this period."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={productSales.length}
          itemsPerPage={PAGE_SIZE}
        />
      </Card>

    </div>
  );
}

function StatCard({ icon: Icon, iconBg, iconColor, label, value, subtitle }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-slate-200 ${iconBg}`}>
        <Icon size={18} strokeWidth={2.5} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate">{label}</p>
        <div className="flex items-end gap-2">
          <p className="text-xl font-black text-slate-900 leading-tight">{value}</p>
          {subtitle && <p className="text-[10px] font-bold text-emerald-600 mb-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
