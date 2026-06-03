import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Briefcase,
  Building2,
  CalendarDays,
  ChevronDown,
  Filter,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';
import { opportunitiesApi } from '../../api/opportunities';
import { useCloseOnScroll } from '../../hooks/useCloseOnScroll';
import { useOrganization } from '../../hooks/useOrganization';

const MotionDiv = motion.div;

const SORT_OPTIONS = ['newest', 'oldest', 'title', 'applicants'];
const STATUS_FILTERS = ['All', 'Active', 'Closed'];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { y: 14, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 130, damping: 16 },
  },
};

function formatDate(value) {
  if (!value) return 'Tidak ada deadline';
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getCreatedTime(job) {
  return new Date(job.created_at || job.posted_at || job.updated_at || 0).getTime();
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <MotionDiv
      variants={itemVariants}
      className="flex min-w-[150px] flex-1 items-center gap-4 rounded-2xl border border-[#E6ECF5] bg-white px-5 py-4 shadow-sm"
    >
      <div className={`rounded-xl p-2.5 ${color}`}>
        {React.createElement(Icon, { size: 20, className: 'text-white' })}
      </div>
      <div>
        <p className="text-2xl font-bold text-text tabular-nums">{value}</p>
        <p className="mt-0.5 text-xs text-text-muted">{label}</p>
      </div>
    </MotionDiv>
  );
}

function OpportunityCard({ job, onOpen, onEdit, onClose, onDelete }) {
  const isActive = job.is_active !== false;
  const applicantsCount = job.applicants_count ?? 0;

  return (
    <MotionDiv variants={itemVariants} layout>
      <button
        type="button"
        onClick={onOpen}
        className="group w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
      >
        <Card className="rounded-2xl border-[#E6ECF5] p-5 transition-all duration-200 group-hover:border-brand/20 group-hover:shadow-md">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-brand/10 bg-brand/10 text-brand">
                <Briefcase size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="line-clamp-1 text-base font-semibold text-text transition-colors group-hover:text-brand">
                    {job.title || 'Tanpa judul'}
                  </h2>
                  <Badge variant={isActive ? 'success' : 'error'}>
                    {isActive ? 'Aktif' : 'Ditutup'}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-muted">
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={13} />
                    {job.location || '-'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Briefcase size={13} />
                    {job.type || '-'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays size={13} />
                    {formatDate(job.deadline)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-shrink-0">
              <div className="rounded-xl border border-[#E6ECF5] bg-[#E6ECF5] px-4 py-2 text-sm">
                <p className="text-xs text-text-muted">Pelamar</p>
                <p className="font-semibold text-text tabular-nums">{applicantsCount}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onEdit}
                  className="gap-1"
                >
                  <Pencil size={14} />
                  Edit
                </Button>
                {isActive && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="gap-1 text-orange-600 hover:text-orange-700"
                  >
                    <XCircle size={14} />
                    Tutup
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onDelete}
                  className="gap-1 text-red-600 hover:text-red-700"
                >
                  <Trash2 size={14} />
                  Hapus
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </button>
    </MotionDiv>
  );
}

export function KelolaLowongan() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { company, onboardingRequired, loading: organizationLoading } = useOrganization();
  const companyId = company?.status === 'approved' ? company.id : null;

  const [myJobs, setMyJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  useCloseOnScroll(showSortMenu, () => setShowSortMenu(false));

  useEffect(() => {
    if (organizationLoading) return;
    if (!companyId) {
      setLoading(false);
      return;
    }

    opportunitiesApi
      .listByCompany(companyId)
      .then((data) => setMyJobs(Array.isArray(data) ? data : data.items || []))
      .catch(() => {
        addToast({
          type: 'error',
          title: 'Gagal',
          message: 'Gagal memuat lowongan.',
        });
      })
      .finally(() => setLoading(false));
  }, [addToast, companyId, organizationLoading]);

  const stats = useMemo(() => {
    const active = myJobs.filter((job) => job.is_active !== false).length;
    const applicants = myJobs.reduce((sum, job) => sum + (job.applicants_count ?? 0), 0);
    return {
      total: myJobs.length,
      active,
      closed: myJobs.length - active,
      applicants,
    };
  }, [myJobs]);

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();
    const jobs = myJobs.filter((job) => {
      const matchesSearch =
        !query ||
        job.title?.toLowerCase().includes(query) ||
        job.type?.toLowerCase().includes(query) ||
        job.location?.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Active' && job.is_active !== false) ||
        (statusFilter === 'Closed' && job.is_active === false);

      return matchesSearch && matchesStatus;
    });

    return [...jobs].sort((a, b) => {
      if (sortBy === 'oldest') return getCreatedTime(a) - getCreatedTime(b);
      if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
      if (sortBy === 'applicants') return (b.applicants_count ?? 0) - (a.applicants_count ?? 0);
      return getCreatedTime(b) - getCreatedTime(a);
    });
  }, [myJobs, search, sortBy, statusFilter]);

  const sortLabels = {
    newest: 'Terbaru',
    oldest: 'Terlama',
    title: 'Nama lowongan',
    applicants: 'Pelamar terbanyak',
  };

  const handleClose = async (jobId) => {
    try {
      await opportunitiesApi.update(jobId, { is_active: false });
      setMyJobs((jobs) => jobs.map((job) => (job.id === jobId ? { ...job, is_active: false } : job)));
      addToast({ type: 'success', title: 'Berhasil', message: 'Lowongan ditutup.' });
    } catch {
      addToast({ type: 'error', title: 'Gagal', message: 'Gagal menutup lowongan.' });
    }
  };

  const handleDelete = async (jobId) => {
    try {
      await opportunitiesApi.delete(jobId);
      setMyJobs((jobs) => jobs.filter((job) => job.id !== jobId));
      addToast({ type: 'success', title: 'Berhasil', message: 'Lowongan berhasil dihapus.' });
    } catch {
      addToast({ type: 'error', title: 'Gagal', message: 'Gagal menghapus lowongan.' });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-brand" />
      </div>
    );
  }

  if (onboardingRequired || !companyId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-lg rounded-2xl border-[#E6ECF5]">
          <div className="space-y-4 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-text">Set up your organization</h1>
              <p className="mt-2 text-sm text-text-muted">
                Create or join a company before publishing opportunities.
              </p>
            </div>
            <Button type="button" onClick={() => navigate('/hr/onboarding')} className="w-full">
              Continue
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <MotionDiv
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-5xl space-y-6 pb-10"
    >
      <MotionDiv variants={itemVariants} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-text">
            <Briefcase size={23} className="text-brand" />
            Kelola Lowongan
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Pilih satu lowongan untuk membuka dashboard rekrutmen dan mengelola pelamarnya.
          </p>
        </div>
        <Button
          variant="primary"
          className="gap-2 text-white"
          onClick={() => navigate('/hr/lowongan/baru')}
        >
          <Plus size={16} />
          Buat Lowongan Baru
        </Button>
      </MotionDiv>

      <MotionDiv variants={itemVariants} className="flex flex-wrap gap-3">
        <StatCard icon={Briefcase} label="Total lowongan" value={stats.total} color="bg-brand" />
        <StatCard icon={CalendarDays} label="Aktif" value={stats.active} color="bg-emerald-500" />
        <StatCard icon={XCircle} label="Ditutup" value={stats.closed} color="bg-red-500" />
        <StatCard icon={Users} label="Total pelamar" value={stats.applicants} color="bg-amber-500" />
      </MotionDiv>

      <MotionDiv variants={itemVariants} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-light" />
            <input
              type="text"
              placeholder="Cari posisi, tipe, atau lokasi..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-xl border border-[#E6ECF5] bg-white py-2.5 pl-9 pr-10 text-sm shadow-sm transition focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-light transition-colors hover:text-text"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="relative">
            <Button
              variant="outline"
              className="w-full gap-2 sm:w-auto"
              onClick={() => setShowSortMenu((open) => !open)}
            >
              <Filter size={16} />
              Urutkan
              <ChevronDown size={14} className={`transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
            </Button>
            {showSortMenu && (
              <div className="absolute right-0 z-20 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-[#E6ECF5] bg-white shadow-lg">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setSortBy(option);
                      setShowSortMenu(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                      sortBy === option
                        ? 'bg-brand/5 font-semibold text-brand'
                        : 'text-text-muted hover:bg-[#E6ECF5] hover:text-text'
                    }`}
                  >
                    {sortLabels[option]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                statusFilter === status
                  ? 'border-brand bg-brand text-white shadow-sm'
                  : 'border-[#E6ECF5] bg-white text-text-muted hover:border-brand/30 hover:text-brand'
              }`}
            >
              {status === 'All' ? 'Semua' : status === 'Active' ? 'Aktif' : 'Ditutup'}
            </button>
          ))}
        </div>
      </MotionDiv>

      <AnimatePresence>
        {filteredJobs.length > 0 ? (
          <MotionDiv
            key="list"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            {filteredJobs.map((job) => (
              <OpportunityCard
                key={job.id}
                job={job}
                onOpen={() => navigate(`/hr/opportunities/${job.id}`)}
                onEdit={() => navigate(`/hr/opportunities/${job.id}/edit`)}
                onClose={() => handleClose(job.id)}
                onDelete={() => setDeleteConfirmId(job.id)}
              />
            ))}
          </MotionDiv>
        ) : myJobs.length === 0 ? (
          <MotionDiv
            key="empty"
            variants={itemVariants}
            className="rounded-2xl border-2 border-dashed border-[#E6ECF5] bg-[#E6ECF5]/50 py-24 text-center"
          >
            <Briefcase size={40} className="mx-auto mb-4 text-[#0A1D3D]/30" />
            <p className="font-semibold text-text-muted">Belum ada lowongan</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-[#0A1D3D]/40">
              Buat lowongan pertama untuk mulai menerima dan mengelola pelamar.
            </p>
            <Button
              variant="primary"
              className="mt-6 gap-2 text-white"
              onClick={() => navigate('/hr/lowongan/baru')}
            >
              <Plus size={16} />
              Buat Lowongan
            </Button>
          </MotionDiv>
        ) : (
          <MotionDiv
            key="no-results"
            variants={itemVariants}
            className="rounded-2xl border border-dashed border-[#E6ECF5] bg-[#E6ECF5]/50 py-16 text-center"
          >
            <Filter size={32} className="mx-auto mb-3 text-[#0A1D3D]/30" />
            <p className="font-medium text-text-muted">Tidak ada lowongan yang cocok.</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 text-brand"
              onClick={() => {
                setSearch('');
                setStatusFilter('All');
                setSortBy('newest');
                setShowSortMenu(false);
              }}
            >
              Hapus filter
            </Button>
          </MotionDiv>
        )}
      </AnimatePresence>

      <Modal
        isOpen={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        title="Konfirmasi hapus"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>
              Batal
            </Button>
            <Button variant="danger" onClick={() => handleDelete(deleteConfirmId)}>
              Hapus
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-text-muted">
          Lowongan dan data pelamar terkait akan dihapus. Tindakan ini tidak dapat dibatalkan.
        </p>
      </Modal>
    </MotionDiv>
  );
}
