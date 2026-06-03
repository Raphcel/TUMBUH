import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/admin';
import { useTranslation } from '../../context/LanguageContext';
import {
  Users, Building2, Briefcase, FileText,
  TrendingUp, UserCheck, UserX, Shield
} from 'lucide-react';

export function AdminDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.stats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    );
  }

  if (!stats) {
    return <div className="py-20 text-center text-[#0A1D3D]/50">{t('no_data')}</div>;
  }

  const cards = [
    { label: t('admin_total_users'), value: stats.total_users, icon: Users, color: 'bg-[#E6ECF5]0', lightColor: 'bg-[#E6ECF5]', textColor: 'text-blue-600' },
    { label: t('admin_students'), value: stats.total_students, icon: UserCheck, color: 'bg-emerald-500', lightColor: 'bg-emerald-50', textColor: 'text-emerald-600' },
    { label: t('admin_hr_staff'), value: stats.total_hr, icon: Shield, color: 'bg-violet-500', lightColor: 'bg-violet-50', textColor: 'text-violet-600' },
    { label: t('admin_active_users'), value: stats.active_users, icon: TrendingUp, color: 'bg-cyan-500', lightColor: 'bg-cyan-50', textColor: 'text-cyan-600' },
    { label: t('admin_companies'), value: stats.total_companies, icon: Building2, color: 'bg-amber-500', lightColor: 'bg-amber-50', textColor: 'text-amber-600' },
    { label: t('admin_opportunities'), value: stats.total_opportunities, icon: Briefcase, color: 'bg-rose-500', lightColor: 'bg-rose-50', textColor: 'text-rose-600' },
    { label: t('admin_total_apps'), value: stats.total_applications, icon: FileText, color: 'bg-indigo-500', lightColor: 'bg-indigo-50', textColor: 'text-indigo-600' },
  ];

  const statusBreakdown = stats.application_status_breakdown || {};

  const statusColors = {
    Applied: 'bg-blue-100 text-blue-800',
    Screening: 'bg-yellow-100 text-yellow-800',
    Interview: 'bg-purple-100 text-purple-800',
    Accepted: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800',
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#0A1D3D]">{t('admin_dashboard')}</h1>
        <p className="text-[#0A1D3D]/50 mt-1">{t('admin_subtitle')}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white border border-[#E6ECF5] rounded-xl p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-lg ${card.lightColor} flex items-center justify-center`}>
                  <Icon className={card.textColor} size={20} />
                </div>
              </div>
              <p className="text-2xl font-bold text-[#0A1D3D]">{card.value}</p>
              <p className="text-sm text-[#0A1D3D]/50 mt-1">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Application status breakdown */}
      <div className="bg-white border border-[#E6ECF5] rounded-xl p-6">
        <h2 className="text-lg font-bold text-[#0A1D3D] mb-4">{t('admin_app_status')}</h2>
        {Object.keys(statusBreakdown).length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {Object.entries(statusBreakdown).map(([status, count]) => (
              <div
                key={status}
                className={`rounded-lg p-4 text-center ${statusColors[status] || 'bg-[#E6ECF5] text-[#0A1D3D]'}`}
              >
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-sm font-medium mt-1">{status}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[#0A1D3D]/50 text-sm">{t('admin_no_app_data')}</p>
        )}
      </div>
    </div>
  );
}
