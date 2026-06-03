/**
 * Admin API — wraps /admin/* endpoints for platform management.
 */
import { api } from './client';

export const adminApi = {
  /** Get platform-wide statistics */
  stats: () => api.get('/admin/stats'),

  /** List users with optional filters */
  listUsers: (skip = 0, limit = 50, { role, search, is_active } = {}) => {
    const params = new URLSearchParams();
    params.set('skip', skip);
    params.set('limit', limit);
    if (role) params.set('role', role);
    if (search) params.set('search', search);
    if (is_active !== undefined && is_active !== null) params.set('is_active', is_active);
    return api.get(`/admin/users?${params}`);
  },

  /** Toggle user active/inactive */
  toggleUserActive: (userId) => api.patch(`/admin/users/${userId}/toggle-active`),

  /** Delete a user */
  deleteUser: (userId) => api.delete(`/admin/users/${userId}`),

  /** List companies */
  listCompanies: (skip = 0, limit = 50) =>
    api.get(`/admin/companies?skip=${skip}&limit=${limit}`),

  listCompanyRequests: (skip = 0, limit = 50) =>
    api.get(`/admin/company-requests?skip=${skip}&limit=${limit}`),

  approveCompanyRequest: (companyId) =>
    api.patch(`/admin/company-requests/${companyId}/approve`),

  /** Delete a company */
  deleteCompany: (companyId) => api.delete(`/admin/companies/${companyId}`),

  /** Update a company's profile (admin) */
  updateCompany: (companyId, payload) =>
    api.put(`/admin/companies/${companyId}`, payload),

  /** List opportunities */
  listOpportunities: (skip = 0, limit = 50) =>
    api.get(`/admin/opportunities?skip=${skip}&limit=${limit}`),

  /** Delete an opportunity */
  deleteOpportunity: (oppId) => api.delete(`/admin/opportunities/${oppId}`),

  /** Recent audit events for admin security dashboard */
  auditEvents: (limit = 200) => api.get(`/admin/security/audit/events?limit=${limit}`),

  /** Verify audit log hash-chain integrity */
  verifyAuditChain: () => api.get('/admin/security/audit/verify-chain'),

  /** DEV TOOLS: edit an audit log entry by eventHash */
  editAuditEntry: (eventHash, changes) =>
    api.post('/admin/security/audit/edit-entry', { eventHash, changes }),

  /** DEV TOOLS: restore audit logs from backup */
  resetAuditLogs: () => api.post('/admin/security/audit/reset-logs'),

  /** DEV TOOLS: clear/delete all audit logs completely */
  clearAllAuditLogs: () => api.post('/admin/security/audit/clear-all-logs'),

  /** Verify one application's stored digital signature */
  verifyApplicationSignature: (applicationId) =>
    api.get(`/admin/security/applications/${applicationId}/signature`),
};
