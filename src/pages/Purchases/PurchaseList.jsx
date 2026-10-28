import { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import { purchaseApi } from '../../api/purchaseApi';
import { Search, Plus, PackageOpen, Truck, Eye, FileText, Calendar, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Dropdown from '../../components/common/Dropdown';
import DatePicker from '../../components/common/DatePicker';
import DateRangePicker from '../../components/common/DateRangePicker';
import { Card } from '../../components/ui/Card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Tooltip } from '../../components/ui/Tooltip';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { formatDate, formatDateTime, formatFilterDateToUTC, PAGE_SIZE } from '../../common/utils';

export default function Purchases() {
  const { purchases, suppliers, rawMaterials, loadPurchases, loadSuppliers, loadRawMaterials, addSupplier, searchSuppliers } = useStore();
  useEffect(() => {
    loadPurchases();
    // We no longer rely strictly on loadSuppliers for the UI list, but it's fine to keep for purchases
    loadSuppliers();
    loadRawMaterials();
  }, [loadPurchases, loadSuppliers, loadRawMaterials]);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('purchasesActiveTab') || 'invoices';
  });

  useEffect(() => {
    localStorage.setItem('purchasesActiveTab', activeTab);
  }, [activeTab]);

  const [purchasePage, setPurchasePage] = useState(1);
  const [supplierPage, setSupplierPage] = useState(1);

  const activePurchaseReqId = useRef(0);
  const activeSupplierReqId = useRef(0);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', type: '', contactName: '', mobile: '' });

  // Purchases State
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [publicIdSearch, setPublicIdSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusTypes, setStatusTypes] = useState(['']);

  const [apiPurchases, setApiPurchases] = useState([]);
  const [totalPurchases, setTotalPurchases] = useState(0);

  // Suppliers State
  const [supplierSearch, setSupplierSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [supplierTypes, setSupplierTypes] = useState(['All']);

  const [apiSuppliers, setApiSuppliers] = useState([]);
  const [totalSuppliers, setTotalSuppliers] = useState(0);

  const [debouncedSupplierSearch, setDebouncedSupplierSearch] = useState('');
  const [debouncedPurchaseSearch, setDebouncedPurchaseSearch] = useState('');
  const [debouncedPublicIdSearch, setDebouncedPublicIdSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSupplierSearch(supplierSearch);
    }, 350);
    return () => clearTimeout(handler);
  }, [supplierSearch]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedPurchaseSearch(purchaseSearch);
    }, 350);
    return () => clearTimeout(handler);
  }, [purchaseSearch]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedPublicIdSearch(publicIdSearch);
    }, 350);
    return () => clearTimeout(handler);
  }, [publicIdSearch]);

  const handleResetPurchaseFilters = () => {
    setPublicIdSearch('');
    setPurchaseSearch('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setPurchasePage(1);
  };

  const hasActivePurchaseFilters = Boolean(
    publicIdSearch ||
    purchaseSearch ||
    (statusFilter && statusFilter !== 'All') ||
    dateFrom ||
    dateTo
  );

  const handleResetSupplierFilters = () => {
    setSupplierSearch('');
    setTypeFilter('All');
    setSupplierPage(1);
  };

  const hasActiveSupplierFilters = Boolean(
    supplierSearch ||
    (typeFilter && typeFilter !== 'All')
  );

  // Reset page to 1 whenever filters change, without touching filters when page changes
  useEffect(() => {
    setPurchasePage(1);
  }, [debouncedPurchaseSearch, debouncedPublicIdSearch, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    setSupplierPage(1);
  }, [debouncedSupplierSearch, typeFilter]);

  useEffect(() => {
    if (activeTab !== 'suppliers' && !isAddModalOpen) return;
    if (supplierTypes.length > 1) return; // Already fetched

    purchaseApi.getTypes('SupplierType').then(data => {
      const items = Array.isArray(data) ? data : (data?.items || data?.Items || []);
      if (items.length > 0) {
        setSupplierTypes(['All', ...items]);
      }
    }).catch(e => console.error("Error fetching supplier types:", e));
  }, [activeTab, isAddModalOpen, supplierTypes.length]);

  // Server-side searching for Suppliers in background
  useEffect(() => {
    if (activeTab !== 'suppliers') return;

    const reqId = ++activeSupplierReqId.current;
    searchSuppliers(debouncedSupplierSearch, debouncedSupplierSearch, typeFilter, supplierPage, PAGE_SIZE).then(res => {
      if (reqId !== activeSupplierReqId.current) return;
      const newItems = res?.items || [];
      const newCount = res?.totalCount || 0;
      setApiSuppliers(prev => {
        if (JSON.stringify(prev) === JSON.stringify(newItems)) return prev;
        return newItems;
      });
      setTotalSuppliers(prev => prev === newCount ? prev : newCount);
    });
  }, [debouncedSupplierSearch, typeFilter, supplierPage, searchSuppliers, activeTab]);

  // Fetch dynamic PurchaseStatus types
  useEffect(() => {
    purchaseApi.getTypes('PurchaseStatus').then(data => {
      if (data?.items) {
        setStatusTypes([{ value: '', label: 'All Statuses' }, ...data.items.map(s => ({ value: s, label: s }))]);
      }
    }).catch(e => console.error("Error fetching purchase statuses:", e));
  }, []);

  // Server-side searching for Purchases in background
  useEffect(() => {
    if (activeTab !== 'invoices') return;

    const reqId = ++activePurchaseReqId.current;
    purchaseApi.getPurchases(purchasePage, PAGE_SIZE, statusFilter || null, formatFilterDateToUTC(dateFrom, false), formatFilterDateToUTC(dateTo, true), debouncedPurchaseSearch || null, debouncedPublicIdSearch || null)
      .then(res => {
        if (reqId !== activePurchaseReqId.current) return;
        const newItems = res?.data?.items || res?.items || [];
        const newCount = res?.data?.totalCount ?? res?.totalCount ?? 0;
        setApiPurchases(prev => {
          if (JSON.stringify(prev) === JSON.stringify(newItems)) return prev;
          return newItems;
        });
        setTotalPurchases(prev => prev === newCount ? prev : newCount);
      })
      .catch(e => console.error("Error fetching purchases:", e));
  }, [purchasePage, statusFilter, dateFrom, dateTo, debouncedPurchaseSearch, debouncedPublicIdSearch, activeTab]);

  const totalPurchasePages = Math.ceil(totalPurchases / PAGE_SIZE) || 1;
  const currentPaginatedPurchases = apiPurchases;

  const totalSupplierPages = Math.ceil(totalSuppliers / PAGE_SIZE) || 1;
  const currentPaginatedSuppliers = apiSuppliers;

  const statusBadge = (status) => {
    const map = { PAID: 'text-emerald-600', UNPAID: 'text-red-600', PARTIAL: 'text-amber-600' };
    return <span className={`font-bold uppercase ${map[status] || 'text-slate-600'}`}>{status}</span>;
  };


  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Purchases & Suppliers"
        subtitle="Manage inventory purchases, incoming batches, and vendors"
      />

      {/* Tabs */}
      <div className="flex bg-white border border-slate-200 rounded-lg p-1 w-max ">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${activeTab === 'invoices' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
        >
          <PackageOpen size={16} /> Purchase Invoices
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${activeTab === 'suppliers' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
        >
          <Truck size={16} /> Manage Suppliers
        </button>
      </div>

      {activeTab === 'invoices' && (
        <>
          {/* Filters & Actions for Invoices */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative bg-white border border-slate-200 rounded-lg overflow-hidden h-10 w-[140px] flex items-center">
                <span className="pl-3 pr-1 text-slate-400 font-semibold text-sm shrink-0">PUR-</span>

                <input
                  type="text"
                  autoComplete="off"
                  placeholder="1001"
                  className="w-full h-full px-1 outline-none text-sm font-semibold text-slate-900 placeholder:text-slate-400"
                  value={publicIdSearch}
                  onChange={e => {
                    setPublicIdSearch(e.target.value);
                  }}
                />
              </div>
              <div className="relative bg-white border border-slate-200 rounded-lg overflow-hidden h-10 w-[200px]">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  type="text"
                  autoComplete="off"
                  placeholder="Search supplier..."
                  className="w-full h-full pl-9 pr-4 outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400"
                  value={purchaseSearch}
                  onChange={e => { setPurchaseSearch(e.target.value); }}
                />
              </div>
              <Dropdown value={statusFilter} onChange={(v) => setStatusFilter(v)} options={statusTypes} className="w-[140px]" />
              <DateRangePicker
                startDate={dateFrom}
                endDate={dateTo}
                onChange={({ startDate, endDate }) => {
                  setDateFrom(startDate);
                  setDateTo(endDate);
                }}
                className="w-[280px]"
              />
              {hasActivePurchaseFilters && (
                <button
                  type="button"
                  onClick={handleResetPurchaseFilters}
                  className="h-10 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0"
                  title="Reset Filters"
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <button onClick={() => navigate('/purchases/new')} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-colors cursor-pointer text-sm">
              <Plus size={16} strokeWidth={3} /> New Purchase
            </button>
          </div>

          {/* Table for Invoices */}
          <Card className="overflow-auto flex flex-col">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Date</TableHead>
                  <TableHead className="text-left">Purchase</TableHead>
                  <TableHead className="text-left">Supplier</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-right">Paid Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentPaginatedPurchases.map((purchase) => {
                  const balance = (purchase.totalAmount || 0) - (purchase.paidAmount || 0);
                  return (
                    <TableRow key={purchase.edid || purchase.id}>
                      <TableCell>{formatDate(purchase.date)}</TableCell>
                      <TableCell className="whitespace-nowrap">{purchase.publicId}</TableCell>
                      <TableCell className="font-medium">{purchase.supplierName || 'Unknown Supplier'}</TableCell>
                      <TableCell className="text-right font-bold text-slate-700">₹{parseFloat(purchase.totalAmount).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">₹{parseFloat(purchase.paidAmount || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold text-red-500">₹{balance.toLocaleString()}</TableCell>
                      <TableCell className="text-center">{statusBadge(purchase.status)}</TableCell>
                      <TableCell className="text-center" style={{ borderLeft: 'none' }}>
                        <Tooltip content="View">
                          <Button variant="ghost" size="icon" icon={Eye} onClick={() => navigate(`/purchases/${purchase.edid || purchase.id}`)} />
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {currentPaginatedPurchases.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="text-center py-4 text-slate-400 font-medium">
                      No purchases found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <Pagination
              currentPage={purchasePage}
              totalPages={totalPurchasePages}
              onPageChange={setPurchasePage}
              totalItems={totalPurchases}
              itemsPerPage={PAGE_SIZE}
            />
          </Card>
        </>
      )}

      {activeTab === 'suppliers' && (
        <>
          {/* Filters & Actions for Suppliers */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
            <div className="flex gap-3">
              <div className="relative bg-white border border-slate-200 rounded-lg overflow-hidden h-10 w-[280px]">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  type="text"
                  autoComplete="off"
                  placeholder="Search suppliers..."
                  className="w-full h-full pl-9 pr-4 outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400"
                  value={supplierSearch}
                  onChange={e => { setSupplierSearch(e.target.value); }}
                />
              </div>
              <Dropdown value={typeFilter} onChange={(v) => setTypeFilter(v)} options={supplierTypes} className="w-[140px]" />
              {hasActiveSupplierFilters && (
                <button
                  type="button"
                  onClick={handleResetSupplierFilters}
                  className="h-10 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0"
                  title="Reset Filters"
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-colors cursor-pointer text-sm">
              <Plus size={16} strokeWidth={3} /> Add Supplier
            </button>
          </div>

          {/* Table for Suppliers */}
          <Card className="overflow-auto flex flex-col">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Supplier Name</TableHead>
                  <TableHead className="text-left">Type</TableHead>
                  <TableHead className="text-left">Contact Person</TableHead>
                  <TableHead className="text-left">Mobile</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentPaginatedSuppliers.map((supplier, index) => (
                  <TableRow key={supplier.edid || supplier.id || index}>
                    <TableCell>{supplier.name}</TableCell>
                    <TableCell>{supplier.type}</TableCell>
                    <TableCell>{supplier.contactName || '-'}</TableCell>
                    <TableCell>{supplier.mobile || '-'}</TableCell>
                    <TableCell className="text-right">₹{supplier.balance.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center items-center">
                        <Tooltip content="View Supplier">
                          <button onClick={() => navigate(`/purchases/suppliers/${supplier.id || supplier.edid}`)} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
                            <Eye size={16} />
                          </button>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {totalSuppliers === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="text-center py-4 text-slate-400 font-medium">
                      No suppliers found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <Pagination
              currentPage={supplierPage}
              totalPages={totalSupplierPages}
              onPageChange={setSupplierPage}
              totalItems={totalSuppliers}
              itemsPerPage={PAGE_SIZE}
            />
          </Card>
        </>
      )}
      {/* Add Supplier Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Supplier"
        className="max-w-md"
      >
        <div className="space-y-4">
          <Input
            label="Supplier Name"
            placeholder="Company or Farm Name"
            value={newSupplier.name}
            onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })}
            required
          />
          <Dropdown
            label="Supplier Type"
            value={newSupplier.type}
            onChange={v => setNewSupplier({ ...newSupplier, type: v })}
            options={supplierTypes.filter(t => t !== 'All').map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() }))}
          />
          <Input
            label="Contact Person"
            placeholder="John Doe"
            value={newSupplier.contactName}
            onChange={e => setNewSupplier({ ...newSupplier, contactName: e.target.value })}
          />
          <Input
            label="Mobile Number"
            placeholder="10-digit mobile number"
            value={newSupplier.mobile}
            onChange={e => setNewSupplier({ ...newSupplier, mobile: e.target.value })}
          />
        </div>
        <div className="flex justify-end gap-3 mt-8">
          <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={async () => {
            if (!newSupplier.name.trim()) return alert("Supplier name is required.");
            const res = await addSupplier(newSupplier);
            if (!res.success) { alert('Failed to save supplier: ' + res.message); return; }
            setIsAddModalOpen(false);
            setNewSupplier({ name: '', type: '', contactName: '', mobile: '' });
            searchSuppliers(debouncedSupplierSearch, debouncedSupplierSearch, typeFilter, supplierPage, PAGE_SIZE).then(r => {
              setApiSuppliers(r.items);
              setTotalSuppliers(r.totalCount);
            });
          }}>
            Save Supplier
          </Button>
        </div>
      </Modal>
    </div>
  );
}
