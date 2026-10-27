import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { employeeApi } from '../../api/employeeApi';
import { PermissionEnum, hasPermission, PermissionMetadata } from '../../common/permissions';
import { RoleEnum, RoleMetadata, normalizeRole } from '../../common/roles';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import {
    ChevronLeft, Mail, Phone, Shield, FileText, CheckCircle2,
    XCircle, Edit2, Lock, RefreshCw, KeyRound, Loader2,
    Calendar, Check, UserCheck, ShieldCheck, ArrowUpRight
} from 'lucide-react';

export default function EmployeeDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { userPermissions, currentUser } = useStore();

    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [availableRoles, setAvailableRoles] = useState(Object.values(RoleEnum));

    // Edit modal states
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');
    const [editForm, setEditForm] = useState({
        employeeId: 0,
        employeeCode: '',
        employeeName: '',
        email: '',
        mobile: '',
        roles: [],
        isActive: true,
        newPassword: '',
        documentIdJson: '',
    });

    const canManage = hasPermission(userPermissions, PermissionEnum.ManageEmployees) ||
                      currentUser?.roles?.some(r => r?.toLowerCase() === 'admin' || r?.toLowerCase() === 'manager') ||
                      currentUser?.role?.toLowerCase() === 'admin' ||
                      currentUser?.role?.toLowerCase() === 'manager';

    // ─── Fetch Roles ─────────────────────────────────────────────────────────────
    useEffect(() => {
        employeeApi.getRoles()
            .then(roles => {
                if (Array.isArray(roles) && roles.length > 0) {
                    setAvailableRoles(roles);
                }
            })
            .catch(() => {});
    }, []);

    // ─── Fetch Employee ──────────────────────────────────────────────────────────
    const fetchEmployee = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        setError('');
        try {
            const data = await employeeApi.getEmployeeById(id);
            if (data) {
                setEmployee(data);
            } else {
                setError('Employee not found.');
            }
        } catch (err) {
            console.error('Failed to load employee details:', err);
            // Try fetching from list as fallback
            try {
                const listRes = await employeeApi.getEmployees(1, 100);
                const found = listRes?.items?.find(e => String(e.employeeId) === String(id));
                if (found) {
                    setEmployee(found);
                } else {
                    setError('Unable to load employee details. Please verify the ID.');
                }
            } catch {
                setError('Failed to retrieve employee record.');
            }
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchEmployee();
    }, [fetchEmployee]);

    // ─── Open Edit Modal ─────────────────────────────────────────────────────────
    const handleOpenEdit = () => {
        if (!employee) return;
        setEditForm({
            employeeId: employee.employeeId,
            employeeCode: employee.employeeCode || '',
            employeeName: employee.employeeName || '',
            email: employee.email || '',
            mobile: employee.mobile || '',
            roles: employee.roles ? [...employee.roles] : ['Staff'],
            isActive: employee.isActive !== false,
            newPassword: '',
            documentIdJson: employee.documentIdJson || '',
        });
        setFormError('');
        setFormSuccess('');
        setIsEditModalOpen(true);
    };

    const handleRoleToggleEdit = (role) => {
        setEditForm(prev => {
            const exists = prev.roles.includes(role);
            if (exists) {
                if (prev.roles.length === 1) return prev;
                return { ...prev, roles: prev.roles.filter(r => r !== role) };
            }
            return { ...prev, roles: [...prev.roles, role] };
        });
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        if (!editForm.employeeName.trim()) {
            setFormError('Employee name is required.');
            return;
        }
        if (editForm.roles.length === 0) {
            setFormError('Please assign at least one role.');
            return;
        }

        setFormLoading(true);
        try {
            await employeeApi.updateEmployee(editForm.employeeId, {
                employeeName: editForm.employeeName.trim(),
                email: editForm.email.trim() || null,
                mobile: editForm.mobile.trim() || null,
                roles: editForm.roles,
                isActive: editForm.isActive,
                newPassword: editForm.newPassword.trim() || null,
                documentIdJson: editForm.documentIdJson.trim() || null,
            });

            setIsEditModalOpen(false);
            fetchEmployee();
        } catch (err) {
            setFormError(err.message || 'Failed to update employee.');
        } finally {
            setFormLoading(false);
        }
    };

    // Toggle active status directly
    const handleToggleStatus = async () => {
        if (!employee || !canManage) return;
        try {
            const updatedStatus = !employee.isActive;
            await employeeApi.updateEmployee(employee.employeeId, {
                employeeName: employee.employeeName,
                email: employee.email,
                mobile: employee.mobile,
                roles: employee.roles || [],
                isActive: updatedStatus,
                documentIdJson: employee.documentIdJson,
            });
            setEmployee(prev => ({ ...prev, isActive: updatedStatus }));
        } catch (err) {
            alert('Failed to update employee status: ' + (err.message || 'Unknown error'));
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                <p className="text-sm font-semibold text-slate-500">Loading employee details...</p>
            </div>
        );
    }

    if (error || !employee) {
        return (
            <div className="max-w-2xl mx-auto py-12 px-4 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <XCircle size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Employee Not Found</h3>
                <p className="text-sm text-slate-500 mb-6">{error || 'The requested employee could not be located.'}</p>
                <Button onClick={() => navigate('/employees')} icon={ChevronLeft}>
                    Back to Employee List
                </Button>
            </div>
        );
    }

    const initials = (employee.employeeName || employee.employeeCode || 'E')
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <div className="space-y-6 pb-12">
            {/* Top Navigation & Header */}
            <PageHeader
                title={employee.employeeName || 'Employee Profile'}
                subtitle={`Employee Code: ${employee.employeeCode} • System ID: #${employee.employeeId}`}
                rightContent={
                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            icon={ChevronLeft}
                            onClick={() => navigate('/employees')}
                        >
                            Back
                        </Button>
                        <Button
                            variant="secondary"
                            icon={RefreshCw}
                            onClick={fetchEmployee}
                            title="Refresh data"
                        >
                            Refresh
                        </Button>
                        {canManage && (
                            <Button
                                variant="primary"
                                icon={Edit2}
                                onClick={handleOpenEdit}
                            >
                                Edit Employee
                            </Button>
                        )}
                    </div>
                }
            />

            {/* Profile Hero Card */}
            <Card className="p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white font-black text-xl flex items-center justify-center shadow-lg shrink-0">
                            {initials}
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2.5">
                                <h1 className="text-2xl font-black text-slate-900 leading-tight">
                                    {employee.employeeName}
                                </h1>
                                {employee.isActive ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                        Active Account
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                        Inactive / Suspended
                                    </span>
                                )}
                            </div>
                            <p className="text-xs font-mono text-slate-500 mt-1">
                                Code: <span className="font-bold text-slate-700">{employee.employeeCode}</span>
                                {employee.createdBy && (
                                    <> • Created By: <span className="font-bold text-slate-700">{employee.createdBy}</span></>
                                )}
                            </p>
                        </div>
                    </div>

                    {canManage && (
                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                            <button
                                type="button"
                                onClick={handleToggleStatus}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                                    employee.isActive
                                        ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                }`}
                            >
                                {employee.isActive ? 'Deactivate Account' : 'Activate Account'}
                            </button>
                        </div>
                    )}
                </div>
            </Card>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Contact & Identification */}
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Mail size={16} className="text-slate-500" />
                            Contact & Identity
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 flex-1">
                        <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                Email Address
                            </p>
                            {employee.email ? (
                                <a
                                    href={`mailto:${employee.email}`}
                                    className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1.5"
                                >
                                    <Mail size={14} className="text-slate-400" />
                                    {employee.email}
                                </a>
                            ) : (
                                <p className="text-sm text-slate-400 italic">No email address on file</p>
                            )}
                        </div>

                        <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                Mobile Number
                            </p>
                            {employee.mobile ? (
                                <a
                                    href={`tel:${employee.mobile}`}
                                    className="text-sm font-semibold text-slate-800 hover:text-blue-600 flex items-center gap-1.5"
                                >
                                    <Phone size={14} className="text-slate-400" />
                                    {employee.mobile}
                                </a>
                            ) : (
                                <p className="text-sm text-slate-400 italic">No phone number on file</p>
                            )}
                        </div>

                        <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                Document ID (PAN / Aadhaar / Custom)
                            </p>
                            {employee.documentIdJson ? (
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2">
                                    <FileText size={16} className="text-slate-500 shrink-0" />
                                    <span className="font-mono text-xs font-bold text-slate-800">
                                        {employee.documentIdJson}
                                    </span>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400 italic">No document ID recorded</p>
                            )}
                        </div>

                        {(employee.createdBy || employee.createdAt) && (
                            <div>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    Record Audit Trail
                                </p>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                                    <span className="text-slate-600">
                                        Created by: <strong className="font-mono text-slate-800">{employee.createdBy || 'System'}</strong>
                                    </span>
                                    {employee.createdAt && (
                                        <span className="text-[11px] text-slate-500">
                                            {new Date(employee.createdAt).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Assigned Roles & Descriptions */}
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield size={16} className="text-slate-500" />
                            Assigned Roles & Access Level
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 flex-1">
                        {employee.roles && employee.roles.length > 0 ? (
                            employee.roles.map(rawRole => {
                                const normRole = normalizeRole(rawRole);
                                const meta = RoleMetadata[normRole] || {
                                    label: normRole,
                                    description: 'Standard operational permissions',
                                    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                                    dotColor: 'bg-slate-400'
                                };

                                return (
                                    <div
                                        key={rawRole}
                                        className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-start gap-3"
                                    >
                                        <div className="mt-0.5">
                                            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full border ${meta.badgeClass}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor}`} />
                                                {meta.label || normRole}
                                            </span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs text-slate-600 font-medium">
                                                {meta.description}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-sm text-slate-400 italic">No roles assigned</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* System Privileges & Security Overview */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-slate-500" />
                        System Privileges & Security
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                <Check size={16} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-800">ERP Login Access</p>
                                <p className="text-[11px] text-slate-500">
                                    {employee.isActive ? 'Permitted to sign in' : 'Access blocked'}
                                </p>
                            </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                                <KeyRound size={16} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-800">Password Status</p>
                                <p className="text-[11px] text-slate-500">Encrypted in system</p>
                            </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                                <UserCheck size={16} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-800">Roles Count</p>
                                <p className="text-[11px] text-slate-500">
                                    {employee.roles?.length || 0} assigned role(s)
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ─── EDIT MODAL ──────────────────────────────────────────────────────── */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title={`Edit Employee: ${editForm.employeeCode}`}
                className="max-w-xl"
            >
                <form onSubmit={handleEditSubmit} className="space-y-4">
                    {formError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-medium">
                            {formError}
                        </div>
                    )}

                    <Input
                        label="Full Name"
                        value={editForm.employeeName}
                        onChange={(e) => setEditForm({ ...editForm, employeeName: e.target.value })}
                        required
                    />

                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="Email Address"
                            type="email"
                            value={editForm.email}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        />
                        <Input
                            label="Mobile Number"
                            value={editForm.mobile}
                            onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                        />
                    </div>

                    <Input
                        label="Document ID"
                        value={editForm.documentIdJson}
                        onChange={(e) => setEditForm({ ...editForm, documentIdJson: e.target.value })}
                    />

                    <div>
                        <Input
                            label="Reset Password (Optional)"
                            type="password"
                            placeholder="Leave blank to keep current password"
                            value={editForm.newPassword}
                            onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                            icon={KeyRound}
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Only fill this if you want to update the employee password.</p>
                    </div>

                    {/* Roles Selection */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                            Assigned Roles
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {availableRoles.map(role => {
                                const isChecked = editForm.roles.includes(role);
                                return (
                                    <button
                                        type="button"
                                        key={role}
                                        onClick={() => handleRoleToggleEdit(role)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                            isChecked
                                                ? 'bg-slate-900 text-white border-slate-900'
                                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                        }`}
                                    >
                                        {role}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Active Status Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
                        <div>
                            <p className="text-xs font-bold text-slate-800">Account Status</p>
                            <p className="text-[11px] text-slate-500">Deactivated employees cannot log into the system</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                                editForm.isActive
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-300 text-slate-700'
                            }`}
                        >
                            {editForm.isActive ? 'Active' : 'Deactivated'}
                        </button>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsEditModalOpen(false)}
                            disabled={formLoading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={formLoading}>
                            {formLoading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
