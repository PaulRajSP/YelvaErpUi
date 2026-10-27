import { PAGE_SIZE } from '../../common/utils';
import { productApi } from '../../api/productApi';
import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, Gift, Eye, Search, Loader2, X } from 'lucide-react';
import { PermissionEnum, hasPermission } from '../../common/permissions';
import ProductModal from '../../components/products/ProductModal';
import PageHeader from '../../components/common/PageHeader';
import Dropdown from '../../components/common/Dropdown';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';

export default function Products() {
  const { products, setProducts, currentUser, userPermissions } = useStore();
  const canManageProducts =
    hasPermission(userPermissions, PermissionEnum.ManageProducts) ||
    currentUser?.roles?.some(r => r?.toLowerCase() === 'admin' || r?.toLowerCase() === 'manager') ||
    currentUser?.role?.toLowerCase() === 'admin' ||
    currentUser?.role?.toLowerCase() === 'manager';
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('single'); // 'all', 'single', 'combo'

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [localProducts, setLocalProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [searchKeyword, setSearchKeyword] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState('true'); // 'true', 'false'
  const [triggerSearch, setTriggerSearch] = useState(0);

  const [debouncedSearchKeyword, setDebouncedSearchKeyword] = useState('');
  const activeRequestId = useRef(0);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchKeyword(searchKeyword);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchKeyword]);

  // Reset page to 1 whenever filters or search change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchKeyword, activeTab, isActiveFilter]);

  useEffect(() => {
    const reqId = ++activeRequestId.current;
    const fetchProducts = async () => {
      try {
        let isCombo = null;
        if (activeTab === 'single') isCombo = false;
        if (activeTab === 'combo') isCombo = true;

        const activeBool = isActiveFilter === 'true' ? true : (isActiveFilter === 'false' ? false : null);
        const keyword = debouncedSearchKeyword.trim() || null;

        const res = await productApi.getProducts(page, PAGE_SIZE, isCombo, keyword, activeBool);
        if (reqId !== activeRequestId.current) return;

        const newItems = res?.items || res?.data?.items || [];
        const newCount = res?.totalCount || res?.data?.totalCount || 0;

        setLocalProducts(prev => {
          if (JSON.stringify(prev) === JSON.stringify(newItems)) return prev;
          return newItems;
        });
        setTotalCount(prev => prev === newCount ? prev : newCount);
      } catch (err) {
        console.error('Failed to fetch products', err);
      } finally {
        if (reqId === activeRequestId.current) {
          setIsLoading(false);
        }
      }
    };
    fetchProducts();
  }, [page, activeTab, triggerSearch, isActiveFilter, debouncedSearchKeyword]);

  const handleSearch = () => {
    setPage(1);
    setTriggerSearch(prev => prev + 1);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  // Modal States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // ESC key to close modals
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setIsProductModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pagedProducts = localProducts;

  const openAddModal = () => {
    setEditingProduct(null);
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (productData, uiMeta, pricingData) => {
    try {
      const res = await productApi.saveProduct(productData);
      const productEdid = res?.data?.productEdid || res?.productEdid || uiMeta?.id;

      if (productEdid) {
        await productApi.savePricing(productEdid, pricingData);
      }

      setIsProductModalOpen(false);
      // Refresh list from server so we get real sku/stock/unit data back
      setTriggerSearch(prev => prev + 1);
    } catch (err) {
      console.error(err);
      alert('Failed to save product');
    }
  };

  const handleDeleteProduct = (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      setProducts(products.filter(p => p.id !== productId));
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Products"
        subtitle="Manage your products, combos, and stock levels"
        rightContent={
          canManageProducts && (
            <Button
              onClick={openAddModal}
              icon={Plus}
            >
              {activeTab === 'combo' ? 'Add Combo' : 'Add Product'}
            </Button>
          )
        }
      />

      {/* Tabs */}
      <div className="flex bg-white border border-slate-200 rounded-lg p-1 w-max mb-6">
        <button
          onClick={() => { setActiveTab('single'); setPage(1); }}
          className={`px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${activeTab === 'single' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
        >
          <Package size={16} /> Single Products
        </button>
        <button
          onClick={() => { setActiveTab('combo'); setPage(1); }}
          className={`px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${activeTab === 'combo' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
        >
          <Gift size={16} /> Combo Products
        </button>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative w-full sm:w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              autoComplete="off"
              placeholder="Search name, SKU or QR code..."
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-10 pl-9 pr-10 text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-lg outline-none transition-all placeholder:text-slate-400"
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" size={16} />
            )}
          </div>

          <Dropdown
            value={isActiveFilter}
            onChange={(v) => { setIsActiveFilter(v); setPage(1); }}
            options={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' }
            ]}
            className="w-[140px] h-10"
          />

          {(searchKeyword || isActiveFilter !== 'true') && (
            <button
              type="button"
              onClick={() => {
                setSearchKeyword('');
                setDebouncedSearchKeyword('');
                setIsActiveFilter('true');
                setPage(1);
              }}
              className="h-10 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0"
              title="Reset Filters"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {canManageProducts && (
          <Button
            onClick={openAddModal}
            icon={Plus}
          >
            {activeTab === 'combo' ? 'Add Combo' : 'Add Product'}
          </Button>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">Product</TableHead>
              <TableHead className="text-left">SKU</TableHead>
              <TableHead className="text-center">Stock</TableHead>
              <TableHead className="text-center">Type</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedProducts.length > 0 ? pagedProducts.map((product) => {
              const pid = product.edid || product.id;
              const isActive = product.isActive ?? product.active;
              return (
                <TableRow
                  key={pid}
                  className="transition-colors hover:bg-slate-50/60"
                >
                  <TableCell className="text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">{product.name}</span>
                    {!product.isCombo && product.qty > 0 && (
                      <span className="ml-2 text-[11px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {product.qty >= 10 ? `${product.qty}g` : `${product.qty} unit`}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">{product.sku}</TableCell>
                  <TableCell className="text-center text-sm text-slate-700">{Number(product.stock) || 0}</TableCell>
                  <TableCell className="text-center text-sm text-slate-700">
                    {product.isCombo ? 'Combo' : 'Single'}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`font-bold uppercase ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-sm text-slate-700">
                    <div className="flex justify-center items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        icon={Eye}
                        onClick={() => navigate(`/products/${pid}`)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            }) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16 text-sm text-slate-700">
                  No products found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={totalCount}
          itemsPerPage={PAGE_SIZE}
        />
      </Card>

      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        editingProduct={editingProduct}
        products={products}
        onSave={handleSaveProduct}
        onDelete={handleDeleteProduct}
        isComboMode={editingProduct ? editingProduct.isCombo : activeTab === 'combo'}
      />
    </div>
  );
}