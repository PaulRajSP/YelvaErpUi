import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { orderApi } from '../../api/orderApi';
import { commonApi } from '../../api/commonApi';
import { API_BASE } from '../../services/apiClient';
import { CreditCard, CheckCircle2, AlertCircle, Loader2, ArrowRight, Upload, FileText, X, Eye } from 'lucide-react';
import Dropdown from '../common/Dropdown';
import DatePicker from '../common/DatePicker';
import DocumentViewModal from '../common/DocumentViewModal';

const PAYMENT_METHOD_OPTIONS = [
    { value: 'UPI', label: 'UPI / QR Code' },
    { value: 'BankTransfer', label: 'Bank Transfer (NEFT/IMPS)' },
    { value: 'Cash', label: 'Cash' },
    { value: 'Card', label: 'Debit / Credit Card' },
    { value: 'Gateway', label: 'Payment Gateway' },
];

const PAYMENT_TYPE_OPTIONS = [
    { value: 'FullPayment', label: 'Full Payment' },
    { value: 'Advance', label: 'Advance Payment' },
    { value: 'Balance', label: 'Balance Payment' },
];

const PAYMENT_STATUS_OPTIONS = [
    { value: 'Success', label: 'Success (Received)' },
    { value: 'Pending', label: 'Pending Verification' },
    { value: 'Failed', label: 'Failed' },
    { value: 'Cancelled', label: 'Cancelled' },
    { value: 'Refunded', label: 'Refunded' },
];

export default function RecordPaymentModal({ isOpen, onClose, order, onPaymentRecorded }) {
    const totalAmount = Number(order?.totalAmount || 0);
    const amountPaid = Number(order?.amountPaid || 0);
    const balanceAmount = Number(
        order?.balanceAmount !== undefined
            ? order.balanceAmount
            : Math.max(0, totalAmount - amountPaid)
    );

    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('UPI');
    const [paymentType, setPaymentType] = useState('FullPayment');
    const [status, setStatus] = useState('Success');
    const [paymentReference, setPaymentReference] = useState('');
    const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [remark, setRemark] = useState('');
    const [docEdid, setDocEdid] = useState(null);
    const [docFileName, setDocFileName] = useState('');
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            const initialAmount = balanceAmount > 0 ? balanceAmount : (amountPaid === 0 ? totalAmount : '');
            setAmount(initialAmount ? String(initialAmount) : '');
            setPaymentMethod('UPI');
            if (balanceAmount > 0 && amountPaid > 0) {
                setPaymentType('Balance');
            } else if (amountPaid === 0 && balanceAmount === totalAmount) {
                setPaymentType('FullPayment');
            } else {
                setPaymentType('Advance');
            }
            setStatus('Success');
            setPaymentReference('');
            setPaymentDate(new Date().toISOString().slice(0, 10));
            setRemark('');
            setDocEdid(null);
            setDocFileName('');
            setUploadingDoc(false);
            setError(null);
            setLoading(false);
        }
    }, [isOpen, balanceAmount, totalAmount, amountPaid]);

    const handleDocUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingDoc(true);
        setError(null);
        try {
            const res = await commonApi.uploadAttachment(file);
            const data = res?.data || res;
            if (data?.edid) {
                setDocEdid(data.edid);
                setDocFileName(file.name);
            }
        } catch (err) {
            console.error('Failed to upload payment document:', err);
            setError('Failed to upload payment document: ' + (err.message || 'Error'));
        } finally {
            setUploadingDoc(false);
        }
    };

    // Handle Amount change and auto-suggest type
    const handleAmountChange = (val) => {
        setAmount(val);
        const num = parseFloat(val);
        if (!isNaN(num)) {
            if (num >= balanceAmount && balanceAmount > 0) {
                setPaymentType(amountPaid > 0 ? 'Balance' : 'FullPayment');
            } else if (num < balanceAmount) {
                setPaymentType(amountPaid > 0 ? 'Balance' : 'Advance');
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            setError('Please enter a valid payment amount greater than zero.');
            return;
        }

        const isCash = paymentMethod === 'Cash';
        if (!isCash) {
            const methodLabel = PAYMENT_METHOD_OPTIONS.find(m => m.value === paymentMethod)?.label || paymentMethod;
            if (!paymentReference.trim()) {
                setError(`Transaction reference / UTR is required for ${methodLabel}.`);
                return;
            }
            if (!docEdid) {
                setError(`Payment proof / receipt document is required for ${methodLabel}.`);
                return;
            }
        }

        const orderEdid = order?.edid || order?.id;
        if (!orderEdid) {
            setError('Order identifier is missing.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                orderEdid,
                amount: parsedAmount,
                paymentMethod,
                paymentType,
                status,
                paymentReference: paymentReference.trim() || null,
                paymentDate: paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString(),
                remark: remark.trim() || null,
                docEdid: docEdid || null,
                syncToLedger: true
            };

            const res = await orderApi.recordPayment(orderEdid, payload);
            const data = res?.data || res;
            if (onPaymentRecorded) {
                onPaymentRecorded(data);
            }
            onClose();
        } catch (err) {
            console.error('Failed to record payment:', err);
            setError(err.message || 'Failed to record payment. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Record Order Payment"
            className="max-w-lg"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Order Summary Strip */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                        <span>Order: <strong className="text-slate-800">{order?.orderNumber || 'N/A'}</strong></span>
                        <span className="capitalize font-semibold text-slate-700">
                            Status: <span className="text-amber-600">{order?.paymentStatus || 'UNPAID'}</span>
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 text-center">
                        <div className="bg-white p-2 rounded-lg border border-slate-200/50">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Total</span>
                            <span className="text-xs font-black text-slate-800">₹{totalAmount.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200/50">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Paid</span>
                            <span className="text-xs font-black text-emerald-600">₹{amountPaid.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200/50">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Balance</span>
                            <span className={`text-xs font-black ${balanceAmount > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                                ₹{balanceAmount.toLocaleString('en-IN')}
                            </span>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                        <AlertCircle size={15} className="shrink-0 text-red-500" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Amount input & Quick buttons */}
                <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                        Payment Amount (₹) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                        <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => handleAmountChange(e.target.value)}
                            className="w-full pl-8 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        />
                    </div>
                    {balanceAmount > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                            <button
                                type="button"
                                onClick={() => handleAmountChange(String(balanceAmount))}
                                className="text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/70 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                            >
                                Pay Full Balance (₹{balanceAmount.toLocaleString('en-IN')})
                            </button>
                            {balanceAmount > 100 && (
                                <button
                                    type="button"
                                    onClick={() => handleAmountChange(String(Math.round(balanceAmount / 2)))}
                                    className="text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                                >
                                    50% (₹{Math.round(balanceAmount / 2).toLocaleString('en-IN')})
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Method & Type */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                            Payment Method
                        </label>
                        <Dropdown
                            value={paymentMethod}
                            onChange={(val) => setPaymentMethod(val)}
                            options={PAYMENT_METHOD_OPTIONS}
                            isDefault={true}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                            Payment Type
                        </label>
                        <Dropdown
                            value={paymentType}
                            onChange={(val) => setPaymentType(val)}
                            options={PAYMENT_TYPE_OPTIONS}
                            isDefault={true}
                        />
                    </div>
                </div>

                {/* Status & Date */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                            Payment Status
                        </label>
                        <Dropdown
                            value={status}
                            onChange={(val) => setStatus(val)}
                            options={PAYMENT_STATUS_OPTIONS}
                            isDefault={true}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                            Payment Date
                        </label>
                        <DatePicker
                            value={paymentDate}
                            onChange={(val) => setPaymentDate(val)}
                            className="w-full"
                            align="right"
                        />
                    </div>
                </div>

                {/* Payment Reference */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                            Transaction Reference / UTR {paymentMethod !== 'Cash' && <span className="text-red-500">*</span>}
                        </label>
                        {paymentMethod === 'Cash' ? (
                            <span className="text-[10px] text-slate-400 font-medium">Optional</span>
                        ) : (
                            <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Required</span>
                        )}
                    </div>
                    <input
                        type="text"
                        placeholder={paymentMethod === 'Cash' ? 'Optional (receipt / voucher no)' : 'e.g. UPI Ref / Bank UTR / Cheque No / Gateway Txn ID'}
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                </div>

                {/* Payment Document Upload (Optional only for Cash, Required for others) */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                            Payment Proof / Receipt Document {paymentMethod !== 'Cash' && <span className="text-red-500">*</span>}
                        </label>
                        {paymentMethod === 'Cash' ? (
                            <span className="text-[10px] text-slate-400 font-medium">Optional</span>
                        ) : (
                            <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Required</span>
                        )}
                    </div>

                    {docEdid ? (
                        <div className="flex items-center justify-between p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl text-xs">
                            <div className="flex items-center gap-2 text-amber-900 font-semibold truncate">
                                <FileText size={16} className="text-amber-600 shrink-0" />
                                <span className="truncate">{docFileName || 'Payment Document Attached'}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setShowViewModal(true)}
                                    className="p-1 text-amber-700 hover:text-amber-950 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                                    title="View Document"
                                >
                                    <Eye size={15} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setDocEdid(null); setDocFileName(''); }}
                                    className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Remove Document"
                                >
                                    <X size={15} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <label className={`border-2 border-dashed ${paymentMethod !== 'Cash' ? 'border-amber-300 hover:border-amber-400 bg-amber-50/20' : 'border-slate-200 hover:border-amber-400 bg-slate-50/50'} hover:bg-amber-50/30 p-3.5 rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors`}>
                            <input
                                type="file"
                                accept="image/*,.pdf"
                                onChange={handleDocUpload}
                                className="hidden"
                                disabled={uploadingDoc}
                            />
                            {uploadingDoc ? (
                                <div className="flex items-center gap-2 text-xs text-amber-600 font-bold">
                                    <Loader2 size={16} className="animate-spin" /> Uploading proof document...
                                </div>
                            ) : (
                                <>
                                    <Upload size={16} className="text-slate-400" />
                                    <span className="text-xs font-bold text-slate-700">Click to attach payment proof / screenshot</span>
                                    <span className="text-[10px] text-slate-400">PNG, JPG, PDF up to 10MB</span>
                                </>
                            )}
                        </label>
                    )}
                </div>

                {/* Remarks */}
                <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                        Remark / Notes
                    </label>
                    <input
                        type="text"
                        placeholder="Optional remarks regarding this payment"
                        value={remark}
                        onChange={(e) => setRemark(e.target.value)}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={loading}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1.5"
                    >
                        {loading && <Loader2 size={14} className="animate-spin" />}
                        Record Payment
                    </Button>
                </div>
            </form>

            {docEdid && (
                <DocumentViewModal
                    isOpen={showViewModal}
                    onClose={() => setShowViewModal(false)}
                    url={`${API_BASE}/common/attachment/${docEdid}`}
                    title="Payment Proof Preview"
                    fileName={docFileName}
                />
            )}
        </Modal>
    );
}
