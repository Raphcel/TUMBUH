import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { applicationsApi } from '../../api/applications';
import { useTranslation } from '../../context/LanguageContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CompanyLogo } from '../../components/ui/CompanyLogo';
import { useCloseOnScroll } from '../../hooks/useCloseOnScroll';
import {
  Search,
  Briefcase,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Filter,
  PenLine,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const STEPS = ['Applied', 'Interview', 'Accepted'];
const STATUS_NORMALIZATION = {
  Screening: 'Applied',
};
const VISIBLE_STATUSES = ['All', 'Draft', 'Applied', 'Interview', 'Accepted', 'Rejected'];
const SORT_OPTIONS = ['newest', 'oldest', 'company', 'title', 'status'];
const ITEMS_PER_PAGE = 5;

const STEP_KEY = {
  Applied:   'step_applied',
  Interview: 'step_interview',
  Accepted:  'step_accepted',
  Rejected:  'step_rejected',
};

const STATUS_CONFIG = {
  Draft:     { variant: 'warning', labelKey: 'status_draft'     },
  Applied:   { variant: 'info',    labelKey: 'status_applied'   },
  Interview: { variant: 'info',    labelKey: 'status_interview' },
  Accepted:  { variant: 'success', labelKey: 'status_accepted'  },
  Rejected:  { variant: 'error',   labelKey: 'status_rejected'  },
};

const containerVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden:  { y: 16, opacity: 0 },
  visible: { y: 0,  opacity: 1, transition: { type: 'spring', stiffness: 120, damping: 14 } },
};
const MotionDiv = motion.div;

function getDisplayStatus(status) {
  return STATUS_NORMALIZATION[status] ?? status;
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <MotionDiv
      variants={itemVariants}
      className="flex items-center gap-4 bg-white rounded-2xl border border-[#E6ECF5] shadow-sm px-5 py-4 flex-1 min-w-[140px]"
    >
      <div className={`p-2.5 rounded-xl ${color}`}>
        {React.createElement(Icon, { size: 20, className: 'text-white' })}
      </div>
      <div>
        <p className="text-2xl font-bold text-text">{value}</p>
        <p className="text-xs text-text-muted mt-0.5">{label}</p>
      </div>
    </MotionDiv>
  );
}

function ApplicationStepper({ app, t, copy }) {
  if (app.kind === 'draft') {
    return (
      <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        <PenLine size={13} />
        {copy.draftNotSubmitted}
      </div>
    );
  }

  const displayStatus = getDisplayStatus(app.status);
  const isRejected = displayStatus === 'Rejected';
  const currentStepIndex = Math.max(0, STEPS.indexOf(displayStatus));
  const stepsToShow = isRejected ? ['Applied', 'Rejected'] : STEPS.slice(0, currentStepIndex + 1);

  const getStepState = (step) => {
    if (isRejected && step === 'Rejected') return 'rejected';
    if (step === displayStatus) return 'current';
    return 'done';
  };

  return (
    <div className="flex items-center gap-0 mt-3">
      {stepsToShow.map((step, idx) => {
        const state = getStepState(step);

        return (
          <React.Fragment key={step}>
            {idx > 0 && (
              <div
                className={`flex-1 h-0.5 min-w-[12px] transition-colors duration-300 ${
                  state === 'rejected' ? 'bg-red-300'
                  : 'bg-brand'
                }`}
              />
            )}
            <div className="flex flex-col items-center shrink-0">
              <div
                className={`w-2.5 h-2.5 rounded-full border-2 transition-all duration-300 ${
                  state === 'rejected'
                    ? 'bg-red-500 border-red-500'
                    : state === 'current'
                    ? 'bg-brand border-brand ring-2 ring-brand/20'
                    : 'bg-brand border-brand'
                }`}
              />
              <span
                className={`text-[9px] mt-1 font-medium whitespace-nowrap transition-colors ${
                  state === 'rejected' ? 'text-red-500'
                  : 'text-brand'
                }`}
              >
                {t(STEP_KEY[step])}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ApplicationCard({ app, t, locale, highlighted, copy }) {
  const job = app.opportunity;
  const company = job?.company;
  const isDraft = app.kind === 'draft';
  const displayStatus = isDraft ? 'Draft' : getDisplayStatus(app.status);
  const cfg = STATUS_CONFIG[displayStatus] ?? { variant: 'info', labelKey: `status_${displayStatus?.toLowerCase()}` };
  const dateValue = isDraft ? app.updated_at : app.applied_at;
  const dateStr = new Date(dateValue).toLocaleDateString(locale, {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const href = isDraft ? `/student/applications/apply/${app.opportunity_id}` : `/lowongan/${job?.id}`;

  return (
    <MotionDiv variants={itemVariants} layout>
      <div className={`group rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md ${
        highlighted ? 'border-brand ring-4 ring-brand/10' : isDraft ? 'border-amber-200 hover:border-amber-300' : 'border-[#E6ECF5] hover:border-brand/20'
      }`}>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex gap-3 flex-1 min-w-0">
            <CompanyLogo
              company={company}
              className="h-11 w-11 rounded-xl border border-brand/10 bg-gradient-to-br from-brand/10 to-brand/5 p-2"
              fallbackClassName="text-sm font-bold text-brand uppercase"
            />
            <div className="min-w-0 flex-1">
              <Link
                to={href}
                className="font-semibold text-text text-base leading-tight hover:text-brand transition-colors line-clamp-1"
              >
                {job?.title ?? copy.unknownRole}
              </Link>
              <p className="text-sm text-text-muted mt-0.5 flex items-center gap-1">
                <Briefcase size={12} />
                {company?.name ?? '—'}
              </p>
              <ApplicationStepper app={app} t={t} copy={copy} />
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
            <Badge variant={cfg.variant}>
              {displayStatus === 'Draft' ? copy.draftStatus : t(cfg.labelKey)}
            </Badge>
            <span className="text-xs text-text-muted whitespace-nowrap">
              {isDraft ? copy.draftUpdated : t('lamaran_applied_on')} {dateStr}
            </span>
            {isDraft && (
              <Link
                to={href}
                className="hidden text-xs font-semibold text-brand transition-colors hover:text-brand-dark sm:block"
              >
                {copy.continueDraft}
              </Link>
            )}
          </div>
        </div>
      </div>
    </MotionDiv>
  );
}

export function LamaranSaya() {
  const { t, lang } = useTranslation();
  const location = useLocation();
  const locale = lang === 'id' ? 'id-ID' : 'en-US';
  const copy = lang === 'id'
    ? {
        sortButton: 'Urutkan',
        sortNewest: 'Tanggal terbaru',
        sortOldest: 'Tanggal terlama',
        sortCompany: 'Nama perusahaan',
        sortTitle: 'Nama posisi',
        sortStatus: 'Status',
        submittedTitle: 'Lamaran terkirim',
        submittedMessage: 'Lamaran baru Anda sudah masuk ke tracker.',
        draftUpdated: 'Terakhir diedit',
        continueDraft: 'Lanjutkan',
        unknownRole: 'Lowongan',
        statusDraft: 'Draft',
        draftStatus: 'Draft',
        draftNotSubmitted: 'Belum dikirim',
        page: 'Halaman',
        of: 'dari',
        previous: 'Sebelumnya',
        next: 'Berikutnya',
      }
    : {
        sortButton: 'Sort',
        sortNewest: 'Newest date',
        sortOldest: 'Oldest date',
        sortCompany: 'Company name',
        sortTitle: 'Role name',
        sortStatus: 'Status',
        submittedTitle: 'Application submitted',
        submittedMessage: 'Your new application is now in the tracker.',
        draftUpdated: 'Last edited',
        continueDraft: 'Continue',
        unknownRole: 'Opportunity',
        statusDraft: 'Draft',
        draftStatus: 'Draft',
        draftNotSubmitted: 'Not submitted',
        page: 'Page',
        of: 'of',
        previous: 'Previous',
        next: 'Next',
      };

  const [myApplications, setMyApplications] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  useCloseOnScroll(showSortMenu, () => setShowSortMenu(false));
  const submittedId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return Number(params.get('submitted') || location.state?.submittedApplicationId || 0);
  }, [location.search, location.state]);
  const submittedApp = useMemo(
    () => myApplications.find((app) => Number(app.id) === submittedId) || null,
    [myApplications, submittedId]
  );

  useEffect(() => {
    Promise.all([
      applicationsApi.mine(),
      applicationsApi.listDrafts().catch(() => []),
    ])
      .then(([applicationsData, draftsData]) => {
        setMyApplications(applicationsData.items || []);
        setDrafts(draftsData || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => ({
    total:      myApplications.length + drafts.length,
    accepted:   myApplications.filter((app) => getDisplayStatus(app.status) === 'Accepted').length,
    inProgress: myApplications.filter((app) => !['Accepted', 'Rejected'].includes(getDisplayStatus(app.status))).length,
    rejected:   myApplications.filter((app) => getDisplayStatus(app.status) === 'Rejected').length,
  }), [drafts.length, myApplications]);

  const sortLabels = {
    newest: copy.sortNewest,
    oldest: copy.sortOldest,
    company: copy.sortCompany,
    title: copy.sortTitle,
    status: copy.sortStatus,
  };

  const combinedItems = useMemo(() => [
    ...drafts.map((draft) => ({
      ...draft,
      kind: 'draft',
      status: 'Draft',
      sortDate: draft.updated_at,
    })),
    ...myApplications.map((app) => ({
      ...app,
      kind: 'application',
      sortDate: app.applied_at,
    })),
  ], [drafts, myApplications]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const next = combinedItems.filter((app) => {
      const displayStatus = app.kind === 'draft' ? 'Draft' : getDisplayStatus(app.status);
      const matchSearch =
        !q ||
        app.opportunity?.title?.toLowerCase().includes(q) ||
        app.opportunity?.company?.name?.toLowerCase().includes(q);
      const matchStatus = filterStatus === 'All' || displayStatus === filterStatus;
      return matchSearch && matchStatus;
    });

    return [...next].sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.sortDate) - new Date(b.sortDate);
      }
      if (sortBy === 'company') {
        return (a.opportunity?.company?.name || '').localeCompare(b.opportunity?.company?.name || '');
      }
      if (sortBy === 'title') {
        return (a.opportunity?.title || '').localeCompare(b.opportunity?.title || '');
      }
      if (sortBy === 'status') {
        const aStatus = a.kind === 'draft' ? 'Draft' : getDisplayStatus(a.status);
        const bStatus = b.kind === 'draft' ? 'Draft' : getDisplayStatus(b.status);
        return aStatus.localeCompare(bStatus);
      }
      return new Date(b.sortDate) - new Date(a.sortDate);
    });
  }, [combinedItems, filterStatus, search, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, pageCount);
  const pageStart = (safePage - 1) * ITEMS_PER_PAGE;
  const pageEnd = Math.min(pageStart + ITEMS_PER_PAGE, filtered.length);
  const paginatedItems = useMemo(
    () => filtered.slice(pageStart, pageEnd),
    [filtered, pageEnd, pageStart]
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand" />
      </div>
    );
  }

  return (
    <MotionDiv
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-none space-y-6 pb-10"
    >
      <MotionDiv variants={itemVariants} className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight flex items-center gap-2">
            <FileText size={22} className="text-brand" />
            {t('lamaran_title')}
          </h1>
          <p className="text-sm text-text-muted mt-1">{t('lamaran_subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" disabled title={t('lamaran_coming_soon')}>
          {t('lamaran_track_btn')}
        </Button>
      </MotionDiv>

      {submittedApp && (
        <MotionDiv
          variants={itemVariants}
          className="flex flex-col gap-3 rounded-2xl border border-brand/15 bg-brand/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-semibold text-text">{copy.submittedTitle}</p>
            <p className="text-sm text-text-muted">
              {copy.submittedMessage} {submittedApp.opportunity?.title || ''}
            </p>
          </div>
          <Badge variant="success">{t('status_applied')}</Badge>
        </MotionDiv>
      )}

      <MotionDiv variants={itemVariants} className="flex flex-wrap gap-3">
        <StatCard icon={FileText} label={t('lamaran_total')} value={stats.total} color="bg-brand" />
        <StatCard icon={CheckCircle2} label={t('lamaran_accepted')} value={stats.accepted} color="bg-emerald-500" />
        <StatCard icon={Clock} label={t('lamaran_in_progress')} value={stats.inProgress} color="bg-amber-500" />
        <StatCard icon={XCircle} label={t('lamaran_rejected')} value={stats.rejected} color="bg-red-500" />
      </MotionDiv>

      <MotionDiv variants={itemVariants} className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light pointer-events-none" />
            <input
              type="text"
              placeholder={t('lamaran_search_ph')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl border border-[#E6ECF5] bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40 transition"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-light hover:text-text transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="relative">
            <Button
              variant="outline"
              className="w-full sm:w-auto flex items-center justify-center gap-2"
              onClick={() => setShowSortMenu((prev) => !prev)}
            >
              <Filter size={16} />
              {copy.sortButton}
              <ChevronDown size={14} className={`transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
            </Button>
            {showSortMenu && (
              <div className="absolute right-0 mt-2 min-w-[220px] rounded-xl border border-[#E6ECF5] bg-white shadow-lg z-20 overflow-hidden">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setSortBy(option);
                      setCurrentPage(1);
                      setShowSortMenu(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                      sortBy === option
                        ? 'bg-brand/5 text-brand font-semibold'
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

        <div className="flex gap-2 flex-wrap">
          {VISIBLE_STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => {
                setFilterStatus(status);
                setCurrentPage(1);
              }}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                filterStatus === status
                  ? 'bg-brand text-white border-brand shadow-sm'
                  : 'bg-white text-text-muted border-[#E6ECF5] hover:border-brand/30 hover:text-brand'
              }`}
            >
              {status === 'All'
                ? t('lamaran_filter_all')
                : status === 'Draft'
                  ? copy.statusDraft
                  : t(`status_${status.toLowerCase()}`)}
            </button>
          ))}
        </div>
      </MotionDiv>

      <AnimatePresence>
        {filtered.length > 0 ? (
          <MotionDiv key="list" variants={containerVariants} initial="hidden" animate="visible" className="space-y-3">
            {paginatedItems.map((app) => (
                <ApplicationCard
                  key={`${app.kind}-${app.id}`}
                  app={app}
                  t={t}
                  locale={locale}
                  highlighted={Number(app.id) === submittedId}
                  copy={copy}
                />
              ))}

            {filtered.length > ITEMS_PER_PAGE && (
              <div className="flex flex-col gap-3 rounded-2xl border border-[#E6ECF5] bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-text-muted">
                  {pageStart + 1}-{pageEnd} / {filtered.length} · {copy.page} {safePage} {copy.of} {pageCount}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={safePage === 1}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#E6ECF5] bg-white px-3 text-sm font-semibold text-text-muted transition hover:border-brand/30 hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <ChevronLeft size={15} />
                    {copy.previous}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                    disabled={safePage === pageCount}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#E6ECF5] bg-white px-3 text-sm font-semibold text-text-muted transition hover:border-brand/30 hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {copy.next}
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </MotionDiv>
        ) : combinedItems.length === 0 ? (
          <MotionDiv
            key="empty"
            variants={itemVariants}
            className="text-center py-24 border-2 border-dashed border-[#E6ECF5] rounded-2xl bg-[#E6ECF5]/50"
          >
            <FileText size={40} className="mx-auto text-[#0A1D3D]/30 mb-4" />
            <p className="font-semibold text-text-muted">{t('lamaran_empty_title')}</p>
            <p className="text-sm text-[#0A1D3D]/40 mt-1 max-w-xs mx-auto">{t('lamaran_empty_sub')}</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button to="/lowongan" variant="primary" className="text-white">
                {t('lamaran_find_opp')}
              </Button>
              <Button variant="outline" disabled>
                {t('lamaran_track_manual')}
              </Button>
            </div>
          </MotionDiv>
        ) : (
          <MotionDiv
            key="no-results"
            variants={itemVariants}
            className="text-center py-16 rounded-2xl bg-[#E6ECF5]/50 border border-dashed border-[#E6ECF5]"
          >
            <Filter size={32} className="mx-auto text-[#0A1D3D]/30 mb-3" />
            <p className="text-text-muted font-medium">{t('lamaran_no_results')}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 text-brand"
              onClick={() => {
                setSearch('');
                setFilterStatus('All');
                setSortBy('newest');
                setCurrentPage(1);
                setShowSortMenu(false);
              }}
            >
              {t('lamaran_clear')}
            </Button>
          </MotionDiv>
        )}
      </AnimatePresence>
    </MotionDiv>
  );
}
