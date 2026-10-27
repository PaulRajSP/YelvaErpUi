import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import { IndianRupee, ArrowDownToLine, ArrowUpFromLine, Plus, Wallet, Search, X } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Dropdown from '../../components/common/Dropdown';
import { Card, CardContent } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Pagination } from '../../components/ui/Pagination';
import DateRangePicker from '../../components/common/DateRangePicker';
import { paymentTransactionApi } from '../../api/paymentTransactionApi';
import { commonApi } from '../../api/commonApi';
import { formatDateTime, formatFilterDateToUTC } from '../../common/utils';

export default function Accounts() {
  const { loadTransactions } = useStore();
  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [apiTransactions, setApiTransactions] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [typeOptions, setTypeOptions] = useState(['All']);
  const [categoryOptions, setCategoryOptions] = useState(['All']);
  const [liveBalance, setLiveBalance] = useState(0);

  const activeRequestId = useRef(0);

  const fetchBalance = () => {
    paymentTransactionApi.getBalance()
      .then(bal => setLiveBalance(bal?.balance ?? bal ?? 0))
      .catch(e => console.error("Failed to fetch balance", e));
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  useEffect(() => {
    const fetchEnums = async () => {
      try {
        const [typeRes, catRes] = await Promise.all([
          commonApi.getTypes('PaymentType').catch(() => null),
          commonApi.getTypes('TransactionCategory').catch(() => null),
        ]);

        if (typeRes) {
          const items = typeRes.items || typeRes.Items || (Array.isArray(typeRes) ? typeRes : []);
          setTypeOptions(['All', ...items]);
        }
        if (catRes) {
          const items = catRes.items || catRes.Items || (Array.isArray(catRes) ? catRes : []);
          setCategoryOptions(['All', ...items]);
        }
      } catch (err) {
        console.error('Failed to fetch transaction enum types', err);
      }
    };
    fetchEnums();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setDateFrom('');
    setDateTo('');
    setCategoryFilter('All');
    setTypeFilter('All');
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    searchTerm ||
    dateFrom ||
    dateTo ||
    (categoryFilter && categoryFilter !== 'All') ||
    (typeFilter && typeFilter !== 'All')
  );

  // Reset page to 1 whenever filters or debounced search change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, typeFilter, categoryFilter, dateFrom, dateTo]);

  // Fetch transactions in background
  useEffect(() => {
    const reqId = ++activeRequestId.current;
    const fetchTransactions = async () => {
      try {
        const payload = {
          pagination: {
            pageNumber: currentPage,
            pageSize: itemsPerPage,
          },
          searchKeyword: debouncedSearch?.trim() || null,
          status: (!typeFilter || typeFilter === 'All') ? null : typeFilter,
          category: (!categoryFilter || categoryFilter === 'All') ? null : categoryFilter,
          fromDate: formatFilterDateToUTC(dateFrom, false),
          toDate: formatFilterDateToUTC(dateTo, true),
        };
        const res = await paymentTransactionApi.getList(payload);
        if (reqId !== activeRequestId.current) return;

        const newItems = res?.items || [];
        const newTotal = res?.totalCount || 0;

        setApiTransactions(prev => {
          if (JSON.stringify(prev) === JSON.stringify(newItems)) return prev;
          return newItems;
        });
        setTotalItems(prev => prev === newTotal ? prev : newTotal);
      } catch (err) {
        console.error('Failed to fetch transactions', err);
      }
    };
    fetchTransactions();
  }, [currentPage, debouncedSearch, typeFilter, categoryFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [topUpForm, setTopUpForm] = useState({ amount: '', description: 'Capital Top Up' });
  const [isTopUpSubmitting, setIsTopUpSubmitting] = useState(false);

  const handleTopUpSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(topUpForm.amount);
    if (isNaN(amt) || amt <= 0) return;

    setIsTopUpSubmitting(true);
    try {
      await paymentTransactionApi.create({
        transactionNumber: `TXN-TOPUP-${Date.now().toString().slice(-6)}`,
        description: topUpForm.description?.trim() || 'Capital Top Up',
        amount: amt,
        status: 'Credit',
        category: 'TopUp',
        isActive: true
      });

      fetchBalance();
      setCurrentPage(1);

      // Refresh list
      const payload = {
        pagination: { pageNumber: 1, pageSize: itemsPerPage },
        status: (!typeFilter || typeFilter === 'All') ? null : typeFilter,
        category: (!categoryFilter || categoryFilter === 'All') ? null : categoryFilter,
      };
      const res = await paymentTransactionApi.getList(payload);
      setApiTransactions(res?.items || []);
      setTotalItems(res?.totalCount || 0);

      setIsTopUpModalOpen(false);
      setTopUpForm({ amount: '', description: 'Capital Top Up' });
    } catch (err) {
      console.error('Failed to top up wallet:', err);
    } finally {
      setIsTopUpSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts & Ledger"
        subtitle="Manage system wallet and view all financial transactions."
      />

      <div className="w-full">
        <Card className="!bg-[#22314E] !text-white relative overflow-hidden !border-0 !rounded-2xl shadow-xl">
          {/* Subtle background abstract shapes */}
          <div className="absolute inset-0 opacity-40 mix-blend-overlay pointer-events-none">
            <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-[#4F95FF]/20 blur-3xl"></div>
            <div className="absolute right-20 -bottom-20 w-48 h-48 rounded-full bg-[#4F95FF]/20 blur-3xl"></div>
            <div className="absolute left-10 -top-10 w-64 h-64 rounded-full bg-[#4F95FF]/10 blur-3xl"></div>
          </div>

          <CardContent className="h-full flex flex-col sm:flex-row justify-between items-center p-6 relative z-10">
            <div className="flex items-center gap-5 w-full sm:w-auto mb-4 sm:mb-0">
              <div className="w-[56px] h-[56px] rounded-2xl bg-gradient-to-b from-[#5C9DFF] to-[#3B77FF] flex items-center justify-center shadow-[0_4px_16px_rgba(59,119,255,0.4)] shrink-0">
                <Wallet size={28} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-[#9EADC8] text-xs font-bold tracking-widest uppercase mb-1">Available Balance</h3>
                <p className="text-4xl font-black text-white tracking-tight flex items-center gap-1">
                  <IndianRupee size={28} strokeWidth={3} /> {liveBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="w-full sm:w-auto min-w-[220px]">
              <button
                type="button"
                onClick={() => setIsTopUpModalOpen(true)}
                className="w-full bg-[#F1F5F9] text-[#334155] rounded-xl py-3.5 px-6 flex items-center justify-center gap-2 hover:bg-white transition-colors cursor-pointer border-0 shadow-sm font-bold text-[15px]"
              >
                <Plus size={18} className="text-[#3B77FF]" strokeWidth={2.5} />
                <span>Top Up Wallet</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 mt-8">
        <h3 className="font-bold text-slate-800 text-lg">Transaction History</h3>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="w-[240px]">
            <Input
              icon={Search}
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <DateRangePicker
            startDate={dateFrom}
            endDate={dateTo}
            onChange={({ startDate, endDate }) => {
              setDateFrom(startDate);
              setDateTo(endDate);
            }}
            className="w-[260px]"
          />
          <div className="w-[140px]">
            <Dropdown
              value={categoryFilter}
              onChange={(val) => setCategoryFilter(val)}
              options={categoryOptions}
              placeholder="All Categories"
            />
          </div>
          <div className="w-[120px]">
            <Dropdown
              value={typeFilter}
              onChange={(val) => setTypeFilter(val)}
              options={typeOptions}
              placeholder="All Types"
            />
          </div>
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
      </div>

      <Card className="flex flex-col">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">Date</TableHead>
              <TableHead className="text-left">Description</TableHead>
              <TableHead className="text-left">Transaction ID</TableHead>
              <TableHead className="text-center">Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-center">Type</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apiTransactions.map((txn, idx) => {
              const isCredit = String(txn.status || '').toUpperCase() === 'CREDIT';

              return (
                <TableRow key={txn.edid || txn.transactionNumber || idx}>
                  <TableCell>
                    {formatDateTime(txn.createdAt || txn.date)}
                  </TableCell>
                  <TableCell>
                    <span>{txn.description || '-'}</span>
                  </TableCell>
                  <TableCell>
                    {txn.transactionNumber || '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    {txn.category || '-'}
                  </TableCell>
                  <TableCell className={`text-right font-bold ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isCredit ? '+' : '-'} ₹ {Number(txn.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`font-bold uppercase ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isCredit ? 'CREDIT' : 'DEBIT'}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right font-bold ${txn.balance < 0 ? 'text-rose-600' : txn.balance > 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                    ₹ {Number(txn.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              );
            })}
            {apiTransactions.length === 0 && (
              <TableRow>
                <TableCell colSpan="7" className="py-16 text-center text-slate-400 font-medium">
                  No transactions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="p-4 border-t border-slate-200">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
          />
        </div>
      </Card>

      <Modal
        isOpen={isTopUpModalOpen}
        onClose={() => setIsTopUpModalOpen(false)}
        title="Top Up Wallet"
        className="max-w-md"
      >
        <form onSubmit={handleTopUpSubmit} className="space-y-4">
          <p className="text-xs text-slate-500 mb-4">Add capital to your system wallet.</p>
          <Input
            label="Amount (₹)"
            type="number"
            step="0.01"
            min="1"
            required
            autoFocus
            value={topUpForm.amount}
            onChange={e => setTopUpForm({ ...topUpForm, amount: e.target.value })}
            placeholder="10,000"
          />
          <Input
            label="Description"
            type="text"
            required
            value={topUpForm.description}
            onChange={e => setTopUpForm({ ...topUpForm, description: e.target.value })}
            placeholder="e.g., Owner Investment"
          />

          <div className="pt-4 flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsTopUpModalOpen(false)} disabled={isTopUpSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isTopUpSubmitting}>
              {isTopUpSubmitting ? 'Adding...' : 'Add Funds'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
