import { useState, useRef, useEffect, useCallback, Fragment } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { orderApi } from '../../api/orderApi';
import { commonApi } from '../../api/commonApi';
import { API_BASE } from '../../services/apiClient';
import {
    ArrowLeft, User, MapPin, Package, Phone, CheckCircle, CreditCard, ChevronRight,
    FileText, Download, TrendingUp, Calendar, AlertCircle, RefreshCw, XCircle, Copy,
    Edit2, Ban, Truck, Home, Tag, Printer, Edit, Clock, Info, Check, File,
    MessageSquare, Send, Plus, Loader2, Box, Eye, X, Layers
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { formatDate, formatTime, formatDateTime, formatOrderStatus } from '../../common/utils';
import RecordPaymentModal from '../../components/orders/RecordPaymentModal';
import OrderPrintModal from '../../components/orders/OrderPrintModal';
import ConfirmModal from '../../components/common/ConfirmModal';
import DocumentViewModal from '../../components/common/DocumentViewModal';
import { Tooltip } from '../../components/ui/Tooltip';

const STATUS_CONFIG = {
    'OrderPlaced': { dot: 'bg-slate-400' },
    'Confirmed': { dot: 'bg-sky-500' },
    'Packing': { dot: 'bg-purple-500' },
    'ReadyToShip': { dot: 'bg-indigo-500' },
    'Shipped': { dot: 'bg-blue-500' },
    'Delivered': { dot: 'bg-green-500' },
};

const getStatusConfig = (status) => {
    if (!status) return { dot: 'bg-slate-400' };
    const norm = status.replace(/\s+/g, '').toLowerCase();
    const key = Object.keys(STATUS_CONFIG).find(k => k.toLowerCase() === norm);
    return key ? STATUS_CONFIG[key] : { dot: 'bg-slate-400' };
};

const getOrderStatusColor = (status) => {
    switch ((status || '').replace(/\s+/g, '').toLowerCase()) {
        case 'delivered':
            return 'text-emerald-600';
        case 'cancelled':
            return 'text-red-600';
        case 'shipped':
        case 'readytoship':
            return 'text-blue-600';
        case 'packing':
            return 'text-purple-600';
        case 'confirmed':
            return 'text-sky-600';
        case 'orderplaced':
        default:
            return 'text-slate-600';
    }
};

const getPaymentStatusColor = (status) => {
    const norm = (status || '').toUpperCase().replace(/[\s_]+/g, '');
    if (norm === 'PAID') return 'text-emerald-600';
    if (norm === 'PARTIALLYPAID' || norm === 'PARTIAL') return 'text-amber-600';
    return 'text-red-600';
};

export default function OrderDetails() {
    const { id, orderNumber: paramOrderNumber } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser, loadProducts, loadOrders } = useStore();

    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
    const [statusList, setStatusList] = useState([]);
    const [pendingStatus, setPendingStatus] = useState(null);
    const [trackingIdInput, setTrackingIdInput] = useState('');
    const [newComment, setNewComment] = useState('');
    const [activeBottomTab, setActiveBottomTab] = useState('comments');
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [printDocType, setPrintDocType] = useState('invoice');
    const [refreshCounter, setRefreshCounter] = useState(0);
    const [confirmingOrder, setConfirmingOrder] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancelRemark, setCancelRemark] = useState('');
    const [cancellingOrder, setCancellingOrder] = useState(false);
    const [errorModal, setErrorModal] = useState({ isOpen: false, title: '', message: '' });
    const [viewDoc, setViewDoc] = useState(null); // { url, title, fileName }
    const [trackingData, setTrackingData] = useState(null);
    const [trackingLoading, setTrackingLoading] = useState(false);
    const [comments, setComments] = useState([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [submittingComment, setSubmittingComment] = useState(false);
    const [trackingCopied, setTrackingCopied] = useState(false);

    const reloadOrder = () => setRefreshCounter(c => c + 1);

    const handleConfirmOrder = () => {
        if (!order || confirmingOrder) return;
        setIsConfirmModalOpen(true);
    };

    const executeConfirmOrder = async () => {
        if (!order || confirmingOrder) return;
        try {
            setConfirmingOrder(true);
            await orderApi.confirmOrder(order.edid || order.id || id);
            setIsConfirmModalOpen(false);
            reloadOrder();
        } catch (err) {
            console.error('Failed to confirm order:', err);
            setIsConfirmModalOpen(false);
            setErrorModal({
                isOpen: true,
                title: 'Order Confirmation Failed',
                message: err.message || 'Failed to confirm order. Please try again.'
            });
        } finally {
            setConfirmingOrder(false);
        }
    };

    const handleExecuteCancelOrder = async (e) => {
        if (e) e.preventDefault();
        const remarkText = cancelRemark.trim();
        if (!remarkText) {
            setErrorModal({
                isOpen: true,
                title: 'Remark Required',
                message: 'Please provide a valid reason or remark for cancelling this order.'
            });
            return;
        }

        const currentNorm = (order?.status || '').replace(/[\s_]+/g, '').toLowerCase();
        const allowedToCancel = ['orderplaced', 'confirmed', 'packing', 'readytoship'];
        if (!allowedToCancel.includes(currentNorm)) {
            setErrorModal({
                isOpen: true,
                title: 'Cancellation Not Allowed',
                message: `Cancellation is only allowed for orders with status Order Placed, Confirmed, Packing, or Ready to Ship. Orders that are ${formatOrderStatus(order?.status)} cannot be cancelled.`
            });
            setIsCancelModalOpen(false);
            return;
        }

        try {
            setCancellingOrder(true);
            await orderApi.updateStatus(order.edid || order.id || id, {
                status: 'Cancelled',
                remarks: remarkText,
                changedBy: currentUser?.name || currentUser?.userName || 'Staff'
            });

            // Record as comment in the order timeline for visibility
            try {
                await orderApi.addOrderComment(order.edid || order.id || id, {
                    comment: `Order cancelled. Reason: ${remarkText}`,
                    author: currentUser?.name || currentUser?.userName || 'Staff'
                });
            } catch (cErr) {
                console.warn('Could not post cancellation comment:', cErr);
            }

            // Restore product stock in local store cache
            if (loadProducts) {
                loadProducts();
            }
            if (loadOrders) {
                loadOrders();
            }

            setIsCancelModalOpen(false);
            setCancelRemark('');
            reloadOrder();
            fetchComments();
        } catch (err) {
            console.error('Failed to cancel order:', err);
            setErrorModal({
                isOpen: true,
                title: 'Cancellation Failed',
                message: err.message || 'Failed to cancel the order. Please try again.'
            });
        } finally {
            setCancellingOrder(false);
        }
    };

    const statusMenuRef = useRef(null);
    const textareaRef = useRef(null);
    const activeFetchRef = useRef('');

    // Fetch single unified order details endpoint: GET /api/orders/{orderNumber}/{orderEdid}
    useEffect(() => {
        if (!id) return;

        let effectiveOrderNum = paramOrderNumber || location.state?.order?.orderNumber || location.state?.orderNumber;
        let effectiveEdid = id;
        if (!effectiveOrderNum && id.startsWith('ORD-')) {
            effectiveOrderNum = id;
        }

        const fetchKey = `${effectiveOrderNum || ''}_${effectiveEdid}_${refreshCounter}`;
        activeFetchRef.current = fetchKey;
        setLoading(true);

        const fetchOrder = async () => {
            try {
                let orderData = null;
                if (effectiveOrderNum) {
                    // Main targeted call: GET /api/orders/{orderNumber}/{orderEdid}
                    const res = await orderApi.getOrderDetail(effectiveOrderNum, effectiveEdid);
                    orderData = res?.data || res;
                } else {
                    // Fallback only if orderNumber is unknown: fetch by ID first to resolve orderNumber
                    const basicRes = await orderApi.getOrderById(effectiveEdid);
                    const basicOrder = basicRes?.data || basicRes;
                    const resolvedNum = basicOrder?.orderNumber || basicOrder?.orderNo;
                    if (resolvedNum) {
                        const fullRes = await orderApi.getOrderDetail(resolvedNum, effectiveEdid);
                        orderData = fullRes?.data || fullRes;
                        effectiveOrderNum = resolvedNum;
                    } else {
                        orderData = basicOrder;
                    }
                }

                if (activeFetchRef.current === fetchKey && orderData) {
                    const fullOrder = {
                        ...orderData,
                        orderNumber: orderData.orderNumber || effectiveOrderNum,
                        edid: orderData.edid || effectiveEdid,
                        id: orderData.edid || effectiveEdid,
                    };
                    setOrder(fullOrder);
                    setError(null);
                }
            } catch (err) {
                if (activeFetchRef.current === fetchKey) {
                    console.error('Failed to load order details:', err);
                    setError(err.message || 'Failed to load order');
                }
            } finally {
                if (activeFetchRef.current === fetchKey) {
                    setLoading(false);
                }
            }
        };

        fetchOrder();
    }, [id, paramOrderNumber, refreshCounter]);

    // Fetch Status Tracking independently from dedicated API: GET /api/orders/{orderNumber}/tracking
    useEffect(() => {
        const effectiveOrderNum = order?.orderNumber || paramOrderNumber || (id && id.startsWith('ORD-') ? id : null);
        const effectiveEdid = order?.edid || order?.id || id;
        if (!effectiveOrderNum && !effectiveEdid) return;

        let isMounted = true;
        setTrackingLoading(true);
        orderApi.getOrderTracking(effectiveOrderNum || effectiveEdid, effectiveEdid)
            .then(res => {
                if (isMounted) {
                    const data = res?.data || res;
                    setTrackingData(data);
                }
            })
            .catch(err => {
                console.error('Failed to load separate status tracking:', err);
            })
            .finally(() => {
                if (isMounted) setTrackingLoading(false);
            });

        return () => { isMounted = false; };
    }, [order?.orderNumber, order?.edid, id, paramOrderNumber, refreshCounter]);

    // Load dynamic order status options (cached in memory)
    useEffect(() => {
        commonApi.getTypes('OrderStatus').then(res => {
            const items = res?.items || res?.data?.items || (Array.isArray(res) ? res : []);
            if (Array.isArray(items) && items.length > 0) {
                setStatusList(items);
            }
        }).catch(err => {
            console.error('Failed to load OrderStatus types:', err);
        });
    }, []);

    // Auto-expand comment textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [newComment]);

    // Close status menu on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (statusMenuRef.current && !statusMenuRef.current.contains(e.target)) {
                setIsStatusMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch Comments independently from dedicated separate API: GET /api/orders/{orderEdid}/comments
    const fetchComments = useCallback(() => {
        const orderEdid = order?.edid || order?.id || id;
        if (!orderEdid) return;
        setCommentsLoading(true);
        orderApi.getOrderComments(orderEdid)
            .then(res => {
                const data = res?.data || res;
                const items = data?.items || data?.comments || (Array.isArray(data) ? data : []);
                setComments(items);
            })
            .catch(err => {
                console.error('Failed to load comments from separate API:', err);
            })
            .finally(() => {
                setCommentsLoading(false);
            });
    }, [order?.edid, order?.id, id]);

    useEffect(() => {
        fetchComments();
    }, [fetchComments, refreshCounter]);

    const handleAddComment = async () => {
        if (!newComment.trim() || submittingComment) return;
        const orderEdid = order?.edid || order?.id || id;
        if (!orderEdid) return;

        const textToSend = newComment.trim();
        setSubmittingComment(true);
        try {
            await orderApi.addOrderComment(orderEdid, {
                text: textToSend,
                author: currentUser?.name || currentUser?.userName || ''
            });
            setNewComment('');
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
            fetchComments();
        } catch (err) {
            console.error('Failed to add comment via separate API:', err);
            setErrorModal({
                isOpen: true,
                title: 'Comment Failed',
                message: err.message || 'Failed to add comment to the order.'
            });
        } finally {
            setSubmittingComment(false);
        }
    };

    if (loading && !order) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <Loader2 size={36} className="animate-spin text-indigo-600" />
                <p className="text-sm font-medium text-slate-500">Loading order details…</p>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                    <Package size={28} className="text-slate-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Order Not Found</h2>
                <p className="text-sm text-slate-400">The requested order could not be located or has been deleted.</p>
                <button onClick={() => navigate('/orders')} className="text-sm font-bold text-amber-500 hover:text-amber-600 cursor-pointer transition-colors">
                    ← Return to Orders
                </button>
            </div>
        );
    }

    const customer = order.customer || null;
    const deliveryAddress = order.deliveryAddress || null;
    const pkg = order.package || null;
    const packages = Array.isArray(order.packages) && order.packages.length > 0 ? order.packages : (pkg ? [pkg] : []);
    const items = order.items || [];

    const currentStatusNorm = (order.status || '').replace(/[\s_]+/g, '').toLowerCase();
    const isShipped = currentStatusNorm === 'shipped';
    const isDelivered = currentStatusNorm === 'delivered';
    const isCancelled = currentStatusNorm === 'cancelled';
    const canCancelOrder = ['orderplaced', 'confirmed', 'packing', 'readytoship'].includes(currentStatusNorm);

    const isOrderPlaced = currentStatusNorm === 'orderplaced';

    const getTimelineStatus = (step, currentStatus, deliveryType) => {
        const fullSequence = statusList.length > 0
            ? statusList
            : ['OrderPlaced', 'Confirmed', 'Packing', 'ReadyToShip', 'Shipped', 'Delivered'];
        const sequence = deliveryType === 'DIRECT'
            ? fullSequence.filter(s => {
                const norm = s.toLowerCase();
                return norm === 'orderplaced' || norm === 'confirmed' || norm === 'delivered';
            })
            : fullSequence;
        const normCurrent = (currentStatus || '').replace(/\s+/g, '').toLowerCase();
        const normStep = (step || '').replace(/\s+/g, '').toLowerCase();
        const orderIndex = sequence.findIndex(s => s.replace(/\s+/g, '').toLowerCase() === normCurrent);
        const stepIndex = sequence.findIndex(s => s.replace(/\s+/g, '').toLowerCase() === normStep);
        if (orderIndex === -1) return 'pending';
        if (stepIndex < orderIndex) return 'completed';
        if (stepIndex === orderIndex) return 'current';
        return 'pending';
    };

    const getTrackingStep = (stepName) => {
        if (!trackingData?.items || !Array.isArray(trackingData.items)) return null;
        const norm = stepName.replace(/\s+/g, '').toLowerCase();
        return trackingData.items.find(i => (i.status || '').replace(/\s+/g, '').toLowerCase() === norm);
    };

    const TimelineItem = ({ label, date, time, status }) => {
        const isCompleted = status === 'completed';
        const isCurrent = status === 'current';
        const isItemCancelled = status === 'cancelled';

        return (
            <div className="flex gap-3 relative pb-3 last:pb-0">
                <div className="absolute top-4 left-[9px] bottom-0 w-[1.5px] bg-slate-100 last:hidden" />
                <div className={`relative z-10 mt-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 border-2 ${isItemCancelled ? 'border-red-500 bg-red-500' :
                    isCompleted ? 'border-green-500 bg-green-500' :
                        isCurrent ? 'border-blue-500 bg-blue-500' :
                            'border-slate-200 bg-white'
                    }`}>
                    {isItemCancelled && <X size={9} strokeWidth={3} className="text-white" />}
                    {isCompleted && !isItemCancelled && <Check size={9} strokeWidth={3} className="text-white" />}
                    {isCurrent && !isItemCancelled && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div className="flex-1 flex items-center justify-between min-w-0">
                    <p className={`text-xs font-semibold leading-tight ${isItemCancelled ? 'text-red-600 font-bold' :
                        isCompleted || isCurrent ? 'text-slate-800' : 'text-slate-400'
                        }`}>
                        {label}
                    </p>
                    {date && (
                        <div className="text-right shrink-0 ml-3">
                            <p className={`text-[9px] font-bold leading-tight ${isItemCancelled ? 'text-red-400' : 'text-slate-400'}`}>{date}</p>
                            <p className={`text-[9px] ${isItemCancelled ? 'text-red-400' : 'text-slate-400'}`}>{time}</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-5 pb-10">

            {/* ── Header ────────────────────────────────────────────── */}
            <PageHeader
                title={
                    <div className="flex items-center gap-2">
                        Order #{order.orderNumber}
                        <span className={`text-sm font-bold uppercase border-l border-slate-300 pl-2 ${getOrderStatusColor(order.status)}`}>
                            {formatOrderStatus(order.status)}
                        </span>
                        <span className={`text-xs font-bold uppercase border-l border-slate-300 pl-2 ${getPaymentStatusColor(order.paymentStatus)}`}>
                            {order.paymentStatus || 'UNPAID'}
                        </span>
                    </div>
                }
                subtitle={
                    <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {formatDate(order.createdAt)}
                        &nbsp;at&nbsp;
                        {formatTime(order.createdAt)}
                    </span>
                }
                rightContent={
                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            onClick={() => {
                                if (location.state?.fromCustomerUrl) {
                                    navigate(location.state.fromCustomerUrl);
                                } else if (window.history.length > 1) {
                                    navigate(-1);
                                } else {
                                    navigate('/orders');
                                }
                            }}
                            icon={ArrowLeft}
                        >
                            Back
                        </Button>
                        {isOrderPlaced && (
                            <button
                                onClick={handleConfirmOrder}
                                disabled={confirmingOrder}
                                className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-700 text-white shadow-xs cursor-pointer transition-all disabled:opacity-50"
                            >
                                {confirmingOrder ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                                Confirm Order
                            </button>
                        )}
                        {isCancelled && (
                            <span className="flex items-center gap-1 text-xs font-bold uppercase text-red-600 bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-200">
                                <Ban size={12} /> Cancelled
                            </span>
                        )}
                    </div>
                }
            />

            {/* ── Body ──────────────────────────────────────────────── */}
            <div className="flex flex-col lg:flex-row gap-5 items-start">

                {/* Left — Items + Bill Summary + Payment & Delivery + Comments/History */}
                <div className="flex-1 min-w-0 flex flex-col gap-5 w-full">

                    {/* Order Items Table */}
                    <Card>
                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50/50">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <Package size={15} className="text-amber-500" />
                                Order Items
                            </h3>
                            <div className="flex items-center gap-3">
                                {order.deliveryType === 'DIRECT' ? (
                                    <span className="flex items-center gap-1 text-xs font-bold uppercase text-violet-600">
                                        <Home size={12} /> Direct Delivery
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-xs font-bold uppercase text-blue-600">
                                        <Truck size={12} /> Courier Delivery
                                    </span>
                                )}
                                <span className="text-xs font-medium text-slate-500">
                                    ({items.length} {items.length === 1 ? 'item' : 'items'})
                                </span>
                            </div>
                        </div>



                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/80 border-b border-slate-200">
                                    <TableHead align="center" className="w-14">#</TableHead>
                                    <TableHead>Product Details</TableHead>
                                    <TableHead className="w-32">SKU</TableHead>
                                    <TableHead align="center" className="w-20">Qty</TableHead>
                                    <TableHead align="center" className="w-28">Remaining Qty</TableHead>
                                    <TableHead align="right" className="w-28">Unit Price</TableHead>
                                    <TableHead align="right" className="w-32">Total Amount</TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody padRows={false}>
                                {items.length > 0 ? (
                                    items.map((item, index) => {
                                        const itemId = item.orderItemEdid || item.productEdid || index;
                                        const isCombo = Boolean(item.isCombo);
                                        const unitPrice = Number(item.unitPrice || 0);
                                        const quantity = Number(item.quantity || 1);
                                        const totalPrice =
                                            item.totalPrice !== undefined
                                                ? Number(item.totalPrice)
                                                : unitPrice * quantity;
                                        const name =
                                            item.productNameSnapshot ||
                                            item.productName ||
                                            'Unknown Product';
                                        const sku = item.sku || item.productSku || '—';

                                        return (
                                            <Fragment key={itemId}>
                                                <TableRow className="border-b border-slate-100 transition-colors hover:bg-slate-50/60">
                                                    <TableCell className="w-14 text-center font-mono text-xs text-slate-400">
                                                        {String(index + 1).padStart(2, '0')}
                                                    </TableCell>

                                                    <TableCell className="py-3.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-slate-800 text-xs">
                                                                {name}
                                                            </span>
                                                            {isCombo && (
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                                                                    Combo
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>

                                                    <TableCell className="font-mono text-xs text-slate-600">
                                                        {sku}
                                                    </TableCell>

                                                    <TableCell className="text-center text-xs font-semibold text-slate-700">
                                                        {quantity}
                                                    </TableCell>

                                                    <TableCell className="text-center font-mono text-xs text-slate-700">
                                                        {item.stock !== undefined && item.stock !== null ? Number(item.stock) : '—'}
                                                    </TableCell>

                                                    <TableCell className="text-right font-mono text-xs text-slate-600">
                                                        ₹{unitPrice.toLocaleString('en-IN')}
                                                    </TableCell>

                                                    <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                                                        ₹{totalPrice.toLocaleString('en-IN')}
                                                    </TableCell>
                                                </TableRow>

                                                {isCombo && Array.isArray(item.comboItems) && item.comboItems.length > 0 && (
                                                    <TableRow key={`${itemId}-combo`} className="bg-slate-50/40 border-b border-slate-200">
                                                        <TableCell className="text-center"></TableCell>
                                                        <TableCell colSpan={6} className="py-3 pr-6">
                                                            <div className="rounded-lg border border-slate-200 bg-white p-3">
                                                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-2">
                                                                    Combo Items
                                                                </div>
                                                                <table className="w-full text-xs">
                                                                    <thead>
                                                                        <tr className="border-b border-slate-100">
                                                                            <TableHead className="w-8 py-1.5">#</TableHead>
                                                                            <TableHead className="py-1.5">Product Name</TableHead>
                                                                            <TableHead className="w-36 py-1.5">SKU</TableHead>
                                                                            <TableHead align="center" className="w-24 py-1.5">Qty Per Combo</TableHead>
                                                                            <TableHead align="center" className="w-28 py-1.5">Remaining Qty</TableHead>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100">
                                                                        {item.comboItems.map((ci, cIdx) => (
                                                                            <tr key={ci.productEdid || cIdx}>
                                                                                <td className="py-1.5 font-mono text-[11px] text-slate-400">{cIdx + 1}</td>
                                                                                <td className="py-1.5 font-medium text-slate-700">{ci.productName || ci.name}</td>
                                                                                <td className="py-1.5 font-mono text-[11px] text-slate-500">{ci.sku || ci.productSku || '—'}</td>
                                                                                <td className="py-1.5 text-center font-medium text-slate-700">{ci.quantity ?? ci.qty ?? 1}</td>
                                                                                <td className="py-1.5 text-center font-mono text-[11px] text-slate-600">
                                                                                    {ci.stock !== undefined && ci.stock !== null ? Number(ci.stock) : '—'}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </Fragment>
                                        );

                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="py-14 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                                                    <Package size={22} />
                                                </div>
                                                <p className="text-sm font-semibold text-slate-700">
                                                    No products found
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    No order items have been recorded for this order.
                                                </p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>


                        {/* Bill summary */}
                        <div className="border-t border-slate-200 px-5 py-4 flex justify-end bg-slate-50/30">
                            <div className="w-56 space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Subtotal</span>
                                    <span className="font-bold text-slate-800">₹ {Number(order.subtotal || 0).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Delivery</span>
                                    <span className="font-bold text-slate-800">₹ {Number(order.deliveryCharge || 0).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between text-xs text-green-600">
                                    <span>Discount</span>
                                    <span className="font-bold">-₹ {Number(order.discount || 0).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                                    <span className="text-sm font-black text-slate-900">Grand Total</span>
                                    <span className="text-base font-black text-slate-900">₹ {Number(order.totalAmount || 0).toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Awaiting Order Confirmation Banner */}
                    {isOrderPlaced && (
                        <div className="bg-sky-50/80 border border-sky-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                                    <Package size={18} />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-sky-950">Awaiting Order Confirmation</h4>
                                    <p className="text-[11px] text-sky-700 mt-0.5">Admin confirmation will automatically create individual physical bottles in <code className="font-mono bg-sky-100 px-1 py-0.5 rounded text-[10px]">OrderProductItem</code> for the packing station.</p>
                                </div>
                            </div>
                            <button
                                onClick={handleConfirmOrder}
                                disabled={confirmingOrder}
                                className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-xs cursor-pointer transition-all disabled:opacity-50"
                            >
                                {confirmingOrder ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                                Confirm Order Now
                            </button>
                        </div>
                    )}

                    {/* Physical Bottle Allocation & Batch Verification (OrderProductItem) */}
                    {order.productItems && order.productItems.length > 0 && (
                        <Card className="border border-slate-200 overflow-hidden">
                            <div className="px-5 py-3.5 bg-slate-50/60 border-b border-slate-200 flex items-center justify-between">
                                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                    <Package size={14} className="text-indigo-600" />
                                    Physical Bottle Checklist (<span className="font-mono text-slate-500 font-semibold">OrderProductItem</span>)
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold uppercase text-slate-600">
                                        {order.productItems.filter(p => p.status === 'Packed').length} of {order.productItems.length} Packed
                                    </span>
                                </div>
                            </div>

                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12 text-center">#</TableHead>
                                        <TableHead className="text-left">Bottle Item</TableHead>
                                        <TableHead className="text-left">SKU</TableHead>
                                        <TableHead className="text-left">Assigned Batch</TableHead>
                                        <TableHead className="text-center">Status</TableHead>
                                        <TableHead className="text-left">Packed By</TableHead>
                                        <TableHead className="text-right">Packed At</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody padRows={false}>
                                    {order.productItems.map((pItem, idx) => {
                                        const pStatus = (pItem.status || '').toLowerCase();
                                        return (
                                            <TableRow key={pItem.edid || idx} className="hover:bg-slate-50/50 transition-colors">
                                                <TableCell className="text-center text-xs font-bold text-slate-400">
                                                    #{idx + 1}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-semibold text-slate-800 text-xs block">{pItem.productName}</span>
                                                </TableCell>
                                                <TableCell className="text-left font-mono text-xs text-slate-600">
                                                    {pItem.productSku || '—'}
                                                </TableCell>
                                                <TableCell>
                                                    {pItem.batchNumber ? (
                                                        <span className="font-mono text-xs font-bold text-slate-800">
                                                            {pItem.batchNumber}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs font-medium text-slate-400">
                                                            Pending Assignment
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center font-bold uppercase text-xs">
                                                    <span className={
                                                        pStatus === 'packed'
                                                            ? 'text-emerald-600'
                                                            : pStatus === 'cancelled'
                                                                ? 'text-red-600'
                                                                : 'text-amber-600'
                                                    }>
                                                        {pItem.status}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-600">
                                                    {pItem.packedBy || '—'}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-500">
                                                    {pItem.packedAt ? formatDateTime(pItem.packedAt) : '—'}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </Card>
                    )}

                    {/* Bottom Section: Payment/Delivery (Col 1) and Comments & History (Col 2) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">

                        {/* Column 1: Payment & Delivery Cards */}
                        <div className="flex flex-col gap-4">

                            {/* Payment Tracking Card */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                        <CreditCard size={14} className="text-amber-500" /> Payment Tracking
                                    </h3>
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => setIsPaymentModalOpen(true)}
                                        className="h-7 px-2.5 text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
                                    >
                                        <Plus size={12} strokeWidth={3} /> Record Payment
                                    </Button>
                                </div>

                                {/* Financial Metric Chips */}
                                <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 border border-slate-200/70 rounded-xl mb-3.5 text-center">
                                    <div className="bg-white p-2 rounded-lg border border-slate-200/50">
                                        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Order Total</p>
                                        <p className="text-xs font-black text-slate-800 mt-0.5">₹{Number(order.totalAmount || 0).toLocaleString('en-IN')}</p>
                                    </div>
                                    <div className="bg-white p-2 rounded-lg border border-slate-200/50">
                                        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Received</p>
                                        <p className="text-xs font-black text-emerald-600 mt-0.5">₹{Number(order.amountPaid || 0).toLocaleString('en-IN')}</p>
                                    </div>
                                    <div className="bg-white p-2 rounded-lg border border-slate-200/50">
                                        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Balance Due</p>
                                        <p className={`text-xs font-black mt-0.5 ${Number(order.balanceAmount !== undefined ? order.balanceAmount : Math.max(0, (order.totalAmount || 0) - (order.amountPaid || 0))) > 0
                                            ? 'text-rose-600'
                                            : 'text-emerald-700'
                                            }`}>
                                            ₹{Number(order.balanceAmount !== undefined ? order.balanceAmount : Math.max(0, (order.totalAmount || 0) - (order.amountPaid || 0))).toLocaleString('en-IN')}
                                        </p>
                                    </div>
                                </div>

                                {/* Payment Progress Bar */}
                                {(() => {
                                    const total = Number(order.totalAmount || 0);
                                    const paid = Number(order.amountPaid || 0);
                                    const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
                                    const norm = (order.paymentStatus || 'Unpaid').toUpperCase().replace('_', '');
                                    const isPaid = norm === 'PAID';
                                    const isPartial = norm === 'PARTIALLYPAID';
                                    return (
                                        <div className="mb-4">
                                            <div className="flex justify-between items-center text-[10px] mb-1 font-bold">
                                                <span className="text-slate-500">Payment Coverage ({pct}%)</span>
                                                <span className={`font-bold uppercase text-xs ${isPaid
                                                    ? 'text-emerald-600'
                                                    : isPartial
                                                        ? 'text-amber-600'
                                                        : 'text-rose-600'
                                                    }`}>
                                                    {isPaid ? 'PAID' : isPartial ? 'PARTIALLY PAID' : 'UNPAID'}
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-300'
                                                        }`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Payment Records Table */}
                                <div className="space-y-2 mt-2">
                                    <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                                        <span>Payment Records ({order.payments?.length || 0})</span>
                                        <span className="font-mono text-[9px] text-slate-400">Order ID: {order.orderNumber}</span>
                                    </div>

                                    {order.payments && order.payments.length > 0 ? (
                                        <div className="border border-slate-200 rounded-xl overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="text-left">Date</TableHead>
                                                        <TableHead className="text-left">Method</TableHead>
                                                        <TableHead className="text-left">Type</TableHead>
                                                        <TableHead className="text-left">Reference</TableHead>
                                                        <TableHead className="text-center">Status</TableHead>
                                                        <TableHead className="text-right">Amount</TableHead>
                                                        <TableHead className="text-center">Receipt</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody padRows={false}>
                                                    {order.payments.map((p, idx) => (
                                                        <TableRow key={p.edid || idx} className="hover:bg-slate-50/50 transition-colors">
                                                            <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                                                                {formatDate(p.paymentDate || p.createdAt)}
                                                            </TableCell>
                                                            <TableCell className="text-xs font-bold uppercase text-slate-800">
                                                                {p.paymentMethod || 'UPI'}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-slate-600">
                                                                {p.paymentType || 'Payment'}
                                                            </TableCell>
                                                            <TableCell className="text-xs font-mono text-slate-500 max-w-[130px] truncate" title={p.paymentReference || p.remark || ''}>
                                                                {p.paymentReference || p.remark || '—'}
                                                            </TableCell>
                                                            <TableCell className="text-center text-xs font-bold uppercase">
                                                                <span className={
                                                                    (p.status || '').toLowerCase() === 'success'
                                                                        ? 'text-emerald-600'
                                                                        : (p.status || '').toLowerCase() === 'refunded'
                                                                            ? 'text-purple-600'
                                                                            : 'text-amber-600'
                                                                }>
                                                                    {p.status || 'SUCCESS'}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-right font-bold text-xs text-slate-900 font-mono">
                                                                ₹{Number(p.amount).toLocaleString('en-IN')}
                                                            </TableCell>
                                                            <TableCell className="text-center" style={{ borderLeft: 'none' }}>
                                                                {p.docEdid ? (
                                                                    <Tooltip content="View Receipt">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            icon={Eye}
                                                                            onClick={() => setViewDoc({
                                                                                url: `${API_BASE}/common/attachment/${p.docEdid}`,
                                                                                title: `Payment Receipt (${p.paymentMethod || 'Proof'})`,
                                                                                fileName: p.paymentReference ? `Receipt_${p.paymentReference}` : 'Payment_Receipt'
                                                                            })}
                                                                        />
                                                                    </Tooltip>
                                                                ) : (
                                                                    <span className="text-slate-300 text-xs">—</span>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <div className="p-4 text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                                            <p className="text-xs text-slate-500 font-medium">No payments recorded yet</p>
                                            <button
                                                type="button"
                                                onClick={() => setIsPaymentModalOpen(true)}
                                                className="mt-1 text-xs font-bold text-amber-600 hover:text-amber-700 underline cursor-pointer"
                                            >
                                                Record initial payment
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Delivery Card */}
                            <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-xs">
                                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-3">
                                    <Truck size={13} className="text-amber-500" /> Delivery Details
                                </h3>
                                <div className="flex flex-col gap-3">
                                    {/* Delivery Metric Chips (Type, Charge, Tracking Link) */}
                                    <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 border border-slate-200/70 rounded-xl text-center">
                                        <div className="bg-white p-2 rounded-lg border border-slate-200/50 flex flex-col items-center justify-center">
                                            <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Type</p>
                                            <p className="text-xs font-black text-slate-800 mt-0.5 flex items-center gap-1 uppercase">
                                                {order.deliveryType === 'DIRECT' ? (
                                                    <span className="text-violet-700 flex items-center gap-1">
                                                        <Home size={11} /> Direct
                                                    </span>
                                                ) : (
                                                    <span className="text-blue-700 flex items-center gap-1">
                                                        <Truck size={11} /> Courier
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="bg-white p-2 rounded-lg border border-slate-200/50 flex flex-col items-center justify-center">
                                            <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Charge</p>
                                            <p className="text-xs font-black text-slate-800 mt-0.5">
                                                ₹{Number(order.deliveryCharge || 0).toLocaleString('en-IN')}
                                            </p>
                                        </div>


                                        <div className="bg-white p-2 rounded-lg border border-slate-200/50 flex flex-col items-center justify-center min-w-0 w-full">
                                            <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider text-center leading-tight">
                                                Tracking Link
                                            </p>

                                            <div className="flex items-center justify-center gap-1 mt-1 w-full min-w-0">
                                                <span
                                                    className="text-xs font-black font-mono text-slate-800 truncate min-w-0 max-w-[140px]"
                                                    title={pkg?.tracking || order.trackingId || order.orderNumber}
                                                >
                                                    {pkg?.tracking || order.trackingId || order.orderNumber}
                                                </span>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const text = pkg?.tracking || order.trackingId || order.orderNumber;
                                                        if (text) {
                                                            navigator.clipboard.writeText(text);
                                                            setTrackingCopied(true);
                                                            setTimeout(() => setTrackingCopied(false), 2000);
                                                        }
                                                    }}
                                                    className={`flex-none w-5 h-5 rounded border transition-colors cursor-pointer inline-flex items-center justify-center ${trackingCopied
                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                        : 'bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border-slate-200'
                                                        }`}
                                                    title={trackingCopied ? 'Copied!' : 'Copy Tracking ID'}
                                                >
                                                    {trackingCopied ? (
                                                        <Check size={11} strokeWidth={2.5} />
                                                    ) : (
                                                        <Copy size={11} strokeWidth={2} />
                                                    )}
                                                </button>
                                            </div>
                                        </div>


                                    </div>

                                    {/* Package Info Table */}
                                    {packages.length > 0 && (
                                        <div className="space-y-2 mt-1">
                                            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                                                <span>Package Details ({packages.length})</span>
                                            </div>
                                            <div className="border border-slate-200 rounded-xl overflow-x-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="text-left">Box Material</TableHead>
                                                            <TableHead className="text-left">Dimensions (L × W × H)</TableHead>
                                                            <TableHead className="text-left">Weight</TableHead>
                                                            <TableHead className="text-left">Carrier</TableHead>
                                                            {packages.some(p => p.courierCharge !== null && p.courierCharge !== undefined) && (
                                                                <TableHead className="text-right">Carrier Charge</TableHead>
                                                            )}
                                                            <TableHead className="text-center">Status</TableHead>
                                                            <TableHead className="text-center">Courier Slip</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody padRows={false}>
                                                        {packages.map((p, pIdx) => (
                                                            <TableRow key={p.edid || pIdx} className="hover:bg-slate-50/50 transition-colors">
                                                                <TableCell className="text-xs font-semibold text-slate-800 whitespace-nowrap">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Box size={13} className="text-slate-400 shrink-0" />
                                                                        <span>{p.boxMaterialName || 'Package Box'}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-xs font-mono text-slate-700 whitespace-nowrap">
                                                                    <span className="text-slate-400 font-bold font-sans text-[10px]">L:</span> {p.length || 0}{' '}
                                                                    <span className="text-slate-300">×</span>{' '}
                                                                    <span className="text-slate-400 font-bold font-sans text-[10px]">W:</span> {p.width || 0}{' '}
                                                                    <span className="text-slate-300">×</span>{' '}
                                                                    <span className="text-slate-400 font-bold font-sans text-[10px]">H:</span> {p.height || 0}{' '}
                                                                    <span className="text-slate-500 font-sans text-[11px]">cm</span>
                                                                </TableCell>
                                                                <TableCell className="text-xs font-mono text-slate-600 whitespace-nowrap">
                                                                    {p.weight || 0} kg
                                                                </TableCell>
                                                                <TableCell className="text-xs text-slate-700 whitespace-nowrap">
                                                                    {p.courier || '—'}
                                                                </TableCell>
                                                                {packages.some(pk => pk.courierCharge !== null && pk.courierCharge !== undefined) && (
                                                                    <TableCell className="text-right text-xs font-bold text-slate-900 font-mono whitespace-nowrap">
                                                                        {p.courierCharge !== null && p.courierCharge !== undefined
                                                                            ? `₹${Number(p.courierCharge).toLocaleString('en-IN')}`
                                                                            : '—'}
                                                                    </TableCell>
                                                                )}
                                                                <TableCell className="text-center text-xs font-bold uppercase whitespace-nowrap">
                                                                    <span className="text-emerald-600">
                                                                        {typeof p.status === 'number'
                                                                            ? (p.status === 1 ? 'PACKED' : p.status === 2 ? 'DISPATCHED' : p.status === 3 ? 'DELIVERED' : 'PACKED')
                                                                            : (p.status || 'PACKED')}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="text-center" style={{ borderLeft: 'none' }}>
                                                                    {p.slipDocument ? (
                                                                        <Tooltip content="View Courier Slip">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                icon={Eye}
                                                                                onClick={() => setViewDoc({
                                                                                    url: `${API_BASE}/common/attachment/${p.slipDocument}`,
                                                                                    title: `Courier Slip · Order #${order.orderNumber || ''}`,
                                                                                    fileName: `Courier_Slip_${order.orderNumber || 'package'}`
                                                                                })}
                                                                            />
                                                                        </Tooltip>
                                                                    ) : (
                                                                        <span className="text-slate-300 text-xs">—</span>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>

                        {/* Column 2: Comments & Order History */}
                        <div className="flex flex-col">
                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">

                                {/* Header with Tabs */}
                                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg">
                                        <button
                                            type="button"
                                            onClick={() => setActiveBottomTab('comments')}
                                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${activeBottomTab === 'comments'
                                                ? 'bg-white text-slate-900'
                                                : 'text-slate-500 hover:text-slate-800'
                                                }`}
                                        >
                                            <MessageSquare size={12} className={activeBottomTab === 'comments' ? 'text-amber-500' : 'text-slate-400'} />
                                            Comments
                                            {(comments?.length || 0) > 0 && (
                                                <span className="text-xs font-bold text-amber-600 ml-1">
                                                    ({comments.length})
                                                </span>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveBottomTab('history')}
                                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${activeBottomTab === 'history'
                                                ? 'bg-white text-slate-900'
                                                : 'text-slate-500 hover:text-slate-800'
                                                }`}
                                        >
                                            <Edit size={12} className={activeBottomTab === 'history' ? 'text-amber-500' : 'text-slate-400'} />
                                            Editing History
                                        </button>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400">
                                        {activeBottomTab === 'comments' ? `${comments?.length || 0} notes` : 'Auto-tracked'}
                                    </span>
                                </div>

                                {/* Comments Tab */}
                                {activeBottomTab === 'comments' && (
                                    <div className="flex flex-col">
                                        <div className="px-4 py-3 overflow-y-auto space-y-3 bg-slate-50/30 max-h-[320px]">
                                            {commentsLoading && (!comments || comments.length === 0) ? (
                                                <div className="min-h-[140px] flex flex-col items-center justify-center py-6 text-center text-slate-400">
                                                    <Loader2 size={16} className="animate-spin text-amber-500 mb-2" />
                                                    <p className="text-xs font-medium">Loading comments…</p>
                                                </div>
                                            ) : (!comments || comments.length === 0) ? (
                                                <div className="min-h-[140px] flex flex-col items-center justify-center py-6 text-center">
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                                                        <MessageSquare size={18} />
                                                    </div>
                                                    <p className="text-xs font-semibold text-slate-600">No comments yet</p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">Add an internal note or remark about this order below.</p>
                                                </div>
                                            ) : (
                                                comments.map((comment, cIdx) => (
                                                    <div key={comment.edid || comment.id || cIdx} className="bg-white border border-slate-200/80 rounded-xl p-3">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white font-black text-[9px] flex items-center justify-center">
                                                                    {(comment.author || 'Admin').charAt(0).toUpperCase()}
                                                                </div>
                                                                <span className="text-[11px] font-bold text-slate-800">{comment.author || 'Admin'}</span>
                                                            </div>
                                                            <span className="text-[9px] font-medium text-slate-400">
                                                                {formatDateTime(comment.createdAt)}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap pl-6">{comment.text}</p>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* Input Box Pinned at the Bottom */}
                                        <div className="p-3 border-t border-slate-200 bg-white shrink-0">
                                            <div className="relative flex items-center">
                                                <textarea
                                                    ref={textareaRef}
                                                    value={newComment}
                                                    onChange={(e) => setNewComment(e.target.value)}
                                                    disabled={submittingComment}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            handleAddComment();
                                                        }
                                                    }}
                                                    placeholder="Add a comment or note... (Press Enter to send)"
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-white resize-none pr-10 overflow-hidden transition-all disabled:opacity-60"
                                                    rows={1}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddComment}
                                                    disabled={!newComment.trim() || submittingComment}
                                                    className="absolute right-1.5 bottom-1.5 w-7 h-7 flex items-center justify-center rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-slate-100 text-white disabled:text-slate-300 disabled:cursor-not-allowed transition-all cursor-pointer"
                                                    title="Send comment"
                                                >
                                                    {submittingComment ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* History Tab */}
                                {activeBottomTab === 'history' && (
                                    <div className="flex flex-col">
                                        <div className="divide-y divide-slate-100 overflow-y-auto max-h-[420px]">
                                            {trackingLoading && (!trackingData || !trackingData.items?.length) ? (
                                                <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                                                    <Loader2 size={16} className="animate-spin text-amber-500" />
                                                    <span>Loading tracking audit trail…</span>
                                                </div>
                                            ) : (!trackingData?.items || trackingData.items.length === 0) ? (
                                                <div className="px-5 py-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5">
                                                    <Clock size={20} className="text-slate-300" />
                                                    <p className="font-semibold text-slate-600">No tracking records yet</p>
                                                    <p className="text-[10px] text-slate-400">Events will appear here as the order status changes.</p>
                                                </div>
                                            ) : (
                                                trackingData.items.map((item, idx) => {
                                                    const isLatest = idx === trackingData.items.length - 1;
                                                    const normSt = (item.status || '').toLowerCase();
                                                    return (
                                                        <div key={item.edid || idx} className="px-5 py-3.5 flex items-start gap-3 hover:bg-slate-50/50 transition-colors">
                                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${normSt === 'delivered' ? 'bg-emerald-100 text-emerald-600' :
                                                                normSt === 'shipped' ? 'bg-blue-100 text-blue-600' :
                                                                    normSt === 'readytoship' ? 'bg-indigo-100 text-indigo-600' :
                                                                        normSt === 'confirmed' ? 'bg-sky-100 text-sky-600' :
                                                                            'bg-emerald-100 text-emerald-600'
                                                                }`}>
                                                                {normSt === 'delivered' ? <CheckCircle size={13} /> :
                                                                    normSt === 'shipped' ? <Truck size={13} /> :
                                                                        normSt === 'readytoship' ? <Package size={13} /> :
                                                                            normSt === 'confirmed' ? <Check size={13} strokeWidth={2.5} /> :
                                                                                <Check size={13} strokeWidth={2.5} />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-xs font-bold text-slate-800">{formatOrderStatus(item.status)}</p>
                                                                    {isLatest && (
                                                                        <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded bg-amber-100 text-amber-700">
                                                                            Latest
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                                                                    {item.remarks || `Status set to ${formatOrderStatus(item.status)}`}
                                                                </p>
                                                                {(item.employeeName || item.changedBy) && (
                                                                    <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5">
                                                                        <span className="text-slate-400">By:</span>
                                                                        <span className="font-semibold text-slate-700 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded text-[10px]">
                                                                            {item.employeeName || item.changedBy}
                                                                        </span>
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="shrink-0 text-right ml-2">
                                                                <p className="text-[10px] font-bold text-slate-500">{formatDate(item.changedAt)}</p>
                                                                <p className="text-[9px] text-slate-400 mt-0.5">{formatTime(item.changedAt)}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                        <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                                            <span className="text-[10px] font-bold text-slate-400">Order Audit Trail</span>
                                            <span className="text-[10px] font-medium text-slate-500">
                                                {trackingData?.items?.length || 0} recorded status transitions
                                            </span>
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>

                    </div>
                </div>

                {/* Right — Sidebar: Customer, Order Tracker, Documents */}
                <div className="w-full lg:w-[340px] shrink-0 flex flex-col gap-5">

                    {/* Customer + Address Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                        <div className="px-4 py-3 bg-slate-50/60 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                <User size={13} className="text-amber-500" /> Customer
                            </h3>
                            <button
                                onClick={() => {
                                    if (customer?.customerEdid && customer?.mobile) {
                                        navigate(`/customers/${customer.customerEdid}/${customer.mobile}`);
                                    } else if (customer?.customerEdid) {
                                        navigate(`/customers/${customer.customerEdid}`);
                                    } else {
                                        navigate('/customers');
                                    }
                                }}
                                className="text-[10px] font-bold text-blue-600 flex items-center gap-0.5 cursor-pointer hover:text-blue-700 transition-colors"
                            >
                                View <ChevronRight size={11} />
                            </button>
                        </div>
                        <div className="px-4 py-4">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white font-black text-sm flex items-center justify-center">
                                    {(customer?.name || order.recipientName || order.customerName || deliveryAddress?.recipientName || 'C').charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-sm font-bold text-slate-900 leading-tight truncate">
                                            {customer?.name || order.recipientName || order.customerName || deliveryAddress?.recipientName || 'Customer'}
                                        </p>
                                        {customer?.type && (
                                            <span className="text-xs font-bold uppercase text-indigo-600">
                                                • {customer.type}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                        <Phone size={9} /> {customer?.mobile || order.customerMobile || deliveryAddress?.primaryMobile || '—'}
                                    </p>
                                    {customer?.email && (
                                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                            {customer.email}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Delivery Address */}
                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                        <MapPin size={10} /> Delivery Address
                                    </div>
                                    <span className="text-xs font-bold uppercase text-slate-500">
                                        {deliveryAddress?.addressType?.toUpperCase() || (order.deliveryType === 'STORE_PICKUP' ? 'PICKUP' : 'HOME')}
                                    </span>
                                </div>
                                {deliveryAddress ? (
                                    <p className="text-[11px] text-slate-600 leading-relaxed">
                                        {deliveryAddress.houseStreet}
                                        {deliveryAddress.areaLocality && `, ${deliveryAddress.areaLocality}`}
                                        {deliveryAddress.city && `, ${deliveryAddress.city}`}
                                        {deliveryAddress.district && `, ${deliveryAddress.district}`}
                                        {deliveryAddress.state && `, ${deliveryAddress.state}`}
                                        {deliveryAddress.pincode && ` — ${deliveryAddress.pincode}`}
                                        {deliveryAddress.landmark && <><br /><span className="text-slate-400 text-[10px]">Landmark: {deliveryAddress.landmark}</span></>}
                                        {deliveryAddress.deliveryInstructions && <><br /><span className="text-slate-400 text-[10px]">Instructions: {deliveryAddress.deliveryInstructions}</span></>}
                                    </p>
                                ) : (
                                    <p className="text-[11px] text-slate-400 italic">No delivery address provided.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Order Tracker */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs">
                        <div className="px-4 py-3 bg-slate-50/60 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                <Clock size={13} className="text-amber-500" /> Order Tracker
                            </h3>
                            {trackingLoading && (
                                <Loader2 size={12} className="animate-spin text-amber-500" />
                            )}
                        </div>
                        <div className="px-4 py-4">
                            {(() => {
                                const placedStep = getTrackingStep('OrderPlaced');
                                const confirmedStep = getTrackingStep('Confirmed');
                                const packingStep = getTrackingStep('Packing');
                                const readyStep = getTrackingStep('ReadyToShip');
                                const shippedStep = getTrackingStep('Shipped');
                                const deliveredStep = getTrackingStep('Delivered');

                                const isPaid = (order.paymentStatus || '').toLowerCase() === 'paid';
                                const firstPayment = order.payments?.[0];
                                const payDate = firstPayment?.paymentDate || firstPayment?.createdAt || order.createdAt;

                                return (
                                    <div className="space-y-0">
                                        <TimelineItem
                                            label="Payment Successful"
                                            date={formatDate(payDate)}
                                            time={formatTime(payDate)}
                                            status={isPaid ? 'completed' : 'current'}
                                        />
                                        <TimelineItem
                                            label="Order Placed"
                                            date={formatDate(placedStep?.changedAt || order.createdAt)}
                                            time={formatTime(placedStep?.changedAt || order.createdAt)}
                                            status={getTimelineStatus('OrderPlaced', order.status, order.deliveryType)}
                                        />
                                        <TimelineItem
                                            label="Confirmed"
                                            date={confirmedStep ? formatDate(confirmedStep.changedAt) : null}
                                            time={confirmedStep ? formatTime(confirmedStep.changedAt) : null}
                                            status={getTimelineStatus('Confirmed', order.status, order.deliveryType)}
                                        />
                                        {order.deliveryType !== 'DIRECT' && (
                                            <>
                                                <TimelineItem
                                                    label="Packing"
                                                    date={packingStep ? formatDate(packingStep.changedAt) : null}
                                                    time={packingStep ? formatTime(packingStep.changedAt) : null}
                                                    status={getTimelineStatus('Packing', order.status, order.deliveryType)}
                                                />
                                                <TimelineItem
                                                    label="Ready to Ship"
                                                    date={readyStep ? formatDate(readyStep.changedAt) : null}
                                                    time={readyStep ? formatTime(readyStep.changedAt) : null}
                                                    status={getTimelineStatus('ReadyToShip', order.status, order.deliveryType)}
                                                />
                                                <TimelineItem
                                                    label="Shipped"
                                                    date={shippedStep ? formatDate(shippedStep.changedAt) : null}
                                                    time={shippedStep ? formatTime(shippedStep.changedAt) : null}
                                                    status={getTimelineStatus('Shipped', order.status, order.deliveryType)}
                                                />
                                            </>
                                        )}
                                        {isCancelled ? (
                                            <TimelineItem
                                                label="Order Cancelled"
                                                date={getTrackingStep('Cancelled')?.changedAt ? formatDate(getTrackingStep('Cancelled')?.changedAt) : formatDate(order.updatedAt || order.createdAt)}
                                                time={getTrackingStep('Cancelled')?.changedAt ? formatTime(getTrackingStep('Cancelled')?.changedAt) : formatTime(order.updatedAt || order.createdAt)}
                                                status="cancelled"
                                            />
                                        ) : (
                                            <TimelineItem
                                                label="Delivered"
                                                date={deliveredStep ? formatDate(deliveredStep.changedAt) : null}
                                                time={deliveredStep ? formatTime(deliveredStep.changedAt) : null}
                                                status={getTimelineStatus('Delivered', order.status, order.deliveryType)}
                                            />
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Status Updater */}
                            {(() => {
                                const currentNorm = (order.status || '').replace(/\s+/g, '').toLowerCase();

                                // Rules:
                                // 1) From OrderPlaced: can update to Confirmed
                                // 2) Confirmed / ReadyToShip / Shipped: auto-updated via workflows
                                // 3) Shipped: can update to Delivered
                                // 4) Direct Delivery: Confirmed -> Delivered
                                // 5) Cancelled: terminal status, no updates allowed
                                let allowedStatuses = [];
                                let stationHelper = null;

                                if (currentNorm === 'orderplaced') {
                                    allowedStatuses = ['Confirmed'];
                                } else if (currentNorm === 'shipped') {
                                    allowedStatuses = ['Delivered'];
                                } else if (currentNorm === 'confirmed' && order.deliveryType === 'DIRECT') {
                                    allowedStatuses = ['Delivered'];
                                } else if (currentNorm === 'confirmed' || currentNorm === 'packing') {
                                    stationHelper = {
                                        title: 'Auto-updated at Packing Station',
                                        desc: 'Bottles must be packed and batch-assigned at Packing Station. Status automatically advances to Ready to Ship.',
                                        actionLabel: 'Go to Packing Station',
                                        path: '/packing'
                                    };
                                } else if (currentNorm === 'readytoship') {
                                    stationHelper = {
                                        title: 'Auto-updated at Logistics',
                                        desc: 'Carrier assignment and dispatch occur in Logistics. Status automatically advances to Shipped upon dispatch.',
                                        actionLabel: 'Go to Logistics',
                                        path: '/logistics'
                                    };
                                } else if (currentNorm === 'delivered') {
                                    stationHelper = {
                                        title: 'Order Delivered',
                                        desc: 'All stages complete. Final delivery to customer verified.',
                                        isDelivered: true
                                    };
                                } else if (currentNorm === 'cancelled') {
                                    stationHelper = {
                                        title: 'Order Cancelled',
                                        desc: 'This order was cancelled. Product quantities are released back to inventory.',
                                        isCancelled: true
                                    };
                                }

                                return (
                                    <div className="mt-4" ref={statusMenuRef}>
                                        {allowedStatuses.length > 0 && (
                                            <div>
                                                <div className="relative">
                                                    <button
                                                        onClick={() => {
                                                            setIsStatusMenuOpen(!isStatusMenuOpen);
                                                            if (!isStatusMenuOpen) setPendingStatus(null);
                                                        }}
                                                        className={`w-full flex items-center justify-between gap-2 border text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer transition-all ${isStatusMenuOpen
                                                            ? 'bg-slate-50 border-slate-300 text-slate-900'
                                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <Edit size={11} className="text-amber-500" />
                                                            {pendingStatus ? (
                                                                <span className="flex items-center gap-1.5">
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${getStatusConfig(pendingStatus).dot}`} />
                                                                    {formatOrderStatus(pendingStatus)}
                                                                </span>
                                                            ) : 'Update Status'}
                                                        </span>
                                                        <ChevronRight size={13} className={`text-slate-400 transition-transform duration-200 ${isStatusMenuOpen ? 'rotate-90' : ''}`} />
                                                    </button>

                                                    {isStatusMenuOpen && (
                                                        <div className="absolute top-full left-0 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.1)] overflow-hidden z-50">
                                                            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
                                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Next Allowed Status</p>
                                                            </div>
                                                            <div className="p-1.5 max-h-48 overflow-y-auto">
                                                                {allowedStatuses.map(status => {
                                                                    const isSelected = (pendingStatus || order.status)?.replace(/\s+/g, '').toLowerCase() === status.replace(/\s+/g, '').toLowerCase();
                                                                    const cfg = getStatusConfig(status);
                                                                    return (
                                                                        <button
                                                                            key={status}
                                                                            onClick={() => {
                                                                                setPendingStatus(status);
                                                                                setIsStatusMenuOpen(false);
                                                                            }}
                                                                            className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold flex items-center justify-between cursor-pointer transition-colors ${isSelected ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                                                        >
                                                                            <span className="flex items-center gap-2">
                                                                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                                                {formatOrderStatus(status)}
                                                                            </span>
                                                                            {isSelected && <Check size={11} className="text-amber-500" />}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Save Button */}
                                                {pendingStatus && (
                                                    <div className="mt-2.5">
                                                        <button
                                                            disabled={confirmingOrder}
                                                            onClick={async () => {
                                                                if (pendingStatus.toLowerCase() === 'confirmed') {
                                                                    await executeConfirmOrder();
                                                                } else {
                                                                    try {
                                                                        await orderApi.updateStatus(order.edid || order.id || id, {
                                                                            status: pendingStatus,
                                                                            remarks: pendingStatus.toLowerCase() === 'delivered' ? 'Order delivered to customer' : `Status set to ${pendingStatus}`,
                                                                            changedBy: currentUser?.name || currentUser?.userName || ''
                                                                        });
                                                                        reloadOrder();
                                                                    } catch (e) {
                                                                        console.error("Failed to update status on server:", e);
                                                                        setErrorModal({
                                                                            isOpen: true,
                                                                            title: 'Update Failed',
                                                                            message: e.message || 'Failed to update status.'
                                                                        });
                                                                    }
                                                                }
                                                                setPendingStatus(null);
                                                            }}
                                                            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-all active:scale-95 shadow-xs"
                                                        >
                                                            {confirmingOrder ? <Loader2 size={13} className="animate-spin" /> : <Check size={12} strokeWidth={2.5} />}
                                                            {pendingStatus.toLowerCase() === 'confirmed' ? 'Confirm Order' : `Mark as ${formatOrderStatus(pendingStatus)}`}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Automated Stage Helper Box */}
                                        {stationHelper && (
                                            <div className={`p-3.5 rounded-xl border ${stationHelper.isCancelled
                                                ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                                                : stationHelper.isDelivered
                                                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                                                    : currentNorm === 'readytoship'
                                                        ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900'
                                                        : 'bg-purple-50/70 border-purple-200 text-purple-900'
                                                }`}>
                                                <div className="flex items-center gap-1.5 text-xs font-bold">
                                                    {stationHelper.isCancelled ? (
                                                        <XCircle size={14} className="text-rose-600" />
                                                    ) : stationHelper.isDelivered ? (
                                                        <CheckCircle size={14} className="text-emerald-600" />
                                                    ) : currentNorm === 'readytoship' ? (
                                                        <Truck size={14} className="text-indigo-600" />
                                                    ) : (
                                                        <Box size={14} className="text-purple-600" />
                                                    )}
                                                    {stationHelper.title}
                                                </div>
                                                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                                                    {stationHelper.desc}
                                                </p>
                                                {stationHelper.path && (
                                                    <button
                                                        onClick={() => {
                                                            const orderNum = order?.orderNumber || order?.orderNo || paramOrderNumber || (id && id.startsWith('ORD-') ? id : '');
                                                            const targetUrl = orderNum
                                                                ? `${stationHelper.path}?orderNumber=${encodeURIComponent(orderNum)}`
                                                                : stationHelper.path;
                                                            navigate(targetUrl, { state: { orderNumber: orderNum } });
                                                        }}
                                                        className={`mt-2.5 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all cursor-pointer shadow-xs ${currentNorm === 'readytoship'
                                                            ? 'bg-indigo-600 hover:bg-indigo-700'
                                                            : 'bg-purple-600 hover:bg-purple-700'
                                                            }`}
                                                    >
                                                        {stationHelper.actionLabel} →
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Documents */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                        <div className="px-4 py-3 bg-slate-50/60 border-b border-slate-200">
                            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                <Printer size={13} className="text-amber-500" /> Documents
                            </h3>
                        </div>
                        <div className="px-4 py-3 flex flex-col gap-2">
                            {[
                                ...(isCancelled ? [] : [{ label: 'Delivery Slip', type: 'delivery', icon: Package, color: 'bg-indigo-50 text-indigo-600' }]),
                                { label: 'Invoice', type: 'invoice', icon: FileText, color: 'bg-emerald-50 text-emerald-600' },
                                { label: 'Order Details', type: 'summary', icon: File, color: 'bg-blue-50 text-blue-600' },
                            ].map(({ label, type, icon: Icon, color }) => (
                                <button
                                    key={label}
                                    onClick={() => {
                                        setPrintDocType(type);
                                        setIsPrintModalOpen(true);
                                    }}
                                    className="flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-xl cursor-pointer group transition-all"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center`}>
                                            <Icon size={13} />
                                        </div>
                                        <span className="text-xs font-bold text-slate-700">{label}</span>
                                    </div>
                                    <Printer size={13} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                                </button>
                            ))}

                            {canCancelOrder && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCancelRemark('');
                                        setIsCancelModalOpen(true);
                                    }}
                                    className="flex items-center justify-center gap-2 mt-1 py-2.5 rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-100/70 cursor-pointer transition-all group"
                                >
                                    <Ban size={12} className="text-red-400 group-hover:text-red-500 transition-colors" />
                                    <span className="text-[11px] font-bold text-red-500 group-hover:text-red-600 uppercase tracking-wide transition-colors">
                                        Cancel Order
                                    </span>
                                </button>
                            )}

                            {isCancelled && (
                                <div className="flex items-center justify-center gap-1.5 mt-1 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600">
                                    <Ban size={13} className="text-red-500" />
                                    <span className="text-[11px] font-bold uppercase tracking-wide">
                                        Order Cancelled
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>

            {/* Modals for Payment Tracking and Professional Printing */}
            <RecordPaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                order={order}
                onPaymentRecorded={() => {
                    reloadOrder();
                }}
            />

            <OrderPrintModal
                isOpen={isPrintModalOpen}
                onClose={() => setIsPrintModalOpen(false)}
                order={order}
                initialType={printDocType}
            />

            {/* Confirm Order Component Modal (replaces browser native window.confirm) */}
            <ConfirmModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={executeConfirmOrder}
                title="Confirm Order"
                message={`Confirm Order #${order?.orderNumber}? This will verify the order and generate individual physical bottle records in OrderProductItem for the packing station.`}
                confirmText="Confirm Order"
                cancelText="Cancel"
                variant="info"
                isLoading={confirmingOrder}
            />

            {/* Cancel Order Modal with Required Remark */}
            <Modal
                isOpen={isCancelModalOpen}
                onClose={() => !cancellingOrder && setIsCancelModalOpen(false)}
                title="Cancel Order"
                className="max-w-md"
            >
                <form onSubmit={handleExecuteCancelOrder} className="space-y-4">
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2.5">
                        <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">Are you sure you want to cancel Order #{order?.orderNumber}?</p>
                            <p className="text-[11px] text-red-700 mt-1 leading-relaxed">
                                Product stock will be returned to inventory. Cancellation is only allowed for orders with status Order Placed, Confirmed, Packing, or Ready to Ship. Shipped or Delivered orders cannot be cancelled.
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Cancellation Remark / Reason <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            required
                            autoFocus
                            rows={3}
                            placeholder="Enter the reason for cancelling this order (e.g. Customer cancelled, Payment discrepancy, Duplicate order)..."
                            value={cancelRemark}
                            onChange={(e) => setCancelRemark(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-slate-400 transition-all resize-none font-medium text-slate-800"
                        />
                    </div>

                    <div className="flex gap-2.5 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsCancelModalOpen(false)}
                            disabled={cancellingOrder}
                            className="flex-1 text-xs"
                        >
                            Keep Order
                        </Button>
                        <Button
                            type="submit"
                            disabled={cancellingOrder || !cancelRemark.trim()}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
                        >
                            {cancellingOrder ? (
                                <><Loader2 size={13} className="animate-spin" /> Cancelling...</>
                            ) : (
                                'Confirm Cancellation'
                            )}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Notice / Alert Modal Component (replaces browser native window.alert) */}
            <ConfirmModal
                isOpen={errorModal.isOpen}
                onClose={() => setErrorModal({ isOpen: false, title: '', message: '' })}
                title={errorModal.title || 'Notice'}
                message={errorModal.message}
                confirmText="OK"
                isAlert={true}
                variant="danger"
            />

            {/* Document View Pop Modal */}
            <DocumentViewModal
                isOpen={Boolean(viewDoc)}
                onClose={() => setViewDoc(null)}
                url={viewDoc?.url}
                title={viewDoc?.title || 'Document Preview'}
                fileName={viewDoc?.fileName || ''}
            />
        </div>
    );
}
