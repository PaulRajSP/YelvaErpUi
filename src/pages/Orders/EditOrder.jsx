import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { Search, Plus, MapPin, Package, CheckCircle, CreditCard, ChevronRight, ShoppingCart, UserPlus, Building2, Wallet, Banknote, FileText, ArrowLeft, Phone, User, Edit2, Trash2, Percent, ArrowRight, Info, Tag, ChevronDown, ChevronUp, Home, Map, ShoppingBag, Save } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import SuccessModal from '../../components/common/SuccessModal';
import indianStates from '../../data/indianStates.json';
import SearchableSelect from '../../components/common/SearchableSelect';

const DetailItem = ({ icon, label, value }) => (
    <div className="flex gap-3 border-b border-slate-200 pb-3">
        <div className="text-slate-400 mt-0.5">{icon}</div>
        <div className="flex-1">
            <p className="text-[11px] text-slate-500 mb-0.5">{label}</p>
            <p className="text-sm font-bold text-slate-900">{value}</p>
        </div>
    </div>
);

export default function EditOrder() {
    const { customers, addresses, products, addCustomer, addAddress, orders, updateOrder, loadCustomers, loadProducts, loadOrderItems } = useStore();
    const navigate = useNavigate();
    const { id } = useParams();

    const order = orders.find(o => o.id === id || o.edid === id);

    useEffect(() => {
        loadCustomers();
        loadProducts();
        if (id && (!order?.items || order.items.length === 0)) {
            loadOrderItems(id).then(items => {
                if (items && items.length > 0) {
                    setCart(items);
                }
            });
        }
    }, [id, loadCustomers, loadProducts, loadOrderItems]);

    const [searchMobile, setSearchMobile] = useState(() => {
        if (order) {
            const cust = customers.find(c => c.edid === order.customerId || c.edid === order.customerEdid);
            return cust ? cust.mobile : '';
        }
        return '';
    });
    const [selectedCustomer, setSelectedCustomer] = useState(() => order ? customers.find(c => c.edid === order.customerId || c.edid === order.customerEdid) : null);
    const [selectedAddress, setSelectedAddress] = useState(() => order ? order.deliveryAddress : null);
    const [cart, setCart] = useState(() => order ? order.items : []);
    const [deliveryCharge, setDeliveryCharge] = useState(() => order ? order.deliveryCharge : 50);
    const [discount, setDiscount] = useState(() => order ? order.discount : 0);

    // Address Accordion State
    const [addressTab, setAddressTab] = useState('existing'); // 'existing' | 'new'
    const [expandedAddressId, setExpandedAddressId] = useState(null);

    // New Customer Form State
    const [isNewCustomer, setIsNewCustomer] = useState(false);
    const [newCustName, setNewCustName] = useState('');
    const [newCustEmail, setNewCustEmail] = useState('');

    // New Address Form State
    const [newAddr, setNewAddr] = useState({
        addressType: 'Home',
        recipientName: '',
        phone: '',
        phone2: '',
        house: '',
        street: '',
        city: '',
        district: '',
        state: 'Kerala',
        pincode: '',
        landmark: '',
        deliveryInstructions: ''
    });

    // Payment State
    const [paymentMethod, setPaymentMethod] = useState(() => order ? order.paymentMethod || 'UPI' : 'UPI');
    const [upiRef, setUpiRef] = useState('');
    const [couponCode, setCouponCode] = useState('');

    // Product search & filter state
    const [productSearch, setProductSearch] = useState('');
    const [productFilter, setProductFilter] = useState('All');

    // Derived: filtered products for the picker
    const filteredProducts = products.filter(p => {
        if (!p.active) return false;
        if (productFilter === 'Single' && p.isCombo) return false;
        if (productFilter === 'Combo' && !p.isCombo) return false;
        if (productSearch) {
            const q = productSearch.toLowerCase();
            return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
        }
        return true;
    });

    // Success Step
    const [isSuccess, setIsSuccess] = useState(false);
    const [finalOrderAmount, setFinalOrderAmount] = useState(0);

    if (!order) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
                <h2 className="text-xl font-bold text-slate-900">Order Not Found</h2>
            </div>
        );
    }

    const handleSearchCustomer = (e) => {
        e.preventDefault();
        const customer = customers.find(c => c.mobile === searchMobile);
        if (customer) {
            setSelectedCustomer(customer);
        } else {
            setIsNewCustomer(true);
            setNewCustName('');
            setNewCustEmail('');
        }
    };

    const handleSaveCustomer = (e) => {
        e.preventDefault();
        const newCustomer = {
            id: `c${Date.now()}`,
            name: newCustName,
            mobile: searchMobile,
            email: newCustEmail,
            totalOrders: 0,
            totalSpent: 0
        };
        addCustomer(newCustomer);
        setSelectedCustomer(newCustomer);
        setIsNewCustomer(false);
    };

    const handleSaveAddress = (e) => {
        e.preventDefault();
        const address = { ...newAddr, id: `a${Date.now()}`, customerEdid: selectedCustomer.edid, customerId: selectedCustomer.edid, name: newAddr.addressType };
        addAddress(address);
        setSelectedAddress(address);
        setExpandedAddressId(address.id);
        setAddressTab('existing');
        setNewAddr({
            addressType: 'Home', recipientName: '', phone: '', phone2: '', house: '', street: '', city: '', district: '', state: 'Kerala', pincode: '', landmark: '', deliveryInstructions: ''
        });
    };

    const addToCart = (product) => {
        const existing = cart.find(item => item.productId === product.id);
        if (existing) {
            setCart(cart.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item));
        } else {
            setCart([...cart, {
                productId: product.id,
                productNameSnapshot: product.name,
                skuSnapshot: product.sku,
                unitPrice: product.price,
                quantity: 1,
                isCombo: product.isCombo || false,
                comboItems: product.comboItems || [],
                image: product.image
            }]);
        }
    };

    const updateQuantity = (productId, delta) => {
        setCart(cart.map(item => {
            if (item.productId === productId) {
                const newQty = item.quantity + delta;
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const removeFromCart = (productId) => {
        setCart(cart.filter(item => item.productId !== productId));
    };

    const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const total = subtotal + Number(deliveryCharge) - Number(discount);

    const handlePayment = () => {
        if (!selectedCustomer || !selectedAddress || cart.length === 0) return;

        const updatedOrder = {
            ...order,
            deliveryAddress: selectedAddress,
            items: cart,
            subtotal,
            deliveryCharge: Number(deliveryCharge),
            discount: Number(discount),
            totalAmount: total,
            paymentMethod,
            ...(paymentMethod === 'UPI' && upiRef && { paymentRef: upiRef }),
            updatedAt: new Date().toISOString()
        };

        updateOrder(updatedOrder);
        setFinalOrderAmount(total);
        setIsSuccess(true);
    };



    return (
        <div className="space-y-6">
            <PageHeader
                title="Edit Order"
                subtitle={`Editing order #${order.orderNumber}`}
                rightContent={
                    <button
                        onClick={handlePayment}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer w-fit text-sm "
                    >
                        <Save size={16} strokeWidth={2.5} /> Save Changes
                    </button>
                }
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
                                <button type="submit" className="bg-[#ffc107] text-slate-900 px-4 rounded-lg hover:bg-[#e0a800] transition-colors flex items-center justify-center cursor-pointer">
                                    <Search size={18} strokeWidth={2.5} />
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
                                                <span>Previous Orders: <span className="font-bold text-slate-700">{selectedCustomer.totalOrders}</span></span>
                                                <span className="w-px h-3 bg-slate-300"></span>
                                                <span>Total Spent: <span className="font-bold text-slate-700">₹ {selectedCustomer.totalSpent}</span></span>
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
                                <div className="flex gap-2 pt-1">
                                    <button type="button" onClick={() => setIsNewCustomer(false)} className="flex-1 py-2 text-slate-600 text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer">Cancel</button>
                                    <button type="submit" className="flex-1 py-2 bg-[#ffc107] text-slate-900 text-xs font-bold rounded-lg hover:bg-[#e0a800] transition-colors cursor-pointer">Save</button>
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
                                onClick={() => setAddressTab('new')}
                            >
                                <Plus size={14} /> Add New Address
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
                                                                {addr.name.toLowerCase() === 'home' ? <Home size={12} /> : addr.name.toLowerCase() === 'office' ? <Building2 size={12} /> : <MapPin size={12} />}
                                                                {addr.name.toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <p className="font-bold text-slate-900 text-[15px] mb-2">{addr.recipientName}</p>

                                                        <div className="flex items-start gap-2 text-[13px] text-slate-500 mb-2.5">
                                                            <MapPin size={15} className="mt-0.5 text-slate-400 shrink-0" />
                                                            <p className="leading-relaxed pr-4">
                                                                {addr.house}, {addr.street}, {addr.area ? addr.area + ', ' : ''}{addr.city}, {addr.state} - {addr.pincode}
                                                            </p>
                                                        </div>

                                                        <div className="flex items-center gap-2 text-[13px] font-bold text-slate-700">
                                                            <Phone size={14} className="text-slate-400" /> {addr.phone}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end justify-between self-stretch pl-2">
                                                    {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                                                    {!isSelected && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setSelectedAddress(addr); }}
                                                            className="bg-[#ffc107] text-slate-900 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1 mt-6 transition-colors hover:bg-[#e0a800]"
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
                                                                <DetailItem icon={<Phone size={16} />} label="Customer Mobile Number 1 *" value={addr.phone} />
                                                                <DetailItem icon={<Phone size={16} />} label="Customer Mobile Number 2 (Optional)" value={addr.phone2 || '-'} />
                                                                <DetailItem icon={<Home size={16} />} label="Address Line 1 (House/Building, street) *" value={addr.house} />
                                                                <DetailItem icon={<MapPin size={16} />} label="Address Line 2 (Area, locality) (Optional)" value={addr.street || '-'} />
                                                                <DetailItem icon={<Building2 size={16} />} label="Landmark (Optional)" value={addr.landmark || '-'} />
                                                                <DetailItem icon={<Building2 size={16} />} label="City / Town *" value={addr.city} />
                                                                <DetailItem icon={<Map size={16} />} label="State" value={addr.state} />
                                                                <DetailItem icon={<MapPin size={16} />} label="PIN Code (6 digits) *" value={addr.pincode} />
                                                            </div>
                                                        </div>

                                                        {/* Bottom Banner */}
                                                        {isSelected && (
                                                            <div className="mt-3 bg-[#fffdf0] border border-[#ffc107] rounded-xl p-3 flex justify-between items-center">
                                                                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                                                                    <CheckCircle size={18} className="text-[#ffc107]" /> This is your selected delivery address
                                                                </div>
                                                                <button onClick={(e) => { e.stopPropagation(); setExpandedAddressId(null); }} className="bg-white border border-slate-300 px-4 py-1.5 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
                                                                    Close
                                                                </button>
                                                            </div>
                                                        )}

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
                                <h4 className="font-bold text-slate-900 text-base mb-4">Add New Delivery Address</h4>
                                <form onSubmit={handleSaveAddress} className="space-y-3">
                                    {/* ...Address Form Fields removed since we have the refactored component... wait no, we removed it in the last chunk! Let's put it back inline or wait, earlier we tried to refactor but we reverted when the user reverted! */}
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
                                            <input type="text" placeholder="Full Name (Person receiving order) *" value={newAddr.recipientName} onChange={e => setNewAddr({ ...newAddr, recipientName: e.target.value })} className="w-full pl-3 pr-28 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#ffc107] outline-none" required />
                                            {selectedCustomer && (
                                                <button type="button" onClick={() => setNewAddr({ ...newAddr, recipientName: selectedCustomer.name })} className="absolute right-1.5 top-1.5 bottom-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold rounded flex items-center gap-1 transition-colors cursor-pointer">
                                                    <User size={10} /> Copy Customer
                                                </button>
                                            )}
                                        </div>
                                        <div className="col-span-1 relative">
                                            <input type="tel" placeholder="Mobile Number 1 *" value={newAddr.phone} onChange={e => setNewAddr({ ...newAddr, phone: e.target.value })} className="w-full pl-3 pr-28 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#ffc107] outline-none" required maxLength={10} />
                                            {selectedCustomer && (
                                                <button type="button" onClick={() => setNewAddr({ ...newAddr, phone: selectedCustomer.mobile })} className="absolute right-1.5 top-1.5 bottom-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold rounded flex items-center gap-1 transition-colors cursor-pointer">
                                                    <Phone size={10} /> Copy Customer
                                                </button>
                                            )}
                                        </div>
                                        <div className="col-span-1">
                                            <input type="tel" placeholder="Mobile Number 2 (Optional)" value={newAddr.phone2} onChange={e => setNewAddr({ ...newAddr, phone2: e.target.value })} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#ffc107] outline-none" maxLength={10} />
                                        </div>
                                        <div className="col-span-2">
                                            <input type="text" placeholder="Address Line 1 (House/Building, street) *" value={newAddr.house} onChange={e => setNewAddr({ ...newAddr, house: e.target.value })} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#ffc107] outline-none" required />
                                        </div>
                                        <div className="col-span-2">
                                            <input type="text" placeholder="Address Line 2 (Area, locality) (Optional)" value={newAddr.street} onChange={e => setNewAddr({ ...newAddr, street: e.target.value })} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#ffc107] outline-none" />
                                        </div>
                                        <div className="col-span-2">
                                            <input type="text" placeholder="Landmark (Helpful for delivery) (Optional)" value={newAddr.landmark} onChange={e => setNewAddr({ ...newAddr, landmark: e.target.value })} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#ffc107] outline-none" />
                                        </div>
                                        <div>
                                            <input type="text" placeholder="City / Town *" value={newAddr.city} onChange={e => setNewAddr({ ...newAddr, city: e.target.value })} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#ffc107] outline-none" required />
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
                                            <input type="text" placeholder="PIN Code (6 digits) *" value={newAddr.pincode} onChange={e => setNewAddr({ ...newAddr, pincode: e.target.value })} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#ffc107] outline-none" required maxLength={6} />
                                        </div>
                                        <div className="col-span-2">
                                            <textarea placeholder="Delivery Instructions (e.g. Call before delivery) (Optional)" value={newAddr.deliveryInstructions} onChange={e => setNewAddr({ ...newAddr, deliveryInstructions: e.target.value })} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#ffc107] outline-none resize-none h-20"></textarea>
                                        </div>
                                    </div>
                                    <div className="pt-2">
                                        <button type="submit" className="w-full py-3 bg-[#ffc107] text-slate-900 text-sm font-black rounded-lg hover:bg-[#e0a800] transition-colors cursor-pointer">Save Address</button>
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

                        {/* Search with dropdown */}
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-3 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search by SKU (e.g. HON-125) or product name..."
                                value={productSearch}
                                onChange={e => setProductSearch(e.target.value)}
                                className="w-full pl-9 pr-9 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 font-medium"
                            />
                            {productSearch && (
                                <button onClick={() => setProductSearch('')} className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer leading-none">×</button>
                            )}

                            {/* Dropdown */}
                            {productSearch && (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl z-50 overflow-hidden max-h-72 overflow-y-auto">
                                    {filteredProducts.length === 0 ? (
                                        <div className="px-4 py-6 text-center text-slate-400 text-sm font-medium">
                                            No product found for "<span className="font-bold text-slate-600">{productSearch}</span>"
                                        </div>
                                    ) : filteredProducts.map(product => {
                                        const cartItem = cart.find(item => item.productId === product.id);
                                        const discountPct = Math.round(((product.mrp - product.price) / product.mrp) * 100);
                                        return (
                                            <div
                                                key={product.id}
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
                                                    <p className="font-black text-slate-900 text-sm">₹{product.price}</p>
                                                    <p className="text-[10px] text-slate-400 line-through">₹{product.mrp}</p>
                                                </div>

                                                {/* Add / stepper */}
                                                <div className="shrink-0">
                                                    {cartItem ? (
                                                        <div className="flex items-center gap-1.5 bg-slate-900 text-white rounded-lg px-2.5 py-1">
                                                            <button onClick={() => updateQuantity(product.id, -1)} className="font-black text-base leading-none cursor-pointer hover:opacity-70">−</button>
                                                            <span className="font-black text-sm w-5 text-center">{cartItem.quantity}</span>
                                                            <button onClick={() => updateQuantity(product.id, 1)} className="font-black text-base leading-none cursor-pointer hover:opacity-70">+</button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => { addToCart(product); setProductSearch(''); }}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-900 text-slate-900 text-xs font-black rounded-lg hover:bg-slate-900 hover:text-white transition-all cursor-pointer"
                                                        >
                                                            <Plus size={11} strokeWidth={3} /> Add
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Order Items Table */}
                        <h3 className="font-bold text-slate-900 text-base mb-3">Order Items</h3>
                        <div className="overflow-hidden border border-slate-200 rounded-xl">
                            <table className="w-full text-left text-sm table-fixed">
                                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                                    <tr>
                                        <th className="text-left px-4 py-2 w-[38%]">Product</th>
                                        <th className="text-right px-4 py-2 w-[18%]">Price</th>
                                        <th className="text-center px-4 py-2 w-[22%] ">Qty</th>
                                        <th className="text-right px-4 py-2 w-[14%] ">Total</th>
                                        <th className="text-center px-4 py-2 w-[8%] ">Del</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {cart.length > 0 ? (
                                        cart.map(item => (
                                            <tr key={item.productId} className="bg-white">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 bg-slate-50 rounded border border-slate-200 flex items-center justify-center shrink-0">
                                                            <img src="/logo.png" className="w-5 h-5 object-contain mix-blend-multiply opacity-50 grayscale" alt="" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-slate-900 text-[11px] leading-tight truncate">{item.productNameSnapshot}</p>
                                                            {item.isCombo && <span className="text-[9px] text-blue-500 font-bold">Combo</span>}
                                                            <p className="text-[10px] text-slate-400 font-mono">{item.skuSnapshot}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right text-xs font-bold text-slate-700">₹{item.unitPrice}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button onClick={() => updateQuantity(item.productId, -1)} className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center font-black text-slate-700 hover:bg-slate-100 cursor-pointer text-base leading-none">−</button>
                                                        <span className="font-black text-slate-900 text-sm w-5 text-center">{item.quantity}</span>
                                                        <button onClick={() => updateQuantity(item.productId, 1)} className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center font-black text-slate-700 hover:bg-slate-100 cursor-pointer text-sm leading-none">+</button>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className="font-black text-slate-900 text-xs">₹{item.unitPrice * item.quantity}</span>
                                                </td>
                                                <td className="px-4 py-3 ">
                                                    <button onClick={() => removeFromCart(item.productId)} className="cursor-pointer text-red-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr className="bg-slate-50/50 h-14">
                                            <td colSpan="5" className="px-4 ">
                                                <div className="flex items-center justify-center gap-2 text-slate-400">
                                                    <ShoppingBag size={16} className="text-slate-300" />
                                                    <span className="text-sm font-medium">No items added yet.</span>
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

                        <div className="space-y-4 mb-5">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium">Subtotal</span>
                                <span className="font-bold text-slate-900">₹ {subtotal}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                                    Discount <span className="text-green-500"><Tag size={14} strokeWidth={2.5} /></span> <Edit2 size={12} className="text-slate-300 cursor-pointer" />
                                </span>
                                <span className="font-bold text-green-500">- ₹ {discount}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium">Delivery Charge</span>
                                <span className="font-bold text-slate-900">₹ {deliveryCharge}</span>
                            </div>
                        </div>

                        <div className="pt-5 border-t border-slate-200 flex justify-between items-center mb-6">
                            <span className="font-bold text-slate-900 text-lg">Total Amount</span>
                            <span className="text-3xl font-black text-[#ffc107]">₹ {total}</span>
                        </div>

                        <div className="border-t border-slate-200 pt-6 mb-6">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="bg-[#ffc107] text-slate-900 p-1 rounded-md">
                                    <Percent size={14} strokeWidth={3} />
                                </div>
                                <h4 className="font-bold text-slate-900 text-sm">Discount Code</h4>
                            </div>
                            <p className="text-xs text-slate-500 mb-3 ml-7">Enter your code to get discount</p>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="e.g. YELVA10"
                                    value={couponCode}
                                    onChange={e => setCouponCode(e.target.value.toUpperCase())}
                                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#ffc107] placeholder:text-slate-300 uppercase"
                                />
                                <button className="px-4 py-2 border border-[#ffc107] bg-[#fffdf0] text-slate-900 font-bold rounded-lg text-sm hover:bg-[#ffc107] transition-colors cursor-pointer">
                                    Apply
                                </button>
                            </div>
                        </div>

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
                                        <div className="mt-3 ml-7">
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
                                    )}
                                </div>

                                {/* Cash Option */}
                                <div
                                    onClick={() => setPaymentMethod('Cash')}
                                    className={`border rounded-xl p-4 cursor-pointer transition-colors flex items-center gap-3 ${paymentMethod === 'Cash' ? 'border-[#ffc107] bg-[#fffdf0] ' : 'border-slate-200 bg-white'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'Cash' ? 'border-[#ffc107]' : 'border-slate-300'}`}>
                                        {paymentMethod === 'Cash' && <div className="w-2 h-2 bg-[#ffc107] rounded-full"></div>}
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-700">
                                        <Banknote size={20} strokeWidth={2} />
                                        <span className="font-bold text-slate-900 text-sm">Cash</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handlePayment}
                            className="cursor-pointer w-full bg-slate-900 text-white py-3.5 rounded-xl font-black text-[15px] hover:bg-slate-800 transition-colors flex justify-center items-center gap-2 mb-4"
                        >
                            <Save size={18} strokeWidth={2.5} /> Save Changes
                        </button>
                    </div>
                </div>
            </div>
            <SuccessModal
                isOpen={isSuccess}
                title="Order Updated!"
                message={`Order #${order.orderNumber} has been updated.`}
                primaryText="View Order"
                onPrimary={() => navigate(`/orders/${order.id}`)}
                secondaryText="Continue Editing"
                onSecondary={() => setIsSuccess(false)}
            />
        </div>
    );
}
