import { useState, useEffect, useRef } from 'react';
import { Truck, Phone, Mail, ChevronLeft, Package, IndianRupee, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import PageHeader from '../../components/common/PageHeader';
import { Tooltip } from '../../components/ui/Tooltip';
import { Pagination } from '../../components/ui/Pagination';
import { Dropdown } from '../../components/common/Dropdown';
import DateRangePicker from '../../components/common/DateRangePicker';
import { formatDateTime, formatFilterDateToUTC, PAGE_SIZE } from '../../common/utils';
import { purchaseApi } from '../../api/purchaseApi';

const statusBadge = (status) => {
  const map = { PAID: 'text-emerald-600', UNPAID: 'text-red-600', PARTIAL: 'text-amber-600' };
  const s = (status || '').toUpperCase();
  return <span className={`font-bold uppercase ${map[s] || 'text-slate-600'}`}>{s}</span>;
};

const PurchaseRow = ({ purchase, statusBadge }) => {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleExpand = async () => {
    setExpanded(!expanded);
    if (!expanded && items.length === 0) {
      try {
        setLoading(true);
        const res = await purchaseApi.getPurchaseItems(purchase.edid || purchase.id);
        if (res) {
          setItems(res.items || res.data?.items || res.data || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <>
      <tr className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={handleExpand}>
        <td className="px-5 py-4 font-bold text-slate-900 text-sm">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
            {purchase.publicId || ('#' + (purchase.edid || purchase.id).substring(0, 8))}
          </div>
        </td>
        <td className="px-5 py-4 font-medium text-slate-700 text-sm text-left">
          {formatDateTime(purchase.date).split(' ').slice(0, 3).join(' ')}
        </td>
        <td className="px-5 py-4 font-bold text-slate-700 text-sm text-right">₹{parseFloat(purchase.totalAmount || 0).toLocaleString()}</td>
        <td className="px-5 py-4 font-bold text-emerald-600 text-sm text-right">₹{parseFloat(purchase.paidAmount || 0).toLocaleString()}</td>
        <td className="px-5 py-4 font-bold text-red-500 text-sm text-right">₹{parseFloat(purchase.balance || 0).toLocaleString()}</td>
        <td className="px-5 py-4 font-medium text-slate-700 text-sm text-center">
          {statusBadge(purchase.status)}
        </td>
        <td className="px-5 py-4 text-center">
          <Tooltip content="View Full Details">
            <button
              className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                window.open(`/purchases/${purchase.edid || purchase.id}`, '_blank');
              }}
            >
              <Eye size={18} />
            </button>
          </Tooltip>
        </td>
      </tr>
      <tr>
        <td colSpan="7" className="p-0 border-0">
          <div className={`grid transition-all duration-300 ease-in-out ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden">
              <div className="bg-slate-50/30 px-8 py-4 border-b border-slate-200">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-slate-700 text-sm">Purchased Items</h4>
                </div>
                {loading ? (
                  <div className="text-center text-slate-500 text-sm py-4">Loading items...</div>
                ) : items.length > 0 ? (
                  <table className="w-full text-sm text-left border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-100">
                      <tr className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                        <th className="px-4 py-2">Item Name</th>
                        <th className="px-4 py-2">Batch Number</th>
                        <th className="px-4 py-2">Quantity</th>
                        <th className="px-4 py-2">Price</th>
                        <th className="px-4 py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 font-medium text-slate-700">{item.materialName}</td>
                          <td className="px-4 py-2 text-slate-600">{item.batchNumber || '-'}</td>
                          <td className="px-4 py-2 text-slate-600">{item.qty} {item.unitSymbol || ''}</td>
                          <td className="px-4 py-2 text-slate-600">₹{parseFloat(item.rate || 0).toLocaleString()}</td>
                          <td className="px-4 py-2 font-bold text-slate-700">₹{parseFloat(item.total || (item.qty * item.rate) || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center text-slate-500 text-sm py-4">No items found for this purchase.</div>
                )}
              </div>
            </div>
          </div>
        </td>
      </tr>
    </>
  );
};

export default function SupplierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [supplier, setSupplier] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const [tabs, setTabs] = useState(['All']);

  useEffect(() => {
    purchaseApi.getTypes('PurchaseStatus').then(data => {
      if (data?.items) {
        setTabs(['All', ...data.items]);
      }
    }).catch(e => console.error("Error fetching purchase statuses:", e));
  }, []);
  const activePurchasesReqId = useRef(0);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Reset page to 1 whenever filters change, without touching filters when page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, dateRange.startDate, dateRange.endDate, statusFilter]);

  useEffect(() => {
    const fetchSupplierData = async () => {
      try {
        setLoading(true);
        const supplierRes = await purchaseApi.getSupplierById(id);
        if (supplierRes) {
          setSupplier(supplierRes);
        }
      } catch (err) {
        console.error("Error fetching supplier details:", err);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchSupplierData();
  }, [id]);

  useEffect(() => {
    const reqId = ++activePurchasesReqId.current;
    const fetchPurchasesData = async () => {
      try {
        const fromDate = formatFilterDateToUTC(dateRange.startDate, false);
        const toDate = formatFilterDateToUTC(dateRange.endDate, true);
        const formattedSearchTerm = debouncedSearchTerm ? (debouncedSearchTerm.toUpperCase().startsWith('PUR-') ? debouncedSearchTerm : `PUR-${debouncedSearchTerm}`) : null;
        const paymentStatus = statusFilter !== 'All' ? statusFilter : null;
        const purchaseRes = await purchaseApi.getPurchasesBySupplier(id, currentPage, PAGE_SIZE, fromDate, toDate, formattedSearchTerm, paymentStatus);
        if (reqId !== activePurchasesReqId.current) return;
        if (purchaseRes) {
          const newItems = purchaseRes.items || purchaseRes.data?.items || [];
          const newTotal = purchaseRes.totalCount || purchaseRes.data?.totalCount || newItems.length;

          setPurchases(prev => {
            if (JSON.stringify(prev) === JSON.stringify(newItems)) return prev;
            return newItems;
          });
          setTotalItems(prev => prev === newTotal ? prev : newTotal);
        }
      } catch (err) {
        console.error("Error fetching purchases:", err);
      }
    };
    if (id) fetchPurchasesData();
  }, [id, currentPage, dateRange.startDate, dateRange.endDate, debouncedSearchTerm, statusFilter]);

  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;

  const filteredPurchases = purchases;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-6rem)] space-y-4">
        <Truck size={48} className="text-slate-200 animate-pulse" />
        <h2 className="text-xl font-bold text-slate-400">Loading Supplier...</h2>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-6rem)] space-y-4">
        <Truck size={48} className="text-slate-300" />
        <h2 className="text-xl font-bold text-slate-900">Supplier Not Found</h2>
        <Button onClick={() => navigate('/purchases')}>Back to Suppliers</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <PageHeader
        title={
          <div className="flex items-center gap-3">
            Supplier Details
          </div>
        }
        subtitle="Manage your supplier database and purchase history"
      />

      <div className="flex gap-6 items-start">

        {/* Left Column: Stats, Info */}
        <div className="w-[380px] flex flex-col gap-6 shrink-0">

          {/* Supplier Profile Card */}
          <Card className="p-3 bg-transparent border-none shadow-none">
            <div className="overflow-hidden bg-white border border-slate-200 rounded-2xl">

              {/* Supplier Profile */}
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">

                    {/* Avatar */}
                    <div className="flex items-center justify-center w-16 h-16 text-2xl font-bold text-indigo-600 rounded-full bg-indigo-50 ring-4 ring-indigo-50/60">
                      {supplier.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Supplier Details */}
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {supplier.name}
                      </h3>

                      <div className="mt-2 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                          <Phone size={13} className="text-slate-400" />
                          <span>{supplier.mobile || 'No mobile provided'}</span>
                        </div>

                        {supplier.contactName && (
                          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                            <Mail size={13} className="text-slate-400" />
                            <span>{supplier.contactName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Back */}
                  <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="flex items-center justify-center w-8 h-8 transition-colors rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                  >
                    <ChevronLeft size={18} />
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="mx-5 border-t border-slate-100" />

              {/* Statistics */}
              <div className="p-5 space-y-3">

                {/* Total Purchases */}
                <div className="flex items-center justify-between p-4 transition-all bg-white border border-slate-200 group rounded-xl hover:border-indigo-200 hover:bg-indigo-50/20">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center text-indigo-600 w-11 h-11 rounded-xl bg-indigo-50">
                      <Package size={19} strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                        Total Purchases
                      </p>
                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {totalItems}
                      </p>
                    </div>
                  </div>
                  <ChevronLeft
                    size={16}
                    className="transition-colors rotate-180 text-slate-300 group-hover:text-indigo-400"
                  />
                </div>

                {/* Total Volume */}
                <div className="flex items-center justify-between p-4 transition-all bg-white border border-slate-200 group rounded-xl hover:border-emerald-200 hover:bg-emerald-50/20">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center text-emerald-600 w-11 h-11 rounded-xl bg-emerald-50">
                      <IndianRupee size={19} strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                        Total Volume
                      </p>
                      <p className="mt-1 text-xl font-bold text-slate-900">
                        ₹ {purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <ChevronLeft
                    size={16}
                    className="transition-colors rotate-180 text-slate-300 group-hover:text-emerald-400"
                  />
                </div>

                {/* Current Balance */}
                <div
                  className={`group border rounded-xl p-4 flex items-center justify-between bg-white transition-all ${supplier.balance > 0
                      ? 'border-red-100 hover:border-red-200 hover:bg-red-50/20'
                      : 'border-emerald-100 hover:border-emerald-200 hover:bg-emerald-50/20'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center ${supplier.balance > 0
                          ? 'bg-red-50 text-red-500'
                          : 'bg-emerald-50 text-emerald-600'
                        }`}
                    >
                      <IndianRupee size={19} strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                        Current Balance
                      </p>
                      <p
                        className={`mt-1 text-xl font-bold ${supplier.balance > 0 ? 'text-red-600' : 'text-emerald-600'
                          }`}
                      >
                        ₹ {supplier.balance?.toLocaleString() || '0'}
                      </p>
                    </div>
                  </div>
                  <ChevronLeft
                    size={16}
                    className={`rotate-180 transition-colors ${supplier.balance > 0
                        ? 'text-red-200 group-hover:text-red-400'
                        : 'text-emerald-200 group-hover:text-emerald-400'
                      }`}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Purchase History & Stats */}
        <div className="flex-1 flex flex-col gap-6 min-w-0">
          <div className="flex-1 bg-white border border-slate-200 rounded-2xl flex flex-col">
            <CardHeader className="flex-col !items-stretch gap-4 border-none pb-0">
              <CardTitle className="text-lg">Purchase History</CardTitle>
              <div className="flex flex-wrap items-center gap-3 pb-3">
                <div className="relative bg-white border border-slate-200 rounded-lg overflow-hidden h-10 w-[140px] flex items-center">
                  <span className="pl-3 pr-1 text-slate-400 font-semibold text-sm shrink-0">PUR-</span>
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="1001"
                    className="w-full h-full px-1 outline-none text-sm font-semibold text-slate-900 placeholder:text-slate-400"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                    }}
                  />
                </div>
                <Dropdown
                  value={statusFilter}
                  onChange={(val) => setStatusFilter(val)}
                  options={tabs}
                  className="w-[160px]"
                />
                <DateRangePicker
                  startDate={dateRange.startDate}
                  endDate={dateRange.endDate}
                  onChange={(range) => setDateRange(range)}
                  className="w-[280px]"
                />
              </div>
            </CardHeader>
            <div className="flex flex-col flex-1 overflow-hidden rounded-b-2xl">
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-5 py-3.5 w-[200px]">Purchase ID</th>
                      <th className="text-left px-5 py-3.5">Date</th>
                      <th className="text-right px-5 py-3.5">Total Amount</th>
                      <th className="text-right px-5 py-3.5">Paid Amount</th>
                      <th className="text-right px-5 py-3.5">Balance</th>
                      <th className="text-center px-5 py-3.5 ">Status</th>
                      <th className="text-center px-5 py-3.5 ">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredPurchases.map(purchase => (
                      <PurchaseRow key={purchase.id || purchase.edid} purchase={purchase} statusBadge={statusBadge} />
                    ))}
                    {filteredPurchases.length === 0 && (
                      <tr>
                        <td colSpan="7" className="px-6 py-4 text-center text-slate-400 font-medium">
                          No previous purchases found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {totalItems > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  totalItems={totalItems}
                  itemsPerPage={PAGE_SIZE}
                />
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
