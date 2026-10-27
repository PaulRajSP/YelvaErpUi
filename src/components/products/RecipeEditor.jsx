import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Trash2, Check, Save, Plus, Minus, ChevronDown, Hexagon } from 'lucide-react';
import { purchaseApi } from '../../api/purchaseApi';
import { productApi } from '../../api/productApi';
import { Button } from '../ui/Button';
import { useStore } from '../../context/StoreContext';

export default function RecipeEditor({ productEdid, initialRecipe, onSave, onCancel }) {
    const { rawMaterials } = useStore();
    const [items, setItems] = useState([]);

    // Search state
    const [searchTerms, setSearchTerms] = useState({});
    const [searchResults, setSearchResults] = useState({});
    const [searchLoading, setSearchLoading] = useState({});
    const [openDropdown, setOpenDropdown] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (initialRecipe && initialRecipe.length > 0) {
            setItems(initialRecipe.map(ci => {
                const matId = ci.materialId || ci.materialEdid || ci.rawMaterialEdid || ci.rawMaterialId || ci.id;
                const material = rawMaterials?.find(rm => rm.id === matId || rm.edid === matId || rm.publicId === matId);
                const unitStr = ci.allowedUnitSymbol || material?.allowedUnitSymbol || material?.unitSymbol || ci.unit || '';
                const displayUnit = unitStr.length > 10 ? '' : unitStr;
                return {
                    materialEdid: matId,
                    materialName: material?.name || ci.materialName || ci.rawMaterialName || ci.name || 'Unknown',
                    qty: ci.qty || 1,
                    unit: displayUnit,
                    allowedUnitSymbol: displayUnit,
                    category: material?.category || ci.category || ci.materialCategory || '',
                    stock: ci.stock || 0,
                    isExisting: true
                };
            }));
        } else {
            setItems([]);
        }
    }, [initialRecipe, rawMaterials]);

    const handleAddItem = () => {
        setItems(prev => [...prev, { materialEdid: '', materialName: '', qty: 1, unit: '', category: '', stock: '' }]);
    };

    const handleRemoveItem = async (index) => {
        const itemToRemove = items[index];
        if (itemToRemove.isExisting && productEdid && itemToRemove.materialEdid) {
            try {
                await productApi.toggleRecipeItemStatus(productEdid, itemToRemove.materialEdid, false);
            } catch (err) {
                console.error('Failed to deactivate recipe item', err);
            }
        }
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const changeQty = (index, delta) => {
        setItems(prev => {
            const newItems = [...prev];
            const current = newItems[index].qty || 0;
            const next = current + delta;
            newItems[index].qty = next > 0 ? Math.round(next) : 0;
            return newItems;
        });
    };

    const searchMaterials = useCallback((rowIndex, term) => {
        if (!term || term.trim().length < 1) {
            setSearchResults(prev => ({ ...prev, [rowIndex]: [] }));
            return;
        }
        setSearchLoading(prev => ({ ...prev, [rowIndex]: true }));

        purchaseApi.getRawMaterials(1, 10, term.trim())
            .then(res => {
                const results = res?.data?.items || res?.items || [];
                setSearchResults(prev => ({ ...prev, [rowIndex]: results }));
            })
            .catch(err => console.error('Material search failed', err))
            .finally(() => setSearchLoading(prev => ({ ...prev, [rowIndex]: false })));
    }, []);

    const debounceTimers = useRef({});
    const handleSearchInput = (rowIndex, value) => {
        setSearchTerms(prev => ({ ...prev, [rowIndex]: value }));
        setOpenDropdown(rowIndex);
        if (debounceTimers.current[rowIndex]) clearTimeout(debounceTimers.current[rowIndex]);
        debounceTimers.current[rowIndex] = setTimeout(() => searchMaterials(rowIndex, value), 500);
    };

    const handleSelectMaterial = (rowIndex, material) => {
        setItems(prev => {
            const newItems = [...prev];
            newItems[rowIndex] = {
                ...newItems[rowIndex],
                materialEdid: material.edid || material.publicId || material.id || material.name || 'unknown',
                materialName: material.name,
                unit: material.unitSymbol || material.unit || '',
                allowedUnitSymbol: material.allowedUnitSymbol || '',
                category: material.category || '',
                stock: material.stock || 0
            };
            return newItems;
        });
        setSearchTerms(prev => ({ ...prev, [rowIndex]: material.name }));
        setOpenDropdown(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validItems = items.filter(i => i.materialEdid && i.qty > 0);
        if (!productEdid) return;

        setIsSaving(true);
        try {
            const payload = {
                items: validItems.map(i => ({ materialEdid: i.materialEdid, qty: i.qty }))
            };
            await productApi.saveRecipe(productEdid, payload.items);
            if (onSave) onSave();
        } catch (err) {
            console.error('Failed to save recipe', err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col bg-white p-6 pb-2">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-[17px] font-bold text-slate-900">Add Material</h3>
                <button
                    onClick={handleAddItem}
                    className="flex items-center gap-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                    <Plus size={16} />
                    Add Material
                </button>
            </div>

            <div className="bg-white mb-4 border border-slate-200 rounded-xl">
                <div className="grid grid-cols-[minmax(120px,1.5fr)_minmax(80px,1fr)_110px_80px_32px] gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Material Name</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Category</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Quantity</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Unit</span>
                    <span />
                </div>

                {items.length === 0 ? (
                    <div className="text-center py-6 text-sm font-medium text-slate-400">No materials added.</div>
                ) : (
                    items.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-[minmax(120px,1.5fr)_minmax(80px,1fr)_110px_80px_32px] gap-2 px-4 py-3 border-b border-slate-100 last:border-0 items-center">

                            {/* Material Search */}
                            <div className="relative">
                                {item.materialEdid ? (
                                    <div className="flex items-center border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white cursor-text select-text" onClick={() => {
                                        // Allow re-selecting
                                        const newItems = [...items];
                                        newItems[idx].materialEdid = '';
                                        setItems(newItems);
                                        setSearchTerms(prev => ({ ...prev, [idx]: item.materialName }));
                                        setOpenDropdown(idx);
                                    }}>
                                        <p className="text-slate-800 text-xs leading-tight truncate">{item.materialName}</p>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={searchTerms[idx] ?? ''}
                                            onChange={(e) => handleSearchInput(idx, e.target.value)}
                                            onFocus={() => setOpenDropdown(idx)}
                                            placeholder="Organic Honey"
                                            className="w-full border border-[#0d9488]/40 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488]/30"
                                        />
                                        {searchLoading[idx] && (
                                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-[#0d9488] border-t-transparent rounded-full animate-spin" />
                                        )}
                                    </div>
                                )}

                                {/* Dropdown Results */}
                                {openDropdown === idx && (searchResults[idx] || []).length > 0 && (
                                    <div className="absolute top-full left-0 min-w-[320px] max-w-[450px] w-max z-30 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {searchResults[idx].map(mat => (
                                            <button
                                                key={mat.edid || mat.id || mat.name}
                                                type="button"
                                                onMouseDown={() => handleSelectMaterial(idx, mat)}
                                                onTouchStart={() => handleSelectMaterial(idx, mat)}
                                                className="w-full flex items-center justify-between px-3 py-2 hover:bg-teal-50 transition-colors text-left"
                                            >
                                                <div>
                                                    <p className="text-xs font-semibold text-slate-800">{mat.name}</p>
                                                    <p className="text-[9px] text-slate-400 font-medium">{mat.category || 'Raw Material'}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {openDropdown === idx && searchTerms[idx] && !searchLoading[idx] && (searchResults[idx] || []).length === 0 && (
                                    <div className="absolute top-full left-0 min-w-[320px] z-30 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl px-3 py-3 text-xs text-slate-400 text-center">
                                        No materials found
                                    </div>
                                )}
                            </div>

                            {/* Category */}
                            <div className="flex items-center justify-center">
                                {item.materialEdid ? (
                                    <span className="text-xs font-semibold text-slate-700 capitalize">{item.category?.toLowerCase() || 'Raw material'}</span>
                                ) : <span className="text-xs text-slate-300">—</span>}
                            </div>

                            {/* Quantity stepper */}
                            <div className="flex items-center justify-center">
                                <div className="flex items-center border border-slate-200 rounded-md overflow-hidden bg-white">
                                    <button
                                        type="button"
                                        onClick={() => changeQty(idx, -1)}
                                        className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer border-r border-slate-200"
                                    >
                                        <Minus size={12} />
                                    </button>
                                    <div className="flex flex-col items-center justify-center h-6 min-w-[56px]">
                                        <input
                                            type="number"
                                            step="1"
                                            min="0"
                                            className="w-14 text-center text-xs font-bold text-slate-800 focus:outline-none border-none bg-transparent p-0 leading-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            value={item.qty}
                                            onChange={(e) => {
                                                const newItems = [...items];
                                                newItems[idx].qty = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                                                setItems(newItems);
                                            }}
                                            onBlur={(e) => {
                                                if (e.target.value === '') {
                                                    const newItems = [...items];
                                                    newItems[idx].qty = 0;
                                                    setItems(newItems);
                                                }
                                            }}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => changeQty(idx, 1)}
                                        className="w-6 h-6 flex items-center justify-center text-[#0d9488] bg-[#f0fdfa] hover:bg-[#ccfbf1] transition-colors cursor-pointer border-l border-slate-200"
                                    >
                                        <Plus size={12} />
                                    </button>
                                </div>
                            </div>

                            {/* allowedUnitSymbol */}
                            <div className="flex items-center justify-center">
                                {item.materialEdid ? (
                                    <span className="text-xs font-bold text-slate-700">{item.allowedUnitSymbol || item.unit || '—'}</span>
                                ) : <span className="text-xs font-bold text-slate-700">—</span>}
                            </div>

                            {/* Remove */}
                            <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="w-6 h-6 flex items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors rounded-md"
                            >
                                <Trash2 size={13} strokeWidth={2.5} />
                            </button>
                        </div>
                    ))
                )}
            </div>

            <div className="flex justify-end gap-3 rounded-b-2xl mb-4">
                {onCancel && (
                    <button onClick={onCancel} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors">
                        Cancel
                    </button>
                )}
                <button
                    onClick={handleSubmit}
                    disabled={isSaving || items.filter(i => i.materialEdid && i.qty > 0).length === 0}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0d9488] hover:bg-[#0f766e] disabled:opacity-50 text-white text-sm font-bold transition-colors shadow-sm"
                >
                    <Save size={16} />
                    {isSaving ? 'Saving...' : 'Save Recipe'}
                </button>
            </div>
        </div>
    );
}
