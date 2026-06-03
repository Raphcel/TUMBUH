import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../api/admin';
import { useTranslation } from '../../context/LanguageContext';
import { Trash2, Building2, ChevronLeft, ChevronRight, CheckCircle2, Clock3, Pencil, X, Save } from 'lucide-react';
import { CompanyLogo } from '../../components/ui/CompanyLogo';

const PAGE_SIZE = 20;

const EMPTY_FORM = {
  name: '',
  industry: '',
  location: '',
  logo: '',
  description: '',
  website: '',
  employee_count: '',
  founded_year: '',
  linkedin_url: '',
  instagram_url: '',
  tagline: '',
};

export function CompanyManagement() {
  const { t } = useTranslation();
  const [companies, setCompanies] = useState([]);
  const [total, setTotal] = useState(0);
  const [requests, setRequests] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState(null);

  // Edit modal state
  const [editingCompany, setEditingCompany] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchCompanies = useCallback(() => {
    setLoading(true);
    Promise.all([
      adminApi.listCompanies(page * PAGE_SIZE, PAGE_SIZE),
      adminApi.listCompanyRequests(0, 50),
    ])
      .then(([companyData, requestData]) => {
        setCompanies(companyData.items || []);
        setTotal(companyData.total || 0);
        setRequests(requestData.items || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const deleteCompany = async (companyId) => {
    if (!confirm(t('admin_confirm_delete_company'))) return;
    try {
      await adminApi.deleteCompany(companyId);
      fetchCompanies();
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const approveCompany = async (companyId) => {
    setApprovingId(companyId);
    try {
      await adminApi.approveCompanyRequest(companyId);
      fetchCompanies();
    } catch (err) {
      console.error('Approval failed', err);
    } finally {
      setApprovingId(null);
    }
  };

  // ── Edit modal handlers ──────────────────────────────────
  const openEditModal = (company) => {
    setEditingCompany(company);
    setEditForm({
      name: company.name || '',
      industry: company.industry || '',
      location: company.location || '',
      logo: company.logo || '',
      description: company.description || '',
      website: company.website || '',
      employee_count: company.employee_count ?? '',
      founded_year: company.founded_year ?? '',
      linkedin_url: company.linkedin_url || '',
      instagram_url: company.instagram_url || '',
      tagline: company.tagline || '',
    });
  };

  const closeEditModal = () => {
    setEditingCompany(null);
    setEditForm(EMPTY_FORM);
  };

  const handleEditChange = (field) => (e) => {
    setEditForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editingCompany) return;
    setSavingEdit(true);
    try {
      // Convert number fields — send null if empty
      const payload = {
        ...editForm,
        employee_count: editForm.employee_count === '' ? null : Number(editForm.employee_count),
        founded_year: editForm.founded_year === '' ? null : Number(editForm.founded_year),
      };
      await adminApi.updateCompany(editingCompany.id, payload);
      closeEditModal();
      fetchCompanies();
    } catch (err) {
      console.error('Update failed', err);
    } finally {
      setSavingEdit(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0A1D3D]">{t('admin_manage_comp')}</h1>
        <p className="text-[#0A1D3D]/50 mt-1">{t('admin_manage_comp_sub')}</p>
      </div>

      <div className="mb-6 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock3 size={18} className="text-amber-600" />
            <h2 className="font-semibold text-[#0A1D3D]">Pending company requests</h2>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-amber-700">
            {requests.length}
          </span>
        </div>
        {requests.length === 0 ? (
          <p className="text-sm text-[#0A1D3D]/50">No pending requests.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {requests.map((company) => (
              <div key={company.id} className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-[#0A1D3D]">{company.name}</h3>
                    <p className="mt-1 text-sm text-[#0A1D3D]/50">
                      {company.industry} · {company.location}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => approveCompany(company.id)}
                    disabled={approvingId === company.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-light disabled:opacity-60"
                  >
                    <CheckCircle2 size={15} />
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-[#E6ECF5] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#E6ECF5] border-b border-[#E6ECF5]">
                <th className="text-left px-5 py-3 font-semibold text-[#0A1D3D]/60">{t('admin_comp_name')}</th>
                <th className="text-left px-5 py-3 font-semibold text-[#0A1D3D]/60">{t('admin_comp_industry')}</th>
                <th className="text-left px-5 py-3 font-semibold text-[#0A1D3D]/60">{t('admin_comp_location')}</th>
                <th className="text-left px-5 py-3 font-semibold text-[#0A1D3D]/60">Status</th>
                <th className="text-left px-5 py-3 font-semibold text-[#0A1D3D]/60">{t('admin_comp_employees')}</th>
                <th className="text-left px-5 py-3 font-semibold text-[#0A1D3D]/60">{t('admin_comp_rating')}</th>
                <th className="text-right px-5 py-3 font-semibold text-[#0A1D3D]/60">{t('admin_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[#0A1D3D]/40">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand mx-auto" />
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[#0A1D3D]/40">
                    {t('admin_no_companies')}
                  </td>
                </tr>
              ) : (
                companies.map((c) => (
                  <tr key={c.id} className="border-b border-[#E6ECF5] hover:bg-[#E6ECF5]/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <CompanyLogo
                          company={c}
                          className="h-9 w-9 rounded-lg border border-[#E6ECF5] bg-white p-1"
                          fallbackClassName="text-[#0A1D3D]/40"
                          fallbackIcon={Building2}
                          useIconFallback
                        />
                        <span className="font-medium text-[#0A1D3D]">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[#0A1D3D]/50">{c.industry}</td>
                    <td className="px-5 py-3.5 text-[#0A1D3D]/50">{c.location}</td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : c.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                        {c.status || 'approved'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[#0A1D3D]/50">{c.employee_count?.toLocaleString() || '—'}</td>
                    <td className="px-5 py-3.5">
                      {c.rating ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                          ★ {c.rating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-[#0A1D3D]/40">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(c)}
                          title="Edit"
                          className="p-1.5 rounded-lg text-blue-500 hover:bg-[#E6ECF5] transition-colors"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => deleteCompany(c.id)}
                          title={t('delete_btn')}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-[#E6ECF5] flex items-center justify-between">
            <span className="text-xs text-[#0A1D3D]/50">
              {t('admin_showing')} {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} {t('admin_of')} {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E6ECF5] disabled:opacity-40 hover:bg-[#E6ECF5] transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E6ECF5] disabled:opacity-40 hover:bg-[#E6ECF5] transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Company Modal ──────────────────────────────── */}
      {editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="relative mx-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#E6ECF5] bg-white shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E6ECF5] bg-white px-6 py-4 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <CompanyLogo
                  company={{ ...editingCompany, logo: editForm.logo }}
                  className="h-10 w-10 rounded-lg border border-[#E6ECF5] bg-white p-1"
                  fallbackClassName="text-[#0A1D3D]/40"
                  fallbackIcon={Building2}
                  useIconFallback
                />
                <div>
                  <h2 className="text-lg font-bold text-[#0A1D3D]">Edit Company</h2>
                  <p className="text-sm text-[#0A1D3D]/50">{editingCompany.name}</p>
                </div>
              </div>
              <button
                onClick={closeEditModal}
                className="rounded-lg p-1.5 text-[#0A1D3D]/40 hover:bg-[#E6ECF5] hover:text-[#0A1D3D]/60 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEditSave} className="p-6 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#0A1D3D]/80">Company Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={handleEditChange('name')}
                    className="w-full rounded-lg border border-[#E6ECF5] px-3 py-2 text-sm shadow-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#0A1D3D]/80">Industry</label>
                  <input
                    type="text"
                    value={editForm.industry}
                    onChange={handleEditChange('industry')}
                    className="w-full rounded-lg border border-[#E6ECF5] px-3 py-2 text-sm shadow-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#0A1D3D]/80">Location</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={handleEditChange('location')}
                    className="w-full rounded-lg border border-[#E6ECF5] px-3 py-2 text-sm shadow-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#0A1D3D]/80">Website</label>
                  <input
                    type="text"
                    value={editForm.website}
                    onChange={handleEditChange('website')}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-[#E6ECF5] px-3 py-2 text-sm shadow-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#0A1D3D]/80">Logo URL</label>
                  <input
                    type="text"
                    value={editForm.logo}
                    onChange={handleEditChange('logo')}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-[#E6ECF5] px-3 py-2 text-sm shadow-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#0A1D3D]/80">Tagline</label>
                  <input
                    type="text"
                    value={editForm.tagline}
                    onChange={handleEditChange('tagline')}
                    className="w-full rounded-lg border border-[#E6ECF5] px-3 py-2 text-sm shadow-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#0A1D3D]/80">Employee Count</label>
                  <input
                    type="number"
                    value={editForm.employee_count}
                    onChange={handleEditChange('employee_count')}
                    className="w-full rounded-lg border border-[#E6ECF5] px-3 py-2 text-sm shadow-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#0A1D3D]/80">Founded Year</label>
                  <input
                    type="number"
                    value={editForm.founded_year}
                    onChange={handleEditChange('founded_year')}
                    className="w-full rounded-lg border border-[#E6ECF5] px-3 py-2 text-sm shadow-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#0A1D3D]/80">LinkedIn URL</label>
                  <input
                    type="text"
                    value={editForm.linkedin_url}
                    onChange={handleEditChange('linkedin_url')}
                    placeholder="https://linkedin.com/company/..."
                    className="w-full rounded-lg border border-[#E6ECF5] px-3 py-2 text-sm shadow-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#0A1D3D]/80">Instagram URL</label>
                  <input
                    type="text"
                    value={editForm.instagram_url}
                    onChange={handleEditChange('instagram_url')}
                    placeholder="https://instagram.com/..."
                    className="w-full rounded-lg border border-[#E6ECF5] px-3 py-2 text-sm shadow-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0A1D3D]/80">Description</label>
                <textarea
                  rows={4}
                  value={editForm.description}
                  onChange={handleEditChange('description')}
                  className="w-full rounded-lg border border-[#E6ECF5] px-3 py-2 text-sm shadow-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-[#E6ECF5] pt-4">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-lg border border-[#E6ECF5] px-4 py-2 text-sm font-medium text-[#0A1D3D]/60 hover:bg-[#E6ECF5] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-light disabled:opacity-60"
                >
                  <Save size={16} />
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
