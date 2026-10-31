import React, { Fragment } from 'react';
import { Hash, Calendar, ChevronRight, ChevronDown, Loader2, Boxes, ArrowDownToLine, ArrowUpFromLine, LockKeyhole } from 'lucide-react';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { Button } from '../../components/ui/Button';
import { formatDate, PAGE_SIZE } from '../../common/utils';

export default function BatchUsageTab({
    batches,
    loadingBatches,
    batchPage,
    batchTotalPages,
    batchTotalCount,
    setBatchPage,
    unitSymbol,
    expandedBatches,
    batchUsages,
    loadingBatchUsages,
    toggleBatch,
    isAdmin,
    onAdjustBatch,
    onCloseBatch,
    adjustingBatchId,
    closingBatchId
}) {
    const columnCount = isAdmin ? 8 : 7;

    return (
        <div className="flex-1 overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-12 text-center"></TableHead>
                        <TableHead className="text-left">Batch Number</TableHead>
                        <TableHead className="text-left">Latest Usage Date</TableHead>
                        <TableHead className="text-center">Entries</TableHead>
                        <TableHead className="text-right pr-6">Total Quantity Used</TableHead>
                        <TableHead className="text-right">Remaining</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        {isAdmin && <TableHead className="text-right pr-4">Actions</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody padRows={false}>
                    {loadingBatches ? (
                        <TableRow>
                            <TableCell colSpan={columnCount} className="text-center py-16 text-slate-400 font-medium">
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
                                                    {batch.latestUsageDate
                                                        ? formatDate(batch.latestUsageDate)
                                                        : '—'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className="text-xs font-semibold text-slate-600">
                                                {Number(batch.entriesCount || 0)} {Number(batch.entriesCount || 0) === 1 ? 'entry' : 'entries'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-slate-800 pr-6 text-xs font-mono">
                                            {Number(batch.totalUsed || 0).toLocaleString('en-IN', { maximumFractionDigits: 4 })}
                                            <span className="text-[10px] text-slate-400 uppercase font-bold ml-0.5">{unitSymbol}</span>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-slate-800 text-xs font-mono">
                                            {Number(batch.qtyRemaining || 0).toLocaleString('en-IN', { maximumFractionDigits: 4 })}
                                            <span className="text-[10px] text-slate-400 uppercase font-bold ml-0.5">{unitSymbol}</span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${batch.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {batch.isActive ? 'Open' : 'Closed'}
                                            </span>
                                        </TableCell>
                                        {isAdmin && (
                                            <TableCell className="text-right pr-4" onClick={event => event.stopPropagation()}>
                                                {batch.isActive ? (
                                                    <div className="inline-flex items-center gap-1">
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            disabled={adjustingBatchId === batchEdid || closingBatchId === batchEdid}
                                                            onClick={() => onAdjustBatch(batch)}
                                                        >
                                                            Adjust
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="soft"
                                                            icon={LockKeyhole}
                                                            title={Number(batch.qtyRemaining || 0) === 0 ? 'Close batch' : 'Remaining quantity must be zero to close'}
                                                            disabled={Number(batch.qtyRemaining || 0) !== 0 || adjustingBatchId === batchEdid || closingBatchId === batchEdid}
                                                            onClick={() => onCloseBatch(batch)}
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

                                    {isExpanded && (
                                        <TableRow className="bg-slate-50/40 hover:bg-slate-50/40">
                                            <TableCell colSpan={columnCount} className="p-0 border-b border-slate-200">
                                                <div className="px-8 py-3.5 bg-slate-50/60 border-t border-slate-100">
                                                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="bg-slate-50/80">
                                                                    <TableHead className="text-left w-36">Date</TableHead>
                                                                    <TableHead className="text-left w-24">Type</TableHead>
                                                                    <TableHead className="text-left">Reason / Remarks</TableHead>
                                                                    <TableHead className="text-right pr-6">Quantity</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody padRows={false}>
                                                                {isLoading ? (
                                                                    <TableRow>
                                                                        <TableCell colSpan={4} className="text-center py-6 text-slate-400 text-xs">
                                                                            <span className="inline-flex items-center gap-2">
                                                                                <Loader2 size={15} className="animate-spin text-indigo-600" />
                                                                                Loading usage for batch {batch.batchNumber}…
                                                                            </span>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ) : hasData && usages.length > 0 ? (
                                                                    usages.map((usage, uIdx) => {
                                                                        const quantity = Number(usage.quantityUsed ?? usage.QuantityUsed ?? 0);
                                                                        const entryType = usage.entryType || usage.EntryType || 'Out';
                                                                        const isIncoming = entryType.toLowerCase() === 'in';
                                                                        return (
                                                                            <TableRow key={usage.id || uIdx} className="hover:bg-slate-50/60 transition-colors">
                                                                                <TableCell className="font-medium whitespace-nowrap text-xs">
                                                                                    <div className="flex items-center gap-2 text-slate-700">
                                                                                        <Calendar size={13} className="text-slate-400 shrink-0" />
                                                                                        <span>{formatDate(usage.usageDate || usage.UsageDate)}</span>
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${isIncoming ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                                                                        {isIncoming ? <ArrowDownToLine size={12} /> : <ArrowUpFromLine size={12} />}
                                                                                        {entryType}
                                                                                    </span>
                                                                                </TableCell>
                                                                                <TableCell className="text-xs text-slate-600 whitespace-normal">
                                                                                    {usage.remark || usage.Remark || 'Material consumed'}
                                                                                </TableCell>
                                                                                <TableCell className="text-right font-bold text-xs text-slate-700 pr-6 font-mono whitespace-nowrap">
                                                                                    {quantity.toLocaleString('en-IN', { maximumFractionDigits: 4 })} <span className="text-[10px] text-slate-400 uppercase font-bold ml-0.5">{unitSymbol}</span>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        );
                                                                    })
                                                                ) : (
                                                                    <TableRow>
                                                                        <TableCell colSpan={4} className="text-center py-6 text-slate-400 text-xs font-medium">
                                                                            No stock movements recorded for this batch.
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )}
                                                            </TableBody>
                                                        </Table>
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
                            <TableCell colSpan={columnCount} className="text-center py-16 text-slate-400 font-medium">
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
    );
}