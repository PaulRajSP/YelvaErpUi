import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Package, Loader2 } from 'lucide-react';
import { purchaseApi } from '../../api/purchaseApi';

export default function BatchSelector({ materialEdid, supplierEdid, unitCost, value, onChange, label = "BATCH #", disabled = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedBatch, setSelectedBatch] = useState(null);
    const wrapperRef = useRef(null);
    const requestIdRef = useRef(0);

    useEffect(() => {
        if (!value || selectedBatch?.edid === value) return undefined;

        let active = true;
        purchaseApi.getBatchById(value).then(res => {
            const batch = res?.data || res;
            if (active && batch?.edid === value) setSelectedBatch(batch);
        }).catch(console.error);

        return () => {
            active = false;
        };
    }, [value, selectedBatch?.edid]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const cost = Number(unitCost);
        if (!materialEdid || !Number.isFinite(cost) || cost <= 0) return undefined;

        const requestId = ++requestIdRef.current;
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await purchaseApi.getBatchesForMaterial(materialEdid, isOpen ? search : '', cost, supplierEdid);
                if (requestId === requestIdRef.current) {
                    setBatches(res?.data?.items || res?.items || []);
                }
            } catch (error) {
                console.error('Error fetching batches:', error);
                if (requestId === requestIdRef.current) setBatches([]);
            } finally {
                if (requestId === requestIdRef.current) setLoading(false);
            }
        }, 300);

        return () => {
            clearTimeout(timer);
            requestIdRef.current += 1;
        };
    }, [search, isOpen, materialEdid, supplierEdid, unitCost]);

    const handleSelect = (batch) => {
        setSelectedBatch(batch);
        setSearch('');
        setIsOpen(false);
        if (onChange) {
            onChange(batch);
        }
    };

    const isActuallyDisabled = disabled || !materialEdid || !Number.isFinite(Number(unitCost)) || Number(unitCost) <= 0;

    // Trust the API: render exactly what it returned. The ±0.10 unit-cost
    // tolerance is business logic that lives in the SQL predicate, not here.
    const visibleBatches = batches;
    const visibleSelectedBatch = selectedBatch?.edid === value ? selectedBatch : null;

    return (
        <div className="flex flex-col gap-1 relative" ref={wrapperRef}>
            {label && (
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {label}
                </label>
            )}
            <div
                className={`relative flex items-center bg-white border rounded-lg transition-colors overflow-hidden ${isOpen ? 'border-indigo-400 ring-2 ring-indigo-50' : 'border-slate-200 hover:border-slate-300'
                    } ${isActuallyDisabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer'}`}
                onClick={() => {
                    if (!isActuallyDisabled) {
                        if (visibleSelectedBatch) {
                            setSearch(visibleSelectedBatch.batchNumber);
                        }
                        setIsOpen(true);
                    }
                }}
            >
                <div className="flex items-center justify-center pl-3 text-slate-400 shrink-0">
                    <Package size={16} />
                </div>
                <div
                    className="w-full py-2.5 px-3 text-sm font-semibold text-slate-900 bg-transparent outline-none flex items-center min-h-[40px]"
                >
                    {visibleSelectedBatch ? (
                        <span>{visibleSelectedBatch.batchNumber}</span>
                    ) : (
                        <span className="text-slate-400 font-normal">{isActuallyDisabled ? "Enter unit rate first" : "Select batch"}</span>
                    )}
                </div>
                {visibleSelectedBatch && !isActuallyDisabled && (
                    <button
                        type="button"
                        className="flex items-center justify-center p-1 text-slate-400 hover:text-slate-600 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBatch(null);
                            if (onChange) onChange(null);
                        }}
                    >
                        <span className="text-lg leading-none">&times;</span>
                    </button>
                )}
                <div className="flex items-center justify-center pr-3 text-slate-400 shrink-0">
                    {loading && isOpen ? (
                        <Loader2 size={16} className="animate-spin text-indigo-500" />
                    ) : (
                        <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                    )}
                </div>
            </div>

            {/* Dropdown Menu */}
            {isOpen && !isActuallyDisabled && (
                <div className="absolute top-[100%] right-0 w-[260px] mt-1 bg-white border border-slate-200 rounded-lg shadow-lg shadow-slate-200/50 z-[100] overflow-hidden flex flex-col">
                    {/* Search Bar */}
                    <div className="p-2 border-b border-slate-100 bg-white">
                        <input
                            type="text"
                            autoFocus
                            className="w-full py-1.5 px-3 text-sm bg-slate-50 border border-slate-200 rounded-md outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-colors placeholder:text-slate-400"
                            placeholder="Search batches..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Header Row */}
                    <div className="flex items-center px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <span className="flex-1">Batch</span>
                        <span className="w-14 text-right">Cost</span>
                        <span className="w-14 text-right">Qty</span>
                    </div>

                    {/* Batch List */}
                    <div className="max-h-60 overflow-y-auto">
                        {visibleBatches.length > 0 ? (
                            <div className="divide-y divide-slate-50">
                                {visibleBatches.map((batch) => (
                                    <div
                                        key={batch.edid}
                                        className="flex items-center px-3 py-2 hover:bg-slate-50 cursor-pointer transition-colors"
                                        onClick={() => handleSelect(batch)}
                                    >
                                        <div className="flex-1 font-bold text-sm text-slate-700 truncate">
                                            {batch.batchNumber}
                                        </div>
                                        <div className="w-14 text-right text-sm font-medium text-slate-600">
                                            {Number(batch.unitCost).toFixed(2)}
                                        </div>
                                        <div className="w-14 text-right text-sm font-medium text-slate-500">
                                            {batch.qtyRemaining}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="px-3 py-5 text-center text-sm text-slate-500">
                                {loading ? 'Searching...' : 'No matching batches found.'}
                            </div>
                        )}
                    </div>

                </div>
            )}
        </div>
    );
}