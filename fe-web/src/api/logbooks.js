import api, { API_BASE, fetchWithAuth, getToken } from './client';

function filenameFromDisposition(header, fallback) {
  if (!header) return fallback;
  const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);
  const plainMatch = header.match(/filename="([^"]+)"/i);
  return plainMatch?.[1] || fallback;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function assertBlobResponse(res, fallbackMessage) {
  if (res.ok) return res;
  const data = await res.json().catch(() => null);
  throw new Error(data?.detail || fallbackMessage);
}

export const logbooksApi = {
  create(payload) {
    return api.post('/logbooks/', payload);
  },

  list(skip = 0, limit = 100) {
    return api.get(`/logbooks/?skip=${skip}&limit=${limit}`);
  },

  get(logbookId) {
    return api.get(`/logbooks/${logbookId}`);
  },

  update(logbookId, payload) {
    return api.put(`/logbooks/${logbookId}`, payload);
  },

  delete(logbookId) {
    return api.delete(`/logbooks/${logbookId}`);
  },

  createEntry(logbookId, payload) {
    return api.post(`/logbooks/${logbookId}/entries`, payload);
  },

  updateEntry(entryId, payload) {
    return api.put(`/logbooks/entries/${entryId}`, payload);
  },

  deleteEntry(entryId) {
    return api.delete(`/logbooks/entries/${entryId}`);
  },

  async uploadAttachment(entryId, file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/logbooks/entries/${entryId}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.detail || 'Failed to upload attachment');
    }
    return res.json();
  },

  async downloadAttachment(attachmentId, originalFilename = 'attachment') {
    const res = await assertBlobResponse(
      await fetchWithAuth(`${API_BASE}/logbooks/attachments/${attachmentId}/download`),
      'Failed to download attachment'
    );
    const filename = filenameFromDisposition(res.headers.get('Content-Disposition'), originalFilename);
    downloadBlob(await res.blob(), filename);
  },

  deleteAttachment(attachmentId) {
    return api.delete(`/logbooks/attachments/${attachmentId}`);
  },

  async exportPdf(logbookId, fallbackFilename = 'logbook.pdf') {
    const res = await assertBlobResponse(
      await fetchWithAuth(`${API_BASE}/logbooks/${logbookId}/export/pdf`),
      'Failed to export PDF'
    );
    const filename = filenameFromDisposition(res.headers.get('Content-Disposition'), fallbackFilename);
    downloadBlob(await res.blob(), filename);
  },
};

export default logbooksApi;
