import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    Truck, Phone, Mail, MapPin, CheckCircle2, XCircle,
    Edit2, FileText, Upload, Trash2, Printer, AlertCircle,
    Plus, Loader2, ArrowLeft, Eye
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Tooltip, CompoundTooltip } from '../../components/ui/Tooltip'; // Added CompoundTooltip here
import { Dropdown } from '../../components/common/Dropdown';
import DocumentViewModal from '../../components/common/DocumentViewModal';
import { API_BASE } from '../../services/apiClient';
import { courierApi } from '../../api/courierApi';
import { commonApi } from '../../api/commonApi';

/* ─── Info Row ─────────────────────────────────────────────────────────── */
const InfoRow = ({ label, value, icon: Icon }) => (
    <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            {Icon && <Icon size={13} className="text-slate-400 shrink-0" />}
            {value || <span className="text-slate-400 italic font-normal text-xs">Not specified</span>}
        </span>
    </div>
);

/* ─── Normalizers & Payload Helpers ────────────────────────────────────── */
const FALLBACK_ATTACHMENT_TYPES = [
    { value: 'Agreement', label: 'Agreement' },
    { value: 'Receipt', label: 'Receipt' },
    { value: 'Other', label: 'Other' },
];

const normalizeMetadata = (raw) => {
    if (!Array.isArray(raw)) return [];
    return raw.map((m) => ({
        courierMasterId: Number(m?.courierMasterId) || 0,
        label: m?.label ?? '',
        value: m?.value ?? '',
        showInSlip: m?.showInSlip !== false,
    }));
};

const normalizeAttachments = (courier) => {
    const raw = courier?.attachmentData || courier?.attachments;
    const items = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    if (items.length === 0 && courier?.documentEdid) {
        items.push({ attachmentEdid: courier.documentEdid, attachmentOriginalName: courier.documentOriginalName });
    }
    return items.map(att => {
        const attachmentOriginalName = att.attachmentOriginalName || att.documentOriginalName || '';
        return {
            attachmentEdid: att.attachmentEdid || att.documentEdid || '',
            attachmentOriginalName,
            attachmentType: att.attachmentType || 'Other',
            remarks: att.remarks || att.remark || ''
        };
    }).filter(att => att.attachmentEdid);
};

const buildAttachmentPayload = (attachments) => {
    const list = Array.isArray(attachments) ? attachments : (attachments ? [attachments] : []);
    return list
        .filter(att => att && att.attachmentEdid)
        .map(({ attachmentEdid, attachmentType, remarks }) => ({
            attachmentEdid,
            attachmentType: attachmentType || 'Other',
            remarks: remarks || ''
        }));
};

export default function CourierDetail() {
    const { edid: paramEdid, courierName: paramCourierName, id: paramId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [attachmentTypes, setAttachmentTypes] = useState(FALLBACK_ATTACHMENT_TYPES);

    const effectiveEdid = paramEdid || paramId;
    const initialCourier = location.state?.courier || null;

    const [courier, setCourier] = useState(initialCourier);
    const [loading, setLoading] = useState(!initialCourier);
    const [error, setError] = useState(null);
    const [viewDoc, setViewDoc] = useState(null);
    const [savingAction, setSavingAction] = useState(false);

    /* ── Edit modal state ─────────────────────────────────────────────── */
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [modalError, setModalError] = useState(null);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '',
        contactPerson: '',
        mobile: '',
        email: '',
        address: '',
        isActive: true,
        attachments: [],
        metadata: []
    });

    useEffect(() => {
        commonApi.getTypes('CourierAttachmentType')
            .then(res => {
                const items = res?.items || res?.data?.items || [];
                if (items.length) {
                    setAttachmentTypes(items.map(it => typeof it === 'string' ? { value: it, label: it } : it));
                }
            })
            .catch(err => console.warn('Could not load courier document types:', err));
    }, []);

    /* ── Inline add-field state ───────────────────────────────────────── */
    const [showAddField, setShowAddField] = useState(false);
    const [newLabel, setNewLabel] = useState('');
    const [newValue, setNewValue] = useState('');
    const [newShowInSlip, setNewShowInSlip] = useState(true);

    /* ── Fetch Detail ──────────── */
    const fetchDetail = useCallback(async () => {
        if (!effectiveEdid) {
            setError('Courier ID is missing.');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            let nameToUse = paramCourierName
                ? decodeURIComponent(paramCourierName)
                : (courier?.name || location.state?.courier?.name || '');

            if (!nameToUse) {
                try {
                    const listRes = await courierApi.getCouriers({ onlyActive: false, searchText: '', pageSize: 200 });
                    const items = listRes?.items || listRes?.data?.items || (Array.isArray(listRes) ? listRes : []);
                    const found = items.find(c => c.edid === effectiveEdid || c.id === effectiveEdid);
                    if (found?.name) nameToUse = found.name;
                } catch (listErr) {
                    console.warn('Could not resolve courier name from list:', listErr);
                }
            }

            const res = await courierApi.getCourier(effectiveEdid, nameToUse);
            const data = res?.data || res;
            if (data && (data.edid || data.name)) {
                let fetchedAttachments = [];
                try {
                    const attRes = await commonApi.getModuleAttachment('Courier', effectiveEdid);
                    const attItems = attRes?.items || attRes?.data?.items || (Array.isArray(attRes) ? attRes : []);
                    if (attItems.length > 0) {
                        fetchedAttachments = attItems.map(item => ({
                            attachmentEdid: item.attachmentEdid,
                            attachmentOriginalName: item.attachmentOriginalName || 'Attached Document',
                            attachmentType: item.attachmentType || 'Other',
                            remarks: item.remarks || ''
                        }));
                    }
                } catch (attErr) {
                    console.warn('Could not load courier attachment:', attErr);
                }

                setCourier({
                    ...data,
                    metadata: normalizeMetadata(data.metadata),
                    attachmentData: fetchedAttachments.length ? fetchedAttachments : normalizeAttachments(data),
                });
            } else {
                setError('Courier not found.');
            }
        } catch (err) {
            console.error('Failed to load courier detail:', err);
            setError(err?.message || 'Failed to load courier.');
        } finally {
            setLoading(false);
        }
    }, [effectiveEdid, paramCourierName]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

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
            attachments: normalizeAttachments(courier),
            metadata: normalizeMetadata(courier.metadata).map(m => ({
                courierMasterId: m.courierMasterId || 0,
                label: m.label || '',
                value: m.value || '',
                showInSlip: m.showInSlip !== false
            }))
        });
        setModalError(null);
        setIsEditOpen(true);
    };

    /* ── Save edit ────────────────────────────────────────────── */
    const handleSave = async (e) => {
        e.preventDefault();
        if (!editForm.name.trim()) {
            setModalError('Courier name is required.');
            return;
        }
        setIsSaving(true);
        setModalError(null);

        try {
            const cleanMeta = (editForm.metadata || [])
                .filter(m => (m.label && m.label.trim()) || (m.value && m.value.trim()))
                .map(m => ({
                    courierMasterId: Number(m.courierMasterId) || 0,
                    label: (m.label || '').trim(),
                    value: (m.value || '').trim(),
                    showInSlip: Boolean(m.showInSlip)
                }));

            const attachmentData = buildAttachmentPayload(editForm.attachments);

            const payload = {
                edid: effectiveEdid,
                name: editForm.name.trim(),
                contactPerson: editForm.contactPerson?.trim() || null,
                mobile: editForm.mobile?.trim() || null,
                email: editForm.email?.trim() || null,
                address: editForm.address?.trim() || null,
                isActive: Boolean(editForm.isActive),
                attachmentData,
                metadata: cleanMeta
            };

            const routeCourierName = courier?.name || paramCourierName || editForm.name.trim();
            await courierApi.updateCourier(effectiveEdid, routeCourierName, payload);
            setIsEditOpen(false);

            if (editForm.name.trim() !== courier?.name) {
                navigate(`/couriers/${encodeURIComponent(effectiveEdid)}/${encodeURIComponent(editForm.name.trim())}`, {
                    replace: true,
                    state: { courier: { ...courier, ...payload } }
                });
            } else {
                await fetchDetail();
            }
        } catch (err) {
            console.error('Failed to save courier:', err);
            setModalError(err?.message || 'Failed to save changes.');
        } finally {
            setIsSaving(false);
        }
    };

    /* ── Metadata helpers ───────────────────────────────── */
    const addMetaRow = () => setEditForm(p => ({
        ...p,
        metadata: [...p.metadata, { courierMasterId: 0, label: '', value: '', showInSlip: true }]
    }));

    const updateMetaRow = (i, field, val) => setEditForm(p => {
        const m = [...p.metadata];
        m[i] = { ...m[i], [field]: val };
        return { ...p, metadata: m };
    });

    const removeMetaRow = (i) => setEditForm(p => ({
        ...p,
        metadata: p.metadata.filter((_, idx) => idx !== i)
    }));

    /* ── Document upload ──────────────────────────────────────────────── */
    const handleDocUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        setUploadingDoc(true);
        try {
            const uploaded = await Promise.all(files.map(async file => {
                const res = await commonApi.uploadAttachment(file);
                const data = res?.data || res;
                const attachmentEdid = data?.documentEdid || data?.edid || data?.attachmentEdid;
                if (!attachmentEdid) return null;
                return {
                    attachmentEdid,
                    attachmentOriginalName: data?.documentOriginalName || data?.documentOrginalName || file.name,
                    attachmentType: 'Other',
                    remarks: ''
                };
            }));
            setEditForm(prev => ({ ...prev, attachments: [...prev.attachments, ...uploaded.filter(Boolean)] }));
        } catch (err) {
            console.error('Failed to upload document:', err);
            alert('Failed to upload document.');
        } finally {
            setUploadingDoc(false);
            e.target.value = '';
        }
    };

    /* ── Shared update helper ─────────────────── */
    const persistMetadata = async (nextMetadata) => {
        if (!courier) return;
        setSavingAction(true);
        try {
            const cleanMeta = nextMetadata
                .filter(m => (m.label && m.label.trim()) || (m.value && m.value.trim()))
                .map(m => ({
                    courierMasterId: Number(m.courierMasterId) || 0,
                    label: (m.label || '').trim(),
                    value: (m.value || '').trim(),
                    showInSlip: Boolean(m.showInSlip)
                }));

            const attachmentData = buildAttachmentPayload(normalizeAttachments(courier));

            const payload = {
                edid: effectiveEdid,
                name: courier.name,
                contactPerson: courier.contactPerson || null,
                mobile: courier.mobile || null,
                email: courier.email || null,
                address: courier.address || null,
                isActive: courier.isActive !== false,
                attachmentData,
                metadata: cleanMeta
            };

            await courierApi.updateCourier(effectiveEdid, courier.name, payload);
            await fetchDetail();
        } catch (err) {
            console.error(err);
            alert(err?.message || 'Failed to update metadata.');
        } finally {
            setSavingAction(false);
        }
    };

    /* ── Quick-add field ────────────────────────────── */
    const handleQuickAddField = async (e) => {
        e.preventDefault();
        if (!newLabel.trim() || !newValue.trim() || !courier) return;
        const nextMeta = [
            ...normalizeMetadata(courier.metadata),
            { courierMasterId: 0, label: newLabel.trim(), value: newValue.trim(), showInSlip: Boolean(newShowInSlip) }
        ];
        await persistMetadata(nextMeta);
        setNewLabel('');
        setNewValue('');
        setNewShowInSlip(true);
        setShowAddField(false);
    };

    /* ── Delete field ─────────────────────────────────────────────────── */
    const handleDeleteField = async (idx) => {
        if (!confirm('Remove this metadata field?')) return;
        const nextMeta = normalizeMetadata(courier.metadata).filter((_, i) => i !== idx);
        await persistMetadata(nextMeta);
    };

    /* ── Toggle showInSlip ────────────────────────────────────────────── */
    const handleToggleSlip = async (idx) => {
        const nextMeta = normalizeMetadata(courier.metadata).map((m, i) =>
            i === idx ? { ...m, showInSlip: !m.showInSlip } : m
        );
        await persistMetadata(nextMeta);
    };

    /* ── Toggle active status ─────────────────────────────────────────── */
    const handleToggleStatus = async () => {
        if (!courier) return;
        setSavingAction(true);
        try {
            const attachmentData = buildAttachmentPayload(normalizeAttachments(courier));

            const cleanMeta = normalizeMetadata(courier.metadata).map(m => ({
                courierMasterId: Number(m.courierMasterId) || 0,
                label: (m.label || '').trim(),
                value: (m.value || '').trim(),
                showInSlip: Boolean(m.showInSlip)
            }));

            const payload = {
                edid: effectiveEdid,
                name: courier.name,
                contactPerson: courier.contactPerson || null,
                mobile: courier.mobile || null,
                email: courier.email || null,
                address: courier.address || null,
                isActive: !courier.isActive,
                attachmentData,
                metadata: cleanMeta
            };

            await courierApi.updateCourier(effectiveEdid, courier.name, payload);
            await fetchDetail();
        } catch (err) {
            console.error(err);
            alert('Failed to update status.');
        } finally {
            setSavingAction(false);
        }
    };

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

    const slipFields = normalizeMetadata(courier.metadata).filter(m => m.showInSlip);
    const attachments = normalizeAttachments(courier);

    return (
        <div className="space-y-6">
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
                            disabled={savingAction}
                            className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer disabled:opacity-50 ${courier.isActive
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

            <div className="flex gap-6 items-start">
                <div className="w-[320px] shrink-0 flex flex-col gap-5">
                    <Card className="p-0 overflow-hidden bg-white border border-slate-200 rounded-2xl">
                        <div className="p-5 border-b border-slate-100">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-2xl font-black text-indigo-600 ring-4 ring-indigo-50/60 shrink-0">
                                    {courier.name ? courier.name.charAt(0).toUpperCase() : 'C'}
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-base font-black text-slate-900 truncate">{courier.name}</h2>
                                    <span className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${courier.isActive
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                                        }`}>
                                        {courier.isActive ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                                        {courier.isActive ? 'Active' : 'Disabled'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 space-y-4">
                            <InfoRow label="Contact Person" value={courier.contactPerson} />
                            <InfoRow label="Phone / Mobile" value={courier.mobile} icon={Phone} />
                            <InfoRow label="Email Address" value={courier.email} icon={Mail} />
                            <div className="pt-3 border-t border-slate-100">
                                <InfoRow label="Hub / Branch Address" value={courier.address} icon={MapPin} />
                            </div>
                        </div>

                        <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center gap-4 text-xs font-semibold text-slate-500">
                            <span>
                                <strong className="text-blue-700 font-black">{slipFields.length}</strong> Slip Fields
                            </span>
                            <span className="text-slate-300">·</span>
                            <span>
                                <strong className="text-slate-700 font-black">{normalizeMetadata(courier.metadata).length}</strong> Total Meta
                            </span>
                        </div>
                    </Card>

                    <Card className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <FileText size={12} className="text-indigo-500" /> Courier Documents ({attachments.length})
                            </h4>
                        </div>

                        {attachments.length > 0 ? (
                            <div className="space-y-2.5">
                                {attachments.map((attachment, index) => {
                                    const fileName = attachment.attachmentOriginalName || 'Attached Document';
                                    const docType = attachment.attachmentType || 'Other';
                                    const remarks = attachment.remarks || attachment.remark || '';

                                    return (
                                        <div
                                            key={attachment.attachmentEdid || index}
                                            className="p-3 rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-2"
                                        >
                                            {/* Type Badge & View Button */}
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                                                    {docType}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setViewDoc({
                                                        url: `${API_BASE}/common/attachment/${attachment.attachmentEdid}/${encodeURIComponent(fileName)}`,
                                                        title: `${courier.name || 'Courier'} - ${docType}`,
                                                        fileName
                                                    })}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg transition-colors cursor-pointer shadow-2xs shrink-0"
                                                >
                                                    <Eye size={12} /> View
                                                </button>
                                            </div>

                                            {/* Original File Name */}
                                            <div className="flex items-center gap-2 min-w-0" title={fileName}>
                                                <FileText size={14} className="text-slate-400 shrink-0" />
                                                <span className="text-xs font-bold text-slate-800 truncate">
                                                    {fileName}
                                                </span>
                                            </div>

                                            {/* Remarks */}
                                            {remarks ? (
                                                <div className="mt-1.5 px-2.5 py-1.5 bg-white rounded-lg border border-slate-200/80 text-xs">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Remark</span>
                                                    <p className="font-medium text-slate-700 leading-snug break-words">{remarks}</p>
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-3.5 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 font-medium">
                                No documents attached
                            </div>
                        )}
                    </Card>

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
                            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                <table className="w-full text-[11px] border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            {slipFields.map((m, i) => (
                                                <th key={i} className={`px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider text-left ${i !== slipFields.length - 1 ? 'border-r border-slate-200' : ''}`}>
                                                    {m.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="hover:bg-slate-50/50">
                                            {slipFields.map((m, i) => (
                                                <td key={i} className={`px-3 py-2.5 font-mono font-bold text-slate-800 text-xs ${i !== slipFields.length - 1 ? 'border-r border-slate-200' : ''}`}>
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

                <div className="flex-1 min-w-0 space-y-5">
                    <Card className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                    Dynamic Metadata Fields
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                                        {normalizeMetadata(courier.metadata).length}
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
                                        type="submit" disabled={savingAction}
                                        className="px-4 h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        {savingAction && <Loader2 size={12} className="animate-spin" />}
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
                                {normalizeMetadata(courier.metadata).length > 0 ? (
                                    normalizeMetadata(courier.metadata).map((field, idx) => (
                                        <TableRow key={idx}>
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
                                                    disabled={savingAction}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer disabled:opacity-50 ${field.showInSlip
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
                                                        disabled={savingAction}
                                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
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

                            <div className="sm:col-span-2 space-y-2">
                                <label className="text-[11px] font-bold text-slate-700 block">Courier Documents</label>
                                {editForm.attachments.map((attachment, index) => (
                                    <div key={attachment.attachmentEdid} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_130px_minmax(0,1fr)_auto_auto] items-center gap-2 p-2.5 bg-white border border-slate-200 rounded-lg">
                                        <div className="flex items-center gap-2 min-w-0 text-xs font-semibold text-slate-700">
                                            <FileText size={15} className="text-indigo-500 shrink-0" />
                                            <span className="truncate">{attachment.attachmentOriginalName || 'Attached document'}</span>
                                        </div>
                                        <Dropdown
                                            value={attachment.attachmentType}
                                            options={attachmentTypes}
                                            onChange={value => setEditForm(prev => ({ ...prev, attachments: prev.attachments.map((item, i) => i === index ? { ...item, attachmentType: value } : item) }))}
                                            placeholder="Document type"
                                            className="w-full"
                                        />
                                        <input aria-label={`Remark for ${attachment.attachmentOriginalName || 'document'}`} value={attachment.remarks} onChange={e => setEditForm(prev => ({ ...prev, attachments: prev.attachments.map((item, i) => i === index ? { ...item, remarks: e.target.value } : item) }))} placeholder="Add remark" className="h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700" />

                                        <button
                                            type="button"
                                            onClick={() => setViewDoc({
                                                url: `${API_BASE}/common/attachment/${attachment.attachmentEdid}/${encodeURIComponent(attachment.attachmentOriginalName || 'document')}`,
                                                title: attachment.attachmentOriginalName || 'Courier Document',
                                                fileName: attachment.attachmentOriginalName || ''
                                            })}
                                            className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="View document"
                                        >
                                            <Eye size={14} />
                                        </button>

                                        <button type="button" onClick={() => setEditForm(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== index) }))} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Remove document">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                                <label className="border border-dashed border-slate-300 hover:border-indigo-400 bg-white p-3 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors">
                                    <input type="file" multiple accept="image/*,.pdf" onChange={handleDocUpload} className="hidden" />
                                    {uploadingDoc ? <Loader2 size={15} className="animate-spin text-indigo-600" /> : <Upload size={15} className="text-slate-400" />}
                                    <span className="text-xs font-bold text-slate-600">{uploadingDoc ? 'Uploading documents...' : 'Add documents'}</span>
                                    <span className="text-[10px] text-slate-400">(Images, PDF up to 10MB each)</span>
                                </label>
                            </div>
                        </div>
                    </div>

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

            <DocumentViewModal
                isOpen={Boolean(viewDoc)}
                onClose={() => setViewDoc(null)}
                url={viewDoc?.url}
                title={viewDoc?.title || 'Courier Document'}
                fileName={viewDoc?.fileName || ''}
            />
        </div>
    );
}