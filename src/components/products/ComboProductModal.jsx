import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Gift, Trash2, Tag, Users, User, Globe, Building2, Check, Save, Search, Minus, Plus, QrCode, AlertTriangle } from 'lucide-react';
import { productApi } from '../../api/productApi';

const ALL_TYPES = ['DIRECT', 'ONLINE', 'WHOLESALE'];

const normalizeCustomerType = (p) =>
    (p.customerOwnerType || p.customerType || p.customeromerType || '').toUpperCase().trim();

const normalizePricing = (items = []) =>
    (items || []).map(p => ({
        ...p,
        customerOwnerType: normalizeCustomerType(p),
        customerType: normalizeCustomerType(p),
        price: parseFloat(p.price) || 0,
        mrp: parseFloat(p.mrp) || 0
    }));

// Which customer types a single item supports (empty pricing → none)
const getItemSupportedTypes = (item) => {
    if (!item?.productEdid || !Array.isArray(item?.pricing) || item.pricing.length === 0) return [];
    return ALL_TYPES.filter(type =>
        item.pricing.some(p => normalizeCustomerType(p) === type)
    );
};

/**
 * Given the current combo items and the user's checked types,
 * compute the trimmed list that should remain checked.
 *
 * - If nothing selected yet → allow all (default)
 * - If any selected item's pricing is still loading → don't prune yet
 * - Otherwise → keep only types supported by EVERY selected item
 */
const computeNextCheckedTypes = (items, currentChecked) => {
    const selected = items.filter(it => it.productEdid);
    if (selected.length === 0) return [...ALL_TYPES];

    const stillLoading = selected.some(it => !it.pricingLoaded);
    if (stillLoading) return currentChecked; // wait until everything is loaded

    const intersection = ALL_TYPES.filter(type =>
        selected.every(it => getItemSupportedTypes(it).includes(type))
    );
    return currentChecked.filter(t => intersection.includes(t));
};

export default function ComboProductModal({ isOpen, onClose, editingProduct, onSave }) {
    const [productForm, setProductForm] = useState({
        name: '',
        sku: '',
        qrCode: '',
        mrpDirect: '',
        priceDirect: '',
        mrpOnline: '',
        priceOnline: '',
        mrpWholesale: '',
        priceWholesale: '',
        allowedCustomerTypes: [...ALL_TYPES],
        comboItems: []
    });

    const [honeyUnit, setHoneyUnit] = useState(null);

    const [searchTerms, setSearchTerms] = useState({});
    const [searchResults, setSearchResults] = useState({});
    const [searchLoading, setSearchLoading] = useState({});
    const [openDropdown, setOpenDropdown] = useState(null);

    // Honey category
    useEffect(() => {
        if (isOpen) {
            productApi.getRawMaterialCategories(1, 10, 'Honey')
                .then(res => {
                    const items = res?.data?.items || res?.items || [];
                    const honey = items.find(i => i.name && i.name.toUpperCase() === 'HONEY') || items[0];
                    if (honey) setHoneyUnit({ allowedUnitEdid: honey.allowedUnitEdid, allowedUnitSymbol: honey.allowedUnitSymbol || '' });
                })
                .catch(err => console.error('Failed to fetch honey category', err));
        }
    }, [isOpen]);

    // Reset / populate form on open
    useEffect(() => {
        if (isOpen) {
            if (editingProduct) {
                const baseItems = editingProduct.comboItems || [];
                setProductForm({
                    name: editingProduct.name || '',
                    sku: editingProduct.sku || '',
                    qrCode: editingProduct.qrCode || editingProduct.sku || '',
                    mrpDirect: editingProduct.mrps?.DIRECT || editingProduct.mrp || '',
                    priceDirect: editingProduct.prices?.DIRECT || editingProduct.price || '',
                    mrpOnline: editingProduct.mrps?.ONLINE || editingProduct.mrp || '',
                    priceOnline: editingProduct.prices?.ONLINE || editingProduct.price || '',
                    mrpWholesale: editingProduct.mrps?.WHOLESALE || editingProduct.mrp || '',
                    priceWholesale: editingProduct.prices?.WHOLESALE || editingProduct.price || '',
                    allowedCustomerTypes: editingProduct.allowedCustomerTypes || [...ALL_TYPES],
                    comboItems: baseItems.map(item => ({
                        productEdid: item.productEdid || item.productId || '',
                        productName: item.name || '',
                        productSku: item.sku || '',
                        qty: item.unitCount ?? item.qty ?? item.quantity ?? 1,
                        unitEdid: item.unitEdid || '',
                        unitSymbol: item.unitSymbol || '',
                        productQty: item.productQty || 0,
                        pricing: normalizePricing(item.pricing || []),
                        // If server gave us a pricing array (even empty), treat as loaded.
                        pricingLoaded: Array.isArray(item.pricing) && item.pricing.length > 0
                    }))
                });

                if (baseItems.length > 0) {
                    Promise.all(baseItems.map(async (item) => {
                        let pricing = normalizePricing(item.pricing || []);
                        let pricingLoaded = Array.isArray(item.pricing) && item.pricing.length > 0;
                        const pEdid = item.productEdid || item.productId;
                        if (!pricingLoaded && pEdid) {
                            try {
                                const pRes = await productApi.getPricing(pEdid);
                                const pItems = pRes?.data?.items || pRes?.items || [];
                                pricing = normalizePricing(pItems);
                                pricingLoaded = true; // even if empty, we now know
                            } catch (e) {
                                console.error('Failed to fetch pricing for base item', e);
                            }
                        }
                        return {
                            productEdid: pEdid || '',
                            productName: item.name || '',
                            productSku: item.sku || '',
                            qty: item.unitCount ?? item.qty ?? item.quantity ?? 1,
                            unitEdid: item.unitEdid || '',
                            unitSymbol: item.unitSymbol || '',
                            productQty: item.productQty || 0,
                            pricing,
                            pricingLoaded
                        };
                    })).then(itemsWithPricing => {
                        setProductForm(prev => ({ ...prev, comboItems: itemsWithPricing }));
                    });
                }

                const productEdid = editingProduct.edid || editingProduct.id;
                if (productEdid && baseItems.length === 0) {
                    productApi.getComboItems(productEdid)
                        .then(async res => {
                            const items = res?.data?.items || res?.items || [];
                            const itemsWithPricing = await Promise.all(items.map(async (item) => {
                                let pricing = [];
                                let pricingLoaded = false;
                                if (item.productEdid) {
                                    try {
                                        const pRes = await productApi.getPricing(item.productEdid);
                                        const pItems = pRes?.data?.items || pRes?.items || [];
                                        pricing = normalizePricing(pItems);
                                        pricingLoaded = true;
                                    } catch (e) {
                                        console.error('Failed to fetch pricing for combo item', e);
                                    }
                                }
                                return {
                                    productEdid: item.productEdid || '',
                                    productName: item.name || item.productEdid || '',
                                    productSku: item.sku || '',
                                    qty: item.quantity || 1,
                                    unitEdid: item.unitEdid || '',
                                    unitSymbol: item.unitSymbol || '',
                                    productQty: item.productQty || 0,
                                    pricing,
                                    pricingLoaded
                                };
                            }));
                            setProductForm(prev => ({ ...prev, comboItems: itemsWithPricing }));
                        })
                        .catch(err => console.error('Failed to fetch combo items', err));
                }
            } else {
                setProductForm({
                    name: '', sku: '', qrCode: '',
                    mrpDirect: '', priceDirect: '',
                    mrpOnline: '', priceOnline: '',
                    mrpWholesale: '', priceWholesale: '',
                    allowedCustomerTypes: [...ALL_TYPES],
                    comboItems: []
                });
                setSearchTerms({});
                setSearchResults({});
                setOpenDropdown(null);
            }
        }
    }, [isOpen, editingProduct]);

    const fetchedPricingIds = useRef(new Set());

    // Auto-fetch pricing for combo items that are not yet loaded
    useEffect(() => {
        if (!isOpen) {
            fetchedPricingIds.current.clear();
            return;
        }
        productForm.comboItems.forEach((item, idx) => {
            if (
                item.productEdid &&
                !item.pricingLoaded &&
                !fetchedPricingIds.current.has(item.productEdid)
            ) {
                fetchedPricingIds.current.add(item.productEdid);
                productApi.getPricing(item.productEdid)
                    .then(res => {
                        const raw = Array.isArray(res) ? res : (res?.items || res?.data?.items || []);
                        const pricing = normalizePricing(raw);
                        setProductForm(prev => {
                            const updated = [...prev.comboItems];
                            if (updated[idx] && updated[idx].productEdid === item.productEdid) {
                                updated[idx] = { ...updated[idx], pricing, pricingLoaded: true };
                                const nextChecked = computeNextCheckedTypes(updated, prev.allowedCustomerTypes);
                                return { ...prev, comboItems: updated, allowedCustomerTypes: nextChecked };
                            }
                            return prev;
                        });
                    })
                    .catch(err => {
                        console.error('Failed to auto-fetch pricing for combo item', err);
                        fetchedPricingIds.current.delete(item.productEdid);
                    });
            }
        });
    }, [isOpen, productForm.comboItems]);

    const comboItemsRef = useRef(productForm.comboItems);
    useEffect(() => { comboItemsRef.current = productForm.comboItems; }, [productForm.comboItems]);

    const searchProducts = useCallback((rowIndex, term) => {
        if (!term || term.trim().length < 1) {
            setSearchResults(prev => ({ ...prev, [rowIndex]: [] }));
            return;
        }
        setSearchLoading(prev => ({ ...prev, [rowIndex]: true }));
        productApi.getProducts(1, 10, false, term.trim(), true, null)
            .then(res => {
                const items = res?.data?.items || res?.items || [];
                setSearchResults(prev => ({ ...prev, [rowIndex]: items }));
            })
            .catch(err => console.error('Product search failed', err))
            .finally(() => setSearchLoading(prev => ({ ...prev, [rowIndex]: false })));
    }, []);

    const debounceTimers = useRef({});
    const handleSearchInput = (rowIndex, value) => {
        setSearchTerms(prev => ({ ...prev, [rowIndex]: value }));
        setOpenDropdown(rowIndex);
        if (debounceTimers.current[rowIndex]) clearTimeout(debounceTimers.current[rowIndex]);
        debounceTimers.current[rowIndex] = setTimeout(() => searchProducts(rowIndex, value), 500);
    };

    const selectProduct = async (rowIndex, product) => {
        const productEdid = product.edid || product.id;
        const unitEdid = product.unitEdid || product.unit || honeyUnit?.allowedUnitEdid || '';
        const unitSymbol = product.unitSymbol || product.unit || honeyUnit?.allowedUnitSymbol || '';
        const productQty = parseFloat(product.qty || product.unitValue || 0);

        let pricing = [];
        let pricingLoaded = false;
        try {
            const res = await productApi.getPricing(productEdid);
            const items = Array.isArray(res) ? res : (res?.items || res?.data?.items || []);
            pricing = normalizePricing(items);
            pricingLoaded = true;
            fetchedPricingIds.current.add(productEdid);
        } catch (err) {
            console.error('Failed to fetch pricing for product', err);
        }

        setProductForm(prev => {
            const updated = [...prev.comboItems];

            const existingIndex = updated.findIndex((item, idx) =>
                idx !== rowIndex && item.productEdid &&
                (item.productEdid === productEdid || (item.productSku && item.productSku === product.sku))
            );

            let nextItems;
            if (existingIndex !== -1) {
                updated[existingIndex] = {
                    ...updated[existingIndex],
                    qty: (updated[existingIndex].qty || 1) + 1
                };
                updated[rowIndex] = {
                    productEdid: '', productName: '', productSku: '', qty: 1,
                    unitEdid: '', unitSymbol: '', productQty: 0,
                    pricing: [], pricingLoaded: false
                };
                nextItems = updated;
            } else {
                updated[rowIndex] = {
                    ...updated[rowIndex],
                    productEdid,
                    productName: product.name,
                    productSku: product.sku || '',
                    unitEdid,
                    unitSymbol,
                    productQty,
                    pricing,
                    pricingLoaded
                };
                nextItems = updated;
            }

            const nextChecked = computeNextCheckedTypes(nextItems, prev.allowedCustomerTypes);
            return { ...prev, comboItems: nextItems, allowedCustomerTypes: nextChecked };
        });

        setSearchTerms(prev => ({ ...prev, [rowIndex]: '' }));
        setSearchResults(prev => ({ ...prev, [rowIndex]: [] }));
        setOpenDropdown(null);
    };

    const addComboItem = () => {
        setProductForm(prev => ({
            ...prev,
            comboItems: [...prev.comboItems, {
                productEdid: '', productName: '', productSku: '', qty: 1,
                unitEdid: '', unitSymbol: '', productQty: 0,
                pricing: [], pricingLoaded: false
            }]
        }));
    };

    const removeComboItem = (index) => {
        setProductForm(prev => {
            const nextItems = prev.comboItems.filter((_, i) => i !== index);
            const nextChecked = computeNextCheckedTypes(nextItems, prev.allowedCustomerTypes);
            return { ...prev, comboItems: nextItems, allowedCustomerTypes: nextChecked };
        });
        setSearchTerms(prev => { const n = { ...prev }; delete n[index]; return n; });
        setSearchResults(prev => { const n = { ...prev }; delete n[index]; return n; });
    };

    const changeQty = (index, delta) => {
        setProductForm(prev => {
            const updated = [...prev.comboItems];
            updated[index] = { ...updated[index], qty: Math.max(1, (updated[index].qty || 1) + delta) };
            return { ...prev, comboItems: updated };
        });
    };

    const totalUnitSize = productForm.comboItems.reduce(
        (sum, item) => sum + (parseFloat(item.productQty) || 0) * (parseFloat(item.qty) || 1),
        0
    );

    // ---------- Intersection / effective types ----------

    const selectedItems = productForm.comboItems.filter(it => it.productEdid);
    const pendingItems = selectedItems.filter(it => !it.pricingLoaded);

    // Items with actual pricing rows (used for MRP calc)
    const validItems = productForm.comboItems.filter(it => it.productEdid && it.pricing?.length > 0);

    const allowedIntersection =
        selectedItems.length === 0
            ? [...ALL_TYPES]
            : pendingItems.length > 0
                ? [...ALL_TYPES] // don't restrict while still loading
                : ALL_TYPES.filter(type =>
                    selectedItems.every(it => getItemSupportedTypes(it).includes(type))
                );

    const effectiveCustomerTypes = productForm.allowedCustomerTypes.filter(t => allowedIntersection.includes(t));

    // MRP calculation
    const computedMrps = { DIRECT: 0, ONLINE: 0, WHOLESALE: 0 };
    validItems.forEach(item => {
        const qty = parseFloat(item.qty) || 1;
        item.pricing.forEach(p => {
            const type = normalizeCustomerType(p);
            if (computedMrps[type] !== undefined) {
                computedMrps[type] += (parseFloat(p.mrp) || 0) * qty;
            }
        });
    });

    // Save-guard: prevent save if nothing is allowed while products are selected
    const noAllowedTypes = selectedItems.length > 0 && allowedIntersection.length === 0;
    const canSave = !noAllowedTypes && pendingItems.length === 0;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!canSave) return;

        const comboItems = productForm.comboItems
            .filter(item => item.productEdid)
            .map(item => ({ productEdid: item.productEdid, quantity: parseFloat(item.qty) || 1 }));

        const productData = {
            name: productForm.name,
            qty: null,
            isCombo: true,
            qrCode: productForm.qrCode || productForm.sku || '',
            comboItems
        };

        const uiMeta = {
            id: editingProduct ? editingProduct.id : undefined,
            sku: editingProduct ? productForm.sku : productForm.qrCode,
            qrCode: productForm.qrCode,
            active: editingProduct ? editingProduct.active : true,
            unitValue: totalUnitSize,
            unit: honeyUnit?.allowedUnitEdid || '',
            allowedCustomerTypes: effectiveCustomerTypes
        };

        const pricingItems = [];
        if (effectiveCustomerTypes.includes('DIRECT')) {
            const mrp = validItems.length > 0 ? computedMrps.DIRECT : (parseFloat(productForm.mrpDirect) || 0);
            pricingItems.push({ customerType: 'DIRECT', mrp, price: parseFloat(productForm.priceDirect) || 0 });
        }
        if (effectiveCustomerTypes.includes('ONLINE')) {
            const mrp = validItems.length > 0 ? computedMrps.ONLINE : (parseFloat(productForm.mrpOnline) || 0);
            pricingItems.push({ customerType: 'ONLINE', mrp, price: parseFloat(productForm.priceOnline) || 0 });
        }
        if (effectiveCustomerTypes.includes('WHOLESALE')) {
            const mrp = validItems.length > 0 ? computedMrps.WHOLESALE : (parseFloat(productForm.mrpWholesale) || 0);
            pricingItems.push({ customerType: 'WHOLESALE', mrp, price: parseFloat(productForm.priceWholesale) || 0 });
        }

        onSave(productData, uiMeta, { items: pricingItems });
    };

    if (!isOpen) return null;

    const isDirectEnabled = effectiveCustomerTypes.includes('DIRECT');
    const isOnlineEnabled = effectiveCustomerTypes.includes('ONLINE');
    const isWholesaleEnabled = effectiveCustomerTypes.includes('WHOLESALE');

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="flex min-h-full items-center justify-center">
                <div className="bg-white rounded-2xl w-full max-w-4xl flex flex-col relative my-8 shadow-xl">

                    {/* Header */}
                    <div className="flex justify-between items-center p-6 border-b border-purple-100 bg-purple-50/40 sticky top-0 z-20 rounded-t-2xl">
                        <div className="flex items-center gap-4">
                            <div className="bg-purple-100 text-purple-600 p-2.5 rounded-xl"><Gift size={24} /></div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">
                                    {editingProduct ? 'Edit Combo Product' : 'Add New Combo Product'}
                                </h2>
                                <p className="text-sm text-slate-500 font-medium">Create product bundles with pricing and included items</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">

                        {/* Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                                    Combo Product Name <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Tag size={14} className="text-purple-400" />
                                    </div>
                                    <input
                                        required type="text"
                                        value={productForm.name}
                                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                                        placeholder="e.g., Honey Lovers Gift Pack"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                                    QR Code / Barcode
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <QrCode size={14} className="text-purple-400" />
                                    </div>
                                    <input
                                        type="text"
                                        value={productForm.qrCode}
                                        onChange={(e) => setProductForm({ ...productForm, qrCode: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                                        placeholder="e.g., QR-HONEY-001"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Included Products */}
                        <div className="border border-purple-200 bg-purple-50/20 rounded-xl">
                            <div className="flex justify-between items-center px-5 py-3.5 bg-purple-50/60 border-b border-purple-200">
                                <div>
                                    <h3 className="text-sm font-bold text-purple-900 flex items-center gap-2">
                                        <Gift size={16} className="text-purple-600" /> Included Products
                                    </h3>
                                    <p className="text-[11px] text-purple-700/70 font-medium mt-0.5">
                                        Only products that support the same customer types can be combined.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={addComboItem}
                                    className="flex items-center gap-1.5 text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 px-3.5 py-2 rounded-lg transition-colors cursor-pointer shadow-sm"
                                >
                                    <Plus size={14} /> Add Product
                                </button>
                            </div>

                            {productForm.comboItems.length === 0 ? (
                                <div className="text-center py-8 bg-white">
                                    <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center mx-auto mb-3">
                                        <Gift size={22} className="text-purple-300" />
                                    </div>
                                    <p className="text-sm text-slate-500 font-medium">No products added yet.</p>
                                    <button type="button" onClick={addComboItem} className="mt-2 text-xs text-purple-600 font-bold hover:underline">
                                        + Add first product
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-white">
                                    <div className="grid grid-cols-[minmax(160px,1.8fr)_90px_minmax(110px,1fr)_110px_40px] gap-3 px-4 py-2 border-b border-slate-100 bg-slate-50">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Product Name</span>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Allowed</span>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">SKU</span>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Quantity</span>
                                        <span />
                                    </div>

                                    {productForm.comboItems.map((item, idx) => {
                                        const itemTypes = getItemSupportedTypes(item);
                                        const noPricing = item.productEdid && item.pricingLoaded && item.pricing.length === 0;
                                        const missingTypes = allowedIntersection.filter(t => !itemTypes.includes(t));
                                        const hasPartialConflict =
                                            item.productEdid && item.pricingLoaded && item.pricing.length > 0 && missingTypes.length > 0;

                                        return (
                                            <div key={idx} className="grid grid-cols-[minmax(160px,1.8fr)_90px_minmax(110px,1fr)_110px_40px] gap-3 px-4 py-3 border-b border-slate-100 last:border-0 items-center">

                                                <div className="relative">
                                                    {item.productEdid ? (
                                                        <div className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50/80">
                                                            <div className="min-w-0">
                                                                <p className="font-semibold text-slate-800 text-sm leading-tight truncate">{item.productName}</p>
                                                                {noPricing && (
                                                                    <p className="text-[10px] text-red-600 font-bold mt-0.5 flex items-center gap-1">
                                                                        <AlertTriangle size={10} /> No pricing available for any customer type
                                                                    </p>
                                                                )}
                                                                {hasPartialConflict && (
                                                                    <p className="text-[10px] text-amber-600 font-bold mt-0.5 flex items-center gap-1">
                                                                        <AlertTriangle size={10} /> Missing: {missingTypes.join(', ')}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <Check size={14} className="text-purple-500 shrink-0 ml-2" />
                                                        </div>
                                                    ) : (
                                                        <div className="relative">
                                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                            <input
                                                                type="text"
                                                                value={searchTerms[idx] ?? ''}
                                                                onChange={(e) => handleSearchInput(idx, e.target.value)}
                                                                onFocus={() => setOpenDropdown(idx)}
                                                                placeholder="Search by name or SKU…"
                                                                className="w-full border border-purple-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-200"
                                                            />
                                                            {searchLoading[idx] && (
                                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                                            )}
                                                        </div>
                                                    )}

                                                    {openDropdown === idx && (searchResults[idx] || []).length > 0 && (
                                                        <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                            {searchResults[idx].map(prod => (
                                                                <button
                                                                    key={prod.edid || prod.id}
                                                                    type="button"
                                                                    onClick={() => selectProduct(idx, prod)}
                                                                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-purple-50 transition-colors text-left"
                                                                >
                                                                    <div>
                                                                        <p className="text-sm font-semibold text-slate-800">{prod.name}</p>
                                                                        <p className="text-[10px] text-slate-400 font-medium">{prod.sku} · {prod.qty || prod.unitValue} {prod.unitSymbol}</p>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {openDropdown === idx && searchTerms[idx] && !searchLoading[idx] && (searchResults[idx] || []).length === 0 && (
                                                        <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl px-3 py-3 text-xs text-slate-400 text-center">
                                                            No products found
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Allowed badges */}
                                                <div className="flex flex-wrap gap-1 justify-center items-center">
                                                    {item.productEdid ? (
                                                        !item.pricingLoaded ? (
                                                            <span className="text-[10px] text-slate-400 font-medium italic">Loading...</span>
                                                        ) : itemTypes.length === 0 ? (
                                                            <span className="text-[9px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded" title="No pricing available">
                                                                NONE
                                                            </span>
                                                        ) : (
                                                            <>
                                                                {itemTypes.includes('DIRECT') && <div className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded" title="Direct">D</div>}
                                                                {itemTypes.includes('ONLINE') && <div className="text-[9px] font-bold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded" title="Online">O</div>}
                                                                {itemTypes.includes('WHOLESALE') && <div className="text-[9px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded" title="Wholesale">W</div>}
                                                            </>
                                                        )
                                                    ) : <span className="text-xs text-slate-300">—</span>}
                                                </div>

                                                <div className="flex items-center text-sm font-medium text-slate-600">
                                                    {item.productEdid ? (item.productSku || '—') : ''}
                                                </div>

                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button type="button" onClick={() => changeQty(idx, -1)} className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:border-slate-300 transition-colors cursor-pointer">
                                                        <Minus size={13} />
                                                    </button>
                                                    <span className="w-8 text-center text-sm font-bold text-slate-800 select-none">{item.qty}</span>
                                                    <button type="button" onClick={() => changeQty(idx, 1)} className="w-7 h-7 flex items-center justify-center rounded-lg border border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-400 transition-colors cursor-pointer">
                                                        <Plus size={13} />
                                                    </button>
                                                </div>

                                                <button type="button" onClick={() => removeComboItem(idx)} className="flex items-center justify-center w-8 h-8 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Customer Tiers & Pricing */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                            <div className="flex flex-row justify-between items-center mb-8 gap-4">
                                <div className="flex gap-4 items-center">
                                    <div className="bg-purple-100/60 text-purple-600 p-2.5 rounded-xl shrink-0 hidden sm:block"><Users size={24} /></div>
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900">Allowed Customer Types</h3>
                                        <p className="text-sm text-slate-500 font-medium mt-0.5 hidden sm:block">
                                            Only types supported by <span className="font-bold">all</span> selected products can be enabled.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-nowrap gap-3 shrink-0">
                                    {ALL_TYPES.map(type => {
                                        const isAllowed = allowedIntersection.includes(type);
                                        const isChecked = effectiveCustomerTypes.includes(type);
                                        const label = type === 'DIRECT' ? 'Direct' : type === 'ONLINE' ? 'Online' : 'Wholesale';
                                        return (
                                            <label
                                                key={type}
                                                title={!isAllowed ? 'One or more products do not support this customer type' : ''}
                                                className={`flex items-center gap-2 text-sm font-bold px-4 py-1.5 rounded-full transition-colors border ${!isAllowed ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400 line-through' : isChecked ? 'cursor-pointer bg-white text-purple-700 border-purple-200 shadow-sm' : 'cursor-pointer bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                            >
                                                {isChecked ? (
                                                    <div className="flex items-center justify-center w-4 h-4 rounded-full bg-purple-600 text-white shrink-0">
                                                        <Check size={12} strokeWidth={4} />
                                                    </div>
                                                ) : (
                                                    <div className="w-4 h-4 shrink-0" />
                                                )}
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    disabled={!isAllowed}
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        const newTypes = e.target.checked
                                                            ? [...productForm.allowedCustomerTypes, type]
                                                            : productForm.allowedCustomerTypes.filter(t => t !== type);
                                                        setProductForm({ ...productForm, allowedCustomerTypes: newTypes });
                                                    }}
                                                />
                                                <span className="whitespace-nowrap">{label}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {noAllowedTypes && (
                                <div className="mb-4 flex items-start gap-2 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                    <span>This combo cannot be sold to any customer type. One or more included products have no pricing set up. Remove those products or add pricing to them first.</span>
                                </div>
                            )}

                            <div className="border-t border-slate-200 pt-6">
                                <div className="flex gap-4 mb-6">
                                    <div className="text-purple-400 mt-1"><Tag size={20} /></div>
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900">Pricing</h3>
                                        <p className="text-sm text-slate-500 font-medium mt-0.5">Set MRP and combo selling rate for each customer type.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Direct */}
                                    <div className={`bg-white border-t-[3px] border-t-purple-500 border-x border-b border-slate-200 rounded-b-xl p-4 shadow-sm transition-opacity ${!isDirectEnabled ? 'opacity-70 grayscale-[50%]' : ''}`}>
                                        <div className="flex items-center gap-3 mb-5">
                                            <div className="bg-purple-100 text-purple-600 p-2 rounded-full"><User size={18} /></div>
                                            <h4 className="text-sm font-bold text-slate-800">Direct Customer</h4>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <label className={`text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1 ${!isDirectEnabled ? 'opacity-60' : ''}`}>MRP (₹) {isDirectEnabled && <span className="text-red-500">*</span>}</label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-medium">₹</div>
                                                    <input disabled={!isDirectEnabled} readOnly={validItems.length > 0} required={isDirectEnabled} type="number" min="0" value={validItems.length > 0 ? computedMrps.DIRECT : productForm.mrpDirect} onChange={(e) => setProductForm({ ...productForm, mrpDirect: e.target.value })} className={`w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-purple-500 ${!isDirectEnabled || validItems.length > 0 ? 'bg-slate-100 text-slate-500 font-bold cursor-not-allowed' : ''}`} placeholder="0.00" />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className={`text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1 ${!isDirectEnabled ? 'opacity-60' : ''}`}>Selling Rate (₹) {isDirectEnabled && <span className="text-red-500">*</span>}</label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-medium">₹</div>
                                                    <input disabled={!isDirectEnabled} required={isDirectEnabled} type="number" min="0" value={productForm.priceDirect} onChange={(e) => setProductForm({ ...productForm, priceDirect: e.target.value })} className={`w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-purple-500 ${!isDirectEnabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`} placeholder="0.00" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Online */}
                                    <div className={`bg-white border-t-[3px] border-t-teal-500 border-x border-b border-slate-200 rounded-b-xl p-4 shadow-sm transition-opacity ${!isOnlineEnabled ? 'opacity-70 grayscale-[50%]' : ''}`}>
                                        <div className="flex items-center gap-3 mb-5">
                                            <div className="bg-teal-100 text-teal-600 p-2 rounded-full"><Globe size={18} /></div>
                                            <h4 className="text-sm font-bold text-slate-800">Online Customer</h4>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <label className={`text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1 ${!isOnlineEnabled ? 'opacity-60' : ''}`}>MRP (₹) {isOnlineEnabled && <span className="text-red-500">*</span>}</label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-medium">₹</div>
                                                    <input disabled={!isOnlineEnabled} readOnly={validItems.length > 0} required={isOnlineEnabled} type="number" min="0" value={validItems.length > 0 ? computedMrps.ONLINE : productForm.mrpOnline} onChange={(e) => setProductForm({ ...productForm, mrpOnline: e.target.value })} className={`w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-teal-500 ${!isOnlineEnabled || validItems.length > 0 ? 'bg-slate-100 text-slate-500 font-bold cursor-not-allowed' : ''}`} placeholder="0.00" />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className={`text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1 ${!isOnlineEnabled ? 'opacity-60' : ''}`}>Selling Rate (₹) {isOnlineEnabled && <span className="text-red-500">*</span>}</label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-medium">₹</div>
                                                    <input disabled={!isOnlineEnabled} required={isOnlineEnabled} type="number" min="0" value={productForm.priceOnline} onChange={(e) => setProductForm({ ...productForm, priceOnline: e.target.value })} className={`w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-teal-500 ${!isOnlineEnabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`} placeholder="0.00" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Wholesale */}
                                    <div className={`bg-white border-t-[3px] border-t-indigo-500 border-x border-b border-slate-200 rounded-b-xl p-4 shadow-sm transition-opacity ${!isWholesaleEnabled ? 'opacity-70 grayscale-[50%]' : ''}`}>
                                        <div className="flex items-center gap-3 mb-5">
                                            <div className="bg-indigo-100 text-indigo-600 p-2 rounded-full"><Building2 size={18} /></div>
                                            <h4 className="text-sm font-bold text-slate-800">Wholesale Customer</h4>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <label className={`text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1 ${!isWholesaleEnabled ? 'opacity-60' : ''}`}>MRP (₹) {isWholesaleEnabled && <span className="text-red-500">*</span>}</label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-medium">₹</div>
                                                    <input disabled={!isWholesaleEnabled} readOnly={validItems.length > 0} required={isWholesaleEnabled} type="number" min="0" value={validItems.length > 0 ? computedMrps.WHOLESALE : productForm.mrpWholesale} onChange={(e) => setProductForm({ ...productForm, mrpWholesale: e.target.value })} className={`w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-indigo-500 ${!isWholesaleEnabled || validItems.length > 0 ? 'bg-slate-100 text-slate-500 font-bold cursor-not-allowed' : ''}`} placeholder="0.00" />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className={`text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1 ${!isWholesaleEnabled ? 'opacity-60' : ''}`}>Selling Rate (₹) {isWholesaleEnabled && <span className="text-red-500">*</span>}</label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-medium">₹</div>
                                                    <input disabled={!isWholesaleEnabled} required={isWholesaleEnabled} type="number" min="0" value={productForm.priceWholesale} onChange={(e) => setProductForm({ ...productForm, priceWholesale: e.target.value })} className={`w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-indigo-500 ${!isWholesaleEnabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`} placeholder="0.00" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="pt-4 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0 bg-white p-6 mt-auto z-20 rounded-b-2xl -mx-6 -mb-6">
                            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!canSave}
                                title={noAllowedTypes ? 'No customer type is available for this combo' : pendingItems.length > 0 ? 'Waiting for product pricing to load…' : ''}
                                className={`px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm ${canSave ? 'bg-purple-600 text-white hover:bg-purple-700 cursor-pointer' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                            >
                                <Save size={16} /> Save Combo Product
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}