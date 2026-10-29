import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Plus, Trash2, Paperclip, FileText, UploadCloud, Calendar, Building2, Package, CheckCircle, Clock, ArrowLeft, Save, Info, Check } from "lucide-react";
import PageHeader from "../../components/common/PageHeader";
import { Button } from "../../components/ui/Button";
import Dropdown from "../../components/common/Dropdown";
import DatePicker from "../../components/common/DatePicker";
import BatchSelector from "../../components/common/BatchSelector";
import { useStore } from "../../context/StoreContext";
import { purchaseApi } from "../../api/purchaseApi";
import { commonApi } from "../../api/commonApi";

export default function NewPurchase() {
    const navigate = useNavigate();
    const { searchSuppliers, rawMaterials, loadRawMaterials, setRawMaterials, searchRawMaterials } = useStore();

    const [categories, setCategories] = useState([]);
    const categorySearchTimeout = useRef(null);
    const fetchCategories = async (searchName = "") => {
        try {
            const data = await purchaseApi.getCategories(searchName);
            if (data && data.items) {
                setCategories(data.items);
            }
        } catch (err) {
            console.error("Failed to load categories", err);
        }
    };

    const handleCategorySearch = (term) => {
        if (categorySearchTimeout.current) clearTimeout(categorySearchTimeout.current);
        categorySearchTimeout.current = setTimeout(() => {
            fetchCategories(term);
        }, 300);
    };

    const [unitOptions, setUnitOptions] = useState([]);
    const fetchUnits = async () => {
        try {
            const data = await purchaseApi.getUnits();
            if (data && data.items) {
                setUnitOptions(data.items.map(u => ({
                    value: u.symbol || u.edid,
                    label: u.symbol ? `${u.name} (${u.symbol})` : u.name,
                    symbol: u.symbol,
                    edid: u.edid
                })));
            }
        } catch (err) {
            console.error("Failed to load units", err);
        }
    };

    const [supplierOptions, setSupplierOptions] = useState([{ value: "", label: "-- Select Supplier --" }]);
    const [fetchedSuppliers, setFetchedSuppliers] = useState([]);
    const searchTimeout = useRef(null);

    const handleSupplierSearch = (term = "") => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        const executeSearch = async () => {
            try {
                const searchTerm = term ? term.trim() : "";
                const res = await searchSuppliers(searchTerm, searchTerm, null, 1, 20);
                const items = Array.isArray(res) ? res : (res?.items || res?.data?.items || res?.data || []);

                setFetchedSuppliers(prev => {
                    const map = new Map(prev.map(s => [s.edid || s.id, s]));
                    items.forEach(s => map.set(s.edid || s.id, s));
                    return Array.from(map.values());
                });

                const map = new Map();
                map.set("", { value: "", label: "-- Select Supplier --" });
                const seenSupplierNames = new Set();

                items.forEach(s => {
                    const id = s.edid || s.id;
                    if (id) {
                        map.set(id, { value: id, label: s.name });
                        seenSupplierNames.add((s.name || "").trim().toLowerCase());
                    }
                });

                if (formData?.supplierId && !map.has(formData.supplierId)) {
                    const cur = fetchedSuppliers.find(s => (s.edid || s.id) === formData.supplierId);
                    if (cur) {
                        const curNormName = (cur.name || "").trim().toLowerCase();
                        const matchingItem = items.find(s => (s.name || "").trim().toLowerCase() === curNormName);
                        if (matchingItem) {
                            const actualId = matchingItem.edid || matchingItem.id;
                            setFormData(prev => ({ ...prev, supplierId: actualId }));
                        } else if (!seenSupplierNames.has(curNormName)) {
                            map.set(formData.supplierId, { value: formData.supplierId, label: cur.name });
                        }
                    }
                }

                setSupplierOptions(Array.from(map.values()));
            } catch (err) {
                console.error("Failed to search suppliers:", err);
            }
        };

        if (!term) {
            executeSearch();
        } else {
            searchTimeout.current = setTimeout(executeSearch, 250);
        }
    };

    const [materialOptions, setMaterialOptions] = useState([{ value: "", label: "-- Select Material --" }]);
    const [fetchedMaterials, setFetchedMaterials] = useState([]);
    const materialsMapRef = useRef(new Map());
    const materialSearchTimeout = useRef(null);

    const registerMaterials = (items = []) => {
        items.forEach(rm => {
            const id = rm.id || rm.edid;
            if (id) {
                materialsMapRef.current.set(id, {
                    id,
                    edid: id,
                    name: rm.name,
                    category: rm.category,
                    unit: rm.unitSymbol || rm.allowedUnitSymbol || rm.unit || "kg",
                    unitSymbol: rm.unitSymbol || rm.allowedUnitSymbol || rm.unit || "kg"
                });
            }
        });
    };

    useEffect(() => {
        loadRawMaterials();
        fetchUnits();
    }, [loadRawMaterials]);

    useEffect(() => {
        if (rawMaterials && rawMaterials.length > 0) {
            registerMaterials(rawMaterials);
            setFetchedMaterials(Array.from(materialsMapRef.current.values()));
            const initialMap = new Map();
            initialMap.set("", { value: "", label: "-- Select Material --" });
            rawMaterials.forEach(rm => {
                const id = rm.id || rm.edid;
                if (id) {
                    initialMap.set(id, {
                        value: id,
                        label: rm.name + (rm.category ? " (" + rm.category + ")" : ""),
                        unit: rm.unitSymbol || rm.allowedUnitSymbol || rm.unit || "kg",
                        unitSymbol: rm.unitSymbol || rm.allowedUnitSymbol || rm.unit || "kg"
                    });
                }
            });
            setMaterialOptions(Array.from(initialMap.values()));
        }
    }, [rawMaterials]);

    const handleMaterialSearch = (term = "") => {
        if (materialSearchTimeout.current) clearTimeout(materialSearchTimeout.current);

        const executeSearch = async () => {
            try {
                const searchTerm = term ? term.trim() : "";
                const res = await searchRawMaterials(searchTerm, 1, 30);
                const items = Array.isArray(res) ? res : (res?.items || res?.data?.items || res?.data || []);
                registerMaterials(items);
                setFetchedMaterials(Array.from(materialsMapRef.current.values()));

                const map = new Map();
                map.set("", { value: "", label: "-- Select Material --" });

                items.forEach(rm => {
                    const id = rm.id || rm.edid;
                    if (id) {
                        map.set(id, {
                            value: id,
                            label: rm.name + (rm.category ? " (" + rm.category + ")" : ""),
                            unit: rm.unitSymbol || rm.allowedUnitSymbol || rm.unit || "kg",
                            unitSymbol: rm.unitSymbol || rm.allowedUnitSymbol || rm.unit || "kg"
                        });
                    }
                });

                formData.items.forEach(item => {
                    if (item.materialId && !map.has(item.materialId)) {
                        const existing = materialsMapRef.current.get(item.materialId);
                        if (existing) {
                            map.set(item.materialId, {
                                value: item.materialId,
                                label: existing.name + (existing.category ? " (" + existing.category + ")" : ""),
                                unit: existing.unitSymbol || existing.allowedUnitSymbol || existing.unit || "kg",
                                unitSymbol: existing.unitSymbol || existing.allowedUnitSymbol || existing.unit || "kg"
                            });
                        }
                    }
                });

                setMaterialOptions(Array.from(map.values()));
            } catch (err) {
                console.error("Failed to search raw materials:", err);
            }
        };

        if (!term) {
            executeSearch();
        } else {
            materialSearchTimeout.current = setTimeout(executeSearch, 250);
        }
    };

    const getRowMaterialOptions = (selectedId) => {
        if (selectedId && !materialOptions.some(o => o.value === selectedId)) {
            const existing = materialsMapRef.current.get(selectedId);
            if (existing) {
                return [
                    ...materialOptions,
                    {
                        value: selectedId,
                        label: existing.name + (existing.category ? " (" + existing.category + ")" : ""),
                        unit: existing.unitSymbol || existing.allowedUnitSymbol || existing.unit || "kg",
                        unitSymbol: existing.unitSymbol || existing.allowedUnitSymbol || existing.unit || "kg"
                    }
                ];
            }
        }
        return materialOptions;
    };

    const [formData, setFormData] = useState({
        supplierId: "",
        date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0],
        status: "PAID",
        amountPaid: "",
        initialPaymentMethod: "Cash",
        initialPaymentReference: "",
        initialPaymentRemark: "",
        items: [{ materialId: "", qty: "", unit: "", rate: "", batchEdid: "" }]
    });
    const [billAttachments, setBillAttachments] = useState([]);
    const [initialPaymentAttachments, setInitialPaymentAttachments] = useState([]);

    const [addingMaterialIndex, setAddingMaterialIndex] = useState(null);
    const [newMaterialForm, setNewMaterialForm] = useState({ name: "", category: "", unitEdid: "", minQuantity: 0, reorderLevel: 0 });
    const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
    const [newCategoryUnitEdid, setNewCategoryUnitEdid] = useState("");

    useEffect(() => {
        if (addingMaterialIndex !== null) {
            fetchCategories();
            fetchUnits();
        }
    }, [addingMaterialIndex]);


    const handleBillUpload = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length) {
            setBillAttachments(prev => [
                ...prev,
                ...files.map(file => ({ file, name: file.name, size: file.size, url: URL.createObjectURL(file), remark: "" }))
            ]);
        }
        e.target.value = "";
    };

    const handleInitialPaymentUpload = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length) {
            setInitialPaymentAttachments(prev => [
                ...prev,
                ...files.map(file => ({ file, name: file.name, size: file.size }))
            ]);
        }
        e.target.value = "";
    };


    const handleAddItem = () =>
        setFormData(prev => ({ ...prev, items: [...prev.items, { materialId: "", qty: "", unit: "", rate: "", batchEdid: "" }] }));

    const updateItem = (index, field, value) => {
        setFormData(prev => {
            const newItems = [...prev.items];
            newItems[index] = { ...newItems[index], [field]: value };
            return { ...prev, items: newItems };
        });
    };

    const updateItemMultiple = (index, updates) => {
        setFormData(prev => {
            const newItems = [...prev.items];
            newItems[index] = { ...newItems[index], ...updates };
            return { ...prev, items: newItems };
        });
    };

    const removeItem = (index) =>
        setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));

    const handleSaveNewCategoryInline = async () => {
        if (!newMaterialForm.category.trim()) return;
        try {
            await purchaseApi.addCategory(newMaterialForm.category.trim(), newCategoryUnitEdid);
            await fetchCategories();
            setIsAddingNewCategory(false);
            setNewCategoryUnitEdid("");
        } catch (err) {
            console.error("Failed to add category", err);
            alert("Error adding category");
        }
    };

    const handleSaveNewMaterial = async (e) => {
        e.preventDefault();
        if (!newMaterialForm.name.trim()) return;

        let categoryEdidToSave = "";
        let categoryNameToSave = newMaterialForm.category.trim();

        if (isAddingNewCategory && newMaterialForm.category.trim()) {
            try {
                const addCatRes = await purchaseApi.addCategory(newMaterialForm.category.trim(), newCategoryUnitEdid);
                categoryEdidToSave = addCatRes?.edid || "";
                await fetchCategories();
            } catch (err) {
                console.error("Failed to add category", err);
            }
        } else {
            const existingCat = categories.find(c => c.name === categoryNameToSave);
            if (existingCat) categoryEdidToSave = existingCat.edid;
        }

        const reqPayload = {
            name: newMaterialForm.name.trim(),
            categoryEdid: categoryEdidToSave,
            unitEdid: newMaterialForm.unitEdid,
            stock: 0,
            minQuantity: parseFloat(newMaterialForm.minQuantity) || 0,
            reorderLevel: parseFloat(newMaterialForm.reorderLevel) || 0
        };

        try {
            const apiRes = await purchaseApi.addRawMaterial(reqPayload);
            const newId = apiRes && apiRes.edid ? apiRes.edid : ("rm" + Date.now());
            const catObj = categories.find(c => c.name === categoryNameToSave || c.edid === categoryEdidToSave);
            const foundUnit = unitOptions.find(u => u.edid === reqPayload.unitEdid || u.value === reqPayload.unitEdid);
            const unitSymbol = catObj?.allowedUnitSymbol || foundUnit?.symbol || foundUnit?.value || "kg";
            const newMaterial = {
                id: newId,
                edid: newId,
                name: reqPayload.name,
                category: categoryNameToSave,
                unit: unitSymbol,
                unitSymbol: unitSymbol,
                stock: reqPayload.stock,
                minQuantity: reqPayload.minQuantity,
                reorderLevel: reqPayload.reorderLevel
            };
            materialsMapRef.current.set(newId, newMaterial);
            setRawMaterials(prev => [...(prev || []), newMaterial]);
            setFetchedMaterials(prev => [...prev, newMaterial]);
            setMaterialOptions(prev => [
                ...prev,
                {
                    value: newId,
                    label: reqPayload.name + (categoryNameToSave ? " (" + categoryNameToSave + ")" : ""),
                    unit: unitSymbol,
                    unitSymbol: unitSymbol
                }
            ]);
            updateItemMultiple(addingMaterialIndex, { materialId: newId, unit: unitSymbol });
        } catch (err) {
            console.error("Failed to add raw material via API", err);
            alert("Error adding raw material: " + err.message);
            return;
        }

        setAddingMaterialIndex(null);
        setIsAddingNewCategory(false);
        setNewCategoryUnitEdid("");
        setNewMaterialForm({ name: "", category: "", unitEdid: "", minQuantity: 0, reorderLevel: 0 });
    };

    const calculateTotal = () => formData.items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0), 0);
    const calculateTotalQty = () => formData.items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);

    const handleSubmit = async () => {
        if (!formData.supplierId) return alert("Select a supplier!");
        const hasMissingBatches = formData.items.some(i => i.materialId && !i.batchEdid);
        if (hasMissingBatches) return alert("Please select a Batch for all items!");
        const validItems = formData.items.filter(i => i.materialId && i.batchEdid && parseFloat(i.qty) > 0 && parseFloat(i.rate) > 0);
        if (validItems.length === 0) return alert("Add at least one valid item!");

        const total = calculateTotal();
        const amountPaid = parseFloat(formData.amountPaid) || 0;

        if (amountPaid > 0 && formData.initialPaymentMethod !== 'Cash') {
            if (!formData.initialPaymentReference.trim()) return alert('Payment reference is required for this payment method.');
            if (initialPaymentAttachments.length === 0) return alert('Attach payment proof for this payment method.');
        }

        let attachmentData = [];
        let initialPaymentAttachmentData = [];
        if (billAttachments.length > 0) {
            try {
                attachmentData = (await Promise.all(billAttachments.map(async attachment => {
                    const uploadRes = await commonApi.uploadAttachment(attachment.file);
                    const data = uploadRes?.data || uploadRes;
                    const attachmentEdid = data?.attachmentEdid || data?.documentEdid || data?.edid;
                    if (!attachmentEdid) return null;
                    return {
                        attachmentEdid,
                        attachmentType: 'Bill',
                        remarks: attachment.remark || ''
                    };
                }))).filter(Boolean);
            } catch (err) {
                console.error("Failed to upload bill attachment", err);
                alert("Failed to upload bill attachment: " + (err.message || "Unknown error"));
                return;
            }
        }

        if (amountPaid > 0 && initialPaymentAttachments.length > 0) {
            try {
                initialPaymentAttachmentData = (await Promise.all(initialPaymentAttachments.map(async attachment => {
                    const uploadRes = await commonApi.uploadAttachment(attachment.file);
                    const data = uploadRes?.data || uploadRes;
                    const attachmentEdid = data?.attachmentEdid || data?.documentEdid || data?.edid;
                    if (!attachmentEdid) return null;
                    return { attachmentEdid, attachmentType: 'Receipt', remarks: '' };
                }))).filter(Boolean);
            } catch (err) {
                console.error('Failed to upload initial payment proof', err);
                alert('Failed to upload payment proof: ' + (err.message || 'Unknown error'));
                return;
            }
        }

        const reqPayload = {
            purchase: {
                supplierEdid: formData.supplierId,
                date: new Date(formData.date).toISOString(),
                totalAmount: total,
                paidAmount: amountPaid,
                initialPaymentMethod: formData.initialPaymentMethod,
                initialPaymentReference: formData.initialPaymentReference.trim() || null,
                initialPaymentRemark: formData.initialPaymentRemark.trim() || null,
                initialPaymentAttachmentData,
                attachmentData: attachmentData
            },
            items: validItems.map(item => ({
                materialEdid: item.materialId,
                qty: parseFloat(item.qty),
                rate: parseFloat(item.rate),
                total: parseFloat(item.qty) * parseFloat(item.rate),
                batchEdid: item.batchEdid
            }))
        };

        try {
            const apiRes = await purchaseApi.createPurchase(reqPayload);
            if (apiRes && apiRes.success !== false) {
                // Success! Let's refresh store data or simply navigate
                // Optionally call loadPurchases() or loadBatches() if exposed from context, 
                // but since we're navigating back, we can just let the list component fetch if needed.
                navigate("/purchases");
            } else {
                alert(apiRes?.message || "Failed to create purchase");
            }
        } catch (err) {
            console.error("Failed to create purchase", err);
            alert("Error creating purchase: " + err.message);
        }
    };

    const selectedSupplier = fetchedSuppliers.find(s => (s.edid) === formData.supplierId);
    const categoryOptions = categories.map(c => ({ value: c.name, label: c.name, edid: c.edid, allowedUnitEdid: c.allowedUnitEdid, allowedUnitSymbol: c.allowedUnitSymbol }));

    const totalAmount = calculateTotal();
    const totalQty = calculateTotalQty();
    const avgRate = totalQty > 0 ? (totalAmount / totalQty).toFixed(2) : "0";

    return (
        <div className="space-y-6 pb-20">
            <PageHeader
                title="Record New Purchase"
                subtitle="Add supplier and item details to record an inventory purchase."
                rightContent={
                    <div className="flex items-center gap-3">
                        <Button variant="secondary" onClick={() => navigate("/purchases")} icon={ArrowLeft}>Cancel</Button>
                        <Button onClick={handleSubmit} icon={Save}>Save Purchase</Button>
                    </div>
                }
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* LEFT COLUMN */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Supplier */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200">
                        <h3 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-2"><Building2 size={16} className="text-blue-500" /> Supplier</h3>
                        <p className="text-xs text-slate-500 mb-4">Select the supplier for this purchase.</p>
                        <Dropdown
                            value={formData.supplierId}
                            onChange={v => setFormData(p => ({ ...p, supplierId: v }))}
                            options={supplierOptions}
                            searchable
                            onSearchChange={handleSupplierSearch}
                            onOpen={() => handleSupplierSearch("")}
                        />

                        <div className="mt-4 bg-slate-50 border border-slate-200 p-4 rounded-xl min-h-[76px] flex flex-col justify-center">
                            {selectedSupplier ? (
                                <>
                                    <p className="font-bold text-slate-900 text-sm">{selectedSupplier.name}</p>
                                    {selectedSupplier.contactName && <p className="text-xs text-slate-500 mt-0.5">{selectedSupplier.contactName}</p>}
                                </>
                            ) : (
                                <p className="text-xs text-slate-400 italic text-center">No supplier selected</p>
                            )}
                        </div>
                    </div>

                    {/* Purchase Info */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
                        <h3 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-2"><FileText size={16} className="text-indigo-500" /> Purchase Info</h3>
                        <div className="space-y-1.5 pt-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</label>
                            <DatePicker value={formData.date} onChange={v => setFormData(p => ({ ...p, date: v }))} className="w-full" />
                        </div>
                        {(() => {
                            const pendingAmount = totalAmount - (parseFloat(formData.amountPaid) || 0);
                            const isOwed = pendingAmount > 0;
                            const isOverpaid = pendingAmount < 0;
                            const isSettled = pendingAmount === 0;

                            return (
                                <div className="space-y-3 pt-2">
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount Paid (₹)</label>
                                        <input
                                            type="number" min="0" step="0.01"
                                            value={formData.amountPaid}
                                            onChange={e => setFormData(p => ({ ...p, amountPaid: e.target.value }))}
                                            className={`w-full border-2 rounded-lg px-3 py-2 text-sm focus:outline-none font-bold transition-colors ${isSettled ? "border-emerald-200 focus:border-emerald-400 bg-emerald-50/50 text-emerald-900" :
                                                "border-slate-200 focus:border-indigo-400 bg-white text-slate-900"
                                                }`}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    {parseFloat(formData.amountPaid) > 0 && (
                                        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                                            <Dropdown
                                                label="Payment Method"
                                                value={formData.initialPaymentMethod}
                                                options={['Cash', 'UPI', 'BankTransfer', 'Card', 'Cheque']}
                                                onChange={value => setFormData(p => ({ ...p, initialPaymentMethod: value }))}
                                                className="w-full"
                                            />
                                            <input
                                                type="text"
                                                value={formData.initialPaymentReference}
                                                onChange={e => setFormData(p => ({ ...p, initialPaymentReference: e.target.value }))}
                                                placeholder="Transaction / cheque reference (optional)"
                                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                                            />
                                            <input
                                                type="text"
                                                value={formData.initialPaymentRemark}
                                                onChange={e => setFormData(p => ({ ...p, initialPaymentRemark: e.target.value }))}
                                                placeholder="Payment remark (optional)"
                                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                                            />
                                            {initialPaymentAttachments.map((attachment, index) => (
                                                <div key={`${attachment.name}-${index}`} className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                                                    <span className="text-xs font-semibold text-slate-700 truncate">{attachment.name}</span>
                                                    <button type="button" onClick={() => setInitialPaymentAttachments(prev => prev.filter((_, i) => i !== index))} className="p-1 text-slate-400 hover:text-rose-600" title="Remove payment proof"><Trash2 size={14} /></button>
                                                </div>
                                            ))}
                                            <label className="flex items-center justify-center gap-2 p-2.5 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                                                <input type="file" multiple accept="image/*,.pdf" onChange={handleInitialPaymentUpload} className="hidden" />
                                                <UploadCloud size={14} className="text-slate-500" />
                                                <span className="text-xs font-semibold text-slate-600">Attach payment proof</span>
                                            </label>
                                        </div>
                                    )}
                                    <div className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${isOwed ? "bg-red-50 border-red-100" :
                                        isOverpaid ? "bg-amber-50 border-amber-100" :
                                            "bg-emerald-50 border-emerald-100"
                                        }`}>
                                        <span className={`text-xs font-bold ${isOwed ? "text-red-600" :
                                            isOverpaid ? "text-amber-600" :
                                                "text-emerald-600"
                                            }`}>{isOverpaid ? "Overpaid Amount" : "Pending Amount"}</span>
                                        <span className={`text-sm font-black ${isOwed ? "text-red-700" :
                                            isOverpaid ? "text-amber-700" :
                                                "text-emerald-700"
                                            }`}>
                                            ₹{Math.abs(pendingAmount).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Bill Attachment (Moved from right column) */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
                        <div className="mb-2">
                            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                                <FileText size={16} /> Bill (Optional)
                            </h4>
                            <p className="text-[11px] text-slate-500">Upload bills and supporting documents.</p>
                        </div>
                        <div className="space-y-2">
                            {billAttachments.map((attachment, index) => (
                                <div key={`${attachment.name}-${index}`} className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <FileText size={15} className="text-slate-500 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-slate-700 truncate">{attachment.name}</p>
                                                <p className="text-[10px] text-slate-400">{(attachment.size / 1024).toFixed(0)}KB</p>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => setBillAttachments(prev => prev.filter((_, i) => i !== index))} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Remove attachment"><Trash2 size={14} /></button>
                                    </div>
                                    <input type="text" placeholder="Remark (optional)" value={attachment.remark} onChange={e => setBillAttachments(prev => prev.map((item, i) => i === index ? { ...item, remark: e.target.value } : item))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400" />
                                </div>
                            ))}
                            <label className="flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed border-slate-200 rounded-xl py-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors group">
                                <UploadCloud size={20} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                                <div className="text-center">
                                    <span className="text-xs font-bold text-slate-700 block group-hover:text-blue-700 transition-colors">Add purchase documents</span>
                                    <span className="text-[10px] text-slate-400">PDF, JPG, PNG (Max 10MB each)</span>
                                </div>
                                <input type="file" multiple className="hidden" onChange={handleBillUpload} accept="image/*,.pdf" />
                            </label>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="lg:col-span-9 space-y-6">
                    {/* Summary */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                <FileText size={18} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 text-base">Purchase Summary</h3>
                                <p className="text-xs text-slate-500">Overview of this purchase</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-10">
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Total Items</p>
                                <p className="text-xl font-black text-slate-900">{formData.items.filter(i => i.materialId).length}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Total Amount</p>
                                <p className="text-xl font-black text-slate-900">₹{totalAmount.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Avg. Rate</p>
                                <p className="text-xl font-black text-slate-900">₹{avgRate}</p>
                            </div>
                        </div>
                    </div>

                    {/* Purchase Items */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                    <Package size={18} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-base">Purchase Items</h3>
                                    <p className="text-xs text-slate-500">Add the materials and quantities purchased.</p>
                                </div>
                            </div>
                            <button type="button" onClick={handleAddItem} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-colors cursor-pointer text-sm">
                                <Plus size={16} strokeWidth={2.5} /> Add Item
                            </button>
                        </div>

                        {/* Items Header */}
                        <div className="grid grid-cols-12 gap-3 mb-2 px-2">
                            <div className="col-span-1 text-[10px] font-bold text-slate-500 uppercase">#</div>
                            <div className="col-span-3 text-[10px] font-bold text-slate-500 uppercase">Material <span className="text-red-500">*</span></div>
                            <div className="col-span-2 text-[10px] font-bold text-slate-500 uppercase">Quantity <span className="text-red-500">*</span></div>
                            <div className="col-span-2 text-[10px] font-bold text-slate-500 uppercase">Unit</div>
                            <div className="col-span-2 text-[10px] font-bold text-slate-500 uppercase">Rate per Unit (Rs.) <span className="text-red-500">*</span></div>
                            <div className="col-span-2 text-[10px] font-bold text-slate-500 uppercase">Batch # <span className="text-red-500">*</span></div>
                        </div>

                        <div className="space-y-3">
                            {formData.items.map((item, index) => (
                                <div key={index} className="grid grid-cols-12 gap-3 items-center bg-white p-2 rounded-xl border border-slate-100 hover:border-slate-300 transition-colors">
                                    <div className="col-span-1 font-bold text-slate-700 text-sm pl-2">{index + 1}</div>
                                    <div className="col-span-3">
                                        <Dropdown
                                            searchable={true}
                                            onSearchChange={handleMaterialSearch}
                                            onOpen={() => handleMaterialSearch("")}
                                            value={item.materialId}
                                            onChange={v => {
                                                const selectedMat = materialsMapRef.current.get(v) || materialOptions.find(o => o.value === v);
                                                const unitSymbol = selectedMat?.allowedUnitSymbol || selectedMat?.unitSymbol || "";
                                                updateItemMultiple(index, { materialId: v, unit: unitSymbol });
                                            }}
                                            options={getRowMaterialOptions(item.materialId)}
                                            placeholder="-- Select Material --"
                                            onAddNew={() => setAddingMaterialIndex(index)}
                                            addNewLabel="+ Add Material"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input type="number" step="0.01" min="0" value={item.qty} onChange={e => updateItem(index, "qty", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400" placeholder="0" />
                                    </div>
                                    <div className="col-span-2">
                                        <input
                                            type="text"
                                            readOnly
                                            disabled
                                            value={item.unit || ""}
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-700 font-medium cursor-not-allowed select-none"
                                            placeholder="--"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input type="number" step="0.01" min="0" value={item.rate} onChange={e => updateItem(index, "rate", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400" placeholder="0.00" />
                                    </div>
                                    <div className="col-span-2 flex items-center gap-2">
                                        <div className="w-full">
                                            <BatchSelector
                                                materialEdid={item.materialId}
                                                value={item.batchEdid}
                                                label=""
                                                onChange={(batch) => {
                                                    if (batch) {
                                                        updateItem(index, "batchEdid", batch.edid);
                                                    } else {
                                                        updateItem(index, "batchEdid", "");
                                                    }
                                                }}
                                            />
                                        </div>
                                        {formData.items.length > 1 ? (
                                            <button type="button" onClick={() => removeItem(index)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0 transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        ) : (
                                            <div className="w-8 shrink-0"></div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>


                </div>
            </div>

            {/* Add Material Modal */}
            {addingMaterialIndex !== null && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md">
                        <div className="flex justify-between items-center p-5 border-b border-slate-200">
                            <h2 className="text-sm font-bold text-slate-900">Add New Material</h2>
                            <button onClick={() => setAddingMaterialIndex(null)} className="text-slate-400 hover:text-slate-600 p-1"><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSaveNewMaterial} className="p-5 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Material Name</label>
                                <input autoFocus required value={newMaterialForm.name} onChange={e => setNewMaterialForm(p => ({ ...p, name: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" placeholder="e.g., Premium Labels" />
                            </div>
                            <div className={isAddingNewCategory ? "" : "space-y-1.5"}>
                                {!isAddingNewCategory && <label className="text-[10px] font-bold text-slate-500 uppercase">Category</label>}
                                {isAddingNewCategory ? (
                                    <div className="flex gap-2 items-end">
                                        <div className="flex-1 space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Category Name</label>
                                            <input autoFocus required value={newMaterialForm.category} onChange={e => setNewMaterialForm(p => ({ ...p, category: e.target.value.toUpperCase().replace(/\s+/g, "_") }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" placeholder="e.g., EQUIPMENT" />
                                        </div>
                                        <div className="w-40 space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Allowed Unit</label>
                                            <Dropdown searchable={true} value={newCategoryUnitEdid} onChange={v => setNewCategoryUnitEdid(v)} options={unitOptions} />
                                        </div>
                                        <button type="button" onClick={handleSaveNewCategoryInline} className="p-2 mb-[1px] text-green-500 hover:text-green-700 hover:bg-green-50 border border-slate-200 rounded-lg transition-colors h-[38px]"><Check size={16} /></button>
                                        <button type="button" onClick={() => { setIsAddingNewCategory(false); setNewCategoryUnitEdid(""); setNewMaterialForm(p => ({ ...p, category: "" })); }} className="p-2 mb-[1px] text-slate-400 hover:text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors h-[38px]"><X size={16} /></button>
                                    </div>
                                ) : (
                                    <Dropdown searchable={true} onSearchChange={handleCategorySearch} value={newMaterialForm.category} onChange={v => {
                                        const cat = categoryOptions.find(c => c.value === v);
                                        setNewMaterialForm(p => ({ ...p, category: v, unitEdid: cat?.allowedUnitEdid || "" }));
                                    }} onAddNew={() => { setNewMaterialForm(p => ({ ...p, category: "" })); setIsAddingNewCategory(true); }} addNewLabel="+ Add New Category" options={categoryOptions} />
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Unit</label>
                                    <Dropdown
                                        searchable={true}
                                        value={newMaterialForm.unitEdid}
                                        onChange={v => setNewMaterialForm(p => ({ ...p, unitEdid: v }))}
                                        options={[
                                            ...unitOptions,
                                            ...(newMaterialForm.unitEdid && !unitOptions.find(u => u.value === newMaterialForm.unitEdid)
                                                ? [{ value: newMaterialForm.unitEdid, label: categoryOptions.find(c => c.value === newMaterialForm.category)?.allowedUnitSymbol || newMaterialForm.unitEdid }]
                                                : [])
                                        ]}
                                        disabled={true}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                        Min Quantity
                                        <div className="group relative flex items-center">
                                            <Info size={12} className="text-blue-400 cursor-help" />
                                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:block w-48 bg-slate-800 text-white text-[10px] p-2 rounded-lg z-10 shadow-lg font-normal normal-case">
                                                Minimum quantity you want to maintain before considering stock low.
                                            </div>
                                        </div>
                                    </label>
                                    <input type="number" step="0.1" min="0" required value={newMaterialForm.minQuantity} onChange={e => setNewMaterialForm(p => ({ ...p, minQuantity: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                        Reorder Level
                                        <div className="group relative flex items-center">
                                            <Info size={12} className="text-blue-400 cursor-help" />
                                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:block w-48 bg-slate-800 text-white text-[10px] p-2 rounded-lg z-10 shadow-lg font-normal normal-case">
                                                Quantity level at which the system should alert/recommend purchasing more stock.
                                            </div>
                                        </div>
                                    </label>
                                    <input type="number" step="0.1" min="0" required value={newMaterialForm.reorderLevel} onChange={e => setNewMaterialForm(p => ({ ...p, reorderLevel: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                                <button type="button" onClick={() => setAddingMaterialIndex(null)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                                <button type="submit" className="px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Material</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
