import { useState, useEffect } from 'react';
import { productApi } from '../../api/productApi';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { ArrowLeft, Edit2, Package, Trash2, Gift, ShoppingCart, Users, Store, ChevronDown, ChevronUp } from 'lucide-react';
import ProductModal from '../../components/products/ProductModal';
import StockModal from '../../components/products/StockModal';
import ComboProductView from './ComboProductView';
import PriceHistory from './PriceHistory';
import CombosUsingProduct from '../../components/products/CombosUsingProduct';
import PageHeader from '../../components/common/PageHeader';
import EditPricingModal from '../../components/products/EditPricingModal';
import StatusConfirmModal from '../../components/common/StatusConfirmModal';
import RecipeEditor from '../../components/products/RecipeEditor';
import ProductBatchUsageHistory from '../../components/products/ProductBatchUsageHistory';
import { Button } from '../../components/ui/Button';

const TIERS = [
  { key: 'DIRECT', label: 'Direct', Icon: Store, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  { key: 'ONLINE', label: 'Online', Icon: ShoppingCart, bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', dot: 'bg-violet-500' },
  { key: 'WHOLESALE', label: 'Wholesale', Icon: Users, bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
];

const formatPriceValue = (val) => {
  if (val == null) return null;
  if (typeof val === 'object') return val.price != null ? val.price : null;
  return val;
};

const formatMrpValue = (val) => {
  if (val == null) return null;
  if (typeof val === 'object') return val.mrp != null ? val.mrp : null;
  return val;
};

const getPriceForTier = (prices, key) => {
  if (!prices) return null;
  if (Array.isArray(prices)) {
    const item = prices.find(p => (p.customerOwnerType || p.customeromerType || p.customerType || '').toUpperCase().trim() === key);
    return item ? formatPriceValue(item.price ?? item) : null;
  }
  return formatPriceValue(prices[key]);
};

const getMrpForTier = (mrps, prices, key) => {
  if (mrps) {
    if (Array.isArray(mrps)) {
      const item = mrps.find(p => (p.customerOwnerType || p.customeromerType || p.customerType || '').toUpperCase().trim() === key);
      if (item) return formatMrpValue(item.mrp ?? item);
    } else {
      const val = formatMrpValue(mrps[key]);
      if (val != null) return val;
    }
  }
  if (prices) {
    if (Array.isArray(prices)) {
      const item = prices.find(p => (p.customerOwnerType || p.customeromerType || p.customerType || '').toUpperCase().trim() === key);
      if (item && item.mrp != null) return formatMrpValue(item.mrp);
    } else if (typeof prices[key] === 'object' && prices[key]?.mrp != null) {
      return formatMrpValue(prices[key].mrp);
    }
  }
  return null;
};

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, setProducts, rawMaterials, getProductCostBreakdown, currentUser, loadProducts, loadRawMaterials } = useStore();

  useEffect(() => { loadProducts(); loadRawMaterials(); }, [loadProducts, loadRawMaterials]);

  const isAdmin = currentUser?.role === 'Admin';
  const [product, setLocalProduct] = useState(() => products.find(p => p.id === id || p.edid === id));
  const [isLoading, setIsLoading] = useState(!product);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isRecipeOpen, setIsRecipeOpen] = useState(false);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [isEditingRecipeMode, setIsEditingRecipeMode] = useState(false);
  const [stockModal, setStockModal] = useState({ isOpen: false });
  const [priceHistoryKey, setPriceHistoryKey] = useState(0);
  const [isRecipeLoaded, setIsRecipeLoaded] = useState(false);
  const [isRecipeLoading, setIsRecipeLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      productApi.getProduct(id),
      productApi.getPricing(id).catch(() => ({ data: { items: [] } }))
    ]).then(([resProduct, resPricing]) => {
      let prodData = resProduct?.data || resProduct;
      if (prodData) {
        const prices = {}, mrps = {};

        // In case prodData already has raw prices in array or object form
        if (Array.isArray(prodData.prices)) {
          prodData.prices.forEach(p => {
            const type = (p.customerOwnerType || p.customeromerType || p.customerType || '').toUpperCase().trim();
            if (type) {
              prices[type] = typeof p.price === 'object' ? p.price?.price : p.price;
              mrps[type] = typeof p.mrp === 'object' ? p.mrp?.mrp : p.mrp;
            }
          });
        } else if (prodData.prices && typeof prodData.prices === 'object') {
          Object.entries(prodData.prices).forEach(([k, v]) => {
            if (v && typeof v === 'object') {
              prices[k] = v.price;
              mrps[k] = v.mrp;
            } else {
              prices[k] = v;
            }
          });
        }

        const pricingItems = Array.isArray(resPricing) ? resPricing : (resPricing?.items || resPricing?.data?.items || []);
        pricingItems.forEach(p => {
          const type = (p.customerOwnerType || p.customeromerType || p.customerType || '').toUpperCase().trim();
          if (type) {
            prices[type] = typeof p.price === 'object' ? p.price?.price : p.price;
            mrps[type] = typeof p.mrp === 'object' ? p.mrp?.mrp : p.mrp;
          }
        });
        prodData.prices = prices;
        prodData.mrps = mrps;
        prodData.price = prices['DIRECT'] || prodData.price || 0;
        prodData.mrp = mrps['DIRECT'] || prodData.mrp || 0;
        prodData.recipe = []; // Will be lazy loaded
        setLocalProduct(prodData);
      }
      setIsLoading(false);
    }).catch(err => { console.error(err); setIsLoading(false); });
  }, [id]);

  const handleOpenRecipe = async () => {
    setIsRecipeOpen(!isRecipeOpen);
    if (!isRecipeOpen && !isRecipeLoaded && !isRecipeLoading) {
      setIsRecipeLoading(true);
      try {
        const resRecipe = await productApi.getRecipe(id);
        const updatedRecipe = resRecipe?.data?.items || resRecipe?.items || [];
        setLocalProduct(prev => ({ ...prev, recipe: updatedRecipe }));
        setIsRecipeLoaded(true);
      } catch (e) {
        console.error('Error fetching recipe', e);
      } finally {
        setIsRecipeLoading(false);
      }
    }
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
      <p className="text-slate-400 text-sm font-medium">Loading product…</p>
    </div>
  );

  if (!product) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Package className="w-16 h-16 text-slate-200 mb-4" />
      <h2 className="text-xl font-bold text-slate-700 mb-1">Product Not Found</h2>
      <p className="text-slate-400 text-sm mb-6">This product doesn't exist or may have been removed.</p>
      <button onClick={() => navigate('/products')} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors">
        <ArrowLeft size={14} /> Back to Products
      </button>
    </div>
  );

  const handleSaveProduct = async (productData, uiMeta, pricingData) => {
    try {
      const res = await productApi.saveProduct(productData);
      const productEdid = res?.productEdid || res?.data?.productEdid || uiMeta?.id || productData.id;
      const pricingPayload = pricingData || uiMeta;
      if (productEdid && pricingPayload && pricingPayload.items) {
        await productApi.savePricing(productEdid, pricingPayload);
        const fullProduct = { ...productData, id: productEdid, prices: {}, mrps: {} };
        pricingPayload.items.forEach(p => { fullProduct.prices[p.customerType] = p.price; fullProduct.mrps[p.customerType] = p.mrp; });
        setProducts(products.map(p => p.id === productData.id ? fullProduct : p));
        setLocalProduct(prev => ({ ...prev, ...fullProduct }));
      }
      setIsProductModalOpen(false);
    } catch (err) { console.error(err); alert('Failed to save product'); }
  };

  const handleSavePricing = async (pricingPayload) => {
    try {
      const productEdid = product.edid || product.id;
      await productApi.savePricing(productEdid, pricingPayload);

      const fullProduct = { ...product };
      pricingPayload.items.forEach(p => {
        fullProduct.prices[p.customerType] = p.price;
        fullProduct.mrps[p.customerType] = p.mrp;
      });

      setProducts(products.map(p => (p.id === productEdid || p.edid === productEdid) ? fullProduct : p));
      setLocalProduct(fullProduct);
      setPriceHistoryKey(k => k + 1); // trigger PriceHistory refresh
      setIsPricingModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Failed to save pricing');
    }
  };

  const handleUpdateStock = async (productId, newStock, remarks, rmBatches, recipe) => {
    try {
      const payload = {
        productEdid: product.edid || product.id,
        productBatchEdid: "",
        batchNumber: "",
        productionQty: newStock,
        reason: "Stock Reconciliation",
        remarks: remarks || "Additional production stock",
        materials: Object.entries(rmBatches).map(([matEdid, entry]) => {
          const item = recipe?.find(r => r.materialId === matEdid || r.materialEdid === matEdid);
          return {
            materialEdid: matEdid,
            materialBatchEdid: entry?.batch?.edid,
            batchNumber: entry?.batch?.batchNumber,
            recipeItemEdid: item?.edid || item?.id || "",
            quantityUsed: entry?.requiredQty || 0
          };
        }).filter(m => m.materialBatchEdid)
      };

      const res = await productApi.reconcileProductBatch(payload);

      const remainingQty = res?.data?.remainingQty ?? newStock;
      const newBatchNumber = res?.data?.batchNumber;

      setProducts(products.map(p => (p.id === productId || p.edid === productId) ? { ...p, stock: remainingQty, batchNumber: newBatchNumber || p.batchNumber } : p));
      setLocalProduct(prev => ({ ...prev, stock: remainingQty, batchNumber: newBatchNumber || prev.batchNumber }));
      setStockModal({ isOpen: false });
    } catch (e) {
      console.error(e);
      alert('Failed to update stock: ' + (e.response?.data?.message || e.message || 'Unknown error'));
      throw e;
    }
  };

  const executeToggleStatus = async () => {
    const newStatus = !product.active;
    try {
      const targetId = product.id || product.edid;
      await productApi.toggleStatus(targetId, newStatus);
      const updated = { ...product, active: newStatus };
      setProducts(products.map(p => (p.id || p.edid) === targetId ? updated : p));
      setLocalProduct(updated);
      setIsStatusModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Failed to update product status');
    }
  };

  let maxPossible = Infinity;
  if (product.recipe?.length > 0) {
    for (const item of product.recipe) {
      const material = rawMaterials.find(rm => rm.id === item.materialId);
      if (!material) { maxPossible = 0; break; }
      const possible = Math.floor(material.stock / item.qty);
      if (possible < maxPossible) maxPossible = possible;
    }
  }
  if (maxPossible === Infinity) maxPossible = 0;

  const productEdid = product.edid || product.id;
  const stockOk = (product.stock ?? 0) > 10;

  return (
    <div className="flex flex-col gap-5 pb-8">

      {/* ── PAGE HEADER ─────────────────────────────────────── */}
      <PageHeader
        title={product.name}
        subtitle={`${product.sku} · ${product.qty ?? product.unitValue ?? ''} ${product.unitSymbol ?? product.unit ?? ''}`}
        rightContent={
          <Button variant="secondary" onClick={() => navigate('/products')} icon={ArrowLeft}>Back</Button>
        }
      />

      {/* ── STAT CARDS ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">In Stock</p>
          <div className="flex items-baseline gap-2">
            <p className={`text-2xl font-black ${stockOk ? 'text-emerald-600' : 'text-red-500'}`}>{product.stock ?? 0}</p>
            {product.recipe?.length > 0 && (
              <p className="text-slate-400 text-xs font-medium">can pack <span className="text-indigo-600 font-black">{maxPossible}</span></p>
            )}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Direct Price</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-black text-slate-900">
              {getPriceForTier(product.prices, 'DIRECT') != null ? `₹${getPriceForTier(product.prices, 'DIRECT')}` : <span className="text-slate-300">—</span>}
            </p>
            {getMrpForTier(product.mrps, product.prices, 'DIRECT') != null && (
              <p className="text-slate-400 text-xs font-medium line-through">₹{getMrpForTier(product.mrps, product.prices, 'DIRECT')}</p>
            )}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Product Type</p>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${product.isCombo ? 'bg-purple-100' : 'bg-indigo-100'}`}>
              {product.isCombo ? <Gift size={15} className="text-purple-600" /> : <Package size={15} className="text-indigo-600" />}
            </div>
            <div>
              <p className="text-base font-black text-slate-900">{product.isCombo ? 'Combo Pack' : 'Single Product'}</p>
              <div className="flex gap-1.5 mt-0.5">
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${product.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                  {product.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-5 items-start">

        {/* ── LEFT ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-5">

          {/* Recipe / Combo + Price History side by side */}
          {product.isCombo ? (
            <div className="flex gap-5 items-start">
              <div className="flex-1 min-w-0">
                <ComboProductView product={product} />
              </div>
              <div className="flex-1 min-w-0">
                <PriceHistory
                  key={priceHistoryKey}
                  productId={productEdid}
                  onEditPricing={() => setIsPricingModalOpen(true)}
                />
              </div>
            </div>
          ) : (
            <div className="flex gap-5 items-start">
              <div className="flex-1 min-w-0">
                <div className="bg-white border border-slate-200 rounded-2xl">
                  <div className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors rounded-t-2xl" onClick={handleOpenRecipe}>
                    <div className="flex items-center gap-3">
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${(isRecipeLoaded && product.recipe?.length > 0) ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                        <Package size={20} className={(isRecipeLoaded && product.recipe?.length > 0) ? 'text-indigo-600' : 'text-slate-400'} />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Bill of Materials
                        </h3>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          View or configure raw material requirements
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-slate-400">
                        {isRecipeOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`transition-all duration-300 ease-in-out ${isRecipeOpen ? 'max-h-[2000px] opacity-100 overflow-visible' : 'max-h-0 opacity-0 overflow-hidden'
                      }`}
                  >
                    {isRecipeLoading ? (
                      <div className="p-8 text-center text-slate-400 text-sm">Loading recipe...</div>
                    ) : (isEditingRecipeMode || product.recipe?.length === 0) ? (
                      <RecipeEditor
                        productEdid={productEdid}
                        initialRecipe={product.recipe}
                        onCancel={() => setIsEditingRecipeMode(false)}
                        onSave={async () => {
                          try {
                            await productApi.getRecipe(id).then(res => {
                              const updatedRecipe = res?.data?.items || res?.items || [];
                              setLocalProduct(prev => ({ ...prev, recipe: updatedRecipe }));
                            });
                            setIsEditingRecipeMode(false);
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                      />
                    ) : (
                      <div className="border-t border-slate-100">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-left">Material</TableHead>
                                <TableHead className="text-left">Category</TableHead>
                                <TableHead className="text-right">Qty Required</TableHead>
                                <TableHead className="text-left pl-4">Unit</TableHead>
                                <TableHead className="w-10"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody padRows={false}>
                              {product.recipe.map((ci, idx) => {
                                const matId = ci.materialId || ci.materialEdid;
                                const material = rawMaterials.find(rm => rm.id === matId || rm.edid === matId || rm.publicId === matId);
                                const unitStr = ci.allowedUnitSymbol || material?.allowedUnitSymbol || material?.unitSymbol || ci.unit || '';
                                const displayUnit = unitStr.length > 10 ? '' : unitStr;
                                return (
                                  <TableRow key={idx}>
                                    <TableCell className="font-medium">{material?.name || ci.materialName || 'Unknown'}</TableCell>
                                    <TableCell className="text-slate-500">{material?.category || ci.category || ''}</TableCell>
                                    <TableCell className="text-right">{ci.qty}</TableCell>
                                    <TableCell className="text-left pl-4 font-medium text-slate-700">{displayUnit}</TableCell>
                                    <TableCell>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setIsEditingRecipeMode(true); }}
                                        className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                        title="Edit Recipe"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {!product.isCombo && (
                  <div className="mt-5">
                    <CombosUsingProduct productEdid={productEdid} />
                  </div>
                )}
                {!product.isCombo && (
                  <div className="mt-5">
                    <ProductBatchUsageHistory
                      productEdid={productEdid}
                      productName={product.name}
                    />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <PriceHistory
                  key={priceHistoryKey}
                  productId={productEdid}
                  onEditPricing={() => setIsPricingModalOpen(true)}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT ─────────────────────────────────────────── */}
        <div className="w-[290px] shrink-0 flex flex-col gap-4">

          {/* Active Pricing */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Active Pricing</h3>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">Current pricing by customer type</p>
            </div>
            <div className="p-3 flex flex-col gap-2">
              {TIERS.map(({ key, label, Icon, bg, border, text, dot }) => (
                <div key={key} className={`flex items-center justify-between rounded-xl px-4 py-3 border ${bg} ${border}`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg bg-white/80 flex items-center justify-center`}>
                      <Icon size={14} className={text} />
                    </div>
                    <span className={`text-xs font-bold ${text}`}>{label}</span>
                  </div>
                  <div className="text-right">
                    {(() => {
                      const tierPrice = getPriceForTier(product.prices, key);
                      const tierMrp = getMrpForTier(product.mrps, product.prices, key);
                      if (tierPrice != null) {
                        return (
                          <>
                            <p className="text-sm font-black text-slate-900">₹{tierPrice}</p>
                            {tierMrp != null && (
                              <p className="text-[10px] text-slate-400 line-through leading-none mt-0.5">MRP ₹{tierMrp}</p>
                            )}
                          </>
                        );
                      }
                      return <span className="text-xs text-slate-300 font-medium">Not set</span>;
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Status Block */}
          {isAdmin && (
            <div className={`border rounded-2xl overflow-hidden ${product.active ? 'border-emerald-100' : 'border-amber-100'}`}>
              <div className={`px-5 py-4 border-b ${product.active ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                <h3 className={`font-bold text-sm ${product.active ? 'text-emerald-800' : 'text-amber-800'}`}>Product Status</h3>
                <p className={`text-[11px] mt-0.5 leading-relaxed ${product.active ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {product.active ? 'This product is active and available for sale.' : 'This product is currently inactive.'}
                </p>
              </div>
              <div className="p-4 bg-white">
                <button
                  onClick={() => setIsStatusModalOpen(true)}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-xl transition-all ${product.active
                    ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 shadow-amber-200'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-emerald-200'
                    }`}
                >
                  {product.active ? 'Deactivate Product' : 'Activate Product'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        editingProduct={product}
        products={products}
        onSave={handleSaveProduct}
        onDelete={() => setIsStatusModalOpen(true)}
        isComboMode={product.isCombo}
      />
      <EditPricingModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
        product={product}
        currentPrices={product.prices}
        currentMrps={product.mrps}
        onSave={handleSavePricing}
      />
      <StockModal
        isOpen={stockModal.isOpen}
        onClose={() => setStockModal({ isOpen: false })}
        product={product}
        onSave={handleUpdateStock}
      />
      <StatusConfirmModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        onConfirm={executeToggleStatus}
        isActivating={!product.active}
        productName={product.name}
      />
    </div>
  );
}
