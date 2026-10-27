import { useState, useEffect } from 'react';
import { productApi } from '../../api/productApi';
import { Card } from '../../components/ui/Card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { History, ArrowDownUp, Clock, Hash, CheckCircle2, XCircle } from 'lucide-react';
import { Pagination } from '../../components/ui/Pagination';
import { formatDateTime } from '../../common/utils';

export default function PriceHistory({ productId, onEditPricing }) {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (!productId) return;
    setIsLoading(true);
    productApi.getPriceHistory(productId, page, 5)
      .then(res => {
        const items = res?.data?.items || res?.items || [];
        setHistory(items);
        setTotalPages(res?.data?.totalPages || res?.totalPages || 1);
        setTotalCount(res?.data?.totalCount || res?.totalCount || 0);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, [productId, page]);

  return (
    <Card className="flex flex-col h-full border border-slate-200">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50/50">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <History size={16} className="text-emerald-600" />
          Price History
        </h3>
        {onEditPricing && (
          <button
            onClick={onEditPricing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            <ArrowDownUp size={12} /> Update Pricing
          </button>
        )}
      </div>

      <div className="flex-1 p-4 bg-slate-50/30 overflow-x-auto">
        {!isLoading && history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 border border-slate-200 border-dashed rounded-2xl bg-white">
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
              <History className="w-6 h-6 text-slate-300" />
            </div>
            <h3 className="text-base font-bold text-slate-700 mb-1">No History</h3>
            <p className="text-slate-500 text-xs">No price history available for this product.</p>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center p-8">
            <div className="w-6 h-6 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {history.map((group, i) => {
              const details = group.details || [];
              return (
                <div
                  key={group.priceGroupId || i}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                >
                  {/* Section header — Group ID + timestamp + status */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <Hash size={12} className="text-slate-400" />
                        <span className="text-slate-400">Group:</span>
                        <span className="font-mono text-slate-800">{group.priceGroupId || '—'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                        <Clock size={12} className="text-slate-400" />
                        {formatDateTime(group.createdAt)}
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${group.isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                    >
                      {group.isActive ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                      {group.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Details table for this group */}
                  {details.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-slate-400 italic">
                      No pricing details in this group.
                    </div>
                  ) : (
                    <Table className="w-full table-fixed">
                      <TableHeader className="bg-white">
                        <TableRow>
                          <TableHead className="!text-center w-1/3 font-semibold text-slate-600">
                            Customer Type
                          </TableHead>
                          <TableHead className="!text-right w-1/3 font-semibold text-slate-600">
                            Price (₹)
                          </TableHead>
                          <TableHead className="!text-right w-1/3 font-semibold text-slate-600">
                            MRP (₹)
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody padRows={false}>
                        {details.map((detail, j) => (
                          <TableRow
                            key={`${group.priceGroupId}-${j}`}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                          >
                            <TableCell className="!text-center">
                              <span className="inline-block px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                {detail.customerType}
                              </span>
                            </TableCell>
                            <TableCell className="!text-right font-bold text-slate-900 tabular-nums">
                              {Number(detail.price).toFixed(2)}
                            </TableCell>
                            <TableCell className="!text-right font-medium text-slate-400 line-through tabular-nums">
                              {Number(detail.mrp).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              );
            })}

            {totalPages > 1 && (
              <div className="flex justify-center mt-2">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  totalItems={totalCount}
                  itemsPerPage={5}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}