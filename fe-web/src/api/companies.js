/**
 * Companies API — list, get, create, update.
 */
import api from './client';

export const companiesApi = {
  list(skip = 0, limit = 100) {
    return api.get(`/companies/?skip=${skip}&limit=${limit}`);
  },

  get(id) {
    return api.get(`/companies/${id}`);
  },

  create(payload) {
    return api.post('/companies/', payload);
  },

  update(id, payload) {
    return api.put(`/companies/${id}`, payload);
  },

  listReviews(companyId, skip = 0, limit = 100) {
    return api.get(`/companies/${companyId}/reviews?skip=${skip}&limit=${limit}`);
  },

  createReview(companyId, payload) {
    return api.post(`/companies/${companyId}/reviews`, payload);
  },

  updateReview(companyId, reviewId, payload) {
    return api.put(`/companies/${companyId}/reviews/${reviewId}`, payload);
  },

  deleteReview(companyId, reviewId) {
    return api.delete(`/companies/${companyId}/reviews/${reviewId}`);
  },
};

export default companiesApi;
