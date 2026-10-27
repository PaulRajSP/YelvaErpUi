import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Package, Box } from 'lucide-react';
import { productApi } from '../../api/productApi';
import { Pagination } from '../ui/Pagination';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../ui/Table';

// Visual + label mapping for each customer type
const CUSTOMER_META = {
    DIRECT: { short: 'D', label: 'Direct', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    ONLINE: { short: 'O', label: 'Online', cls: 'bg-teal-50 text-teal-700 border-teal-200' },
    WHOLESALE: { short: 'W', label: 'Wholesale', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
};

// Handles the API returning customerOwnerType / customerType / customeromerType
const getCustomerType = (p) =>
    (p?.customerOwnerType || p?.customerType || p?.customeromerType || '').toUpperCase().trim();

// Normalizes a pricing array into [{ type, price, mrp }]
const normalizePrices = (prices) => {
    if (!Array.isArray(prices)) return [];
    return prices
        .map(p => ({
            type: getCustomerType(p),
            price: Number(p?.price) || 0,
            mrp: Number(p?.mrp) || 0,
        }))
        .filter(p => p.type); // drop rows with no recognizable customer type
};

export default function CombosUsingProduct({ productEdid }) {
    const [isOpen, setIsOpen] = useState(false);
    const [combos, setCombos] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    const fetchCombos = async (pageNum) => {
        if (!productEdid) return;
        setIsLoading(true);
        try {
            const res = await productApi.getCombosUsingProduct(productEdid, pageNum, 5);
            const data = res?.data || res;
            if (data) {
                setCombos(data.items || []);
                setTotalCount(data.totalCount || 0);
                const calcPages = Math.ceil((data.totalCount || 0) / (data.pageSize || 5));
                setTotalPages(calcPages > 0 ? calcPages : 1);
            }
        } catch (err) {
            console.error('Failed to fetch combos using product', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchCombos(page);
        }
    }, [isOpen, page, productEdid]);

    return (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div
                className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                        <Box size={20} className="text-purple-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900">Used in Combos</h3>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                            {isOpen || totalCount > 0 ? `This product is part of ${totalCount} combo(s)` : 'Click to see combos containing this product'}
                        </p>
                    </div>
                </div>
                <div className="text-slate-400">
                    {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
            </div>

            {isOpen && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                    {isLoading ? (
                        <div className="flex justify-center p-6">
                            <div className="w-6 h-6 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                        </div>
                    ) : combos.length > 0 ? (
                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="text-left font-semibold text-slate-600">Combo Name</TableHead>
                                        <TableHead className="text-center font-semibold text-slate-600">Included Qty</TableHead>
                                        <TableHead className="text-right font-semibold text-slate-600">Prices (₹)</TableHead>
                                        <TableHead className="text-center font-semibold text-slate-600">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody padRows={false}>
                                    {combos.map((c, i) => {
                                        const prices = normalizePrices(c.prices);
                                        return (
                                            <TableRow key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                                                <TableCell className="text-slate-900 font-bold whitespace-nowrap">
                                                    {c.comboProductName}
                                                </TableCell>
                                                <TableCell className="text-center text-slate-700 font-medium">
                                                    x{c.unitCount}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {prices.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1 justify-end">
                                                            {prices.map((p, k) => {
                                                                const meta = CUSTOMER_META[p.type] || {
                                                                    short: p.type.slice(0, 1) || '?',
                                                                    label: p.type,
                                                                    cls: 'bg-slate-50 text-slate-700 border-slate-200',
                                                                };
                                                                return (
                                                                    <span
                                                                        key={k}
                                                                        title={`${meta.label}: ₹${p.price.toFixed(2)} (MRP ₹${p.mrp.toFixed(2)})`}
                                                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold ${meta.cls}`}
                                                                    >
                                                                        <span className="opacity-70">{meta.short}</span>
                                                                        <span>₹{p.price.toFixed(2)}</span>
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        // Fallback if only a single flat price is returned
                                                        <span className="text-slate-400 text-xs">
                                                            {c.price != null ? `₹${Number(c.price).toFixed(2)}` : '—'}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full border ${c.active ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                        {c.active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                            {totalPages > 1 && (
                                <div className="flex justify-center p-3 border-t border-slate-100">
                                    <Pagination
                                        currentPage={page}
                                        totalPages={totalPages}
                                        onPageChange={setPage}
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8">
                            <Package className="w-8 h-8 text-slate-300 mb-2" />
                            <p className="text-slate-500 text-sm font-medium">Not used in any combos.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}