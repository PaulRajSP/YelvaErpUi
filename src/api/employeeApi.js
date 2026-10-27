import { apiFetch } from '../services/apiClient';

export const employeeApi = {
    /**
     * Get paginated employee list with filters
     */
    getEmployees: (pageNumber = 1, pageSize = 10, searchTerm = null, role = null, isActive = null) => {
        return apiFetch('employees/list', 'POST', {
            pagination: { pageNumber, pageSize },
            searchTerm: searchTerm || null,
            role: role || null,
            isActive: isActive !== null && isActive !== undefined ? isActive : null,
        });
    },

    /**
     * Get single employee details by ID
     */
    getEmployeeById: (id) => apiFetch(`employees/${id}`),

    /**
     * Create new employee
     */
    createEmployee: (employee) => apiFetch('employees', 'POST', employee),

    /**
     * Update employee profile, status, roles, or password
     */
    updateEmployee: (id, employee) => apiFetch(`employees/${id}`, 'PUT', employee),

    /**
     * Get available distinct roles
     */
    getRoles: () => apiFetch('employees/roles'),
};
