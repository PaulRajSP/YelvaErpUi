/**
 * Complete, authoritative Enum of all System Roles across the Yelva ERP system.
 * Matches PermissionMaster.role and EmployeePermittedRole.role.
 */
export const RoleEnum = Object.freeze({
    Admin: 'Admin',
    Manager: 'Manager',
    Staff: 'Staff',
    Sales: 'Sales',
    Packer: 'Packer',
    Logistics: 'Logistics',
    Production: 'Production',
    Accountant: 'Accountant',
});

/**
 * Styling and metadata configuration for each role badge
 */
export const RoleMetadata = Object.freeze({
    [RoleEnum.Admin]: {
        label: 'Admin',
        description: 'Complete system access and configuration',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        dotColor: 'bg-indigo-500',
    },
    [RoleEnum.Manager]: {
        label: 'Manager',
        description: 'Operations, inventory, sales, and employee supervision',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
        dotColor: 'bg-purple-500',
    },
    [RoleEnum.Packer]: {
        label: 'Packer',
        description: 'Order packaging station, barcode verification, and sealing',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        dotColor: 'bg-amber-500',
    },
    [RoleEnum.Logistics]: {
        label: 'Logistics',
        description: 'Courier assignment, dispatch, and delivery slips',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
        dotColor: 'bg-blue-500',
    },
    [RoleEnum.Production]: {
        label: 'Production',
        description: 'Honey processing, recipe execution, and batch management',
        badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        dotColor: 'bg-cyan-500',
    },
    [RoleEnum.Sales]: {
        label: 'Sales',
        description: 'Counter sales, customer billing, and order management',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotColor: 'bg-emerald-500',
    },
    [RoleEnum.Accountant]: {
        label: 'Accountant',
        description: 'Ledgers, transactions, expenses, and financial balance',
        badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
        dotColor: 'bg-teal-500',
    },
    [RoleEnum.Staff]: {
        label: 'Staff',
        description: 'General store and operational tasks',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        dotColor: 'bg-slate-400',
    },
});

/**
 * Normalizes a role string to match RoleEnum keys
 */
export function normalizeRole(role) {
    if (!role) return RoleEnum.Staff;
    const lower = role.toString().trim().toLowerCase();
    for (const key of Object.keys(RoleEnum)) {
        if (key.toLowerCase() === lower) {
            return RoleEnum[key];
        }
    }
    return role;
}
