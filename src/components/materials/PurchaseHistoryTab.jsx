import React, { useEffect, useRef } from 'react';
import { Calendar, Hash, ShoppingCart, FileText, Eye } from 'lucide-react';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { Tooltip } from '../../components/ui/Tooltip';
import { Button } from '../../components/ui/Button';
import { API_BASE } from '../../services/apiClient';
import { formatDate, PAGE_SIZE } from '../../common/utils';

const TAB_NAME = 'purchaseHistory';

export default function PurchaseHistoryTab({
    purchases,
    loadingPurchases,
    purchasePage,
    purchaseTotalPages,
    purchaseTotalCount,
    setPurchasePage,
    unitSymbol,
    setViewDoc,
    navigate,
    batchId,
    isOpen = true,
    recordTabEvent,
}) {
    const recordRef = useRef(recordTabEvent);

    useEffect(() => {
        recordRef.current = recordTabEvent;
    }, [recordTabEvent]);

    useEffect(() => {
        if (!batchId || !isOpen || typeof recordRef.current !== 'function') return;

        recordRef.current({
            batchId,
            tab: TAB_NAME,
            event: 'open',
            timestamp: new Date().toISOString(),
        });

        return () => {
            recordRef.current?.({
                batchId,
                tab: TAB_NAME,
                event: 'close',
                timestamp: new Date().toISOString(),
            });
        };
    }, [batchId, isOpen]);

    return (
        <div className="flex-1 overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-left">Date</TableHead>
                        <TableHead className="text-left">Purchase #</TableHead>
                        <TableHead className="text-left">Supplier</TableHead>
                        <TableHead className="text-left">Batch Number</TableHead>
                        <TableHead className="text-right">Cost/Unit</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        {/* Swapped: Document is now 7th, Action is 8th */}
                        <TableHead className="text-center">Document</TableHead>
                        <TableHead className="text-center pr-6">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody padRows={false}>
                    {loadingPurchases ? (
                        <TableRow>
                            <TableCell colSpan={8} className="text-center py-16 text-slate-400 font-medium">
                                {/* Spinner removed here */}
                                <p className="text-xs text-slate-500">Loading purchase history…</p>
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
                                        onClick={() => navigate(`/purchases/${purchase.purchaseEdid}`)}
                                        className="hover:text-indigo-600 hover:underline cursor-pointer text-slate-800 transition-colors"
                                        title="View Purchase"
                                    >
                                        {purchase.purchaseNumber}
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

                                {/* COLUMN 7: Document (Attachments) */}
                                <TableCell className="text-center">
                                    {purchase.attachmentData?.length > 0 ? (
                                        <div className="flex justify-center gap-1">
                                            {purchase.attachmentData.map((attachment, attachmentIndex) => {
                                                const fileName = attachment.attachmentOriginalName || `Purchase_${purchase.purchaseNumber || 'doc'}_${attachmentIndex + 1}`;
                                                return (
                                                    <Tooltip key={attachment.attachmentEdid} content={fileName}>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            icon={FileText}
                                                            onClick={() => setViewDoc({
                                                                url: `${API_BASE}/common/attachment/${attachment.attachmentEdid}/${encodeURIComponent(fileName)}`,
                                                                title: `Purchase Document · ${purchase.purchaseNumber || ''}`,
                                                                fileName
                                                            })}
                                                        />
                                                    </Tooltip>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <span className="text-slate-400 text-xs font-medium">—</span>
                                    )}
                                </TableCell>

                                {/* COLUMN 8: Action (View Details) */}
                                <TableCell className="text-center pr-6">
                                    <Tooltip content="View Purchase Details">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            icon={Eye}
                                            onClick={() => navigate(`/purchases/${purchase.purchaseEdid}`)}
                                        />
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={8} className="text-center py-16 text-slate-400 font-medium">
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
    );
}