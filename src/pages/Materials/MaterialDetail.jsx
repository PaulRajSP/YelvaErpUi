import { PAGE_SIZE, formatDate, formatDateTime, parseUTCToLocalDate } from '../../common/utils';
import React, { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { purchaseApi } from '../../api/purchaseApi';
import {
    Package, Edit2, Hash, Calendar, ShoppingCart, TrendingDown,
    ArrowLeft, RefreshCw, Archive, Layers, ShieldAlert, Clock,
    Activity, List, Sparkles, Boxes, CheckCircle2,
    AlertCircle, Search, ChevronRight, ChevronDown, FileText, Loader2, Eye
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { Button } from '../../components/ui/Button';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { Tooltip } from '../../components/ui/Tooltip';
import DocumentViewModal from '../../components/common/DocumentViewModal';
import { API_BASE } from '../../services/apiClient';

export default function MaterialDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useStore();
    const isAdmin = currentUser?.role === 'Admin';

    const [material, setMaterial] = useState(null);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState('purchases'); // 'purchases' or 'usages'
    const [viewDoc, setViewDoc] = useState(null);

    // Purchase History State
    const [purchases, setPurchases] = useState([]);
    const [purchasePage, setPurchasePage] = useState(1);
    const [purchaseTotalPages, setPurchaseTotalPages] = useState(1);
    const [purchaseTotalCount, setPurchaseTotalCount] = useState(0);
    const [loadingPurchases, setLoadingPurchases] = useState(false);
    const [purchasesLoadedPage, setPurchasesLoadedPage] = useState(null);

    // Batches State (Tab 2)
    const [batches, setBatches] = useState([]);
    const [batchPage, setBatchPage] = useState(1);
    const [batchTotalPages, setBatchTotalPages] = useState(1);
    const [batchTotalCount, setBatchTotalCount] = useState(0);
    const [loadingBatches, setLoadingBatches] = useState(false);
    const [batchesLoaded, setBatchesLoaded] = useState(false);

    // Accordion State: Initially all closed!
    const [expandedBatches, setExpandedBatches] = useState(new Set());
    // Lazy loaded usages: only fetched on-demand when accordion is opened
    const [batchUsages, setBatchUsages] = useState({});
    const [loadingBatchUsages, setLoadingBatchUsages] = useState({});

    // Ref guards to strictly prevent duplicate API calls (even with React StrictMode / concurrent rendering)
    const fetchedMaterialRef = useRef(null);
    const inFlightMaterialRef = useRef(false);

    const fetchedPurchasesRef = useRef(new Set());
    const inFlightPurchasesRef = useRef(new Set());

    const fetchedBatchesRef = useRef(new Set());
    const inFlightBatchesRef = useRef(new Set());

    // 1. Fetch Material Details (Only runs once for the material ID)
    useEffect(() => {
        if (!id) return;
        if (fetchedMaterialRef.current === id || inFlightMaterialRef.current) return;

        const fetchDetails = async () => {
            inFlightMaterialRef.current = true;
            setLoading(true);
            try {
                const res = await purchaseApi.getRawMaterialById(id);
                setMaterial(res);
                fetchedMaterialRef.current = id;
            } catch (error) {
                console.error("Failed to load material:", error);
            } finally {
                inFlightMaterialRef.current = false;
                setLoading(false);
            }
        };
        fetchDetails();
    }, [id]);

    // 2. Fetch Purchase History (Only runs when activeTab is 'purchases' and page changes or not loaded)
    useEffect(() => {
        if (!id || activeTab !== 'purchases') return;
        const pageKey = `${id}_p${purchasePage}`;
        if (fetchedPurchasesRef.current.has(pageKey) || inFlightPurchasesRef.current.has(pageKey)) {
            return;
        }

        const fetchPurchases = async () => {
            inFlightPurchasesRef.current.add(pageKey);
            setLoadingPurchases(true);
            try {
                const res = await purchaseApi.getMaterialPurchaseHistory(id, purchasePage, PAGE_SIZE);
                const newPurchases = res?.items || [];
                setPurchases(prev => {
                    if (JSON.stringify(prev) === JSON.stringify(newPurchases)) return prev;
                    return newPurchases;
                });
                setPurchaseTotalPages(prev => prev === (res?.totalPages || 1) ? prev : (res?.totalPages || 1));
                setPurchaseTotalCount(prev => prev === (res?.totalCount || 0) ? prev : (res?.totalCount || 0));
                fetchedPurchasesRef.current.add(pageKey);
                setPurchasesLoadedPage(purchasePage);
            } catch (err) {
                console.error("Failed to load purchase history", err);
            } finally {
                inFlightPurchasesRef.current.delete(pageKey);
                setLoadingPurchases(false);
            }
        };
        fetchPurchases();
    }, [id, activeTab, purchasePage]);

    // 3. Fetch Material Batches for Tab 2 (only loads the batch list)
    const fetchBatches = async () => {
        if (!id) return;
        setLoadingBatches(true);
        try {
            const batchRes = await purchaseApi.getMaterialBatchList(id, batchPage, PAGE_SIZE, '');
            const items = batchRes?.items || batchRes?.Items || (Array.isArray(batchRes) ? batchRes : []);
            setBatches(prev => {
                if (JSON.stringify(prev) === JSON.stringify(items)) return prev;
                return items;
            });
            const total = batchRes?.totalCount ?? batchRes?.TotalCount ?? items.length;
            setBatchTotalCount(prev => prev === total ? prev : total);
            setBatchTotalPages(prev => {
                const next = batchRes?.totalPages ?? batchRes?.TotalPages ?? Math.max(1, Math.ceil(total / PAGE_SIZE));
                return prev === next ? prev : next;
            });
            setBatchesLoaded(true);
        } catch (err) {
            console.error("Failed to load material batches", err);
            setBatches([]);
        } finally {
            setLoadingBatches(false);
        }
    };

    useEffect(() => {
        if (!id || activeTab !== 'usages') return;
        fetchBatches();
    }, [id, activeTab, batchPage]);

    // Toggle batch accordion and ONLY fetch API when opened
    const toggleBatch = async (batch) => {
        const batchEdid = batch.materialBatchEdid || batch.edid || batch.id;
        const isExpanded = expandedBatches.has(batchEdid);

        if (isExpanded) {
            setExpandedBatches(prev => {
                const next = new Set(prev);
                next.delete(batchEdid);
                return next;
            });
            return;
        }

        // Open accordion
        setExpandedBatches(prev => {
            const next = new Set(prev);
            next.add(batchEdid);
            return next;
        });

        // ONLY call API when opened, if not already cached
        if (!batchUsages[batchEdid] && !loadingBatchUsages[batchEdid]) {
            setLoadingBatchUsages(prev => ({ ...prev, [batchEdid]: true }));
            try {
                const uRes = await purchaseApi.getMaterialUsageHistory(id, batchEdid);
                const items = uRes?.items || uRes?.Items || (Array.isArray(uRes?.data?.items) ? uRes.data.items : (Array.isArray(uRes) ? uRes : []));
                setBatchUsages(prev => ({ ...prev, [batchEdid]: items }));
            } catch (err) {
                console.error(`Failed to load usages for batch ${batch.batchNumber}:`, err);
                setBatchUsages(prev => ({ ...prev, [batchEdid]: [] }));
            } finally {
                setLoadingBatchUsages(prev => ({ ...prev, [batchEdid]: false }));
            }
        }
    };

    const collapseAllBatches = () => {
        setExpandedBatches(new Set());
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                <p className="text-slate-400 text-sm font-medium">Loading material details…</p>
            </div>
        );
    }

    if (!material) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <Package className="w-16 h-16 text-slate-300 mb-4" />
                <h2 className="text-xl font-bold text-slate-800">Material Not Found</h2>
                <Button className="mt-4" onClick={() => navigate('/materials')}>Back to Materials</Button>
            </div>
        );
    }

    const unitSymbol = material.unitSymbol || material.allowedUnitSymbol || material.unit || '';
    const stockOk = material.stock > material.reorderLevel;

    const OVERVIEW_ITEMS = [
        { label: 'Category', value: material.category, Icon: Archive, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
        { label: 'Reorder Level', value: `${material.reorderLevel} ${unitSymbol}`, Icon: Layers, bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
        { label: 'Min Quantity', value: `${material.minQuantity} ${unitSymbol}`, Icon: ShieldAlert, bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    ];

    return (
        <div className="flex flex-col gap-5 pb-12">
            {/* ── PAGE HEADER ─────────────────────────────────────── */}
            <PageHeader
                title={material.name}
                subtitle={`Raw Material • ${material.category}`}
                rightContent={
                    <div className="flex items-center gap-3">
                        <Button variant="secondary" onClick={() => navigate('/materials')} icon={ArrowLeft}>Back</Button>
                        {isAdmin && (
                            <Button onClick={() => { }} icon={Edit2}>Edit Material</Button>
                        )}
                    </div>
                }
            />

            {/* ── STAT CARDS ──────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-xs">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">In Stock</p>
                    <div className="flex items-baseline gap-2">
                        <p className={`text-2xl font-black ${stockOk ? 'text-emerald-600' : 'text-red-500'}`}>{material.stock ?? 0}</p>
                        <p className="text-slate-400 text-xs font-bold uppercase">{unitSymbol}</p>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${material.status === 'LowStock' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                            {stockOk ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                            {material.status || (stockOk ? 'In Stock' : 'Low Stock')}
                        </span>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-xs">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Active Batches</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-black text-slate-900">{batchesLoaded ? batches.length : '—'}</p>
                        <p className="text-slate-400 text-xs font-medium">batches</p>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1 font-medium">
                        <Boxes size={13} className="text-indigo-500" />
                        {batchesLoaded ? 'In warehouse inventory' : 'Click Usages tab to load'}
                    </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-xs">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Purchases</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-black text-slate-900">{purchasesLoadedPage !== null ? purchaseTotalCount : '—'}</p>
                        <p className="text-slate-400 text-xs font-medium">invoices</p>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1 font-medium">
                        <ShoppingCart size={13} className="text-slate-400" />
                        Procured invoices logged
                    </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-xs">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Reorder Level</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-black text-slate-900">{material.reorderLevel ?? 0}</p>
                        <p className="text-slate-400 text-xs font-bold uppercase">{unitSymbol}</p>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1 font-medium">
                        <ShieldAlert size={13} className="text-amber-500" />
                        Low stock threshold alert
                    </p>
                </div>
            </div>

            {/* ── MAIN CONTENT (TABS & SIDEBAR) ────────────────────── */}
            <div className="flex flex-col lg:flex-row gap-5 items-start">
                {/* ── LEFT TABS SECTION ────────────────────────────── */}
                <div className="flex-1 min-w-0 w-full flex flex-col gap-5">
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-xs">
                        {/* YouTube Studio Style Segmented Tab Header */}
                        <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50/50">
                            {/* Tab 1: Purchase History */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('purchases')}
                                className={`px-6 py-3.5 text-center transition-all cursor-pointer relative group flex flex-col items-center justify-center ${activeTab === 'purchases'
                                        ? 'bg-white shadow-xs'
                                        : 'bg-slate-50/70 hover:bg-slate-100/60 text-slate-500'
                                    }`}
                            >
                                {activeTab === 'purchases' && (
                                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-600" />
                                )}
                                <span className={`text-xs font-bold transition-colors flex items-center gap-1.5 ${activeTab === 'purchases' ? 'text-indigo-600' : 'text-slate-600 group-hover:text-slate-900'
                                    }`}>
                                    <ShoppingCart size={14} />
                                    Purchase History
                                </span>
                                <span className={`text-xl font-black mt-0.5 font-mono transition-colors ${activeTab === 'purchases' ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'
                                    }`}>
                                    {purchasesLoadedPage !== null ? purchaseTotalCount : (loadingPurchases ? '…' : 0)}
                                </span>
                            </button>

                            {/* Tab 2: Usage History (Batches) */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('usages')}
                                className={`px-6 py-3.5 text-center transition-all cursor-pointer relative group flex flex-col items-center justify-center border-l border-slate-200 ${activeTab === 'usages'
                                        ? 'bg-white shadow-xs'
                                        : 'bg-slate-50/70 hover:bg-slate-100/60 text-slate-500'
                                    }`}
                            >
                                {activeTab === 'usages' && (
                                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-600" />
                                )}
                                <span className={`text-xs font-bold transition-colors flex items-center gap-1.5 ${activeTab === 'usages' ? 'text-indigo-600' : 'text-slate-600 group-hover:text-slate-900'
                                    }`}>
                                    <TrendingDown size={14} />
                                    Usage History (Batches)
                                </span>
                                <span className={`text-xl font-black mt-0.5 font-mono transition-colors ${activeTab === 'usages' ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'
                                    }`}>
                                    {batchesLoaded ? batchTotalCount : (loadingBatches ? '…' : 0)}
                                </span>
                            </button>
                        </div>

                        {/* Sub-header controls for Usages tab */}
                        {activeTab === 'usages' && batches.length > 0 && (
                            <div className="px-6 py-2.5 bg-slate-50/40 border-b border-slate-100 flex items-center justify-between text-xs shrink-0">
                                <span className="text-slate-500 font-medium">
                                    Showing <strong className="text-slate-800">{batches.length}</strong> {batches.length === 1 ? 'batch' : 'batches'} • Click any batch to view its deductions
                                </span>
                                {expandedBatches.size > 0 && (
                                    <button
                                        type="button"
                                        onClick={collapseAllBatches}
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer flex items-center gap-1.5"
                                    >
                                        <ChevronDown size={14} /> Collapse All
                                    </button>
                                )}
                            </div>
                        )}

                        {/* TAB 1: PURCHASE HISTORY */}
                        {activeTab === 'purchases' && (
                            <div className="flex-1 overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-left">Date</TableHead>
                                            <TableHead className="text-left">Invoice #</TableHead>
                                            <TableHead className="text-left">Supplier</TableHead>
                                            <TableHead className="text-left">Batch Number</TableHead>
                                            <TableHead className="text-right">Cost/Unit</TableHead>
                                            <TableHead className="text-right">Quantity</TableHead>
                                            <TableHead className="text-center pr-6">Document</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody padRows={false}>
                                        {loadingPurchases ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-16 text-slate-400 font-medium">
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                                        <p className="text-xs text-slate-500">Loading purchase history…</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : purchases.length > 0 ? (
                                            purchases.map((purchase, idx) => (
                                                <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2 text-slate-600">
                                                            <Calendar size={14} className="text-slate-400" />
                                                            {formatDate(purchase.purchaseDate)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-bold text-slate-700">
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate(`/purchases/${purchase.purchaseEdid || purchase.invoiceNumber}`)}
                                                            className="hover:text-indigo-600 hover:underline cursor-pointer text-slate-800 transition-colors"
                                                            title="View Purchase Invoice"
                                                        >
                                                            #{purchase.invoiceNumber}
                                                        </button>
                                                    </TableCell>
                                                    <TableCell className="font-medium text-slate-600">{purchase.supplierName}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1.5">
                                                            <Hash size={14} className="text-slate-400" />
                                                            <span className="font-bold text-slate-800">{purchase.batchNumber}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium text-slate-600">
                                                        ₹{purchase.unitPrice}
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-slate-700">
                                                        {purchase.quantity} <span className="text-[10px] text-slate-400 uppercase font-bold ml-0.5">{unitSymbol}</span>
                                                    </TableCell>
                                                    <TableCell className="text-center pr-6" style={{ borderLeft: 'none' }}>
                                                        {purchase.attachmentData?.length > 0 ? (
                                                            <div className="flex justify-center gap-1">
                                                                {purchase.attachmentData.map((attachment, attachmentIndex) => {
                                                                    const fileName = attachment.attachmentOriginalName || `Purchase_Invoice_${purchase.invoiceNumber || 'doc'}_${attachmentIndex + 1}`;
                                                                    return <Tooltip key={attachment.attachmentEdid} content={fileName}>
                                                                        <Button variant="ghost" size="icon" icon={FileText} onClick={() => setViewDoc({
                                                                            url: `${API_BASE}/common/attachment/${attachment.attachmentEdid}/${encodeURIComponent(fileName)}`,
                                                                            title: `Purchase Document · Invoice #${purchase.invoiceNumber || ''}`,
                                                                            fileName
                                                                        })} />
                                                                    </Tooltip>;
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <Tooltip content="View Purchase Details">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    icon={Eye}
                                                                    onClick={() => navigate(`/purchases/${purchase.purchaseEdid || purchase.invoiceNumber}`)}
                                                                />
                                                            </Tooltip>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-16 text-slate-400 font-medium">
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                        <ShoppingCart size={32} className="stroke-1 text-slate-300 mb-1" />
                                                        <p className="text-sm font-semibold text-slate-600">No Purchase History</p>
                                                        <p className="text-xs text-slate-400">No purchase invoices recorded for this material yet.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>

                                {/* Pagination Footer for Purchases */}
                                <div className="border-t border-slate-100 bg-white shrink-0 rounded-b-2xl">
                                    <Pagination
                                        currentPage={purchasePage}
                                        totalPages={purchaseTotalPages}
                                        onPageChange={setPurchasePage}
                                        totalItems={purchaseTotalCount}
                                        itemsPerPage={PAGE_SIZE}
                                    />
                                </div>
                            </div>
                        )}

                        {/* TAB 2: USAGE HISTORY (BATCHES) ACCORDION TABLE */}
                        {activeTab === 'usages' && (
                            <div className="flex-1 overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12 text-center"></TableHead>
                                            <TableHead className="text-left">Batch Number</TableHead>
                                            <TableHead className="text-left">Latest Usage Date</TableHead>
                                            <TableHead className="text-center">Entries</TableHead>
                                            <TableHead className="text-right pr-6">Total Quantity Used</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody padRows={false}>
                                        {loadingBatches ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-16 text-slate-400 font-medium">
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                                        <p className="text-xs text-slate-500">Loading batch list…</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : batches.length > 0 ? (
                                            batches.map((batch) => {
                                                const batchEdid = batch.materialBatchEdid || batch.edid || batch.id;
                                                const isExpanded = expandedBatches.has(batchEdid);
                                                const usages = batchUsages[batchEdid];
                                                const isLoading = loadingBatchUsages[batchEdid];
                                                const hasData = Array.isArray(usages);

                                                return (
                                                    <Fragment key={batchEdid || batch.batchNumber}>
                                                        <TableRow
                                                            onClick={() => toggleBatch(batch)}
                                                            className="hover:bg-slate-50/80 cursor-pointer transition-colors group select-none border-b border-slate-100"
                                                        >
                                                            <TableCell className="w-12 text-center">
                                                                <div className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 group-hover:text-slate-600 transition-colors mx-auto">
                                                                    {isLoading ? (
                                                                        <Loader2 size={15} className="animate-spin text-indigo-600" />
                                                                    ) : isExpanded ? (
                                                                        <ChevronDown size={15} />
                                                                    ) : (
                                                                        <ChevronRight size={15} />
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="font-medium">
                                                                <div className="flex items-center gap-1.5 font-mono text-xs">
                                                                    <Hash size={14} className="text-indigo-500 shrink-0" />
                                                                    <span className="font-bold text-slate-800">{batch.batchNumber}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                                                    <Calendar size={13} className="text-slate-400 shrink-0" />
                                                                    <span>
                                                                        {hasData && usages.length > 0
                                                                            ? formatDate(usages[0].usageDate || usages[0].UsageDate)
                                                                            : isLoading
                                                                                ? 'Loading…'
                                                                                : '—'}
                                                                    </span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <span className="text-xs font-semibold text-slate-600">
                                                                    {hasData
                                                                        ? `${usages.length} ${usages.length === 1 ? 'entry' : 'entries'}`
                                                                        : isLoading
                                                                            ? '…'
                                                                            : '—'}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-right font-bold text-slate-800 pr-6 text-xs font-mono">
                                                                {hasData ? (
                                                                    <>
                                                                        {usages.reduce((sum, u) => sum + Number(u.quantityUsed ?? u.QuantityUsed ?? 0), 0)}
                                                                        <span className="text-[10px] text-slate-400 uppercase font-bold ml-0.5">{unitSymbol}</span>
                                                                    </>
                                                                ) : isLoading ? (
                                                                    '…'
                                                                ) : (
                                                                    '—'
                                                                )}
                                                            </TableCell>
                                                        </TableRow>

                                                        {/* Accordion Content: Individual Usages for this Batch */}
                                                        {isExpanded && (
                                                            <TableRow className="bg-slate-50/40 hover:bg-slate-50/40">
                                                                <TableCell colSpan={5} className="p-0 border-b border-slate-200">
                                                                    <div className="px-8 py-3.5 bg-slate-50/60 border-t border-slate-100">
                                                                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                                                                            {isLoading ? (
                                                                                <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-xs">
                                                                                    <Loader2 size={16} className="animate-spin text-indigo-600" />
                                                                                    <span>Loading usage deductions for batch {batch.batchNumber}…</span>
                                                                                </div>
                                                                            ) : hasData && usages.length > 0 ? (
                                                                                <Table>
                                                                                    <TableHeader>
                                                                                        <TableRow className="bg-slate-50/80">
                                                                                            <TableHead className="text-left w-36">Date</TableHead>
                                                                                            <TableHead className="text-left">Reason / Remarks</TableHead>
                                                                                            <TableHead className="text-right pr-6">Quantity</TableHead>
                                                                                        </TableRow>
                                                                                    </TableHeader>
                                                                                    <TableBody padRows={false}>
                                                                                        {usages.map((usage, uIdx) => (
                                                                                            <TableRow key={usage.id || uIdx} className="hover:bg-slate-50/60 transition-colors">
                                                                                                <TableCell className="font-medium whitespace-nowrap text-xs">
                                                                                                    <div className="flex items-center gap-2 text-slate-700">
                                                                                                        <Calendar size={13} className="text-slate-400 shrink-0" />
                                                                                                        <span>{formatDate(usage.usageDate || usage.UsageDate)}</span>
                                                                                                    </div>
                                                                                                </TableCell>
                                                                                                <TableCell className="text-xs text-slate-600">
                                                                                                    {usage.remark || usage.Remark || 'Material consumed'}
                                                                                                </TableCell>
                                                                                                <TableCell className="text-right font-bold text-xs text-slate-700 pr-6 font-mono whitespace-nowrap">
                                                                                                    {usage.quantityUsed ?? usage.QuantityUsed ?? 0} <span className="text-[10px] text-slate-400 uppercase font-bold ml-0.5">{unitSymbol}</span>
                                                                                                </TableCell>
                                                                                            </TableRow>
                                                                                        ))}
                                                                                    </TableBody>
                                                                                </Table>
                                                                            ) : (
                                                                                <div className="py-6 text-center text-slate-400 text-xs font-medium">
                                                                                    No deductions recorded for this batch.
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </Fragment>
                                                );
                                            })
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-16 text-slate-400 font-medium">
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                        <Boxes size={32} className="stroke-1 text-slate-300 mb-1" />
                                                        <p className="text-sm font-semibold text-slate-600">No Batches Found</p>
                                                        <p className="text-xs text-slate-400">No batch records found for this material yet.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>

                                {/* Pagination Footer for Batches */}
                                <div className="border-t border-slate-100 bg-white shrink-0 rounded-b-2xl">
                                    <Pagination
                                        currentPage={batchPage}
                                        totalPages={batchTotalPages}
                                        onPageChange={setBatchPage}
                                        totalItems={batchTotalCount}
                                        itemsPerPage={PAGE_SIZE}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT OVERVIEW SIDEBAR ──────────────────────── */}
                <div className="w-full lg:w-[290px] shrink-0 flex flex-col gap-4">
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                        <div className="px-5 py-4 border-b border-slate-100">
                            <h3 className="text-sm font-bold text-slate-900">Material Overview</h3>
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Configuration and thresholds</p>
                        </div>
                        <div className="p-3 flex flex-col gap-2">
                            {OVERVIEW_ITEMS.map(({ label, value, Icon, bg, border, text }, idx) => (
                                <div key={idx} className={`flex items-center justify-between rounded-xl px-4 py-3 border ${bg} ${border}`}>
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-7 h-7 rounded-lg bg-white/80 flex items-center justify-center`}>
                                            <Icon size={14} className={text} />
                                        </div>
                                        <span className={`text-xs font-bold ${text}`}>{label}</span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-slate-900">{value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Document View Modal */}
            {viewDoc && (
                <DocumentViewModal
                    isOpen={Boolean(viewDoc)}
                    onClose={() => setViewDoc(null)}
                    url={viewDoc.url}
                    title={viewDoc.title}
                    fileName={viewDoc.fileName}
                />
            )}
        </div>
    );
}
