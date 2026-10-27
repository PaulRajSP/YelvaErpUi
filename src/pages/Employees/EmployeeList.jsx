import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { employeeApi } from '../../api/employeeApi';
import { PermissionEnum, hasPermission } from '../../common/permissions';
import { RoleEnum, RoleMetadata, normalizeRole } from '../../common/roles';
import PageHeader from '../../components/common/PageHeader';
import Dropdown from '../../components/common/Dropdown';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { Tooltip } from '../../components/ui/Tooltip';
import {
    Users, Plus, Search, Filter, Mail, Phone, Shield, CheckCircle2,
    XCircle, Edit2, Lock, FileText, RefreshCw, KeyRound, Sparkles, Loader2, X,
    Eye, ArrowUpRight
} from 'lucide-react';

export default function EmployeeList() {
    const navigate = useNavigate();
    const { userPermissions, currentUser } = useStore();

    // Data state
    const [employees, setEmployees] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [pageNumber, setPageNumber] = useState(1);
    const pageSize = 10;
    const [loading, setLoading] = useState(false);
    const [availableRoles, setAvailableRoles] = useState(Object.values(RoleEnum));

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRole, setSelectedRole] = useState('ALL');
    const [selectedStatus, setSelectedStatus] = useState('ALL');

    // Modals
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedDetailEmployee, setSelectedDetailEmployee] = useState(null);
    const [currentEditEmployee, setCurrentEditEmployee] = useState(null);

    // Form states
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');

    // Add Form
    const [addForm, setAddForm] = useState({
        employeeName: '',
        password: '',
        email: '',
        mobile: '',
        roles: [RoleEnum.Staff],
        documentIdJson: '',
    });

    // Edit Form
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
            .catch(() => {
                // Keep default roles if API is offline
            });
    }, []);

    // ─── Fetch Employees ─────────────────────────────────────────────────────────
    const fetchEmployees = useCallback(async () => {
        setLoading(true);
        try {
            const roleFilter = selectedRole === 'ALL' ? null : selectedRole;
            const statusFilter = selectedStatus === 'ALL' ? null : selectedStatus === 'ACTIVE';

            const res = await employeeApi.getEmployees(pageNumber, pageSize, searchTerm, roleFilter, statusFilter);
            if (res) {
                setEmployees(res.items || []);
                setTotalCount(res.totalCount || 0);
            }
        } catch (err) {
            console.error('Failed to load employees:', err);
            // Fallback mock if backend is starting up
            if (employees.length === 0) {
                setEmployees([
                    {
                        employeeId: 1,
                        employeeCode: 'EMP001',
                        employeeName: 'System Administrator',
                        email: 'admin@yelva.com',
                        mobile: '9876543210',
                        roles: [RoleEnum.Admin],
                        isActive: true
                    },
                    {
                        employeeId: 2,
                        employeeCode: 'EMP002',
                        employeeName: 'Store Staff Operator',
                        email: 'staff@yelva.com',
                        mobile: '9876543211',
                        roles: [RoleEnum.Staff],
                        isActive: true
                    },
                    {
                        employeeId: 3,
                        employeeCode: 'EMP003',
                        employeeName: 'Order Packing Operator',
                        email: 'packer@yelva.com',
                        mobile: '9876543212',
                        roles: [RoleEnum.Packer],
                        isActive: true
                    }
                ]);
                setTotalCount(3);
            }
        } finally {
            setLoading(false);
        }
    }, [pageNumber, pageSize, searchTerm, selectedRole, selectedStatus]);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    // ─── Handle Add Employee ─────────────────────────────────────────────────────
    const handleOpenAddModal = () => {
        // Generate a suggested next code like EMP003
        const nextNum = employees.length + 1;
        const suggestedCode = `EMP${String(nextNum).padStart(3, '0')}`;

        setAddForm({
            employeeCode: suggestedCode,
            employeeName: '',
            password: '',
            email: '',
            mobile: '',
            roles: ['STAFF'],
            documentIdJson: '',
        });
        setFormError('');
        setFormSuccess('');
        setIsAddModalOpen(true);
    };

    const handleRoleToggleAdd = (role) => {
        setAddForm(prev => {
            const exists = prev.roles.includes(role);
            if (exists) {
                if (prev.roles.length === 1) return prev; // At least one role
                return { ...prev, roles: prev.roles.filter(r => r !== role) };
            }
            return { ...prev, roles: [...prev.roles, role] };
        });
    };

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!addForm.employeeName.trim()) {
            setFormError('Employee name is required.');
            return;
        }
        if (!addForm.password) {
            setFormError('Initial password is required.');
            return;
        }
        if (addForm.roles.length === 0) {
            setFormError('Please select at least one role.');
            return;
        }

        setFormLoading(true);
        try {
            await employeeApi.createEmployee({
                employeeName: addForm.employeeName.trim(),
                password: addForm.password,
                email: addForm.email.trim() || null,
                mobile: addForm.mobile.trim() || null,
                roles: addForm.roles,
                documentIdJson: addForm.documentIdJson.trim() || null,
            });

            setIsAddModalOpen(false);
            setAddForm({
                employeeName: '',
                password: '',
                email: '',
                mobile: '',
                roles: [RoleEnum.Staff],
                documentIdJson: '',
            });
            fetchEmployees();
        } catch (err) {
            setFormError(err.message || 'Failed to create employee.');
        } finally {
            setFormLoading(false);
        }
    };

    // ─── Handle Detail Modal ───────────────────────────────────────────────────
    const handleOpenDetailModal = (emp) => {
        setSelectedDetailEmployee(emp);
        setIsDetailModalOpen(true);
    };

    // ─── Handle Edit Employee ────────────────────────────────────────────────────
    const handleOpenEditModal = (emp) => {
        setCurrentEditEmployee(emp);
        setEditForm({
            employeeId: emp.employeeId,
            employeeCode: emp.employeeCode,
            employeeName: emp.employeeName || '',
            email: emp.email || '',
            mobile: emp.mobile || '',
            roles: emp.roles ? [...emp.roles] : ['STAFF'],
            isActive: emp.isActive !== false,
            newPassword: '',
            documentIdJson: emp.documentIdJson || '',
        });
        setFormError('');
        setIsEditModalOpen(true);
    };

    const handleRoleToggleEdit = (role) => {
        setEditForm(prev => {
            const exists = prev.roles.includes(role);
            if (exists) {
                if (prev.roles.length === 1) return prev; // At least one role
                return { ...prev, roles: prev.roles.filter(r => r !== role) };
            }
            return { ...prev, roles: [...prev.roles, role] };
        });
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!editForm.employeeName.trim()) {
            setFormError('Employee name cannot be empty.');
            return;
        }
        if (editForm.roles.length === 0) {
            setFormError('Please assign at least one role.');
            return;
        }

        setFormLoading(true);
        try {
            await employeeApi.updateEmployee(editForm.employeeId, {
                employeeId: editForm.employeeId,
                employeeName: editForm.employeeName.trim(),
                email: editForm.email.trim() || null,
                mobile: editForm.mobile.trim() || null,
                roles: editForm.roles,
                isActive: editForm.isActive,
                newPassword: editForm.newPassword ? editForm.newPassword : null,
                documentIdJson: editForm.documentIdJson.trim() || null,
            });

            setIsEditModalOpen(false);
            fetchEmployees();
        } catch (err) {
            setFormError(err.message || 'Failed to update employee.');
        } finally {
            setFormLoading(false);
        }
    };

    // Stats
    const activeCount = employees.filter(e => e.isActive).length;
    const inactiveCount = employees.filter(e => !e.isActive).length;

    return (
        <div className="space-y-5">
            <PageHeader
                title="Employees"
                subtitle="View and manage all system employees"
                rightContent={
                    canManage && (
                        <button
                            type="button"
                            onClick={handleOpenAddModal}
                            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                            title="Add New Employee"
                        >
                            <Plus size={14} />
                            <span>Add Employee</span>
                        </button>
                    )
                }
            />

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
                {/* Search */}
                <div className="w-[280px]">
                    <Input
                        actionIcon={Search}
                        placeholder="Search by name, code, email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Role Filter */}
                <Dropdown
                    value={selectedRole}
                    onChange={(val) => {
                        setSelectedRole(val);
                        setPageNumber(1);
                    }}
                    options={[
                        { value: 'ALL', label: 'All' },
                        ...availableRoles.map(r => ({ value: r, label: r }))
                    ]}
                    className="w-[160px]"
                />

                {/* Status Filter */}
                <Dropdown
                    value={selectedStatus}
                    onChange={(val) => {
                        setSelectedStatus(val);
                        setPageNumber(1);
                    }}
                    options={[
                        { value: 'ALL', label: 'All' },
                        { value: 'ACTIVE', label: 'Active' },
                        { value: 'INACTIVE', label: 'Inactive' }
                    ]}
                    className="w-[140px]"
                />

                {(searchTerm || selectedRole !== 'ALL' || selectedStatus !== 'ALL') && (
                    <button
                        type="button"
                        onClick={() => {
                            setSearchTerm('');
                            setSelectedRole('ALL');
                            setSelectedStatus('ALL');
                            setPageNumber(1);
                        }}
                        className="h-10 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0"
                        title="Reset Filters"
                    >
                        <X size={15} />
                    </button>
                )}
            </div>

            {/* Table */}
            <Card className="overflow-auto flex flex-col">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-left">EMPLOYEE CODE</TableHead>
                            <TableHead className="text-left">NAME</TableHead>
                            <TableHead className="text-left">EMAIL</TableHead>
                            <TableHead className="text-left">MOBILE</TableHead>
                            <TableHead className="text-left">ROLES</TableHead>
                            <TableHead className="text-left">CREATED BY</TableHead>
                            <TableHead className="text-center">STATUS</TableHead>
                            <TableHead className="text-center">ACTIONS</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={8} className="py-16 text-center text-slate-400 font-medium">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
                                    Loading employees...
                                </TableCell>
                            </TableRow>
                        ) : employees.length === 0 ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={8} className="text-center text-slate-400 py-16 font-medium">
                                    No employees found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            employees.map((emp) => {
                                const isActive = emp.isActive !== false;
                                return (
                                    <TableRow key={emp.employeeId}>
                                        <TableCell className="whitespace-nowrap font-medium text-slate-800">
                                            {emp.employeeCode}
                                        </TableCell>
                                        <TableCell className="font-medium text-slate-800">
                                            {emp.employeeName || '-'}
                                        </TableCell>
                                        <TableCell className="text-slate-600">
                                            {emp.email || '-'}
                                        </TableCell>
                                        <TableCell className="text-slate-600">
                                            {emp.mobile || '-'}
                                        </TableCell>
                                        <TableCell className="font-medium text-slate-700">
                                            {emp.roles && emp.roles.length > 0 ? emp.roles.join(', ') : '-'}
                                        </TableCell>
                                        <TableCell className="text-slate-600 font-mono text-xs">
                                            {emp.createdBy || '-'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className={`font-bold uppercase ${isActive ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {isActive ? 'ACTIVE' : 'INACTIVE'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center" style={{ borderLeft: 'none' }}>
                                            <div className="flex items-center justify-center gap-1">
                                                <Tooltip content="View">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        icon={Eye}
                                                        onClick={() => handleOpenDetailModal(emp)}
                                                    />
                                                </Tooltip>
                                                {canManage && (
                                                    <Tooltip content="Edit">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            icon={Edit2}
                                                            onClick={() => handleOpenEditModal(emp)}
                                                        />
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>

                {/* Pagination */}
                <Pagination
                    currentPage={pageNumber}
                    totalPages={Math.max(1, Math.ceil((totalCount || employees.length) / pageSize))}
                    onPageChange={setPageNumber}
                    totalItems={totalCount || employees.length}
                    itemsPerPage={pageSize}
                />
            </Card>

            {/* ─── ADD EMPLOYEE MODAL ──────────────────────────────────────────────── */}
            <Modal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                title="Add New Employee"
                className="max-w-xl"
            >
                <form onSubmit={handleAddSubmit} className="space-y-4">
                    {formError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-medium">
                            {formError}
                        </div>
                    )}

                    <Input
                        label="Full Name"
                        placeholder="e.g. John Doe"
                        value={addForm.employeeName}
                        onChange={(e) => setAddForm({ ...addForm, employeeName: e.target.value })}
                        required
                    />

                    <Input
                        label="Password"
                        type="password"
                        placeholder="Assign an initial password"
                        value={addForm.password}
                        onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                        required
                    />

                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="Email Address"
                            type="email"
                            placeholder="employee@yelva.com"
                            value={addForm.email}
                            onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                        />
                        <Input
                            label="Mobile Number"
                            placeholder="9876543210"
                            value={addForm.mobile}
                            onChange={(e) => setAddForm({ ...addForm, mobile: e.target.value })}
                        />
                    </div>

                    <Input
                        label="Document ID (PAN / Aadhaar / JSON)"
                        placeholder="e.g. ABCDE1234F or JSON"
                        value={addForm.documentIdJson}
                        onChange={(e) => setAddForm({ ...addForm, documentIdJson: e.target.value })}
                    />

                    {/* Roles Multi-Check */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                            Assign System Roles *
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {availableRoles.map(role => {
                                const isChecked = addForm.roles.includes(role);
                                return (
                                    <button
                                        type="button"
                                        key={role}
                                        onClick={() => handleRoleToggleAdd(role)}
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

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsAddModalOpen(false)}
                            disabled={formLoading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={formLoading}>
                            {formLoading ? 'Creating...' : 'Create Employee'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* ─── EDIT EMPLOYEE MODAL ─────────────────────────────────────────────── */}
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

                    {/* Reset Password */}
                    <div>
                        <Input
                            label="Reset Password (Optional)"
                            type="password"
                            placeholder="Leave blank to keep current password"
                            value={editForm.newPassword}
                            onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                            icon={KeyRound}
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Only fill this if you want to reset the user password.</p>
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

            {/* ─── EMPLOYEE DETAIL POPUP MODAL ────────────────────────────────────────── */}
            <Modal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                title="Employee Details"
                className="max-w-xl"
            >
                {selectedDetailEmployee && (() => {
                    const initials = (selectedDetailEmployee.employeeName || selectedDetailEmployee.employeeCode || 'E')
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2);

                    return (
                        <div className="space-y-5">
                            {/* Profile Header */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white font-black text-base flex items-center justify-center shrink-0 shadow-sm">
                                        {initials}
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-slate-900 leading-tight">
                                            {selectedDetailEmployee.employeeName || 'Unnamed'}
                                        </h3>
                                        <p className="text-xs font-mono font-semibold text-slate-500 mt-0.5">
                                            Code: {selectedDetailEmployee.employeeCode}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    {selectedDetailEmployee.isActive !== false ? (
                                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                            Active
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                            Inactive
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Contact & Identification */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-white">
                                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                                        <Mail size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Email Address</span>
                                    </div>
                                    {selectedDetailEmployee.email ? (
                                        <a
                                            href={`mailto:${selectedDetailEmployee.email}`}
                                            className="text-xs font-semibold text-blue-600 hover:underline break-all"
                                        >
                                            {selectedDetailEmployee.email}
                                        </a>
                                    ) : (
                                        <span className="text-xs text-slate-400 italic">Not provided</span>
                                    )}
                                </div>

                                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-white">
                                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                                        <Phone size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mobile Number</span>
                                    </div>
                                    {selectedDetailEmployee.mobile ? (
                                        <a
                                            href={`tel:${selectedDetailEmployee.mobile}`}
                                            className="text-xs font-semibold text-slate-800 hover:text-blue-600"
                                        >
                                            {selectedDetailEmployee.mobile}
                                        </a>
                                    ) : (
                                        <span className="text-xs text-slate-400 italic">Not provided</span>
                                    )}
                                </div>
                            </div>

                            {/* Document ID */}
                            {selectedDetailEmployee.documentIdJson && (
                                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-white flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileText size={15} className="text-slate-400" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Document ID</span>
                                    </div>
                                    <span className="font-mono text-xs font-bold text-slate-800 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                                        {selectedDetailEmployee.documentIdJson}
                                    </span>
                                </div>
                            )}

                            {/* Created By & Record Info */}
                            {(selectedDetailEmployee.createdBy || selectedDetailEmployee.createdAt) && (
                                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Created by:</span>
                                        <span className="font-mono font-bold text-slate-800">{selectedDetailEmployee.createdBy || 'System'}</span>
                                    </div>
                                    {selectedDetailEmployee.createdAt && (
                                        <span className="text-[11px] text-slate-500">
                                            {new Date(selectedDetailEmployee.createdAt).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Assigned Roles */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                    <Shield size={14} className="text-slate-400" />
                                    Assigned System Roles
                                </label>
                                <div className="space-y-2">
                                    {selectedDetailEmployee.roles && selectedDetailEmployee.roles.length > 0 ? (
                                        selectedDetailEmployee.roles.map(rawRole => {
                                            const normRole = normalizeRole(rawRole);
                                            const meta = RoleMetadata[normRole] || {
                                                label: normRole,
                                                description: 'Standard system permissions',
                                                badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                                                dotColor: 'bg-slate-400'
                                            };
                                            return (
                                                <div
                                                    key={rawRole}
                                                    className="p-2.5 rounded-xl border border-slate-200/70 bg-slate-50/50 flex items-center justify-between gap-3 text-xs"
                                                >
                                                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full border ${meta.badgeClass}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor}`} />
                                                        {meta.label || normRole}
                                                    </span>
                                                    <span className="text-[11px] text-slate-500 text-right truncate">
                                                        {meta.description}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-xs text-slate-400 italic">No roles assigned.</p>
                                    )}
                                </div>
                            </div>

                            {/* Actions footer */}
                            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => {
                                        setIsDetailModalOpen(false);
                                        navigate(`/employees/${selectedDetailEmployee.employeeId}`);
                                    }}
                                    icon={ArrowUpRight}
                                    className="text-xs"
                                >
                                    Open Full Page
                                </Button>

                                <div className="flex items-center gap-2">
                                    {canManage && (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            icon={Edit2}
                                            onClick={() => {
                                                setIsDetailModalOpen(false);
                                                handleOpenEditModal(selectedDetailEmployee);
                                            }}
                                        >
                                            Edit Employee
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        variant="primary"
                                        onClick={() => setIsDetailModalOpen(false)}
                                    >
                                        Close
                                    </Button>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </Modal>
        </div>
    );
}
