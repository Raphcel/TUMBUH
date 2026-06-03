import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../api/admin';
import { resolveUploadUrl } from '../../api/client';
import { useTranslation } from '../../context/LanguageContext';
import { Search, UserX, UserCheck, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 20;

const ROLE_BADGES = {
  student: 'bg-emerald-100 text-emerald-700',
  hr: 'bg-violet-100 text-violet-700',
  admin: 'bg-red-100 text-red-700',
};

export function UserManagement() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    adminApi
      .listUsers(page * PAGE_SIZE, PAGE_SIZE, {
        role: roleFilter || undefined,
        search: search || undefined,
      })
      .then((data) => {
        setUsers(data.items || []);
        setTotal(data.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { setPage(0); }, [search, roleFilter]);

  const toggleActive = async (userId) => {
    try {
      await adminApi.toggleUserActive(userId);
      fetchUsers();
    } catch (err) {
      console.error('Toggle failed', err);
    }
  };

  const deleteUser = async (userId) => {
    if (!confirm(t('admin_confirm_delete_user'))) return;
    try {
      await adminApi.deleteUser(userId);
      fetchUsers();
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0A1D3D]">{t('admin_manage_users')}</h1>
        <p className="text-[#0A1D3D]/50 mt-1">{t('admin_manage_users_sub')}</p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0A1D3D]/40" />
          <input
            type="text"
            placeholder={t('admin_search_users')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-[#E6ECF5] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2.5 border border-[#E6ECF5] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
        >
          <option value="">{t('admin_all_roles')}</option>
          <option value="student">Student</option>
          <option value="hr">HR</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E6ECF5] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#E6ECF5] border-b border-[#E6ECF5]">
                <th className="text-left px-5 py-3 font-semibold text-[#0A1D3D]/60">{t('admin_user')}</th>
                <th className="text-left px-5 py-3 font-semibold text-[#0A1D3D]/60">{t('admin_email')}</th>
                <th className="text-left px-5 py-3 font-semibold text-[#0A1D3D]/60">{t('admin_role')}</th>
                <th className="text-left px-5 py-3 font-semibold text-[#0A1D3D]/60">{t('admin_status')}</th>
                <th className="text-right px-5 py-3 font-semibold text-[#0A1D3D]/60">{t('admin_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[#0A1D3D]/40">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand mx-auto" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[#0A1D3D]/40">
                    {t('admin_no_users')}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-[#E6ECF5] hover:bg-[#E6ECF5]/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#E6ECF5] flex items-center justify-center text-xs font-bold text-[#0A1D3D]/50 shrink-0 overflow-hidden">
                          {u.avatar ? (
                            <img src={resolveUploadUrl(u.avatar)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            u.first_name?.[0]
                          )}
                        </div>
                        <span className="font-medium text-[#0A1D3D]">{u.first_name} {u.last_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[#0A1D3D]/50">{u.email}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROLE_BADGES[u.role] || 'bg-[#E6ECF5] text-[#0A1D3D]/80'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${u.is_active ? 'text-green-600' : 'text-red-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-red-400'}`} />
                        {u.is_active ? t('admin_active') : t('admin_inactive')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleActive(u.id)}
                          title={u.is_active ? t('admin_deactivate') : t('admin_activate')}
                          className={`p-1.5 rounded-lg transition-colors ${u.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}`}
                        >
                          {u.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                        </button>
                        <button
                          onClick={() => deleteUser(u.id)}
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
    </div>
  );
}
