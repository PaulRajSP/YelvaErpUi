import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { PermissionEnum } from '../common/permissions';

import Layout from '../components/common/Layout';

import Login from '../pages/Login/Login';
import Dashboard from '../pages/Dashboard/Dashboard';
import CustomerList from '../pages/Customers/CustomerList';
import CustomerDetail from '../pages/Customers/CustomerDetail';
import OrderList from '../pages/Orders/OrderList';
import OrderDetail from '../pages/Orders/OrderDetail';
import NewOrder from '../pages/Orders/NewOrder';
import EditOrder from '../pages/Orders/EditOrder';
import ProductList from '../pages/Products/ProductList';
import ProductDetail from '../pages/Products/ProductDetail';
import PurchaseList from '../pages/Purchases/PurchaseList';
import PurchaseDetail from '../pages/Purchases/PurchaseDetail';
import NewPurchase from '../pages/Purchases/NewPurchase';
import SupplierDetail from '../pages/Purchases/SupplierDetail';
import Accounts from '../pages/Accounts/Accounts';
import MaterialList from '../pages/Materials/MaterialList';
import MaterialDetail from '../pages/Materials/MaterialDetail';
import Sales from '../pages/Sales/Sales';
import Packing from '../pages/Packing/Packing';
import Logistics from '../pages/Logistics/Logistics';
import CourierList from '../pages/Couriers/CourierList';
import CourierDetail from '../pages/Couriers/CourierDetail';
import Production from '../pages/Production/Production';
import NewProductionRequest from '../pages/Production/NewProductionRequest';
import ProductionDetail from '../pages/Production/ProductionDetail';
import ExpenseList from '../pages/Expenses/ExpenseList';
import EmployeeList from '../pages/Employees/EmployeeList';
import EmployeeDetail from '../pages/Employees/EmployeeDetail';

function ProtectedRoute({ children, allowedRoles, requiredPermission }) {
    const { currentUser, hasUserPermission } = useStore();

    if (!currentUser) {
        return <Navigate to="/login" replace />;
    }

    // Role check (supports multiple assigned roles)
    if (allowedRoles) {
        const userRoles = currentUser.roles || [currentUser.role];
        const hasRoleMatch = userRoles.some(r => allowedRoles.includes(r));
        if (!hasRoleMatch) {
            return <Navigate to="/" replace />;
        }
    }

    // Specific permission check
    if (requiredPermission && !hasUserPermission(requiredPermission)) {
        // Fallback: If user has Admin role, grant access
        const isAdmin = currentUser.roles?.includes('Admin') || currentUser.role === 'Admin';
        if (!isAdmin) {
            return <Navigate to="/" replace />;
        }
    }

    return children;
}

function IndexRoute() {
    const { userMenus, userPermissions, currentUser } = useStore();
    const isAdmin = currentUser?.roles?.some(r => r?.toLowerCase() === 'Admin') || currentUser?.role?.toLowerCase() === 'Admin';
    const hasDashboard = isAdmin ||
        userMenus?.some(m => m.frontendUrl === '/' || m.permissionEnum === 'ViewDashboard') ||
        userPermissions?.includes('ViewDashboard');

    if (!hasDashboard && userMenus && userMenus.length > 0) {
        return <Navigate to={userMenus[0]?.frontendUrl || '/orders'} replace />;
    }
    return <Dashboard />;
}

export default function AppRoutes() {
    const [, refreshCachedViews] = useState(0);

    useEffect(() => {
        const handleCacheUpdate = () => refreshCachedViews(version => version + 1);
        window.addEventListener('api:cache-updated', handleCacheUpdate);
        return () => window.removeEventListener('api:cache-updated', handleCacheUpdate);
    }, []);

    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<IndexRoute />} />

                {/* Orders */}
                <Route path="new-order" element={<NewOrder />} />
                <Route path="orders" element={<OrderList />} />
                <Route path="orders/:orderNumber/:id" element={<OrderDetail />} />
                <Route path="orders/:id" element={<OrderDetail />} />
                <Route path="orders/:id/edit" element={<EditOrder />} />

                {/* Customers */}
                <Route path="customers" element={<CustomerList />} />
                <Route path="customers/:id/:mobile" element={<CustomerDetail />} />
                <Route path="customers/:id" element={<CustomerDetail />} />

                {/* Purchases (Admin only) */}
                <Route path="purchases" element={<ProtectedRoute allowedRoles={['Admin']}><PurchaseList /></ProtectedRoute>} />
                <Route path="purchases/new" element={<ProtectedRoute allowedRoles={['Admin']}><NewPurchase /></ProtectedRoute>} />
                <Route path="purchases/suppliers/:id" element={<ProtectedRoute allowedRoles={['Admin']}><SupplierDetail /></ProtectedRoute>} />
                <Route path="purchases/:id" element={<ProtectedRoute allowedRoles={['Admin']}><PurchaseDetail /></ProtectedRoute>} />

                {/* Products */}
                <Route path="products" element={<ProductList />} />
                <Route path="products/:id" element={<ProductDetail />} />

                {/* Materials (Admin only) */}
                <Route path="materials" element={<ProtectedRoute allowedRoles={['Admin']}><MaterialList /></ProtectedRoute>} />
                <Route path="materials/:id" element={<ProtectedRoute allowedRoles={['Admin']}><MaterialDetail /></ProtectedRoute>} />

                {/* Other */}
                <Route path="packing" element={<Packing />} />
                <Route path="logistics" element={<Logistics />} />
                <Route path="couriers" element={<CourierList />} />
                <Route path="couriers/:edid/:courierName" element={<CourierDetail />} />
                <Route path="couriers/:id" element={<CourierDetail />} />
                <Route path="production" element={<Production />} />
                <Route path="production/new" element={<NewProductionRequest />} />
                <Route path="production/:id" element={<ProductionDetail />} />
                <Route path="sales" element={<ProtectedRoute allowedRoles={['Admin']}><Sales /></ProtectedRoute>} />
                <Route path="accounts" element={<ProtectedRoute allowedRoles={['Admin']}><Accounts /></ProtectedRoute>} />
                <Route path="expenses" element={<ExpenseList />} />

                {/* Employees (Admin / Manager) */}
                <Route path="employees" element={
                    <ProtectedRoute requiredPermission={PermissionEnum.ViewEmployees}>
                        <EmployeeList />
                    </ProtectedRoute>
                } />
                <Route path="employees/:id" element={
                    <ProtectedRoute requiredPermission={PermissionEnum.ViewEmployees}>
                        <EmployeeDetail />
                    </ProtectedRoute>
                } />
            </Route>

            {/* Fallback to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
