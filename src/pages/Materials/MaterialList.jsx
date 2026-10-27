import { PAGE_SIZE } from '../../common/utils';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import { Search, Package, Plus, AlertCircle, Eye, Trash2, Loader2, Info, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Dropdown from '../../components/common/Dropdown';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';
import { InfoTooltip } from '../../components/ui/Tooltip';
import { purchaseApi } from '../../api/purchaseApi';
import { productApi } from '../../api/productApi';
import { commonApi } from '../../api/commonApi';
import { apiFetch, API_BASE } from '../../services/apiClient';

export default function Materials() {
    const { currentUser } = useStore();
    const isAdmin = currentUser?.role === 'Admin';
    const navigate = useNavigate();

    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [page, setPage] = useState(1);

    const [materials, setMaterials] = useState([]);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [extraCategories, setExtraCategories] = useState([]);

    const statuses = ['All', 'In Stock', 'Low Stock', 'Out of Stock'];

    const categoriesLoadedRef = useRef(false);
    const inFlightMaterialsRef = useRef(false);
    const lastFetchKeyRef = useRef(null);

    // Derive categories from loaded materials; load additional options on demand when user clicks dropdown
    const categories = useMemo(() => {
        const cats = new Set();
        materials.forEach(m => {
            if (m.category) cats.add(m.category);
        });
        extraCategories.forEach(c => cats.add(c));
        return ['All', ...Array.from(cats)];
    }, [materials, extraCategories]);

    const handleOpenCategoryDropdown = () => {
        if (categoriesLoadedRef.current) return;
        categoriesLoadedRef.current = true;
        productApi.getRawMaterialCategories(1, 100).then(res => {
            const catItems = res?.data?.items || res?.items || [];
            setExtraCategories(catItems.map(c => c.name || c.categoryName || c.category).filter(Boolean));
        }).catch(err => console.error(err));
    };

    const activeRequestId = useRef(0);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm), 350);
        return () => clearTimeout(t);
    }, [searchTerm]);

    // Reset page to 1 whenever filters or search query change
    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, categoryFilter, statusFilter]);

    // Fetch Materials in background without UI disruption
    useEffect(() => {
        const reqId = ++activeRequestId.current;
        const search = debouncedSearch.trim() || null;
        const cat = categoryFilter !== 'All' ? categoryFilter : null;
        const stat = statusFilter !== 'All' ? statusFilter : null;

        setIsLoading(true);

        purchaseApi.getRawMaterials(page, PAGE_SIZE, search, cat, stat)
            .then(res => {
                if (reqId !== activeRequestId.current) return;
                const data = res?.data || res;
                const newItems = data?.items || [];
                const newTotalPages = data?.totalPages || 1;
                const newTotalItems = data?.totalCount || 0;

                setMaterials(prev => {
                    if (JSON.stringify(prev) === JSON.stringify(newItems)) return prev;
                    return newItems;
                });
                setTotalPages(prev => prev === newTotalPages ? prev : newTotalPages);
                setTotalItems(prev => prev === newTotalItems ? prev : newTotalItems);
            })
            .catch(err => console.error(err))
            .finally(() => {
                if (reqId === activeRequestId.current) {
                    setIsLoading(false);
                }
            });
    }, [page, debouncedSearch, categoryFilter, statusFilter]);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [rawCategories, setRawCategories] = useState([]);
    const [units, setUnits] = useState([]);
    const [isSavingMaterial, setIsSavingMaterial] = useState(false);
    const [newMaterialForm, setNewMaterialForm] = useState({
        name: '',
        categoryEdid: '',
        unitEdid: '',
        minQuantity: 0,
        reorderLevel: 0
    });

    const categorySearchTimeout = useRef(null);
    const handleCategorySearch = (term) => {
        if (categorySearchTimeout.current) clearTimeout(categorySearchTimeout.current);
        categorySearchTimeout.current = setTimeout(async () => {
            try {
                const res = await purchaseApi.getCategories(term);
                const items = res?.items || [];
                setRawCategories(prev => {
                    const selected = prev.find(c => c.edid === newMaterialForm.categoryEdid);
                    if (selected && !items.some(i => i.edid === selected.edid)) {
                        return [selected, ...items];
                    }
                    return items;
                });
            } catch (err) {
                console.error('Failed to search categories', err);
            }
        }, 300);
    };

    const loadCategoryAndUnitOptions = async () => {
        try {
            const [catRes, unitRes] = await Promise.all([
                purchaseApi.getCategories(''),
                purchaseApi.getUnits()
            ]);
            if (catRes?.items) setRawCategories(catRes.items);
            if (unitRes?.items) setUnits(unitRes.items);
        } catch (err) {
            console.error('Failed to load category/unit options', err);
        }
    };

    const openAddModal = () => {
        loadCategoryAndUnitOptions();
        setNewMaterialForm({
            name: '',
            categoryEdid: '',
            unitEdid: '',
            minQuantity: 0,
            reorderLevel: 0
        });
        setIsAddModalOpen(true);
    };

    const handleSaveMaterial = async (e) => {
        e.preventDefault();
        if (!newMaterialForm.name.trim()) return alert('Material name is required.');
        if (!newMaterialForm.categoryEdid) return alert('Category is required.');
        if (!newMaterialForm.unitEdid) return alert('Unit is required.');

        setIsSavingMaterial(true);
        try {
            const payload = {
                name: newMaterialForm.name.trim(),
                categoryEdid: newMaterialForm.categoryEdid,
                unitEdid: newMaterialForm.unitEdid,
                stock: 0,
                minQuantity: parseFloat(newMaterialForm.minQuantity) || 0,
                reorderLevel: parseFloat(newMaterialForm.reorderLevel) || 0
            };
            const res = await purchaseApi.addRawMaterial(payload);
            if (res && res.edid) {
                setIsAddModalOpen(false);
                // Refresh materials list
                const cat = categoryFilter !== 'All' ? categoryFilter : null;
                const stat = statusFilter !== 'All' ? statusFilter : null;
                purchaseApi.getRawMaterials(page, PAGE_SIZE, debouncedSearch.trim() || null, cat, stat)
                    .then(r => {
                        const d = r?.data || r;
                        setMaterials(d?.items || []);
                        setTotalPages(d?.totalPages || 1);
                        setTotalItems(d?.totalCount || 0);
                    });
            } else {
                alert('Could not save raw material');
            }
        } catch (err) {
            console.error('Failed to add raw material:', err);
            alert('Failed to save raw material: ' + err.message);
        } finally {
            setIsSavingMaterial(false);
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <PageHeader
                title="Raw Materials"
                subtitle="Manage your raw material inventory and batches"
                rightContent={
                    isAdmin && (
                        <button
                            onClick={openAddModal}
                            className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-colors cursor-pointer w-fit text-sm "
                        >
                            <Plus size={16} strokeWidth={2.5} /> Add Material
                        </button>
                    )
                }
            />

            {/* Filters */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-4 flex-1">
                    <div className="relative h-10 w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search materials..."
                            className="w-full h-full pl-9 pr-10 bg-white border border-slate-200 rounded-lg outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-slate-400"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        {isLoading && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" size={16} />
                        )}
                    </div>
                    <div className="w-[180px]">
                        <Dropdown
                            value={categoryFilter}
                            onChange={(v) => setCategoryFilter(v)}
                            onOpen={handleOpenCategoryDropdown}
                            options={categories}
                            placeholder="Filter by Category"
                        />
                    </div>
                    <div className="w-[180px]">
                        <Dropdown
                            value={statusFilter}
                            onChange={(v) => setStatusFilter(v)}
                            options={statuses}
                            placeholder="Filter by Status"
                        />
                    </div>
                    {(searchTerm || (categoryFilter && categoryFilter !== 'All') || (statusFilter && statusFilter !== 'All')) && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchTerm('');
                                setDebouncedSearch('');
                                setCategoryFilter('All');
                                setStatusFilter('All');
                                setPage(1);
                            }}
                            className="h-10 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0"
                            title="Reset Filters"
                        >
                            <X size={15} />
                        </button>
                    )}
                </div>
            </div>

            <Card className="flex flex-col">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-left">Material</TableHead>
                                <TableHead className="text-left">Category</TableHead>
                                <TableHead className="text-right">Remaining Stock</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="text-center">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {materials.length > 0 ? (
                                materials.map((rm) => (
                                    <TableRow
                                        key={rm.id || rm.edid}
                                        className="cursor-pointer hover:bg-slate-50/60 transition-colors"
                                        onClick={() => navigate(`/materials/${rm.id || rm.edid}`)}
                                    >
                                        <TableCell className="text-sm font-semibold text-slate-800">
                                            {rm.name}
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-slate-600">{rm.category}</span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className="text-sm font-medium text-slate-900">{rm.stock} <span className="text-[10px] text-slate-900 font-bold ml-1">{rm.allowedUnitSymbol}</span></span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {rm.stock <= 0 ? (
                                                <span className="font-bold uppercase text-red-600">Out of Stock</span>
                                            ) : rm.stock <= rm.reorderLevel ? (
                                                <span className="font-bold uppercase text-amber-600">Low Stock</span>
                                            ) : (
                                                <span className="font-bold uppercase text-emerald-600">In Stock</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center" style={{ borderLeft: 'none' }} onClick={(e) => e.stopPropagation()}>
                                            <div className="flex justify-center items-center gap-1">
                                                <Button variant="ghost" size="icon" icon={Eye} onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/materials/${rm.id || rm.edid}`);
                                                }} />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-16 text-slate-400 font-medium">
                                        No materials found matching your filters.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                <div className="border-t border-slate-200 mt-auto shrink-0 bg-white rounded-b-xl">
                    <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        onPageChange={setPage}
                        totalItems={totalItems}
                        itemsPerPage={PAGE_SIZE}
                    />
                </div>
            </Card>

            {/* Add Raw Material Modal */}
            <Modal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                title="Add Raw Material"
                className="max-w-lg"
                bodyClassName="overflow-visible"
            >
                <form onSubmit={handleSaveMaterial} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Material Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            required
                            type="text"
                            placeholder="e.g., Raw Forest Honey, Glass Bottle 500g"
                            value={newMaterialForm.name}
                            onChange={e => setNewMaterialForm(p => ({ ...p, name: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-slate-400"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Category <span className="text-red-500">*</span>
                            </label>
                            <Dropdown
                                searchable={true}
                                onSearchChange={handleCategorySearch}
                                value={newMaterialForm.categoryEdid}
                                onChange={val => {
                                    const cat = rawCategories.find(c => c.edid === val);
                                    setNewMaterialForm(p => ({
                                        ...p,
                                        categoryEdid: val,
                                        unitEdid: cat?.allowedUnitEdid || ''
                                    }));
                                }}
                                options={rawCategories.map(c => ({ value: c.edid, label: c.name }))}
                                placeholder="-- Select Category --"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Unit <span className="text-red-500">*</span>
                            </label>
                            {(() => {
                                const selectedCat = rawCategories.find(c => c.edid === newMaterialForm.categoryEdid);
                                const unitOptions = [
                                    ...units.map(u => ({ value: u.edid, label: `${u.name} (${u.symbol})` })),
                                    ...(newMaterialForm.unitEdid && !units.some(u => u.edid === newMaterialForm.unitEdid)
                                        ? [{ value: newMaterialForm.unitEdid, label: selectedCat?.allowedUnitSymbol || newMaterialForm.unitEdid }]
                                        : [])
                                ];
                                return (
                                    <Dropdown
                                        value={newMaterialForm.unitEdid}
                                        onChange={val => setNewMaterialForm(p => ({ ...p, unitEdid: val }))}
                                        options={unitOptions}
                                        placeholder={newMaterialForm.categoryEdid ? "-- Select Unit --" : "-- Select Category First --"}
                                        disabled={true}
                                    />
                                );
                            })()}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <span>Min Quantity</span>
                                <InfoTooltip content="The minimum stock quantity you want to maintain as a safety buffer." />
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={newMaterialForm.minQuantity}
                                onChange={e => setNewMaterialForm(p => ({ ...p, minQuantity: e.target.value }))}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-slate-400"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <span>Reorder Level</span>
                                <InfoTooltip content="The stock level at which you should start purchasing more material." />
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={newMaterialForm.reorderLevel}
                                onChange={e => setNewMaterialForm(p => ({ ...p, reorderLevel: e.target.value }))}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-slate-400"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <Button variant="ghost" type="button" onClick={() => setIsAddModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSavingMaterial}>
                            {isSavingMaterial ? 'Saving...' : 'Save Material'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
