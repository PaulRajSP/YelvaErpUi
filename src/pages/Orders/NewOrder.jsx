import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { Search, Plus, MapPin, Package, CheckCircle, CreditCard, ChevronRight, ShoppingCart, UserPlus, Building2, Wallet, Banknote, FileText, ArrowLeft, Phone, User, Edit2, Trash2, Percent, ArrowRight, Info, Tag, ChevronDown, ChevronUp, Home, Map, ShoppingBag, Upload, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Dropdown from '../../components/common/Dropdown';
import SuccessModal from '../../components/common/SuccessModal';
import indianStates from '../../data/indianStates.json';
import SearchableSelect from '../../components/common/SearchableSelect';
import { customerApi } from '../../api/customerApi';
import { productApi } from '../../api/productApi';
import { commonApi } from '../../api/commonApi';

const DetailItem = ({ icon, label, value }) => (
    <div className="flex gap-3 border-b border-slate-200 pb-3">
        <div className="text-slate-400 mt-0.5">{icon}</div>
        <div className="flex-1">
            <p className="text-[11px] text-slate-500 mb-0.5">{label}</p>
            <p className="text-sm font-bold text-slate-900">{value}</p>
        </div>
    </div>
);

export default function NewOrder() {
    const { customers, addresses, products, addCustomer, addAddress, addOrder, addTransaction, loadProducts, searchCustomers, setAddresses } = useStore();

    const [initialOrderStatus, setInitialOrderStatus] = useState('');

    useEffect(() => {
        commonApi.getTypes('OrderStatus').then(res => {
            const items = res?.items || res?.data?.items || (Array.isArray(res) ? res : []);
            if (Array.isArray(items) && items.length > 0) {
                setInitialOrderStatus(items[0]);
            }
        }).catch(err => {
            console.error('Failed to load OrderStatus:', err);
        });
    }, []);
    const navigate = useNavigate();

    const [searchMobile, setSearchMobile] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [cart, setCart] = useState([]);
    const [cartFilter, setCartFilter] = useState('All');
    const [deliveryCharge, setDeliveryCharge] = useState(50);
    const [discount, setDiscount] = useState(0);

    // Address Accordion State
    const [addressTab, setAddressTab] = useState('existing'); // 'existing' | 'new'
    const [expandedAddressId, setExpandedAddressId] = useState(null);

    // New Customer Form State
    const [isNewCustomer, setIsNewCustomer] = useState(false);
    const [newCustName, setNewCustName] = useState('');
    const [newCustEmail, setNewCustEmail] = useState('');
    const [newCustType, setNewCustType] = useState('DIRECT');

    const [newAddr, setNewAddr] = useState({
        addressType: 'Home',
        recipientName: '',
        primaryMobile: '',
        secondaryMobile: '',
        houseStreet: '',
        areaLocality: '',
        city: '',
        district: '',
        state: 'Kerala',
        pincode: '',
        landmark: '',
        deliveryInstructions: ''
    });

    // Payment State
    const [paymentMethod, setPaymentMethod] = useState('UPI');
    const [upiRef, setUpiRef] = useState('');
    const [paidAmount, setPaidAmount] = useState('');
    const [isPaidAmountCustom, setIsPaidAmountCustom] = useState(false);
    const [paymentDocEdid, setPaymentDocEdid] = useState(null);
    const [paymentDocFileName, setPaymentDocFileName] = useState('');
    const [uploadingPaymentDoc, setUploadingPaymentDoc] = useState(false);

    // Product search & filter state
    const [productSearch, setProductSearch] = useState('');
    const [productFilter, setProductFilter] = useState('All');

    const [filteredProducts, setFilteredProducts] = useState([]);
    const [isSearchingProducts, setIsSearchingProducts] = useState(false);

    useEffect(() => {
        const fetchProducts = async () => {
            if (!selectedCustomer) {
                setFilteredProducts([]);
                return;
            }
            setIsSearchingProducts(true);
            try {
                let isComboFilter = null;
                if (productFilter === 'Single') isComboFilter = false;
                if (productFilter === 'Combo') isComboFilter = true;

                const res = await productApi.getProductsByCustomer(
                    selectedCustomer.edid,
                    productSearch,
                    isComboFilter,
                    1,
                    50
                );
                const rawItems = res?.items || [];
                const normalized = rawItems.map(p => {
                    const pricing = Array.isArray(p.productPricing) ? p.productPricing[0] : p.productPricing;
                    const price = pricing?.price !== undefined && pricing?.price !== null
                        ? Number(pricing.price)
                        : (p.price !== undefined && p.price !== null ? Number(p.price) : 0);
                    const mrp = pricing?.mrp !== undefined && pricing?.mrp !== null
                        ? Number(pricing.mrp)
                        : (p.mrp !== undefined && p.mrp !== null ? Number(p.mrp) : price);
                    const edid = p.edId || p.edid || p.id;
                    const priceItemEdid = pricing?.priceItemId || pricing?.priceItemEdid || p.priceItemEdid || p.priceItemId || null;
                    return {
                        ...p,
                        edid,
                        edId: edid,
                        id: p.id || edid,
                        price,
                        mrp,
                        priceItemEdid,
                        priceItemId: priceItemEdid,
                    };
                });
                setFilteredProducts(normalized);
            } catch (err) {
                console.error('Failed to fetch products for customer:', err);
                setFilteredProducts([]);
            } finally {
                setIsSearchingProducts(false);
            }
        };

        // Debounce search slightly
        const timer = setTimeout(fetchProducts, 300);
        return () => clearTimeout(timer);
    }, [productSearch, productFilter, selectedCustomer]);

    // Success Step
    const [isSuccess, setIsSuccess] = useState(false);
    const [finalOrderAmount, setFinalOrderAmount] = useState(0);

    const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);

    const handleSearchCustomer = async (e) => {
        e.preventDefault();
        setIsSearchingCustomer(true);
        try {
            // Try local cache first, then hit API for exact mobile match
            let customer = customers.find(c => c.mobile === searchMobile);

            if (!customer) {
                try {
                    customer = await customerApi.getCustomerByMobile(searchMobile);
                } catch {
                    customer = null;
                }
            }

            if (customer) {
                setSelectedCustomer(customer);

                // Fetch their addresses
                let fetchedAddresses = [];
                try {
                    const addrRes = await customerApi.getAddresses(customer.edid);
                    fetchedAddresses = Array.isArray(addrRes) ? addrRes : (addrRes?.items || []);
                } catch { /* no addresses yet */ }

                if (fetchedAddresses.length > 0) {
                    setAddresses(prev => {
                        const merged = [...prev];
                        fetchedAddresses.forEach(fa => {
                            const addr = { ...fa, customerEdid: customer.edid, id: fa.edid || fa.id };
                            if (!merged.some(ex => (ex.edid || ex.id) === addr.id)) {
                                merged.push(addr);
                            }
                        });
                        return merged;
                    });
                }
            } else {
                setIsNewCustomer(true);
                setNewCustName('');
                setNewCustEmail('');
                setNewCustType('DIRECT');
            }
        } catch (error) {
            console.error('Error searching customer:', error);
        } finally {
            setIsSearchingCustomer(false);
        }
    };

    const [isSavingCustomer, setIsSavingCustomer] = useState(false);

    const handleSaveCustomer = async (e) => {
        e.preventDefault();
        setIsSavingCustomer(true);
        try {
            // Save customer — apiFetch throws on failure, so reaching here means success
            await customerApi.saveCustomer({
                name: newCustName,
                mobile: searchMobile,
                email: newCustEmail,
                type: newCustType,
            });

            // Re-fetch by mobile to get the full verified customer object from backend
            const savedCustomer = await customerApi.getCustomerByMobile(searchMobile);
            if (savedCustomer && savedCustomer.edid) {
                addCustomer(savedCustomer);
                setSelectedCustomer(savedCustomer);
                setIsNewCustomer(false);
            } else {
                alert('Customer saved but could not retrieve details. Please search again.');
            }
        } catch (err) {
            console.error('Failed to save new customer:', err);
            alert('Could not save customer. Please try again.');
        } finally {
            setIsSavingCustomer(false);
        }
    };


    // Recalculate cart prices when customer changes
    useEffect(() => {
        const recalculatePrices = async () => {
            if (selectedCustomer && cart.length > 0) {
                const updatedCart = await Promise.all(cart.map(async item => {
                    try {
                        const priceRes = await productApi.getPricing(item.productId, selectedCustomer.type);
                        let newPrice = null;
                        if (Array.isArray(priceRes)) {
                            newPrice = priceRes[0]?.price;
                        } else if (priceRes?.items && Array.isArray(priceRes.items)) {
                            newPrice = priceRes.items[0]?.price;
                        } else if (priceRes?.price !== undefined) {
                            newPrice = priceRes.price;
                        }
                        if (newPrice !== null && newPrice !== undefined) {
                            return { ...item, unitPrice: Number(newPrice) };
                        }
                    } catch (e) {
                        console.error('Failed to update price for', item.productId);
                    }
                    return item;
                }));
                setCart(updatedCart);
            }
        };
        recalculatePrices();
    }, [selectedCustomer]);

    const [isSavingAddress, setIsSavingAddress] = useState(false);
    const [editingAddressId, setEditingAddressId] = useState(null);

    const handleEditAddress = (addr) => {
        setEditingAddressId(addr.edid);
        setNewAddr({
            edid: addr.edid,
            addressType: addr.addressType || 'Home',
            recipientName: addr.recipientName || '',
            primaryMobile: addr.primaryMobile || '',
            secondaryMobile: addr.secondaryMobile || '',
            houseStreet: addr.houseStreet || '',
            areaLocality: addr.areaLocality || '',
            city: addr.city || '',
            district: addr.district || '',
            state: addr.state || 'Kerala',
            pincode: addr.pincode || '',
            landmark: addr.landmark || '',
            deliveryInstructions: addr.deliveryInstructions || '',
        });
        setAddressTab('new');
    };

    const handleCancelEdit = () => {
        setEditingAddressId(null);
        setNewAddr({
            addressType: 'Home', recipientName: '', primaryMobile: '', secondaryMobile: '',
            houseStreet: '', areaLocality: '', city: '', district: '', state: 'Kerala',
            pincode: '', landmark: '', deliveryInstructions: '',
        });
        setAddressTab('existing');
    };

    const handleSaveAddress = async (e) => {
        e.preventDefault();
        setIsSavingAddress(true);
        try {
            const address = {
                addressType: newAddr.addressType || 'Home',
                recipientName: newAddr.recipientName,
                primaryMobile: newAddr.primaryMobile,
                secondaryMobile: newAddr.secondaryMobile || '',
                houseStreet: newAddr.houseStreet,
                areaLocality: newAddr.areaLocality || '',
                landmark: newAddr.landmark || '',
                city: newAddr.city,
                district: newAddr.district,
                state: newAddr.state,
                pincode: newAddr.pincode,
                deliveryInstructions: newAddr.deliveryInstructions || '',
            };

            // Save the address (creates if edid is '0', updates if existing edid)
            await customerApi.saveAddress(selectedCustomer.edid, editingAddressId || '0', address);

            // Re-fetch the full address list from backend
            const addrRes = await customerApi.getAddresses(selectedCustomer.edid);
            const freshAddresses = Array.isArray(addrRes) ? addrRes : (addrRes?.items || []);

            if (freshAddresses.length > 0) {
                // Merge into global address store
                setAddresses(prev => {
                    const merged = prev.filter(a => a.customerEdid !== selectedCustomer.edid);
                    const enhanced = freshAddresses.map(fa => ({
                        ...fa,
                        customerEdid: selectedCustomer.edid,
                        id: fa.edid || fa.id,
                    }));
                    return [...merged, ...enhanced];
                });

                // Auto-select the updated or most recent address
                const target = editingAddressId
                    ? (freshAddresses.find(fa => (fa.edid || fa.id) === editingAddressId) || freshAddresses[freshAddresses.length - 1])
                    : freshAddresses[freshAddresses.length - 1];
                setSelectedAddress({ ...target, customerEdid: selectedCustomer.edid, id: target.edid || target.id });
            }

            // Switch to existing tab and reset form
            setEditingAddressId(null);
            setAddressTab('existing');
            setNewAddr({
                addressType: 'Home', recipientName: '', primaryMobile: '', secondaryMobile: '',
                houseStreet: '', areaLocality: '', city: '', district: '', state: 'Kerala',
                pincode: '', landmark: '', deliveryInstructions: '',
            });
        } catch (err) {
            console.error('Failed to save address:', err);
            alert('Could not save address. Please try again.');
        } finally {
            setIsSavingAddress(false);
        }
    };


    const [addingToCartId, setAddingToCartId] = useState(null);

    const addToCart = async (product) => {
        const prodId = product.edId || product.edid || product.id;
        const sku = product.sku;

        // Use SKU as unique key — never duplicate the same product
        const existing = cart.find(item => item.skuSnapshot === sku);
        if (existing) {
            setCart(prev => prev.map(item => item.skuSnapshot === sku ? { ...item, quantity: item.quantity + 1 } : item));
            setProductSearch('');
            return;
        }

        const pricing = Array.isArray(product.productPricing) ? product.productPricing[0] : product.productPricing;
        const unitPrice = product.price !== undefined && product.price !== null
            ? Number(product.price)
            : Number(pricing?.price ?? 0);
        const priceItemEdid = product.priceItemEdid || product.priceItemId || pricing?.priceItemId || pricing?.priceItemEdid || null;

        setCart(prev => [...prev, {
            productId: prodId,
            productNameSnapshot: product.name,
            skuSnapshot: sku,
            priceItemEdid: priceItemEdid,
            priceItemId: priceItemEdid,
            unitPrice: unitPrice,
            quantity: 1,
            isCombo: product.isCombo || false,
            comboItems: product.comboItems || [],
            image: product.image
        }]);
        setProductSearch('');
    };

    // ---- FIX: always keyed by SKU ----
    const updateQuantity = (sku, delta) => {
        setCart(prev => prev.map(item => {
            if (item.skuSnapshot === sku) {
                const newQty = item.quantity + delta;
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    // ---- FIX: remove by SKU (consistent with the rest of the cart) ----
    const removeFromCart = (sku) => {
        setCart(prev => prev.filter(item => item.skuSnapshot !== sku));
    };

    const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const total = subtotal + Number(deliveryCharge || 0) - Number(discount || 0);

    useEffect(() => {
        if (!isPaidAmountCustom) {
            setPaidAmount(total > 0 ? String(total) : '');
        }
    }, [total, isPaidAmountCustom]);

    const handlePaidAmountChange = (val) => {
        setIsPaidAmountCustom(true);
        setPaidAmount(val);
    };

    const handlePaymentDocUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingPaymentDoc(true);
        try {
            const res = await commonApi.uploadAttachment(file);
            const data = res?.data || res;
            if (data?.edid) {
                setPaymentDocEdid(data.edid);
                setPaymentDocFileName(file.name);
            }
        } catch (err) {
            console.error('Failed to upload payment proof:', err);
            alert('Failed to upload payment document: ' + (err.message || 'Error'));
        } finally {
            setUploadingPaymentDoc(false);
            if (e.target) e.target.value = '';
        }
    };

    // Filtered cart items for display (Combo / Single / All)
    const visibleCartItems = cart.filter(item => {
        if (cartFilter === 'Single') return !item.isCombo;
        if (cartFilter === 'Combo') return item.isCombo;
        return true;
    });

    const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
    const [orderError, setOrderError] = useState(null);

    const handlePayment = async () => {
        if (!selectedCustomer || !selectedAddress || cart.length === 0) return;
        if (paymentMethod === 'UPI' && !upiRef.trim()) return;
        if (paymentMethod === 'UPI' && Number(paidAmount) > 0 && !paymentDocEdid) {
            setOrderError('Payment screenshot / receipt is required when paid amount is entered.');
            return;
        }

        setIsSubmittingOrder(true);
        setOrderError(null);

        try {
            const finalPaid = paidAmount !== '' ? Number(paidAmount) : total;
            const isFull = finalPaid >= total;
            const orderPayload = {
                customerEdid: selectedCustomer.edid,
                customerName: selectedCustomer.name,
                customerMobile: selectedCustomer.mobile,
                recipientName: selectedAddress.recipientName || selectedCustomer.name,
                deliveryType: 'HOME_DELIVERY',
                deliveryAddress: {
                    id: selectedAddress.edid || selectedAddress.id,
                    recipientName: selectedAddress.recipientName || selectedCustomer.name,
                    primaryMobile: selectedAddress.primaryMobile || selectedCustomer.mobile,
                },
                items: cart,
                subtotal,
                deliveryCharge: Number(deliveryCharge || 0),
                discount: Number(discount || 0),
                totalAmount: total,
                paidAmount: finalPaid,
                paymentMethod,
                upiRef: paymentMethod === 'UPI' ? upiRef : null,
                paymentDocEdid: paymentMethod !== 'Cash' ? (paymentDocEdid || null) : null,
                docEdid: paymentMethod !== 'Cash' ? (paymentDocEdid || null) : null,
                paymentStatus: isFull ? 'PAID' : (finalPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID'),
                initialPaymentType: isFull ? 'FullPayment' : 'Advance',
                status: initialOrderStatus || 'OrderPlaced',
                createdAt: new Date().toISOString(),
            };

            const res = await addOrder(orderPayload);

            setFinalOrderAmount(finalPaid);
            setIsSuccess(true);
        } catch (err) {
            console.error('Failed to create order:', err);
            setOrderError(err?.message || 'Failed to create order. Please try again.');
        } finally {
            setIsSubmittingOrder(false);
        }
    };




    return (
        <div className="space-y-6">
            <PageHeader
                title="Create Order"
                subtitle="Add details to confirm a prepaid order."
            />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* COLUMN 1: Customer & Address */}
                <div className="lg:col-span-4 space-y-6">

                    {/* Customer Section */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200">
                        <h3 className="font-bold text-slate-900 text-sm mb-1">Search Customer</h3>
                        <p className="text-xs text-slate-500 mb-4">Enter mobile number to find existing customer or add a new one.</p>

                        {!selectedCustomer && !isNewCustomer && (
                            <form onSubmit={handleSearchCustomer} className="flex gap-2 mb-4">
                                <div className="relative flex-1">
                                    <Phone className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="9876543210"
                                        value={searchMobile}
                                        onChange={e => setSearchMobile(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:border-[#ffc107] -[#ffc107] outline-none text-sm font-medium"
                                        required
                                    />
                                </div>
                                <button type="submit" disabled={isSearchingCustomer} className="bg-[#ffc107] text-slate-900 px-4 rounded-lg hover:bg-[#e0a800] transition-colors flex items-center justify-center cursor-pointer disabled:opacity-70">
                                    {isSearchingCustomer ? (
                                        <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <Search size={18} strokeWidth={2.5} />
                                    )}
                                </button>
                            </form>
                        )}

                        {selectedCustomer && (
                            <div className="bg-green-50 border border-green-100 p-4 rounded-xl mb-4 relative overflow-hidden group">
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-3">
                                        <div className="w-10 h-10 rounded-full bg-green-200 text-green-700 flex items-center justify-center font-bold ">
                                            <User size={20} />
                                        </div>
                                        <div>
                                            <span className="bg-green-200 text-green-800 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest mb-1 inline-block">Customer Found</span>
                                            <p className="font-bold text-slate-900 text-sm">{selectedCustomer.name}</p>
                                            <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1"><Phone size={10} /> {selectedCustomer.mobile}</p>
                                            <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500 font-medium">
                                                <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded uppercase">{selectedCustomer.type}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {isNewCustomer && (
                            <form onSubmit={handleSaveCustomer} className="space-y-3 mb-4 p-5 border border-slate-200 rounded-xl bg-slate-50 ">
                                <p className="text-sm font-bold text-slate-900">New Customer Details</p>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Mobile Number</label>
                                    <input type="text" value={searchMobile} onChange={e => setSearchMobile(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:border-[#ffc107] outline-none transition-all font-medium text-sm text-slate-900" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                                    <input type="text" placeholder="Enter customer name" value={newCustName} onChange={e => setNewCustName(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:border-[#ffc107] outline-none transition-all font-medium text-sm" required />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email (Optional)</label>
                                    <input type="email" placeholder="Enter email address" value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:border-[#ffc107] outline-none transition-all font-medium text-sm" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Customer Type</label>
                                    <Dropdown
                                        value={newCustType}
                                        onChange={(val) => val && setNewCustType(val)}
                                        options={[
                                            { id: 'DIRECT', label: 'Direct Customer' },
                                            { id: 'ONLINE', label: 'Online Customer' },
                                            { id: 'WHOLESALE', label: 'Wholesale Customer' },
                                        ]}
                                        placeholder="Select customer type"
                                    />
                                </div>
                                <div className="flex gap-2 pt-1">
                                    <button type="button" onClick={() => setIsNewCustomer(false)} className="flex-1 py-2 text-slate-600 text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer">Cancel</button>
                                    <button type="submit" disabled={isSavingCustomer} className="flex-1 py-2 bg-[#ffc107] text-slate-900 text-xs font-bold rounded-lg hover:bg-[#e0a800] transition-colors cursor-pointer disabled:opacity-70 flex items-center justify-center gap-1.5">
                                        {isSavingCustomer ? (
                                            <><div className="w-3 h-3 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" /> Saving…</>
                                        ) : 'Save Customer'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {!selectedCustomer && !isNewCustomer && (
                            <button onClick={() => setIsNewCustomer(true)} className="w-full py-2.5 border border-slate-200 text-slate-600 text-sm font-bold rounded-lg hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors cursor-pointer">
                                <UserPlus size={16} /> Add New Customer
                            </button>
                        )}
                    </div>

                    {/* Delivery Address Section */}
                    <div className={`bg-white rounded-2xl p-6 border border-slate-200 transition-opacity ${selectedCustomer ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                        <h3 className="font-bold text-slate-900 text-sm mb-1">Delivery Address</h3>
                        <p className="text-xs text-slate-500 mb-4">Select an existing address or add a new one for this order.</p>

                        <div className="flex p-1 bg-slate-100 rounded-lg mb-4">
                            <button
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all border cursor-pointer ${addressTab === 'existing' ? 'bg-[#ffc107] border-[#ffc107] text-slate-900 ' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                onClick={() => setAddressTab('existing')}
                            >
                                <MapPin size={14} /> Existing Addresses
                            </button>
                            <button
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all border cursor-pointer ${addressTab === 'new' ? 'bg-white border-slate-200 text-slate-900 ' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                onClick={() => {
                                    if (addressTab !== 'new') {
                                        setEditingAddressId(null);
                                        setNewAddr({
                                            addressType: 'Home', recipientName: '', primaryMobile: '', secondaryMobile: '',
                                            houseStreet: '', areaLocality: '', city: '', district: '', state: 'Kerala',
                                            pincode: '', landmark: '', deliveryInstructions: '',
                                        });
                                    }
                                    setAddressTab('new');
                                }}
                            >
                                {editingAddressId ? <Edit2 size={14} /> : <Plus size={14} />} {editingAddressId ? 'Edit Address' : 'Add New Address'}
                            </button>
                        </div>

                        {addressTab === 'existing' && selectedCustomer && (
                            <div className="space-y-3 mb-4">
                                {addresses.filter(a => a.customerEdid === selectedCustomer.edid || a.customerId === selectedCustomer.edid).map((addr) => {
                                    const isSelected = selectedAddress?.id === addr.id;
                                    const isExpanded = expandedAddressId === addr.id;

                                    return (
                                        <div key={addr.id} className={`p-3 rounded-xl border transition-all ${isSelected ? 'border-[#ffc107] bg-[#fffdf0] ' : 'border-slate-200 bg-white'}`}>
                                            {/* Header Row */}
                                            <div className="flex justify-between items-start cursor-pointer" onClick={() => setExpandedAddressId(isExpanded ? null : addr.id)}>
                                                <div className="flex gap-3 flex-1">
                                                    <div className="pt-1">
                                                        <input
                                                            type="radio"
                                                            checked={isSelected}
                                                            onChange={(e) => { e.stopPropagation(); setSelectedAddress(addr); setExpandedAddressId(addr.id); }}
                                                            className="w-4 h-4 text-[#ffc107] border-slate-300 -[#ffc107] cursor-pointer"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="mb-1.5">
                                                            <span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-bold items-center gap-1.5 ${isSelected ? 'bg-[#ffc107]/20 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                                                {addr.addressType?.toLowerCase() === 'home' ? <Home size={12} /> : addr.addressType?.toLowerCase() === 'office' ? <Building2 size={12} /> : <MapPin size={12} />}
                                                                {addr.addressType?.toUpperCase() || 'HOME'}
                                                            </span>
                                                        </div>
                                                        <p className="font-bold text-slate-900 text-[15px] mb-2">{addr.recipientName}</p>

                                                        <div className="flex items-start gap-2 text-[13px] text-slate-500 mb-2.5">
                                                            <MapPin size={15} className="mt-0.5 text-slate-400 shrink-0" />
                                                            <p className="leading-relaxed pr-4">
                                                                {addr.houseStreet}, {addr.areaLocality ? addr.areaLocality + ', ' : ''}{addr.city}, {addr.state} - {addr.pincode}
                                                            </p>
                                                        </div>

                                                        <div className="flex items-center gap-2 text-[13px] font-bold text-slate-700">
                                                            <Phone size={14} className="text-slate-400" /> {selectedCustomer.mobile}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end justify-between self-stretch pl-2">
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEditAddress(addr);
                                                            }}
                                                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                                            title="Edit Address"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                                                    </div>
                                                    {!isSelected && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setSelectedAddress(addr); }}
                                                            className="bg-[#ffc107] text-slate-900 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1 mt-6 transition-colors hover:bg-[#e0a800] cursor-pointer"
                                                        >
                                                            Use This <ArrowRight size={14} strokeWidth={2.5} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Animated Expanded View */}
                                            <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
                                                <div className="overflow-hidden">
                                                    <div className="pt-4 border-t border-slate-200/60">
                                                        <div className="bg-white border border-slate-200 rounded-xl p-5">
                                                            <h4 className="font-bold text-slate-900 mb-4">Full Address Details</h4>
                                                            <div className="grid grid-cols-2 gap-y-5 gap-x-8">
                                                                <DetailItem icon={<User size={16} />} label="Full Name (Person receiving order)" value={addr.recipientName} />
                                                                <DetailItem icon={<Home size={16} />} label="Address Line 1 (House/Building, street) *" value={addr.houseStreet} />
                                                                <DetailItem icon={<MapPin size={16} />} label="Address Line 2 (Area, locality) (Optional)" value={addr.areaLocality || '-'} />
                                                                <DetailItem icon={<Building2 size={16} />} label="Landmark (Optional)" value={addr.landmark || '-'} />
                                                                <DetailItem icon={<Building2 size={16} />} label="City / Town *" value={addr.city} />
                                                                <DetailItem icon={<Map size={16} />} label="State" value={addr.state} />
                                                                <DetailItem icon={<MapPin size={16} />} label="PIN Code (6 digits) *" value={addr.pincode} />
                                                            </div>
                                                        </div>

                                                        {/* Bottom Banner */}
                                                        <div className="mt-3">
                                                            {isSelected ? (
                                                                <div className="bg-[#fffdf0] border border-[#ffc107] rounded-xl p-3 flex justify-between items-center gap-2">
                                                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                                                                        <CheckCircle size={18} className="text-[#ffc107]" /> This is your selected delivery address
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => { e.stopPropagation(); handleEditAddress(addr); }}
                                                                            className="bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1"
                                                                        >
                                                                            <Edit2 size={12} /> Edit
                                                                        </button>
                                                                        <button onClick={(e) => { e.stopPropagation(); setExpandedAddressId(null); }} className="bg-white border border-slate-300 px-4 py-1.5 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
                                                                            Close
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex justify-end gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => { e.stopPropagation(); handleEditAddress(addr); }}
                                                                        className="bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1"
                                                                    >
                                                                        <Edit2 size={12} /> Edit Address
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>

                                                    </div>
                                                </div>
                                            </div>

                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {addressTab === 'new' && (
                            <div className="p-5 border border-slate-200 rounded-xl bg-slate-50 mt-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="font-bold text-slate-900 text-base">
                                        {editingAddressId ? 'Edit Delivery Address' : 'Add New Delivery Address'}
                                    </h4>
                                    {editingAddressId && (
                                        <button
                                            type="button"
                                            onClick={handleCancelEdit}
                                            className="text-xs text-amber-800 bg-amber-100 hover:bg-amber-200 font-bold px-3 py-1 rounded-md transition-colors cursor-pointer"
                                        >
                                            Cancel Edit
                                        </button>
                                    )}
                                </div>
                                <form onSubmit={handleSaveAddress} className="space-y-3" autoComplete="off">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="col-span-2 flex gap-2 mb-1">
                                            {['Home', 'Work', 'Other'].map(type => (
                                                <label key={type} className={`flex-1 flex items-center justify-center gap-2 p-2 border rounded-lg cursor-pointer text-xs font-bold transition-all ${newAddr.addressType === type ? 'border-[#ffc107] bg-[#fffdf0] text-slate-900' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                                    <input type="radio" name="addressType" value={type} checked={newAddr.addressType === type} onChange={e => setNewAddr({ ...newAddr, addressType: e.target.value })} className="hidden" />
                                                    {type}
                                                </label>
                                            ))}
                                        </div>

                                        <div className="col-span-2 relative">
                                            <input autoComplete="nope" type="text" placeholder="Full Name (Person receiving order) *" value={newAddr.recipientName} onChange={e => setNewAddr({ ...newAddr, recipientName: e.target.value })} className="w-full pl-3 pr-28 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#ffc107] outline-none" required />
                                            {selectedCustomer && (
                                                <button type="button" onClick={() => setNewAddr({ ...newAddr, recipientName: selectedCustomer.name, primaryMobile: selectedCustomer.mobile })} className="absolute right-1.5 top-1.5 bottom-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold rounded flex items-center gap-1 transition-colors cursor-pointer">
                                                    <User size={10} /> Copy Customer
                                                </button>
                                            )}
                                        </div>

                                        <div>
                                            <input autoComplete="nope" type="text" placeholder="Primary Mobile *" value={newAddr.primaryMobile} onChange={e => setNewAddr({ ...newAddr, primaryMobile: e.target.value })} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#ffc107] outline-none" required maxLength={10} />
                                        </div>
                                        <div>
                                            <input autoComplete="nope" type="text" placeholder="Secondary Mobile (Optional)" value={newAddr.secondaryMobile} onChange={e => setNewAddr({ ...newAddr, secondaryMobile: e.target.value })} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#ffc107] outline-none" maxLength={10} />
                                        </div>

                                        <div className="col-span-2">
                                            <input autoComplete="nope" type="text" placeholder="Address Line 1 (House/Building, street) *" value={newAddr.houseStreet} onChange={e => setNewAddr({ ...newAddr, houseStreet: e.target.value })} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#ffc107] outline-none" required />
                                        </div>
                                        <div className="col-span-2">
                                            <input autoComplete="nope" type="text" placeholder="Address Line 2 (Area, locality) (Optional)" value={newAddr.areaLocality} onChange={e => setNewAddr({ ...newAddr, areaLocality: e.target.value })} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#ffc107] outline-none" />
                                        </div>
                                        <div className="col-span-2">
                                            <input autoComplete="nope" type="text" placeholder="Landmark (Helpful for delivery) (Optional)" value={newAddr.landmark} onChange={e => setNewAddr({ ...newAddr, landmark: e.target.value })} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#ffc107] outline-none" />
                                        </div>
                                        <div>
                                            <input autoComplete="nope" type="text" placeholder="City / Town *" value={newAddr.city} onChange={e => setNewAddr({ ...newAddr, city: e.target.value })} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#ffc107] outline-none" required />
                                        </div>
                                        <div>
                                            <SearchableSelect
                                                value={newAddr.state}
                                                onChange={val => setNewAddr({ ...newAddr, state: val, district: '' })}
                                                options={indianStates.map(s => s.state)}
                                                placeholder="Select State *"
                                            />
                                        </div>
                                        <div>
                                            <SearchableSelect
                                                value={newAddr.district}
                                                onChange={val => setNewAddr({ ...newAddr, district: val })}
                                                options={newAddr.state ? indianStates.find(s => s.state === newAddr.state)?.districts || [] : []}
                                                placeholder="Select District *"
                                                disabled={!newAddr.state}
                                            />
                                        </div>
                                        <div>
                                            <input autoComplete="nope" type="text" placeholder="PIN Code (6 digits) *" value={newAddr.pincode} onChange={e => setNewAddr({ ...newAddr, pincode: e.target.value })} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#ffc107] outline-none" required maxLength={6} />
                                        </div>
                                        <div className="col-span-2">
                                            <textarea autoComplete="nope" placeholder="Delivery Instructions (e.g. Call before delivery) (Optional)" value={newAddr.deliveryInstructions} onChange={e => setNewAddr({ ...newAddr, deliveryInstructions: e.target.value })} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#ffc107] outline-none resize-none h-20"></textarea>
                                        </div>
                                    </div>
                                    <div className="pt-2">
                                        <button type="submit" disabled={isSavingAddress} className="w-full py-3 bg-[#ffc107] text-slate-900 text-sm font-black rounded-lg hover:bg-[#e0a800] transition-colors cursor-pointer disabled:opacity-70 flex items-center justify-center gap-2">
                                            {isSavingAddress ? (
                                                <><div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" /> {editingAddressId ? 'Updating Address…' : 'Saving Address…'}</>
                                            ) : (editingAddressId ? 'Update Address' : 'Save Address')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                </div>

                {/* COLUMN 2: Products & Cart */}
                <div className={`lg:col-span-5 space-y-6 transition-opacity ${selectedCustomer && selectedAddress ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>

                    <div className="bg-white rounded-xl p-6 border border-slate-200">
                        <h3 className="font-bold text-slate-900 text-base mb-4">Add Products</h3>

                        {/* Search + Filter row */}
                        <div className="relative mb-4">
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-3 text-slate-400" size={16} />
                                    <input
                                        autoComplete="nope"
                                        type="text"
                                        placeholder="Search by SKU or product name..."
                                        value={productSearch}
                                        onChange={e => setProductSearch(e.target.value)}
                                        className="w-full pl-9 pr-9 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 font-medium"
                                    />
                                    {productSearch && (
                                        <button onClick={() => setProductSearch('')} className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer leading-none">×</button>
                                    )}
                                </div>
                                <div className="w-36 shrink-0">
                                    <Dropdown
                                        value={productFilter}
                                        onChange={(val) => val && setProductFilter(val)}
                                        options={[
                                            { id: 'All', label: 'All Products' },
                                            { id: 'Single', label: 'Single' },
                                            { id: 'Combo', label: 'Combo' },
                                        ]}
                                        placeholder="Filter"
                                    />
                                </div>
                            </div>

                            {/* Search Results Panel */}
                            {productSearch && (
                                <div className="absolute left-0 right-36 top-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden max-h-72 overflow-y-auto">
                                    {isSearchingProducts ? (
                                        <div className="px-4 py-6 text-center flex flex-col items-center justify-center gap-2">
                                            <div className="w-5 h-5 border-2 border-[#ffc107] border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-sm font-medium text-slate-500">Searching products...</p>
                                        </div>
                                    ) : filteredProducts.length === 0 ? (
                                        <div className="px-4 py-6 text-center text-slate-400 text-sm font-medium">
                                            No product found for "<span className="font-bold text-slate-600">{productSearch}</span>"
                                        </div>
                                    ) : filteredProducts.map(product => {
                                        const cartItem = cart.find(item => item.skuSnapshot === product.sku);
                                        const pricing = Array.isArray(product.productPricing) ? product.productPricing[0] : product.productPricing;
                                        const displayPrice = product.price ?? pricing?.price ?? 0;
                                        const displayMrp = product.mrp ?? pricing?.mrp ?? displayPrice;

                                        return (
                                            <div
                                                key={product.sku}
                                                className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors"
                                            >
                                                {/* Flag badge */}
                                                <span className={`shrink-0 text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest ${product.isCombo
                                                    ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                                                    }`}>
                                                    {product.isCombo ? 'Combo' : 'Single'}
                                                </span>

                                                {/* Product info */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-slate-900 text-sm truncate">{product.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] text-slate-400 font-mono">{product.sku}</span>
                                                    </div>
                                                </div>

                                                {/* Price */}
                                                <div className="text-right shrink-0">
                                                    <p className="font-black text-slate-900 text-sm">₹{displayPrice}</p>
                                                    {Number(displayMrp) > Number(displayPrice) && (
                                                        <p className="text-[10px] text-slate-400 line-through">₹{displayMrp}</p>
                                                    )}
                                                </div>

                                                {/* Add / stepper — keyed by SKU */}
                                                <div className="shrink-0">
                                                    {cartItem ? (
                                                        <div className="flex items-center gap-1.5 bg-slate-900 text-white rounded-lg px-2.5 py-1">
                                                            <button onClick={() => updateQuantity(product.sku, -1)} className="font-black text-base leading-none cursor-pointer hover:opacity-70">−</button>
                                                            <span className="font-black text-sm w-5 text-center">{cartItem.quantity}</span>
                                                            <button onClick={() => updateQuantity(product.sku, 1)} className="font-black text-base leading-none cursor-pointer hover:opacity-70">+</button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => addToCart(product)}
                                                            disabled={addingToCartId === product.sku}
                                                            className="flex items-center justify-center gap-1 w-20 py-1.5 bg-white border border-slate-900 text-slate-900 text-xs font-black rounded-lg hover:bg-slate-900 hover:text-white transition-all cursor-pointer disabled:opacity-40"
                                                        >
                                                            {addingToCartId === product.sku ? (
                                                                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                                            ) : (
                                                                <><Plus size={11} strokeWidth={3} /> Add</>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Order Items Header + Type Filter */}
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-slate-900 text-base">Order Items</h3>
                            <div className="flex items-center gap-1.5">
                                {['All', 'Single', 'Combo'].map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setCartFilter(type)}
                                        className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-colors cursor-pointer uppercase tracking-wider ${cartFilter === type
                                            ? 'bg-slate-900 text-white border-slate-900'
                                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                            }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="overflow-hidden border border-slate-200 rounded-xl">
                            <table className="w-full text-left text-sm table-fixed">
                                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                                    <tr>
                                        <th className="text-left px-3 py-2 w-[32%]">Product</th>
                                        <th className="text-center px-2 py-2 w-[12%]">Type</th>
                                        <th className="text-right px-3 py-2 w-[15%]">Price</th>
                                        <th className="text-center px-2 py-2 w-[20%]">Qty</th>
                                        <th className="text-right px-3 py-2 w-[13%]">Total</th>
                                        <th className="text-center px-2 py-2 w-[8%]">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {visibleCartItems.length > 0 ? (
                                        visibleCartItems.map(item => (
                                            <tr key={item.skuSnapshot} className="bg-white">
                                                {/* Product */}
                                                <td className="px-3 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 bg-slate-50 rounded border border-slate-200 flex items-center justify-center shrink-0">
                                                            <img src="/logo.png" className="w-5 h-5 object-contain mix-blend-multiply opacity-50 grayscale" alt="" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-slate-900 text-[11px] leading-tight truncate">{item.productNameSnapshot}</p>
                                                            <p className="text-[10px] text-slate-400 font-mono">{item.skuSnapshot}</p>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Type: Combo or Single */}
                                                <td className="px-2 py-3 text-center">
                                                    <span className={`inline-block text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest ${item.isCombo
                                                            ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                                                        }`}>
                                                        {item.isCombo ? 'Combo' : 'Single'}
                                                    </span>
                                                </td>

                                                {/* Price */}
                                                <td className="px-3 py-3 text-right text-xs font-bold text-slate-700">₹{item.unitPrice}</td>

                                                {/* Qty stepper */}
                                                <td className="px-2 py-3">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => updateQuantity(item.skuSnapshot, -1)}
                                                            className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center font-black text-slate-700 hover:bg-slate-100 cursor-pointer text-base leading-none"
                                                        >
                                                            −
                                                        </button>
                                                        <span className="font-black text-slate-900 text-sm w-5 text-center">{item.quantity}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => updateQuantity(item.skuSnapshot, 1)}
                                                            className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center font-black text-slate-700 hover:bg-slate-100 cursor-pointer text-sm leading-none"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </td>

                                                {/* Total */}
                                                <td className="px-3 py-3 text-right">
                                                    <span className="font-black text-slate-900 text-xs">₹{item.unitPrice * item.quantity}</span>
                                                </td>

                                                {/* Action (Delete) */}
                                                <td className="px-2 py-3 text-center">
                                                    <button
                                                        onClick={() => removeFromCart(item.skuSnapshot)}
                                                        className="cursor-pointer text-red-400 hover:text-red-600 transition-colors"
                                                        title="Remove item"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr className="bg-slate-50/50 h-14">
                                            <td colSpan={6} className="px-4">
                                                <div className="flex items-center justify-center gap-2 text-slate-400">
                                                    <ShoppingBag size={16} className="text-slate-300" />
                                                    <span className="text-sm font-medium">
                                                        {cart.length === 0 ? 'No items added yet.' : `No ${cartFilter.toLowerCase()} items in cart.`}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* COLUMN 3: Payment & Summary */}
                <div className={`lg:col-span-3 space-y-6 transition-opacity ${cart.length > 0 ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 sticky top-6">
                        <h3 className="font-bold text-slate-900 text-sm mb-4">Order Summary</h3>

                        {/* Subtotal */}
                        <div className="space-y-4 mb-5">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium">Subtotal</span>
                                <span className="font-bold text-slate-900">₹ {subtotal}</span>
                            </div>
                        </div>

                        {/* Discount (manual amount entry) */}
                        <div className="border-t border-slate-200 pt-5 mb-5">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="bg-[#ffc107] text-slate-900 p-1 rounded-md">
                                    <Percent size={14} strokeWidth={3} />
                                </div>
                                <h4 className="font-bold text-slate-900 text-sm">Discount</h4>
                            </div>
                            <p className="text-xs text-slate-500 mb-3 ml-7">Enter discount amount to subtract from total</p>

                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm pointer-events-none">₹</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    placeholder="0"
                                    value={discount === 0 ? '' : discount}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setDiscount(val === '' ? 0 : Math.max(0, Number(val)));
                                    }}
                                    className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-[#ffc107] placeholder:text-slate-300"
                                />
                            </div>
                            {Number(discount) > 0 && (
                                <p className="text-[11px] text-green-600 font-bold mt-2 ml-1">
                                    − ₹ {discount} will be deducted from total
                                </p>
                            )}
                        </div>

                        {/* Delivery Charge (manual entry) */}
                        <div className="border-t border-slate-200 pt-5 mb-5">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="bg-[#ffc107] text-slate-900 p-1 rounded-md">
                                    <Package size={14} strokeWidth={2.5} />
                                </div>
                                <h4 className="font-bold text-slate-900 text-sm">Delivery Charge</h4>
                            </div>
                            <p className="text-xs text-slate-500 mb-3 ml-7">Enter delivery charge for this order</p>

                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm pointer-events-none">₹</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    placeholder="0"
                                    value={deliveryCharge === 0 ? '' : deliveryCharge}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setDeliveryCharge(val === '' ? 0 : Math.max(0, Number(val)));
                                    }}
                                    className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-[#ffc107] placeholder:text-slate-300"
                                />
                            </div>
                            {/* Quick preset chips */}
                            <div className="flex gap-2 mt-3">
                                {[0, 30, 50, 100].map(amt => (
                                    <button
                                        key={amt}
                                        type="button"
                                        onClick={() => setDeliveryCharge(amt)}
                                        className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg border transition-colors cursor-pointer ${Number(deliveryCharge) === amt
                                                ? 'bg-[#ffc107] text-slate-900 border-[#ffc107]'
                                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                            }`}
                                    >
                                        ₹{amt}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Total */}
                        <div className="pt-5 border-t border-slate-200 flex justify-between items-center mb-6">
                            <span className="font-bold text-slate-900 text-lg">Total Amount</span>
                            <span className="text-3xl font-black text-[#ffc107]">₹ {total}</span>
                        </div>

                        {/* Payment Method */}
                        <div className="border-t border-slate-200 pt-6 mb-6">
                            <div className="flex items-center gap-2 mb-4">
                                <CreditCard className="text-[#ffc107]" size={18} strokeWidth={2.5} />
                                <h4 className="font-bold text-slate-900 text-sm">Payment Method</h4>
                            </div>

                            <div className="space-y-3">
                                {/* UPI Option */}
                                <div
                                    onClick={() => setPaymentMethod('UPI')}
                                    className={`border rounded-xl p-4 cursor-pointer transition-colors ${paymentMethod === 'UPI' ? 'border-[#ffc107] bg-[#fffdf0] ' : 'border-slate-200 bg-white'}`}
                                >
                                    <div className="flex items-center gap-3 mb-1">
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'UPI' ? 'border-[#ffc107]' : 'border-slate-300'}`}>
                                            {paymentMethod === 'UPI' && <div className="w-2 h-2 bg-[#ffc107] rounded-full"></div>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {/* Official UPI logo */}
                                            <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M21.2 0L11.4 31.97L26.2 16.32L21.2 0Z" fill="#0A8940" />
                                                <path d="M12.98 0L0 31.97L18.42 15.83L12.98 0Z" fill="#F26522" />
                                            </svg>
                                            <span className="font-bold text-slate-900 text-sm">UPI</span>
                                        </div>
                                    </div>

                                    {paymentMethod === 'UPI' && (
                                        <div className="mt-3 ml-7 space-y-3">
                                            <div>
                                                <label className="text-xs text-slate-500 mb-1.5 block">Enter UPI Transaction ID <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. 123456789012"
                                                    value={upiRef}
                                                    onChange={e => setUpiRef(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[#ffc107] placeholder:text-slate-300"
                                                    onClick={e => e.stopPropagation()}
                                                />
                                            </div>

                                            {/* Paid Amount */}
                                            <div>
                                                <label className="text-xs text-slate-500 mb-1.5 block">Enter Paid Amount</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        placeholder="0.00"
                                                        value={paidAmount}
                                                        onChange={e => handlePaidAmountChange(e.target.value)}
                                                        className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-[#ffc107]"
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                </div>
                                            </div>

                                            {/* Payment Document Attachment */}
                                            <div>
                                                <label className="text-xs text-slate-500 mb-1.5 block">
                                                    Payment Attachment / Screenshot {Number(paidAmount) > 0 && <span className="text-red-500 font-bold">*</span>}
                                                </label>
                                                {paymentDocEdid ? (
                                                    <div className="flex items-center justify-between p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-xs" onClick={e => e.stopPropagation()}>
                                                        <div className="flex items-center gap-2 text-amber-900 font-semibold truncate">
                                                            <FileText size={15} className="text-amber-600 shrink-0" />
                                                            <span className="truncate">{paymentDocFileName || 'Payment Proof Attached'}</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); setPaymentDocEdid(null); setPaymentDocFileName(''); }}
                                                            className="text-rose-500 hover:text-rose-700 p-1 text-xs font-bold cursor-pointer transition-colors"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <label
                                                        className={`border-2 border-dashed ${Number(paidAmount) > 0 ? 'border-amber-300 hover:border-[#ffc107] bg-amber-50/20 hover:bg-amber-50/40' : 'border-slate-200 hover:border-[#ffc107] bg-white hover:bg-amber-50/30'} p-3 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors`}
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        <input
                                                            type="file"
                                                            accept="image/*,.pdf"
                                                            onChange={handlePaymentDocUpload}
                                                            className="hidden"
                                                            disabled={uploadingPaymentDoc}
                                                        />
                                                        {uploadingPaymentDoc ? (
                                                            <div className="flex items-center gap-2 text-xs text-amber-600 font-bold">
                                                                <Loader2 size={14} className="animate-spin" /> Uploading attachment...
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <Upload size={15} className={Number(paidAmount) > 0 ? "text-amber-500" : "text-slate-400"} />
                                                                <span className="text-xs font-bold text-slate-700">Click to upload payment screenshot / receipt</span>
                                                                <span className="text-[10px] text-slate-400">
                                                                    PNG, JPG, PDF {Number(paidAmount) > 0 ? <span className="text-rose-500 font-bold">(Required)</span> : '(Optional)'}
                                                                </span>
                                                            </>
                                                        )}
                                                    </label>
                                                )}
                                                {Number(paidAmount) > 0 && !paymentDocEdid && (
                                                    <p className="text-[11px] text-amber-700 mt-1.5 font-medium flex items-center gap-1">
                                                        <Info size={12} className="shrink-0 text-amber-600" />
                                                        Payment screenshot / receipt is required when amount is entered.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Cash Option */}
                                <div
                                    onClick={() => setPaymentMethod('Cash')}
                                    className={`border rounded-xl p-4 cursor-pointer transition-colors ${paymentMethod === 'Cash' ? 'border-[#ffc107] bg-[#fffdf0] ' : 'border-slate-200 bg-white'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'Cash' ? 'border-[#ffc107]' : 'border-slate-300'}`}>
                                            {paymentMethod === 'Cash' && <div className="w-2 h-2 bg-[#ffc107] rounded-full"></div>}
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <Banknote size={20} strokeWidth={2} />
                                            <span className="font-bold text-slate-900 text-sm">Cash</span>
                                        </div>
                                    </div>

                                    {paymentMethod === 'Cash' && (
                                        <div className="mt-3 ml-7" onClick={e => e.stopPropagation()}>
                                            <label className="text-xs text-slate-500 mb-1.5 block">Enter Paid Amount</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    placeholder="0.00"
                                                    value={paidAmount}
                                                    onChange={e => handlePaidAmountChange(e.target.value)}
                                                    className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-[#ffc107]"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handlePayment}
                            disabled={(paymentMethod === 'UPI' && (!upiRef.trim() || (Number(paidAmount) > 0 && !paymentDocEdid))) || isSubmittingOrder || uploadingPaymentDoc}
                            className="cursor-pointer w-full bg-[#ffc107] text-slate-900 py-3.5 rounded-xl font-black text-[15px] hover:bg-[#e0a800] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed transition-colors flex justify-center items-center gap-2 mb-4"
                        >
                            {isSubmittingOrder ? (
                                <><div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" /> Placing Order…</>
                            ) : (
                                <>Confirm Order <ArrowRight size={18} strokeWidth={3} /></>
                            )}
                        </button>

                        {orderError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-4 py-3 rounded-xl mb-3 flex items-start gap-2">
                                <Info size={14} className="mt-0.5 shrink-0 text-red-500" />
                                <span>{orderError}</span>
                            </div>
                        )}

                        <div className="flex justify-center items-center gap-1.5 text-xs text-slate-500">
                            <Info size={14} /> Confirm Order only after payment
                        </div>
                    </div>
                </div>
            </div>

            <SuccessModal
                isOpen={isSuccess}
                title="Order Confirmed!"
                message="The order has been created successfully."
                primaryText="View All Orders"
                onPrimary={() => navigate('/orders')}
                secondaryText="Start New Order"
                onSecondary={() => { setIsSuccess(false); setSelectedCustomer(null); setSelectedAddress(null); setCart([]); setDiscount(0); setDeliveryCharge(50); }}
            >
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-100 inline-block px-8 w-full">
                    <p className="text-2xl font-black text-green-700 tracking-tight">₹{finalOrderAmount} <span className="text-sm font-bold uppercase opacity-80 ml-1">Paid via {paymentMethod}</span></p>
                </div>
            </SuccessModal>
        </div>
    );
}