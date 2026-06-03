import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Download,
  FileDown,
  Filter,
  GraduationCap,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Users,
  X,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Select } from '../../components/ui/Input';
import { applicationsApi } from '../../api/applications';
import { opportunitiesApi } from '../../api/opportunities';
import { fetchWithAuth, resolveUploadUrl } from '../../api/client';
import { usersApi } from '../../api/users';
import { useToast } from '../../context/ToastContext';
import { buildMajorOptions } from '../../data/ipbMajors';
import { getSkillSuggestions, normalizeSkillLabel, normalizeSkillList } from '../../data/skills';
import { useCloseOnScroll } from '../../hooks/useCloseOnScroll';
import { useOrganization } from '../../hooks/useOrganization';

const MotionDiv = motion.div;
const MotionSpan = motion.span;
const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

if (typeof window !== 'undefined' && 'Worker' in window) {
  GlobalWorkerOptions.workerPort = new PdfWorker();
}

const STATUS_OPTIONS = [
  { value: 'Applied', label: 'Applied' },
  { value: 'Screening', label: 'Screening' },
  { value: 'Interview', label: 'Interview' },
  { value: 'Accepted', label: 'Accepted' },
  { value: 'Rejected', label: 'Rejected' },
];

const STATUS_FILTERS = ['All', ...STATUS_OPTIONS.map((option) => option.value)];
const SORT_OPTIONS = ['newest', 'oldest', 'name', 'status'];
const APPLICANTS_PER_PAGE = 10;
const OPPORTUNITY_TYPES = [
  { value: 'Internship', label: 'Internship' },
  { value: 'Full-time', label: 'Full-time' },
  { value: 'Scholarship', label: 'Scholarship' },
];
const QUESTION_TYPES = [
  { value: 'short_text', label: 'Jawaban singkat' },
  { value: 'long_text', label: 'Paragraf' },
  { value: 'single_choice', label: 'Pilihan tunggal' },
];

const STATUS_STYLES = {
  Applied: 'bg-[#E6ECF5] text-blue-700 border-blue-200',
  Screening: 'bg-amber-50 text-amber-700 border-amber-200',
  Interview: 'bg-purple-50 text-purple-700 border-purple-200',
  Accepted: 'bg-green-50 text-green-700 border-green-200',
  Rejected: 'bg-red-50 text-red-700 border-red-200',
};

const TABS = [
  { id: 'overview', label: 'Ringkasan', icon: BarChart3 },
  { id: 'applicants', label: 'Pelamar', icon: Users },
  { id: 'questions', label: 'Pertanyaan', icon: BookOpen },
  { id: 'details', label: 'Detail Lowongan', icon: Briefcase },
];

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

function formatDate(value, options = {}) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  });
}

function toLocalDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatRupiah(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return `Rp ${new Intl.NumberFormat('id-ID').format(Number(digits))}`;
}

function formatSalaryInput(value) {
  const parts = String(value || '').match(/\d[\d.,]*/g) || [];
  if (!parts.length) return value;
  const amounts = parts
    .map((part) => formatRupiah(part))
    .filter(Boolean)
    .slice(0, 2);

  if (amounts.length === 1) return amounts[0];
  return `${amounts[0]} - ${amounts[1]}`;
}

function toDateInputValue(value) {
  if (!value) return '';
  return String(value).split('T')[0];
}

function normalizeStatusValue(value) {
  return String(value || '').trim().toLowerCase();
}

function formatApplicantName(app) {
  if (app.student) {
    return `${app.student.first_name || ''} ${app.student.last_name || ''}`.trim() || `Student #${app.student_id}`;
  }
  return `Student #${app.student_id}`;
}

function normalizeApplications(data) {
  const apps = Array.isArray(data) ? data : data.items || [];
  return apps.map((app) => ({
    ...app,
    applicantName: formatApplicantName(app),
  }));
}

function StatCard({ icon: Icon, label, value, color, helper }) {
  return (
    <MotionDiv
      variants={itemVariants}
      className="flex min-w-[155px] flex-1 items-center gap-4 rounded-2xl border border-[#E6ECF5] bg-white px-5 py-4 shadow-sm"
    >
      <div className={`rounded-xl p-2.5 ${color}`}>
        {React.createElement(Icon, { size: 20, className: 'text-white' })}
      </div>
      <div>
        <p className="text-2xl font-bold text-text tabular-nums">{value}</p>
        <p className="mt-0.5 text-xs text-text-muted">{label}</p>
        {helper && <p className="mt-0.5 text-[11px] text-text-light">{helper}</p>}
      </div>
    </MotionDiv>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status] || 'border-[#E6ECF5] bg-[#E6ECF5] text-[#0A1D3D]/60'}`}>
      {status || '-'}
    </span>
  );
}

function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#E6ECF5] bg-[#E6ECF5]/50 py-16 text-center">
      {React.createElement(Icon, { size: 34, className: 'mx-auto mb-3 text-[#0A1D3D]/30' })}
      <p className="font-medium text-text-muted">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-[#0A1D3D]/40">{description}</p>}
      {action}
    </div>
  );
}

function ApplicantAvatar({ app }) {
  const student = app.student;
  const name = app.applicantName || 'Applicant';
  const url =
    resolveUploadUrl(student?.avatar) ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a8754&color=fff&size=64`;

  return (
    <img
      src={url}
      alt={name}
      className="h-10 w-10 flex-shrink-0 rounded-xl object-cover ring-1 ring-[#E6ECF5]"
    />
  );
}

function OverviewTab({ opportunity, applicants, stats, onChangeTab }) {
  const applicantTrend = useMemo(() => {
    const buckets = applicants.reduce((acc, app) => {
      if (!app.applied_at) return acc;
      const key = toLocalDateKey(app.applied_at);
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const applicationDates = applicants
      .map((app) => new Date(app.applied_at || ''))
      .filter((date) => !Number.isNaN(date.getTime()));
    const endDate = applicationDates.length
      ? new Date(Math.max(...applicationDates.map((date) => date.getTime())))
      : new Date();
    endDate.setHours(0, 0, 0, 0);

    return Array.from({ length: 30 }, (_, index) => {
      const day = new Date(endDate);
      day.setDate(endDate.getDate() - (29 - index));
      const date = toLocalDateKey(day);
      const count = buckets[date] || 0;
      return {
        date,
        count,
        label: day.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      };
    });
  }, [applicants]);
  const maxTrend = Math.max(1, ...applicantTrend.map((item) => item.count));
  const hasTrend = applicantTrend.some((item) => item.count > 0);
  const chartWidth = 600;
  const chartHeight = 190;
  const chartPadding = { top: 18, right: 18, bottom: 28, left: 36 };
  const chartPoints = applicantTrend.map((item, index) => {
    const x = chartPadding.left + (index / Math.max(1, applicantTrend.length - 1)) * (chartWidth - chartPadding.left - chartPadding.right);
    const y = chartHeight - chartPadding.bottom - (item.count / maxTrend) * (chartHeight - chartPadding.top - chartPadding.bottom);
    return { ...item, x, y };
  });
  const linePath = chartPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${chartWidth - chartPadding.right} ${chartHeight - chartPadding.bottom} L ${chartPadding.left} ${chartHeight - chartPadding.bottom} Z`;
  const peakDay = applicantTrend.reduce(
    (best, item) => (item.count > best.count ? item : best),
    { count: 0, label: '-' }
  );
  const recentApplicants = [...applicants]
    .sort((a, b) => new Date(b.applied_at || 0) - new Date(a.applied_at || 0))
    .slice(0, 5);

  return (
    <MotionDiv variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <MotionDiv variants={itemVariants} className="xl:col-span-2">
          <Card className="rounded-2xl border-[#E6ECF5]">
            <CardBody className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-text">Tren pelamar</h2>
                  <p className="mt-1 text-sm text-text-muted">Jumlah pelamar berdasarkan tanggal masuk.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => onChangeTab('applicants')}>
                  Lihat pelamar
                </Button>
              </div>

              {hasTrend ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-[#E6ECF5] bg-[#E6ECF5]/60 p-3">
                      <p className="text-xs text-text-light">Total pelamar</p>
                      <p className="mt-1 text-2xl font-bold text-text tabular-nums">{stats.totalApplicants}</p>
                    </div>
                    <div className="rounded-xl border border-[#E6ECF5] bg-[#E6ECF5]/60 p-3">
                      <p className="text-xs text-text-light">Hari puncak</p>
                      <p className="mt-1 text-2xl font-bold text-text tabular-nums">{peakDay.count}</p>
                    </div>
                    <div className="rounded-xl border border-[#E6ECF5] bg-[#E6ECF5]/60 p-3">
                      <p className="text-xs text-text-light">Tanggal puncak</p>
                      <p className="mt-1 text-base font-semibold text-text">{peakDay.label}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#E6ECF5] bg-[#E6ECF5]/50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-medium text-text">30D applicants</p>
                      <p className="text-xs text-text-muted">
                        {applicantTrend[0]?.label} - {applicantTrend.at(-1)?.label}
                      </p>
                    </div>
                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-56 w-full overflow-visible" role="img" aria-label="Grafik pelamar 30 hari">
                      <defs>
                        <linearGradient id="applicantTrendFill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#1E3A8A" stopOpacity="0.22" />
                          <stop offset="100%" stopColor="#1E3A8A" stopOpacity="0.02" />
                        </linearGradient>
                      </defs>
                      {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                        const y = chartPadding.top + tick * (chartHeight - chartPadding.top - chartPadding.bottom);
                        const value = Math.round(maxTrend * (1 - tick));
                        return (
                          <g key={tick}>
                            <line
                              x1={chartPadding.left}
                              x2={chartWidth - chartPadding.right}
                              y1={y}
                              y2={y}
                              stroke="#e5e7eb"
                              strokeWidth="1"
                            />
                            <text x={chartPadding.left - 10} y={y + 4} textAnchor="end" className="fill-[#0A1D3D]/40 text-[10px]">
                              {value}
                            </text>
                          </g>
                        );
                      })}
                      <path d={areaPath} fill="url(#applicantTrendFill)" />
                      <path d={linePath} fill="none" stroke="#1E3A8A" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
                      {chartPoints.map((point) => (
                        <circle
                          key={point.date}
                          cx={point.x}
                          cy={point.y}
                          r={point.count > 0 ? 4 : 2.5}
                          fill={point.count > 0 ? '#1E3A8A' : '#d1d5db'}
                        >
                          <title>{`${point.label}: ${point.count} pelamar`}</title>
                        </circle>
                      ))}
                    </svg>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={BarChart3}
                  title="Belum ada tren pelamar"
                  description="Grafik akan muncul setelah ada pelamar masuk."
                />
              )}
            </CardBody>
          </Card>
        </MotionDiv>

        <MotionDiv variants={itemVariants}>
          <Card className="rounded-2xl border-[#E6ECF5]">
            <CardBody className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-text">Info cepat</h2>
                <p className="mt-1 text-sm text-text-muted">Ringkasan lowongan.</p>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-text-muted">
                  <Briefcase size={15} />
                  <span>{opportunity.type || '-'}</span>
                </div>
                <div className="flex items-center gap-2 text-text-muted">
                  <MapPin size={15} />
                  <span>{opportunity.location || '-'}</span>
                </div>
                <div className="flex items-center gap-2 text-text-muted">
                  <CalendarDays size={15} />
                  <span>Deadline {formatDate(opportunity.deadline)}</span>
                </div>
                <Badge variant={opportunity.is_active !== false ? 'success' : 'error'}>
                  {opportunity.is_active !== false ? 'Aktif' : 'Ditutup'}
                </Badge>
              </div>
            </CardBody>
          </Card>
        </MotionDiv>
      </div>

      <MotionDiv variants={itemVariants}>
        <Card className="rounded-2xl border-[#E6ECF5]">
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-text">Pelamar terbaru</h2>
                <p className="mt-1 text-sm text-text-muted">Aktivitas terbaru untuk lowongan ini.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onChangeTab('applicants')} className="text-brand">
                Buka daftar
              </Button>
            </div>
            {recentApplicants.length > 0 ? (
              <div className="space-y-2">
                {recentApplicants.map((app) => (
                  <div key={app.id} className="flex items-center gap-3 rounded-xl border border-[#E6ECF5] px-3 py-3">
                    <ApplicantAvatar app={app} />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium text-text">{app.applicantName}</p>
                      <p className="text-xs text-text-muted">Melamar {formatDate(app.applied_at)}</p>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Users}
                title="Belum ada pelamar"
                description="Pelamar yang masuk akan muncul di sini."
              />
            )}
          </CardBody>
        </Card>
      </MotionDiv>
    </MotionDiv>
  );
}

function ApplicantsTab({
  applicants,
  filteredApplicants,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  sortBy,
  setSortBy,
  selectedIds,
  setSelectedIds,
  bulkStatus,
  setBulkStatus,
  onBulkUpdate,
  onStatusChange,
  selectedApp,
  onSelectApplicant,
  updating,
}) {
  const { addToast } = useToast();
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [downloadingCV, setDownloadingCV] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  useCloseOnScroll(showSortMenu, () => setShowSortMenu(false));
  const sortLabels = {
    newest: 'Terbaru',
    oldest: 'Terlama',
    name: 'Nama pelamar',
    status: 'Status',
  };
  const pageCount = Math.max(1, Math.ceil(filteredApplicants.length / APPLICANTS_PER_PAGE));
  const safePage = Math.min(currentPage, pageCount);
  const pageStart = (safePage - 1) * APPLICANTS_PER_PAGE;
  const pageEnd = Math.min(pageStart + APPLICANTS_PER_PAGE, filteredApplicants.length);
  const paginatedApplicants = useMemo(
    () => filteredApplicants.slice(pageStart, pageEnd),
    [filteredApplicants, pageEnd, pageStart]
  );
  const allVisibleSelected = paginatedApplicants.length > 0 && paginatedApplicants.every((app) => selectedIds.has(app.id));

  useEffect(() => {
    setCurrentPage(1);
  }, [search, sortBy, statusFilter]);

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, pageCount]);

  useEffect(() => {
    if (!paginatedApplicants.length) return;
    if (paginatedApplicants.some((app) => app.id === selectedApp?.id)) return;
    onSelectApplicant(paginatedApplicants[0]);
  }, [onSelectApplicant, paginatedApplicants, selectedApp?.id]);

  const toggleSelection = (appId) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        paginatedApplicants.forEach((app) => next.delete(app.id));
        return next;
      }
      paginatedApplicants.forEach((app) => next.add(app.id));
      return next;
    });
  };

  const handleDownloadCV = async () => {
    if (!selectedApp?.student?.id) return;
    setDownloadingCV(true);
    try {
      await usersApi.downloadUserCV(selectedApp.student.id);
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal', message: err.message || 'Gagal mengunduh CV.' });
    } finally {
      setDownloadingCV(false);
    }
  };

  return (
    <MotionDiv variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">
      <MotionDiv variants={itemVariants} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-light" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama, email, jurusan..."
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
              className="w-full gap-2 lg:w-auto"
              onClick={() => setShowSortMenu((open) => !open)}
            >
              <Filter size={16} />
              Urutkan
            </Button>
            {showSortMenu && (
              <div className="absolute right-0 z-20 mt-2 min-w-[210px] overflow-hidden rounded-xl border border-[#E6ECF5] bg-white shadow-lg">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setSortBy(option);
                      setShowSortMenu(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${sortBy === option
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
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${statusFilter === status
                ? 'border-brand bg-brand text-white shadow-sm'
                : 'border-[#E6ECF5] bg-white text-text-muted hover:border-brand/30 hover:text-brand'
                }`}
            >
              {status === 'All' ? 'Semua' : status}
            </button>
          ))}
        </div>
      </MotionDiv>

      <MotionDiv variants={itemVariants} className="rounded-2xl border border-[#E6ECF5] bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-text-muted">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAll}
              className="rounded border-[#E6ECF5]"
            />
            Pilih halaman ini ({paginatedApplicants.length})
          </label>
          <div className="flex flex-1 flex-col gap-2 sm:flex-row lg:justify-end">
            <div className="min-w-[180px]">
              <Select
                value={bulkStatus}
                onChange={(event) => setBulkStatus(event.target.value)}
                options={[{ value: '', label: 'Ubah status...' }, ...STATUS_OPTIONS]}
              />
            </div>
            <Button
              variant="primary"
              className="text-white"
              disabled={selectedIds.size === 0 || !bulkStatus || updating}
              onClick={onBulkUpdate}
            >
              Terapkan ({selectedIds.size})
            </Button>
          </div>
        </div>
      </MotionDiv>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(330px,0.82fr)_minmax(420px,1.18fr)]">
        <MotionDiv variants={itemVariants} className="min-w-0">
          <div className="overflow-hidden rounded-2xl border border-[#E6ECF5] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#E6ECF5] bg-[#E6ECF5]/60 px-4 py-3">
              <p className="text-sm font-medium text-text-muted">
                {filteredApplicants.length > 0
                  ? `${pageStart + 1}-${pageEnd} dari ${filteredApplicants.length}`
                  : '0'} dari {applicants.length} pelamar
              </p>
              <span className="text-xs text-text-light">Klik nama untuk melihat profil</span>
            </div>

            <div className="space-y-2 bg-[#E6ECF5]/30 p-3">
              {filteredApplicants.length > 0 ? (
                paginatedApplicants.map((app) => {
                  const isSelected = selectedApp?.id === app.id;
                  return (
                    <article
                      key={app.id}
                      onClick={() => onSelectApplicant(app)}
                      className={`applicant-card cursor-pointer rounded-xl border bg-white p-4 transition-all ${isSelected
                        ? 'border-brand bg-brand/5 ring-1 ring-brand'
                        : 'border-[#E6ECF5] hover:border-brand/30 hover:shadow-sm'
                        }`}
                    >
                      <div className="applicant-card-layout">
                        <div className="flex min-w-0 items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(app.id)}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => toggleSelection(app.id)}
                            className="rounded border-[#E6ECF5]"
                            aria-label={`Pilih ${app.applicantName}`}
                          />
                          <ApplicantAvatar app={app} />
                          <button
                            type="button"
                            onClick={() => onSelectApplicant(app)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="line-clamp-1 font-semibold text-text transition-colors hover:text-brand">
                              {app.applicantName}
                            </p>
                            <p className="applicant-card-email line-clamp-1 text-sm text-text-muted">
                              {app.student?.email || '-'}
                            </p>
                          </button>
                        </div>

                        <div className="applicant-card-mobile-status">
                          <StatusBadge status={app.status} />
                        </div>

                        <div className="applicant-card-secondary gap-3 text-sm">
                          <div>
                            <p className="text-xs text-text-light">Jurusan</p>
                            <p className="line-clamp-1 font-medium text-text">{app.student?.major || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-text-light">Melamar</p>
                            <p className="font-medium text-text">{formatDate(app.applied_at)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-text-light">Status</p>
                            <StatusBadge status={app.status} />
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : applicants.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Belum ada pelamar"
                  description="Ketika mahasiswa melamar, profil mereka akan muncul di daftar ini."
                />
              ) : (
                <EmptyState
                  icon={Filter}
                  title="Tidak ada pelamar yang cocok"
                  description="Coba ubah kata kunci atau status filter."
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3 text-brand"
                      onClick={() => {
                        setSearch('');
                        setStatusFilter('All');
                        setSortBy('newest');
                      }}
                    >
                      Hapus filter
                    </Button>
                  }
                />
              )}
            </div>

            {filteredApplicants.length > APPLICANTS_PER_PAGE && (
              <div className="flex flex-col gap-3 border-t border-[#E6ECF5] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-text-light">
                  Halaman {safePage} dari {pageCount}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={safePage === 1}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#E6ECF5] bg-white px-3 text-sm font-medium text-text-muted transition hover:border-brand/30 hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <ChevronLeft size={15} />
                    Sebelumnya
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                    disabled={safePage === pageCount}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#E6ECF5] bg-white px-3 text-sm font-medium text-text-muted transition hover:border-brand/30 hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Berikutnya
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </MotionDiv>

        <MotionDiv variants={itemVariants} className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <ApplicantDetailPanel
            app={selectedApp}
            onStatusChange={onStatusChange}
            downloadingCV={downloadingCV}
            onDownloadCV={handleDownloadCV}
          />
        </MotionDiv>
      </div>
    </MotionDiv>
  );
}

function DetailsTab({ opportunity, onOpportunityUpdated }) {
  const { addToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [skillInput, setSkillInput] = useState('');
  const [form, setForm] = useState(() => ({
    title: opportunity.title || '',
    type: opportunity.type || 'Internship',
    location: opportunity.location || '',
    salary: opportunity.salary || '',
    description: opportunity.description || '',
    requirements:
      Array.isArray(opportunity.requirements) && opportunity.requirements.length > 0
        ? opportunity.requirements
        : [''],
    target_majors:
      Array.isArray(opportunity.target_majors) && opportunity.target_majors.length > 0
        ? opportunity.target_majors
        : [''],
    skill_tags:
      Array.isArray(opportunity.skill_tags) && opportunity.skill_tags.length > 0
        ? normalizeSkillList(opportunity.skill_tags)
        : [],
    deadline: toDateInputValue(opportunity.deadline),
    is_active: opportunity.is_active !== false,
  }));

  const requirements = Array.isArray(opportunity.requirements) ? opportunity.requirements : [];
  const targetMajors = Array.isArray(opportunity.target_majors) ? opportunity.target_majors : [];
  const skillTags = Array.isArray(opportunity.skill_tags) ? opportunity.skill_tags : [];
  const selectedSkillTags = normalizeSkillList(form.skill_tags);
  const skillSuggestions = getSkillSuggestions(selectedSkillTags, skillInput, 8);

  const handleChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSalaryChange = (event) => {
    setForm((current) => ({ ...current, salary: formatSalaryInput(event.target.value) }));
  };

  const handleListChange = (field, index) => (event) => {
    setForm((current) => {
      const values = [...current[field]];
      values[index] = event.target.value;
      return { ...current, [field]: values };
    });
  };

  const addListItem = (field) => {
    setForm((current) => ({ ...current, [field]: [...current[field], ''] }));
  };

  const removeListItem = (field, index) => {
    setForm((current) => {
      const values = current[field].filter((_, itemIndex) => itemIndex !== index);
      return { ...current, [field]: values.length > 0 ? values : [''] };
    });
  };

  const cleanList = (values) => {
    const seen = new Set();
    return values
      .map((value) => value.trim())
      .filter((value) => {
        const key = value.toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const addSkillTag = (value) => {
    const skill = normalizeSkillLabel(value);
    if (!skill) return;
    setForm((current) => ({
      ...current,
      skill_tags: normalizeSkillList([...current.skill_tags, skill]),
    }));
    setSkillInput('');
  };

  const removeSkillTag = (skill) => {
    setForm((current) => ({
      ...current,
      skill_tags: current.skill_tags.filter((item) => item.toLowerCase() !== skill.toLowerCase()),
    }));
  };

  const handleSkillInputKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addSkillTag(skillInput);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.type || !form.location.trim()) {
      addToast({ type: 'error', title: 'Validasi', message: 'Judul, tipe, dan lokasi wajib diisi.' });
      return;
    }

    setSaving(true);
    const payload = {
      ...form,
      title: form.title.trim(),
      location: form.location.trim(),
      requirements: cleanList(form.requirements),
      target_majors: cleanList(form.target_majors),
      skill_tags: normalizeSkillList(form.skill_tags),
      deadline: form.deadline || null,
      salary: formatSalaryInput(form.salary) || null,
      description: form.description || null,
    };

    try {
      const updated = await opportunitiesApi.update(opportunity.id, payload);
      onOpportunityUpdated({ ...opportunity, ...payload, ...updated });
      addToast({ type: 'success', title: 'Berhasil', message: 'Lowongan berhasil diperbarui.' });
      setIsEditing(false);
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal', message: err.message || 'Gagal menyimpan lowongan.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <MotionDiv variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <MotionDiv variants={itemVariants} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div />
        {isEditing ? (
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
              Batal
            </Button>
            <Button type="submit" form="opportunity-inline-edit" disabled={saving} className="gap-2 text-white">
              <Save size={16} />
              {saving ? 'Menyimpan...' : 'Simpan perubahan'}
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setIsEditing(true)}
          >
            <Pencil size={16} />
            Edit lowongan
          </Button>
        )}
      </MotionDiv>

      {!isEditing ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <MotionDiv variants={itemVariants} className="xl:col-span-2">
            <Card className="rounded-2xl border-[#E6ECF5]">
              <CardBody className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-text">Deskripsi</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-muted">
                    {opportunity.description || 'Belum ada deskripsi.'}
                  </p>
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-text">Persyaratan</h2>
                  {requirements.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {requirements.map((item, index) => (
                        <li key={`${item}-${index}`} className="flex gap-2 text-sm text-text-muted">
                          <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-brand" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-text-muted">Belum ada persyaratan.</p>
                  )}
                </div>
              </CardBody>
            </Card>
          </MotionDiv>

          <MotionDiv variants={itemVariants}>
            <Card className="rounded-2xl border-[#E6ECF5]">
              <CardBody className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-text">Metadata</h2>
                  <p className="mt-1 text-sm text-text-muted">Informasi utama lowongan.</p>
                </div>
                <div className="space-y-3 text-sm">
                  <InfoRow icon={Briefcase} label="Tipe" value={opportunity.type || '-'} />
                  <InfoRow icon={MapPin} label="Lokasi" value={opportunity.location || '-'} />
                  <InfoRow icon={Clock} label="Gaji" value={opportunity.salary || '-'} />
                  <InfoRow icon={CalendarDays} label="Deadline" value={formatDate(opportunity.deadline)} />
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold text-text-muted">Target jurusan</p>
                  <TagList items={targetMajors} empty="Tidak dibatasi" />
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold text-text-muted">Tag skill</p>
                  <TagList items={skillTags} empty="Belum ada tag" />
                </div>
              </CardBody>
            </Card>
          </MotionDiv>
        </div>
      ) : (
        <MotionDiv
          key="inline-edit"
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          exit={{ opacity: 0, y: -8 }}
        >
          <Card className="rounded-2xl border-brand/15">
            <CardBody>
              <form id="opportunity-inline-edit" className="space-y-5" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Field label="Judul posisi">
                    <input
                      value={form.title}
                      onChange={handleChange('title')}
                      className={FIELD_INPUT_CLASS}
                      placeholder="Contoh: Frontend Developer Intern"
                      required
                    />
                  </Field>
                  <Field label="Tipe">
                    <Select
                      value={form.type}
                      onChange={handleChange('type')}
                      options={OPPORTUNITY_TYPES}
                    />
                  </Field>
                  <Field label="Lokasi">
                    <input
                      value={form.location}
                      onChange={handleChange('location')}
                      className={FIELD_INPUT_CLASS}
                      placeholder="Contoh: Jakarta, Indonesia"
                      required
                    />
                  </Field>
                  <Field label="Deadline">
                    <input
                      type="date"
                      value={form.deadline}
                      onChange={handleChange('deadline')}
                      className={FIELD_INPUT_CLASS}
                    />
                  </Field>
                  <Field label="Gaji">
                    <input
                      value={form.salary}
                      onChange={handleSalaryChange}
                      onBlur={() => setForm((current) => ({ ...current, salary: formatSalaryInput(current.salary) }))}
                      className={FIELD_INPUT_CLASS}
                      placeholder="Contoh: Rp 3.000.000 - Rp 5.000.000"
                    />
                  </Field>
                  <label className="flex items-center gap-2 self-end rounded-xl border border-[#E6ECF5] bg-[#E6ECF5] px-3 py-2.5 text-sm text-text-muted">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={handleChange('is_active')}
                      className="rounded border-[#E6ECF5]"
                    />
                    Lowongan aktif
                  </label>
                </div>

                <Field label="Deskripsi">
                  <textarea
                    value={form.description}
                    onChange={handleChange('description')}
                    className={`${FIELD_INPUT_CLASS} min-h-[180px] resize-y`}
                    placeholder="Deskripsikan lowongan ini..."
                  />
                </Field>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-text-muted">Target jurusan</label>
                    <div className="space-y-2">
                      {form.target_majors.map((major, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Select
                            value={major}
                            onChange={handleListChange('target_majors', index)}
                            placeholder="Pilih jurusan IPB"
                            options={buildMajorOptions(form.target_majors)}
                          />
                          {form.target_majors.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeListItem('target_majors', index)}
                              className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => addListItem('target_majors')}
                      className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-dark"
                    >
                      <Plus size={14} />
                      Tambah jurusan
                    </button>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-text-muted">Tag keahlian</label>
                    <div className="rounded-xl border border-[#E6ECF5] bg-white p-3 shadow-sm focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/20">
                      {selectedSkillTags.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {selectedSkillTags.map((skill) => (
                            <button
                              key={skill}
                              type="button"
                              onClick={() => removeSkillTag(skill)}
                              className="inline-flex items-center gap-1 rounded-lg border border-brand/10 bg-brand/5 px-2.5 py-1 text-xs font-medium text-brand hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                            >
                              {skill}
                              <X size={13} />
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          value={skillInput}
                          onChange={(event) => setSkillInput(event.target.value)}
                          onKeyDown={handleSkillInputKeyDown}
                          placeholder="Cari atau ketik skill"
                          className="min-w-0 flex-1 border-none bg-transparent text-sm outline-none placeholder:text-[#0A1D3D]/40"
                        />
                        <button
                          type="button"
                          onClick={() => addSkillTag(skillInput)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E6ECF5] text-brand transition-colors hover:border-brand/30 hover:bg-brand/5"
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    </div>

                    {skillSuggestions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {skillSuggestions.map((skill) => (
                          <button
                            key={skill}
                            type="button"
                            onClick={() => addSkillTag(skill)}
                            className="rounded-lg border border-[#E6ECF5] bg-white px-2.5 py-1 text-xs font-medium text-text-muted transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-brand"
                          >
                            {skill}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-text-muted">Persyaratan</label>
                  <div className="space-y-2">
                    {form.requirements.map((requirement, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          value={requirement}
                          onChange={handleListChange('requirements', index)}
                          className={FIELD_INPUT_CLASS}
                          placeholder={`Persyaratan ${index + 1}`}
                        />
                        {form.requirements.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeListItem('requirements', index)}
                            className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => addListItem('requirements')}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-dark"
                  >
                    <Plus size={14} />
                    Tambah persyaratan
                  </button>
                </div>
              </form>
            </CardBody>
          </Card>
        </MotionDiv>
      )}
    </MotionDiv>
  );
}

function createQuestionId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeApplicationQuestions(questions) {
  return (Array.isArray(questions) ? questions : [])
    .map((question, index) => ({
      id: question.id || `q_${index + 1}`,
      label: question.label || '',
      type: question.type || 'short_text',
      required: Boolean(question.required),
      options: Array.isArray(question.options) ? question.options : [],
    }));
}

function QuestionsTab({ opportunity, onOpportunityUpdated }) {
  const { addToast } = useToast();
  const [questions, setQuestions] = useState(() => normalizeApplicationQuestions(opportunity.application_questions));
  const [saving, setSaving] = useState(false);

  const addQuestion = () => {
    setQuestions((current) => [
      ...current,
      {
        id: createQuestionId(),
        label: '',
        type: 'short_text',
        required: false,
        options: [],
      },
    ]);
  };

  const updateQuestion = (id, patch) => {
    setQuestions((current) => current.map((question) => (
      question.id === id ? { ...question, ...patch } : question
    )));
  };

  const removeQuestion = (id) => {
    setQuestions((current) => current.filter((question) => question.id !== id));
  };

  const updateOption = (questionId, optionIndex, value) => {
    setQuestions((current) => current.map((question) => {
      if (question.id !== questionId) return question;
      const options = [...question.options];
      options[optionIndex] = value;
      return { ...question, options };
    }));
  };

  const addOption = (questionId) => {
    setQuestions((current) => current.map((question) => (
      question.id === questionId ? { ...question, options: [...question.options, ''] } : question
    )));
  };

  const removeOption = (questionId, optionIndex) => {
    setQuestions((current) => current.map((question) => (
      question.id === questionId
        ? { ...question, options: question.options.filter((_, index) => index !== optionIndex) }
        : question
    )));
  };

  const cleanQuestions = () => questions
    .map((question) => ({
      ...question,
      label: question.label.trim(),
      options: question.options.map((option) => option.trim()).filter(Boolean),
    }))
    .filter((question) => question.label);

  const handleSave = async () => {
    const payload = cleanQuestions();
    const invalidChoice = payload.find((question) => question.type === 'single_choice' && question.options.length < 2);
    if (invalidChoice) {
      addToast({ type: 'error', title: 'Validasi', message: 'Pertanyaan pilihan tunggal butuh minimal 2 opsi.' });
      return;
    }

    setSaving(true);
    try {
      const updated = await opportunitiesApi.update(opportunity.id, {
        application_questions: payload,
      });
      onOpportunityUpdated({ ...opportunity, ...updated });
      setQuestions(normalizeApplicationQuestions(updated.application_questions));
      addToast({ type: 'success', title: 'Berhasil', message: 'Pertanyaan aplikasi berhasil disimpan.' });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal', message: err.message || 'Gagal menyimpan pertanyaan.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <MotionDiv variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">
      <MotionDiv variants={itemVariants} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-text">Pertanyaan perusahaan</h2>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            Pertanyaan ini muncul di form aplikasi mahasiswa sebelum pesan untuk recruiter.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={addQuestion}>
            <Plus size={16} />
            Tambah
          </Button>
          <Button type="button" className="gap-2 text-white" onClick={handleSave} disabled={saving}>
            <Save size={16} />
            {saving ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      </MotionDiv>

      <MotionDiv variants={itemVariants} className="overflow-hidden rounded-2xl border border-[#E6ECF5] bg-white shadow-sm">
        {questions.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <BookOpen size={34} className="mx-auto mb-3 text-[#0A1D3D]/30" />
            <p className="font-semibold text-text-muted">Belum ada pertanyaan tambahan</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-[#0A1D3D]/40">
              Gunakan ini untuk pertanyaan screening seperti portfolio, ketersediaan mulai, atau motivasi spesifik.
            </p>
            <Button type="button" variant="outline" className="mt-5 gap-2" onClick={addQuestion}>
              <Plus size={16} />
              Tambah pertanyaan
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-[#E6ECF5]">
            {questions.map((question, index) => (
              <section key={question.id} className="p-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-start">
                  <Field label={`Pertanyaan ${index + 1}`}>
                    <input
                      value={question.label}
                      onChange={(event) => updateQuestion(question.id, { label: event.target.value })}
                      className={FIELD_INPUT_CLASS}
                      placeholder="Contoh: Link portfolio atau GitHub Anda"
                    />
                  </Field>
                  <Field label="Tipe jawaban">
                    <Select
                      value={question.type}
                      onChange={(event) => updateQuestion(question.id, {
                        type: event.target.value,
                        options: event.target.value === 'single_choice' ? question.options : [],
                      })}
                      options={QUESTION_TYPES}
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={() => removeQuestion(question.id)}
                    className="mt-6 inline-flex h-10 w-10 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50"
                    aria-label="Hapus pertanyaan"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>

                <label className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-text-muted">
                  <input
                    type="checkbox"
                    checked={question.required}
                    onChange={(event) => updateQuestion(question.id, { required: event.target.checked })}
                    className="rounded border-[#E6ECF5]"
                  />
                  Wajib dijawab
                </label>

                {question.type === 'single_choice' && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-text-muted">Opsi jawaban</p>
                    {question.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center gap-2">
                        <input
                          value={option}
                          onChange={(event) => updateOption(question.id, optionIndex, event.target.value)}
                          className={FIELD_INPUT_CLASS}
                          placeholder={`Opsi ${optionIndex + 1}`}
                        />
                        <button
                          type="button"
                          onClick={() => removeOption(question.id, optionIndex)}
                          className="rounded-lg p-2 text-red-500 transition hover:bg-red-50"
                          aria-label="Hapus opsi"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addOption(question.id)}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-brand transition hover:text-brand-dark"
                    >
                      <Plus size={14} />
                      Tambah opsi
                    </button>
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </MotionDiv>
    </MotionDiv>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      {React.createElement(Icon, { size: 16, className: 'mt-0.5 text-brand' })}
      <div>
        <p className="text-xs text-text-light">{label}</p>
        <p className="font-medium text-text">{value}</p>
      </div>
    </div>
  );
}

function TagList({ items, empty }) {
  if (!items.length) return <p className="text-sm text-text-muted">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="rounded-lg border border-brand/10 bg-brand/5 px-2.5 py-1 text-xs font-medium text-brand">
          {item}
        </span>
      ))}
    </div>
  );
}

const FIELD_INPUT_CLASS =
  'w-full rounded-xl !border !border-[#E6ECF5] bg-white px-3 py-2.5 text-sm shadow-sm transition focus:!border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/20';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-text-muted">{label}</span>
      {children}
    </label>
  );
}

async function fetchUserCvPdfData(userId, signal) {
  const res = await fetchWithAuth(`${API_BASE}/users/${userId}/cv/preview`, {
    method: 'GET',
    signal,
    headers: { Accept: 'application/json' },
  });

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(payload?.detail || 'Gagal memuat CV.');
  }

  if (!payload?.data) {
    throw new Error('Data CV tidak tersedia.');
  }

  const binary = window.atob(payload.data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function PdfCanvasViewer({ data, label }) {
  const shellRef = useRef(null);
  const containerRef = useRef(null);
  const [pageCount, setPageCount] = useState(0);
  const [renderError, setRenderError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!shellRef.current) return undefined;

    let frameId = 0;
    const shell = shellRef.current;
    const measure = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const nextWidth = Math.round(shell.getBoundingClientRect().width);
        setContainerWidth((current) => (Math.abs(current - nextWidth) > 2 ? nextWidth : current));
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(shell);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!data || !containerRef.current || !containerWidth) return undefined;

    let cancelled = false;
    let loadingTask = null;
    const container = containerRef.current;

    async function renderPdf() {
      setRenderError('');
      container.innerHTML = '';

      try {
        loadingTask = getDocument({ data: data.slice(0) });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        setPageCount(pdf.numPages);

        const width = Math.max(280, containerWidth - 32);
        const pixelRatio = window.devicePixelRatio || 1;

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) return;

          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(width / baseViewport.width, 1.35) * zoom;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          if (!context) throw new Error('Browser tidak mendukung canvas untuk preview CV.');

          canvas.width = Math.floor(viewport.width * pixelRatio);
          canvas.height = Math.floor(viewport.height * pixelRatio);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          canvas.className = 'mx-auto block rounded-lg bg-white shadow-sm ring-1 ring-[#E6ECF5]';
          context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

          const pageShell = document.createElement('div');
          pageShell.className = 'space-y-2';

          const pageLabel = document.createElement('div');
          pageLabel.className = 'text-center text-[11px] font-medium text-[#0A1D3D]/40';
          pageLabel.textContent = `Halaman ${pageNumber} dari ${pdf.numPages}`;

          pageShell.appendChild(canvas);
          pageShell.appendChild(pageLabel);
          container.appendChild(pageShell);

          await page.render({ canvasContext: context, viewport }).promise;
        }
      } catch (err) {
        if (!cancelled) {
          setRenderError(err.message || 'Gagal menampilkan CV.');
        }
      }
    }

    renderPdf();

    return () => {
      cancelled = true;
      loadingTask?.destroy?.();
      container.innerHTML = '';
    };
  }, [containerWidth, data, zoom]);

  if (renderError) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center p-6 text-center">
        <FileDown size={38} className="mb-3 text-[#0A1D3D]/30" />
        <p className="font-medium text-text-muted">CV tidak bisa ditampilkan</p>
        <p className="mt-1 max-w-sm text-sm text-[#0A1D3D]/40">{renderError}</p>
      </div>
    );
  }

  return (
    <div ref={shellRef} className="bg-[#E6ECF5]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6ECF5] bg-white px-3 py-2">
        <div className="min-w-0">
          <p className="line-clamp-1 text-xs font-semibold text-text">{label}</p>
          <p className="text-[11px] text-text-light">{pageCount ? `${pageCount} halaman` : 'Rendering...'}</p>
        </div>
        <div className="flex items-center rounded-lg border border-[#E6ECF5] bg-[#E6ECF5] p-1">
          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(0.75, Number((value - 0.15).toFixed(2))))}
            className="grid h-7 w-7 place-items-center rounded-md text-text-muted transition hover:bg-white hover:text-text active:scale-95"
            aria-label="Perkecil CV"
          >
            <ZoomOut size={14} />
          </button>
          <span className="w-12 text-center text-[11px] font-semibold text-text-muted">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(1.6, Number((value + 0.15).toFixed(2))))}
            className="grid h-7 w-7 place-items-center rounded-md text-text-muted transition hover:bg-white hover:text-text active:scale-95"
            aria-label="Perbesar CV"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>
      <div ref={containerRef} className="max-h-[58vh] min-h-[460px] space-y-5 overflow-auto p-4" />
    </div>
  );
}

function ApplicantDetailPanel({
  app,
  onStatusChange,
  downloadingCV,
  onDownloadCV,
}) {
  const [cvData, setCvData] = useState(null);
  const [cvLoading, setCvLoading] = useState(false);
  const [cvError, setCvError] = useState('');
  const [activeDetailTab, setActiveDetailTab] = useState('profile');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setCvData(null);
    setCvError('');

    if (!app?.student?.id || !app.student.has_cv) {
      setCvLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setCvLoading(true);

    fetchUserCvPdfData(app.student.id, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setCvData(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setCvError(err.message || 'Gagal memuat CV.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCvLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [app?.student?.has_cv, app?.student?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!app) {
    return (
      <Card className="rounded-2xl border-dashed border-[#E6ECF5] bg-[#E6ECF5]/50">
        <CardBody className="flex min-h-[420px] flex-col items-center justify-center text-center">
          <Users size={40} className="mb-3 text-[#0A1D3D]/30" />
          <p className="font-semibold text-text-muted">Pilih pelamar</p>
          <p className="mt-1 max-w-xs text-sm text-[#0A1D3D]/40">
            Detail profil, CV, cover letter, dan riwayat status akan tampil di panel ini.
          </p>
        </CardBody>
      </Card>
    );
  }

  const student = app.student || {};
  const history = app.history || [];
  const applicationQuestions = Array.isArray(app.opportunity?.application_questions)
    ? app.opportunity.application_questions
    : [];
  const questionAnswers = app.question_answers || {};

  return (
    <Card className="rounded-2xl border-[#E6ECF5]">
      <CardBody className="space-y-5">
        <div className="flex rounded-xl border border-[#E6ECF5] bg-[#E6ECF5] p-1">
          {[
            { id: 'profile', label: 'Profil' },
            { id: 'cv', label: 'CV' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveDetailTab(tab.id)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                activeDetailTab === tab.id
                  ? 'bg-white text-brand shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeDetailTab === 'profile' ? (
          <div className="min-w-0 space-y-5">
            <div className="rounded-2xl border border-[#E6ECF5] bg-white p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <img
                  src={
                    resolveUploadUrl(student.avatar) ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(app.applicantName || 'Applicant')}&background=1a8754&color=fff&size=96`
                  }
                  alt={app.applicantName}
                  className="h-16 w-16 flex-shrink-0 rounded-2xl object-cover ring-1 ring-[#E6ECF5]"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-2 text-lg font-bold leading-tight text-text">{app.applicantName}</h3>
                  <p className="mt-1 flex min-w-0 items-center gap-1 text-sm text-text-muted">
                    <Mail size={14} className="flex-shrink-0" />
                    <span className="line-clamp-1">{student.email || '-'}</span>
                  </p>
                </div>
                <div className="w-full flex-shrink-0 sm:w-40">
                  <label className="mb-1 block text-xs font-semibold text-text-light">Ubah status</label>
                  <select
                    value={app.status || ''}
                    onChange={(event) => onStatusChange(app.id, event.target.value)}
                    className="h-10 w-full rounded-lg border border-[#E6ECF5] bg-white px-2.5 text-sm font-medium text-text shadow-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {student.bio && (
              <div>
                <p className="mb-1 text-xs font-semibold text-text-muted">Bio</p>
                <p className="whitespace-pre-wrap rounded-xl bg-[#E6ECF5] p-3 text-sm leading-6 text-text-muted">
                  {student.bio}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <InfoBox icon={BookOpen} label="Universitas" value={student.university || '-'} />
              <InfoBox icon={GraduationCap} label="Jurusan" value={student.major || '-'} />
              <InfoBox icon={Users} label="NIM" value={student.nim || '-'} />
              <InfoBox icon={BarChart3} label="IPK" value={student.gpa ? String(student.gpa) : '-'} />
            </div>

            {app.cover_letter && (
              <div>
                <p className="mb-1 text-xs font-semibold text-text-muted">Cover letter</p>
                <p className="max-h-[220px] overflow-y-auto whitespace-pre-wrap rounded-xl bg-[#E6ECF5] p-3 text-sm leading-6 text-text-muted">
                  {app.cover_letter}
                </p>
              </div>
            )}

            {applicationQuestions.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-text-muted">Jawaban pertanyaan</p>
                <div className="space-y-2">
                  {applicationQuestions.map((question) => (
                    <div key={question.id} className="rounded-xl bg-[#E6ECF5] p-3">
                      <p className="text-xs font-semibold text-text">{question.label}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text-muted">
                        {questionAnswers[question.id] || '-'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {history.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-text-muted">Riwayat status</p>
                <div className="space-y-2">
                  {history.map((item, index) => (
                    <div key={`${item.status}-${index}`} className="flex items-center gap-3 text-sm">
                      <span className={`h-2 w-2 rounded-full ${item.status === 'Rejected' ? 'bg-red-500' : item.status === 'Accepted' ? 'bg-green-500' : 'bg-brand'}`} />
                      <span className="font-medium text-text">{item.status}</span>
                      <span className="text-text-muted">{formatDate(item.date, { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="min-w-0 rounded-2xl border border-brand/10 bg-brand/5 p-3">
            {student.has_cv ? (
              <>
                <div className="overflow-hidden rounded-2xl border border-brand/20 bg-white">
                  {cvLoading && (
                    <div className="flex min-h-[420px] flex-col items-center justify-center p-6 text-center">
                      <div className="mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-brand" />
                      <p className="text-sm font-medium text-text-muted">Memuat CV...</p>
                    </div>
                  )}

                  {!cvLoading && cvError && (
                    <div className="flex min-h-[420px] flex-col items-center justify-center p-6 text-center">
                      <FileDown size={38} className="mb-3 text-[#0A1D3D]/30" />
                      <p className="font-medium text-text-muted">CV tidak bisa ditampilkan</p>
                      <p className="mt-1 max-w-sm text-sm text-[#0A1D3D]/40">{cvError}</p>
                    </div>
                  )}

                  {!cvLoading && !cvError && cvData && (
                    <PdfCanvasViewer data={cvData} label={`CV ${app.applicantName}`} />
                  )}
                </div>

                <div className="mt-3 flex justify-end">
                  <Button variant="outline" onClick={onDownloadCV} disabled={downloadingCV} className="gap-2">
                    <Download size={15} />
                    {downloadingCV ? 'Mengunduh...' : 'Unduh CV'}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#E6ECF5] bg-white/70 p-6 text-center">
                <FileDown size={38} className="mb-3 text-[#0A1D3D]/30" />
                <p className="font-medium text-text-muted">CV belum tersedia</p>
                <p className="mt-1 text-sm text-[#0A1D3D]/40">Pelamar ini belum mengunggah CV.</p>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function InfoBox({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-[#E6ECF5] bg-[#E6ECF5]/60 px-2.5 py-2">
      <div className="flex items-center gap-2 text-xs text-text-light">
        {React.createElement(Icon, { size: 14 })}
        {label}
      </div>
      <p className="mt-0.5 line-clamp-1 text-sm font-medium text-text">{value}</p>
    </div>
  );
}

export function OpportunityManagement() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { company, loading: organizationLoading } = useOrganization();
  const companyId = company?.status === 'approved' ? company.id : null;

  const [opportunity, setOpportunity] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (organizationLoading) return;
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const [jobData, appsData] = await Promise.all([
          opportunitiesApi.get(id),
          applicationsApi.listByOpportunity(id),
        ]);

        if (cancelled) return;

        if (
          companyId &&
          jobData.company_id &&
          Number(jobData.company_id) !== Number(companyId)
        ) {
          addToast({ type: 'error', title: 'Akses ditolak', message: 'Lowongan ini bukan milik perusahaan Anda.' });
          navigate('/hr/opportunities', { replace: true });
          return;
        }

        setOpportunity(jobData);
        setApplicants(normalizeApplications(appsData));
      } catch (err) {
        if (!cancelled) {
          addToast({
            type: 'error',
            title: 'Gagal',
            message: err.message || 'Gagal memuat dashboard lowongan.',
          });
          navigate('/hr/opportunities', { replace: true });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [addToast, companyId, id, navigate, organizationLoading]);

  const stats = useMemo(() => {
    const byStatus = applicants.reduce((acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    }, {});
    const totalApplicants = applicants.length;
    const accepted = byStatus.Accepted || 0;
    const rejected = byStatus.Rejected || 0;
    const active = totalApplicants - accepted - rejected;
    const acceptanceRate = totalApplicants > 0 ? Math.round((accepted / totalApplicants) * 100) : 0;

    return { byStatus, totalApplicants, accepted, rejected, active, acceptanceRate };
  }, [applicants]);

  const filteredApplicants = useMemo(() => {
    const query = search.trim().toLowerCase();
    const next = applicants.filter((app) => {
      const student = app.student || {};
      const matchesSearch =
        !query ||
        app.applicantName.toLowerCase().includes(query) ||
        student.email?.toLowerCase().includes(query) ||
        student.major?.toLowerCase().includes(query) ||
        student.university?.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === 'All' ||
        normalizeStatusValue(app.status) === normalizeStatusValue(statusFilter);
      return matchesSearch && matchesStatus;
    });

    return [...next].sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.applied_at || 0) - new Date(b.applied_at || 0);
      if (sortBy === 'name') return a.applicantName.localeCompare(b.applicantName);
      if (sortBy === 'status') return (a.status || '').localeCompare(b.status || '');
      return new Date(b.applied_at || 0) - new Date(a.applied_at || 0);
    });
  }, [applicants, search, sortBy, statusFilter]);

  const activeSelectedApp = useMemo(() => {
    if (selectedApp && filteredApplicants.some((app) => app.id === selectedApp.id)) {
      return filteredApplicants.find((app) => app.id === selectedApp.id);
    }
    return filteredApplicants[0] || null;
  }, [filteredApplicants, selectedApp]);

  const updateApplicantStatus = (appId, status) => {
    setApplicants((items) => items.map((app) => (app.id === appId ? { ...app, status } : app)));
    setSelectedApp((current) => (current?.id === appId ? { ...current, status } : current));
  };

  const handleStatusChange = async (appId, status) => {
    const previous = applicants;
    updateApplicantStatus(appId, status);
    try {
      await applicationsApi.updateStatus(appId, status);
    } catch {
      setApplicants(previous);
      addToast({ type: 'error', title: 'Gagal', message: 'Gagal mengubah status pelamar.' });
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0 || !bulkStatus) return;

    setUpdating(true);
    const previous = applicants;
    setApplicants((items) => items.map((app) => (selectedIds.has(app.id) ? { ...app, status: bulkStatus } : app)));

    try {
      await applicationsApi.bulkUpdateStatus([...selectedIds], bulkStatus);
      addToast({ type: 'success', title: 'Berhasil', message: `${selectedIds.size} pelamar diperbarui.` });
      setSelectedIds(new Set());
      setBulkStatus('');
    } catch {
      setApplicants(previous);
      addToast({ type: 'error', title: 'Gagal', message: 'Bulk update gagal.' });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-brand" />
      </div>
    );
  }

  if (!opportunity) return null;

  return (
    <MotionDiv
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-none space-y-6 pb-10"
    >
      <MotionDiv variants={itemVariants} className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/hr/opportunities')}
          className="gap-2 text-text-muted"
        >
          <ArrowLeft size={16} />
          Kembali ke daftar lowongan
        </Button>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant={opportunity.is_active !== false ? 'success' : 'error'}>
                {opportunity.is_active !== false ? 'Aktif' : 'Ditutup'}
              </Badge>
              <span className="text-sm text-text-muted">{opportunity.type || '-'}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
              {opportunity.title || 'Lowongan'}
            </h1>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-muted">
              <span className="inline-flex items-center gap-1">
                <MapPin size={14} />
                {opportunity.location || '-'}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={14} />
                Deadline {formatDate(opportunity.deadline)}
              </span>
            </p>
          </div>
          <Button to={`/lowongan/${opportunity.id}`} variant="ghost" className="self-start text-brand lg:self-auto">
            Lihat halaman publik
          </Button>
        </div>
      </MotionDiv>

      <MotionDiv variants={itemVariants} className="flex flex-wrap gap-3">
        <StatCard icon={Users} label="Total pelamar" value={stats.totalApplicants} color="bg-brand" />
        <StatCard icon={Clock} label="Dalam proses" value={stats.active} color="bg-amber-500" />
        <StatCard icon={CheckCircle2} label="Diterima" value={stats.accepted} color="bg-emerald-500" helper={`${stats.acceptanceRate}% acceptance`} />
        <StatCard icon={XCircle} label="Ditolak" value={stats.rejected} color="bg-red-500" />
      </MotionDiv>

      <MotionDiv variants={itemVariants} className="border-b border-[#E6ECF5]">
        <div className="flex gap-2 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative inline-flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${active ? 'text-brand' : 'text-text-muted hover:text-text'
                  }`}
              >
                {React.createElement(Icon, { size: 16 })}
                {tab.label}
                {active && (
                  <MotionSpan
                    layoutId="hrOpportunityTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-brand"
                  />
                )}
              </button>
            );
          })}
        </div>
      </MotionDiv>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <MotionDiv key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <OverviewTab
              opportunity={opportunity}
              applicants={applicants}
              stats={stats}
              onChangeTab={setActiveTab}
            />
          </MotionDiv>
        )}

        {activeTab === 'applicants' && (
          <MotionDiv key="applicants" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <ApplicantsTab
              applicants={applicants}
              filteredApplicants={filteredApplicants}
              search={search}
              setSearch={setSearch}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              sortBy={sortBy}
              setSortBy={setSortBy}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              bulkStatus={bulkStatus}
              setBulkStatus={setBulkStatus}
              onBulkUpdate={handleBulkUpdate}
              onStatusChange={handleStatusChange}
              selectedApp={activeSelectedApp}
              onSelectApplicant={setSelectedApp}
              updating={updating}
            />
          </MotionDiv>
        )}

        {activeTab === 'details' && (
          <MotionDiv key="details" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <DetailsTab
              opportunity={opportunity}
              onOpportunityUpdated={setOpportunity}
            />
          </MotionDiv>
        )}

        {activeTab === 'questions' && (
          <MotionDiv key="questions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <QuestionsTab
              opportunity={opportunity}
              onOpportunityUpdated={setOpportunity}
            />
          </MotionDiv>
        )}
      </AnimatePresence>
    </MotionDiv>
  );
}
