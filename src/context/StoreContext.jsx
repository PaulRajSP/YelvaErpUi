import { createContext, useContext, useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { PAGE_SIZE } from '../common/utils';
import { authApi } from '../api/authApi';
import { TOKEN_KEY, USER_KEY, PERMISSIONS_KEY, MENUS_KEY, setStoredToken, clearStoredAuth } from '../services/apiClient';
import { hasPermission as checkPermission, hasRole as checkRole } from '../common/permissions';

// ── API modules — all raw HTTP calls live here, not in this file ──────────────
import { customerApi } from '../api/customerApi';
import { orderApi } from '../api/orderApi';
import { productApi } from '../api/productApi';
import { purchaseApi } from '../api/purchaseApi';
import { accountApi } from '../api/accountApi';
import { productionApi } from '../api/productionApi';

const StoreContext = createContext();

export function StoreProvider({ children }) {

    // ─── Auth state (restored from localStorage, no cookies) ─────────────────────
    const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null);
    const [currentUser, setCurrentUser] = useState(() => {
        try {
            const raw = localStorage.getItem(USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    });
    const [userPermissions, setUserPermissions] = useState(() => {
        try {
            const raw = localStorage.getItem(PERMISSIONS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    });
    const [userMenus, setUserMenus] = useState(() => {
        try {
            const raw = localStorage.getItem(MENUS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    });

    // ─── Data state ──────────────────────────────────────────────────────────────
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [customerTotal, setCustomerTotal] = useState(0);
    const [addresses, setAddresses] = useState([]);
    const [orders, setOrders] = useState([]);
    const [orderTotal, setOrderTotal] = useState(0);
    const [suppliers, setSuppliers] = useState([]);
    const [rawMaterials, setRawMaterials] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [batches, setBatches] = useState([]);
    const [productions, setProductions] = useState([]);
    const [productionRequests, setProductionRequests] = useState([]);
    const [productionRequestTotal, setProductionRequestTotal] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [pageHeader, setPageHeader] = useState({ title: 'Dashboard', subtitle: 'Overview' });

    // In-memory options tracking for Production page (never stored in sessionStorage / localStorage)
    const [productionFilters, setProductionFilters] = useState({
        status: 'All',
        priority: 'All',
        searchTerm: '',
        currentPage: 1
    });

    // In-memory filter state for Orders page – persists across detail-view round trips
    const [orderFilters, setOrderFilters] = useState({
        status: 'All',
        paymentStatus: 'All',
        searchTerm: '',
        dateFrom: '',
        dateTo: '',
        currentPage: 1
    });

    // In-memory filter state for Customer Order History – persists across detail-view round trips
    const [customerOrderFiltersMap, setCustomerOrderFiltersMap] = useState({});

    // ─── Per-module load guards (prevents duplicate concurrent fetches) ───────────
    const isLoading = useRef({
        products: false, customers: false, orders: false,
        suppliers: false, rawMaterials: false, purchases: false, transactions: false
    });

    useLayoutEffect(() => {
        const handleCacheUpdate = event => {
            const { endpoint, body, data } = event.detail;
            const items = data?.items || [];

            if (
                endpoint === 'products/list' &&
                body?.pagination?.pageNumber === 1 &&
                body?.pagination?.pageSize === 100 &&
                body?.searchKeyword == null &&
                body?.isCombo == null &&
                body?.isActive == null
            ) {
                setProducts(items.map(product => {
                    const price = typeof product.price === 'object' ? (product.price?.price ?? 0) : (product.price ?? 0);
                    const mrp = typeof product.mrp === 'object' ? (product.mrp?.mrp ?? product.mrp?.price ?? 0) : (product.mrp ?? 0);
                    return {
                        ...product,
                        price,
                        mrp,
                        prices: { DIRECT: price, ONLINE: price, WHOLESALE: price },
                        mrps: { DIRECT: mrp, ONLINE: mrp, WHOLESALE: mrp },
                        recipe: product.recipe || [],
                        comboItems: product.comboItems || [],
                        allowedCustomerTypes: ['DIRECT', 'ONLINE', 'WHOLESALE']
                    };
                }));
            }

            if (endpoint === 'orders/list') {
                setOrders(items.map(order => ({
                    ...order,
                    id: order.edid || order.id,
                    items: order.items || []
                })));
                setOrderTotal(data?.totalCount ?? 0);
            }

            if (endpoint === 'raw-materials/list' && body?.pagination?.pageSize === 100) {
                setRawMaterials(items.map(material => ({
                    id: material.edid,
                    edid: material.edid,
                    name: material.name,
                    category: material.category,
                    unit: material.allowedUnitSymbol || material.unitSymbol || '',
                    unitEdid: material.unitEdid || material.allowedUnitEdid || '',
                    unitSymbol: material.allowedUnitSymbol || material.unitSymbol || '',
                    stock: material.stock,
                    minQuantity: material.minQuantity,
                    reorderLevel: material.reorderLevel
                })));
            }

            if (endpoint === 'purchases/list') {
                setPurchases(previous => items.map(purchase => ({
                    ...purchase,
                    items: previous.find(existing => existing.id === purchase.id)?.items || []
                })));
            }

            if (endpoint === 'purchases/items' && body?.purchaseEdid) {
                const purchaseItems = Array.isArray(data) ? data : items;
                setPurchases(previous => previous.map(purchase =>
                    purchase.id === body.purchaseEdid
                        ? { ...purchase, items: purchaseItems }
                        : purchase
                ));
            }
        };

        window.addEventListener('api:cache-updated', handleCacheUpdate);
        return () => window.removeEventListener('api:cache-updated', handleCacheUpdate);
    }, []);

    // ─── Load functions ──────────────────────────────────────────────────────────
    // Each function delegates API calls entirely to the relevant api/ module.
    // Cached API responses render immediately and refresh in the background on each load.

    const loadProducts = useCallback(async () => {
        if (isLoading.current.products) return;
        isLoading.current.products = true;
        try {
            const res = await productApi.getProducts(1, 100) || {};
            const productsData = res.items || [];
            const mappedProducts = productsData.map(p => {
                const pPrice = typeof p.price === 'object' ? (p.price?.price ?? 0) : (p.price ?? 0);
                const pMrp = typeof p.mrp === 'object' ? (p.mrp?.mrp ?? p.mrp?.price ?? 0) : (p.mrp ?? 0);
                return {
                    ...p,
                    price: pPrice,
                    mrp: pMrp,
                    prices: { DIRECT: pPrice, ONLINE: pPrice, WHOLESALE: pPrice },
                    mrps: { DIRECT: pMrp, ONLINE: pMrp, WHOLESALE: pMrp },
                    recipe: p.recipe || [],
                    comboItems: p.comboItems || [],
                    allowedCustomerTypes: ['DIRECT', 'ONLINE', 'WHOLESALE']
                };
            });
            setProducts(mappedProducts);
        } catch (e) {
            console.error('Error loading products:', e);
        } finally {
            isLoading.current.products = false;
        }
    }, []);

    const loadCustomers = useCallback(async () => {
        if (isLoading.current.customers) return;
        isLoading.current.customers = true;
        try {
            const res = await customerApi.getCustomers(1, 1000) || {};
            const customersData = res.items || [];
            setCustomers(customersData);
            setCustomerTotal(res.totalCount || 0);
        } catch (e) {
            console.error('Error loading customers:', e);
        } finally {
            isLoading.current.customers = false;
        }
    }, []);

    /**
     * Search customers by mobile — always fetches the latest matching results.
     * Returns { items, totalCount }.
     */
    const searchCustomers = useCallback(async (mobile = '', pageNumber = 1, pageSize = 10) => {
        try {
            const res = await customerApi.getCustomers(pageNumber, pageSize, mobile) || {};
            return { items: res.items || [], totalCount: res.totalCount || 0 };
        } catch (e) {
            console.error('Error searching customers:', e);
            return { items: [], totalCount: 0 };
        }
    }, []);

    const orderRequestId = useRef(0);
    const loadOrders = useCallback(async (arg1 = 1, arg2 = PAGE_SIZE, arg3 = {}) => {
        let pageNumber = 1;
        let pageSize = PAGE_SIZE;
        let filters = {};

        if (typeof arg1 === 'boolean') {
            pageNumber = 1;
            pageSize = PAGE_SIZE;
            filters = arg2 && typeof arg2 === 'object' ? arg2 : {};
        } else if (typeof arg1 === 'number') {
            pageNumber = arg1;
            pageSize = typeof arg2 === 'number' ? arg2 : PAGE_SIZE;
            filters = arg3 && typeof arg3 === 'object' ? arg3 : {};
        } else if (arg1 && typeof arg1 === 'object') {
            filters = arg1;
        }

        const reqId = ++orderRequestId.current;
        try {
            const ordersRes = await orderApi.getOrders(pageNumber, pageSize, filters) || {};
            if (reqId !== orderRequestId.current) return;

            const ordersData = ordersRes.items || [];
            const total = ordersRes.totalCount ?? 0;

            const mappedOrders = ordersData.map((o) => ({
                ...o,
                id: o.edid || o.id,
                recipientName: o.recipientName,
                customerName: o.customerName,
                customerMobile: o.customerMobile,
                items: o.items || []
            }));

            setOrders(prev => {
                if (JSON.stringify(prev) === JSON.stringify(mappedOrders)) return prev;
                return mappedOrders;
            });
            setOrderTotal(prev => prev === total ? prev : total);
            return { items: mappedOrders, totalCount: total };
        } catch (e) {
            console.error('Error loading orders:', e);
            return { items: [], totalCount: 0 };
        }
    }, []);

    /**
     * Load order items on demand for a single order only when requested.
     */
    const loadOrderItems = useCallback(async (orderId) => {
        if (!orderId) return [];
        try {
            const itemsRes = await orderApi.getOrderItems(orderId);
            const rawItems = Array.isArray(itemsRes) ? itemsRes : (itemsRes?.items || []);
            const mappedItems = rawItems.map(i => {
                const unitPrice = i.unitPrice ?? (typeof i.price === 'object' ? (i.price?.price ?? 0) : (i.price ?? 0));
                return {
                    ...i,
                    productNameSnapshot: i.productNameSnapshot || 'Unknown Product',
                    sku: i.sku || '',
                    unitPrice: unitPrice,
                    isCombo: Boolean(i.isCombo)
                };
            });
            setOrders(prev => prev.map(o => (o.id === orderId || o.edid === orderId) ? { ...o, items: mappedItems } : o));
            return mappedItems;
        } catch (err) {
            console.error('Error loading order items:', err);
            return [];
        }
    }, []);

    const loadSuppliers = useCallback(async () => {
        if (isLoading.current.suppliers) return;
        isLoading.current.suppliers = true;
        try {
            const res = await purchaseApi.getSuppliers() || {};
            setSuppliers(res.items || []);
        } catch (e) {
            console.error('Error loading suppliers:', e);
        } finally {
            isLoading.current.suppliers = false;
        }
    }, []);

    /**
     * Search suppliers by name, contact name, and type — always fetches the latest matching results.
     * Returns { items, totalCount }.
     */
    const searchSuppliers = useCallback(async (name = null, contactName = null, supplierType = null, pageNumber = 1, pageSize = 10) => {
        try {
            // Send empty string as null or properly formatted so API handles it
            const res = await purchaseApi.getSuppliers(pageNumber, pageSize, contactName || null, supplierType === 'All' ? null : (supplierType || null), name || null) || {};
            const items = Array.isArray(res) ? res : (res.items || res.data?.items || res.suppliers || res.data || []);
            return { items, totalCount: res.totalCount || items.length };
        } catch (e) {
            console.error('Error searching suppliers:', e);
            return { items: [], totalCount: 0 };
        }
    }, []);

    const searchRawMaterials = useCallback(async (name = null, pageNumber = 1, pageSize = 20) => {
        try {
            const res = await purchaseApi.getRawMaterials(pageNumber, pageSize, name || null) || {};
            const data = Array.isArray(res) ? res : (res.items || res.data?.items || res.rawMaterials || res.data || []);
            const mappedData = data.map(m => ({
                id: m.edid || m.id,
                edid: m.edid || m.id,
                name: m.name,
                category: m.category,
                unit: m.allowedUnitSymbol || m.unitSymbol || m.unit || '',
                unitEdid: m.unitEdid || m.allowedUnitEdid || '',
                unitSymbol: m.allowedUnitSymbol || m.unitSymbol || '',
                stock: m.stock,
                minQuantity: m.minQuantity,
                reorderLevel: m.reorderLevel
            }));
            return { items: mappedData, totalCount: res.totalCount || mappedData.length };
        } catch (e) {
            console.error('Error searching raw materials:', e);
            return { items: [], totalCount: 0 };
        }
    }, []);

    const loadRawMaterials = useCallback(async () => {
        if (isLoading.current.rawMaterials) return;
        isLoading.current.rawMaterials = true;
        try {
            const res = await purchaseApi.getRawMaterials(1, 100) || {};
            const data = res.items || [];
            const mappedData = data.map(m => ({
                id: m.edid,
                edid: m.edid,
                name: m.name,
                category: m.category,
                unit: m.allowedUnitSymbol || m.unitSymbol || '',
                unitEdid: m.unitEdid || m.allowedUnitEdid || '',
                unitSymbol: m.allowedUnitSymbol || m.unitSymbol || '',
                stock: m.stock,
                minQuantity: m.minQuantity,
                reorderLevel: m.reorderLevel
            }));
            setRawMaterials(mappedData);
        } catch (e) {
            console.error('Error loading raw materials:', e);
        } finally {
            isLoading.current.rawMaterials = false;
        }
    }, []);

    const loadPurchases = useCallback(async () => {
        if (isLoading.current.purchases) return;
        isLoading.current.purchases = true;
        try {
            const res = await purchaseApi.getPurchases() || {};
            const data = res.items || [];
            const mappedPurchases = [];
            for (let pu of data) {
                const items = await purchaseApi.getPurchaseItems(pu.id) || [];
                mappedPurchases.push({ ...pu, items });
            }
            setPurchases(mappedPurchases);
        } catch (e) {
            console.error('Error loading purchases:', e);
        } finally {
            isLoading.current.purchases = false;
        }
    }, []);

    const loadTransactions = useCallback(async () => {
        if (isLoading.current.transactions) return;
        isLoading.current.transactions = true;
        try {
            const res = await accountApi.getTransactions() || {};
            setTransactions(res.items || []);
        } catch (e) {
            console.error('Error loading transactions:', e);
        } finally {
            isLoading.current.transactions = false;
        }
    }, []);

    const loadProductionRequests = useCallback(async (pageNumber = 1, pageSize = PAGE_SIZE, filters = {}) => {
        try {
            const res = await productionApi.getRequests(pageNumber, pageSize, filters) || {};
            const items = res.items || [];
            const total = res.totalCount ?? items.length;
            setProductionRequests(items);
            setProductionRequestTotal(total);
            return { items, totalCount: total };
        } catch (e) {
            console.error('Error loading production requests:', e);
            return { items: [], totalCount: 0 };
        }
    }, []);

    // ─── Auth ────────────────────────────────────────────────────────────────────

    const login = async (employeeCodeOrRole, password = null) => {
        // If two parameters or object with credentials provided, call real backend API
        if (password !== null || (typeof employeeCodeOrRole === 'object' && employeeCodeOrRole?.employeeCode)) {
            const credentials = password !== null
                ? { employeeCode: employeeCodeOrRole, password }
                : employeeCodeOrRole;

            try {
                const res = await authApi.login(credentials);
                const jwtToken = res.token;
                const emp = res.employee || {};
                const permissions = res.permissions || [];
                const menus = res.menus || [];

                // Standardize user object
                const userObj = {
                    id: emp.employeeId,
                    employeeId: emp.employeeId,
                    employeeCode: emp.employeeCode,
                    name: emp.employeeName || emp.employeeCode,
                    email: emp.email,
                    mobile: emp.mobile,
                    roles: emp.roles || [],
                    role: (emp.roles && emp.roles[0]) ? emp.roles[0] : 'STAFF',
                };

                // Store in localStorage (no cookies)
                setStoredToken(jwtToken);
                localStorage.setItem(USER_KEY, JSON.stringify(userObj));
                localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));
                localStorage.setItem(MENUS_KEY, JSON.stringify(menus));

                setToken(jwtToken);
                setCurrentUser(userObj);
                setUserPermissions(permissions);
                setUserMenus(menus);

                return { success: true, user: userObj, permissions, menus };
            } catch (err) {
                console.error("Login failed:", err);
                return { success: false, message: err.message || 'Login failed.' };
            }
        }

        // Fallback for role-only string (quick development testing)
        const role = typeof employeeCodeOrRole === 'string' ? employeeCodeOrRole.toUpperCase() : 'STAFF';
        const dummyUser = {
            id: role === 'Admin' ? 1 : 2,
            employeeId: role === 'Admin' ? 1 : 2,
            employeeCode: role === 'Admin' ? 'EMP001' : 'EMP002',
            role,
            roles: [role],
            name: role === 'Admin' ? 'Admin User' : 'Staff User',
        };
        const dummyPermissions = role === 'Admin'
            ? ['ViewDashboard', 'ViewOrders', 'CreateOrder', 'EditOrder', 'CancelOrder', 'ViewCustomers', 'ManageCustomers', 'ViewProducts', 'ManageProducts', 'ViewRawMaterials', 'ManageRawMaterials', 'ViewPurchases', 'ManagePurchases', 'ViewProduction', 'ManageProduction', 'ViewPacking', 'ManagePacking', 'ViewLogistics', 'ManageLogistics', 'ViewAccounts', 'ManageAccounts', 'ViewExpenses', 'ManageExpenses', 'ViewEmployees', 'ManageEmployees']
            : ['ViewDashboard', 'ViewOrders', 'CreateOrder', 'ViewCustomers', 'ViewProducts', 'ViewProduction', 'ViewPacking', 'ViewLogistics', 'ViewExpenses'];

        setCurrentUser(dummyUser);
        setUserPermissions(dummyPermissions);
        localStorage.setItem(USER_KEY, JSON.stringify(dummyUser));
        localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(dummyPermissions));
        return { success: true, user: dummyUser };
    };

    /**
     * Clears ALL cached state and localStorage so the next session starts clean.
     */
    const logout = () => {
        clearStoredAuth();
        setToken(null);
        setCurrentUser(null);
        setUserPermissions([]);
        setUserMenus([]);
        setProducts([]);
        setCustomers([]);
        setCustomerTotal(0);
        setAddresses([]);
        setOrders([]);
        setSuppliers([]);
        setRawMaterials([]);
        setPurchases([]);
        setBatches([]);
        setProductions([]);
        setProductionRequests([]);
        setProductionRequestTotal(0);
        setTransactions([]);
        setProductionFilters({
            status: null,
            priority: 'All',
            searchTerm: '',
            currentPage: 1
        });
        setOrderFilters({
            status: 'All',
            paymentStatus: 'All',
            searchTerm: '',
            dateFrom: '',
            dateTo: '',
            currentPage: 1
        });
        isLoading.current = {
            products: false, customers: false, orders: false,
            suppliers: false, rawMaterials: false, purchases: false, transactions: false
        };
    };

    // Auto-logout when backend returns 401 Unauthorized
    useEffect(() => {
        const handleUnauthorized = () => {
            logout();
        };
        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }, []);

    const hasUserPermission = useCallback((permission) => {
        return checkPermission(userPermissions, permission);
    }, [userPermissions]);

    const hasUserRole = useCallback((role) => {
        return checkRole(currentUser?.roles || currentUser?.role, role);
    }, [currentUser]);

    // ─── Mutations ───────────────────────────────────────────────────────────────

    const walletBalance = transactions.reduce((acc, txn) =>
        txn.type === 'CREDIT' ? acc + txn.amount : acc - txn.amount, 0);

    const addTransaction = async (txn) => {
        const res = await accountApi.createTransaction({
            date: new Date().toISOString(),
            type: txn.type,
            category: txn.category,
            amount: txn.amount,
            description: txn.description || null,
        });
        if (res?.edid) {
            setTransactions(prev => [{ ...txn, edid: res.edid, date: new Date().toISOString() }, ...prev]);
        }
    };

    const addOrder = async (order) => {
        const payload = {
            order: {
                customerEdid: order.customerEdid,
                deliveryType: order.deliveryType || 'HOME_DELIVERY',
                deliveryAddressEdid: order.deliveryAddressEdid || order.deliveryAddress?.id || order.deliveryAddress?.edid || null,
                subtotal: Number(order.subtotal) || 0,
                deliveryCharge: Number(order.deliveryCharge) || 0,
                discount: Number(order.discount) || 0,
                totalAmount: Number(order.totalAmount) || 0,
                initialPaymentAmount: order.paidAmount !== undefined && order.paidAmount !== null && order.paidAmount !== ''
                    ? Number(order.paidAmount)
                    : (order.paymentStatus === 'PAID' ? (Number(order.totalAmount) || 0) : (Number(order.initialPaymentAmount) || 0)),
                initialPaymentMethod: order.paymentMethod || 'UPI',
                initialPaymentReference: order.upiRef || order.paymentReference || null,
                initialPaymentType: order.initialPaymentType || ((Number(order.paidAmount || order.totalAmount) >= Number(order.totalAmount)) ? 'FullPayment' : 'Advance'),
                initialPaymentAttachmentData: order.paymentAttachmentData || [],
            },
            items: order.items.map(i => ({
                productEdid: i.productId || i.productEdid,
                productNameSnapshot: i.productNameSnapshot || null,
                priceItemEdid: i.priceItemEdid || i.priceItemId || null,
                unitPrice: Number(i.unitPrice) || 0,
                quantity: Number(i.quantity) || 1,
                isCombo: Boolean(i.isCombo),
            }))
        };
        const res = await orderApi.createOrder(payload);
        if (res?.edid) {
            const newOrder = {
                ...order,
                id: res.edid,
                edid: res.edid,
                orderNumber: res.orderNumber || order.orderNumber || 'ORD-NEW',
                createdAt: order.createdAt || new Date().toISOString(),
                recipientName: order.deliveryAddress?.recipientName || order.recipientName || order.customerName,
                customerName: order.customerName || order.deliveryAddress?.recipientName,
                customerMobile: order.customerMobile || order.deliveryAddress?.primaryMobile,
            };
            setOrders(prev => [newOrder, ...prev]);
        }
        return res;
    };

    const updateOrder = async (updatedOrder) => {
        const orderId = updatedOrder.edid || updatedOrder.id;
        if (updatedOrder.status) {
            await orderApi.updateStatus(orderId, updatedOrder.status);
        }
        if (updatedOrder.paymentStatus) {
            await orderApi.updatePaymentStatus(orderId, updatedOrder.paymentStatus);
        }
        setOrders(prev => prev.map(o => (o.id === orderId || o.edid === orderId) ? updatedOrder : o));
    };

    const addCustomer = async (customer) => {
        try {
            const edid = await customerApi.saveCustomer(customer);
            if (edid) {
                setCustomers([...customers, { ...customer, edid }]);
            }
        } catch (e) {
            console.error("Failed to add customer:", e);
        }
    };

    const addAddress = async (address) => {
        try {
            const edid = await customerApi.saveAddress(address.customerEdid, address.edid || '0', address);
            if (edid) {
                // Re-fetch all addresses for this customer automatically
                const fetchedAddresses = await customerApi.getAddresses(address.customerEdid) || [];

                // Map customerEdid and id explicitly in case the API doesn't include them
                const processedAddresses = fetchedAddresses.map(a => ({
                    ...a,
                    customerEdid: address.customerEdid,
                    id: a.edid || a.id
                }));

                // Update global addresses by replacing all addresses for this customer
                setAddresses(prev => {
                    const map = new Map(prev.map(a => [a.id || a.edid, a]));
                    processedAddresses.forEach(a => map.set(a.id || a.edid, a));
                    return Array.from(map.values());
                });

                return { success: true, addresses: processedAddresses, edid };
            }
        } catch (e) {
            console.error("Failed to add address:", e);
        }
        return { success: false };
    };

    const addSupplier = async (supplier) => {
        try {
            const res = await purchaseApi.saveSupplier(supplier);
            // res could be the generated edid/id, an object, or null/empty if the backend just returns success
            const edid = (typeof res === 'string' && res !== '') ? res : (res?.edid || res?.id || `sup-${Date.now()}`);
            setSuppliers(prev => [...(prev || []), { ...supplier, id: edid, edid: edid, balance: supplier.balance || 0 }]);
            return { success: true };
        } catch (err) {
            return { success: false, message: err.message };
        }
    };

    const toggleBatchStatus = () => { };

    // ─── Utility / profitability helpers ─────────────────────────────────────────

    const getMaterialCost = (materialId) => {
        const active = batches.filter(b => b.materialId === materialId && b.qtyRemaining > 0);
        return active.length > 0 ? active[0].costPerUnit : 0;
    };

    const getProductCost = (product) => {
        if (!product?.recipe) return 0;
        return product.recipe.reduce((total, item) =>
            total + getMaterialCost(item.materialId) * item.qty, 0);
    };

    const getProductCostBreakdown = (product) => {
        const breakdown = { honey: 0, bottleAndCap: 0, labels: 0, packing: 0, total: 0 };
        if (!product?.recipe) return breakdown;
        product.recipe.forEach(item => {
            const rm = rawMaterials.find(r => r.id === item.materialId);
            const cost = getMaterialCost(item.materialId) * item.qty;
            breakdown.total += cost;
            if (!rm) return;
            if (rm.category === 'HONEY') breakdown.honey += cost;
            else if (rm.category === 'BOTTLE' || rm.category === 'CAP') breakdown.bottleAndCap += cost;
            else if (rm.category === 'LABEL' || rm.category === 'CAP_LABEL') breakdown.labels += cost;
            else if (rm.category === 'BOX' || rm.category === 'PACKING_ITEM') breakdown.packing += cost;
        });
        return breakdown;
    };

    // ─── Provider ────────────────────────────────────────────────────────────────

    return (
        <StoreContext.Provider value={{
            currentUser, token, userPermissions, userMenus, login, logout,
            hasUserPermission, hasUserRole,
            products, setProducts,
            customers, setCustomers, customerTotal,
            addresses, setAddresses,
            orders, setOrders, orderTotal, setOrderTotal, addOrder, updateOrder,
            suppliers, setSuppliers,
            rawMaterials, setRawMaterials,
            purchases, setPurchases,
            batches, setBatches,
            productions, setProductions,
            productionRequests, setProductionRequests, productionRequestTotal,
            productionFilters, setProductionFilters,
            orderFilters, setOrderFilters,
            customerOrderFiltersMap, setCustomerOrderFiltersMap,
            transactions, setTransactions,
            walletBalance, addTransaction,
            pageHeader, setPageHeader,
            getMaterialCost, getProductCost, getProductCostBreakdown,
            toggleBatchStatus,
            addCustomer, addAddress, addSupplier,
            loadProducts, loadCustomers, searchCustomers, loadOrders, loadOrderItems, loadSuppliers, searchSuppliers,
            loadRawMaterials, searchRawMaterials, loadPurchases, loadTransactions, loadProductionRequests, isLoading
        }}>
            {children}
        </StoreContext.Provider>
    );
}

export function useStore() {
    const context = useContext(StoreContext);
    return context || {};
}
