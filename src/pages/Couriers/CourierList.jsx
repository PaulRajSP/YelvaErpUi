import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, Search, Phone, Mail, FileText, Upload, Trash2,
    RefreshCw, Loader2, X, Eye, ArrowUpRight, Printer, AlertCircle,
    Edit2, Truck
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { Dropdown } from '../../components/common/Dropdown';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tooltip } from '../../components/ui/Tooltip';
import { Card } from '../../components/ui/Card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';
import { courierApi } from '../../api/courierApi';
import { commonApi } from '../../api/commonApi';
import { PAGE_SIZE } from '../../common/utils';

const STATUS_OPTIONS = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' },
];

export default function CourierList() {
    const navigate = useNavigate();

    // ── Data state ───────────────────────────────────────────────────────────
    const [couriers, setCouriers] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // ── Filter state ─────────────────────────────────────────────────────────
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ACTIVE');
    const [currentPage, setCurrentPage] = useState(1);

    // ── Request-id tracker — prevents stale responses overwriting fresh data ─
    const activeRequestId = useRef(0);

    // ── Modal state ──────────────────────────────────────────────────────────
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCourier, setEditingCourier] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [modalError, setModalError] = useState(null);

    // ── Print state ──────────────────────────────────────────────────────────
    const [printRows, setPrintRows] = useState([]);
    const [isPreparingPrint, setIsPreparingPrint] = useState(false);

    // ── Form state ───────────────────────────────────────────────────────────
    const [formData, setFormData] = useState({
        name: '', contactPerson: '', mobile: '', email: '', address: '',
        isActive: true, docEdid: null, docFileName: '', metadata: []
    });

    // ── Debounce search input ────────────────────────────────────────────────
    const isInitialSearchMount = useRef(true);
    useEffect(() => {
        if (isInitialSearchMount.current) {
            isInitialSearchMount.current = false;
            return;
        }
        const handler = setTimeout(() => setDebouncedSearch(searchTerm), 350);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // ── Reset page to 1 when filters change (skip initial mount) ────────────
    const isInitialFilterMount = useRef(true);
    useEffect(() => {
        if (isInitialFilterMount.current) {
            isInitialFilterMount.current = false;
            return;
        }
        setCurrentPage(1);
    }, [debouncedSearch, statusFilter]);

    // ── Server-side fetch ────────────────────────────────────────────────────
    const fetchCouriers = useCallback(async ({ onlyActive, searchText, pageNumber }) => {
        const reqId = ++activeRequestId.current;
        setLoading(true);
        setError(null);
        try {
            const res = await courierApi.getCouriers({
                onlyActive,
                searchText: searchText || null,
                pageNumber,
                pageSize: PAGE_SIZE,
            });
            if (reqId !== activeRequestId.current) return;   // stale — discard
            const items = res?.data?.items || res?.items || (Array.isArray(res) ? res : []);
            const count = res?.data?.totalCount ?? res?.totalCount ?? items.length;
            setCouriers(Array.isArray(items) ? items : []);
            setTotalCount(count);
        } catch (err) {
            if (reqId !== activeRequestId.current) return;
            console.error('Failed to fetch couriers:', err);
            setError('Failed to load courier list. Please verify server connection.');
        } finally {
            if (reqId === activeRequestId.current) setLoading(false);
        }
    }, []);

    // ── Auto-fetch on page / filter change ───────────────────────────────────
    useEffect(() => {
        fetchCouriers({
            onlyActive: statusFilter === 'ACTIVE',
            searchText: debouncedSearch,
            pageNumber: currentPage,
        });
    }, [currentPage, statusFilter, debouncedSearch, fetchCouriers]);

    // ── Helper: refetch current page ─────────────────────────────────────────
    const refetchCurrent = useCallback(() => {
        fetchCouriers({
            onlyActive: statusFilter === 'ACTIVE',
            searchText: debouncedSearch,
            pageNumber: currentPage,
        });
    }, [fetchCouriers, statusFilter, debouncedSearch, currentPage]);

    // ── Print full list (both Active + Inactive) ─────────────────────────────
    const handlePrintFullList = async () => {
        setIsPreparingPrint(true);
        try {
            const res = await courierApi.getCouriers({
                onlyActive: false,
                searchText: null,
            });
            const items = res?.data?.items || res?.items || (Array.isArray(res) ? res : []);
            setPrintRows(Array.isArray(items) ? items : []);
            setTimeout(() => {
                window.print();
                setTimeout(() => setPrintRows([]), 500);
            }, 80);
        } catch (err) {
            console.error('Failed to prepare print:', err);
            alert('Failed to prepare print. Please try again.');
        } finally {
            setIsPreparingPrint(false);
        }
    };

    // ── Modal handlers ───────────────────────────────────────────────────────
    const handleOpenAdd = () => {
        setEditingCourier(null);
        setFormData({
            name: '', contactPerson: '', mobile: '', email: '', address: '',
            isActive: true, docEdid: null, docFileName: '', metadata: []
        });
        setModalError(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (courier) => {
        setEditingCourier(courier);
        setFormData({
            name: courier.name || '',
            contactPerson: courier.contactPerson || '',
            mobile: courier.mobile || '',
            email: courier.email || '',
            address: courier.address || '',
            isActive: courier.isActive !== false,
            docEdid: courier.docEdid || null,
            docFileName: courier.docEdid ? 'Attached Document' : '',
            metadata: (courier.metadata || []).map(m => ({
                id: m.id || 0,
                label: m.label || '',
                value: m.value || '',
                showInSlip: m.showInSlip !== false
            }))
        });
        setModalError(null);
        setIsModalOpen(true);
    };

    const handleAddMetaRow = () => setFormData(prev => ({
        ...prev,
        metadata: [...prev.metadata, { id: 0, label: '', value: '', showInSlip: true }]
    }));

    const handleUpdateMetaRow = (index, field, value) => setFormData(prev => {
        const updated = [...prev.metadata];
        updated[index] = { ...updated[index], [field]: value };
        return { ...prev, metadata: updated };
    });

    const handleRemoveMetaRow = (index) => setFormData(prev => ({
        ...prev,
        metadata: prev.metadata.filter((_, i) => i !== index)
    }));

    const handleDocUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingDoc(true);
        try {
            const res = await commonApi.uploadAttachment(file);
            const data = res?.data || res;
            if (data?.edid) {
                setFormData(prev => ({ ...prev, docEdid: data.edid, docFileName: file.name }));
            }
        } catch (err) {
            console.error('Failed to upload document:', err);
            alert('Failed to upload document. Please try again.');
        } finally {
            setUploadingDoc(false);
        }
    };

    const handleSaveCourier = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setModalError('Courier service name is required.');
            return;
        }
        setIsSaving(true);
        setModalError(null);

        const cleanMetadata = (formData.metadata || [])
            .filter(m => m.label?.trim() && m.value?.trim())
            .map(m => ({
                id: m.id || 0,
                label: m.label.trim(),
                value: m.value.trim(),
                showInSlip: Boolean(m.showInSlip)
            }));

        const payload = {
            name: formData.name.trim(),
            contactPerson: formData.contactPerson?.trim() || null,
            mobile: formData.mobile?.trim() || null,
            email: formData.email?.trim() || null,
            address: formData.address?.trim() || null,
            isActive: Boolean(formData.isActive),
            docEdid: formData.docEdid || null,
            metadata: cleanMetadata
        };

        try {
            if (editingCourier?.edid) {
                payload.edid = editingCourier.edid;
                await courierApi.updateCourier(editingCourier.edid, payload);
            } else {
                await courierApi.addCourier(payload);
            }
            await refetchCurrent();
            setIsModalOpen(false);
        } catch (err) {
            console.error('Failed to save courier:', err);
            setModalError(err?.response?.data?.message || err?.message || 'Failed to save courier.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleActive = async (courier) => {
        try {
            await courierApi.updateCourier(courier.edid, {
                edid: courier.edid,
                name: courier.name,
                isActive: !courier.isActive,
                metadata: courier.metadata
            });
            refetchCurrent();
        } catch (err) {
            console.error('Failed to toggle status:', err);
            alert('Failed to update courier status.');
        }
    };

    // ── Pagination — totalCount & pages come from server ─────────────────────
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    // couriers already contains only the current page's rows (server does the slicing)

    const hasActiveFilters = Boolean(searchTerm);

    const handleResetFilters = () => {
        setSearchTerm('');
        setDebouncedSearch('');   // immediate — bypass debounce
        setStatusFilter('ACTIVE');
        setCurrentPage(1);
    };

    return (
        <div className="space-y-5">
            {/* ── Page Header ─────────────────────────────────────────────── */}
            <PageHeader
                title="Courier Partners"
                subtitle="Manage courier master records, attachments, and dynamic fields printed on delivery slips"
                rightContent={
                    <div className="flex items-center gap-2">

                        <button
                            type="button"
                            onClick={handleOpenAdd}
                            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                            title="Add a new courier partner"
                        >
                            <Plus size={14} />
                            <span>Add Courier</span>
                        </button>
                    </div>
                }
            />

            {/* ── Filters ─────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="w-[280px]">
                    <Input
                        actionIcon={Search}
                        placeholder="Search by courier name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <Dropdown
                    value={statusFilter}
                    onChange={(val) => setStatusFilter(val)}
                    options={STATUS_OPTIONS}
                    className="w-[160px]"
                />

                <button
                    type="button"
                    onClick={refetchCurrent}
                    className="h-10 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0"
                    title="Refresh"
                >
                    <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                </button>

                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={handleResetFilters}
                        className="h-10 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0"
                        title="Reset Filters"
                    >
                        <X size={15} />
                    </button>
                )}
            </div>

            {/* Error notice */}
            {error && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* ── Table Card ──────────────────────────────────────────────── */}
            <Card className="overflow-auto flex flex-col">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-left">Courier Partner</TableHead>
                            <TableHead className="text-left">Contact Person</TableHead>
                            <TableHead className="text-left">Mobile</TableHead>
                            <TableHead className="text-left">Email</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {couriers.map((c, i) => (
                            <TableRow key={c.edid || c.id || i}>
                                <TableCell className="whitespace-nowrap font-medium text-slate-800">
                                    {c.name || '-'}
                                </TableCell>
                                <TableCell>{c.contactPerson || '-'}</TableCell>
                                <TableCell className="font-medium">{c.mobile || '-'}</TableCell>
                                <TableCell>{c.email || '-'}</TableCell>
                                <TableCell className="text-center">
                                    <span className={`font-bold uppercase ${c.isActive ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {c.isActive ? 'ACTIVE' : 'DISABLED'}
                                    </span>
                                </TableCell>
                                <TableCell className="text-center" style={{ borderLeft: 'none' }}>
                                    <div className="flex items-center justify-center gap-1">
                                        <Tooltip content="View">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                icon={Eye}
                                                onClick={() => navigate(`/couriers/${c.edid || c.id}`)}
                                            />
                                        </Tooltip>
                                        <Tooltip content="Edit">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                icon={Edit2}
                                                onClick={() => handleOpenEdit(c)}
                                            />
                                        </Tooltip>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {couriers.length === 0 && (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={6} className="text-center text-slate-400 py-16 font-medium">
                                    No couriers found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>

                <div className="p-4 border-t border-slate-200">
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={(page) => setCurrentPage(page)}
                        totalItems={totalCount}
                        itemsPerPage={PAGE_SIZE}
                    />
                </div>
            </Card>

            {/* ── Modal ───────────────────────────────────────────────────── */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingCourier ? `Edit Courier: ${editingCourier.name}` : 'Add Courier Partner'}
                className="max-w-3xl"
            >
                <form onSubmit={handleSaveCourier} className="space-y-5">
                    {modalError && (
                        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                            <AlertCircle size={16} className="shrink-0" />
                            <span>{modalError}</span>
                        </div>
                    )}

                    <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3.5">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                            General Details
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div className="sm:col-span-2">
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                    Courier Service / Provider Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text" required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. India Post, ST Courier, Delhivery..."
                                    className="w-full h-9.5 px-3 bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">Contact Person / Key Agent</label>
                                <input
                                    type="text" value={formData.contactPerson}
                                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                                    placeholder="e.g. Ramesh Kumar"
                                    className="w-full h-9.5 px-3 bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">Contact Mobile / Phone</label>
                                <input
                                    type="text" value={formData.mobile}
                                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                                    placeholder="e.g. 9876543210"
                                    className="w-full h-9.5 px-3 bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">Support Email Address</label>
                                <input
                                    type="email" value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="e.g. support@speedpost.in"
                                    className="w-full h-9.5 px-3 bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all"
                                />
                            </div>
                            <div className="flex flex-col justify-end">
                                <label className="flex items-center gap-2.5 h-9.5 px-3 bg-white border border-slate-200 rounded-xl cursor-pointer">
                                    <input
                                        type="checkbox" checked={formData.isActive}
                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-xs font-bold text-slate-700">Active Service Provider</span>
                                </label>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">Branch / Hub Address</label>
                                <input
                                    type="text" value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="e.g. Head Post Office, Broadway, Chennai - 600001"
                                    className="w-full h-9.5 px-3 bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">Agreement Document / Logo (Optional)</label>
                                {formData.docEdid ? (
                                    <div className="flex items-center justify-between p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs">
                                        <div className="flex items-center gap-2 text-blue-900 font-semibold truncate">
                                            <FileText size={16} className="text-blue-600 shrink-0" />
                                            <span className="truncate">{formData.docFileName || 'Document Attached'}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, docEdid: null, docFileName: '' })}
                                            className="text-rose-500 hover:text-rose-700 text-xs font-bold cursor-pointer"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ) : (
                                    <label className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-white p-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors">
                                        <input type="file" accept="image/*,.pdf" onChange={handleDocUpload} className="hidden" />
                                        {uploadingDoc ? (
                                            <div className="flex items-center gap-2 text-xs text-blue-600 font-bold">
                                                <Loader2 size={15} className="animate-spin" /> Uploading attachment...
                                            </div>
                                        ) : (
                                            <>
                                                <Upload size={16} className="text-slate-400" />
                                                <span className="text-xs font-bold text-slate-700">Attach Agreement / Document</span>
                                                <span className="text-[10px] text-slate-400">(Images, PDF up to 10MB)</span>
                                            </>
                                        )}
                                    </label>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3.5">
                        {/* Fixed Header: Added items-start and gap-4 to prevent overlap */}
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                    <Printer size={14} className="text-blue-600" />
                                    Dynamic Metadata & Delivery Slip Fields
                                </h4>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Configure dynamic fields (e.g. <code>CUSTOMER ID</code>, <code>CONTRACT ID</code>).
                                    Checked fields are automatically included in the delivery slip details table.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddMetaRow}
                                /* Fixed Button: Added shrink-0 and whitespace-nowrap to prevent text wrapping and shrinking */
                                className="shrink-0 whitespace-nowrap flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-blue-700 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                            >
                                <Plus size={13} /> Add Field
                            </button>
                        </div>

                        {formData.metadata.length === 0 ? (
                            <div className="p-4 text-center border border-dashed border-slate-200 rounded-xl bg-white text-slate-400">
                                <Printer size={20} className="mx-auto mb-1 text-slate-300" />
                                <p className="text-xs font-semibold text-slate-600">No dynamic fields added yet.</p>
                                <p className="text-[10px] text-slate-400">Click "+ Add Field" to create custom attributes for this courier.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {formData.metadata.map((row, idx) => (
                                    <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                                        <div className="flex-1">
                                            <input
                                                type="text" value={row.label}
                                                onChange={(e) => handleUpdateMetaRow(idx, 'label', e.target.value)}
                                                placeholder="Label (e.g. CUSTOMER ID)"
                                                className="w-full h-8.5 px-3 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-lg text-xs font-semibold text-slate-800 outline-none uppercase"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <input
                                                type="text" value={row.value}
                                                onChange={(e) => handleUpdateMetaRow(idx, 'value', e.target.value)}
                                                placeholder="Value (e.g. 1721476455)"
                                                className="w-full h-8.5 px-3 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-lg text-xs font-semibold text-slate-800 outline-none"
                                            />
                                        </div>
                                        <label className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer select-none">
                                            <input
                                                type="checkbox" checked={row.showInSlip}
                                                onChange={(e) => handleUpdateMetaRow(idx, 'showInSlip', e.target.checked)}
                                                className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap">Show in Slip</span>
                                        </label>
                                        <button
                                            type="button" onClick={() => handleRemoveMetaRow(idx)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                            title="Delete Field"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                        <button
                            type="button" onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit" disabled={isSaving || uploadingDoc}
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
                        >
                            {isSaving && <Loader2 size={14} className="animate-spin" />}
                            {editingCourier ? 'Update Courier & Fields' : 'Create Courier Partner'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}