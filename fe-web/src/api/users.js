/**
 * Users API — get/update profile, file uploads.
 */
import api, { fetchWithAuth, getToken } from './client';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

function parseFilename(contentDisposition) {
  if (!contentDisposition) return 'cv.pdf';
  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);
  const plainMatch = contentDisposition.match(/filename="([^"]+)"/i);
  return plainMatch?.[1] || 'cv.pdf';
}

async function fetchCvBlob(path, download = false) {
  const separator = path.includes('?') ? '&' : '?';
  const res = await fetchWithAuth(`${API_BASE}${path}${separator}download=${download ? 'true' : 'false'}`, {
    method: 'GET',
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.detail || 'Failed to load CV');
  }

  return {
    blob: await res.blob(),
    filename: parseFilename(res.headers.get('Content-Disposition')),
  };
}

function openPreviewWindow() {
  const previewWindow = window.open('', '_blank');
  if (!previewWindow) return null;

  previewWindow.opener = null;
  previewWindow.document.title = 'Opening CV...';
  previewWindow.document.body.innerHTML = `
    <div style="font-family: Arial, sans-serif; padding: 24px; color: #111827;">
      <p style="margin: 0; font-size: 14px;">Loading CV preview...</p>
    </div>
  `;

  return previewWindow;
}

function openBlob({ blob, filename, download = false, previewWindow = null }) {
  const blobUrl = URL.createObjectURL(blob);

  if (download) {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || 'cv.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } else if (previewWindow) {
    previewWindow.location.replace(blobUrl);
  } else {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export const usersApi = {
  /** Get a user by ID */
  get(id) {
    return api.get(`/users/${id}`);
  },

  /** Update current user profile */
  update(payload) {
    return api.put('/users/me', payload);
  },

  /** Deactivate current student account */
  deactivateMe() {
    return api.patch('/users/me/deactivate');
  },

  /** Permanently delete current student account */
  deleteMe(email) {
    return api.post('/users/me/delete', { email });
  },

  /** Upload avatar image */
  async uploadAvatar(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/users/me/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.detail || 'Failed to upload avatar');
    }
    return res.json();
  },

  /** Upload CV (PDF) */
  async uploadCV(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/users/me/cv`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.detail || 'Failed to upload CV');
    }
    return res.json();
  },

  async viewMyCV() {
    const previewWindow = openPreviewWindow();
    try {
      const file = await fetchCvBlob('/users/me/cv', false);
      openBlob({ ...file, download: false, previewWindow });
    } catch (err) {
      previewWindow?.close();
      throw err;
    }
  },

  async downloadMyCV() {
    const file = await fetchCvBlob('/users/me/cv', true);
    openBlob({ ...file, download: true });
  },

  async viewUserCV(userId) {
    const previewWindow = openPreviewWindow();
    try {
      const file = await fetchCvBlob(`/users/${userId}/cv`, false);
      openBlob({ ...file, download: false, previewWindow });
    } catch (err) {
      previewWindow?.close();
      throw err;
    }
  },

  async downloadUserCV(userId) {
    const file = await fetchCvBlob(`/users/${userId}/cv`, true);
    openBlob({ ...file, download: true });
  },
};

export default usersApi;
