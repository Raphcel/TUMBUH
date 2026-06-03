/**
 * Opportunities API — list, get, create, update, delete, and company-scoped list.
 */
import api from './client';

export const opportunitiesApi = {
  list(skip = 0, limit = 100, { search, type, location, sort, company_id } = {}) {
    const params = new URLSearchParams();
    params.set('skip', skip);
    params.set('limit', limit);
    if (search) params.set('search', search);
    if (type && type !== 'All') params.set('type', type);
    if (location && location !== 'All') params.set('location', location);
    if (sort) params.set('sort', sort);
    if (company_id) params.set('company_id', company_id);
    return api.get(`/opportunities/?${params.toString()}`);
  },

  get(id) {
    return api.get(`/opportunities/${id}`);
  },

  listByCompany(companyId, skip = 0, limit = 100) {
    return api.get(
      `/opportunities/company/${companyId}?skip=${skip}&limit=${limit}`
    );
  },

  create(payload) {
    return api.post('/opportunities/', payload);
  },

  update(id, payload) {
    return api.put(`/opportunities/${id}`, payload);
  },

  delete(id) {
    return api.delete(`/opportunities/${id}`);
  },
};

export default opportunitiesApi;
