import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
    Truck, Search, Package, MapPin, User, Calendar, CheckCircle, ArrowRight,
    Upload, FileText, X, Loader2, Eye, Download, DollarSign, Filter, ChevronLeft, ChevronRight, RefreshCw
} from 'lucide-react';
import { orderApi } from '../../api/orderApi';
import { commonApi } from '../../api/commonApi';
import { courierApi } from '../../api/courierApi';
import Dropdown from '../../components/common/Dropdown';
import PageHeader from '../../components/common/PageHeader';
import { formatDate, formatTime, formatDateTime, PAGE_SIZE } from '../../common/utils';
import { useStore } from '../../context/StoreContext';
import { Card } from '../../components/ui/Card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { Tooltip } from '../../components/ui/Tooltip';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Pagination } from '../../components/ui/Pagination';

export default function Logistics() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { currentUser } = useStore();

    const incomingOrderNumber = (
        location.state?.orderNumber ||
        location.state?.orderNo ||
        searchParams.get('orderNumber') ||
        searchParams.get('order') ||
        searchParams.get('orderNo') ||
        ''
    ).trim();

    // Tab state: 'READY' or 'DISPATCHED'
    const [activeTab, setActiveTab] = useState('READY');

    // Orders and pagination state
    const [orders, setOrders] = useState([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [pageNumber, setPageNumber] = useState(1);
    const [loading, setLoading] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState(incomingOrderNumber);
    const [debouncedSearch, setDebouncedSearch] = useState(incomingOrderNumber);

    useEffect(() => {
        if (incomingOrderNumber) {
            setSearchKeyword(incomingOrderNumber);
            setDebouncedSearch(incomingOrderNumber);
        }
    }, [incomingOrderNumber]);

    const activeRequestId = useRef(0);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchKeyword);
        }, 350);
        return () => clearTimeout(timer);
    }, [searchKeyword]);

    // Reset page to 1 whenever tab or search change
    useEffect(() => {
        setPageNumber(1);
    }, [activeTab, debouncedSearch]);

    // Dispatch Modal State
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [courierOptions, setCourierOptions] = useState([]);
    const [courier, setCourier] = useState('');
    const [trackingNumber, setTrackingNumber] = useState('');
    const [courierCharge, setCourierCharge] = useState('');
    const [slipDocumentEdid, setSlipDocumentEdid] = useState(null);
    const [slipFileName, setSlipFileName] = useState('');
    const [uploadingSlip, setUploadingSlip] = useState(false);
    const [submittingDispatch, setSubmittingDispatch] = useState(false);
    const [dispatchError, setDispatchError] = useState(null);

    // Fetch Couriers from DB (active couriers for dispatch selection)
    const courierRequestId = useRef(0);
    const courierSearchTimeout = useRef(null);

    const loadCouriers = useCallback(async (search = '') => {
        const reqId = ++courierRequestId.current;
        try {
            const res = await courierApi.getCouriers({
                onlyActive: true,
                searchText: search ? search.trim() : null,
                pageSize: 100
            });
            if (reqId !== courierRequestId.current) return;
            const items = res?.data?.items || res?.items || (Array.isArray(res) ? res : []);
            if (Array.isArray(items)) {
                const activeItems = items.filter(c => c.isActive === true);
                const dbOptions = activeItems.map(c => ({
                    value: c.name,
                    id: c.id,
                    edid: c.edid,
                    metadata: c.metadata || [],
                    docEdid: c.docEdid,
                    label: c.name + (c.mobile ? ` (${c.mobile})` : '')
                }));
                setCourierOptions(dbOptions);
                setCourier(prev => prev || (dbOptions.length > 0 ? dbOptions[0].value : ''));
            }
        } catch (err) {
            if (reqId !== courierRequestId.current) return;
            console.error('Failed to load couriers from API:', err);
        }
    }, []);

    const handleCourierSearchChange = useCallback((text) => {
        if (courierSearchTimeout.current) clearTimeout(courierSearchTimeout.current);
        courierSearchTimeout.current = setTimeout(() => {
            loadCouriers(text);
        }, 300);
    }, [loadCouriers]);

    useEffect(() => {
        loadCouriers();
    }, [loadCouriers]);

    // Fetch queue in background
    const fetchQueue = useCallback(async () => {
        const reqId = ++activeRequestId.current;
        setLoading(true);
        try {
            let res;
            if (activeTab === 'READY') {
                res = await orderApi.getReadyToShipOrders(pageNumber, PAGE_SIZE, {
                    searchKeyword: debouncedSearch || null
                });
            } else {
                res = await orderApi.getOrders(pageNumber, PAGE_SIZE, {
                    status: 'Shipped',
                    searchKeyword: debouncedSearch || null
                });
            }

            if (reqId !== activeRequestId.current) return;

            const data = res?.data || res;
            const newItems = data?.items || [];
            const newTotal = data?.totalCount || 0;

            setOrders(prev => {
                if (JSON.stringify(prev) === JSON.stringify(newItems)) return prev;
                return newItems;
            });
            setTotalRecords(prev => prev === newTotal ? prev : newTotal);
        } catch (err) {
            console.error('Failed to load logistics queue:', err);
        } finally {
            if (reqId === activeRequestId.current) {
                setLoading(false);
            }
        }
    }, [activeTab, pageNumber, debouncedSearch]);

    useEffect(() => {
        fetchQueue();
    }, [fetchQueue]);

    // File Upload Handler
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingSlip(true);
        try {
            const res = await commonApi.uploadAttachment(file);
            const data = res?.data || res;
            const docEdid = data?.documentEdid || data?.edid;
            const docName = data?.documentOriginalName || file.name;
            if (docEdid) {
                setSlipDocumentEdid(docEdid);
                setSlipFileName(docName);
            }
        } catch (err) {
            console.error('Failed to upload slip document:', err);
            alert('Failed to upload courier slip. Please try again.');
        } finally {
            setUploadingSlip(false);
        }
    };

    // Open Dispatch Modal
    const handleOpenDispatch = (order) => {
        setSelectedOrder(order);
        setCourier(order?.courier || courierOptions[0]?.value || '');
        setTrackingNumber('');
        setCourierCharge('');
        setSlipDocumentEdid(null);
        setSlipFileName('');
        setDispatchError(null);
        loadCouriers(''); // fetch fresh list from API without caching
    };

    // Submit Dispatch
    const handleSubmitDispatch = async (e) => {
        e.preventDefault();
        if (!selectedOrder) return;

        if (!courier) {
            setDispatchError('Please specify the courier service.');
            return;
        }

        if (!trackingNumber.trim()) {
            setDispatchError('Please enter tracking / AWB number.');
            return;
        }

        setSubmittingDispatch(true);
        setDispatchError(null);

        try {
            const matchedCourier = courierOptions.find(o => o.value === courier);
            const payload = {
                orderEdid: selectedOrder.edid || selectedOrder.id,
                courier: courier,
                courierId: matchedCourier?.id || null,
                courierEdid: matchedCourier?.edid || null,
                tracking: trackingNumber.trim(),
                trackingNumber: trackingNumber.trim(),
                courierCharge: courierCharge ? parseFloat(courierCharge) : null,
                slipDocument: slipDocumentEdid,
                totalWeight: selectedOrder?.package?.weight ? parseFloat(selectedOrder.package.weight) : null,
                handedOverBy: currentUser?.employeeCode || 'EMP001',
                handedOverAt: new Date().toISOString()
            };

            await orderApi.dispatchOrder(payload);
            setSelectedOrder(null);
            fetchQueue();
        } catch (err) {
            console.error('Failed to dispatch order:', err);
            setDispatchError(err.message || 'Failed to dispatch order.');
        } finally {
            setSubmittingDispatch(false);
        }
    };

    const totalPages = Math.ceil(totalRecords / PAGE_SIZE) || 1;

    return (
        <div className="space-y-5">
            {/* Header — matching PageHeader used across the project */}
            <PageHeader
                title={
                    <div className="flex items-center gap-2.5">
                        <Truck size={22} className="text-blue-600" />
                        <span>Logistics Station</span>
                    </div>
                }
                subtitle="Manage courier dispatches, record tracking numbers, upload postal slips, and track courier charges."
                rightContent={
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigate('/couriers')}
                            className="flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-xs"
                        >
                            <Truck size={14} /> Couriers & Slip Details
                        </button>
                        <button
                            onClick={fetchQueue}
                            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-xs"
                        >
                            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh Queue
                        </button>
                    </div>
                }
            />

            {/* Filter and Tab Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                {/* Tabs */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('READY')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            activeTab === 'READY'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <Package size={14} className="text-indigo-600" />
                        Ready To Dispatch
                        {activeTab === 'READY' && totalRecords > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black">
                                {totalRecords}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('DISPATCHED')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            activeTab === 'DISPATCHED'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <CheckCircle size={14} className="text-emerald-600" />
                        Dispatched History
                    </button>
                </div>

                {/* Search — using the project's Input component */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="w-full sm:w-72">
                        <Input
                            actionIcon={loading ? Loader2 : Search}
                            placeholder="Search order #, customer, mobile..."
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                        />
                    </div>
                    {searchKeyword && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchKeyword('');
                                setDebouncedSearch('');
                                setPageNumber(1);
                            }}
                            className="h-10 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0"
                            title="Reset Search"
                        >
                            <X size={15} />
                        </button>
                    )}
                </div>
            </div>

            {/* Orders Table */}
            <Card className="overflow-auto flex flex-col">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-left">Order No.</TableHead>
                            <TableHead className="text-left">Customer</TableHead>
                            <TableHead className="text-center">Delivery Type</TableHead>
                            <TableHead className="text-right">Total Amount</TableHead>
                            <TableHead className="text-left">Date</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.length === 0 ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={7} className="py-16 text-center text-slate-400 font-medium">
                                    {loading ? 'Loading orders...' : activeTab === 'READY' ? 'No orders waiting for courier dispatch.' : 'No dispatched orders found.'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            orders.map((order) => (
                                <TableRow key={order.edid || order.id} className="hover:bg-slate-50/50 transition-colors">
                                    <TableCell className="whitespace-nowrap font-medium text-slate-800">
                                        #{order.orderNumber}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        {order.customerName || order.recipientName || 'Customer'}
                                        {order.customerMobile && (
                                            <span className="text-[10px] text-slate-400 ml-1.5 font-normal">({order.customerMobile})</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <span className="font-bold uppercase text-slate-700">
                                            {order.deliveryType === 'DIRECT' ? 'Direct' : 'Courier'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-slate-700">
                                        ₹{Number(order.totalAmount || 0).toLocaleString('en-IN')}
                                    </TableCell>
                                    <TableCell>
                                        {formatDateTime(order.createdAt)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <span className={`font-bold uppercase ${
                                            order.status === 'Shipped' ? 'text-blue-600' :
                                            order.status === 'Delivered' ? 'text-emerald-600' :
                                            'text-indigo-600'
                                        }`}>
                                            {order.status}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-center" style={{ borderLeft: 'none' }}>
                                        {activeTab === 'READY' ? (
                                            <button
                                                onClick={() => handleOpenDispatch(order)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                                            >
                                                <Truck size={12} /> Dispatch
                                            </button>
                                        ) : (
                                            <Tooltip content="View">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    icon={Eye}
                                                    onClick={() => navigate(`/orders/${order.orderNumber}/${order.edid || order.id}`)}
                                                />
                                            </Tooltip>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
                <Pagination
                    currentPage={pageNumber}
                    totalPages={totalPages}
                    onPageChange={setPageNumber}
                    totalItems={totalRecords}
                    itemsPerPage={PAGE_SIZE}
                />
            </Card>

            {/* Dispatch Order Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
                        {/* Modal Header */}
                        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                                    <Truck size={17} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900">
                                        Dispatch Order #{selectedOrder.orderNumber}
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Record courier booking details and upload postal slip.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmitDispatch} className="p-5 space-y-4">
                            {dispatchError && (
                                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                                    {dispatchError}
                                </div>
                            )}

                            {/* Courier Selection */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                    Courier Service / Provider <span className="text-rose-500">*</span>
                                </label>
                                <Dropdown
                                    value={courier}
                                    onChange={setCourier}
                                    options={courierOptions}
                                    placeholder="Select courier..."
                                    searchable={true}
                                    searchPlaceholder="Search courier..."
                                    onSearchChange={handleCourierSearchChange}
                                    onOpen={() => loadCouriers('')}
                                    className="w-full text-xs"
                                />
                            </div>

                            {/* Tracking / AWB Number */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                    Tracking / AWB Number <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={trackingNumber}
                                    onChange={(e) => setTrackingNumber(e.target.value)}
                                    placeholder="e.g. IN1029384759, ST99827..."
                                    className="w-full h-10 px-3 bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all"
                                />
                            </div>

                            {/* Courier Charge Given to Team */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                    Courier Charge Given to Courier/Post Team (₹)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={courierCharge}
                                        onChange={(e) => setCourierCharge(e.target.value)}
                                        placeholder="Amount given (e.g. 70)"
                                        className="w-full h-10 pl-7 pr-3 bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Record the exact courier fee paid at the post or courier counter.</p>
                            </div>

                            {/* Upload Courier Slip Document */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                    Courier Slip Document / Photo
                                </label>
                                {slipDocumentEdid ? (
                                    <div className="flex items-center justify-between p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs">
                                        <div className="flex items-center gap-2 text-blue-900 font-semibold truncate">
                                            <FileText size={16} className="text-blue-600 shrink-0" />
                                            <span className="truncate">{slipFileName || 'Courier Slip Uploaded'}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { setSlipDocumentEdid(null); setSlipFileName(''); }}
                                            className="text-rose-500 hover:text-rose-700 p-1 text-xs font-bold cursor-pointer"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ) : (
                                    <label className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/30 p-4 rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors">
                                        <input
                                            type="file"
                                            accept="image/*,.pdf"
                                            onChange={handleFileUpload}
                                            className="hidden"
                                        />
                                        {uploadingSlip ? (
                                            <div className="flex items-center gap-2 text-xs text-blue-600 font-bold">
                                                <Loader2 size={16} className="animate-spin" /> Uploading slip...
                                            </div>
                                        ) : (
                                            <>
                                                <Upload size={18} className="text-slate-400" />
                                                <span className="text-xs font-bold text-slate-700">Click to upload courier slip</span>
                                                <span className="text-[10px] text-slate-400">PNG, JPG, PDF up to 10MB</span>
                                            </>
                                        )}
                                    </label>
                                )}
                            </div>

                            {/* Modal Actions */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setSelectedOrder(null)}
                                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingDispatch || uploadingSlip}
                                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
                                >
                                    {submittingDispatch ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                    Confirm Dispatch & Mark Shipped
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
