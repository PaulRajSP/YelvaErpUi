import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { productionApi } from '../../api/productionApi';
import { commonApi } from '../../api/commonApi';
import { PAGE_SIZE, formatDateTime } from '../../common/utils';
import {
    Activity, Plus, Search, CheckCircle2, Clock,
    AlertCircle, AlertTriangle, Eye, ChevronRight, X,
    Layers, Play, Check, Package, Sparkles
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { Tooltip } from '../../components/ui/Tooltip';
import Dropdown from '../../components/common/Dropdown';

export default function Production() {
    const navigate = useNavigate();
    const { currentUser, productionFilters, setProductionFilters } = useStore();

    // Requests State
    const [requests, setRequests] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(productionFilters?.currentPage || 1);

    // Filters
    const [searchTerm, setSearchTerm] = useState(productionFilters?.searchTerm || '');
    const [debouncedSearch, setDebouncedSearch] = useState(productionFilters?.searchTerm || '');
    const [statusFilter, setStatusFilter] = useState(productionFilters?.status || 'All');
    const [priorityFilter, setPriorityFilter] = useState(productionFilters?.priority || 'All');

    // Dynamic enum types from API
    const [statusOptions, setStatusOptions] = useState([]);
    const [priorityOptions, setPriorityOptions] = useState([]);

    // Track if options are loaded to prevent fetching before defaults are applied
    const [isOptionsLoaded, setIsOptionsLoaded] = useState(false);

    // Load Dropdown Options
    useEffect(() => {
        Promise.all([
            commonApi.getTypes('ProductionStatus').catch(err => {
                console.error('Failed to load status types:', err);
                return [];
            }),
            commonApi.getTypes('ProductionPriority').catch(err => {
                console.error('Failed to load priority types:', err);
                return [];
            })
        ]).then(([statusRes, priorityRes]) => {
            const statusItems = Array.isArray(statusRes) ? statusRes : (statusRes?.data?.items || statusRes?.items || []);
            const priorityItems = Array.isArray(priorityRes) ? priorityRes : (priorityRes?.data?.items || priorityRes?.items || []);

            let activeStatus = productionFilters?.status;
            if (statusItems.length > 0) {
                setStatusOptions(['All', ...statusItems]);
                if (!activeStatus || (activeStatus !== 'All' && !statusItems.includes(activeStatus))) {
                    activeStatus = 'All';
                }
                setStatusFilter(activeStatus);
            }

            let activePriority = productionFilters?.priority;
            if (priorityItems.length > 0) {
                setPriorityOptions(['All', ...priorityItems]);
                if (!activePriority || (activePriority !== 'All' && !priorityItems.includes(activePriority))) {
                    activePriority = 'All';
                }
                setPriorityFilter(activePriority);
            }

            // Sync with productionFilters in StoreContext
            setProductionFilters(prev => ({
                ...prev,
                status: activeStatus,
                priority: activePriority
            }));

            // Mark options as loaded so the list API can safely fire
            setIsOptionsLoaded(true);
        });
    }, []);

    const activeRequestId = useRef(0);

    // Debounce search input (skip initial mount to preserve restored search/page)
    const isInitialSearchMount = useRef(true);
    useEffect(() => {
        if (isInitialSearchMount.current) {
            isInitialSearchMount.current = false;
            return;
        }
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 350);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset page to 1 whenever filters change, without touching filters when page changes
    useEffect(() => {
        setCurrentPage(1);
        setProductionFilters(prev => ({ ...prev, currentPage: 1, searchTerm: debouncedSearch, status: statusFilter, priority: priorityFilter }));
    }, [debouncedSearch, statusFilter, priorityFilter, setProductionFilters]);

    // Fetch Requests in background without wiping table rows
    useEffect(() => {
        if (!isOptionsLoaded) return;

        const reqId = ++activeRequestId.current;
        const fetchRequests = async () => {
            setIsLoading(true);
            try {
                const res = await productionApi.getRequests(currentPage, PAGE_SIZE, {
                    status: statusFilter,
                    priority: priorityFilter,
                    searchKeyword: debouncedSearch || null
                });
                if (reqId !== activeRequestId.current) return;

                const newItems = res?.items || res?.Items || [];
                const newTotal = res?.totalCount || res?.TotalCount || 0;

                setRequests(prev => {
                    if (JSON.stringify(prev) === JSON.stringify(newItems)) return prev;
                    return newItems;
                });
                setTotalCount(prev => prev === newTotal ? prev : newTotal);
            } catch (err) {
                console.error('Failed to load production requests:', err);
            } finally {
                if (reqId === activeRequestId.current) setIsLoading(false);
            }
        };

        fetchRequests();
    }, [currentPage, statusFilter, priorityFilter, debouncedSearch, isOptionsLoaded]);

    // Metrics
    const pendingCount = useMemo(() => requests.filter(r => (r.status || '').toLowerCase() === 'pending').length, [requests]);
    const inProgressCount = useMemo(() => requests.filter(r => ['approved', 'inprogress', 'in_progress'].includes((r.status || '').toLowerCase())).length, [requests]);
    const completedCount = useMemo(() => requests.filter(r => (r.status || '').toLowerCase() === 'completed').length, [requests]);
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    return (
        <div className="space-y-6 flex flex-col h-[calc(100vh-6rem)] overflow-y-auto pb-12">
            {/* Header */}
            <PageHeader
                title="Production & Manufacturing"
                subtitle="Create production requests, select raw material batches, and monitor production status"
                rightContent={
                    <Button
                        icon={Plus}
                        onClick={() => navigate('/production/new')}
                        className="bg-slate-900 hover:bg-slate-800 text-white shadow-sm cursor-pointer"
                    >
                        New Production Request
                    </Button>
                }
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4 flex items-center justify-between border-slate-200">
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Requests</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{totalCount}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                        <Layers size={20} />
                    </div>
                </Card>

                <Card className="p-4 flex items-center justify-between border-slate-200">
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Approval</p>
                        <p className="text-2xl font-black text-amber-600 mt-1">{pendingCount}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                        <Clock size={20} />
                    </div>
                </Card>

                <Card className="p-4 flex items-center justify-between border-slate-200">
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">In Production</p>
                        <p className="text-2xl font-black text-purple-600 mt-1">{inProgressCount}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                        <Activity size={20} />
                    </div>
                </Card>

                <Card className="p-4 flex items-center justify-between border-slate-200">
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Completed</p>
                        <p className="text-2xl font-black text-emerald-600 mt-1">{completedCount}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <CheckCircle2 size={20} />
                    </div>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="w-[300px]">
                    <Input
                        actionIcon={Search}
                        placeholder="Search by request #, product, or requester..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="w-[160px]">
                    <Dropdown
                        value={statusFilter}
                        onChange={(val) => setStatusFilter(val)}
                        options={statusOptions}
                        isDefault={false}
                    />
                </div>

                <div className="w-[150px]">
                    <Dropdown
                        value={priorityFilter}
                        onChange={(val) => setPriorityFilter(val)}
                        options={priorityOptions}
                        isDefault={false}
                    />
                </div>

                {(searchTerm || (statusFilter && statusFilter !== 'All') || (priorityFilter && priorityFilter !== 'All')) && (
                    <button
                        type="button"
                        onClick={() => {
                            setSearchTerm('');
                            setDebouncedSearch('');
                            setStatusFilter('All');
                            setPriorityFilter('All');
                            setCurrentPage(1);
                        }}
                        className="h-10 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0"
                        title="Reset Filters"
                    >
                        <X size={15} />
                    </button>
                )}
            </div>

            {/* Main Table */}
            <Card className="border border-slate-200 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-left">Request No.</TableHead>
                            <TableHead className="text-left">Product</TableHead>
                            <TableHead className="text-center">Requested Qty</TableHead>
                            <TableHead className="text-center">Completed Qty</TableHead>
                            <TableHead className="text-center">Priority</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-left">Requested By</TableHead>
                            <TableHead className="text-left">Date</TableHead>
                            <TableHead className="text-center">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {requests.map((item) => (
                            <TableRow
                                key={item.edid || item.requestNumber}
                                className="cursor-pointer"
                                onClick={() => navigate(`/production/${item.edid || item.id}`)}
                            >
                                <TableCell className="font-semibold text-slate-800">
                                    {item.requestNumber}
                                </TableCell>
                                <TableCell className="font-medium">
                                    {item.productName || '-'}
                                </TableCell>
                                <TableCell className="text-center font-medium">
                                    {item.requestedQty}
                                </TableCell>
                                <TableCell className="text-center font-medium">
                                    {item.completedQty ?? 0}
                                </TableCell>
                                <TableCell className="text-center">
                                    <span className={`font-bold uppercase ${item.priority === 'High' ? 'text-red-600' : item.priority === 'Medium' ? 'text-amber-600' : 'text-slate-600'}`}>
                                        {item.priority || '-'}
                                    </span>
                                </TableCell>
                                <TableCell className="text-center">
                                    <span className={`font-bold uppercase ${
                                        item.status === 'Completed' ? 'text-emerald-600' :
                                        item.status === 'InProgress' ? 'text-blue-600' :
                                        item.status === 'Rejected' ? 'text-red-600' :
                                        'text-amber-600'
                                    }`}>
                                        {item.status || '-'}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    {item.requestedBy || '-'}
                                </TableCell>
                                <TableCell>
                                    {formatDateTime(item.createdAt)}
                                </TableCell>
                                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                    <Tooltip content="View Details">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            icon={Eye}
                                            onClick={() => navigate(`/production/${item.edid || item.id}`)}
                                        />
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}

                        {requests.length === 0 && !isLoading && (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                                    <div className="flex flex-col items-center justify-center space-y-2">
                                        <Layers size={32} className="text-slate-300 stroke-1" />
                                        <p className="font-medium text-sm">No production requests found.</p>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            icon={Plus}
                                            onClick={() => navigate('/production/new')}
                                            className="text-xs mt-2"
                                        >
                                            Create First Request
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                        {isLoading && (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                                        <span>Loading production requests...</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>

                {/* Pagination */}
                <div className="p-4 border-t border-slate-200">
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={(page) => {
                            setCurrentPage(page);
                            setProductionFilters(prev => ({ ...prev, currentPage: page }));
                        }}
                        totalItems={totalCount}
                        itemsPerPage={PAGE_SIZE}
                    />
                </div>
            </Card>
        </div>
    );
}