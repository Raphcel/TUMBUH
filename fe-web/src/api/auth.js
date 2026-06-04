/**
 * Auth API — login, register, refresh, current user.
 */
import api, { setToken, setRefreshToken, clearTokens } from './client';

export const authApi = {
  /**
   * Login and store both access + refresh tokens.
   */
  async login(email, password) {
    const data = await api.post('/auth/login', { email, password });
    setToken(data.access_token);
    setRefreshToken(data.refresh_token);
    return data;
  },

  /**
   * Register a new user and store tokens.
   */
  async register(payload) {
    const data = await api.post('/auth/register', payload);
    return data;
  },

  async verifyEmail(token) {
    return api.post('/auth/verify-email', { token });
  },

  async requestPasswordReset(email) {
    return api.post('/auth/password-reset/request', { email });
  },

  async confirmPasswordReset(token, newPassword) {
    return api.post('/auth/password-reset/confirm', {
      token,
      new_password: newPassword,
    });
  },

  async google(payload) {
    const data = await api.post('/auth/google', payload);
    setToken(data.access_token);
    setRefreshToken(data.refresh_token);
    return data;
  },

  /**
   * Get the currently authenticated user.
   */
  me() {
    return api.get('/auth/me');
  },

  /**
   * Logout — clear all stored tokens.
   */
  logout() {
    clearTokens();
  },
};

export default authApi;
