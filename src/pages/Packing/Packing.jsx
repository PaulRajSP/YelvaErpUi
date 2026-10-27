import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
    Search, Package, CheckCircle, Tag, Box, ArrowRight, Printer, RefreshCw,
    Clock, Truck, User, MapPin, Scale, ChevronRight, Check, Loader2,
    Copy, Phone, Calendar, ArrowLeft, Home, Edit2, Plus, Trash2, Minus, Layers,
    Camera, QrCode, Download
} from 'lucide-react';
import { orderApi } from '../../api/orderApi';
import { documentApi } from '../../api/documentApi';
import { useStore } from '../../context/StoreContext';
import Dropdown from '../../components/common/Dropdown';
import PageHeader from '../../components/common/PageHeader';
import { formatOrderStatus, formatDate, formatTime, formatDateTime } from '../../common/utils';
import OrderPrintModal from '../../components/orders/OrderPrintModal';
import ConfirmedSlipsModal from '../../components/orders/ConfirmedSlipsModal';
import ConfirmModal from '../../components/common/ConfirmModal';
import { QrCameraScannerModal } from '../../components/common/QrCameraScannerModal';

const STATUS_CONFIG = {
    'OrderPlaced': { dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-700' },
    'Confirmed': { dot: 'bg-sky-500', badge: 'bg-sky-100 text-sky-700' },
    'Packing': { dot: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700' },
    'ReadyToShip': { dot: 'bg-indigo-500', badge: 'bg-indigo-100 text-indigo-700' },
    'Shipped': { dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
    'Delivered': { dot: 'bg-green-500', badge: 'bg-green-100 text-green-700' },
};

const getStatusConfig = (status) => {
    if (!status) return { dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-700' };
    const norm = status.replace(/\s+/g, '').toLowerCase();
    const key = Object.keys(STATUS_CONFIG).find(k => k.toLowerCase() === norm);
    return key ? STATUS_CONFIG[key] : { dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-700' };
};

export default function Packing() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { currentUser } = useStore();

    // Packing Materials from dedicated API
    const [packingMaterialsList, setPackingMaterialsList] = useState([]);
    const materialSearchTimeout = useRef(null);

    const loadPackingMaterials = async (searchKeyword = null) => {
        const res = await orderApi.getPackingMaterials(searchKeyword);
        const list = res?.data?.items || res?.items || (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
        setPackingMaterialsList(Array.isArray(list) ? list : []);
    };

    const handleMaterialSearch = (term) => {
        if (materialSearchTimeout.current) clearTimeout(materialSearchTimeout.current);
        materialSearchTimeout.current = setTimeout(() => {
            loadPackingMaterials(term || null);
        }, 300);
    };

    useEffect(() => {
        loadPackingMaterials();
    }, []);

    // Read incoming order number from route state or URL search parameters
    const incomingOrderNumber = (
        location.state?.orderNumber ||
        location.state?.orderNo ||
        searchParams.get('orderNumber') ||
        searchParams.get('order') ||
        searchParams.get('orderNo') ||
        ''
    ).trim();

    // Search and Input State
    const [orderNumberInput, setOrderNumberInput] = useState(incomingOrderNumber);
    const [searching, setSearching] = useState(false);
    const autoFetchTimeoutRef = useRef(null);
    const lastLoadedOrderRef = useRef(null);

    // Active Loaded Order State
    const [packingData, setPackingData] = useState(null);
    const [bottleAssignments, setBottleAssignments] = useState({});
    const [usedPackingMaterials, setUsedPackingMaterials] = useState([]);
    const [selectedMaterialToAdd, setSelectedMaterialToAdd] = useState('');
    const [boxDimensions, setBoxDimensions] = useState({ length: '', width: '', height: '', weight: '' });
    const [copied, setCopied] = useState(false);

    // Actions & Modal State
    const [confirming, setConfirming] = useState(false);
    const [packedSuccess, setPackedSuccess] = useState(false);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [isConfirmedSlipsModalOpen, setIsConfirmedSlipsModalOpen] = useState(false);
    const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
    const [noticeModal, setNoticeModal] = useState({ isOpen: false, title: '', message: '', variant: 'warning' });

    const searchInputRef = useRef(null);

    // Auto-focus search input on mount if no order is pre-loaded
    useEffect(() => {
        if (searchInputRef.current && !incomingOrderNumber) {
            searchInputRef.current.focus();
        }
        return () => {
            if (autoFetchTimeoutRef.current) {
                clearTimeout(autoFetchTimeoutRef.current);
            }
        };
    }, []);

    const handleCopy = (text) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Load Order by Number
    const handleSearchOrder = async (e, directQuery = null, isTyping = false) => {
        if (e && e.preventDefault) e.preventDefault();
        const query = (directQuery !== null ? directQuery : orderNumberInput).trim();
        if (!query) return;

        if (directQuery !== null) {
            setOrderNumberInput(directQuery);
        }

        setSearching(true);

        try {
            const res = await orderApi.getPackingDetails(query);
            const data = res?.data || res;
            if (!data || !data.orderNumber) {
                if (!isTyping) {
                    setNoticeModal({
                        isOpen: true,
                        title: 'Order Not Found',
                        message: `No packing details could be retrieved for order "${query}". Please verify the order number.`,
                        variant: 'warning'
                    });
                }
                return;
            }

            // Order found: display data
            setPackingData(data);
            lastLoadedOrderRef.current = data.orderNumber;
            setBottleAssignments({});
            setUsedPackingMaterials([]);
            setSelectedMaterialToAdd('');
            setPackedSuccess(false);

            // Initialize bottle assignments (no auto-selection: only preserve batches already saved in database)
            const initialAssignments = {};
            (data.items || []).forEach(item => {
                if (item.productBatchEdid) {
                    initialAssignments[item.edid] = item.productBatchEdid;
                } else {
                    initialAssignments[item.edid] = '';
                }
            });
            setBottleAssignments(initialAssignments);

            // Prefill existing package details if available
            if (data.package) {
                setBoxDimensions({
                    length: data.package.length || '',
                    width: data.package.width || '',
                    height: data.package.height || '',
                    weight: data.package.weight || ''
                });
            }
        } catch (err) {
            console.warn('Order could not be loaded:', err);
            if (!isTyping) {
                setNoticeModal({
                    isOpen: true,
                    title: 'Order Load Error',
                    message: err?.message || `Order "${query}" could not be loaded. Please ensure the order is confirmed.`,
                    variant: 'warning'
                });
            }
        } finally {
            setSearching(false);
        }
    };

    // Auto-fetch if orderNumber was passed in route state or query params
    useEffect(() => {
        if (incomingOrderNumber && incomingOrderNumber !== lastLoadedOrderRef.current) {
            lastLoadedOrderRef.current = incomingOrderNumber;
            setOrderNumberInput(incomingOrderNumber);
            handleSearchOrder(null, incomingOrderNumber, false);
        }
    }, [incomingOrderNumber]);

    // Case 1: When user types more than 7 characters, auto fetch
    const handleInputChange = (e) => {
        const val = e.target.value;
        setOrderNumberInput(val);

        if (autoFetchTimeoutRef.current) {
            clearTimeout(autoFetchTimeoutRef.current);
        }

        const trimmed = val.trim();
        if (trimmed.length > 7) {
            autoFetchTimeoutRef.current = setTimeout(() => {
                handleSearchOrder(null, trimmed, true);
            }, 350);
        }
    };

    // Case 2: When user pastes something, fetch immediately at the same time
    const handlePaste = (e) => {
        const pasted = e.clipboardData?.getData('text') || '';
        const trimmed = pasted.trim();
        if (trimmed) {
            e.preventDefault();
            setOrderNumberInput(trimmed);
            if (autoFetchTimeoutRef.current) {
                clearTimeout(autoFetchTimeoutRef.current);
            }
            handleSearchOrder(null, trimmed, false);
        }
    };

    // Quick Apply batch to all bottles of the same product (respecting available stock limit)
    const handleApplyBatchToAll = (productSingleId, batchEdid) => {
        if (!packingData?.items) return;
        const targetBatch = (packingData.availableBatches || []).find(b => b.edid === batchEdid);
        const maxStock = targetBatch?.remainingQty || 0;
        const productItems = packingData.items.filter(item => item.productSingleId === productSingleId);

        if (maxStock < productItems.length) {
            setBottleAssignments(prev => {
                const updated = { ...prev };
                let assignedCount = 0;
                productItems.forEach(item => {
                    if (assignedCount < maxStock) {
                        updated[item.edid] = batchEdid;
                        assignedCount++;
                    } else if (updated[item.edid] === batchEdid) {
                        updated[item.edid] = '';
                    }
                });
                return updated;
            });

            setNoticeModal({
                isOpen: true,
                title: 'Batch Stock Limit',
                message: `Batch "${targetBatch?.batchNumber || 'Selected'}" has only ${maxStock} unit(s) available in stock. Assigned to ${Math.min(maxStock, productItems.length)} bottle(s). Please choose another batch for the remaining ${productItems.length - maxStock} bottle(s).`,
                variant: 'warning'
            });
        } else {
            setBottleAssignments(prev => {
                const updated = { ...prev };
                productItems.forEach(item => {
                    updated[item.edid] = batchEdid;
                });
                return updated;
            });
        }
    };

    // Confirm Packing Handler
    const handleConfirmPacking = async () => {
        if (!packingData) return;

        // Validation: verify all items have an assigned batch
        const unassigned = (packingData.items || []).filter(item => !bottleAssignments[item.edid]);
        if (unassigned.length > 0) {
            setNoticeModal({
                isOpen: true,
                title: 'Incomplete Batch Assignment',
                message: `Please select a batch for all bottles before confirming. (${unassigned.length} bottle(s) unassigned)`,
                variant: 'warning'
            });
            return;
        }

        // Validation: verify no batch stock limit is exceeded
        const batchCounts = {};
        Object.values(bottleAssignments).forEach(batchEdid => {
            if (batchEdid) {
                batchCounts[batchEdid] = (batchCounts[batchEdid] || 0) + 1;
            }
        });

        for (const [batchEdid, assignedQty] of Object.entries(batchCounts)) {
            const batchObj = (packingData.availableBatches || []).find(b => b.edid === batchEdid);
            if (batchObj && assignedQty > batchObj.remainingQty) {
                setNoticeModal({
                    isOpen: true,
                    title: 'Batch Stock Limit Exceeded',
                    message: `Batch "${batchObj.batchNumber}" has only ${batchObj.remainingQty} item(s) in stock, but ${assignedQty} bottle(s) are assigned. Please reassign the extra bottles to another batch.`,
                    variant: 'danger'
                });
                return;
            }
        }

        // Validation: verify used packing material stock is not exceeded
        for (const item of usedPackingMaterials) {
            if (item.quantity > item.stock) {
                setNoticeModal({
                    isOpen: true,
                    title: 'Material Stock Limit Exceeded',
                    message: `Quantity for '${item.name}' (${item.quantity} ${item.unitSymbol || 'pcs'}) exceeds available stock (${item.stock} ${item.unitSymbol || 'pcs'}). Please adjust the quantity before confirming.`,
                    variant: 'danger'
                });
                return;
            }
        }

        // Validation: verify Package Weight & Dimensions (All required)
        const parsedWeight = parseFloat(boxDimensions.weight);
        if (isNaN(parsedWeight) || parsedWeight <= 0) {
            setNoticeModal({
                isOpen: true,
                title: 'Package Weight Required',
                message: 'Please enter a valid package weight (kg) greater than 0 before confirming.',
                variant: 'warning'
            });
            return;
        }

        const parsedLength = parseFloat(boxDimensions.length);
        if (isNaN(parsedLength) || parsedLength <= 0) {
            setNoticeModal({
                isOpen: true,
                title: 'Package Length Required',
                message: 'Please enter a valid package length (cm) greater than 0 before confirming.',
                variant: 'warning'
            });
            return;
        }

        const parsedWidth = parseFloat(boxDimensions.width);
        if (isNaN(parsedWidth) || parsedWidth <= 0) {
            setNoticeModal({
                isOpen: true,
                title: 'Package Width Required',
                message: 'Please enter a valid package width (cm) greater than 0 before confirming.',
                variant: 'warning'
            });
            return;
        }

        const parsedHeight = parseFloat(boxDimensions.height);
        if (isNaN(parsedHeight) || parsedHeight <= 0) {
            setNoticeModal({
                isOpen: true,
                title: 'Package Height Required',
                message: 'Please enter a valid package height (cm) greater than 0 before confirming.',
                variant: 'warning'
            });
            return;
        }

        setConfirming(true);
        try {
            const payload = {
                orderEdid: packingData.orderEdid,
                packedBy: currentUser?.employeeCode || 'EMP001',
                length: parsedLength,
                width: parsedWidth,
                height: parsedHeight,
                weight: parsedWeight,
                bottleAssignments: Object.entries(bottleAssignments).map(([opiEdid, batchEdid]) => ({
                    orderProductItemEdid: opiEdid,
                    productBatchEdid: batchEdid
                })),
                packingMaterials: usedPackingMaterials.map(m => ({
                    materialEdid: m.materialEdid,
                    quantity: parseFloat(m.quantity) || 1
                }))
            };

            await orderApi.confirmPacking(payload);
            setPackedSuccess(true);
            setPackingData(prev => ({
                ...prev,
                status: 'ReadyToShip',
                package: {
                    length: payload.length,
                    width: payload.width,
                    height: payload.height,
                    weight: payload.weight,
                    courier: prev.deliveryType === 'DIRECT' ? 'Direct Handover' : 'Courier Delivery'
                },
                usedMaterials: usedPackingMaterials.map(m => ({
                    materialName: m.name,
                    quantityUsed: m.quantity,
                    createdAt: new Date().toISOString()
                }))
            }));
        } catch (err) {
            console.error('Failed to confirm packing:', err);
            setNoticeModal({
                isOpen: true,
                title: 'Packing Confirmation Failed',
                message: err.message || 'Failed to confirm packing.',
                variant: 'danger'
            });
        } finally {
            setConfirming(false);
        }
    };

    const handleReset = () => {
        setPackingData(null);
        setOrderNumberInput('');
        setPackedSuccess(false);
        setBottleAssignments({});
        setUsedPackingMaterials([]);
        setSelectedMaterialToAdd('');
        lastLoadedOrderRef.current = null;
        navigate('/packing', { replace: true, state: {} });
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    };

    // Packing Material item handlers
    const handleAddPackingMaterial = (matEdid) => {
        if (!matEdid) return;
        const mat = packingMaterialsList.find(m => (m.edid || m.id) === matEdid);
        if (!mat) return;

        setUsedPackingMaterials(prev => {
            const existingIdx = prev.findIndex(item => item.materialEdid === matEdid);
            if (existingIdx >= 0) {
                const updated = [...prev];
                const currentQty = updated[existingIdx].quantity || 1;
                const maxStock = mat.stock || 0;
                if (currentQty < maxStock) {
                    updated[existingIdx] = { ...updated[existingIdx], quantity: currentQty + 1 };
                }
                return updated;
            } else {
                return [
                    ...prev,
                    {
                        materialEdid: matEdid,
                        name: mat.name,
                        stock: mat.stock || 0,
                        unitSymbol: mat.unitSymbol || 'pcs',
                        quantity: 1
                    }
                ];
            }
        });
        setSelectedMaterialToAdd('');
    };

    const handleUpdateMaterialQty = (matEdid, newQty) => {
        const parsed = parseFloat(newQty);
        const qty = isNaN(parsed) || parsed < 1 ? 1 : parsed;
        setUsedPackingMaterials(prev => prev.map(item => {
            if (item.materialEdid === matEdid) {
                return { ...item, quantity: qty };
            }
            return item;
        }));
    };

    const handleRemovePackingMaterial = (matEdid) => {
        setUsedPackingMaterials(prev => prev.filter(item => item.materialEdid !== matEdid));
    };

    // Show all raw materials from dedicated packing materials API
    const packingMaterialOptions = packingMaterialsList.map(rm => {
        const stock = rm.stock || 0;
        const edid = rm.edid || rm.id;
        return {
            value: edid,
            label: `${rm.name} (Stock: ${stock} ${rm.unitSymbol || 'pcs'}${stock <= 0 ? ' - Out of Stock' : ''})`,
            name: rm.name,
            stock: stock,
            unitSymbol: rm.unitSymbol || 'pcs',
            disabled: stock <= 0
        };
    });

    const isOrderPlacedStatus = packingData && (packingData.status || '').replace(/\s+/g, '').toLowerCase() === 'orderplaced';
    const isAlreadyPacked = packingData && (['readytoship', 'shipped', 'delivered'].includes((packingData.status || '').replace(/\s+/g, '').toLowerCase()) || packedSuccess);
    const statusConfig = getStatusConfig(packingData?.status);

    const totalAssignedCount = Object.keys(bottleAssignments).filter(k => bottleAssignments[k]).length;
    const totalBottlesCount = packingData?.items?.length || 0;

    return (
        <div className="space-y-5">

            {/* ── PageHeader (OrderDetail style) ────────────────────── */}
            {packingData ? (
                <PageHeader
                    title={
                        <div className="flex flex-wrap items-center gap-2.5">
                            <button
                                onClick={handleReset}
                                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                                title="Back to Scanner"
                            >
                                <ArrowLeft size={16} />
                            </button>
                            <span className="text-xl font-black text-slate-900 tracking-tight">
                                Order #{packingData.orderNumber}
                            </span>
                            <button
                                onClick={() => handleCopy(packingData.orderNumber)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                                title="Copy Order Number"
                            >
                                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusConfig.badge}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                                {formatOrderStatus(packingData.status)}
                            </span>
                            {packingData.deliveryType === 'DIRECT' ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
                                    <Home size={9} /> Direct Delivery
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                                    <Truck size={9} /> Courier Delivery
                                </span>
                            )}
                        </div>
                    }
                    subtitle={
                        packingData.createdAt && (
                            <span className="flex items-center gap-1 text-slate-500 text-xs">
                                <Calendar size={11} />
                                {formatDate(packingData.createdAt)} at {formatTime(packingData.createdAt)}
                            </span>
                        )
                    }
                    rightContent={
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleReset}
                                className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                            >
                                <RefreshCw size={13} /> Scan Another
                            </button>
                            {isAlreadyPacked && (
                                <button
                                    onClick={() => setIsPrintModalOpen(true)}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors"
                                >
                                    <Printer size={13} /> Print Slip
                                </button>
                            )}
                            <button
                                onClick={() => navigate(`/orders/${packingData.orderNumber}/${packingData.orderEdid}`)}
                                className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                            >
                                View Order <ArrowRight size={13} />
                            </button>
                        </div>
                    }
                />
            ) : (
                <PageHeader
                    title={
                        <div className="flex items-center gap-2.5">
                            <Box size={22} className="text-indigo-600" />
                            <span className="text-xl font-black text-slate-900 tracking-tight">Packing Station</span>
                        </div>
                    }
                    subtitle="Scan or enter an Order Number to verify bottles, assign inventory batches, and mark Ready To Ship."
                    rightContent={
                        <button
                            type="button"
                            onClick={() => setIsConfirmedSlipsModalOpen(true)}
                            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                            title="View and print delivery slips for all confirmed orders"
                        >
                            <Printer size={14} />
                            <span>Confirmed Slips</span>
                        </button>
                    }
                />
            )}

            {/* ── Order Lookup / Scanner Input Bar ────────────────── */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
                <form onSubmit={handleSearchOrder} className="flex flex-col sm:flex-row items-stretch gap-3">
                    <div className="relative flex-1">
                        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={orderNumberInput}
                            onChange={handleInputChange}
                            onPaste={handlePaste}
                            placeholder="Type or scan Order Number (e.g. ORD-10023)..."
                            className="w-full h-11 pl-10 pr-11 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all"
                        />
                        <button
                            type="button"
                            onClick={() => setIsCameraScannerOpen(true)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="Scan QR with Camera"
                        >
                            <QrCode size={18} />
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsCameraScannerOpen(true)}
                        className="h-11 px-4.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-200 hover:border-slate-300 shrink-0"
                        title="Scan QR Code via Camera"
                    >
                        <Camera size={16} className="text-indigo-600" />
                        <span>Scan Camera</span>
                    </button>

                    <button
                        type="submit"
                        disabled={searching || !orderNumberInput.trim()}
                        className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed shrink-0"
                    >
                        {searching ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                        Load Order
                    </button>
                </form>
            </div>

            {/* ── Loaded Order Flow (OrderDetail Layout) ───────────── */}
            {packingData && (
                <div className="space-y-5 animate-in fade-in duration-200">

                    {/* Status Notice: OrderPlaced */}
                    {isOrderPlacedStatus && (
                        <div className="bg-sky-50/80 border border-sky-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
                                onClick={() => navigate(`/orders/${packingData.orderNumber}/${packingData.orderEdid}`)}
                                className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-700 text-white cursor-pointer transition-all"
                            >
                                View Order to Confirm
                            </button>
                        </div>
                    )}

                    {/* Status Notice: Already Packed */}
                    {isAlreadyPacked && !packedSuccess && (
                        <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <CheckCircle size={18} className="shrink-0 text-emerald-600" />
                                <div>
                                    <span className="font-bold text-xs text-emerald-900">This order has already been packed and marked Ready To Ship.</span>
                                    <p className="text-[11px] text-emerald-700 mt-0.5">Physical bottles are recorded and ready for dispatch at Logistics Station.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsPrintModalOpen(true)}
                                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-all"
                                >
                                    <Printer size={13} /> Print Packing Slip
                                </button>
                                <button
                                    onClick={handleReset}
                                    className="flex items-center gap-1 text-xs font-bold bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 px-3 py-2 rounded-xl cursor-pointer transition-colors"
                                >
                                    Next Order
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Success Notice upon Confirmation */}
                    {packedSuccess && (
                        <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 animate-in zoom-in-95 duration-200">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                        <CheckCircle size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black">Packing Completed Successfully!</h3>
                                        <p className="text-xs text-emerald-700 mt-0.5">Order #{packingData.orderNumber} status changed to <span className="font-bold uppercase">Ready To Ship</span> and forwarded to Logistics Station.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setIsPrintModalOpen(true)}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors"
                                    >
                                        <Printer size={14} /> Print Packing Slip
                                    </button>
                                    <button
                                        onClick={handleReset}
                                        className="px-4 py-2 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                                    >
                                        Next Order
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Two-Column Layout (OrderDetail Pattern) ─────────── */}
                    <div className="flex flex-col lg:flex-row gap-5 items-start">

                        {/* ── Left Main Column: Bottle Checklist + Packaging Box ── */}
                        <div className="flex-1 min-w-0 flex flex-col gap-5 w-full">

                            {/* Physical Bottle Allocation Table (Exact OrderDetail format) */}
                            {packingData.items && packingData.items.length > 0 && !isOrderPlacedStatus && (
                                <div className="bg-white border border-slate-200 rounded-2xl relative z-20">
                                    {/* Card Header */}
                                    <div className="px-5 py-3.5 bg-slate-50/60 border-b border-slate-200 rounded-t-2xl flex items-center justify-between">
                                        <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                            <Package size={14} className="text-indigo-600" />
                                            Physical Bottle Checklist (<span className="font-mono text-slate-500 font-semibold">OrderProductItem</span>)
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                {totalAssignedCount} of {totalBottlesCount} Assigned
                                            </span>
                                        </div>
                                    </div>

                                    {/* Table view */}
                                    <div className="overflow-visible">
                                        <table className="w-full text-left text-sm text-slate-600">
                                            <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                <tr>
                                                    <th className="w-12 py-3 px-4 text-center">#</th>
                                                    <th className="py-3 px-4 text-left">Bottle Item</th>
                                                    <th className="py-3 px-4 text-left">SKU</th>
                                                    <th className="py-3 px-4 text-left">Physical Batch Allocation</th>
                                                    <th className="py-3 px-4 text-center">Status</th>
                                                    {!isAlreadyPacked && <th className="py-3 px-4 text-right">Action</th>}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {packingData.items.map((bottle, idx) => {
                                                    const availableForProduct = (packingData.availableBatches || [])
                                                        .filter(b => b.productId === bottle.productSingleId);

                                                    const currentBatchEdid = bottleAssignments[bottle.edid] || '';

                                                    // Dynamic batch options based on remaining stock after other bottles claimed
                                                    const batchOptions = availableForProduct.map(b => {
                                                        const countUsedByOthers = (packingData.items || []).filter(
                                                            other => other.edid !== bottle.edid && bottleAssignments[other.edid] === b.edid
                                                        ).length;

                                                        const remainingForThisBottle = Math.max(0, (b.remainingQty || 0) - countUsedByOthers);
                                                        const isCurrentSelection = currentBatchEdid === b.edid;
                                                        const isOutOfStock = remainingForThisBottle <= 0 && !isCurrentSelection;

                                                        let stockText = `Stock: ${remainingForThisBottle}`;
                                                        if (isOutOfStock) {
                                                            stockText = (b.remainingQty || 0) <= 0 ? 'Out of Stock' : 'Stock Limit Reached';
                                                        }

                                                        return {
                                                            value: b.edid,
                                                            label: `${b.batchNumber} (${stockText})`,
                                                            disabled: isOutOfStock
                                                        };
                                                    });

                                                    return (
                                                        <tr key={bottle.edid || idx} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="py-3.5 px-4 text-center">
                                                                <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 font-mono text-xs font-bold inline-flex items-center justify-center border border-slate-200">
                                                                    #{idx + 1}
                                                                </span>
                                                            </td>
                                                            <td className="py-3.5 px-4">
                                                                <span className="font-semibold text-slate-800 text-xs block">
                                                                    {bottle.productName}
                                                                </span>
                                                            </td>
                                                            <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                                                                {bottle.productSku || '—'}
                                                            </td>
                                                            <td className="py-3.5 px-4">
                                                                {isAlreadyPacked ? (
                                                                    bottle.batchNumber ? (
                                                                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                            <Tag size={10} /> {bottle.batchNumber}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-xs text-slate-400 font-mono">—</span>
                                                                    )
                                                                ) : (
                                                                    <div className="w-64">
                                                                        <Dropdown
                                                                            value={currentBatchEdid}
                                                                            onChange={(val) => setBottleAssignments(prev => ({ ...prev, [bottle.edid]: val }))}
                                                                            options={batchOptions}
                                                                            placeholder="Select physical batch..."
                                                                            className="w-full text-xs"
                                                                            disabled={isAlreadyPacked}
                                                                            searchable={true}
                                                                            searchPlaceholder="Search batch / stock..."
                                                                        />
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-center">
                                                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${bottle.status === 'Packed' || (currentBatchEdid && isAlreadyPacked)
                                                                    ? 'bg-emerald-100 text-emerald-800'
                                                                    : 'bg-amber-100 text-amber-800'
                                                                    }`}>
                                                                    {bottle.status === 'Packed' || isAlreadyPacked ? <CheckCircle size={10} /> : <Clock size={10} />}
                                                                    {bottle.status || (currentBatchEdid ? 'Ready' : 'Pending')}
                                                                </span>
                                                            </td>
                                                            {!isAlreadyPacked && (
                                                                <td className="py-3.5 px-4 text-right">
                                                                    {currentBatchEdid && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleApplyBatchToAll(bottle.productSingleId, currentBatchEdid)}
                                                                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                                                                            title="Assign this batch to all bottles of this product (up to stock limit)"
                                                                        >
                                                                            Apply to all
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Used Packing Materials Card */}
                            {!isOrderPlacedStatus && !isAlreadyPacked && (
                                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 relative z-10">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                                        <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                            <Package size={14} className="text-amber-500" />
                                            Used Packing Materials
                                        </h3>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                            {usedPackingMaterials.length} item{usedPackingMaterials.length === 1 ? '' : 's'} selected
                                        </span>
                                    </div>

                                    {/* Dropdown to add packing material from Packaging category */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-600 block">
                                            Select Packing Material to Add
                                        </label>
                                        <Dropdown
                                            value={selectedMaterialToAdd}
                                            onChange={handleAddPackingMaterial}
                                            options={packingMaterialOptions}
                                            placeholder="Select packing material (boxes, bubble wrap, tape...)"
                                            className="w-full text-xs"
                                            searchable={true}
                                            onSearchChange={handleMaterialSearch}
                                            searchPlaceholder="Search materials from category Packaging..."
                                        />
                                        <p className="text-[10px] text-slate-400">
                                            Only raw materials from category <strong>Packaging</strong> are listed. You can select multiple items. Stock will be consumed in FIFO order upon confirmation.
                                        </p>
                                    </div>

                                    {/* Table of selected used packing materials */}
                                    {usedPackingMaterials.length > 0 ? (
                                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/30">
                                            <table className="w-full text-left text-xs text-slate-600">
                                                <thead className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                    <tr>
                                                        <th className="w-10 py-2.5 px-3 text-center">#</th>
                                                        <th className="py-2.5 px-3 text-left">Packing Material Item</th>
                                                        <th className="py-2.5 px-3 text-center">Available Stock</th>
                                                        <th className="py-2.5 px-3 text-center w-36">Quantity Used</th>
                                                        <th className="py-2.5 px-3 text-right w-16">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 bg-white">
                                                    {usedPackingMaterials.map((item, idx) => {
                                                        const isStockExceeded = item.quantity > item.stock;
                                                        return (
                                                            <tr key={item.materialEdid} className="hover:bg-slate-50/60 transition-colors">
                                                                <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400">
                                                                    #{idx + 1}
                                                                </td>
                                                                <td className="py-2.5 px-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                                                                            <Package size={13} className="text-amber-600" />
                                                                        </div>
                                                                        <div>
                                                                            <span className="font-bold text-slate-800 block text-xs">{item.name}</span>
                                                                            <span className="text-[10px] text-slate-400">Category: Packaging</span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="py-2.5 px-3 text-center">
                                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${item.stock > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                                                        {item.stock} {item.unitSymbol || 'pcs'}
                                                                    </span>
                                                                </td>
                                                                <td className="py-2.5 px-3 text-center">
                                                                    <div className="inline-flex items-center border border-slate-200 rounded-xl bg-white overflow-hidden">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleUpdateMaterialQty(item.materialEdid, Math.max(1, item.quantity - 1))}
                                                                            className="px-2 py-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                                                                        >
                                                                            <Minus size={11} />
                                                                        </button>
                                                                        <input
                                                                            type="number"
                                                                            min="1"
                                                                            max={item.stock}
                                                                            step="1"
                                                                            value={item.quantity}
                                                                            onChange={(e) => handleUpdateMaterialQty(item.materialEdid, e.target.value)}
                                                                            className={`w-14 text-center text-xs font-bold py-1 border-x border-slate-100 outline-none ${isStockExceeded ? 'text-red-600 bg-red-50' : 'text-slate-800'}`}
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleUpdateMaterialQty(item.materialEdid, item.quantity + 1)}
                                                                            disabled={item.quantity >= item.stock}
                                                                            className="px-2 py-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30 transition-colors cursor-pointer"
                                                                        >
                                                                            <Plus size={11} />
                                                                        </button>
                                                                    </div>
                                                                    {isStockExceeded && (
                                                                        <p className="text-[10px] text-red-500 font-bold mt-0.5">Exceeds stock!</p>
                                                                    )}
                                                                </td>
                                                                <td className="py-2.5 px-3 text-right">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemovePackingMaterial(item.materialEdid)}
                                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                                                                        title="Remove item"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="border border-dashed border-slate-200 rounded-xl p-4 text-center bg-slate-50/50">
                                            <Package size={22} className="mx-auto text-slate-300 mb-1" />
                                            <p className="text-xs font-semibold text-slate-600">No packing materials selected</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                Use the dropdown above to add boxes, bubble wrap, tape or cartons used for this package.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Package Weight & Dimensions Card - Single Row Layout */}
                            {!isOrderPlacedStatus && !isAlreadyPacked && (
                                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 relative z-10">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                                        <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                            <Box size={14} className="text-amber-500" />
                                            Package Weight & Dimensions
                                        </h3>
                                        <span className="text-[10px] text-red-500 font-semibold flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                            All 4 fields required
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                                Approx Weight <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0.01"
                                                    required
                                                    value={boxDimensions.weight}
                                                    onChange={(e) => setBoxDimensions(prev => ({ ...prev, weight: e.target.value }))}
                                                    placeholder="e.g. 1.25"
                                                    className={`w-full h-[38px] px-3 pr-8 bg-white border rounded-xl text-xs font-semibold text-slate-800 outline-none transition-colors ${!boxDimensions.weight ? 'border-slate-200 focus:border-indigo-500' : 'border-slate-200 focus:border-indigo-500'
                                                        }`}
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">kg</span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                                Length (L) <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0.01"
                                                    required
                                                    value={boxDimensions.length}
                                                    onChange={(e) => setBoxDimensions(prev => ({ ...prev, length: e.target.value }))}
                                                    placeholder="Length"
                                                    className="w-full h-[38px] px-3 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 transition-colors"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400">cm</span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                                Width (W) <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0.01"
                                                    required
                                                    value={boxDimensions.width}
                                                    onChange={(e) => setBoxDimensions(prev => ({ ...prev, width: e.target.value }))}
                                                    placeholder="Width"
                                                    className="w-full h-[38px] px-3 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 transition-colors"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400">cm</span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                                Height (H) <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0.01"
                                                    required
                                                    value={boxDimensions.height}
                                                    onChange={(e) => setBoxDimensions(prev => ({ ...prev, height: e.target.value }))}
                                                    placeholder="Height"
                                                    className="w-full h-[38px] px-3 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 transition-colors"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400">cm</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Already Packed: Used Packing Materials View */}
                            {isAlreadyPacked && packingData?.usedMaterials && packingData.usedMaterials.length > 0 && (
                                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                                    <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                                        <CheckCircle size={14} className="text-emerald-500" />
                                        Used Packing Materials (Deducted from Batches)
                                    </h3>
                                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/30">
                                        <table className="w-full text-left text-xs text-slate-600">
                                            <thead className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                <tr>
                                                    <th className="py-2.5 px-3">Packing Material</th>
                                                    <th className="py-2.5 px-3 text-center">Batch Number</th>
                                                    <th className="py-2.5 px-3 text-center">Qty Consumed</th>
                                                    <th className="py-2.5 px-3 text-right">Recorded At</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 bg-white">
                                                {packingData.usedMaterials.map((um, i) => (
                                                     <tr key={i}>
                                                        <td className="py-2.5 px-3 font-bold text-slate-800">
                                                            {um.materialName}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-600">
                                                            {um.batchNumber || '-'}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center font-bold text-emerald-700">
                                                            {um.quantityUsed}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right text-[11px] text-slate-400 font-mono">
                                                            {um.createdAt ? formatDateTime(um.createdAt) : '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Bottom Action Footer */}
                            {!isOrderPlacedStatus && !isAlreadyPacked && !packedSuccess && (
                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <button
                                        onClick={handleReset}
                                        className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        onClick={handleConfirmPacking}
                                        disabled={confirming}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl cursor-pointer transition-all"
                                    >
                                        {confirming ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                                        Confirm Packing & Mark Ready To Ship
                                    </button>
                                </div>
                            )}

                        </div>

                        {/* ── Right Column: Customer & Shipping + Summary (OrderDetail style) ── */}
                        <div className="w-full lg:w-[340px] shrink-0 flex flex-col gap-5">

                            {/* Customer & Shipping Card */}
                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                                <div className="px-4 py-3 bg-slate-50/60 border-b border-slate-200 flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                        <User size={13} className="text-amber-500" /> Customer & Delivery
                                    </h3>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                        {packingData.deliveryType === 'DIRECT' ? 'Direct' : 'Courier'}
                                    </span>
                                </div>
                                <div className="p-4 space-y-3.5">
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Customer Name</p>
                                        <p className="text-xs font-bold text-slate-800 mt-0.5">{packingData.customerName || 'Customer'}</p>
                                    </div>

                                    {packingData.customerMobile && (
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Contact Number</p>
                                            <a
                                                href={`tel:${packingData.customerMobile}`}
                                                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 mt-0.5 flex items-center gap-1"
                                            >
                                                <Phone size={11} className="text-slate-400" />
                                                {packingData.customerMobile}
                                            </a>
                                        </div>
                                    )}

                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Shipping Address</p>
                                        <div className="text-xs text-slate-600 mt-0.5 flex items-start gap-1.5">
                                            <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                                            <div>
                                                {packingData.deliveryAddress?.addressLine1 && <p>{packingData.deliveryAddress.addressLine1}</p>}
                                                {packingData.deliveryAddress?.addressLine2 && <p>{packingData.deliveryAddress.addressLine2}</p>}
                                                <p className="font-semibold text-slate-700">
                                                    {[packingData.deliveryAddress?.city, packingData.deliveryAddress?.state, packingData.deliveryAddress?.pincode].filter(Boolean).join(', ') || 'No address specified'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Packing & Order Summary Card */}
                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                                <div className="px-4 py-3 bg-slate-50/60 border-b border-slate-200 flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                        <Box size={13} className="text-indigo-600" /> Packing Summary
                                    </h3>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusConfig.badge}`}>
                                        {formatOrderStatus(packingData.status)}
                                    </span>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">Order Number</span>
                                        <span className="font-mono font-bold text-slate-800">#{packingData.orderNumber}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">Total Bottles to Pack</span>
                                        <span className="font-bold text-slate-800">{totalBottlesCount} unit(s)</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">Batches Assigned</span>
                                        <span className={`font-bold ${totalAssignedCount === totalBottlesCount && totalBottlesCount > 0 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                            {totalAssignedCount} of {totalBottlesCount}
                                        </span>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="space-y-1 pt-1">
                                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-300 ${totalAssignedCount === totalBottlesCount && totalBottlesCount > 0 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                                style={{ width: `${totalBottlesCount > 0 ? (totalAssignedCount / totalBottlesCount) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Packing materials summary */}
                                    {usedPackingMaterials.length > 0 && !isAlreadyPacked && (
                                        <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100">
                                            <span className="text-slate-500 font-medium">Packing Materials</span>
                                            <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-[10px]">
                                                {usedPackingMaterials.length} item{usedPackingMaterials.length === 1 ? '' : 's'}
                                            </span>
                                        </div>
                                    )}

                                    {isAlreadyPacked && packingData?.usedMaterials && packingData.usedMaterials.length > 0 && (
                                        <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100">
                                            <span className="text-slate-500 font-medium">Packing Materials</span>
                                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                                                {packingData.usedMaterials.length} deducted
                                            </span>
                                        </div>
                                    )}

                                    {/* Existing package details if packed */}
                                    {packingData.package && (
                                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 mt-2 space-y-1.5 text-[11px]">
                                            <div className="flex items-center justify-between font-bold text-slate-700">
                                                <span>Package Info</span>
                                                {packingData.package.weight && <span>{packingData.package.weight} kg</span>}
                                            </div>
                                            {(packingData.package.length || packingData.package.width || packingData.package.height) && (
                                                <p className="text-[10px] text-slate-500 font-mono">
                                                    Dim: {packingData.package.length || 0} × {packingData.package.width || 0} × {packingData.package.height || 0} cm
                                                </p>
                                            )}
                                            {packingData.package.courier && (
                                                <p className="text-[10px] text-slate-600">
                                                    Carrier: <strong className="text-slate-800">{packingData.package.courier}</strong>
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/orders/${packingData.orderNumber}/${packingData.orderEdid}`)}
                                            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer"
                                        >
                                            View Full Order Details
                                        </button>
                                        {isAlreadyPacked && (
                                            <button
                                                type="button"
                                                onClick={() => setIsPrintModalOpen(true)}
                                                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all cursor-pointer"
                                            >
                                                <Printer size={13} /> Print Packing Slip
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div>

                    </div>

                </div>
            )}

            {/* ── Print Packing Slip Modal ──────────────────────────── */}
            {isPrintModalOpen && packingData && (
                <OrderPrintModal
                    isOpen={isPrintModalOpen}
                    onClose={() => setIsPrintModalOpen(false)}
                    order={{
                        ...packingData,
                        edid: packingData.orderEdid,
                        id: packingData.orderEdid,
                        totalAmount: 0
                    }}
                    docType="packingslip"
                />
            )}

            {/* ── Notice / Alert Modal Component ────────────────────── */}
            <ConfirmModal
                isOpen={noticeModal.isOpen}
                onClose={() => setNoticeModal({ isOpen: false, title: '', message: '', variant: 'warning' })}
                title={noticeModal.title}
                message={noticeModal.message}
                isAlert={true}
                confirmText="OK"
                variant={noticeModal.variant}
            />

            {/* ── Camera QR Code Scanner Modal ───────────────────────── */}
            <QrCameraScannerModal
                isOpen={isCameraScannerOpen}
                onClose={() => setIsCameraScannerOpen(false)}
                onScan={(code) => {
                    handleSearchOrder(null, code);
                }}
                title="Scan Order QR Code"
            />

            {/* ── Confirmed Orders Delivery Slips Modal ──────────────── */}
            <ConfirmedSlipsModal
                isOpen={isConfirmedSlipsModalOpen}
                onClose={() => setIsConfirmedSlipsModalOpen(false)}
            />
        </div>
    );
}
