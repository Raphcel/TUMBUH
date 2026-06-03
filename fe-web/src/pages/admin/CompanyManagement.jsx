import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../api/admin';
import { useTranslation } from '../../context/LanguageContext';
import { Trash2, Building2, ChevronLeft, ChevronRight, CheckCircle2, Clock3 } from 'lucide-react';

const PAGE_SIZE = 20;

export function CompanyManagement() {
  const { t } = useTranslation();
  const [companies, setCompanies] = useState([]);
  const [total, setTotal] = useState(0);
  const [requests, setRequests] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState(null);

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

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('admin_manage_comp')}</h1>
        <p className="text-gray-500 mt-1">{t('admin_manage_comp_sub')}</p>
      </div>

      <div className="mb-6 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock3 size={18} className="text-amber-600" />
            <h2 className="font-semibold text-gray-900">Pending company requests</h2>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-amber-700">
            {requests.length}
          </span>
        </div>
        {requests.length === 0 ? (
          <p className="text-sm text-gray-500">No pending requests.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {requests.map((company) => (
              <div key={company.id} className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{company.name}</h3>
                    <p className="mt-1 text-sm text-gray-500">
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

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 font-semibold text-gray-600">{t('admin_comp_name')}</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">{t('admin_comp_industry')}</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">{t('admin_comp_location')}</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">{t('admin_comp_employees')}</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">{t('admin_comp_rating')}</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-600">{t('admin_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand mx-auto" />
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                    {t('admin_no_companies')}
                  </td>
                </tr>
              ) : (
                companies.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center p-1 bg-white shrink-0">
                          {c.logo ? (
                            <img src={c.logo} alt={c.name} className="w-full h-full object-contain" />
                          ) : (
                            <Building2 size={16} className="text-gray-400" />
                          )}
                        </div>
                        <span className="font-medium text-gray-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{c.industry}</td>
                    <td className="px-5 py-3.5 text-gray-500">{c.location}</td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : c.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                        {c.status || 'approved'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{c.employee_count?.toLocaleString() || '—'}</td>
                    <td className="px-5 py-3.5">
                      {c.rating ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                          ★ {c.rating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end">
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
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {t('admin_showing')} {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} {t('admin_of')} {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
