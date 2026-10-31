import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { purchaseApi } from '../../api/purchaseApi';
import { Package, Edit2, ShoppingCart, TrendingDown, ArrowLeft, Archive, Layers, ShieldAlert, ChevronDown } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { Button } from '../../components/ui/Button';
import Dropdown from '../../components/common/Dropdown';
import DocumentViewModal from '../../components/common/DocumentViewModal';
import { PAGE_SIZE } from '../../common/utils';

// Import Separated Components
import MaterialStatCards from '../../components/materials/MaterialStatCards';
import PurchaseHistoryTab from '../../components/materials/PurchaseHistoryTab';
import BatchUsageTab from '../../components/materials/BatchUsageTab';

export default function MaterialDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useStore();
    const isAdmin = currentUser?.role === 'Admin';

    const [material, setMaterial] = useState(null);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState('purchases');
    const [viewDoc, setViewDoc] = useState(null);

    // Purchase History State
    const [purchases, setPurchases] = useState([]);
    const [purchasePage, setPurchasePage] = useState(1);
    const [purchaseTotalPages, setPurchaseTotalPages] = useState(1);
    const [purchaseTotalCount, setPurchaseTotalCount] = useState(0);
    const [loadingPurchases, setLoadingPurchases] = useState(false);
    const [purchasesLoadedPage, setPurchasesLoadedPage] = useState(null);

    // Batches State
    const [batches, setBatches] = useState([]);
    const [batchPage, setBatchPage] = useState(1);
    const [batchTotalPages, setBatchTotalPages] = useState(1);
    const [batchTotalCount, setBatchTotalCount] = useState(0);
    const [loadingBatches, setLoadingBatches] = useState(false);
    const [batchesLoaded, setBatchesLoaded] = useState(false);

    // Accordion State
    const [expandedBatches, setExpandedBatches] = useState(new Set());
    const [batchUsages, setBatchUsages] = useState({});
    const [loadingBatchUsages, setLoadingBatchUsages] = useState({});
    const [adjustingBatch, setAdjustingBatch] = useState(null);
    const [adjustmentType, setAdjustmentType] = useState('Out');
    const [adjustmentQuantity, setAdjustmentQuantity] = useState('');
    const [adjustmentRemark, setAdjustmentRemark] = useState('');
    const [adjustmentError, setAdjustmentError] = useState('');
    const [savingBatchAdjustment, setSavingBatchAdjustment] = useState(false);
    const [closingBatchId, setClosingBatchId] = useState(null);

    // Ref guards
    const fetchedMaterialRef = useRef(null);
    const inFlightMaterialRef = useRef(false);
    const fetchedPurchasesRef = useRef(new Set());
    const inFlightPurchasesRef = useRef(new Set());

    // 1. Fetch Material Details
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

    // 2. Fetch Purchase History
    useEffect(() => {
        if (!id) return;
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
    }, [id, purchasePage]);

    // 3. Fetch Material Batches
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
        if (!id) return;
        fetchBatches();
    }, [id, batchPage]);

    // Toggle batch accordion
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

        setExpandedBatches(prev => {
            const next = new Set(prev);
            next.add(batchEdid);
            return next;
        });

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

    const openBatchAdjustment = (batch) => {
        setAdjustingBatch(batch);
        setAdjustmentType('Out');
        setAdjustmentQuantity('');
        setAdjustmentRemark('');
        setAdjustmentError('');
    };

    const saveBatchAdjustment = async (event) => {
        event.preventDefault();
        const quantity = Number(adjustmentQuantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
            setAdjustmentError('Enter an adjustment quantity greater than zero.');
            return;
        }
        if (!adjustmentRemark.trim()) {
            setAdjustmentError('A remark is required for every stock adjustment.');
            return;
        }

        const batchEdid = adjustingBatch?.materialBatchEdid || adjustingBatch?.edid || adjustingBatch?.id;
        if (!batchEdid) {
            setAdjustmentError('Batch ID is missing.');
            return;
        }

        setSavingBatchAdjustment(true);
        setAdjustmentError('');
        try {
            await purchaseApi.adjustMaterialBatch(batchEdid, {
                entryType: adjustmentType,
                quantity,
                remark: adjustmentRemark.trim()
            });

            const delta = adjustmentType === 'In' ? quantity : -quantity;
            const entry = {
                entryType: adjustmentType,
                quantityUsed: quantity,
                usageDate: new Date().toISOString(),
                remark: adjustmentRemark.trim()
            };
            setBatches(previous => previous.map(batch => {
                const id = batch.materialBatchEdid || batch.edid || batch.id;
                return id === batchEdid
                    ? {
                        ...batch,
                        qtyRemaining: Number(batch.qtyRemaining || 0) + delta,
                        entriesCount: Number(batch.entriesCount || 0) + 1,
                        totalUsed: Number(batch.totalUsed || 0) + (adjustmentType === 'Out' ? quantity : 0),
                        latestUsageDate: entry.usageDate
                    }
                    : batch;
            }));
            setBatchUsages(previous => Array.isArray(previous[batchEdid])
                ? { ...previous, [batchEdid]: [entry, ...previous[batchEdid]] }
                : previous);
            setMaterial(previous => previous
                ? { ...previous, stock: Number(previous.stock || 0) + delta }
                : previous);
            setAdjustingBatch(null);
        } catch (error) {
            setAdjustmentError(error.message || 'Failed to adjust batch quantity.');
        } finally {
            setSavingBatchAdjustment(false);
        }
    };

    const closeBatch = async (batch) => {
        const batchEdid = batch.materialBatchEdid || batch.edid || batch.id;
        if (Number(batch.qtyRemaining || 0) !== 0) return;
        if (!window.confirm(`Close batch ${batch.batchNumber}? This cannot be undone.`)) return;

        setClosingBatchId(batchEdid);
        try {
            await purchaseApi.closeMaterialBatch(batchEdid);
            setBatches(previous => previous.map(item => {
                const id = item.materialBatchEdid || item.edid || item.id;
                return id === batchEdid ? { ...item, isActive: false } : item;
            }));
        } catch (error) {
            window.alert(error.message || 'Failed to close batch.');
        } finally {
            setClosingBatchId(null);
        }
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

    const unitSymbol = material.allowedUnitSymbol || material.AllowedUnitSymbol || material.unitSymbol || material.unit || '';

    const OVERVIEW_ITEMS = [
        { label: 'Category', value: material.category, Icon: Archive, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
        { label: 'Reorder Level', value: `${material.reorderLevel} ${unitSymbol}`, Icon: Layers, bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
        { label: 'Min Quantity', value: `${material.minQuantity} ${unitSymbol}`, Icon: ShieldAlert, bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    ];

    return (
        <div className="flex flex-col gap-5 pb-12">
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

            {/* Stat Cards Component */}
            <MaterialStatCards
                material={material}
                unitSymbol={unitSymbol}
                batchesLoaded={batchesLoaded}
                batchesLength={batches.length}
                purchasesLoadedPage={purchasesLoadedPage}
                purchaseTotalCount={purchaseTotalCount}
            />

            <div className="flex flex-col lg:flex-row gap-5 items-start">
                <div className="flex-1 min-w-0 w-full flex flex-col gap-5">
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-xs">

                        {/* Tabs Header */}
                        <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50/50">
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveTab('purchases');
                                    setExpandedBatches(new Set());
                                }}
                                className={`px-6 py-3.5 text-center transition-all cursor-pointer relative group flex flex-col items-center justify-center ${activeTab === 'purchases' ? 'bg-white shadow-xs' : 'bg-slate-50/70 hover:bg-slate-100/60 text-slate-500'}`}
                            >
                                {activeTab === 'purchases' && <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-600" />}
                                <span className={`text-xs font-bold transition-colors flex items-center gap-1.5 ${activeTab === 'purchases' ? 'text-indigo-600' : 'text-slate-600 group-hover:text-slate-900'}`}>
                                    <ShoppingCart size={14} /> Purchase History
                                </span>
                                <span className={`text-xl font-black mt-0.5 font-mono transition-colors ${activeTab === 'purchases' ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'}`}>
                                    {purchasesLoadedPage !== null ? purchaseTotalCount : (loadingPurchases ? '…' : 0)}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setActiveTab('usages');
                                    setExpandedBatches(new Set());
                                }}
                                className={`px-6 py-3.5 text-center transition-all cursor-pointer relative group flex flex-col items-center justify-center border-l border-slate-200 ${activeTab === 'usages' ? 'bg-white shadow-xs' : 'bg-slate-50/70 hover:bg-slate-100/60 text-slate-500'}`}
                            >
                                {activeTab === 'usages' && <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-600" />}
                                <span className={`text-xs font-bold transition-colors flex items-center gap-1.5 ${activeTab === 'usages' ? 'text-indigo-600' : 'text-slate-600 group-hover:text-slate-900'}`}>
                                    <TrendingDown size={14} /> Usage History (Batches)
                                </span>
                                <span className={`text-xl font-black mt-0.5 font-mono transition-colors ${activeTab === 'usages' ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'}`}>
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

                        {/* TAB 1: PURCHASE HISTORY UI */}
                        {activeTab === 'purchases' && (
                            <PurchaseHistoryTab
                                purchases={purchases}
                                loadingPurchases={loadingPurchases}
                                purchasePage={purchasePage}
                                purchaseTotalPages={purchaseTotalPages}
                                purchaseTotalCount={purchaseTotalCount}
                                setPurchasePage={setPurchasePage}
                                unitSymbol={unitSymbol}
                                setViewDoc={setViewDoc}
                                navigate={navigate}
                            />
                        )}

                        {/* TAB 2: USAGE HISTORY UI */}
                        {activeTab === 'usages' && (
                            <BatchUsageTab
                                batches={batches}
                                loadingBatches={loadingBatches}
                                batchPage={batchPage}
                                batchTotalPages={batchTotalPages}
                                batchTotalCount={batchTotalCount}
                                setBatchPage={setBatchPage}
                                unitSymbol={unitSymbol}
                                expandedBatches={expandedBatches}
                                batchUsages={batchUsages}
                                loadingBatchUsages={loadingBatchUsages}
                                toggleBatch={toggleBatch}
                                isAdmin={isAdmin}
                                onAdjustBatch={openBatchAdjustment}
                                onCloseBatch={closeBatch}
                                adjustingBatchId={savingBatchAdjustment ? (adjustingBatch?.materialBatchEdid || adjustingBatch?.edid || adjustingBatch?.id) : null}
                                closingBatchId={closingBatchId}
                            />
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

            {adjustingBatch && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
                    <form
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="batch-adjustment-title"
                        onSubmit={saveBatchAdjustment}
                        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
                    >
                        <h2 id="batch-adjustment-title" className="text-lg font-bold text-slate-900">Adjust Batch Quantity</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Batch {adjustingBatch.batchNumber} currently has {Number(adjustingBatch.qtyRemaining || 0)} {unitSymbol} remaining.
                        </p>
                        <div className="mt-5 space-y-4">
                            <Dropdown
                                label="Adjustment type"
                                required
                                value={adjustmentType}
                                onChange={setAdjustmentType}
                                options={[
                                    { value: 'In', label: 'In — add stock' },
                                    { value: 'Out', label: 'Out — remove stock' }
                                ]}
                                className="w-full"
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <label className="block space-y-1.5">
                                    <span className="text-xs font-bold text-slate-600">Quantity <span className="text-red-500">*</span></span>
                                    <input
                                        type="number"
                                        min="0.0001"
                                        step="0.0001"
                                        required
                                        autoFocus
                                        value={adjustmentQuantity}
                                        onChange={event => setAdjustmentQuantity(event.target.value)}
                                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-indigo-400 focus:outline-none"
                                    />
                                </label>
                                <div className="space-y-1.5">
                                    <span className="block text-xs font-bold text-slate-600">Unit</span>
                                    <div
                                        aria-label={`Unit: ${unitSymbol || 'Not set'}`}
                                        className="flex h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
                                    >
                                        {unitSymbol || 'Not set'}
                                    </div>
                                </div>
                            </div>
                            <label className="block space-y-1.5">
                                <span className="text-xs font-bold text-slate-600">Remark <span className="text-red-500">*</span></span>
                                <textarea
                                    value={adjustmentRemark}
                                    onChange={event => setAdjustmentRemark(event.target.value)}
                                    rows={2}
                                    required
                                    maxLength={500}
                                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                                />
                            </label>
                            {adjustmentError && <p className="text-sm text-red-600">{adjustmentError}</p>}
                        </div>
                        <div className="mt-6 flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setAdjustingBatch(null)} disabled={savingBatchAdjustment}>Cancel</Button>
                            <Button type="submit" disabled={savingBatchAdjustment}>
                                {savingBatchAdjustment ? 'Saving…' : 'Save Adjustment'}
                            </Button>
                        </div>
                    </form>
                </div>
            )}

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