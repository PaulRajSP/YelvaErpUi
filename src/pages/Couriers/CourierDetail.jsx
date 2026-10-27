import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Truck, Phone, Mail, MapPin, CheckCircle2, XCircle,
    Edit2, FileText, Upload, Trash2, Printer, AlertCircle,
    Plus, Loader2, ArrowLeft, Shield
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Tooltip } from '../../components/ui/Tooltip';
import { courierApi } from '../../api/courierApi';
import { commonApi } from '../../api/commonApi';

/* ─── Info Row (used in left sidebar) ───────────────────────────────────── */
const InfoRow = ({ label, value, icon: Icon }) => (
    <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            {Icon && <Icon size={13} className="text-slate-400 shrink-0" />}
            {value || <span className="text-slate-400 italic font-normal text-xs">Not specified</span>}
        </span>
    </div>
);

export default function CourierDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [courier, setCourier] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    /* ── Edit modal state ─────────────────────────────────────────────── */
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [modalError, setModalError] = useState(null);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '', contactPerson: '', mobile: '', email: '',
        address: '', isActive: true, docEdid: null, docFileName: '', metadata: []
    });

    /* ── Inline add-field state ───────────────────────────────────────── */
    const [showAddField, setShowAddField] = useState(false);
    const [newLabel, setNewLabel] = useState('');
    const [newValue, setNewValue] = useState('');
    const [newShowInSlip, setNewShowInSlip] = useState(true);
    const [addingField, setAddingField] = useState(false);

    /* ── Fetch ────────────────────────────────────────────────────────── */
    const fetchDetail = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        setError(null);
        try {
            const res = await courierApi.getCourierById(id);
            const data = res?.data || res;
            if (data) setCourier(data);
            else setError('Courier not found.');
        } catch (err) {
            console.error(err);
            setError(err?.message || 'Failed to load courier.');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchDetail(); }, [fetchDetail]);

    /* ── Open edit modal ──────────────────────────────────────────────── */
    const openEdit = () => {
        if (!courier) return;
        setEditForm({
            name: courier.name || '',
            contactPerson: courier.contactPerson || '',
            mobile: courier.mobile || '',
            email: courier.email || '',
            address: courier.address || '',
            isActive: courier.isActive !== false,
            docEdid: courier.docEdid || null,
            docFileName: courier.docEdid ? 'Attached Document' : '',
            metadata: (courier.metadata || []).map(m => ({
                id: m.id || 0, edid: m.edid || null,
                label: m.label || '', value: m.value || '',
                showInSlip: m.showInSlip !== false
            }))
        });
        setModalError(null);
        setIsEditOpen(true);
    };

    /* ── Save edit ────────────────────────────────────────────────────── */
    const handleSave = async (e) => {
        e.preventDefault();
        if (!editForm.name.trim()) { setModalError('Courier name is required.'); return; }
        setIsSaving(true);
        setModalError(null);
        try {
            const cleanMeta = (editForm.metadata || [])
                .filter(m => m.label?.trim() && m.value?.trim())
                .map(m => ({
                    id: m.id || 0,
                    label: m.label.trim(),
                    value: m.value.trim(),
                    showInSlip: Boolean(m.showInSlip)
                }));

            await courierApi.updateCourier(courier.edid, {
                edid: courier.edid,
                name: editForm.name.trim(),
                contactPerson: editForm.contactPerson?.trim() || null,
                mobile: editForm.mobile?.trim() || null,
                email: editForm.email?.trim() || null,
                address: editForm.address?.trim() || null,
                isActive: Boolean(editForm.isActive),
                docEdid: editForm.docEdid || null,
                metadata: cleanMeta
            });
            await fetchDetail();
            setIsEditOpen(false);
        } catch (err) {
            console.error(err);
            setModalError(err?.message || 'Failed to save changes.');
        } finally {
            setIsSaving(false);
        }
    };

    /* ── Metadata helpers in edit modal ───────────────────────────────── */
    const addMetaRow = () => setEditForm(p => ({
        ...p, metadata: [...p.metadata, { id: 0, label: '', value: '', showInSlip: true }]
    }));
    const updateMetaRow = (i, field, val) => setEditForm(p => {
        const m = [...p.metadata];
        m[i] = { ...m[i], [field]: val };
        return { ...p, metadata: m };
    });
    const removeMetaRow = (i) => setEditForm(p => ({
        ...p, metadata: p.metadata.filter((_, idx) => idx !== i)
    }));

    /* ── Document upload ──────────────────────────────────────────────── */
    const handleDocUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingDoc(true);
        try {
            const res = await commonApi.uploadAttachment(file);
            const data = res?.data || res;
            if (data?.edid) {
                setEditForm(p => ({ ...p, docEdid: data.edid, docFileName: file.name }));
            }
        } catch (err) {
            console.error(err);
            alert('Failed to upload document.');
        } finally {
            setUploadingDoc(false);
        }
    };

    /* ── Quick-add field from detail page ────────────────────────────── */
    const handleQuickAddField = async (e) => {
        e.preventDefault();
        if (!newLabel.trim() || !newValue.trim() || !courier) return;
        setAddingField(true);
        try {
            const updatedMeta = [
                ...(courier.metadata || []),
                { id: 0, label: newLabel.trim(), value: newValue.trim(), showInSlip: Boolean(newShowInSlip) }
            ];
            await courierApi.updateCourier(courier.edid, {
                edid: courier.edid, name: courier.name,
                contactPerson: courier.contactPerson, mobile: courier.mobile,
                email: courier.email, address: courier.address,
                isActive: courier.isActive, docEdid: courier.docEdid,
                metadata: updatedMeta
            });
            await fetchDetail();
            setNewLabel(''); setNewValue(''); setNewShowInSlip(true);
            setShowAddField(false);
        } catch (err) {
            console.error(err);
            alert('Failed to add field.');
        } finally {
            setAddingField(false);
        }
    };

    /* ── Delete field ─────────────────────────────────────────────────── */
    const handleDeleteField = async (idx) => {
        if (!confirm('Remove this metadata field?')) return;
        try {
            const updatedMeta = (courier.metadata || []).filter((_, i) => i !== idx);
            await courierApi.updateCourier(courier.edid, {
                edid: courier.edid, name: courier.name,
                contactPerson: courier.contactPerson, mobile: courier.mobile,
                email: courier.email, address: courier.address,
                isActive: courier.isActive, docEdid: courier.docEdid,
                metadata: updatedMeta
            });
            await fetchDetail();
        } catch (err) {
            alert('Failed to remove field.');
        }
    };

    /* ── Toggle showInSlip ────────────────────────────────────────────── */
    const handleToggleSlip = async (idx) => {
        try {
            const updatedMeta = (courier.metadata || []).map((m, i) =>
                i === idx ? { ...m, showInSlip: !m.showInSlip } : m
            );
            await courierApi.updateCourier(courier.edid, {
                edid: courier.edid, name: courier.name,
                contactPerson: courier.contactPerson, mobile: courier.mobile,
                email: courier.email, address: courier.address,
                isActive: courier.isActive, docEdid: courier.docEdid,
                metadata: updatedMeta
            });
            await fetchDetail();
        } catch (err) {
            alert('Failed to update field.');
        }
    };

    /* ── Toggle active status ─────────────────────────────────────────── */
    const handleToggleStatus = async () => {
        if (!courier) return;
        try {
            await courierApi.updateCourier(courier.edid, {
                edid: courier.edid, name: courier.name,
                isActive: !courier.isActive, metadata: courier.metadata
            });
            await fetchDetail();
        } catch (err) {
            alert('Failed to update status.');
        }
    };

    /* ── Loading / Error states ──────────────────────────────────────── */
    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-6rem)] space-y-4">
            <Truck size={48} className="text-slate-200 animate-pulse" />
            <h2 className="text-xl font-bold text-slate-400">Loading Courier...</h2>
        </div>
    );

    if (error || !courier) return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-6rem)] space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center">
                <AlertCircle size={28} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">{error || 'Courier Not Found'}</h2>
            <Button onClick={() => navigate('/couriers')}>
                <ArrowLeft size={14} /> Back to Couriers
            </Button>
        </div>
    );

    const slipFields = (courier.metadata || []).filter(m => m.showInSlip);

    return (
        <div className="space-y-6">

            {/* ── Page Header ──────────────────────────────────────────── */}
            <PageHeader
                title={
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/couriers')}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
                        >
                            <ArrowLeft size={13} /> Couriers
                        </button>
                        <span className="text-slate-300 text-sm">/</span>
                        <span className="text-slate-900 font-black text-lg">{courier.name}</span>
                    </div>
                }
                subtitle="Manage courier profile, contact details, and delivery slip metadata fields"
                rightContent={
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleToggleStatus}
                            className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                                courier.isActive
                                    ? 'text-slate-600 border-slate-200 bg-white hover:bg-slate-50'
                                    : 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                            }`}
                        >
                            {courier.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                            onClick={openEdit}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                        >
                            <Edit2 size={13} /> Edit Courier
                        </button>
                    </div>
                }
            />

            {/* ── Two-Column Layout ─────────────────────────────────────── */}
            <div className="flex gap-6 items-start">

                {/* ── LEFT: Profile sidebar ──────────────────────────── */}
                <div className="w-[320px] shrink-0 flex flex-col gap-5">

                    {/* Profile Card */}
                    <Card className="p-0 overflow-hidden bg-white border border-slate-200 rounded-2xl">

                        {/* Avatar / Name banner */}
                        <div className="p-5 border-b border-slate-100">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-2xl font-black text-indigo-600 ring-4 ring-indigo-50/60 shrink-0">
                                    {courier.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-base font-black text-slate-900 truncate">{courier.name}</h2>
                                    <span className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                        courier.isActive
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                                    }`}>
                                        {courier.isActive ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                                        {courier.isActive ? 'Active' : 'Disabled'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Contact details */}
                        <div className="p-5 space-y-4">
                            <InfoRow label="Contact Person" value={courier.contactPerson} />
                            <InfoRow label="Phone / Mobile" value={courier.mobile} icon={Phone} />
                            <InfoRow label="Email Address" value={courier.email} icon={Mail} />
                            <div className="pt-3 border-t border-slate-100">
                                <InfoRow label="Hub / Branch Address" value={courier.address} icon={MapPin} />
                            </div>
                        </div>

                        {/* Stats footer */}
                        <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center gap-4 text-xs font-semibold text-slate-500">
                            <span>
                                <strong className="text-blue-700 font-black">{slipFields.length}</strong> Slip Fields
                            </span>
                            <span className="text-slate-300">·</span>
                            <span>
                                <strong className="text-slate-700 font-black">{(courier.metadata || []).length}</strong> Total Meta
                            </span>
                        </div>
                    </Card>

                    {/* Document / Agreement Card */}
                    <Card className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <FileText size={12} className="text-indigo-500" /> Agreement / Document
                        </h4>
                        {courier.docEdid ? (
                            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                                <FileText size={18} className="text-indigo-500 shrink-0" />
                                <div className="text-xs min-w-0">
                                    <div className="font-bold text-indigo-900">Document Attached</div>
                                    <div className="text-[10px] text-indigo-500 font-mono truncate">{courier.docEdid.substring(0, 24)}…</div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-3 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 font-medium">
                                No document attached
                            </div>
                        )}
                    </Card>

                    {/* Live Delivery Slip Preview */}
                    <Card className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <Printer size={12} className="text-blue-500" /> Slip Preview
                            </h4>
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                Live
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                            Fields shown here are auto-printed on every delivery slip when this courier is assigned.
                        </p>
                        {slipFields.length === 0 ? (
                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold text-center">
                                No slip fields configured
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-[11px] border-collapse border border-slate-300 bg-white">
                                    <thead>
                                        <tr className="bg-slate-100">
                                            {slipFields.map((m, i) => (
                                                <th key={i} className="border border-slate-300 px-2 py-1.5 text-left font-black uppercase tracking-wide">
                                                    {m.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            {slipFields.map((m, i) => (
                                                <td key={i} className="border border-slate-300 px-2 py-1.5 font-mono font-bold text-slate-900">
                                                    {m.value}
                                                </td>
                                            ))}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </div>

                {/* ── RIGHT: Metadata management ─────────────────────── */}
                <div className="flex-1 min-w-0 space-y-5">

                    {/* Metadata Table Card */}
                    <Card className="bg-white border border-slate-200 rounded-2xl overflow-hidden">

                        {/* Card header */}
                        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                    Dynamic Metadata Fields
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                                        {(courier.metadata || []).length}
                                    </span>
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Configure per-courier attributes printed on delivery slips (e.g. Customer ID, Contract ID).
                                </p>
                            </div>
                            <button
                                onClick={() => setShowAddField(!showAddField)}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs self-start sm:self-auto shrink-0"
                            >
                                <Plus size={13} /> Add Field
                            </button>
                        </div>

                        {/* Inline add-field form */}
                        {showAddField && (
                            <form
                                onSubmit={handleQuickAddField}
                                className="px-5 py-3 bg-indigo-50/60 border-b border-indigo-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
                            >
                                <input
                                    type="text" required autoFocus
                                    value={newLabel}
                                    onChange={e => setNewLabel(e.target.value)}
                                    placeholder="Label (e.g. CUSTOMER ID)"
                                    className="flex-1 h-9 px-3 bg-white border border-indigo-300 focus:border-indigo-600 rounded-xl text-xs font-semibold text-slate-800 outline-none uppercase"
                                />
                                <input
                                    type="text" required
                                    value={newValue}
                                    onChange={e => setNewValue(e.target.value)}
                                    placeholder="Value (e.g. 1721476455)"
                                    className="flex-1 h-9 px-3 bg-white border border-indigo-300 focus:border-indigo-600 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                                />
                                <label className="flex items-center gap-1.5 px-3 h-9 bg-white rounded-xl border border-indigo-200 cursor-pointer shrink-0">
                                    <input
                                        type="checkbox" checked={newShowInSlip}
                                        onChange={e => setNewShowInSlip(e.target.checked)}
                                        className="w-3.5 h-3.5 rounded text-indigo-600"
                                    />
                                    <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Show in Slip</span>
                                </label>
                                <div className="flex gap-2 shrink-0">
                                    <button
                                        type="submit" disabled={addingField}
                                        className="px-4 h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        {addingField && <Loader2 size={12} className="animate-spin" />}
                                        Save
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddField(false)}
                                        className="px-3 h-9 bg-white hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold border border-slate-200 cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Metadata table */}
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">#</TableHead>
                                    <TableHead>Label</TableHead>
                                    <TableHead>Value</TableHead>
                                    <TableHead className="text-center w-36">Delivery Slip</TableHead>
                                    <TableHead className="text-right w-20">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(courier.metadata && courier.metadata.length > 0) ? (
                                    courier.metadata.map((field, idx) => (
                                        <TableRow key={field.id || idx}>
                                            <TableCell className="font-mono text-xs text-slate-400">#{idx + 1}</TableCell>
                                            <TableCell>
                                                <span className="font-black text-slate-900 text-xs tracking-wide uppercase">
                                                    {field.label}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-mono font-bold text-slate-700 text-xs bg-slate-50 px-2 py-1 rounded border border-slate-200">
                                                    {field.value}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <button
                                                    onClick={() => handleToggleSlip(idx)}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                                                        field.showInSlip
                                                            ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    <Printer size={11} className={field.showInSlip ? 'text-blue-500' : 'text-slate-400'} />
                                                    {field.showInSlip ? 'Printed' : 'Hidden'}
                                                </button>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Tooltip content="Remove Field">
                                                    <button
                                                        onClick={() => handleDeleteField(idx)}
                                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="py-16 text-center">
                                            <Printer size={28} className="mx-auto mb-2 text-slate-200" />
                                            <p className="text-xs font-bold text-slate-600">No metadata fields yet</p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">Click "Add Field" to create dynamic attributes for this courier.</p>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </div>
            </div>

            {/* ── Edit Courier Modal ────────────────────────────────────── */}
            <Modal
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                title={`Edit Courier: ${courier.name}`}
                className="max-w-3xl"
            >
                <form onSubmit={handleSave} className="space-y-5">

                    {modalError && (
                        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                            <AlertCircle size={15} className="shrink-0" />
                            <span>{modalError}</span>
                        </div>
                    )}

                    {/* General Details */}
                    <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3.5">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-600">General Details</h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div className="sm:col-span-2">
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                    Courier Service Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text" required
                                    value={editForm.name}
                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    placeholder="e.g. India Post, DTDC, Delhivery..."
                                    className="w-full h-9.5 px-3 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">Contact Person</label>
                                <input
                                    type="text"
                                    value={editForm.contactPerson}
                                    onChange={e => setEditForm({ ...editForm, contactPerson: e.target.value })}
                                    placeholder="e.g. Ramesh Kumar"
                                    className="w-full h-9.5 px-3 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">Mobile / Phone</label>
                                <input
                                    type="text"
                                    value={editForm.mobile}
                                    onChange={e => setEditForm({ ...editForm, mobile: e.target.value })}
                                    placeholder="e.g. 9876543210"
                                    className="w-full h-9.5 px-3 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">Email Address</label>
                                <input
                                    type="email"
                                    value={editForm.email}
                                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                    placeholder="e.g. support@courier.in"
                                    className="w-full h-9.5 px-3 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all"
                                />
                            </div>

                            <div className="flex flex-col justify-end">
                                <label className="flex items-center gap-2.5 h-9.5 px-3 bg-white border border-slate-200 rounded-xl cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={editForm.isActive}
                                        onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })}
                                        className="w-4 h-4 rounded text-indigo-600"
                                    />
                                    <span className="text-xs font-bold text-slate-700">Active Service Provider</span>
                                </label>
                            </div>

                            <div className="sm:col-span-2">
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">Hub / Branch Address</label>
                                <input
                                    type="text"
                                    value={editForm.address}
                                    onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                                    placeholder="e.g. Head Post Office, Broadway, Chennai - 600001"
                                    className="w-full h-9.5 px-3 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">Agreement Document / Logo</label>
                                {editForm.docEdid ? (
                                    <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs">
                                        <div className="flex items-center gap-2 text-indigo-900 font-semibold truncate">
                                            <FileText size={15} className="text-indigo-500 shrink-0" />
                                            <span className="truncate">{editForm.docFileName || 'Document Attached'}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setEditForm({ ...editForm, docEdid: null, docFileName: '' })}
                                            className="text-rose-500 hover:text-rose-700 text-xs font-bold cursor-pointer"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ) : (
                                    <label className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-white p-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors">
                                        <input type="file" accept="image/*,.pdf" onChange={handleDocUpload} className="hidden" />
                                        {uploadingDoc ? (
                                            <div className="flex items-center gap-2 text-xs text-indigo-600 font-bold">
                                                <Loader2 size={14} className="animate-spin" /> Uploading...
                                            </div>
                                        ) : (
                                            <>
                                                <Upload size={15} className="text-slate-400" />
                                                <span className="text-xs font-bold text-slate-600">Attach Document / Logo</span>
                                                <span className="text-[10px] text-slate-400">(Images, PDF)</span>
                                            </>
                                        )}
                                    </label>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Dynamic Metadata */}
                    <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3.5">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                    <Printer size={13} className="text-indigo-500" />
                                    Dynamic Metadata &amp; Slip Fields
                                </h4>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                    Checked fields are printed on delivery slips automatically.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={addMetaRow}
                                className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-indigo-700 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                            >
                                <Plus size={12} /> Add Field
                            </button>
                        </div>

                        {editForm.metadata.length === 0 ? (
                            <div className="p-4 text-center border border-dashed border-slate-200 rounded-xl bg-white text-slate-400">
                                <Printer size={20} className="mx-auto mb-1 text-slate-300" />
                                <p className="text-xs font-semibold text-slate-500">No fields added.</p>
                                <p className="text-[10px] text-slate-400">Click "+ Add Field" above to create custom attributes.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {editForm.metadata.map((row, idx) => (
                                    <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                                        <input
                                            type="text"
                                            value={row.label}
                                            onChange={e => updateMetaRow(idx, 'label', e.target.value)}
                                            placeholder="Label (e.g. CUSTOMER ID)"
                                            className="flex-1 h-8.5 px-3 bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg text-xs font-semibold text-slate-800 outline-none uppercase"
                                        />
                                        <input
                                            type="text"
                                            value={row.value}
                                            onChange={e => updateMetaRow(idx, 'value', e.target.value)}
                                            placeholder="Value"
                                            className="flex-1 h-8.5 px-3 bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg text-xs font-semibold text-slate-800 outline-none"
                                        />
                                        <label className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer select-none shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={row.showInSlip}
                                                onChange={e => updateMetaRow(idx, 'showInSlip', e.target.checked)}
                                                className="w-3.5 h-3.5 rounded text-indigo-600"
                                            />
                                            <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap">Show in Slip</span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => removeMetaRow(idx)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer shrink-0"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={() => setIsEditOpen(false)}
                            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || uploadingDoc}
                            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
                        >
                            {isSaving && <Loader2 size={13} className="animate-spin" />}
                            Update Courier
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
