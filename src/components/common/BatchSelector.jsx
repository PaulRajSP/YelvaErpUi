import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Plus, Package, Loader2 } from 'lucide-react';
import { purchaseApi } from '../../api/purchaseApi';

export default function BatchSelector({ materialEdid, value, onChange, label = "BATCH # (OPTIONAL)", disabled = false, allowAutoGenerate = true }) {
    const [isOpen, setIsOpen] = useState(false);
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedBatch, setSelectedBatch] = useState(null);
    const [creating, setCreating] = useState(false);

    const wrapperRef = useRef(null);

    // Initialize selected batch from value
    useEffect(() => {
        if (value && !selectedBatch) {
            // For now, if value is provided but selectedBatch is empty, we fetch it
            purchaseApi.getBatchById(value).then(res => {
                if (res?.data) {
                    setSelectedBatch(res.data);
                }
            }).catch(console.error);
        } else if (!value) {
            setSelectedBatch(null);
        }
    }, [value]);

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

    const fetchBatches = async (searchTerm = '') => {
        if (!materialEdid) return;
        setLoading(true);
        try {
            const res = await purchaseApi.getBatchesForMaterial(materialEdid, searchTerm);
            if (res?.data?.items) {
                setBatches(res.data.items);
            } else if (res?.items) {
                setBatches(res.items);
            }
        } catch (error) {
            console.error('Error fetching batches:', error);
        } finally {
            setLoading(false);
        }
    };

    // Debounced search
    useEffect(() => {
        if (!isOpen) return;

        const timer = setTimeout(() => {
            fetchBatches(search);
        }, 300);

        return () => clearTimeout(timer);
    }, [search, isOpen, materialEdid]);

    const handleCreateBatch = async () => {
        if (!materialEdid) return;
        setCreating(true);
        try {
            const res = await purchaseApi.createBatch(materialEdid);
            // apiClient unwraps the success envelope, so res IS the data object
            if (res && (res.batchNumber || res.batchEdid || res.edid)) {
                const newBatchNumber = res.batchNumber;
                
                // Hit the API to fetch the updated list containing this specific batch
                try {
                    const listRes = await purchaseApi.getBatchesForMaterial(materialEdid, newBatchNumber);
                    let batchToSelect = null;
                    if (listRes?.items && listRes.items.length > 0) {
                        batchToSelect = listRes.items[0];
                    }
                    
                    if (batchToSelect) {
                        handleSelect(batchToSelect);
                    } else {
                        // Fallback if not found in list API immediately
                        handleSelect({
                            edid: res.batchEdid || res.edid,
                            batchNumber: newBatchNumber,
                            qtyRemaining: 0,
                            qtyPurchased: 0
                        });
                    }
                } catch (e) {
                    handleSelect({
                        edid: res.batchEdid || res.edid,
                        batchNumber: newBatchNumber,
                        qtyRemaining: 0,
                        qtyPurchased: 0
                    });
                }
            }
        } catch (error) {
            console.error('Error creating batch:', error);
        } finally {
            setCreating(false);
        }
    };

    const handleSelect = (batch) => {
        setSelectedBatch(batch);
        setSearch('');
        setIsOpen(false);
        if (onChange) {
            onChange(batch);
        }
    };

    const isActuallyDisabled = disabled || !materialEdid;

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
                        if (selectedBatch) {
                            setSearch(selectedBatch.batchNumber);
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
                    {selectedBatch ? (
                        <span>{selectedBatch.batchNumber}</span>
                    ) : (
                        <span className="text-slate-400 font-normal">e.g. 636355</span>
                    )}
                </div>
                {selectedBatch && !isActuallyDisabled && (
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
            {isOpen && materialEdid && !disabled && (
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
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <span>Batch Number</span>
                        <span>Qty Remaining</span>
                    </div>

                    {/* Batch List */}
                    <div className="max-h-60 overflow-y-auto">
                        {batches.length > 0 ? (
                            <div className="divide-y divide-slate-50">
                                {batches.map((batch) => (
                                    <div
                                        key={batch.edid}
                                        className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                                        onClick={() => handleSelect(batch)}
                                    >
                                        <div className="font-bold text-sm text-slate-700">
                                            {batch.batchNumber}
                                        </div>
                                        <div className="text-sm font-medium text-slate-500">
                                            {batch.qtyRemaining}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="px-4 py-6 text-center text-sm text-slate-500">
                                {loading ? 'Searching...' : 'No matching batches found.'}
                            </div>
                        )}
                    </div>

                    {/* Create New Batch Button */}
                    {allowAutoGenerate && (
                        <div className="p-2 bg-slate-50 border-t border-slate-100">
                            <button
                                type="button"
                                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md bg-indigo-50 text-indigo-600 font-bold text-sm hover:bg-indigo-100 transition-colors disabled:opacity-50"
                                onClick={handleCreateBatch}
                                disabled={creating}
                            >
                                {creating ? (
                                    <><Loader2 size={16} className="animate-spin" /> Creating...</>
                                ) : (
                                    <><Plus size={16} strokeWidth={3} /> Auto-generate new batch</>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
