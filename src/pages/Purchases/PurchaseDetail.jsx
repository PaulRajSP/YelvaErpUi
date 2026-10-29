import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { purchaseApi } from '../../api/purchaseApi';
import { commonApi } from '../../api/commonApi';
import { API_BASE } from '../../services/apiClient';
import {
    ArrowLeft, Building2, Package, Phone, Calendar, AlertCircle, Ban, Eye, Loader2, Plus, Printer, Wallet, CreditCard, FileText, Upload, X
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { Input } from '../../components/ui/Input';
import { Pagination } from '../../components/ui/Pagination';
import { formatDate, PAGE_SIZE } from '../../common/utils';
import Dropdown from '../../components/common/Dropdown';
import DocumentViewModal from '../../components/common/DocumentViewModal';
import ConfirmModal from '../../components/common/ConfirmModal';

const STATUS_CONFIG = {
    PAID: { dot: 'bg-emerald-500', color: 'text-emerald-600', label: 'PAID' },
    UNPAID: { dot: 'bg-rose-500', color: 'text-rose-600', label: 'UNPAID' },
    PARTIAL: { dot: 'bg-amber-500', color: 'text-amber-600', label: 'PARTIAL' },
};

const getPurchaseStatusColor = (status) => {
    const norm = (status || '').toUpperCase().replace(/[\s_]+/g, '');
    if (norm === 'PAID') return 'text-emerald-600';
    if (norm === 'PARTIAL' || norm === 'PARTIALLYPAID') return 'text-amber-600';
    return 'text-rose-600';
};

export default function PurchaseDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { rawMaterials, loadRawMaterials } = useStore();

    const [purchase, setPurchase] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [payAmount, setPayAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("Cash");
    const [paymentType, setPaymentType] = useState("Advance");
    const [paymentStatus, setPaymentStatus] = useState("Success");
    const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [paymentReference, setPaymentReference] = useState("");
    const [paymentRemark, setPaymentRemark] = useState("");
    const [paymentAttachments, setPaymentAttachments] = useState([]);
    const [uploadingPaymentAttachments, setUploadingPaymentAttachments] = useState(false);
    const [isPaying, setIsPaying] = useState(false);
    const isPayingRef = useRef(false);
    
    const [viewDoc, setViewDoc] = useState(null);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancelRemark, setCancelRemark] = useState("");
    const [cancellingPurchase, setCancellingPurchase] = useState(false);
    const [errorModal, setErrorModal] = useState({ isOpen: false, title: '', message: '' });

    const [itemsPage, setItemsPage] = useState(1);
    const [itemsTotalCount, setItemsTotalCount] = useState(0);
    const [refreshCounter, setRefreshCounter] = useState(0);

    const reloadPurchase = () => setRefreshCounter(c => c + 1);

    const paymentMethodOptions = [
        { value: 'UPI', label: 'UPI / QR Code' },
        { value: 'BankTransfer', label: 'Bank Transfer' },
        { value: 'Cash', label: 'Cash' },
        { value: 'Card', label: 'Debit / Credit Card' },
        { value: 'Gateway', label: 'Payment Gateway' }
    ];
    const paymentTypeOptions = [
        { value: 'FullPayment', label: 'Full Payment' },
        { value: 'Advance', label: 'Advance Payment' },
        { value: 'Balance', label: 'Balance Payment' }
    ];
    const paymentStatusOptions = [
        { value: 'Success', label: 'Success (Received)' },
        { value: 'Pending', label: 'Pending Verification' },
        { value: 'Failed', label: 'Failed' },
        { value: 'Cancelled', label: 'Cancelled' },
        { value: 'Refunded', label: 'Refunded' }
    ];

    const handlePaymentAttachmentUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        setUploadingPaymentAttachments(true);
        try {
            const uploaded = await Promise.all(files.map(async file => {
                const res = await commonApi.uploadAttachment(file);
                const data = res?.data || res;
                const attachmentEdid = data?.attachmentEdid || data?.documentEdid || data?.edid;
                return attachmentEdid ? {
                    attachmentEdid,
                    attachmentOriginalName: data?.attachmentOriginalName || data?.documentOriginalName || file.name,
                    attachmentType: 'Receipt',
                    remarks: ''
                } : null;
            }));
            setPaymentAttachments(prev => [...prev, ...uploaded.filter(Boolean)]);
        } catch (err) {
            setErrorModal({ isOpen: true, title: 'Upload Failed', message: err.message || 'Could not upload payment proof.' });
        } finally {
            setUploadingPaymentAttachments(false);
            e.target.value = '';
        }
    };

    /* ── Data Fetching ────────────────────────────────────────── */
    const fetchPurchaseDetails = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch both in parallel
            const [detailsRes, itemsRes] = await Promise.all([
                purchaseApi.getPurchaseById(id),
                purchaseApi.getPurchaseItems(id, 1)
            ]);
            
            // Safely parse details
            const purchaseData = detailsRes?.data || detailsRes;
            
            // Safely parse items (handles both `itemsRes.items` and `itemsRes.data.items`)
            const itemsData = itemsRes?.data || itemsRes;
            const fetchedItems = itemsData?.items || itemsRes?.items || [];
            const totalCount = itemsData?.totalCount || itemsRes?.totalCount || 0;

            if (purchaseData && (purchaseData.edid || purchaseData.publicId)) {
                setPurchase({
                    ...purchaseData,
                    items: fetchedItems
                });
                setItemsTotalCount(totalCount);
                setItemsPage(1);
                setError(null);
            } else {
                setError("Invalid purchase data received");
            }
        } catch (err) {
            console.error("Failed to load purchase details:", err);
            setError(err.message || 'Failed to load purchase');
        } finally {
            setLoading(false);
        }
    }, [id]);

    const fetchPurchaseItems = async (page) => {
        try {
            const itemsRes = await purchaseApi.getPurchaseItems(id, page);
            const itemsData = itemsRes?.data || itemsRes;
            setPurchase(prev => ({
                ...prev,
                items: itemsData?.items || itemsRes?.items || []
            }));
            setItemsTotalCount(itemsData?.totalCount || itemsRes?.totalCount || 0);
            setItemsPage(page);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        loadRawMaterials();
        fetchPurchaseDetails();
    }, [loadRawMaterials, fetchPurchaseDetails, refreshCounter]);

    /* ── Actions ──────────────────────────────────────────────── */
    const handlePayDue = async () => {
        if (isPayingRef.current || isPaying || uploadingPaymentAttachments) return;
        const amount = parseFloat(payAmount);
        const maxAllowed = paymentStatus === 'Refunded' ? Number(purchase?.paidAmount || 0) : Number(purchase?.balance || 0);
        
        if (!amount || amount <= 0 || amount > maxAllowed) {
            setErrorModal({ isOpen: true, title: 'Invalid Amount', message: paymentStatus === 'Refunded' ? 'Refund cannot exceed the amount already paid.' : 'Please enter a valid amount. Cannot exceed balance due.' });
            return;
        }
        if (paymentMethod !== 'Cash' && !paymentReference.trim()) {
            setErrorModal({ isOpen: true, title: 'Reference Required', message: 'Enter the transaction reference for this payment method.' });
            return;
        }
        if (paymentMethod !== 'Cash' && paymentAttachments.length === 0) {
            setErrorModal({ isOpen: true, title: 'Receipt Required', message: 'Attach payment proof for this payment method.' });
            return;
        }
        
        try {
            isPayingRef.current = true;
            setIsPaying(true);
            const res = await purchaseApi.payPurchaseDue({
                purchaseEdid: purchase.edid,
                amount,
                paymentMethod,
                paymentType,
                status: paymentStatus,
                paymentReference: paymentReference.trim() || null,
                remarks: paymentRemark.trim() || null,
                paymentDate: paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString(),
                attachmentData: paymentAttachments.map(({ attachmentEdid, attachmentType, remarks }) => ({ attachmentEdid, attachmentType, remarks }))
            });
            if (res && res.success !== false) {
                setIsPaymentModalOpen(false);
                setPayAmount("");
                setPaymentMethod("Cash");
                setPaymentType("Advance");
                setPaymentStatus("Success");
                setPaymentDate(new Date().toISOString().slice(0, 10));
                setPaymentReference("");
                setPaymentRemark("");
                setPaymentAttachments([]);
                reloadPurchase();
            } else {
                setErrorModal({ isOpen: true, title: 'Payment Failed', message: res?.message || "Payment failed" });
            }
        } catch (err) {
            setErrorModal({ isOpen: true, title: 'Payment Failed', message: err.message || "Something went wrong" });
        } finally {
            isPayingRef.current = false;
            setIsPaying(false);
        }
    };

    const handleCancelPurchase = async (e) => {
        e.preventDefault();
        if (!cancelRemark.trim()) return;
        
        try {
            setCancellingPurchase(true);
            if (purchaseApi.cancelPurchase) {
                await purchaseApi.cancelPurchase(purchase.edid, { remarks: cancelRemark });
            }
            setIsCancelModalOpen(false);
            setCancelRemark('');
            reloadPurchase();
        } catch (err) {
            setErrorModal({ isOpen: true, title: 'Cancellation Failed', message: err.message });
        } finally {
            setCancellingPurchase(false);
        }
    };

    /* ── Render States ────────────────────────────────────────── */
    if (loading && !purchase) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <Loader2 size={36} className="animate-spin text-indigo-600" />
                <p className="text-sm font-medium text-slate-500">Loading purchase details…</p>
            </div>
        );
    }

    if (!purchase) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                    <Package size={28} className="text-slate-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Purchase Not Found</h2>
                <p className="text-sm text-slate-400">{error || "The requested purchase could not be located."}</p>
                <button onClick={() => navigate('/purchases')} className="text-sm font-bold text-amber-500 hover:text-amber-600 cursor-pointer transition-colors">
                    ← Return to Purchases
                </button>
            </div>
        );
    }

    /* ── Derived Values ───────────────────────────────────────── */
    const total = Number(purchase.totalAmount || 0);
    const amountPaid = Number(purchase.paidAmount || 0);
    const amountDue = Number(purchase.balance || (total - amountPaid));
    const paidPercent = total > 0 ? Math.min(100, Math.round((amountPaid / total) * 100)) : 0;
    const isFullyPaid = purchase.status === 'PAID';
    const items = purchase.items || [];

    return (
        <div className="space-y-5 pb-10">
            {/* ── Header ────────────────────────────────────────────── */}
            <PageHeader
                title={
                    <div className="flex items-center gap-2">
                        Purchase #{purchase.publicId}
                        <span className={`text-sm font-bold uppercase border-l border-slate-300 pl-2 ${getPurchaseStatusColor(purchase.status)}`}>
                            {purchase.status}
                        </span>
                    </div>
                }
                subtitle={
                    <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {formatDate(purchase.date)}
                    </span>
                }
                rightContent={
                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            onClick={() => navigate('/purchases')}
                            icon={ArrowLeft}
                        >
                            Back
                        </Button>
                    </div>
                }
            />

            {/* ── Body Layout ───────────────────────────────────────── */}
            <div className="flex flex-col lg:flex-row gap-5 items-start">

                {/* Left Column (Main Content) */}
                <div className="flex-1 min-w-0 flex flex-col gap-5 w-full">
                    
                    {/* Items Table */}
                    <Card>
                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50/50">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <Package size={15} className="text-amber-500" />
                                Purchase Items
                            </h3>
                            <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1 text-xs font-bold uppercase text-indigo-600">
                                    <Building2 size={12} /> {purchase.supplierName}
                                </span>
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
                                    <TableHead className="w-32">Category</TableHead>
                                    <TableHead className="w-32">Batch</TableHead>
                                    <TableHead align="center" className="w-20">Qty</TableHead>
                                    <TableHead align="right" className="w-28">Rate / Unit</TableHead>
                                    <TableHead align="right" className="w-32">Total Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody padRows={false}>
                                {items.length > 0 ? (
                                    items.map((item, index) => {
                                        return (
                                            <TableRow key={index} className="border-b border-slate-100 transition-colors hover:bg-slate-50/60">
                                                <TableCell className="w-14 text-center font-mono text-xs text-slate-400">
                                                    {String(index + 1).padStart(2, '0')}
                                                </TableCell>
                                                <TableCell className="py-3.5">
                                                    <span className="font-semibold text-slate-800 text-xs">{item.materialName}</span>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs text-slate-600">
                                                    <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 font-semibold">{item.categoryName}</span>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs text-slate-600">{item.batchNumber || '—'}</TableCell>
                                                <TableCell className="text-center text-xs font-semibold text-slate-700">
                                                    {item.qty} <span className="text-[10px] text-slate-400">{item.unitSymbol}</span>
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs text-slate-600">
                                                    ₹{Number(item.rate || 0).toLocaleString('en-IN')}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                                                    ₹{Number(item.total || 0).toLocaleString('en-IN')}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="py-14 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                                                    <Package size={22} />
                                                </div>
                                                <p className="text-sm font-semibold text-slate-700">No items found</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>

                        {itemsTotalCount > PAGE_SIZE && (
                            <div className="px-5 py-3 border-t border-slate-200 bg-white">
                                <Pagination
                                    currentPage={itemsPage}
                                    totalPages={Math.ceil(itemsTotalCount / PAGE_SIZE)}
                                    onPageChange={(page) => fetchPurchaseItems(page)}
                                    totalItems={itemsTotalCount}
                                    itemsPerPage={PAGE_SIZE}
                                />
                            </div>
                        )}

                        {/* Bill summary */}
                        <div className="border-t border-slate-200 px-5 py-4 flex justify-end bg-slate-50/30">
                            <div className="w-56 space-y-2">
                                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                                    <span className="text-sm font-black text-slate-900">Grand Total</span>
                                    <span className="text-base font-black text-slate-900">₹ {total.toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Payment Tracking */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                <Wallet size={14} className="text-amber-500" /> Payment Tracking
                            </h3>
                            {!isFullyPaid && (
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => {
                                        setPayAmount("");
                                        setPaymentMethod("Cash");
                                        setPaymentReference("");
                                        setPaymentRemark("");
                                        setIsPaymentModalOpen(true);
                                    }}
                                    className="h-7 px-2.5 text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
                                >
                                    <Plus size={12} strokeWidth={3} /> Record Payment
                                </Button>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 border border-slate-200/70 rounded-xl mb-3.5 text-center">
                            <div className="bg-white p-2 rounded-lg border border-slate-200/50">
                                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Purchase Total</p>
                                <p className="text-xs font-black text-slate-800 mt-0.5">₹{total.toLocaleString('en-IN')}</p>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-slate-200/50">
                                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Paid</p>
                                <p className="text-xs font-black text-emerald-600 mt-0.5">₹{amountPaid.toLocaleString('en-IN')}</p>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-slate-200/50">
                                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Balance Due</p>
                                <p className={`text-xs font-black mt-0.5 ${amountDue > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                    ₹{amountDue.toLocaleString('en-IN')}
                                </p>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center text-[10px] mb-1 font-bold">
                                <span className="text-slate-500">Payment Coverage ({paidPercent}%)</span>
                                <span className={`font-bold uppercase text-xs ${getPurchaseStatusColor(purchase.status)}`}>
                                    {purchase.status}
                                </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${paidPercent >= 100 ? 'bg-emerald-500' : paidPercent > 0 ? 'bg-amber-500' : 'bg-slate-300'}`}
                                    style={{ width: `${paidPercent}%` }}
                                />
                            </div>
                        </div>

                        <div className="mt-5 border-t border-slate-200 pt-4">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Payment history</h4>
                                <span className="text-[10px] font-semibold text-slate-400">{purchase.payments?.length || 0} records</span>
                            </div>
                            {purchase.payments?.length ? (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50/70">
                                                <TableHead>Date</TableHead>
                                                <TableHead>Transaction</TableHead>
                                                <TableHead>Method</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Reference / Remark</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead align="right">Amount</TableHead>
                                                <TableHead align="center">Receipt</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody padRows={false}>
                                            {purchase.payments.map((payment, index) => (
                                                <TableRow key={payment.edid || index}>
                                                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">{formatDate(payment.paymentDate)}</TableCell>
                                                    <TableCell className="text-xs font-mono text-slate-500">{payment.transactionNumber || '—'}</TableCell>
                                                    <TableCell className="text-xs font-semibold text-slate-700">{payment.paymentMethod || 'Cash'}</TableCell>
                                                    <TableCell className="text-xs text-slate-600">{payment.paymentType || 'Advance'}</TableCell>
                                                    <TableCell className="text-xs text-slate-500">{payment.paymentReference || payment.remarks || '—'}</TableCell>
                                                    <TableCell className={`text-xs font-bold ${payment.status === 'Success' ? 'text-emerald-600' : payment.status === 'Refunded' ? 'text-rose-600' : 'text-amber-600'}`}>{payment.status || 'Success'}</TableCell>
                                                    <TableCell className={`text-right text-xs font-bold ${payment.status === 'Refunded' ? 'text-rose-600' : 'text-slate-900'}`}>{payment.status === 'Refunded' ? '−' : ''}₹{Number(payment.amount || 0).toLocaleString('en-IN')}</TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex justify-center gap-1">
                                                            {payment.attachmentData?.map((attachment, attachmentIndex) => {
                                                                const fileName = attachment.attachmentOriginalName || `Payment_Receipt_${attachmentIndex + 1}`;
                                                                return <Button key={attachment.attachmentEdid || attachmentIndex} variant="ghost" size="icon" icon={FileText} title={fileName} onClick={() => setViewDoc({
                                                                    url: `${API_BASE}/common/attachment/${encodeURIComponent(attachment.attachmentEdid)}/${encodeURIComponent(fileName)}`,
                                                                    title: fileName,
                                                                    fileName
                                                                })} />;
                                                            })}
                                                            {!payment.attachmentData?.length && <span className="text-slate-300">—</span>}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <p className="py-4 text-center text-xs text-slate-400">No payment records yet</p>
                            )}
                        </div>
                    </div>

                </div>

                {/* Right Sidebar */}
                <div className="w-full lg:w-[340px] shrink-0 flex flex-col gap-5">
                    
                    {/* Supplier Info Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                        <div className="px-4 py-3 bg-slate-50/60 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                <Building2 size={13} className="text-amber-500" /> Supplier
                            </h3>
                        </div>
                        <div className="px-4 py-4">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-black text-sm flex items-center justify-center shrink-0">
                                    {purchase.supplierName?.charAt(0).toUpperCase() || 'S'}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-900 leading-tight truncate">
                                        {purchase.supplierName}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                        <Calendar size={10} /> Purchase Date
                                    </div>
                                </div>
                                <p className="text-[11px] font-bold text-slate-700">
                                    {formatDate(purchase.date)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Documents Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                        <div className="px-4 py-3 bg-slate-50/60 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                <Printer size={13} className="text-amber-500" /> Documents
                            </h3>
                        </div>
                        <div className="px-4 py-3 flex flex-col gap-2">
                            {purchase.attachmentData && purchase.attachmentData.length > 0 ? (
                                purchase.attachmentData.map((attachment, index) => {
                                    const attachmentEdid = attachment.attachmentEdid;
                                    const fileName = attachment.attachmentOriginalName;
                                    return (
                                        <button
                                            key={attachmentEdid || index}
                                            onClick={() => setViewDoc({
                                                url: `${API_BASE}/common/attachment/${encodeURIComponent(attachmentEdid)}/${encodeURIComponent(fileName)}`,
                                                title: fileName,
                                                fileName
                                            })}
                                            className="flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-xl cursor-pointer group transition-all"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                                    <FileText size={13} />
                                                </div>
                                                <div className="min-w-0 flex-1 text-left">
                                                    <span className="text-xs font-bold text-slate-700 truncate block">{fileName}</span>
                                                    <span className="text-[10px] text-slate-500">{attachment.attachmentType}</span>
                                                </div>
                                            </div>
                                            <Eye size={13} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0 ml-2" />
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="py-6 text-center">
                                    <FileText size={20} className="mx-auto text-slate-300 mb-2" />
                                    <p className="text-[11px] font-semibold text-slate-600">No documents</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cancel Purchase Action */}
                    {!isFullyPaid && (
                        <button
                            type="button"
                            onClick={() => { setCancelRemark(''); setIsCancelModalOpen(true); }}
                            className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-100/70 cursor-pointer transition-all group w-full shadow-xs"
                        >
                            <Ban size={12} className="text-red-400 group-hover:text-red-500 transition-colors" />
                            <span className="text-[11px] font-bold text-red-500 group-hover:text-red-600 uppercase tracking-wide transition-colors">
                                Cancel Purchase
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {/* ── Modals ────────────────────────────────────────────── */}
            
            <Modal isOpen={isPaymentModalOpen} onClose={() => !isPaying && setIsPaymentModalOpen(false)} title="Record Payment" className="max-w-xl">
                <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                            <CreditCard size={26} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900">Pay Due</h3>
                            <p className="text-sm text-slate-500 font-medium">Complete the pending amount</p>
                        </div>
                    </div>

                    <div className="bg-rose-50/70 rounded-2xl p-5 border border-rose-100">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-slate-800 font-bold text-sm">Due Amount</span>
                            <span className="bg-white text-rose-600 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold shadow-sm">
                                Pending
                            </span>
                        </div>
                        <div className="text-3xl font-black text-rose-600 tracking-tight mt-1">
                            <span className="text-2xl text-rose-500 mr-1">₹</span>{amountDue.toLocaleString('en-IN')}
                        </div>
                    </div>

                    <div>
                        <label className="block text-slate-700 font-bold text-sm mb-2 ml-1">Payment Amount</label>
                        <div className="relative">
                            <span className="absolute left-3.5 top-3 text-slate-400 font-bold text-sm">₹</span>
                            <Input
                                type="number" min="0" max={amountDue} step="0.01"
                                value={payAmount}
                                onChange={e => {
                                    let val = e.target.value;
                                    if (val === '') { setPayAmount(''); return; }
                                    const num = parseFloat(val);
                                    if (num < 0) setPayAmount("0");
                                    else if (num > amountDue) setPayAmount(amountDue.toString());
                                    else setPayAmount(val);
                                }}
                                className="w-full pl-8 h-12 text-base font-bold text-slate-900 rounded-xl"
                                placeholder="0.00"
                                autoFocus
                                disabled={isPaying}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Dropdown label="Payment Method" value={paymentMethod} options={paymentMethodOptions} onChange={setPaymentMethod} className="w-full" disabled={isPaying} />
                        <Dropdown label="Payment Type" value={paymentType} options={paymentTypeOptions} onChange={setPaymentType} className="w-full" disabled={isPaying} />
                        <Dropdown label="Payment Status" value={paymentStatus} options={paymentStatusOptions} onChange={setPaymentStatus} className="w-full" disabled={isPaying} />
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Payment Date</label>
                            <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} disabled={isPaying} className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 disabled:bg-slate-100 disabled:text-slate-400" />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-slate-700 font-bold text-sm mb-2 ml-1">Transaction Reference / UTR {paymentMethod !== 'Cash' && <span className="text-rose-500">*</span>}</label>
                            <Input value={paymentReference} onChange={e => setPaymentReference(e.target.value)} disabled={isPaying} placeholder={paymentMethod === 'Cash' ? 'Optional receipt / voucher number' : 'UPI reference / bank UTR / cheque number'} />
                        </div>
                        <div>
                            <label className="block text-slate-700 font-bold text-sm mb-2 ml-1">Remark</label>
                            <Input value={paymentRemark} onChange={e => setPaymentRemark(e.target.value)} disabled={isPaying} placeholder="Optional payment note" />
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Payment Proof / Receipt {paymentMethod !== 'Cash' && <span className="text-rose-500">*</span>}</label>
                            <span className="text-[10px] text-slate-400">{paymentMethod === 'Cash' ? 'Optional' : 'Required'}</span>
                        </div>
                        <div className="space-y-2 mb-2">
                            {paymentAttachments.map((attachment, index) => (
                                <div key={attachment.attachmentEdid} className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                                    <span className="text-xs font-semibold text-slate-700 truncate">{attachment.attachmentOriginalName}</span>
                                    <button type="button" onClick={() => setPaymentAttachments(prev => prev.filter((_, i) => i !== index))} disabled={isPaying} className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-40" title="Remove receipt"><X size={14} /></button>
                                </div>
                            ))}
                        </div>
                        <label className="flex items-center justify-center gap-2 p-3 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50">
                            <input type="file" multiple accept="image/*,.pdf" onChange={handlePaymentAttachmentUpload} className="hidden" disabled={isPaying || uploadingPaymentAttachments} />
                            {uploadingPaymentAttachments ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                            <span className="text-xs font-semibold text-slate-600">{uploadingPaymentAttachments ? 'Uploading…' : 'Attach payment proof'}</span>
                        </label>
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                        <Button
                            className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none transition-all"
                            onClick={handlePayDue}
                            disabled={isPaying || uploadingPaymentAttachments || !parseFloat(payAmount) || parseFloat(payAmount) <= 0 || parseFloat(payAmount) > amountDue}
                        >
                            {isPaying ? (
                                <>
                                    <Loader2 size={18} className="animate-spin text-white" />
                                    <span>Processing Payment...</span>
                                </>
                            ) : (
                                <>
                                    <CreditCard size={18} />
                                    <span>Pay Now ₹{parseFloat(payAmount) ? parseFloat(payAmount).toLocaleString('en-IN') : '0'}</span>
                                </>
                            )}

                        </Button>
                        <Button
                            variant="secondary"
                            className="w-full h-11 rounded-xl font-bold text-sm text-slate-600 bg-white border-slate-200 hover:bg-slate-50"
                            onClick={() => !isPaying && setIsPaymentModalOpen(false)}
                            disabled={isPaying}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isCancelModalOpen} onClose={() => !cancellingPurchase && setIsCancelModalOpen(false)} title="Cancel Purchase" className="max-w-md">
                <form onSubmit={handleCancelPurchase} className="space-y-4">
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2.5">
                        <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">Are you sure you want to cancel this purchase?</p>
                            <p className="text-[11px] text-red-700 mt-1 leading-relaxed">
                                This action cannot be undone. Inventory stock will be adjusted accordingly.
                            </p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Cancellation Remark <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            required autoFocus rows={3}
                            placeholder="Enter the reason for cancelling..."
                            value={cancelRemark}
                            onChange={(e) => setCancelRemark(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-slate-400 transition-all resize-none font-medium text-slate-800"
                        />
                    </div>
                    <div className="flex gap-2.5 pt-2">
                        <Button type="button" variant="secondary" onClick={() => setIsCancelModalOpen(false)} disabled={cancellingPurchase} className="flex-1 text-xs">
                            Keep Purchase
                        </Button>
                        <Button type="submit" disabled={cancellingPurchase || !cancelRemark.trim()} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs">
                            {cancellingPurchase ? 'Cancelling...' : 'Confirm Cancellation'}
                        </Button>
                    </div>
                </form>
            </Modal>

            <ConfirmModal
                isOpen={errorModal.isOpen}
                onClose={() => setErrorModal({ isOpen: false, title: '', message: '' })}
                title={errorModal.title || 'Notice'}
                message={errorModal.message}
                confirmText="OK"
                isAlert={true}
                variant="danger"
            />

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