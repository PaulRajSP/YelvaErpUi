import { PAGE_SIZE } from '../../common/utils';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import { Search, Eye, Users, Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Tooltip } from '../../components/ui/Tooltip';
import { Pagination } from '../../components/ui/Pagination';

export default function CustomerList() {
  const { searchCustomers } = useStore();
  const navigate = useNavigate();

  const [mobile, setMobile] = useState('');
  const [debouncedMobile, setDebouncedMobile] = useState('');
  const [customers, setCustomers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const activeRequestId = useRef(0);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Debounce mobile input (350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedMobile(mobile);
    }, 350);
    return () => clearTimeout(handler);
  }, [mobile]);

  // Reset page to 1 whenever search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedMobile]);

  // Fetch customers in background without wiping table rows
  useEffect(() => {
    const reqId = ++activeRequestId.current;
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const result = await searchCustomers(debouncedMobile.trim(), currentPage, PAGE_SIZE);
        if (reqId !== activeRequestId.current) return;

        const newItems = result.items || [];
        const newTotal = result.totalCount || 0;

        setCustomers(prev => {
          if (JSON.stringify(prev) === JSON.stringify(newItems)) return prev;
          return newItems;
        });
        setTotalCount(prev => prev === newTotal ? prev : newTotal);
        setHasSearched(true);
      } catch (error) {
        console.error('Error loading customers:', error);
      } finally {
        if (reqId === activeRequestId.current) {
          setLoading(false);
        }
      }
    };
    fetchCustomers();
  }, [debouncedMobile, currentPage, searchCustomers]);

  const handleSearch = () => {
    setDebouncedMobile(mobile);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        subtitle="View all customers or search by mobile number"
      />

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative w-[320px]">
          <input
            id="customer-mobile-search"
            type="tel"
            autoComplete="off"
            placeholder="Enter mobile number..."
            value={mobile}
            onChange={e => setMobile(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-10 pl-4 pr-10 text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all placeholder:text-slate-400"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" size={16} />
          )}
        </div>
        <Button
          onClick={handleSearch}
          disabled={loading}
          icon={loading ? Loader2 : Search}
          className={loading ? 'opacity-70 cursor-not-allowed' : ''}
        >
          {loading ? 'Searching...' : 'Search'}
        </Button>
        {mobile && (
          <button
            type="button"
            onClick={() => {
              setMobile('');
              setDebouncedMobile('');
              setCurrentPage(1);
            }}
            className="h-10 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0"
            title="Reset Search"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-left">Customer</TableHead>
                <TableHead className="text-left">Contact Number</TableHead>
                <TableHead className="text-left">Email</TableHead>
                <TableHead className="text-center">Total Orders</TableHead>
                <TableHead className="text-right">Total Spent</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => {
                const customerUrl = customer.mobile ? `/customers/${customer.edid}/${customer.mobile}` : `/customers/${customer.edid}`;
                return (
                  <TableRow
                    key={customer.edid}
                    className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                    onClick={() => navigate(customerUrl, { state: { customer } })}
                  >
                    <TableCell className="font-semibold text-slate-900">{customer.name}</TableCell>
                    <TableCell>{customer.mobile || '—'}</TableCell>
                    <TableCell>{customer.email || 'No email'}</TableCell>
                    <TableCell className="text-center">
                      {customer.totalOrders ?? 0}
                    </TableCell>
                    <TableCell className="text-right font-bold text-slate-700">
                      ₹{(customer.totalSpent ?? 0).toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-bold uppercase ${customer.active ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {customer.active === undefined ? '—' : customer.active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center" style={{ borderLeft: 'none' }} onClick={(e) => e.stopPropagation()}>
                      <Tooltip content="View">
                        <Button
                          variant="ghost"
                          size="icon"
                          icon={Eye}
                          onClick={() => navigate(customerUrl, { state: { customer } })}
                        />
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* Empty State */}
              {customers.length === 0 && (
                <TableRow>
                  <TableCell colSpan="7" className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <Users size={36} strokeWidth={1.5} />
                      <p className="font-medium text-sm">
                        {mobile.trim()
                          ? `No customers found for "${mobile.trim()}"`
                          : 'No customers found'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={totalCount}
              itemsPerPage={PAGE_SIZE}
            />
          </div>
        )}
      </Card>
    </div>
  );
}