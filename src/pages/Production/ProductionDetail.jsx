import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertCircle, Layers, Play, Check, Package, Clock, RefreshCw, X, AlertTriangle } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { formatDateTime } from '../../common/utils';
import { productionApi } from '../../api/productionApi';
import ConfirmModal from '../../components/common/ConfirmModal';
import Dropdown from '../../components/common/Dropdown';
import DatePicker from '../../components/common/DatePicker';
import { commonApi } from '../../api/commonApi';

const expiryDateFor = (packedDate, months) => {
    if (!packedDate || !months) return '';
    const [year, month, day] = packedDate.split('-').map(Number);
    const targetMonth = month - 1 + Number(months);
    const lastDay = new Date(year, targetMonth + 1, 0).getDate();
    const expiry = new Date(year, targetMonth, Math.min(day, lastDay));
    return `${expiry.getFullYear()}-${String(expiry.getMonth() + 1).padStart(2, '0')}-${String(expiry.getDate()).padStart(2, '0')}`;
};

const formatDateOnly = value => {
    if (!value) return '-';
    const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
    return new Date(dateValue).toLocaleDateString();
};
const todayLocal = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

export default function ProductionDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);

    // Completion modal state
    const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
    const [completedAmount, setCompletedAmount] = useState('');
    const [packedDate, setPackedDate] = useState('');
    const [shelfLifeMonths, setShelfLifeMonths] = useState('');
    const [shelfLifeOptions, setShelfLifeOptions] = useState([]);
    const [shelfLifeError, setShelfLifeError] = useState('');

    // Cancel confirmation modal state
    const [cancelModalOpen, setCancelModalOpen] = useState(false);

    // Alert / Error modal state
    const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '', variant: 'danger' });

    const fetchDetails = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await productionApi.getRequestById(id);
            if (data) {
                setRequest(data);
                setCompletedAmount(data.requestedQty || '');
            } else {
                setError('Production request not found');
            }
        } catch (err) {
            console.error('Failed to load production request:', err);
            setError(err.message || 'Failed to load details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            fetchDetails();
        }
    }, [id]);

    useEffect(() => {
        let isCurrent = true;
        commonApi.getShelfLifeOptions()
            .then(options => {
                if (isCurrent) setShelfLifeOptions(options);
            })
            .catch(err => {
                console.error('Failed to load shelf-life options:', err);
                if (isCurrent) setShelfLifeError(err.message || 'Failed to load shelf-life options.');
            });
        return () => { isCurrent = false; };
    }, []);

    const handleStatusChange = async (newStatus) => {
        if (!request) return;
        setIsUpdating(true);
        try {
            await productionApi.updateStatus(id, newStatus, 0.00);
            await fetchDetails();
        } catch (err) {
            setAlertModal({
                isOpen: true,
                title: 'Status Update Failed',
                message: err.message || 'Failed to update status',
                variant: 'danger'
            });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleConfirmComplete = async () => {
        const qtyNum = parseFloat(completedAmount);
        if (isNaN(qtyNum) || qtyNum <= 0) {
            setAlertModal({
                isOpen: true,
                title: 'Invalid Quantity',
                message: 'Please enter a valid completed quantity greater than 0.',
                variant: 'warning'
            });
            return;
        }
        if (!packedDate || !shelfLifeOptions.some(option => option.value === shelfLifeMonths)) {
            setAlertModal({
                isOpen: true,
                title: 'Batch Dates Required',
                message: 'Choose a packed date and shelf life of 12 or 18 months.',
                variant: 'warning'
            });
            return;
        }

        setIsUpdating(true);
        try {
            await productionApi.updateStatus(id, 'Completed', qtyNum, packedDate, Number(shelfLifeMonths));
            setIsCompleteModalOpen(false);
            await fetchDetails();
        } catch (err) {
            setAlertModal({
                isOpen: true,
                title: 'Completion Failed',
                message: err.message || 'Failed to mark production as completed',
                variant: 'danger'
            });
        } finally {
            setIsUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 space-y-3">
                <RefreshCw size={28} className="animate-spin text-slate-400" />
                <p className="text-sm font-medium">Loading production request details...</p>
            </div>
        );
    }

    if (error || !request) {
        return (
            <div className="space-y-4">
                <Button
                    variant="outline"
                    icon={ArrowLeft}
                    onClick={() => navigate('/production')}
                >
                    Back to Production
                </Button>
                <Card className="p-8 text-center text-red-500 font-medium">
                    {error || 'Production request not found'}
                </Card>
            </div>
        );
    }

    const normStatus = String(request.status || '').toLowerCase().replace(/[\s_-]/g, '');

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <PageHeader
                title={`Production Request ${request.requestNumber}`}
                subtitle={`Created on ${formatDateTime(request.createdAt)}`}
                backButton={
                    <Button
                        variant="ghost"
                        size="icon"
                        icon={ArrowLeft}
                        onClick={() => navigate(-1)}
                        title="Back to Production"
                    />
                }
                rightContent={
                    <div className="flex items-center gap-2">
                        {normStatus === 'pending' && (
                            <>
                                <Button
                                    variant="outline"
                                    icon={X}
                                    onClick={() => setCancelModalOpen(true)}
                                    disabled={isUpdating}
                                    className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 cursor-pointer"
                                >
                                    Cancel Request
                                </Button>
                                <Button
                                    onClick={() => handleStatusChange('Approved')}
                                    disabled={isUpdating}
                                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                                >
                                    Approve Request
                                </Button>
                            </>
                        )}
                        {normStatus === 'approved' && (
                            <Button
                                icon={Play}
                                onClick={() => handleStatusChange('InProgress')}
                                disabled={isUpdating}
                                className="bg-purple-600 hover:bg-purple-700 text-white cursor-pointer"
                            >
                                Start Production
                            </Button>
                        )}
                        {normStatus === 'inprogress' && (
                            <>
                                <Button
                                    variant="outline"
                                    icon={X}
                                    onClick={() => setCancelModalOpen(true)}
                                    disabled={isUpdating}
                                    className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 cursor-pointer"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    icon={Check}
                                    onClick={() => {
                                        setCompletedAmount(request.requestedQty || '');
                                        setPackedDate('');
                                        setShelfLifeMonths('');
                                        setIsCompleteModalOpen(true);
                                    }}
                                    disabled={isUpdating}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                >
                                    Mark as Completed
                                </Button>
                            </>
                        )}
                        {normStatus === 'completed' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 size={15} /> Completed ({request.completedQty ?? request.requestedQty} units)
                            </span>
                        )}
                        {normStatus === 'cancelled' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <X size={15} /> Cancelled
                            </span>
                        )}
                    </div>
                }
            />

            {/* Main Content Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Request Overview */}
                <div className="space-y-6">
                    <Card className="p-5 border-slate-200 space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Request Overview
                        </h3>

                        <div className="space-y-3 divide-y divide-slate-100 text-sm">
                            <div className="pt-2 flex justify-between items-center">
                                <span className="text-slate-500">Request No:</span>
                                <span className="font-semibold text-slate-800">{request.requestNumber}</span>
                            </div>

                            <div className="pt-2 flex justify-between items-start">
                                <span className="text-slate-500">Product:</span>
                                <div className="text-right">
                                    <span className="font-semibold text-slate-900 block">{request.productName}</span>
                                    {request.productSku && (
                                        <span className="text-xs text-slate-400 font-mono">SKU: {request.productSku}</span>
                                    )}
                                </div>
                            </div>

                            <div className="pt-2 flex justify-between items-center">
                                <span className="text-slate-500">Target Qty:</span>
                                <span className="font-bold text-slate-900">{request.requestedQty}</span>
                            </div>

                            <div className="pt-2 flex justify-between items-center">
                                <span className="text-slate-500">Completed Qty:</span>
                                <span className="font-bold text-slate-900">{request.completedQty ?? 0}</span>
                            </div>

                            {request.packedDate && (
                                <div className="pt-2 flex justify-between items-center">
                                    <span className="text-slate-500">Packed Date:</span>
                                    <span className="font-medium text-slate-700">{formatDateOnly(request.packedDate)}</span>
                                </div>
                            )}

                            {request.expiryDate && (
                                <div className="pt-2 flex justify-between items-center">
                                    <span className="text-slate-500">Expiry Date:</span>
                                    <span className="font-medium text-slate-700">{formatDateOnly(request.expiryDate)}</span>
                                </div>
                            )}

                            <div className="pt-2 flex justify-between items-center">
                                <span className="text-slate-500">Status:</span>
                                <span className="font-semibold text-slate-800">{request.status}</span>
                            </div>

                            <div className="pt-2 flex justify-between items-center">
                                <span className="text-slate-500">Priority:</span>
                                <span className="font-semibold text-slate-800">{request.priority}</span>
                            </div>

                            <div className="pt-2 flex justify-between items-center">
                                <span className="text-slate-500">Requested By:</span>
                                <span className="font-medium text-slate-700">{request.requestedBy || '-'}</span>
                            </div>

                            <div className="pt-2 flex justify-between items-center">
                                <span className="text-slate-500">Date:</span>
                                <span className="text-slate-700">{formatDateTime(request.createdAt)}</span>
                            </div>

                            {request.productStock !== null && request.productStock !== undefined && (
                                <div className="pt-2 flex justify-between items-center">
                                    <span className="text-slate-500">Current Finished Stock:</span>
                                    <span className="font-medium text-slate-700">{request.productStock}</span>
                                </div>
                            )}
                        </div>

                        {request.reason && (
                            <div className="pt-2 border-t border-slate-100">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Reason / Notes</p>
                                <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                    {request.reason}
                                </p>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Right Column: Linked Raw Materials & Batches */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <Layers size={16} className="text-amber-500" /> Linked Raw Materials &amp; Batches
                            </h3>
                            <span className="text-xs text-slate-500 font-medium">
                                {(request.materials || request.rawMaterials || []).length} items required
                            </span>
                        </div>

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-left">Material &amp; Batch</TableHead>
                                    <TableHead className="text-center">Per Unit</TableHead>
                                    <TableHead className="text-right">Required</TableHead>
                                    <TableHead className="text-right">Current Stock</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody padRows={false}>
                                {(request.materials || request.rawMaterials || []).map((mat, i) => (
                                    <TableRow key={mat.edId || mat.edid || i}>
                                        <TableCell>
                                            <span className="font-semibold text-slate-800 text-xs">{mat.materialName}</span>
                                            {mat.batchNumber ? (
                                                <span className="block text-[11px] text-slate-500 mt-0.5">
                                                    Batch: #{mat.batchNumber}
                                                </span>
                                            ) : (
                                                <span className="block text-[10px] text-slate-400">Warehouse Stock</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center font-medium">
                                            {mat.recipeQty ?? mat.qty} {mat.unitSymbol || mat.allowedUnitSymbol || ''}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {mat.requiredQty} {mat.unitSymbol || mat.allowedUnitSymbol || ''}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {mat.availableStock ?? mat.qtyAvailable} {mat.unitSymbol || mat.allowedUnitSymbol || ''}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {mat.isSufficient ? (
                                                <span className="text-emerald-600 font-medium text-xs flex items-center justify-center gap-1">
                                                    <CheckCircle2 size={14} /> Available
                                                </span>
                                            ) : (
                                                <span className="text-red-500 font-medium text-xs flex items-center justify-center gap-1">
                                                    <AlertCircle size={14} /> Low Stock
                                                </span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}

                                {(!request.materials || request.materials.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-slate-400 py-12">
                                            No recipe materials linked to this request.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </div>
            </div>

            {/* Mark as Completed Dialog */}
            {isCompleteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                                    <CheckCircle2 size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">Mark as Completed</h3>
                                    <p className="text-xs text-slate-500">Record actual production output and deduct materials</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsCompleteModalOpen(false)}
                                disabled={isUpdating}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(85vh-130px)]">
                            {/* Summary Pill */}
                            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex justify-between items-center text-xs">
                                <div>
                                    <span className="text-slate-400 block font-medium">Product</span>
                                    <span className="font-bold text-slate-800 text-sm">{request.productName}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-slate-400 block font-medium">Target Requested</span>
                                    <span className="font-bold text-slate-800 text-sm">{request.requestedQty} units</span>
                                </div>
                            </div>

                            {/* Amount Completed Input */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Amount of Completed Production <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="any"
                                        value={completedAmount}
                                        onChange={(e) => setCompletedAmount(e.target.value)}
                                        placeholder="Enter completed quantity"
                                        className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-base font-bold text-slate-900 focus:outline-none focus:border-emerald-600 transition-colors"
                                        autoFocus
                                    />
                                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                                        units
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    Entering completed quantity will update finished product stock and deduct batch materials.
                                </p>
                            </div>

                            {/* Raw Material Deduction Calculation Preview */}
                            {request.materials && request.materials.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                            <Layers size={14} className="text-amber-500" /> Material Deductions
                                        </span>
                                        <span className="text-[11px] text-slate-400">
                                            for {parseFloat(completedAmount) || 0} units
                                        </span>
                                    </div>

                                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                                        {request.materials.map((mat, i) => {
                                            const deduction = (Number(mat.recipeQty || 0) * (parseFloat(completedAmount) || 0));
                                            const hasEnough = mat.availableStock >= deduction;
                                            return (
                                                <div key={mat.edid || i} className="p-3 bg-slate-50/50 flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-slate-800 truncate">{mat.materialName}</p>
                                                        <p className="text-[11px] text-slate-400 font-mono">
                                                            {mat.batchNumber ? `Batch: #${mat.batchNumber}` : 'Warehouse Stock'} • {mat.recipeQty} {mat.unitSymbol}/unit
                                                        </p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="font-bold text-red-600">
                                                            - {deduction.toLocaleString()} {mat.unitSymbol}
                                                        </p>
                                                        <p className={`text-[11px] ${hasEnough ? 'text-slate-500' : 'text-red-500 font-semibold'}`}>
                                                            Stock: {mat.availableStock} {mat.unitSymbol}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <label className="block space-y-1.5">
                                    <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        Packed Date <span className="text-red-500">*</span>
                                    </span>
                                    <DatePicker
                                        value={packedDate}
                                        onChange={setPackedDate}
                                        required
                                        maxDate={todayLocal()}
                                        className="w-full"
                                    />
                                </label>
                                <Dropdown
                                    label="Shelf Life"
                                    required
                                    value={shelfLifeMonths}
                                    onChange={setShelfLifeMonths}
                                    options={shelfLifeOptions}
                                    placeholder="Choose shelf life"
                                    disabled={shelfLifeOptions.length === 0}
                                    className="w-full"
                                />
                                {shelfLifeError && (
                                    <p className="col-span-2 -mt-2 text-xs text-red-600">{shelfLifeError}</p>
                                )}
                                {packedDate && shelfLifeMonths && (
                                    <p className="col-span-2 -mt-2 text-xs text-slate-500">
                                        Packed: <strong className="text-slate-700">{formatDateOnly(packedDate)}</strong>
                                        <span className="mx-2">→</span>
                                        Expires: <strong className="text-slate-700">{formatDateOnly(expiryDateFor(packedDate, shelfLifeMonths))}</strong>
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2.5">
                            <Button
                                variant="ghost"
                                onClick={() => setIsCompleteModalOpen(false)}
                                disabled={isUpdating}
                            >
                                Cancel
                            </Button>
                            <Button
                                icon={Check}
                                onClick={handleConfirmComplete}
                                disabled={isUpdating || !completedAmount || parseFloat(completedAmount) <= 0}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                            >
                                {isUpdating ? 'Completing...' : 'Confirm Completion'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Confirmation Modal Component */}
            <ConfirmModal
                isOpen={cancelModalOpen}
                onClose={() => setCancelModalOpen(false)}
                onConfirm={async () => {
                    setCancelModalOpen(false);
                    await handleStatusChange('Cancelled');
                }}
                title="Cancel Production Request"
                message={`Are you sure you want to cancel production request ${request?.requestNumber}? This action cannot be undone.`}
                confirmText="Yes, Cancel Request"
                cancelText="No, Keep Request"
                variant="danger"
                isLoading={isUpdating}
            />

            {/* Alert / Notification Modal Component */}
            <ConfirmModal
                isOpen={alertModal.isOpen}
                onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
                title={alertModal.title}
                message={alertModal.message}
                variant={alertModal.variant}
                isAlert={true}
                confirmText="OK"
            />
        </div>
    );
}
