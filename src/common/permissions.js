/**
 * Complete, authoritative Enum of all Permissions across the Yelva ERP system.
 * Matches MenuMaster.permissionEnum and PermissionMaster.permissionEnum from the database.
 */
export const PermissionEnum = Object.freeze({
    // ==========================================
    // 1. Dashboard & Analytics
    // ==========================================
    ViewDashboard: 'ViewDashboard',

    // ==========================================
    // 2. Orders & Sales
    // ==========================================
    ViewOrders: 'ViewOrders',
    CreateOrder: 'CreateOrder',
    EditOrder: 'EditOrder',
    CancelOrder: 'CancelOrder',
    ViewSalesReports: 'ViewSalesReports',

    // ==========================================
    // 3. Customer Management
    // ==========================================
    ViewCustomers: 'ViewCustomers',
    ManageCustomers: 'ManageCustomers',

    // ==========================================
    // 4. Products & Inventory
    // ==========================================
    ViewProducts: 'ViewProducts',
    ManageProducts: 'ManageProducts',
    ViewRawMaterials: 'ViewRawMaterials',
    ManageRawMaterials: 'ManageRawMaterials',
    ViewBatches: 'ViewBatches',
    ManageBatches: 'ManageBatches',

    // ==========================================
    // 5. Purchases & Suppliers
    // ==========================================
    ViewPurchases: 'ViewPurchases',
    ManagePurchases: 'ManagePurchases',
    ViewSuppliers: 'ViewSuppliers',
    ManageSuppliers: 'ManageSuppliers',

    // ==========================================
    // 6. Operations & Production
    // ==========================================
    ViewProduction: 'ViewProduction',
    ManageProduction: 'ManageProduction',
    ViewPacking: 'ViewPacking',
    ManagePacking: 'ManagePacking',
    ViewLogistics: 'ViewLogistics',
    ManageLogistics: 'ManageLogistics',

    // ==========================================
    // 7. Finance & Accounts
    // ==========================================
    ViewAccounts: 'ViewAccounts',
    ManageAccounts: 'ManageAccounts',
    ViewExpenses: 'ViewExpenses',
    ManageExpenses: 'ManageExpenses',

    // ==========================================
    // 8. Staff & Administration
    // ==========================================
    ViewEmployees: 'ViewEmployees',
    ManageEmployees: 'ManageEmployees',
    ManageRolesPermissions: 'ManageRolesPermissions',
});

/**
 * Human-readable metadata and groupings for all permissions
 */
export const PermissionMetadata = Object.freeze({
    [PermissionEnum.ViewDashboard]: { label: 'View Dashboard', module: 'Dashboard', description: 'Access dashboard metrics and summaries' },

    [PermissionEnum.ViewOrders]: { label: 'View Orders', module: 'Sales', description: 'View order list and order details' },
    [PermissionEnum.CreateOrder]: { label: 'Create Order', module: 'Sales', description: 'Place new sales orders' },
    [PermissionEnum.EditOrder]: { label: 'Edit Order', module: 'Sales', description: 'Modify existing orders' },
    [PermissionEnum.CancelOrder]: { label: 'Cancel Order', module: 'Sales', description: 'Cancel existing orders' },
    [PermissionEnum.ViewSalesReports]: { label: 'View Sales Reports', module: 'Sales', description: 'Access detailed revenue and sales reports' },

    [PermissionEnum.ViewCustomers]: { label: 'View Customers', module: 'Customers', description: 'View customer directory and history' },
    [PermissionEnum.ManageCustomers]: { label: 'Manage Customers', module: 'Customers', description: 'Create, edit, or delete customer profiles' },

    [PermissionEnum.ViewProducts]: { label: 'View Products', module: 'Inventory', description: 'Browse finished goods catalog and stock' },
    [PermissionEnum.ManageProducts]: { label: 'Manage Products', module: 'Inventory', description: 'Create and update products and pricing' },
    [PermissionEnum.ViewRawMaterials]: { label: 'View Raw Materials', module: 'Inventory', description: 'View raw materials and ingredients inventory' },
    [PermissionEnum.ManageRawMaterials]: { label: 'Manage Raw Materials', module: 'Inventory', description: 'Create and adjust raw material items' },
    [PermissionEnum.ViewBatches]: { label: 'View Batches', module: 'Inventory', description: 'View product batches and expiry dates' },
    [PermissionEnum.ManageBatches]: { label: 'Manage Batches', module: 'Inventory', description: 'Create and close inventory batches' },

    [PermissionEnum.ViewPurchases]: { label: 'View Purchases', module: 'Purchases', description: 'View purchase invoices and history' },
    [PermissionEnum.ManagePurchases]: { label: 'Manage Purchases', module: 'Purchases', description: 'Create and manage purchase orders' },
    [PermissionEnum.ViewSuppliers]: { label: 'View Suppliers', module: 'Purchases', description: 'View vendor list and balances' },
    [PermissionEnum.ManageSuppliers]: { label: 'Manage Suppliers', module: 'Purchases', description: 'Add and edit supplier records' },

    [PermissionEnum.ViewProduction]: { label: 'View Production', module: 'Production', description: 'View batch production requests' },
    [PermissionEnum.ManageProduction]: { label: 'Manage Production', module: 'Production', description: 'Start, complete, and track production requests' },
    [PermissionEnum.ViewPacking]: { label: 'View Packing Station', module: 'Operations', description: 'View packing queue and barcode items' },
    [PermissionEnum.ManagePacking]: { label: 'Manage Packing Station', module: 'Operations', description: 'Pack, seal, and verify orders' },
    [PermissionEnum.ViewLogistics]: { label: 'View Logistics Station', module: 'Operations', description: 'View courier manifests and shipments' },
    [PermissionEnum.ManageLogistics]: { label: 'Manage Logistics Station', module: 'Operations', description: 'Dispatch orders and print delivery slips' },

    [PermissionEnum.ViewAccounts]: { label: 'View Accounts', module: 'Finance', description: 'Access wallet balance and transaction ledger' },
    [PermissionEnum.ManageAccounts]: { label: 'Manage Accounts', module: 'Finance', description: 'Add manual credits, debits, or adjustments' },
    [PermissionEnum.ViewExpenses]: { label: 'View Expenses', module: 'Finance', description: 'View business operating expenses' },
    [PermissionEnum.ManageExpenses]: { label: 'Manage Expenses', module: 'Finance', description: 'Record and edit operational expenses' },

    [PermissionEnum.ViewEmployees]: { label: 'View Employees', module: 'Administration', description: 'View employee roster and role assignments' },
    [PermissionEnum.ManageEmployees]: { label: 'Manage Employees', module: 'Administration', description: 'Create, edit, deactivate employees and manage credentials' },
    [PermissionEnum.ManageRolesPermissions]: { label: 'Manage Roles & Permissions', module: 'Administration', description: 'Configure system roles and permission matrix' },
});

/**
 * Check whether a user has a specific permission
 * @param {Array<string>} userPermissions - List of permission enums granted to the user
 * @param {string} permission - The permission enum key to check
 * @returns {boolean}
 */
export function hasPermission(userPermissions, permission) {
    if (!userPermissions || !Array.isArray(userPermissions)) return false;
    return userPermissions.includes(permission);
}

/**
 * Check whether a user has at least one permission in the provided array
 * @param {Array<string>} userPermissions
 * @param {Array<string>} permissions
 * @returns {boolean}
 */
export function hasAnyPermission(userPermissions, permissions) {
    if (!userPermissions || !Array.isArray(userPermissions) || !permissions) return false;
    return permissions.some(p => userPermissions.includes(p));
}

/**
 * Check whether a user has all permissions in the provided array
 * @param {Array<string>} userPermissions
 * @param {Array<string>} permissions
 * @returns {boolean}
 */
export function hasAllPermissions(userPermissions, permissions) {
    if (!userPermissions || !Array.isArray(userPermissions) || !permissions) return false;
    return permissions.every(p => userPermissions.includes(p));
}

/**
 * Check whether a user possesses a specific role
 * @param {Array<string>|string} userRoles
 * @param {string} role
 * @returns {boolean}
 */
export function hasRole(userRoles, role) {
    if (!userRoles) return false;
    const roles = Array.isArray(userRoles) ? userRoles : [userRoles];
    return roles.map(r => r?.toUpperCase()).includes(role?.toUpperCase());
}
