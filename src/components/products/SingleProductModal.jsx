import { useState, useEffect } from 'react';
import { X, Tag, Users, User, Globe, Building2, Check, Save, Package, QrCode } from 'lucide-react';
import { productApi } from '../../api/productApi';

export default function SingleProductModal({ isOpen, onClose, editingProduct, onSave }) {
    const [productForm, setProductForm] = useState({
        name: '',
        qty: '1',
        sku: '',
        qrCode: '',
        mrpDirect: '',
        priceDirect: '',
        mrpOnline: '',
        priceOnline: '',
        mrpWholesale: '',
        priceWholesale: '',
        stock: '',
        allowedCustomerTypes: ['DIRECT', 'ONLINE', 'WHOLESALE']
    });

    useEffect(() => {
        if (isOpen) {
            if (editingProduct) {
                setProductForm({
                    name: editingProduct.name || '',
                    qty: editingProduct.qty || '1',
                    sku: editingProduct.sku || '',
                    qrCode: editingProduct.qrCode || editingProduct.sku || '',
                    mrpDirect: editingProduct.mrps?.DIRECT || editingProduct.mrp || '',
                    priceDirect: editingProduct.prices?.DIRECT || editingProduct.price || '',
                    mrpOnline: editingProduct.mrps?.ONLINE || editingProduct.mrp || '',
                    priceOnline: editingProduct.prices?.ONLINE || editingProduct.price || '',
                    mrpWholesale: editingProduct.mrps?.WHOLESALE || editingProduct.mrp || '',
                    priceWholesale: editingProduct.prices?.WHOLESALE || editingProduct.price || '',
                    stock: editingProduct.stock || 0,
                    allowedCustomerTypes: editingProduct.allowedCustomerTypes || ['DIRECT', 'ONLINE', 'WHOLESALE']
                });
            } else {
                setProductForm({
                    name: '',
                    qty: '1',
                    sku: '',
                    qrCode: '',
                    mrpDirect: '',
                    priceDirect: '',
                    mrpOnline: '',
                    priceOnline: '',
                    mrpWholesale: '',
                    priceWholesale: '',
                    stock: '',
                    allowedCustomerTypes: ['DIRECT', 'ONLINE', 'WHOLESALE']
                });
            }
        }
    }, [isOpen, editingProduct]);

    const handleSubmit = (e) => {
        e.preventDefault();

        const productData = {
            name: productForm.name,
            qty: parseFloat(productForm.qty) || 1,
            isCombo: false,
            qrCode: productForm.qrCode || productForm.sku || '',
            comboItems: [],
        };

        const uiMeta = {
            id: editingProduct ? editingProduct.id : undefined,
            sku: editingProduct ? productForm.sku : productForm.qrCode,
            qrCode: productForm.qrCode,
            stock: parseInt(productForm.stock) || 0,
            active: editingProduct ? editingProduct.active : true,
            allowedCustomerTypes: productForm.allowedCustomerTypes
        };

        const pricingItems = [];
        if (productForm.allowedCustomerTypes.includes('DIRECT')) {
            pricingItems.push({
                customerType: 'DIRECT',
                mrp: parseFloat(productForm.mrpDirect) || 0,
                price: parseFloat(productForm.priceDirect) || 0
            });
        }
        if (productForm.allowedCustomerTypes.includes('ONLINE')) {
            pricingItems.push({
                customerType: 'ONLINE',
                mrp: parseFloat(productForm.mrpOnline) || 0,
                price: parseFloat(productForm.priceOnline) || 0
            });
        }
        if (productForm.allowedCustomerTypes.includes('WHOLESALE')) {
            pricingItems.push({
                customerType: 'WHOLESALE',
                mrp: parseFloat(productForm.mrpWholesale) || 0,
                price: parseFloat(productForm.priceWholesale) || 0
            });
        }

        onSave(productData, uiMeta, { items: pricingItems });
    };

    if (!isOpen) return null;

    const isDirectEnabled = productForm.allowedCustomerTypes.includes('DIRECT');
    const isOnlineEnabled = productForm.allowedCustomerTypes.includes('ONLINE');
    const isWholesaleEnabled = productForm.allowedCustomerTypes.includes('WHOLESALE');

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="flex min-h-full items-center justify-center">
                <div className="bg-white rounded-2xl w-full max-w-4xl flex flex-col relative my-8 shadow-xl">

                    {/* Header */}
                    <div className="flex justify-between items-center p-6 border-b border-slate-200 sticky top-0 bg-white z-20 rounded-t-2xl">
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
                                <Package size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">
                                    {editingProduct ? 'Edit Single Product' : 'Add New Single Product'}
                                </h2>
                                <p className="text-sm text-slate-500 font-medium">Enter single product details and pricing information</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
                        {/* Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Product Name */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                                    Product Name <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Tag size={14} className="text-slate-400" />
                                    </div>
                                    <input
                                        required
                                        type="text"
                                        value={productForm.name}
                                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                        placeholder="e.g., Forest Honey"
                                    />
                                </div>
                            </div>

                            {/* Quantity / Pack Size */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                                    Quantity / Pack Size <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Package size={14} className="text-slate-400" />
                                    </div>
                                    <input
                                        required
                                        type="number"
                                        step="any"
                                        min="0.01"
                                        value={productForm.qty}
                                        onChange={(e) => setProductForm({ ...productForm, qty: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors font-semibold text-slate-800"
                                        placeholder="250 for 250g, 1 for dipper"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium">e.g. 250 for 250g, 500 for 500g, 1 for Dipper</p>
                            </div>

                            {/* QR Code */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                                    QR Code <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <QrCode size={14} className="text-slate-400" />
                                    </div>
                                    <input
                                        required
                                        type="text"
                                        value={productForm.qrCode}
                                        onChange={(e) => setProductForm({ ...productForm, qrCode: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                        placeholder="e.g., QR-HONEY-001"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Customer Tiers & Pricing */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                                    <div className="flex flex-row justify-between items-center mb-8 gap-4">
                                        <div className="flex gap-4 items-center">
                                            <div className="bg-blue-100/50 text-blue-600 p-2.5 rounded-xl shrink-0 hidden sm:block">
                                                <Users size={24} />
                                            </div>
                                            <div>
                                                <h3 className="text-base font-bold text-slate-900">Allowed Customer Types</h3>
                                                <p className="text-sm text-slate-500 font-medium mt-0.5 hidden sm:block">Select available customer types.</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-nowrap gap-3 shrink-0">
                                            {['DIRECT', 'ONLINE', 'WHOLESALE'].map(type => {
                                                const isChecked = productForm.allowedCustomerTypes.includes(type);
                                                const label = type === 'DIRECT' ? 'Direct' : type === 'ONLINE' ? 'Online' : 'Wholesale';
                                                return (
                                                    <label key={type} className={`flex items-center gap-2 text-sm font-bold px-4 py-1.5 rounded-full cursor-pointer transition-colors border ${isChecked ? 'bg-white text-blue-700 border-blue-200 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                                                        {isChecked ? (
                                                            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white shrink-0">
                                                                <Check size={12} strokeWidth={4} />
                                                            </div>
                                                        ) : (
                                                            <div className="w-4 h-4 shrink-0" />
                                                        )}
                                                        <input
                                                            type="checkbox"
                                                            className="hidden"
                                                            checked={isChecked}
                                                            onChange={(e) => {
                                                                const newTypes = e.target.checked
                                                                    ? [...productForm.allowedCustomerTypes, type]
                                                                    : productForm.allowedCustomerTypes.filter(t => t !== type);
                                                                setProductForm({ ...productForm, allowedCustomerTypes: newTypes });
                                                            }}
                                                        />
                                                        <span className="whitespace-nowrap">{label}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-200 pt-6">
                                        <div className="flex gap-4 mb-6">
                                            <div className="text-slate-400 mt-1">
                                                <Tag size={20} />
                                            </div>
                                            <div>
                                                <h3 className="text-base font-bold text-slate-900">Pricing</h3>
                                                <p className="text-sm text-slate-500 font-medium mt-0.5">Set MRP and selling rate for each customer type.</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {/* Direct Customer Card */}
                                            <div className={`bg-white border-t-[3px] border-t-blue-500 border-x border-b border-slate-200 rounded-b-xl p-4 shadow-sm transition-opacity ${!isDirectEnabled ? 'opacity-70 grayscale-[50%]' : ''}`}>
                                                <div className="flex items-center gap-3 mb-5">
                                                    <div className="bg-blue-100 text-blue-600 p-2 rounded-full">
                                                        <User size={18} />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-800">Direct Customer</h4>
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="space-y-1.5">
                                                        <label className={`text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1 ${!isDirectEnabled ? 'opacity-60' : ''}`}>MRP (₹) {isDirectEnabled && <span className="text-red-500">*</span>}</label>
                                                        <div className="relative">
                                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-medium">₹</div>
                                                            <input disabled={!isDirectEnabled} required={isDirectEnabled} type="number" min="0" value={productForm.mrpDirect} onChange={(e) => setProductForm({ ...productForm, mrpDirect: e.target.value })} className={`w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-blue-500 ${!isDirectEnabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`} placeholder="0.00" />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className={`text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1 ${!isDirectEnabled ? 'opacity-60' : ''}`}>Selling Rate (₹) {isDirectEnabled && <span className="text-red-500">*</span>}</label>
                                                        <div className="relative">
                                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-medium">₹</div>
                                                            <input disabled={!isDirectEnabled} required={isDirectEnabled} type="number" min="0" value={productForm.priceDirect} onChange={(e) => setProductForm({ ...productForm, priceDirect: e.target.value })} className={`w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-blue-500 ${!isDirectEnabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`} placeholder="0.00" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Online Customer Card */}
                                            <div className={`bg-white border-t-[3px] border-t-teal-500 border-x border-b border-slate-200 rounded-b-xl p-4 shadow-sm transition-opacity ${!isOnlineEnabled ? 'opacity-70 grayscale-[50%]' : ''}`}>
                                                <div className="flex items-center gap-3 mb-5">
                                                    <div className="bg-teal-100 text-teal-600 p-2 rounded-full">
                                                        <Globe size={18} />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-800">Online Customer</h4>
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="space-y-1.5">
                                                        <label className={`text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1 ${!isOnlineEnabled ? 'opacity-60' : ''}`}>MRP (₹) {isOnlineEnabled && <span className="text-red-500">*</span>}</label>
                                                        <div className="relative">
                                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-medium">₹</div>
                                                            <input disabled={!isOnlineEnabled} required={isOnlineEnabled} type="number" min="0" value={productForm.mrpOnline} onChange={(e) => setProductForm({ ...productForm, mrpOnline: e.target.value })} className={`w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-teal-500 ${!isOnlineEnabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`} placeholder="0.00" />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className={`text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1 ${!isOnlineEnabled ? 'opacity-60' : ''}`}>Selling Rate (₹) {isOnlineEnabled && <span className="text-red-500">*</span>}</label>
                                                        <div className="relative">
                                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-medium">₹</div>
                                                            <input disabled={!isOnlineEnabled} required={isOnlineEnabled} type="number" min="0" value={productForm.priceOnline} onChange={(e) => setProductForm({ ...productForm, priceOnline: e.target.value })} className={`w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-teal-500 ${!isOnlineEnabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`} placeholder="0.00" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Wholesale Customer Card */}
                                            <div className={`bg-white border-t-[3px] border-t-indigo-500 border-x border-b border-slate-200 rounded-b-xl p-4 shadow-sm transition-opacity ${!isWholesaleEnabled ? 'opacity-70 grayscale-[50%]' : ''}`}>
                                                <div className="flex items-center gap-3 mb-5">
                                                    <div className="bg-indigo-100 text-indigo-600 p-2 rounded-full">
                                                        <Building2 size={18} />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-800">Wholesale Customer</h4>
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="space-y-1.5">
                                                        <label className={`text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1 ${!isWholesaleEnabled ? 'opacity-60' : ''}`}>MRP (₹) {isWholesaleEnabled && <span className="text-red-500">*</span>}</label>
                                                        <div className="relative">
                                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-medium">₹</div>
                                                            <input disabled={!isWholesaleEnabled} required={isWholesaleEnabled} type="number" min="0" value={productForm.mrpWholesale} onChange={(e) => setProductForm({ ...productForm, mrpWholesale: e.target.value })} className={`w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-indigo-500 ${!isWholesaleEnabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`} placeholder="0.00" />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className={`text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1 ${!isWholesaleEnabled ? 'opacity-60' : ''}`}>Selling Rate (₹) {isWholesaleEnabled && <span className="text-red-500">*</span>}</label>
                                                        <div className="relative">
                                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-medium">₹</div>
                                                            <input disabled={!isWholesaleEnabled} required={isWholesaleEnabled} type="number" min="0" value={productForm.priceWholesale} onChange={(e) => setProductForm({ ...productForm, priceWholesale: e.target.value })} className={`w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-indigo-500 ${!isWholesaleEnabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`} placeholder="0.00" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                        {/* Footer */}
                        <div className="pt-4 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0 bg-white p-6 mt-auto z-20 rounded-b-2xl -mx-6 -mb-6">
                            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100">
                                Cancel
                            </button>
                            <button type="submit" className="px-5 py-2.5 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2">
                                <Save size={16} /> Save Product
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
