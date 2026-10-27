import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { productionApi } from '../../api/productionApi';
import { productApi } from '../../api/productApi';
import {
    ArrowLeft, CheckCircle2, AlertTriangle,
    Layers, Check, Package, Sparkles, Info
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { Button } from '../../components/ui/Button';
import Dropdown from '../../components/common/Dropdown';

export default function NewProductionRequest() {
    const navigate = useNavigate();
    const { currentUser } = useStore();

    // Product search and selection state
    const [fetchedProducts, setFetchedProducts] = useState([]);
    const [productOptions, setProductOptions] = useState([]);
    const searchTimeout = useRef(null);

    // Form State
    const [formProductEdid, setFormProductEdid] = useState('');
    const [selectedProductObj, setSelectedProductObj] = useState(null);
    const [formQty, setFormQty] = useState(25);
    const [formPriority, setFormPriority] = useState('Medium');
    const priorityOptions = [
        { value: 'Low', label: 'Low Priority' },
        { value: 'Medium', label: 'Medium Priority' },
        { value: 'High', label: 'High Priority' },
        { value: 'Urgent', label: 'Urgent Priority' }
    ];
    const [formReason, setFormReason] = useState('');
    const [selectedBatches, setSelectedBatches] = useState({}); // { [materialId]: batchEdid }
    const [materialBatches, setMaterialBatches] = useState({}); // { [materialId]: [ { edid, batchNumber, qtyAvailable } ] }
    const [formRecipe, setFormRecipe] = useState([]);
    const [loadingRecipe, setLoadingRecipe] = useState(false);
    const [loadingBatches, setLoadingBatches] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Product search from API with current stock - only called when dropdown opens or user types
    const handleProductSearch = (term = '') => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        const executeSearch = async () => {
            try {
                const res = await productApi.getProducts(1, 20, false, term ? term.trim() : '', true);
                const items = res?.items || res?.Items || (Array.isArray(res) ? res : []);
                const valid = items.filter(p => !p.isCombo);
                setFetchedProducts(valid);
                setProductOptions(valid.map(p => ({
                    value: p.edid || p.id,
                    label: `${p.name}${p.sku ? ` (${p.sku})` : ''} - Stock: ${p.stock ?? 0} units`
                })));
            } catch (err) {
                console.error('Failed to search products:', err);
            }
        };

        if (!term) {
            executeSearch();
        } else {
            searchTimeout.current = setTimeout(executeSearch, 250);
        }
    };

    // Sync selectedProductObj when formProductEdid changes from fetched products without extra API calls
    useEffect(() => {
        if (!formProductEdid) {
            setSelectedProductObj(null);
            return;
        }
        const found = fetchedProducts.find(p => (p.edid || p.id) === formProductEdid);
        if (found) {
            setSelectedProductObj(found);
        }
    }, [formProductEdid, fetchedProducts]);

    // Selected product reference
    const selectedFormProduct = useMemo(() => {
        if (!formProductEdid) return null;
        return selectedProductObj || fetchedProducts.find(p => (p.edid || p.id) === formProductEdid) || null;
    }, [formProductEdid, selectedProductObj, fetchedProducts]);

    // When product changes, fetch recipe and batches for each raw material
    useEffect(() => {
        if (!formProductEdid) {
            setFormRecipe([]);
            setMaterialBatches({});
            setSelectedBatches({});
            return;
        }

        let isCancelled = false;

        async function fetchRecipeAndBatches() {
            setLoadingRecipe(true);
            setLoadingBatches(true);
            setFormRecipe([]);
            setMaterialBatches({});
            setSelectedBatches({});

            try {
                // Fetch recipe and available batches from GET /api/production-requests/raw-materials/{productEdid}/recipe
                const resRecipe = await productionApi.getRecipe(formProductEdid);
                const rawItems =
                    (Array.isArray(resRecipe) && resRecipe) ||
                    resRecipe?.rawMaterials ||
                    resRecipe?.data?.rawMaterials ||
                    resRecipe?.items ||
                    resRecipe?.Items ||
                    resRecipe?.data?.items ||
                    resRecipe?.data ||
                    [];
                const recipeList = Array.isArray(rawItems) ? rawItems : [];

                if (isCancelled) return;

                const batchMap = {};
                const initialSelected = {};

                recipeList.forEach((item) => {
                    const matId =
                        item.materialEdId ||
                        item.materialEdid ||
                        item.MaterialEdid ||
                        item.recipeItemEdId ||
                        item.recipeItemEdid ||
                        item.id ||
                        item.edid ||
                        item.edId;
                    if (!matId) return;

                    // Batches can be in recipeBatches, RecipeBatches, recipe, batches, or Batches
                    const batches = Array.isArray(item.recipeBatches)
                        ? item.recipeBatches
                        : (Array.isArray(item.RecipeBatches)
                            ? item.RecipeBatches
                            : (Array.isArray(item.recipe)
                                ? item.recipe
                                : (Array.isArray(item.batches)
                                    ? item.batches
                                    : (Array.isArray(item.Batches) ? item.Batches : []))));

                    batchMap[matId] = batches;

                    if (batches.length > 0) {
                        // Prioritize default batch (isDefault: true), then batch with stock > 0, else first
                        const defaultBatch = batches.find(b => b.isDefault || b.IsDefault) ||
                            batches.find(b => Number(b.qtyAvailable ?? b.QtyAvailable ?? b.qtyRemaining ?? b.QtyRemaining ?? 0) > 0) ||
                            batches[0];

                        const batchId = defaultBatch?.edId || defaultBatch?.edid || defaultBatch?.id;
                        if (batchId) {
                            initialSelected[matId] = batchId;
                        }
                    }
                });

                setFormRecipe(recipeList);
                setMaterialBatches(batchMap);
                setSelectedBatches(initialSelected);
                setLoadingRecipe(false);
                setLoadingBatches(false);
            } catch (err) {
                console.error('Error fetching recipe/batches:', err);
                if (!isCancelled) {
                    setFormRecipe([]);
                    setMaterialBatches({});
                    setSelectedBatches({});
                    setLoadingRecipe(false);
                    setLoadingBatches(false);
                }
            }
        }

        fetchRecipeAndBatches();
        return () => { isCancelled = true; };
    }, [formProductEdid]);

    // Live Recipe Sufficiency calculation with strict active batch enforcement
    const recipeSufficiency = useMemo(() => {
        if (!selectedFormProduct || !Array.isArray(formRecipe) || formRecipe.length === 0) {
            return { items: [], allSufficient: true, hasMissingBatch: false, missingBatchMaterials: [] };
        }

        let allSufficient = true;
        let hasMissingBatch = false;
        const missingBatchMaterials = [];

        const items = formRecipe.map(item => {
            const matId =
                item.materialEdId ||
                item.materialEdid ||
                item.MaterialEdid ||
                item.materialId ||
                item.recipeItemEdId ||
                item.recipeItemEdid ||
                item.id ||
                item.edid ||
                item.edId;

            const batches = materialBatches[matId] ||
                (Array.isArray(item.recipeBatches)
                    ? item.recipeBatches
                    : (Array.isArray(item.RecipeBatches)
                        ? item.RecipeBatches
                        : (Array.isArray(item.recipe)
                            ? item.recipe
                            : (item.batches || item.Batches || []))));

            const selectedBatchEdid = selectedBatches[matId];
            const batchObj = batches.find(b => (b.edId || b.edid || b.id) === selectedBatchEdid);

            const hasBatches = batches.length > 0;
            const hasSelectedActiveBatch = Boolean(batchObj);

            // If an ingredient has no warehouse batches, or no batch has been selected
            if (!hasBatches || !hasSelectedActiveBatch) {
                hasMissingBatch = true;
                const name = item.materialName || item.MaterialName || 'Raw Material';
                if (!missingBatchMaterials.includes(name)) {
                    missingBatchMaterials.push(name);
                }
            }

            // Total batch remaining stock across active batches
            const totalBatchStock = batches.reduce((sum, b) => sum + Number(b.qtyAvailable ?? b.QtyAvailable ?? b.qtyRemaining ?? b.QtyRemaining ?? 0), 0);

            // Available stock for this request from the selected batch:
            const availableStock = batchObj != null
                ? Number(batchObj.qtyAvailable ?? batchObj.QtyAvailable ?? batchObj.qtyRemaining ?? batchObj.QtyRemaining ?? 0)
                : 0;

            const recipeQty = Number(item.qty || item.Qty || 0);
            const reqQty = recipeQty * Number(formQty || 0);
            const isSufficient = hasSelectedActiveBatch && availableStock >= reqQty && availableStock > 0 && reqQty > 0;
            if (!isSufficient) allSufficient = false;

            // Maximum product units producible from this material alone:
            let maxProducibleUnits = 0;
            if (hasSelectedActiveBatch && batchObj) {
                const maxPossible = batchObj.maxProductionPossibleQty ?? batchObj.MaxProductionPossibleQty;
                if (maxPossible !== undefined && maxPossible !== null) {
                    maxProducibleUnits = Number(maxPossible);
                } else if (recipeQty > 0) {
                    maxProducibleUnits = Math.floor(availableStock / recipeQty);
                }
            } else {
                maxProducibleUnits = 0;
            }

            return {
                materialId: matId,
                recipeItemId: item.recipeItemEdId || item.recipeItemEdid || item.recipeItemId || item.id || item.edid || item.edId || null,
                materialName: item.materialName || item.MaterialName || 'Raw Material',
                category: item.category || item.materialCategory || '',
                unitSymbol: item.allowedUnitSymbol || item.AllowedUnitSymbol || item.unitSymbol || '',
                recipeQty,
                requiredQty: reqQty,
                availableStock,
                totalWarehouseStock: totalBatchStock,
                isSufficient,
                hasBatches,
                hasSelectedActiveBatch,
                selectedBatchEdid: selectedBatchEdid || null,
                selectedBatchNumber: batchObj?.batchNumber || batchObj?.BatchNumber || null,
                batchRemaining: batchObj?.qtyAvailable ?? batchObj?.QtyAvailable ?? batchObj?.qtyRemaining ?? batchObj?.QtyRemaining ?? null,
                maxProducibleUnits
            };
        });

        return {
            items,
            allSufficient: allSufficient && !hasMissingBatch && items.length > 0,
            hasMissingBatch,
            missingBatchMaterials
        };
    }, [selectedFormProduct, formRecipe, formQty, selectedBatches, materialBatches]);

    // Overall Maximum Producible Quantity across all recipe raw materials (bottleneck)
    // If ANY recipe item has no active batch, producible quantity is strictly 0!
    const maxProducibleQty = useMemo(() => {
        if (!recipeSufficiency.items || recipeSufficiency.items.length === 0) return 0;
        if (recipeSufficiency.hasMissingBatch) return 0;
        return Math.min(...recipeSufficiency.items.map(m => m.maxProducibleUnits));
    }, [recipeSufficiency.items, recipeSufficiency.hasMissingBatch]);

    // Limiting material (bottleneck)
    const bottleneckMaterial = useMemo(() => {
        if (!recipeSufficiency.items || recipeSufficiency.items.length === 0) return null;
        return recipeSufficiency.items.reduce((prev, curr) =>
            (curr.maxProducibleUnits < prev.maxProducibleUnits ? curr : prev),
            recipeSufficiency.items[0]
        );
    }, [recipeSufficiency.items]);

    // Auto-adjust formQty if it exceeds maxProducibleQty
    useEffect(() => {
        if (maxProducibleQty > 0) {
            if (formQty > maxProducibleQty) {
                setFormQty(maxProducibleQty);
            } else if (!formQty || formQty <= 0) {
                setFormQty(Math.min(25, maxProducibleQty));
            }
        }
    }, [maxProducibleQty]);

    // Handle Submit
    const handleSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!formProductEdid || Number(formQty) <= 0) return;

        // Block if any active batch is missing
        if (recipeSufficiency.hasMissingBatch) {
            const missingNames = recipeSufficiency.missingBatchMaterials.join(', ') || 'one or more raw materials';
            alert(`Cannot create production request: Active batch is missing for: ${missingNames}. All recipe raw materials require an assigned active batch.`);
            return;
        }

        if (maxProducibleQty <= 0 || Number(formQty) > maxProducibleQty || !recipeSufficiency.allSufficient) {
            alert(`Target quantity (${formQty}) cannot be produced. Check raw material batch stock sufficiency.`);
            return;
        }

        // Validate that all materials have a batch selected
        for (const m of recipeSufficiency.items) {
            if (!selectedBatches[m.materialId]) {
                alert(`Please select an active batch for ${m.materialName}.`);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const materialsPayload = recipeSufficiency.items.map(m => ({
                materialEdid: m.materialId,
                materialBatchEdid: selectedBatches[m.materialId] || null,
                recipeItemEdid: m.recipeItemId || null
            }));

            await productionApi.createRequest({
                productEdid: formProductEdid,
                requestedQty: Number(formQty),
                completedQty: 0.00,
                priority: formPriority,
                reason: formReason.trim() || null,
                requestedBy: currentUser?.name || 'Admin User',
                materials: materialsPayload.length > 0 ? materialsPayload : null
            });

            navigate('/production');
        } catch (err) {
            alert('Failed to create production request: ' + (err.message || 'Unknown error'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <PageHeader
                title="New Production Request"
                subtitle="Select product, assign raw material batches, and create production plan."
                leftContent={
                    <Button
                        variant="secondary"
                        onClick={() => navigate('/production')}
                        icon={ArrowLeft}
                        className="cursor-pointer"
                    >
                        Back
                    </Button>
                }
                rightContent={
                    <div className="flex items-center gap-3">
                        {recipeSufficiency.hasMissingBatch && (
                            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                                <AlertTriangle size={13} className="text-rose-600" />
                                Active batch required
                            </span>
                        )}
                        <Button
                            onClick={handleSubmit}
                            disabled={
                                isSubmitting ||
                                !formProductEdid ||
                                !formQty ||
                                formQty <= 0 ||
                                maxProducibleQty <= 0 ||
                                formQty > maxProducibleQty ||
                                !recipeSufficiency.allSufficient ||
                                recipeSufficiency.hasMissingBatch
                            }
                            icon={Check}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Creating Request...' : 'Create Production Request'}
                        </Button>
                    </div>
                }
            />

            {/* 2-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* LEFT COLUMN */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
                        <div>
                            <h3 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-2">
                                <Package size={16} className="text-amber-500" /> Target Product
                            </h3>
                            <p className="text-xs text-slate-500 mb-3">Select the finished product to produce.</p>
                            <Dropdown
                                value={formProductEdid}
                                onChange={(val) => {
                                    setFormProductEdid(val);
                                    const found = fetchedProducts.find(p => (p.edid || p.id) === val);
                                    if (found) setSelectedProductObj(found);
                                }}
                                options={productOptions}
                                searchable={true}
                                onSearchChange={handleProductSearch}
                                onOpen={() => handleProductSearch('')}
                                placeholder="Select"
                            />
                        </div>

                        <div className="mt-2 bg-slate-50 border border-slate-200 p-4 rounded-xl min-h-[76px] flex flex-col justify-center">
                            {selectedFormProduct ? (
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <p className="font-bold text-slate-900 text-sm">{selectedFormProduct.name}</p>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                                            {selectedFormProduct.category || 'Product'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                                        {selectedFormProduct.sku && <span>SKU: {selectedFormProduct.sku}</span>}
                                        <span>Warehouse Stock: <strong className="text-slate-800">{selectedFormProduct.stock ?? 0} units</strong></span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic text-center">No product selected</p>
                            )}
                        </div>

                        <div className="space-y-3 pt-3 border-t border-slate-100">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Production Quantity <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={formQty}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        if (isNaN(val)) setFormQty('');
                                        else {
                                            setFormQty(Math.max(1, val));
                                        }
                                    }}
                                    onBlur={() => {
                                        if (!formQty || formQty < 1) setFormQty(1);
                                        else if (maxProducibleQty > 0 && formQty > maxProducibleQty) setFormQty(maxProducibleQty);
                                    }}
                                    required
                                    className={`w-full bg-white border-2 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none transition-colors ${(selectedFormProduct && maxProducibleQty === 0) || (maxProducibleQty > 0 && formQty > maxProducibleQty)
                                        ? 'border-red-400 bg-red-50/40 text-red-900'
                                        : 'border-slate-200 focus:border-slate-800'
                                        }`}
                                />
                                {selectedFormProduct && maxProducibleQty === 0 && (
                                    <p className="text-[11px] text-rose-600 font-semibold mt-1">
                                        Cannot produce: 0 units producible due to missing active batches.
                                    </p>
                                )}
                                {maxProducibleQty > 0 && formQty > maxProducibleQty && (
                                    <p className="text-[11px] text-red-600 font-semibold mt-1">
                                        Exceeds batch availability: maximum {maxProducibleQty} units producible.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Priority Level
                                </label>
                                <Dropdown
                                    value={formPriority}
                                    onChange={(val) => setFormPriority(val)}
                                    options={priorityOptions}
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Production Purpose / Reason
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Low warehouse stock, Pre-order batch"
                                    value={formReason}
                                    onChange={(e) => setFormReason(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-800"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Production Summary Card */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                <Sparkles size={18} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 text-base">Production Summary</h3>
                                <p className="text-xs text-slate-500">Material requirements and feasibility</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6 sm:gap-8">
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Ingredients</p>
                                <p className="text-xl font-black text-slate-900">{recipeSufficiency.items.length}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Target Qty</p>
                                <p className="text-xl font-black text-slate-900">{formQty || 0} units</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Max Producible</p>
                                <p className={`text-xl font-black ${
                                    !selectedFormProduct ? 'text-slate-900' :
                                    (maxProducibleQty === 0 || formQty > maxProducibleQty ? 'text-rose-600' : 'text-slate-900')
                                }`}>
                                    {selectedFormProduct ? `${maxProducibleQty} units` : '—'}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Recipe Status</p>
                                {selectedFormProduct ? (
                                    recipeSufficiency.hasMissingBatch ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                                            <AlertTriangle size={13} /> Missing Batch
                                        </span>
                                    ) : recipeSufficiency.allSufficient ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                            <CheckCircle2 size={13} /> Sufficient
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                                            <AlertTriangle size={13} /> Insufficient Stock
                                        </span>
                                    )
                                ) : (
                                    <span className="text-xs text-slate-400 italic">No product</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Required Raw Materials Card */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                    <Layers size={18} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-base">Required Raw Materials &amp; Batch Assignment</h3>
                                    <p className="text-xs text-slate-500">Assign batches and verify stock sufficiency for each recipe ingredient.</p>
                                </div>
                            </div>
                        </div>

                        {/* Active Batch Required Banner */}
                        {recipeSufficiency.hasMissingBatch && (
                            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-900 shadow-sm">
                                <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="font-bold text-rose-900 text-sm">
                                        Active Batch Required for Production
                                    </p>
                                    <p className="text-rose-700 leading-relaxed">
                                        Production request cannot be created because the following recipe material(s) have no active batch in warehouse inventory: <strong className="text-rose-900 font-semibold underline decoration-rose-300">{recipeSufficiency.missingBatchMaterials.join(', ')}</strong>. Every recipe ingredient requires an assigned active batch with sufficient stock before creating an order.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Bottleneck Notice */}
                        {bottleneckMaterial && maxProducibleQty > 0 && (
                            <div className="p-3 bg-blue-50/70 border border-blue-200/70 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
                                <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-bold">Limiting Raw Material: </span>
                                    <span>
                                        <strong>{bottleneckMaterial.materialName}</strong> restricts total output to a maximum of <strong>{maxProducibleQty} units</strong> based on selected batch stock.
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Empty / Loading / Table */}
                        {!selectedFormProduct ? (
                            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center">
                                <Package size={42} className="text-slate-300 mb-2 stroke-1" />
                                <p className="text-sm font-semibold text-slate-600">No Product Selected</p>
                                <p className="text-xs text-slate-400 mt-0.5">Please select a product on the left to inspect its recipe and batches.</p>
                            </div>
                        ) : (loadingRecipe || loadingBatches) ? (
                            <div className="flex items-center justify-center gap-2 text-sm text-slate-500 py-16">
                                <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                                <span>Loading product recipe &amp; available batches...</span>
                            </div>
                        ) : recipeSufficiency.items.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 text-xs italic">
                                No recipe items linked to this product yet.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Table Column Headers */}
                                <div className="grid grid-cols-12 gap-3 mb-2 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">
                                    <div className="col-span-1">#</div>
                                    <div className="col-span-3">Material</div>
                                    <div className="col-span-2 text-center">Recipe / Unit</div>
                                    <div className="col-span-2 text-center">Required Qty</div>
                                    <div className="col-span-2">Batch #</div>
                                    <div className="col-span-2 text-right">Available / Limit</div>
                                </div>

                                {/* Item Rows */}
                                <div className="space-y-2.5">
                                    {recipeSufficiency.items.map((mat, index) => {
                                        const batches = materialBatches[mat.materialId] || [];
                                        const hasBatches = batches.length > 0;
                                        const batchOptions = batches.map(b => {
                                            const batchId = b.edId || b.edid || b.id;
                                            const batchNum = b.batchNumber || b.BatchNumber || 'Unknown';
                                            const stock = Number(b.qtyAvailable ?? b.QtyAvailable ?? b.qtyRemaining ?? b.QtyRemaining ?? 0);
                                            return {
                                                value: batchId,
                                                label: `Batch #${batchNum} (${stock.toLocaleString()} ${mat.unitSymbol})`
                                            };
                                        });

                                        return (
                                            <div
                                                key={mat.materialId}
                                                className={`grid grid-cols-12 gap-3 items-center p-3 rounded-xl border transition-colors ${
                                                    !hasBatches
                                                        ? 'bg-rose-50/20 border-rose-200'
                                                        : (!mat.isSufficient
                                                            ? 'bg-amber-50/20 border-amber-200'
                                                            : 'bg-white border-slate-200 hover:border-slate-300')
                                                }`}
                                            >
                                                <div className="col-span-1 font-bold text-slate-700 text-sm pl-2">{index + 1}</div>
                                                <div className="col-span-3">
                                                    <p className="font-bold text-slate-900 text-sm truncate">{mat.materialName}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] text-slate-400 font-medium">Unit: {mat.unitSymbol || '-'}</span>
                                                        {mat.category && (
                                                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                                                {mat.category}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="col-span-2 text-center text-xs font-semibold text-slate-600">
                                                    {mat.recipeQty} {mat.unitSymbol}
                                                </div>
                                                <div className="col-span-2 text-center">
                                                    <span className="font-black text-slate-900 text-sm">{mat.requiredQty.toLocaleString()}</span>
                                                    <span className="text-[11px] text-slate-500 ml-1">{mat.unitSymbol}</span>
                                                </div>
                                                <div className="col-span-2">
                                                    {!hasBatches ? (
                                                        <div className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                                                            <AlertTriangle size={13} className="text-rose-600 shrink-0" />
                                                            <span>No active batch</span>
                                                        </div>
                                                    ) : (
                                                        <Dropdown
                                                            value={selectedBatches[mat.materialId] || ''}
                                                            onChange={(val) => setSelectedBatches(prev => ({ ...prev, [mat.materialId]: val }))}
                                                            options={batchOptions}
                                                            placeholder="Select Batch..."
                                                            isDefault={true}
                                                        />
                                                    )}
                                                </div>
                                                <div className="col-span-2 text-right">
                                                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                                                        !hasBatches
                                                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                            : (mat.isSufficient
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                : 'bg-rose-50 text-rose-700 border-rose-200')
                                                    }`}>
                                                        {mat.availableStock.toLocaleString()} {mat.unitSymbol}
                                                    </span>
                                                    <p className="text-[10px] text-slate-500 mt-0.5">
                                                        Allows: <strong className={!hasBatches || mat.maxProducibleUnits < formQty ? 'text-rose-600' : 'text-slate-800'}>
                                                            {mat.maxProducibleUnits} units
                                                        </strong>
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Bottom Action Row */}
                                <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-xs text-slate-500">
                                        {selectedFormProduct && (
                                            <span>
                                                Producing <strong className="text-slate-800">{formQty || 0} units</strong> of <strong className="text-slate-800">{selectedFormProduct.name}</strong>
                                            </span>
                                        )}
                                    </div>
                                    {recipeSufficiency.hasMissingBatch && (
                                        <span className="text-xs font-semibold text-rose-600 flex items-center gap-1.5 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                                            <AlertTriangle size={13} />
                                            Order blocked: Active batch missing for {recipeSufficiency.missingBatchMaterials.length} item(s)
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}