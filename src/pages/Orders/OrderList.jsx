import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import { Search, Eye, X, Printer } from 'lucide-react';
import ConfirmedSlipsModal from '../../components/orders/ConfirmedSlipsModal';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { Dropdown } from '../../components/common/Dropdown';
import DateRangePicker from '../../components/common/DateRangePicker';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tooltip } from '../../components/ui/Tooltip';
import { Pagination } from '../../components/ui/Pagination';
import { Card } from '../../components/ui/Card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { formatDateTime, formatFilterDateToUTC, PAGE_SIZE, formatOrderStatus } from '../../common/utils';
import { commonApi } from '../../api/commonApi';

const getOrderStatusColor = (status) => {
    switch ((status || '').toUpperCase().replace(/[\s_]+/g, '')) {
        case 'DELIVERED': return 'text-emerald-600';
        case 'SHIPPED': return 'text-blue-600';
        case 'READYTOSHIP': return 'text-indigo-600';
        case 'PACKING': return 'text-purple-600';
        case 'CONFIRMED': return 'text-sky-600';
        case 'CANCELLED': return 'text-red-600';
        default: return 'text-slate-600';
    }
};

export default function Orders() {
    const { orders, orderTotal, loadOrders, orderFilters, setOrderFilters } = useStore();
    const navigate = useNavigate();

    // ── All filter state is initialised from the persisted orderFilters ──────
    const [searchTerm, setSearchTerm] = useState(orderFilters?.searchTerm || '');
    const [debouncedSearch, setDebouncedSearch] = useState(orderFilters?.searchTerm || '');
    const [statusFilter, setStatusFilter] = useState(orderFilters?.status || 'All');
    const [paymentFilter, setPaymentFilter] = useState(orderFilters?.paymentStatus || 'All');
    const [dateFrom, setDateFrom] = useState(orderFilters?.dateFrom || '');
    const [dateTo, setDateTo] = useState(orderFilters?.dateTo || '');
    const [currentPage, setCurrentPage] = useState(orderFilters?.currentPage || 1);
    const [isConfirmedSlipsModalOpen, setIsConfirmedSlipsModalOpen] = useState(false);

    // Dynamic enum options
    const [orderStatuses, setOrderStatuses] = useState(['All']);
    const [paymentStatusOptions, setPaymentStatusOptions] = useState([{ value: 'All', label: 'All' }]);

    // Request-id tracker for background fetches
    const activeRequestId = useRef(0);

    // Guard: prevent the filter-change effect from resetting currentPage on mount
    const isInitialFilterMount = useRef(true);

    // ── Load enum types once ─────────────────────────────────────────────────
    useEffect(() => {
        commonApi.getTypes('OrderStatus')
            .then(res => {
                const items = res?.items || res?.data?.items || (Array.isArray(res) ? res : []);
                if (Array.isArray(items) && items.length > 0) {
                    const cleaned = items.filter(s => s && String(s).toLowerCase() !== 'all');
                    setOrderStatuses(['All', ...cleaned]);
                }
            })
            .catch(err => console.error('Failed to load OrderStatus types:', err));

        commonApi.getTypes('PaymentStatus')
            .then(res => {
                const items = res?.items || res?.data?.items || (Array.isArray(res) ? res : []);
                if (Array.isArray(items) && items.length > 0) {
                    const opts = [
                        { value: 'All', label: 'All' },
                        ...items
                            .filter(s => s && String(s).toLowerCase() !== 'all')
                            .map(s => ({ value: s, label: formatOrderStatus(s) }))
                    ];
                    setPaymentStatusOptions(opts);
                }
            })
            .catch(err => console.error('Failed to load PaymentStatus types:', err));
    }, []);

    // ── Debounce search input ────────────────────────────────────────────────
    // Skip on initial mount so restoring a saved search doesn't re-trigger effects
    const isInitialSearchMount = useRef(true);
    useEffect(() => {
        if (isInitialSearchMount.current) {
            isInitialSearchMount.current = false;
            return;
        }
        const handler = setTimeout(() => setDebouncedSearch(searchTerm), 350);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // ── Reset page to 1 when filters change, persist to StoreContext ─────────
    // Skip on initial mount so a restored currentPage is NOT wiped out
    useEffect(() => {
        if (isInitialFilterMount.current) {
            isInitialFilterMount.current = false;
            return;
        }
        setCurrentPage(1);
        setOrderFilters(prev => ({
            ...prev,
            currentPage: 1,
            searchTerm: debouncedSearch,
            status: statusFilter,
            paymentStatus: paymentFilter,
            dateFrom,
            dateTo
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, dateFrom, dateTo, statusFilter, paymentFilter]);

    // ── Background API fetch (does NOT wipe table rows while loading) ────────
    useEffect(() => {
        const reqId = ++activeRequestId.current;
        loadOrders(currentPage, PAGE_SIZE, {
            fromDate: formatFilterDateToUTC(dateFrom, false),
            toDate: formatFilterDateToUTC(dateTo, true),
            status: statusFilter !== 'All' ? statusFilter : null,
            paymentStatus: paymentFilter !== 'All' ? paymentFilter : null,
            searchKeyword: debouncedSearch || null
        }).then(() => {
            // loadOrders already handles row diffing in StoreContext; nothing extra needed
        });
        return () => {
            // Mark stale requests; loadOrders guards itself via orderRequestId
        };
    }, [currentPage, dateFrom, dateTo, statusFilter, paymentFilter, debouncedSearch, loadOrders]);

    const handleResetFilters = () => {
        setSearchTerm('');
        setDebouncedSearch('');
        setDateFrom('');
        setDateTo('');
        setPaymentFilter('All');
        setStatusFilter('All');
        setCurrentPage(1);
    };

    const hasActiveFilters = Boolean(
        searchTerm ||
        dateFrom ||
        dateTo ||
        (paymentFilter && paymentFilter !== 'All') ||
        (statusFilter && statusFilter !== 'All')
    );

    const totalCount = orderTotal || orders.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    return (
        <div className="space-y-5">
            <PageHeader
                title="Orders"
                subtitle="View and manage all customer orders"
                rightContent={
                    <button
                        type="button"
                        onClick={() => setIsConfirmedSlipsModalOpen(true)}
                        className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                        title="View and print delivery slips for all confirmed orders"
                    >
                        <Printer size={14} />
                        <span>Confirmed Slips</span>
                    </button>
                }
            />

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
                {/* Search */}
                <div className="w-[280px]">
                    <Input
                        actionIcon={Search}
                        placeholder="Search by order number..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Date Range — no default date, starts empty (all dates) */}
                <DateRangePicker
                    startDate={dateFrom}
                    endDate={dateTo}
                    onChange={({ startDate, endDate }) => {
                        setDateFrom(startDate);
                        setDateTo(endDate);
                    }}
                    placeholder="Select date range"
                    className="w-[240px]"
                />

                {/* Payment Status */}
                <Dropdown
                    value={paymentFilter}
                    onChange={(val) => setPaymentFilter(val)}
                    options={paymentStatusOptions}
                    className="w-[140px]"
                />

                {/* Order Status */}
                <Dropdown
                    value={statusFilter}
                    onChange={(val) => setStatusFilter(val)}
                    options={orderStatuses.map(s =>
                        s === 'All'
                            ? { value: 'All', label: 'All' }
                            : { value: s, label: formatOrderStatus(s) }
                    )}
                    className="w-[160px]"
                />

                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={handleResetFilters}
                        className="h-10 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0"
                        title="Reset Filters"
                    >
                        <X size={15} />
                    </button>
                )}
            </div>

            {/* Table */}
            <Card className="overflow-auto flex flex-col">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-left">Order No.</TableHead>
                            <TableHead className="text-left">Date</TableHead>
                            <TableHead className="text-left">Customer</TableHead>
                            <TableHead className="text-left">Mobile</TableHead>
                            <TableHead className="text-right">Total Amount</TableHead>
                            <TableHead className="text-center">Payment Status</TableHead>
                            <TableHead className="text-center">Order Status</TableHead>
                            <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map((order, i) => {
                            const orderId = order.edid || order.id;
                            const orderUrl = order.orderNumber
                                ? `/orders/${order.orderNumber}/${orderId}`
                                : `/orders/${orderId}`;
                            const norm = (order.paymentStatus || 'Unpaid').toUpperCase().replace('_', '');
                            const isPaid = norm === 'PAID';
                            const isPartial = norm === 'PARTIALLYPAID';
                            return (
                                <TableRow key={orderId || i}>
                                    <TableCell className="whitespace-nowrap font-medium text-slate-800">
                                        {order.orderNumber || '-'}
                                    </TableCell>
                                    <TableCell>{formatDateTime(order.createdAt)}</TableCell>
                                    <TableCell className="font-medium">
                                        {order.recipientName || order.customerName || order.deliveryAddress?.recipientName || '-'}
                                    </TableCell>
                                    <TableCell>
                                        {order.customerMobile || order.deliveryAddress?.primaryMobile || '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-slate-700">
                                        ₹{Number(order.totalAmount || 0).toLocaleString('en-IN')}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <span className={`font-bold uppercase ${isPaid ? 'text-emerald-600' : isPartial ? 'text-amber-600' : 'text-red-600'}`}>
                                            {isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'UNPAID'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <span className={`font-bold uppercase ${getOrderStatusColor(order.status)}`}>
                                            {formatOrderStatus(order.status)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-center" style={{ borderLeft: 'none' }}>
                                        <Tooltip content="View">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                icon={Eye}
                                                onClick={() => navigate(orderUrl, { state: { order } })}
                                            />
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {orders.length === 0 && (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={8} className="text-center text-slate-400 py-16 font-medium">
                                    No orders found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>

                {/* Pagination */}
                <div className="p-4 border-t border-slate-200">
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={(page) => {
                            setCurrentPage(page);
                            setOrderFilters(prev => ({ ...prev, currentPage: page }));
                        }}
                        totalItems={totalCount}
                        itemsPerPage={PAGE_SIZE}
                    />
                </div>
            </Card>

            {/* ── Confirmed Orders Delivery Slips Modal ──────────────── */}
            <ConfirmedSlipsModal
                isOpen={isConfirmedSlipsModalOpen}
                onClose={() => setIsConfirmedSlipsModalOpen(false)}
            />
        </div>
    );
}
