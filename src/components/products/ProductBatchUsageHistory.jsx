import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import { productApi } from '../../api/productApi';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../ui/Table';
import { Pagination } from '../ui/Pagination';
import { formatDate, formatDateTime } from '../../common/utils';
import { Calendar, ChevronDown, ChevronRight, ChevronUp, Hash, Loader2, Package, RefreshCw, Layers, Search, X, LockKeyhole } from 'lucide-react';
import { Button } from '../ui/Button';
import Dropdown from '../common/Dropdown';

const PAGE_SIZE = 5;
const INNER_PAGE_SIZE = 5;

export default function ProductBatchUsageHistory({ productEdid, productName, isAdmin = false, onBatchUpdated }) {
    const [isOpen, setIsOpen] = useState(true);
    const [batches, setBatches] = useState([]);
    const [loadingBatches, setLoadingBatches] = useState(false);
    const [batchPage, setBatchPage] = useState(1);
    const [batchTotalPages, setBatchTotalPages] = useState(1);
    const [batchTotalCount, setBatchTotalCount] = useState(0);
    const [search, setSearch] = useState('');

    // Accordion and usage states
    const [expandedBatches, setExpandedBatches] = useState(new Set());
    const [batchUsages, setBatchUsages] = useState({});
    const [loadingBatchUsages, setLoadingBatchUsages] = useState({});
    const [adjustingBatch, setAdjustingBatch] = useState(null);
    const [adjustmentType, setAdjustmentType] = useState('Out');
    const [adjustmentQuantity, setAdjustmentQuantity] = useState('');
    const [adjustmentRemark, setAdjustmentRemark] = useState('');
    const [adjustmentError, setAdjustmentError] = useState('');
    const [savingAdjustment, setSavingAdjustment] = useState(false);
    const [closingBatchId, setClosingBatchId] = useState(null);

    // Inner movement search & pagination states per batch
    const [usageSearches, setUsageSearches] = useState({});
    const [usagePages, setUsagePages] = useState({});
    const usageSearchTimeouts = useRef({});

    // Fetch batch list from API
    const fetchBatches = useCallback(async (searchQuery = search, pageNum = batchPage) => {
        if (!productEdid) return;
        setLoadingBatches(true);
        try {
            const res = await productApi.getProductBatchList(productEdid, pageNum, PAGE_SIZE, (searchQuery || '').trim());
            const data = res?.data || res;
            const items = data?.items || data?.Items || (Array.isArray(data) ? data : []);
            setBatches(items);
            const total = data?.totalCount ?? data?.TotalCount ?? items.length;
            setBatchTotalCount(total);
            const calcPages = Math.ceil(total / (data?.pageSize || PAGE_SIZE));
            setBatchTotalPages(calcPages > 0 ? calcPages : 1);
        } catch (err) {
            console.error('Failed to load product batches:', err);
            setBatches([]);
        } finally {
            setLoadingBatches(false);
        }
    }, [productEdid, batchPage, search]);

    // Fetch batch movement usage history from API with optional searchRemark
    const fetchUsageHistory = useCallback(async (batchEdid, searchRemark = '') => {
        if (!productEdid || !batchEdid) return;
        setLoadingBatchUsages(prev => ({ ...prev, [batchEdid]: true }));
        try {
            const uRes = await productApi.getProductUsageHistory(productEdid, batchEdid, searchRemark.trim());
            const items = uRes?.items || uRes?.Items || (Array.isArray(uRes?.data?.items) ? uRes.data.items : (Array.isArray(uRes) ? uRes : []));
            setBatchUsages(prev => ({ ...prev, [batchEdid]: items }));
        } catch (err) {
            console.error(`Failed to load usage for batch ${batchEdid}:`, err);
            setBatchUsages(prev => ({ ...prev, [batchEdid]: [] }));
        } finally {
            setLoadingBatchUsages(prev => ({ ...prev, [batchEdid]: false }));
        }
    }, [productEdid]);

    // Clean up timeouts on unmount
    useEffect(() => {
        return () => {
            Object.values(usageSearchTimeouts.current).forEach(t => clearTimeout(t));
        };
    }, []);

    // Debounced search for outer batch name / number
    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(() => {
            fetchBatches(search, batchPage);
        }, 300);
        return () => clearTimeout(timer);
    }, [isOpen, search, batchPage, fetchBatches]);

    const handleSearchChange = (val) => {
        setSearch(val);
        setBatchPage(1);
    };

    // Live search for inner batch movements: hits API with debounced searchRemark
    const handleUsageSearchChange = (batchEdid, val) => {
        setUsageSearches(prev => ({ ...prev, [batchEdid]: val }));
        setUsagePages(prev => ({ ...prev, [batchEdid]: 1 }));

        if (usageSearchTimeouts.current[batchEdid]) {
            clearTimeout(usageSearchTimeouts.current[batchEdid]);
        }
        usageSearchTimeouts.current[batchEdid] = setTimeout(() => {
            fetchUsageHistory(batchEdid, val);
        }, 300);
    };

    const handleClearUsageSearch = (batchEdid) => {
        setUsageSearches(prev => ({ ...prev, [batchEdid]: '' }));
        setUsagePages(prev => ({ ...prev, [batchEdid]: 1 }));
        if (usageSearchTimeouts.current[batchEdid]) {
            clearTimeout(usageSearchTimeouts.current[batchEdid]);
        }
        fetchUsageHistory(batchEdid, '');
    };

    const handleUsagePageChange = (batchEdid, page) => {
        setUsagePages(prev => ({ ...prev, [batchEdid]: page }));
    };

    const expandBatchMovements = async (batchEdid) => {
        setExpandedBatches(previous => new Set(previous).add(batchEdid));
        await fetchUsageHistory(batchEdid, usageSearches[batchEdid] || '');
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

        const batchEdid = adjustingBatch?.productBatchEdid || adjustingBatch?.edid || adjustingBatch?.id;
        if (!batchEdid) {
            setAdjustmentError('Batch ID is missing.');
            return;
        }

        setSavingAdjustment(true);
        setAdjustmentError('');
        try {
            await productApi.adjustProductBatch(productEdid, batchEdid, {
                entryType: adjustmentType,
                quantity,
                remark: adjustmentRemark.trim()
            });
            setAdjustingBatch(null);
            try {
                await fetchBatches(search, batchPage);
                await expandBatchMovements(batchEdid);
                await onBatchUpdated?.();
            } catch (error) {
                console.error('Product batch adjustment saved, but refreshed data could not be loaded:', error);
                window.alert('Adjustment was saved, but the latest stock could not be refreshed. Reload the page to see the updated stock.');
            }
        } catch (error) {
            setAdjustmentError(error.message || 'Failed to adjust product batch quantity.');
        } finally {
            setSavingAdjustment(false);
        }
    };

    const closeBatch = async (batch) => {
        const batchEdid = batch.productBatchEdid || batch.edid || batch.id;
        const remainingQty = Number(batch.remainingQty ?? batch.RemainingQty ?? 0);
        if (remainingQty !== 0) return;
        if (!window.confirm(`Close batch ${batch.batchNumber}? This cannot be undone.`)) return;

        setClosingBatchId(batchEdid);
        try {
            await productApi.closeProductBatch(productEdid, batchEdid);
            try {
                await Promise.all([
                    fetchBatches(search, batchPage),
                    onBatchUpdated?.()
                ]);
            } catch (error) {
                console.error('Product batch closed, but refreshed data could not be loaded:', error);
                window.alert('Batch was closed, but the latest stock could not be refreshed. Reload the page to see the updated stock.');
            }
        } catch (error) {
            window.alert(error.message || 'Failed to close product batch.');
        } finally {
            setClosingBatchId(null);
        }
    };

    // Toggle batch accordion and load usage from API
    const toggleBatch = async (batch) => {
        const batchEdid = batch.productBatchEdid || batch.edid || batch.id;
        const isExpanded = expandedBatches.has(batchEdid);

        if (isExpanded) {
            setExpandedBatches(prev => {
                const next = new Set(prev);
                next.delete(batchEdid);
                return next;
            });
            return;
        }

        await expandBatchMovements(batchEdid);
    };

    // Client-side fallback filtering if server query was cached or running older build
    const displayedBatches = useMemo(() => {
        if (!search.trim()) return batches;
        const q = search.trim().toLowerCase();
        return batches.filter(b => 
            (b.batchNumber || '').toLowerCase().includes(q) ||
            (b.productionNumber || '').toLowerCase().includes(q) ||
            (b.remarks || '').toLowerCase().includes(q)
        );
    }, [batches, search]);

    return (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            {/* Card Header Accordion Toggle */}
            <div
                className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors flex-wrap gap-3"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                        <Layers size={20} className="text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900">Batch Usage History</h3>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                            Track product batch movement, order consumption, and remaining inventory
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {isOpen && (
                        <button
                            type="button"
                            onClick={() => fetchBatches(search, batchPage)}
                            title="Refresh batches"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        >
                            <RefreshCw size={15} className={loadingBatches ? 'animate-spin' : ''} />
                        </button>
                    )}

                    <div className="text-slate-400 cursor-pointer p-1" onClick={() => setIsOpen(!isOpen)}>
                        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                </div>
            </div>

            {/* Card Body */}
            {isOpen && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                    {/* Top Toolbar: Search by Batch Number or Production Number */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <div className="relative w-full sm:w-72">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                placeholder="Search by batch or production number..."
                                className="w-full pl-9 pr-8 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400 shadow-2xs"
                            />
                            {loadingBatches ? (
                                <Loader2 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin" />
                            ) : search ? (
                                <button
                                    type="button"
                                    onClick={() => handleSearchChange('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                                    title="Clear search"
                                >
                                    <X size={13} />
                                </button>
                            ) : null}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                            {batchTotalCount > 0 && (
                                <span>
                                    Found <b>{batchTotalCount}</b> {batchTotalCount === 1 ? 'batch' : 'batches'}
                                </span>
                            )}
                        </div>
                    </div>

                    {loadingBatches && batches.length === 0 ? (
                        <div className="flex justify-center items-center py-12">
                            <div className="flex flex-col items-center justify-center gap-2">
                                <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                <span className="text-xs text-slate-400 font-medium">Loading batch history…</span>
                            </div>
                        </div>
                    ) : displayedBatches.length > 0 ? (
                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="w-10 text-center"></TableHead>
                                            <TableHead className="text-left font-semibold text-slate-600">Batch Number</TableHead>
                                            <TableHead className="text-left font-semibold text-slate-600">Production No</TableHead>
                                            <TableHead className="text-right font-semibold text-slate-600">Produced Qty</TableHead>
                                            <TableHead className="text-right font-semibold text-slate-600">Remaining Stock</TableHead>
                                            <TableHead className="text-left font-semibold text-slate-600">Packed Date</TableHead>
                                            <TableHead className="text-left font-semibold text-slate-600">Expiry Date</TableHead>
                                            <TableHead className="text-center font-semibold text-slate-600">Entries</TableHead>
                                            <TableHead className="text-right font-semibold text-slate-600 pr-6">Total Used</TableHead>
                                            {isAdmin && <TableHead className="text-right font-semibold text-slate-600 pr-4">Actions</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody padRows={false}>
                                        {displayedBatches.map((batch) => {
                                            const batchEdid = batch.productBatchEdid || batch.edid || batch.id;
                                            const isExpanded = expandedBatches.has(batchEdid);
                                            const allUsages = batchUsages[batchEdid] || [];
                                            const isLoadingUsages = loadingBatchUsages[batchEdid];
                                            const hasLoadedUsages = Array.isArray(batchUsages[batchEdid]);

                                            // Determine entries count from list response or expanded data
                                            const entriesCount = Number(batch.entriesCount ?? batch.EntriesCount ?? (hasLoadedUsages ? allUsages.length : 0));
                                            
                                            // Determine total used from list response or expanded data
                                            const totalUsed = Number(batch.totalUsed ?? batch.TotalUsed ?? (hasLoadedUsages ? allUsages.reduce((sum, u) => {
                                                const entryType = String(u.entryType ?? u.EntryType ?? 'Out').toLowerCase();
                                                return sum + (entryType === 'out' ? Number(u.quantityUsed ?? u.QuantityUsed ?? 0) : 0);
                                            }, 0) : 0));

                                            // Inner movement pagination
                                            const currentUsagePage = usagePages[batchEdid] || 1;
                                            const usageTotalPages = Math.max(1, Math.ceil(allUsages.length / INNER_PAGE_SIZE));
                                            const pagedUsages = allUsages.slice(
                                                (currentUsagePage - 1) * INNER_PAGE_SIZE,
                                                currentUsagePage * INNER_PAGE_SIZE
                                            );

                                            return (
                                                <Fragment key={batchEdid || batch.batchNumber}>
                                                    <TableRow
                                                        onClick={() => toggleBatch(batch)}
                                                        className="hover:bg-slate-50/80 cursor-pointer transition-colors group select-none border-b border-slate-100"
                                                    >
                                                        <TableCell className="w-10 text-center">
                                                            <div className="w-5 h-5 rounded flex items-center justify-center text-slate-400 group-hover:text-slate-600 transition-colors mx-auto">
                                                                {isLoadingUsages ? (
                                                                    <Loader2 size={13} className="animate-spin text-indigo-600" />
                                                                ) : isExpanded ? (
                                                                    <ChevronDown size={14} />
                                                                ) : (
                                                                    <ChevronRight size={14} />
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="font-medium">
                                                            <div className="flex items-center gap-2 font-mono text-xs">
                                                                <Hash size={13} className="text-indigo-500 shrink-0" />
                                                                <span className="font-bold text-slate-800">{batch.batchNumber}</span>
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                                                    !(batch.isActive ?? batch.IsActive) ? 'bg-slate-100 text-slate-500 border border-slate-200' : Number(batch.remainingQty) > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                                                                }`}>
                                                                    {!(batch.isActive ?? batch.IsActive) ? 'Closed' : Number(batch.remainingQty) > 0 ? 'In Stock' : 'Depleted'}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="font-medium">
                                                            {batch.productionNumber ? (
                                                                <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200" title={`Production Request ${batch.productionNumber}`}>
                                                                    #{batch.productionNumber}
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs text-slate-400 font-mono">—</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right text-xs font-mono font-medium text-slate-600">
                                                            {batch.productionQty ?? 0}
                                                        </TableCell>
                                                        <TableCell className="text-right text-xs font-mono font-bold text-slate-900">
                                                            {batch.remainingQty ?? 0}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                                                            {batch.packedDate || batch.PackedDate ? formatDate(batch.packedDate || batch.PackedDate) : '—'}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                                                            {batch.expiryDate || batch.ExpiryDate ? formatDate(batch.expiryDate || batch.ExpiryDate) : '—'}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <span className={`text-xs font-semibold ${entriesCount > 0 ? 'text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200' : 'text-slate-500'}`}>
                                                                {entriesCount > 0 ? `${entriesCount} ${entriesCount === 1 ? 'entry' : 'entries'}` : '0 entries'}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-slate-800 pr-6 text-xs font-mono">
                                                            {totalUsed}
                                                        </TableCell>
                                                        {isAdmin && (
                                                            <TableCell className="text-right pr-4" onClick={event => event.stopPropagation()}>
                                                                {(batch.isActive ?? batch.IsActive) ? (
                                                                    <div className="inline-flex items-center gap-1">
                                                                        <Button
                                                                            size="sm"
                                                                            variant="secondary"
                                                                            disabled={closingBatchId === batchEdid || savingAdjustment}
                                                                            onClick={() => openBatchAdjustment(batch)}
                                                                        >
                                                                            Adjust
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="soft"
                                                                            icon={LockKeyhole}
                                                                            title={Number(batch.remainingQty ?? batch.RemainingQty ?? 0) === 0 ? 'Close batch' : 'Remaining quantity must be zero to close'}
                                                                            disabled={Number(batch.remainingQty ?? batch.RemainingQty ?? 0) !== 0 || closingBatchId === batchEdid || savingAdjustment}
                                                                            onClick={() => closeBatch(batch)}
                                                                        >
                                                                            {closingBatchId === batchEdid ? 'Closing…' : 'Close'}
                                                                        </Button>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs text-slate-400">—</span>
                                                                )}
                                                            </TableCell>
                                                        )}
                                                    </TableRow>

                                                    {/* Nested Accordion for Individual Usage Movements */}
                                                    {isExpanded && (
                                                        <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                                                            <TableCell colSpan={isAdmin ? 10 : 9} className="p-0 border-b border-slate-200">
                                                                <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100">
                                                                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                                                                        {/* Inner Header with Title and Search by Remark */}
                                                                        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                                                                <span className="text-xs font-bold text-slate-800">
                                                                                    Movements for Batch <span className="font-mono text-indigo-600">{batch.batchNumber}</span>
                                                                                </span>
                                                                                {batch.productionNumber && (
                                                                                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-mono">
                                                                                        Prod #{batch.productionNumber}
                                                                                    </span>
                                                                                )}
                                                                                <span className="text-[10px] font-semibold bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                                                                                    {allUsages.length} {allUsages.length === 1 ? 'record' : 'records'}
                                                                                </span>
                                                                            </div>

                                                                            {/* Search movements by remark (always hits API with debounced search) */}
                                                                            <div className="relative w-64" onClick={(e) => e.stopPropagation()}>
                                                                                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                                                <input
                                                                                    type="text"
                                                                                    value={usageSearches[batchEdid] || ''}
                                                                                    onChange={(e) => handleUsageSearchChange(batchEdid, e.target.value)}
                                                                                    placeholder="Search by remark..."
                                                                                    className="w-full pl-8 pr-7 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 text-slate-800 placeholder-slate-400 font-medium"
                                                                                />
                                                                                {isLoadingUsages ? (
                                                                                    <Loader2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin" />
                                                                                ) : usageSearches[batchEdid] ? (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleClearUsageSearch(batchEdid)}
                                                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                                                                                        title="Clear filter"
                                                                                    >
                                                                                        <X size={12} />
                                                                                    </button>
                                                                                ) : null}
                                                                            </div>
                                                                        </div>

                                                                        {/* Inner Movements Table / States */}
                                                                        {isLoadingUsages && allUsages.length === 0 ? (
                                                                            <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-xs">
                                                                                <Loader2 size={15} className="animate-spin text-indigo-600" />
                                                                                <span>Searching usage movements for batch {batch.batchNumber}…</span>
                                                                            </div>
                                                                        ) : allUsages.length === 0 ? (
                                                                            <div className="py-6 text-center text-slate-400 text-xs font-medium">
                                                                                {usageSearches[batchEdid] ? (
                                                                                    <span>No movements matching &ldquo;{usageSearches[batchEdid]}&rdquo; found for this batch.</span>
                                                                                ) : (
                                                                                    <span>No usage movements recorded for this batch yet.</span>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <>
                                                                                <Table>
                                                                                    <TableHeader className="bg-slate-50/80">
                                                                                        <TableRow>
                                                                                            <TableHead className="text-left w-48 font-semibold text-slate-600">Date & Time</TableHead>
                                                                                            <TableHead className="text-left font-semibold text-slate-600">Remarks / Movement</TableHead>
                                                                                            <TableHead className="text-center font-semibold text-slate-600">Type</TableHead>
                                                                                            <TableHead className="text-right font-semibold text-slate-600 pr-6">Quantity</TableHead>
                                                                                        </TableRow>
                                                                                    </TableHeader>
                                                                                    <TableBody padRows={false}>
                                                                                        {pagedUsages.map((usage, uIdx) => (
                                                                                            <TableRow key={usage.id || uIdx} className="hover:bg-slate-50/60 transition-colors">
                                                                                                <TableCell className="font-medium whitespace-nowrap text-xs">
                                                                                                    <div className="flex items-center gap-2 text-slate-700">
                                                                                                        <Calendar size={12} className="text-slate-400 shrink-0" />
                                                                                                        <span>{formatDateTime(usage.usageDate || usage.UsageDate)}</span>
                                                                                                    </div>
                                                                                                </TableCell>
                                                                                                <TableCell className="text-xs text-slate-700">
                                                                                                    {usage.remark || usage.Remark || 'Product consumed / dispatched'}
                                                                                                </TableCell>
                                                                                                <TableCell className="text-center">
                                                                                                    {(() => {
                                                                                                        const entryType = String(usage.entryType ?? usage.EntryType ?? 'Out');
                                                                                                        const isIncoming = entryType.toLowerCase() === 'in';
                                                                                                        return (
                                                                                                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${isIncoming ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                                                                                                {isIncoming ? 'In' : 'Out'}
                                                                                                            </span>
                                                                                                        );
                                                                                                    })()}
                                                                                                </TableCell>
                                                                                                <TableCell className="text-right font-bold text-xs text-slate-800 pr-6 font-mono whitespace-nowrap">
                                                                                                    {usage.quantityUsed ?? usage.QuantityUsed ?? 0}
                                                                                                </TableCell>
                                                                                            </TableRow>
                                                                                        ))}
                                                                                    </TableBody>
                                                                                </Table>

                                                                                {/* Inner Movements Pagination */}
                                                                                {allUsages.length > INNER_PAGE_SIZE && (
                                                                                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-xs">
                                                                                        <span className="text-slate-500 font-medium">
                                                                                            Showing {((currentUsagePage - 1) * INNER_PAGE_SIZE) + 1}–{Math.min(currentUsagePage * INNER_PAGE_SIZE, allUsages.length)} of {allUsages.length}
                                                                                        </span>
                                                                                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                                                            <button
                                                                                                type="button"
                                                                                                disabled={currentUsagePage === 1}
                                                                                                onClick={() => handleUsagePageChange(batchEdid, currentUsagePage - 1)}
                                                                                                className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs font-medium"
                                                                                            >
                                                                                                Prev
                                                                                            </button>
                                                                                            {Array.from({ length: usageTotalPages }, (_, i) => i + 1).map((pg) => (
                                                                                                <button
                                                                                                    key={pg}
                                                                                                    type="button"
                                                                                                    onClick={() => handleUsagePageChange(batchEdid, pg)}
                                                                                                    className={`w-7 h-7 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                                                                                                        pg === currentUsagePage
                                                                                                            ? 'bg-slate-900 text-white'
                                                                                                            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                                                                                    }`}
                                                                                                >
                                                                                                    {pg}
                                                                                                </button>
                                                                                            ))}
                                                                                            <button
                                                                                                type="button"
                                                                                                disabled={currentUsagePage === usageTotalPages}
                                                                                                onClick={() => handleUsagePageChange(batchEdid, currentUsagePage + 1)}
                                                                                                className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs font-medium"
                                                                                            >
                                                                                                Next
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </Fragment>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Standard UI Pagination Component */}
                            <Pagination
                                currentPage={batchPage}
                                totalPages={batchTotalPages}
                                onPageChange={setBatchPage}
                                totalItems={batchTotalCount}
                                itemsPerPage={PAGE_SIZE}
                            />
                        </div>
                    ) : (
                        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs">
                            <Package size={24} className="text-slate-300 mx-auto mb-2" />
                            <p>{search ? `No batches matching "${search}".` : 'No batches found for this product.'}</p>
                        </div>
                    )}
                </div>
            )}

            {adjustingBatch && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
                    <form
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="product-batch-adjustment-title"
                        onSubmit={saveBatchAdjustment}
                        onClick={event => event.stopPropagation()}
                        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
                    >
                        <h2 id="product-batch-adjustment-title" className="text-lg font-bold text-slate-900">Adjust Batch Quantity</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Batch {adjustingBatch.batchNumber} currently has {Number(adjustingBatch.remainingQty ?? adjustingBatch.RemainingQty ?? 0)} units remaining.
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
                            <label className="block space-y-1.5">
                                <span className="text-xs font-bold text-slate-600">Quantity (units) <span className="text-red-500">*</span></span>
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
                            <Button variant="secondary" onClick={() => setAdjustingBatch(null)} disabled={savingAdjustment}>Cancel</Button>
                            <Button type="submit" disabled={savingAdjustment}>
                                {savingAdjustment ? 'Saving…' : 'Save Adjustment'}
                            </Button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
