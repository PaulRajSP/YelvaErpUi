import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import { 
    IndianRupee, Plus, Search, Calendar, FileText, 
    Trash2, Edit2, Clock, AlertCircle, Zap, X, RefreshCw, Paperclip
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Dropdown from '../../components/common/Dropdown';
import { Card, CardContent } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Pagination } from '../../components/ui/Pagination';
import DateRangePicker from '../../components/common/DateRangePicker';
import ExpenseReceiptModal from '../../components/expenses/ExpenseReceiptModal';
import UploadedDocumentButton from '../../components/common/UploadedDocumentButton';
import { expenseApi } from '../../api/expenseApi';
import { commonApi } from '../../api/commonApi';
import { formatCurrency, formatDate } from '../../common/utils';

export default function ExpenseList() {
    const { currentUser } = useStore();

    // Data states
    const [expenses, setExpenses] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [summary, setSummary] = useState({
        totalExpenses: 0,
        thisMonthTotal: 0,
        todayTotal: 0,
        totalCount: 0,
        categoryBreakdown: []
    });
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // Filter states
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [paymentModeFilter, setPaymentModeFilter] = useState('All');
    const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

    // Request tracking to prevent stale out-of-order responses
    const activeRequestId = useRef(0);

    // Debounce search input so typing doesn't trigger API calls on every keystroke
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 350);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset page to 1 whenever filters or search query change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, categoryFilter, statusFilter, paymentModeFilter, dateRange.startDate, dateRange.endDate]);

    // Dynamic dropdown options from Common API (no hardcoded enums)
    const [categoryOptions, setCategoryOptions] = useState(['All']);
    const [statusOptions, setStatusOptions] = useState(['All']);
    const [paymentModeOptions, setPaymentModeOptions] = useState(['All']);

    // Modal state for Add/Edit
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [formSubmitting, setFormSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [uploadingReceipt, setUploadingReceipt] = useState(false);

    // Delete confirmation modal
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [expenseToDelete, setExpenseToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // View Receipt popup modal
    const [viewingReceiptExpense, setViewingReceiptExpense] = useState(null);

    // Form fields
    const [formData, setFormData] = useState({
        title: '',
        category: '',
        amount: '',
        expenseDate: new Date().toISOString().split('T')[0],
        paymentMode: '',
        paidTo: '',
        referenceNumber: '',
        status: '',
        remarks: '',
        attachmentData: []
    });

    // Load enum types from commonApi dynamically
    useEffect(() => {
        const fetchCommonTypes = async () => {
            try {
                const [catRes, statRes, modeRes] = await Promise.all([
                    commonApi.getTypes('ExpenseCategory').catch(() => null),
                    commonApi.getTypes('ExpenseStatus').catch(() => null),
                    commonApi.getTypes('ExpensePaymentMode').catch(() => null)
                ]);

                if (catRes) {
                    const items = catRes.items || catRes.Items || (Array.isArray(catRes) ? catRes : []);
                    setCategoryOptions(['All', ...items]);
                }
                if (statRes) {
                    const items = statRes.items || statRes.Items || (Array.isArray(statRes) ? statRes : []);
                    setStatusOptions(['All', ...items]);
                }
                if (modeRes) {
                    const items = modeRes.items || modeRes.Items || (Array.isArray(modeRes) ? modeRes : []);
                    setPaymentModeOptions(['All', ...items]);
                }
            } catch (err) {
                console.error('Error fetching common types for expenses:', err);
            }
        };

        fetchCommonTypes();
    }, []);

    // Fetch expense list in background without UI disruption
    const fetchExpenses = useCallback(async () => {
        const reqId = ++activeRequestId.current;
        try {
            const filters = {
                fromDate: dateRange.startDate || null,
                toDate: dateRange.endDate || null,
                category: categoryFilter,
                status: statusFilter,
                paymentMode: paymentModeFilter,
                searchKeyword: debouncedSearch || null
            };

            const [listRes, summaryRes] = await Promise.all([
                expenseApi.getExpenses(currentPage, pageSize, filters),
                expenseApi.getExpenseSummary(filters).catch(() => null)
            ]);

            // Discard stale out-of-order response
            if (reqId !== activeRequestId.current) return;

            const listData = listRes?.data || listRes;
            const newItems = listData?.items || [];
            const newCount = listData?.totalCount ?? 0;

            // Only update row data if data actually changed
            setExpenses(prev => {
                if (JSON.stringify(prev) === JSON.stringify(newItems)) return prev;
                return newItems;
            });

            setTotalCount(prev => prev === newCount ? prev : newCount);

            if (summaryRes) {
                const sData = summaryRes?.data || summaryRes;
                setSummary(prev => {
                    const next = {
                        totalExpenses: sData?.totalExpenses ?? 0,
                        thisMonthTotal: sData?.thisMonthTotal ?? 0,
                        todayTotal: sData?.todayTotal ?? 0,
                        totalCount: sData?.totalCount ?? 0,
                        categoryBreakdown: sData?.categoryBreakdown || []
                    };
                    if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
                    return next;
                });
            }
        } catch (err) {
            console.error('Failed to load expenses:', err);
        } finally {
            if (reqId === activeRequestId.current) {
                setIsInitialLoad(false);
            }
        }
    }, [currentPage, pageSize, categoryFilter, statusFilter, paymentModeFilter, debouncedSearch, dateRange.startDate, dateRange.endDate]);

    useEffect(() => {
        fetchExpenses();
    }, [fetchExpenses]);

    // Handle receipt file upload
    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setUploadingReceipt(true);
        setFormError('');
        try {
            const uploaded = await Promise.all(files.map(async file => {
                const res = await commonApi.uploadAttachment(file);
                const data = res?.data || res;
                const attachmentEdid = data?.documentEdid || data?.edid || data?.attachmentEdid;
                if (!attachmentEdid) return null;
                return {
                    attachmentEdid,
                    attachmentOriginalName: data?.documentOriginalName || file.name,
                    attachmentType: 'Receipt',
                    remarks: ''
                };
            }));
            setFormData(prev => ({
                ...prev,
                attachmentData: [...prev.attachmentData, ...uploaded.filter(Boolean)]
            }));
        } catch (err) {
            console.error('Failed to upload receipt:', err);
            setFormError('Failed to upload receipt: ' + (err.message || 'Error'));
        } finally {
            setUploadingReceipt(false);
            e.target.value = '';
        }
    };

    // Open form for Create
    const handleOpenCreate = () => {
        setEditingExpense(null);
        setFormError('');
        setFormData({
            title: '',
            category: categoryOptions.find(o => o !== 'All') || '',
            amount: '',
            expenseDate: new Date().toISOString().split('T')[0],
            paymentMode: paymentModeOptions.find(o => o !== 'All') || '',
            paidTo: '',
            referenceNumber: '',
            status: statusOptions.find(o => o !== 'All') || '',
            remarks: '',
            attachmentData: []
        });
        setIsFormOpen(true);
    };

    // Open form for Edit
    const handleOpenEdit = (item) => {
        setEditingExpense(item);
        setFormError('');
        setFormData({
            title: item.title || '',
            category: item.category || '',
            amount: item.amount || '',
            expenseDate: item.expenseDate ? item.expenseDate.split('T')[0] : '',
            paymentMode: item.paymentMode || '',
            paidTo: item.paidTo || '',
            referenceNumber: item.referenceNumber || '',
            status: item.status || '',
            remarks: item.remarks || '',
            attachmentData: Array.isArray(item.attachmentData) ? item.attachmentData : []
        });
        setIsFormOpen(true);
    };

    // Form submit
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!formData.title.trim()) {
            setFormError('Expense title is required (e.g. Electricity Bill, Office Rent).');
            return;
        }

        const numAmount = parseFloat(formData.amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            setFormError('Please enter a valid expense amount greater than zero.');
            return;
        }

        if (!formData.category) {
            setFormError('Please select or specify an expense category.');
            return;
        }

        if (!formData.paymentMode) {
            setFormError('Please select a payment mode.');
            return;
        }

        if (!formData.status) {
            setFormError('Please select the payment status.');
            return;
        }

        setFormSubmitting(true);
        try {
            // Note: recordedBy is dynamically sourced from currentUser without hardcoding defaults
            const activeUser = currentUser?.name || currentUser?.userName || '';

            const payload = {
                title: formData.title.trim(),
                category: formData.category,
                amount: numAmount,
                expenseDate: formData.expenseDate ? new Date(formData.expenseDate).toISOString() : new Date().toISOString(),
                paymentMode: formData.paymentMode,
                paidTo: formData.paidTo?.trim() || null,
                referenceNumber: formData.referenceNumber?.trim() || null,
                status: formData.status,
                remarks: formData.remarks?.trim() || null,
                attachmentData: (formData.attachmentData || []).map(({ attachmentEdid, attachmentType, remarks }) => ({
                    attachmentEdid,
                    attachmentType: attachmentType || 'Receipt',
                    remarks: remarks || ''
                })),
                recordedBy: activeUser
            };

            if (editingExpense) {
                await expenseApi.updateExpense(editingExpense.edid, payload);
            } else {
                await expenseApi.createExpense(payload);
            }

            setIsFormOpen(false);
            fetchExpenses();
        } catch (err) {
            console.error('Failed to save expense:', err);
            setFormError(err.message || 'Failed to save expense record. Please verify inputs.');
        } finally {
            setFormSubmitting(false);
        }
    };

    // Confirm Delete
    const handleDeleteClick = (item) => {
        setExpenseToDelete(item);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!expenseToDelete) return;
        setDeleting(true);
        try {
            await expenseApi.deleteExpense(expenseToDelete.edid);
            setDeleteModalOpen(false);
            setExpenseToDelete(null);
            fetchExpenses();
        } catch (err) {
            console.error('Failed to delete expense:', err);
            alert('Failed to delete expense: ' + (err.message || 'Error'));
        } finally {
            setDeleting(false);
        }
    };

    // Reset filters
    const handleResetFilters = () => {
        setSearchTerm('');
        setDebouncedSearch('');
        setCategoryFilter('All');
        setStatusFilter('All');
        setPaymentModeFilter('All');
        setDateRange({ startDate: '', endDate: '' });
        setCurrentPage(1);
    };

    // View attached bill receipt in popup modal
    const handleOpenReceipt = (expense) => {
        setViewingReceiptExpense(expense);
    };

    return (
        <div className="space-y-6">
            {/* PAGE HEADER */}
            <PageHeader
                title="Expense Management"
                subtitle="Track and audit external operational expenses (Electricity, Rent, Utilities, Maintenance, etc.)"
                rightContent={
                    <Button
                        variant="primary"
                        onClick={handleOpenCreate}
                        icon={Plus}
                    >
                        Add Expense
                    </Button>
                }
            />

            {/* TOP METRIC CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Expenses */}
                <Card className="border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Expenses</p>
                            <h3 className="text-2xl font-black text-slate-900 mt-1">
                                {formatCurrency(summary.totalExpenses)}
                            </h3>
                            <p className="text-xs text-slate-500 font-medium mt-1">
                                {summary.totalCount} recorded {summary.totalCount === 1 ? 'bill' : 'bills'}
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                            <IndianRupee size={22} />
                        </div>
                    </CardContent>
                </Card>

                {/* This Month's Total */}
                <Card className="border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">This Month</p>
                            <h3 className="text-2xl font-black text-indigo-600 mt-1">
                                {formatCurrency(summary.thisMonthTotal)}
                            </h3>
                            <p className="text-xs text-slate-500 font-medium mt-1">
                                Current billing cycle
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
                            <Calendar size={22} />
                        </div>
                    </CardContent>
                </Card>

                {/* Today's Total */}
                <Card className="border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Today's Expenses</p>
                            <h3 className="text-2xl font-black text-emerald-600 mt-1">
                                {formatCurrency(summary.todayTotal)}
                            </h3>
                            <p className="text-xs text-slate-500 font-medium mt-1">
                                Today's outgoings
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
                            <Clock size={22} />
                        </div>
                    </CardContent>
                </Card>

                {/* Top Category Breakdown */}
                <Card className="border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Top Category</p>
                            <h3 className="text-lg font-black text-slate-900 mt-1 truncate max-w-[140px]">
                                {summary.categoryBreakdown?.[0]?.category || 'None yet'}
                            </h3>
                            <p className="text-xs text-slate-500 font-medium mt-1">
                                {summary.categoryBreakdown?.[0] ? formatCurrency(summary.categoryBreakdown[0].totalAmount) : 'No data'}
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
                            <Zap size={22} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* FILTER & SEARCH BAR */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm relative z-30">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end">
                    {/* Search Input */}
                    <div className="lg:col-span-1">
                        <Input
                            label="Search"
                            placeholder="Title, Paid to, Ref #..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            icon={Search}
                        />
                    </div>

                    {/* Category Filter */}
                    <div>
                        <Dropdown
                            label="Category"
                            value={categoryFilter}
                            onChange={(val) => {
                                setCategoryFilter(val);
                                setCurrentPage(1);
                            }}
                            options={categoryOptions.map(opt => ({
                                value: opt,
                                label: opt === 'All' ? 'All Categories' : opt
                            }))}
                        />
                    </div>

                    {/* Status Filter */}
                    <div>
                        <Dropdown
                            label="Status"
                            value={statusFilter}
                            onChange={(val) => {
                                setStatusFilter(val);
                                setCurrentPage(1);
                            }}
                            options={statusOptions.map(opt => ({
                                value: opt,
                                label: opt === 'All' ? 'All Statuses' : opt
                            }))}
                        />
                    </div>

                    {/* Payment Mode Filter */}
                    <div>
                        <Dropdown
                            label="Payment Mode"
                            value={paymentModeFilter}
                            onChange={(val) => {
                                setPaymentModeFilter(val);
                                setCurrentPage(1);
                            }}
                            options={paymentModeOptions.map(opt => ({
                                value: opt,
                                label: opt === 'All' ? 'All Payment Modes' : opt
                            }))}
                        />
                    </div>

                    {/* Date Range Picker */}
                    <div className="flex items-center gap-2">
                        <div className="flex-1">
                            <DateRangePicker
                                label="Date Range"
                                startDate={dateRange.startDate}
                                endDate={dateRange.endDate}
                                onChange={(range) => {
                                    setDateRange(range);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                        {(searchTerm || categoryFilter !== 'All' || statusFilter !== 'All' || paymentModeFilter !== 'All' || dateRange.startDate) && (
                            <button
                                onClick={handleResetFilters}
                                className="h-[38px] px-3 mt-auto bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0"
                                title="Reset Filters"
                            >
                                <X size={15} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* EXPENSE TABLE */}
            <Card className="border border-slate-200 shadow-sm overflow-hidden relative z-10">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-left">Expense #</TableHead>
                            <TableHead className="text-left">Title</TableHead>
                            <TableHead className="text-left">Category</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-center">Date</TableHead>
                            <TableHead className="text-left">Payment Mode</TableHead>
                            <TableHead className="text-left">Paid To / Vendor</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-center">Receipt</TableHead>
                            <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody padRows={false}>
                        {isInitialLoad && expenses.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10} className="text-center py-12 text-slate-400">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <RefreshCw size={24} className="animate-spin text-slate-400" />
                                        <span>Loading expenses...</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : expenses.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10} className="text-center py-12 text-slate-400">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <FileText size={32} className="text-slate-300" />
                                        <p className="font-semibold text-slate-600">No expenses found</p>
                                        <p className="text-xs text-slate-400">Record a new expense like Electricity, Rent, or Maintenance to get started.</p>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={handleOpenCreate}
                                            className="mt-2"
                                            icon={Plus}
                                        >
                                            Record Expense
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            expenses.map((item) => {
                                const isPaid = (item.status || '').toLowerCase() === 'paid';
                                const isPending = (item.status || '').toLowerCase() === 'pending';
                                return (
                                    <TableRow key={item.edid} className="transition-colors hover:bg-slate-50/60">
                                        {/* Expense # */}
                                        <TableCell className="text-sm text-slate-700">
                                            {item.expenseNumber}
                                        </TableCell>

                                        {/* Title */}
                                        <TableCell className="text-sm font-medium text-slate-900">
                                            {item.title}
                                        </TableCell>

                                        {/* Category */}
                                        <TableCell className="text-sm text-slate-700">
                                            {item.category}
                                        </TableCell>

                                        {/* Amount */}
                                        <TableCell className="text-right text-sm font-bold text-slate-900">
                                            {formatCurrency(item.amount)}
                                        </TableCell>

                                        {/* Date */}
                                        <TableCell className="text-center text-sm text-slate-700">
                                            {formatDate(item.expenseDate)}
                                        </TableCell>

                                        {/* Payment Mode */}
                                        <TableCell className="text-sm text-slate-700">
                                            <span>{item.paymentMode || '-'}</span>
                                            {item.referenceNumber && (
                                                <span className="block text-[11px] text-slate-400 font-mono">
                                                    Ref: {item.referenceNumber}
                                                </span>
                                            )}
                                        </TableCell>

                                        {/* Paid To */}
                                        <TableCell className="text-sm text-slate-700">
                                            {item.paidTo || '-'}
                                        </TableCell>

                                        {/* Status */}
                                        <TableCell className="text-center">
                                            <span className={`font-bold uppercase ${
                                                isPaid ? 'text-emerald-600' : isPending ? 'text-amber-600' : 'text-rose-600'
                                            }`}>
                                                {item.status || 'PENDING'}
                                            </span>
                                        </TableCell>

                                        {/* Receipt Attachment */}
                                        <TableCell className="text-center text-sm">
                                            {item.attachmentData?.length > 0 ? (
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenReceipt(item)}
                                                    className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                                                >
                                                    View Bill
                                                </button>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </TableCell>

                                        {/* Actions */}
                                        <TableCell className="text-center text-sm text-slate-700">
                                            <div className="flex justify-center items-center gap-1">
                                                {item.attachmentData?.length > 0 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        icon={FileText}
                                                        onClick={() => handleOpenReceipt(item)}
                                                        title="View Bill Receipt"
                                                    />
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    icon={Edit2}
                                                    onClick={() => handleOpenEdit(item)}
                                                    title="Edit Expense"
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    icon={Trash2}
                                                    onClick={() => handleDeleteClick(item)}
                                                    title="Delete Expense"
                                                    className="hover:text-rose-600"
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>

                {/* PAGINATION */}
                {totalCount > pageSize && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={Math.ceil(totalCount / pageSize)}
                        totalItems={totalCount}
                        itemsPerPage={pageSize}
                        onPageChange={(page) => setCurrentPage(page)}
                    />
                )}
            </Card>

            {/* RECORD / EDIT EXPENSE MODAL */}
            <Modal
                isOpen={isFormOpen}
                onClose={() => !formSubmitting && setIsFormOpen(false)}
                title={editingExpense ? "Edit Expense Record" : "Record New Expense"}
                className="max-w-2xl"
            >
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    {formError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700 flex items-center gap-2">
                            <AlertCircle size={15} className="shrink-0" />
                            <span>{formError}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Title */}
                        <div className="sm:col-span-2">
                            <Input
                                label="Expense Title"
                                placeholder="e.g. Electricity Bill - Unit 1, Office Rent, Fiber Internet"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                required
                            />
                        </div>

                        {/* Category */}
                        <div>
                            <Dropdown
                                label="Category"
                                value={formData.category}
                                onChange={(val) => setFormData({ ...formData, category: val })}
                                options={categoryOptions.filter(o => o !== 'All').map(c => ({ value: c, label: c }))}
                                placeholder="Select Category"
                                required
                            />
                        </div>

                        {/* Amount */}
                        <div>
                            <Input
                                label="Amount (₹)"
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="0.00"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                required
                            />
                        </div>

                        {/* Expense Date */}
                        <div>
                            <Input
                                label="Expense Date"
                                type="date"
                                value={formData.expenseDate}
                                onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                                required
                            />
                        </div>

                        {/* Payment Mode */}
                        <div>
                            <Dropdown
                                label="Payment Mode"
                                value={formData.paymentMode}
                                onChange={(val) => setFormData({ ...formData, paymentMode: val })}
                                options={paymentModeOptions.filter(o => o !== 'All').map(m => ({ value: m, label: m }))}
                                placeholder="Select Mode"
                                required
                            />
                        </div>

                        {/* Paid To / Beneficiary */}
                        <div>
                            <Input
                                label="Paid To / Vendor"
                                placeholder="e.g. State Electricity Board, Landlord"
                                value={formData.paidTo}
                                onChange={(e) => setFormData({ ...formData, paidTo: e.target.value })}
                            />
                        </div>

                        {/* Reference / Invoice # */}
                        <div>
                            <Input
                                label="Ref / Transaction / Bill #"
                                placeholder="e.g. EB Consumer #, UPI Ref, Invoice #"
                                value={formData.referenceNumber}
                                onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                            />
                        </div>

                        {/* Status (User selected, no hardcoded forced default) */}
                        <div className="sm:col-span-2">
                            <Dropdown
                                label="Payment Status"
                                value={formData.status}
                                onChange={(val) => setFormData({ ...formData, status: val })}
                                options={statusOptions.filter(o => o !== 'All').map(s => ({ value: s, label: s }))}
                                placeholder="Select Payment Status"
                                required
                            />
                        </div>

                        {/* Receipt / Document Upload */}
                        <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Bill Receipt / Invoice Attachment
                            </label>
                            <div className="flex items-center gap-3 border border-slate-200 rounded-lg p-3 bg-slate-50">
                                <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer shadow-xs transition-colors">
                                    <Paperclip size={14} />
                                    <span>{uploadingReceipt ? 'Uploading...' : 'Choose File'}</span>
                                    <input
                                        type="file"
                                        multiple
                                        className="hidden"
                                        accept="image/*,.pdf,.txt"
                                        onChange={handleFileUpload}
                                        disabled={uploadingReceipt}
                                    />
                                </label>
                                <span className="text-xs text-slate-500 truncate flex-1">
                                    {formData.attachmentData.length ? `${formData.attachmentData.length} receipt(s) attached` : 'No bill/receipt attached (optional)'}
                                </span>
                            </div>
                            {formData.attachmentData.map((attachment, index) => (
                                <div key={attachment.attachmentEdid} className="flex items-center justify-between gap-2 px-3 py-2 mt-2 bg-white border border-slate-200 rounded-lg text-xs">
                                    <span className="truncate text-slate-700">{attachment.attachmentOriginalName}</span>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <UploadedDocumentButton attachment={attachment} />
                                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, attachmentData: prev.attachmentData.filter((_, i) => i !== index) }))} className="text-red-500 hover:text-red-700 font-semibold">Remove</button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Remarks */}
                        <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Remarks / Notes
                            </label>
                            <textarea
                                rows={2}
                                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-400 placeholder-slate-400 transition-colors"
                                placeholder="Additional details or notes regarding this expense..."
                                value={formData.remarks}
                                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Modal Buttons */}
                    <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsFormOpen(false)}
                            disabled={formSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={formSubmitting || uploadingReceipt}
                        >
                            {formSubmitting ? 'Saving...' : (editingExpense ? 'Update Expense' : 'Save Expense')}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* DELETE CONFIRMATION MODAL */}
            <Modal
                isOpen={deleteModalOpen}
                onClose={() => !deleting && setDeleteModalOpen(false)}
                title="Delete Expense Record"
                className="max-w-md"
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                        Are you sure you want to delete expense record <strong className="text-slate-900">{expenseToDelete?.expenseNumber}</strong> ({expenseToDelete?.title}) for <strong className="text-slate-900">{formatCurrency(expenseToDelete?.amount)}</strong>?
                    </p>
                    <p className="text-xs text-red-500 font-medium">
                        This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setDeleteModalOpen(false)}
                            disabled={deleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="danger"
                            onClick={handleConfirmDelete}
                            disabled={deleting}
                        >
                            {deleting ? 'Deleting...' : 'Delete Expense'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* EXPENSE RECEIPT POPUP COMPONENT */}
            <ExpenseReceiptModal
                isOpen={Boolean(viewingReceiptExpense)}
                onClose={() => setViewingReceiptExpense(null)}
                expense={viewingReceiptExpense}
            />
        </div>
    );
}
