import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Edit, Trash2, Phone, Mail, Plus, Users, ChevronLeft, Eye, Package, IndianRupee, Loader2, RotateCcw } from 'lucide-react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import PageHeader from '../../components/common/PageHeader';
import { Tooltip } from '../../components/ui/Tooltip';
import { Pagination } from '../../components/ui/Pagination';
import Dropdown from '../../components/common/Dropdown';
import { customerApi } from '../../api/customerApi';
import { commonApi } from '../../api/commonApi';
import { formatDateTime, formatOrderStatus } from '../../common/utils';
import { useStore } from '../../context/StoreContext';

export default function CustomerDetails() {
  const { id, mobile } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { customerOrderFiltersMap, setCustomerOrderFiltersMap } = useStore();

  const effectiveCustEdid = id;

  // Retrieve saved filters for this specific customer from StoreContext or URL searchParams
  const savedFilters = (customerOrderFiltersMap && effectiveCustEdid && customerOrderFiltersMap[effectiveCustEdid]) || {};

  const initialOrderStatus = searchParams.get('orderStatus') || searchParams.get('status') || savedFilters.orderStatus || 'All';
  const initialPaymentStatus = searchParams.get('paymentStatus') || savedFilters.paymentStatus || 'All';
  const initialSearch = searchParams.get('orderNumber') || searchParams.get('search') || savedFilters.searchTerm || '';
  const initialPage = Number(searchParams.get('page') || savedFilters.currentPage || 1);

  // Initial customer from navigation state if available
  const initialCustomer = location.state?.customer || null;
  const initialMobile = mobile || searchParams.get('mobile') || initialCustomer?.mobile || null;

  const [customer, setCustomer] = useState(initialCustomer);
  const [loading, setLoading] = useState(!initialCustomer);
  const [customerAddresses, setCustomerAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [orderHistoryTotalCount, setOrderHistoryTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [orderStatusFilter, setOrderStatusFilter] = useState(initialOrderStatus);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState(initialPaymentStatus);
  const [orderStatusOptions, setOrderStatusOptions] = useState([]);
  const [paymentStatusOptions, setPaymentStatusOptions] = useState([]);
  const itemsPerPage = 10;

  useEffect(() => {
    commonApi.getTypes('OrderStatus').then(res => {
      const items = res?.items || res?.data?.items || (Array.isArray(res) ? res : []);
      if (Array.isArray(items) && items.length > 0) {
        const cleaned = items.filter(s => s && String(s).toLowerCase() !== 'all');
        setOrderStatusOptions(cleaned);
      }
    }).catch(err => {
      console.error('Failed to load OrderStatus types:', err);
    });

    commonApi.getTypes('PaymentStatus').then(res => {
      const items = res?.items || res?.data?.items || (Array.isArray(res) ? res : []);
      if (Array.isArray(items) && items.length > 0) {
        const seen = new Set();
        const unique = [];
        items.forEach(item => {
          if (!item || String(item).toLowerCase() === 'all') return;
          const key = String(item).toUpperCase().replace(/[\s_]+/g, '');
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(item);
          }
        });
        setPaymentStatusOptions(unique);
      }
    }).catch(err => {
      console.error('Failed to load PaymentStatus types:', err);
    });
  }, []);

  // Ref guards to avoid duplicate API calls
  const fetchedCustomerRef = useRef('');
  const activeOrdersFetchRef = useRef('');

  const effectiveCustMobile = initialMobile || customer?.mobile || mobile;

  // Sync active filters & pagination to StoreContext and URL searchParams so they persist across page changes
  useEffect(() => {
    if (!effectiveCustEdid) return;

    if (setCustomerOrderFiltersMap) {
      setCustomerOrderFiltersMap(prev => ({
        ...prev,
        [effectiveCustEdid]: {
          orderStatus: orderStatusFilter,
          paymentStatus: paymentStatusFilter,
          searchTerm: debouncedSearch,
          currentPage
        }
      }));
    }

    const nextParams = new URLSearchParams(searchParams);
    if (orderStatusFilter && orderStatusFilter !== 'All') {
      nextParams.set('orderStatus', orderStatusFilter);
    } else {
      nextParams.delete('orderStatus');
      nextParams.delete('status');
    }

    if (paymentStatusFilter && paymentStatusFilter !== 'All') {
      nextParams.set('paymentStatus', paymentStatusFilter);
    } else {
      nextParams.delete('paymentStatus');
    }

    if (debouncedSearch && debouncedSearch.trim()) {
      nextParams.set('orderNumber', debouncedSearch.trim());
    } else {
      nextParams.delete('orderNumber');
      nextParams.delete('search');
    }

    if (currentPage > 1) {
      nextParams.set('page', String(currentPage));
    } else {
      nextParams.delete('page');
    }

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [effectiveCustEdid, orderStatusFilter, paymentStatusFilter, debouncedSearch, currentPage, setSearchParams]);

  // 1. Fetch Customer Profile & Addresses cleanly in parallel
  useEffect(() => {
    if (!effectiveCustEdid || !effectiveCustMobile) return;
    const fetchKey = `${effectiveCustEdid}_${effectiveCustMobile}`;
    if (fetchedCustomerRef.current === fetchKey) return;
    fetchedCustomerRef.current = fetchKey;

    if (!customer) setLoading(true);
    setLoadingAddresses(true);

    Promise.all([
      customerApi.getCustomer(effectiveCustEdid, effectiveCustMobile).catch(err => {
        console.error('Failed to load customer details:', err);
        return null;
      }),
      customerApi.getAddresses(effectiveCustEdid).catch(err => {
        console.error('Failed to load customer addresses:', err);
        return [];
      })
    ]).then(([custRes, addrRes]) => {
      const custData = custRes?.data || custRes;
      if (custData && (custData.edid || custData.name)) {
        setCustomer(custData);
      }
      const addrs = addrRes?.data?.items || addrRes?.items || (Array.isArray(addrRes) ? addrRes : []);
      setCustomerAddresses(addrs);
    }).finally(() => {
      setLoading(false);
      setLoadingAddresses(false);
    });
  }, [effectiveCustEdid, effectiveCustMobile]);

  // Debounce search input for orders (only triggers when searchTerm is typed and differs)
  useEffect(() => {
    if (searchTerm === debouncedSearch) return;
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, debouncedSearch]);

  // 2. Fetch Customer Order History (Server-side paginated & filtered)
  useEffect(() => {
    if (!effectiveCustEdid || !effectiveCustMobile) return;

    const ordStatus = orderStatusFilter;
    const payStatus = paymentStatusFilter;
    const search = debouncedSearch.trim();
    const page = currentPage;

    const requestKey = `${effectiveCustEdid}_${effectiveCustMobile}_${page}_${search}_${ordStatus}_${payStatus}`;
    if (activeOrdersFetchRef.current === requestKey) return;
    activeOrdersFetchRef.current = requestKey;

    setLoadingOrders(true);

    const payload = {
      pagination: {
        pageNumber: page,
        pageSize: itemsPerPage,
      },
      fromDate: null,
      toDate: null,
      orderStatus: ordStatus && ordStatus !== 'All' ? ordStatus : null,
      status: ordStatus && ordStatus !== 'All' ? ordStatus : null,
      paymentStatus: payStatus && payStatus !== 'All' ? payStatus : null,
      orderNumber: search || null,
      searchKeyword: search || null
    };

    customerApi.getCustomerOrders(effectiveCustEdid, effectiveCustMobile, payload)
      .then(res => {
        if (activeOrdersFetchRef.current !== requestKey) return;
        const data = res?.data || res;
        const items = data?.items || (Array.isArray(data) ? data : []);
        setCustomerOrders(prev => {
          if (JSON.stringify(prev) === JSON.stringify(items)) return prev;
          return items;
        });
        setOrderHistoryTotalCount(prev => (prev === (data?.totalCount ?? items.length) ? prev : (data?.totalCount ?? items.length)));
        setTotalPages(prev => {
          const next = data?.totalPages ?? Math.max(1, Math.ceil((data?.totalCount ?? items.length) / itemsPerPage));
          return prev === next ? prev : next;
        });
      })
      .catch(err => {
        if (activeOrdersFetchRef.current !== requestKey) return;
        console.error('Failed to load customer orders:', err);
        setCustomerOrders([]);
        setOrderHistoryTotalCount(0);
        setTotalPages(1);
      })
      .finally(() => {
        if (activeOrdersFetchRef.current === requestKey) {
          setLoadingOrders(false);
        }
      });
  }, [effectiveCustEdid, effectiveCustMobile, currentPage, debouncedSearch, orderStatusFilter, paymentStatusFilter, itemsPerPage]);

  // Robust client-side filter fallback in case backend endpoint returns all unfiltered orders
  const displayedOrders = useMemo(() => {
    return customerOrders.filter(order => {
      if (orderStatusFilter && orderStatusFilter !== 'All') {
        const ordSt = (order.orderStatus || order.status || '').toUpperCase().replace(/[\s_]+/g, '');
        const filterSt = orderStatusFilter.toUpperCase().replace(/[\s_]+/g, '');
        if (ordSt !== filterSt) return false;
      }
      if (paymentStatusFilter && paymentStatusFilter !== 'All') {
        const paySt = (order.paymentStatus || '').toUpperCase().replace(/[\s_]+/g, '');
        const filterPay = paymentStatusFilter.toUpperCase().replace(/[\s_]+/g, '');
        if (paySt !== filterPay) return false;
      }
      if (debouncedSearch && debouncedSearch.trim()) {
        const term = debouncedSearch.trim().toLowerCase();
        const num = String(order.orderNumber || order.orderNo || '').toLowerCase();
        if (!num.includes(term)) return false;
      }
      return true;
    });
  }, [customerOrders, orderStatusFilter, paymentStatusFilter, debouncedSearch]);

  const hasActiveFilters = Boolean(
    (orderStatusFilter && orderStatusFilter !== 'All') ||
    (paymentStatusFilter && paymentStatusFilter !== 'All') ||
    (searchTerm && searchTerm.trim())
  );

  const displayedCount = hasActiveFilters
    ? (customerOrders.length > 0 && customerOrders.length === orderHistoryTotalCount ? displayedOrders.length : orderHistoryTotalCount)
    : orderHistoryTotalCount;

  const handleResetFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setOrderStatusFilter('All');
    setPaymentStatusFilter('All');
    setCurrentPage(1);
  };

  // Loading Screen
  if (loading && !customer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 size={40} className="animate-spin text-indigo-600" />
        <p className="text-sm font-medium text-slate-500">Loading customer details…</p>
      </div>
    );
  }

  // Not Found Screen
  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Users size={48} className="text-slate-300" />
        <h2 className="text-xl font-bold text-slate-900">Customer Not Found</h2>
        <p className="text-sm text-slate-400">The requested customer could not be found or has been removed.</p>
        <Button onClick={() => navigate('/customers')}>Back to Customers</Button>
      </div>
    );
  }

  const totalOrdersCount = customer.totalOrders !== undefined ? customer.totalOrders : customerOrders.length;
  const lifetimeValue = customer.totalSpent !== undefined
    ? Number(customer.totalSpent)
    : customerOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            Customer Details
          </div>
        }
        subtitle="Manage customer profile, contact information, and purchase history"
        rightContent={
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => navigate('/customers')} icon={ChevronLeft}>
              Back
            </Button>
            <Button icon={Plus} onClick={() => navigate('/new-order')}>
              New Order
            </Button>
          </div>
        }
      />

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column: Stats, Info, Addresses */}
        <div className="w-full lg:w-[380px] flex flex-col gap-6 shrink-0">
          {/* Profile Card */}
          <Card className="p-3 border-none flex flex-col gap-3">
            {/* Top Profile Info */}
            <div className="border border-slate-200 rounded-2xl p-5 flex justify-between items-center bg-white shadow-xs">
              <div className="flex gap-4 items-center min-w-0">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black text-2xl shadow-xs ring-4 ring-indigo-50/50 shrink-0">
                  {(customer.name || 'C').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 truncate">{customer.name}</h3>
                    {customer.type && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {customer.type}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col text-xs text-slate-500 gap-1 mt-1 font-medium">
                    <span className="flex items-center gap-2 font-mono">
                      <Phone size={13} className="text-slate-400" /> {customer.mobile || '—'}
                    </span>
                    <span className="flex items-center gap-2 truncate">
                      <Mail size={13} className="text-slate-400" /> {customer.email || 'No email provided'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-slate-200 rounded-2xl p-4 flex justify-between items-center bg-white shadow-xs">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Orders</p>
                  <p className="text-lg font-black text-slate-900">{totalOrdersCount}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500">
                  <Package size={18} />
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl p-4 flex justify-between items-center bg-white shadow-xs">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Lifetime Value</p>
                  <p className="text-lg font-black text-slate-900">₹ {lifetimeValue.toLocaleString('en-IN')}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <IndianRupee size={18} />
                </div>
              </div>
            </div>
          </Card>

          {/* Addresses */}
          <Card className="border border-slate-200 shadow-xs">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MapPin size={15} className="text-indigo-600" /> Saved Addresses
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex flex-col gap-3">
              {loadingAddresses ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 size={18} className="animate-spin text-indigo-600" />
                  <span className="text-xs">Loading addresses…</span>
                </div>
              ) : customerAddresses.length > 0 ? (
                customerAddresses.map((addr, idx) => (
                  <div
                    key={addr.edid || addr.id || idx}
                    className={`p-4 rounded-xl border ${idx === 0 ? 'bg-indigo-50/20 border-indigo-200' : 'bg-white border-slate-200'} relative transition-all`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-slate-900 flex items-center gap-2 text-xs">
                        {addr.addressType || (idx === 0 ? 'Primary' : 'Secondary')}
                        {idx === 0 && (
                          <span className="bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            Default
                          </span>
                        )}
                      </h4>
                    </div>
                    <p className="font-bold text-slate-800 text-xs mb-1">{addr.recipientName || customer.name}</p>
                    <p className="text-xs text-slate-500 leading-relaxed mb-2">
                      {addr.houseStreet}
                      {addr.areaLocality && `, ${addr.areaLocality}`}
                      {addr.city && `, ${addr.city}`}
                      {addr.district && `, ${addr.district}`}
                      {addr.state && `, ${addr.state}`}
                      {addr.pincode && ` - ${addr.pincode}`}
                      {addr.landmark && <span className="block text-[11px] text-slate-400 mt-0.5">Landmark: {addr.landmark}</span>}
                    </p>
                    <p className="text-[11px] font-medium text-slate-600 flex items-center gap-1.5 font-mono">
                      <Phone size={11} className="text-slate-400" /> {addr.primaryMobile || customer.mobile}
                    </p>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs font-medium border-2 border-dashed border-slate-200 rounded-xl">
                  No saved addresses found.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Order History & Stats */}
        <div className="flex-1 flex flex-col gap-6 min-w-0 w-full">
          <div className="flex-1 bg-white border border-slate-200 rounded-2xl flex flex-col shadow-xs overflow-hidden">
            <CardHeader className="flex-col !items-stretch gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">Order History</CardTitle>
                  <p className="text-xs text-slate-400 font-medium">Customer's procurement & purchase records</p>
                </div>
                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={RotateCcw}
                      onClick={handleResetFilters}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      Reset Filters
                    </Button>
                  )}
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                    {displayedCount} orders
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-[280px]">
                  <Input
                    actionIcon={Search}
                    placeholder="Search by order number..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                    }}
                  />
                </div>
                <div className="w-[160px]">
                  <Dropdown
                    placeholder="Order Status"
                    value={orderStatusFilter}
                    onChange={(val) => {
                      setOrderStatusFilter(val);
                      setCurrentPage(1);
                    }}
                    options={['All', ...orderStatusOptions].map(s => s === 'All' ? 'All' : { value: s, label: formatOrderStatus(s) })}
                  />
                </div>
                <div className="w-[160px]">
                  <Dropdown
                    placeholder="Payment Status"
                    value={paymentStatusFilter}
                    onChange={(val) => {
                      setPaymentStatusFilter(val);
                      setCurrentPage(1);
                    }}
                    options={['All', ...paymentStatusOptions].map(s => s === 'All' ? 'All' : { value: s, label: formatOrderStatus(s) })}
                  />
                </div>
              </div>
            </CardHeader>

            <div className="flex-1 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left">Order No.</TableHead>
                    <TableHead className="text-left">Date</TableHead>
                    <TableHead className="text-left">Delivery Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">Payment</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody padRows={false}>
                  {loadingOrders ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-16 text-slate-400 font-medium">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 size={24} className="animate-spin text-indigo-600" />
                          <p className="text-xs text-slate-500">Loading order records…</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : displayedOrders.length > 0 ? (
                    displayedOrders.map(order => {
                      const orderId = order.edid || order.id;
                      return (
                        <TableRow key={orderId} className="hover:bg-slate-50/60 transition-colors">
                          <TableCell className="font-bold text-slate-800 text-sm">
                            #{order.orderNumber || order.orderNo}
                          </TableCell>
                          <TableCell className="font-medium text-slate-600 text-xs text-left">
                            {formatDateTime(order.createdAt)}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-bold uppercase text-slate-700">
                              {order.deliveryType || 'Standard'}
                            </span>
                          </TableCell>
                          <TableCell className="font-bold text-slate-700 text-right">
                            ₹{Number(order.totalAmount || 0).toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-bold uppercase ${(order.paymentStatus || '').toUpperCase() === 'PAID'
                              ? 'text-emerald-600'
                              : (order.paymentStatus || '').toUpperCase() === 'PARTIAL'
                                ? 'text-amber-600'
                                : 'text-red-600'
                              }`}>
                              {order.paymentStatus || 'UNPAID'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-bold uppercase ${
                              (order.orderStatus || order.status || '').toUpperCase() === 'DELIVERED' ? 'text-emerald-600' :
                              (order.orderStatus || order.status || '').toUpperCase() === 'SHIPPED' ? 'text-blue-600' :
                              (order.orderStatus || order.status || '').toUpperCase() === 'READYTOSHIP' ? 'text-indigo-600' :
                              (order.orderStatus || order.status || '').toUpperCase() === 'PACKING' ? 'text-purple-600' :
                              'text-slate-600'
                            }`}>
                              {formatOrderStatus(order.orderStatus || order.status) || 'Order Placed'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Tooltip content="View Order">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  icon={Eye}
                                  onClick={() => {
                                    const orderNum = order.orderNumber || order.orderNo;
                                    const orderUrl = orderNum ? `/orders/${orderNum}/${orderId}` : `/orders/${orderId}`;
                                    navigate(orderUrl, { state: { order, fromCustomerUrl: location.pathname + location.search } });
                                  }}
                                  className="text-slate-400 hover:text-indigo-600"
                                />
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-16 text-slate-400 font-medium">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <Package size={28} className="stroke-1 text-slate-300" />
                          <p className="text-xs font-bold text-slate-600">No orders found</p>
                          <p className="text-[11px] text-slate-400">No purchase invoices or orders recorded for this customer.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="border-t border-slate-100 bg-white shrink-0 rounded-b-2xl">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={displayedCount}
                itemsPerPage={itemsPerPage}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
