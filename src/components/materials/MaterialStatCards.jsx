import React from 'react';
import { Boxes, ShoppingCart, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';

export default function MaterialStatCards({ material, unitSymbol, batchesLoaded, batchesLength, purchasesLoadedPage, purchaseTotalCount }) {
    const stockOk = material.stock > material.reorderLevel;

    return (
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
                    <p className="text-2xl font-black text-slate-900">{batchesLoaded ? batchesLength : '—'}</p>
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
    );
}