import { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import BatchSelector from '../common/BatchSelector';
import { productApi } from '../../api/productApi';
import Dropdown from '../common/Dropdown';
import DatePicker from '../common/DatePicker';
import { commonApi } from '../../api/commonApi';

const expiryDateFor = (packedDate, months) => {
    if (!packedDate || !months) return '';
    const [year, month, day] = packedDate.split('-').map(Number);
    const targetMonth = month - 1 + Number(months);
    const lastDay = new Date(year, targetMonth + 1, 0).getDate();
    const expiry = new Date(year, targetMonth, Math.min(day, lastDay));
    return `${expiry.getFullYear()}-${String(expiry.getMonth() + 1).padStart(2, '0')}-${String(expiry.getDate()).padStart(2, '0')}`;
};

const formatDateOnly = value => new Date(`${value}T00:00:00`).toLocaleDateString();
const todayLocal = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

export default function StockModal({ isOpen, onClose, product, onSave }) {
    const [recipe, setRecipe] = useState([]);
    const [recipeLoading, setRecipeLoading] = useState(false);
    const [newStock, setNewStock] = useState('');
    const [remarks, setRemarks] = useState('');
    const [packedDate, setPackedDate] = useState('');
    const [shelfLifeMonths, setShelfLifeMonths] = useState('');
    const [shelfLifeOptions, setShelfLifeOptions] = useState([]);
    const [shelfLifeError, setShelfLifeError] = useState('');
    const [rmBatches, setRmBatches] = useState({}); // { materialEdid: { batch, isValid, validating, requiredQty, availableQty } }
    const [isSaving, setIsSaving] = useState(false);

    const productEdid = product?.edid || product?.id;
    const stockValue = parseInt(newStock) || 0;
    const rmEnabled = stockValue > 0 && recipe.length > 0;

    useEffect(() => {
        if (!isOpen) return undefined;
        let isCurrent = true;
        setShelfLifeError('');
        commonApi.getShelfLifeOptions()
            .then(options => {
                if (isCurrent) setShelfLifeOptions(options);
            })
            .catch(err => {
                console.error('Failed to load shelf-life options:', err);
                if (isCurrent) setShelfLifeError(err.message || 'Failed to load shelf-life options.');
            });
        return () => { isCurrent = false; };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && product) {
            setNewStock(product.stock?.toString() || '0');
            setRemarks('');
            setPackedDate('');
            setShelfLifeMonths('');
            setRmBatches({});
            setRecipe([]);
            // Fetch recipe from API
            const edid = product.edid || product.id;
            if (edid) {
                setRecipeLoading(true);
                productApi.getRecipe(edid)
                    .then(res => {
                        const items = res?.data?.items || res?.items || res || [];
                        setRecipe(Array.isArray(items) ? items : []);
                    })
                    .catch(err => console.error('Failed to load recipe', err))
                    .finally(() => setRecipeLoading(false));
            }
        } else {
            setNewStock('');
            setRemarks('');
            setPackedDate('');
            setShelfLifeMonths('');
            setRmBatches({});
            setRecipe([]);
            setIsSaving(false);
        }
    }, [isOpen, product]);

    // When newStock changes, re-validate all already-selected batches
    useEffect(() => {
        if (!rmEnabled) return;
        const entries = Object.entries(rmBatches);
        if (entries.length === 0) return;
        entries.forEach(([matEdid, entry]) => {
            if (entry?.batch) {
                validateBatch(matEdid, entry.batch);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stockValue]);


    const validateBatch = useCallback(async (matEdid, batch) => {
        if (!batch || !productEdid || stockValue <= 0) return;

        setRmBatches(prev => ({
            ...prev,
            [matEdid]: { ...prev[matEdid], batch, validating: true, isValid: null }
        }));

        try {
            const res = await productApi.validateMaterialBatch(
                productEdid,
                matEdid,
                batch.edid,
                batch.batchNumber,
                stockValue
            );
            // res is the data object: { isValid, requiredQty, availableQty }
            setRmBatches(prev => ({
                ...prev,
                [matEdid]: {
                    batch,
                    validating: false,
                    isValid: res?.isValid ?? false,
                    requiredQty: res?.requiredQty,
                    availableQty: res?.availableQty,
                }
            }));
        } catch (err) {
            console.error('Validation error:', err);
            setRmBatches(prev => ({
                ...prev,
                [matEdid]: { batch, validating: false, isValid: false, requiredQty: null, availableQty: null }
            }));
        }
    }, [productEdid, stockValue]);

    const handleBatchSelect = (matEdid, batch) => {
        if (!batch) {
            setRmBatches(prev => ({ ...prev, [matEdid]: null }));
            return;
        }
        validateBatch(matEdid, batch);
    };

    const allValid = recipe.length > 0
        ? recipe.every(item => {
            const matEdid = item.materialId || item.materialEdid;
            const entry = rmBatches[matEdid];
            return entry?.isValid === true;
        })
        : true;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!product || isSaving) return;
        if (!packedDate || !shelfLifeOptions.some(option => option.value === shelfLifeMonths)) {
            window.alert('Choose a packed date and shelf life.');
            return;
        }
        if (recipe.length > 0 && stockValue > 0 && !allValid) return;
        
        setIsSaving(true);
        try {
            await onSave(product.id, stockValue, remarks, rmBatches, recipe, packedDate, Number(shelfLifeMonths));
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-center p-4 sm:p-8 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-6xl flex flex-col my-auto h-fit overflow-visible relative shadow-2xl">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-white shrink-0 rounded-t-2xl">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Update Stock</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Product: <span className="font-bold text-slate-700">{product?.name}</span>
                            <span className="mx-2 text-slate-300">·</span>
                            Current Stock: <span className="font-bold text-slate-700">{product?.stock ?? 0}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-5 overflow-visible">

                    {/* Stock + Batch inputs */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">New Stock Value *</label>
                            <input
                                required
                                type="number"
                                min="0"
                                value={newStock}
                                onChange={(e) => {
                                    setNewStock(e.target.value);
                                    // Clear RM selections when stock changes
                                    setRmBatches({});
                                }}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
                                placeholder="Enter new stock count"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Remarks (Optional)</label>
                            <input
                                type="text"
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
                                placeholder="e.g., Stock Reconciliation"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Packed Date *</label>
                            <DatePicker
                                value={packedDate}
                                onChange={setPackedDate}
                                required
                                maxDate={todayLocal()}
                                className="w-full"
                            />
                        </div>
                        <Dropdown
                            label="Shelf Life"
                            required
                            value={shelfLifeMonths}
                            onChange={setShelfLifeMonths}
                            options={shelfLifeOptions}
                            placeholder="Choose shelf life"
                            disabled={shelfLifeOptions.length === 0}
                            className="w-full"
                        />
                        {shelfLifeError && (
                            <p className="col-span-2 -mt-2 text-xs text-red-600">{shelfLifeError}</p>
                        )}
                        {packedDate && shelfLifeMonths && (
                            <p className="col-span-2 -mt-2 text-xs text-slate-500">
                                Packed: <strong className="text-slate-700">{formatDateOnly(packedDate)}</strong>
                                <span className="mx-2">→</span>
                                Expires: <strong className="text-slate-700">{formatDateOnly(expiryDateFor(packedDate, shelfLifeMonths))}</strong>
                            </p>
                        )}
                    </div>

                    {/* Raw Material Requirements */}
                    {recipeLoading && (
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                            <Loader2 size={16} className="animate-spin" /> Loading raw material requirements...
                        </div>
                    )}
                    {!recipeLoading && recipe.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-800">Raw Material Requirements</h3>
                                {!rmEnabled && (
                                    <span className="text-[11px] text-amber-600 font-medium bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                        Enter a stock value greater than 0 to select batches
                                    </span>
                                )}
                            </div>

                            <div className={`border border-slate-200 rounded-xl overflow-visible transition-opacity ${rmEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3">Material</th>
                                            <th className="px-4 py-3">Category</th>
                                            <th className="px-4 py-3 text-right">Qty Per Unit</th>
                                            <th className="px-4 py-3 text-right">Required Qty</th>
                                            <th className="px-4 py-3 min-w-[220px]">Batch Select</th>
                                            <th className="px-4 py-3 w-10">Status</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-100">
                                        {recipe.map((item, idx) => {
                                            const matEdid = item.materialId || item.materialEdid;
                                            const entry = rmBatches[matEdid];
                                            const totalRequired = item.qty * stockValue;
                                            const unit = item.allowedUnitSymbol || item.unitSymbol || item.unit || '';

                                            return (
                                                <tr key={idx} className="bg-white">
                                                    <td className="px-4 py-3 font-medium text-slate-700">
                                                        {item.materialName || 'Unknown'}
                                                    </td>

                                                    <td className="px-4 py-3 text-slate-500 text-xs">
                                                        {item.category || ''}
                                                    </td>

                                                    <td className="px-4 py-3 text-right">
                                                        <span className="text-slate-800">
                                                            {item.qty} {unit}
                                                        </span>
                                                    </td>

                                                    <td className="px-4 py-3 text-right">
                                                        <span className="text-slate-800">
                                                            {totalRequired.toLocaleString()} {unit}
                                                        </span>
                                                    </td>

                                                    <td className="px-4 py-2">
                                                        <div className="space-y-1">
                                                            <BatchSelector
                                                                label=""
                                                                materialEdid={matEdid}
                                                                value={entry?.batch?.edid || ''}
                                                                onChange={(batch) => handleBatchSelect(matEdid, batch)}
                                                                allowAutoGenerate={false}
                                                            />

                                                            {entry && !entry.validating && entry.isValid === false && (
                                                                <p className="text-[10px] text-red-500 font-medium px-1">
                                                                    Need {entry.requiredQty?.toLocaleString() ?? '?'} {unit},
                                                                    available {entry.availableQty?.toLocaleString() ?? '?'} {unit}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </td>

                                                    <td className="px-4 py-3 text-center">
                                                        {entry?.validating && (
                                                            <Loader2 size={16} className="text-indigo-400 animate-spin mx-auto" />
                                                        )}
                                                        {entry && !entry.validating && entry.isValid === true && (
                                                            <CheckCircle2 size={18} className="text-emerald-500 mx-auto" />
                                                        )}
                                                        {entry && !entry.validating && entry.isValid === false && (
                                                            <XCircle size={18} className="text-red-500 mx-auto" />
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={(rmEnabled && !allValid) || isSaving}
                            className="px-5 py-2.5 rounded-lg text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSaving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
