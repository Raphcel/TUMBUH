import api from './client';

export const organizationsApi = {
  me() {
    return api.get('/organizations/me');
  },

  createCompanyRequest(payload) {
    return api.post('/organizations/company-requests', payload);
  },

  createInvite(payload) {
    return api.post('/organizations/invites', payload);
  },

  acceptInvite(token) {
    return api.post('/organizations/invites/accept', { token });
  },
};

export default organizationsApi;
