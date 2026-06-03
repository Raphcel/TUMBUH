import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Briefcase,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Paperclip,
  Plus,
  Search,
  SlidersHorizontal,
  Target,
} from 'lucide-react';
import { applicationsApi } from '../../api/applications';
import { companiesApi } from '../../api/companies';
import { logbooksApi } from '../../api/logbooks';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal, ModalFooter } from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../context/LanguageContext';

const MotionDiv = motion.div;
const CUSTOM_COMPANY = '__custom_company__';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { y: 12, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 130, damping: 18 } },
};

const statStyles = {
  hours: 'bg-emerald-50 text-brand',
  progress: 'bg-blue-50 text-blue-600',
  entries: 'bg-amber-50 text-amber-600',
  files: 'bg-green-50 text-green-600',
};

const emptyForm = {
  application_id: '',
  title: '',
  role: '',
  company: '',
  company_source: '',
  semester: '',
  mentor_name: '',
  start_date: '',
  end_date: '',
  target_hours: '',
  notes: '',
};

function numberValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatHours(value, t) {
  return `${numberValue(value).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${t('logbook_hours_short')}`;
}

function formatDate(value, locale) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

function progressPercent(logbook) {
  if (!logbook.target_hours) return 0;
  return Math.min(100, Math.round((numberValue(logbook.total_hours) / logbook.target_hours) * 100));
}

function appOptionLabel(app) {
  const role = app.opportunity?.title || 'Application';
  const company = app.opportunity?.company?.name;
  return company ? `${role} - ${company}` : role;
}

function semesterOptions(t) {
  const currentYear = new Date().getFullYear();
  const options = [{ value: '', label: t('logbook_semester_select') }];
  for (let year = currentYear - 3; year <= currentYear + 2; year += 1) {
    const academicYear = `${year}/${year + 1}`;
    options.push(
      { value: `${academicYear} Semester Ganjil`, label: `${academicYear} Semester Ganjil` },
      { value: `${academicYear} Semester Genap`, label: `${academicYear} Semester Genap` }
    );
  }
  return options;
}

function payloadFromForm(form) {
  return {
    application_id: form.application_id ? Number(form.application_id) : null,
    title: form.title.trim() || null,
    role: form.role.trim() || null,
    company: form.company.trim() || null,
    semester: form.semester || null,
    mentor_name: form.mentor_name.trim() || null,
    start_date: form.start_date || null,
    end_date: form.end_date || null,
    target_hours: form.target_hours ? Number(form.target_hours) : null,
    notes: form.notes.trim() || null,
  };
}

function getLatestEntry(logbook) {
  return (logbook.entries || [])
    .slice()
    .sort((a, b) => `${b.activity_date}-${b.created_at || ''}`.localeCompare(`${a.activity_date}-${a.created_at || ''}`))[0];
}

function startOfWeek(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function weekDays(locale) {
  const start = startOfWeek(new Date());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString(locale, { weekday: 'short' }),
    };
  });
}

function flattenEntries(logbooks) {
  return logbooks.flatMap((logbook) =>
    (logbook.entries || []).map((entry) => ({
      ...entry,
      logbookTitle: logbook.title,
      company: logbook.company,
      logbookId: logbook.id,
    }))
  );
}

function StatCard({ icon: Icon, tone, label, value, helper }) {
  return (
    <MotionDiv variants={itemVariants} className="rounded-lg border border-surface-border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-text-muted">{label}</p>
          <p className="mt-2 text-2xl font-semibold leading-none text-text">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${statStyles[tone] || statStyles.hours}`}>
          <Icon size={20} />
        </div>
      </div>
      {helper && <p className="mt-3 text-xs leading-5 text-text-light">{helper}</p>}
    </MotionDiv>
  );
}

function ProgressLine({ percent }) {
  return (
    <div className="min-w-[116px]">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-semibold text-brand">{percent}%</span>
        <span className="text-text-light">100%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function LogbookRow({ logbook, locale, t }) {
  const percent = progressPercent(logbook);
  const latestEntry = getLatestEntry(logbook);

  return (
    <MotionDiv variants={itemVariants}>
      <Link
        to={`/student/logbook/${logbook.id}`}
        className="group grid gap-4 border-b border-surface-border bg-white p-4 transition hover:bg-surface-muted/50 lg:grid-cols-[minmax(0,1.35fr)_minmax(150px,.75fr)_minmax(150px,.75fr)_minmax(128px,.6fr)_auto]"
      >
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface-muted text-brand">
              <Building size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-text group-hover:text-brand">{logbook.title}</h2>
              <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-text-muted">
                <Building size={13} className="shrink-0" />
                <span className="truncate">{logbook.company}</span>
              </p>
              <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-text-muted">
                <Briefcase size={13} className="shrink-0" />
                <span className="truncate">{logbook.role}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-text-muted lg:block">
          <Calendar size={14} className="shrink-0 lg:hidden" />
          <p className="font-medium text-text">{logbook.semester || t('logbook_no_semester')}</p>
          {(logbook.start_date || logbook.end_date) && (
            <p className="mt-1 text-text-light">
              {formatDate(logbook.start_date, locale) || '-'} - {formatDate(logbook.end_date, locale) || '-'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-text-muted lg:block">
          <Clock size={14} className="shrink-0 lg:hidden" />
          <p className="font-medium text-text">
            {formatHours(logbook.total_hours, t)}
            {logbook.target_hours ? ` / ${formatHours(logbook.target_hours, t)}` : ''}
          </p>
          <p className="mt-1 text-text-light">{logbook.entries?.length || 0} {t('logbook_entries').toLowerCase()}</p>
        </div>

        <div className="flex items-center gap-3">
          <ProgressLine percent={percent} />
          <span className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2 py-1 text-xs text-text-muted lg:hidden">
            <Paperclip size={12} />
            {logbook.attachment_count || 0}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <div className="min-w-0 text-xs text-text-muted lg:hidden">
            {latestEntry ? `${t('logbook_latest')}: ${latestEntry.title}` : t('logbook_no_entries_short')}
          </div>
          <div className="hidden items-center gap-1 text-xs text-text-muted lg:flex">
            <Paperclip size={14} />
            <span>{logbook.attachment_count || 0}</span>
          </div>
          <ArrowUpRight size={17} className="shrink-0 text-text-light transition group-hover:text-brand" />
        </div>

        <div className="hidden min-w-0 rounded-md bg-surface-muted px-3 py-2 text-xs text-text-muted lg:col-span-5 lg:block">
          {latestEntry
            ? `${t('logbook_latest')}: ${formatDate(latestEntry.activity_date, locale)} - ${latestEntry.title}`
            : t('logbook_no_entries_short')}
        </div>
      </Link>
    </MotionDiv>
  );
}

function WeeklyHoursPanel({ entries, locale, t }) {
  const days = useMemo(() => weekDays(locale), [locale]);
  const totals = useMemo(() => {
    const byDay = new Map(days.map((day) => [day.key, 0]));
    entries.forEach((entry) => {
      if (byDay.has(entry.activity_date)) {
        byDay.set(entry.activity_date, byDay.get(entry.activity_date) + numberValue(entry.hours));
      }
    });
    return days.map((day) => ({ ...day, hours: byDay.get(day.key) || 0 }));
  }, [days, entries]);

  const maxHours = Math.max(1, ...totals.map((day) => day.hours));
  const weekTotal = totals.reduce((sum, day) => sum + day.hours, 0);

  return (
    <MotionDiv variants={itemVariants} className="rounded-lg border border-surface-border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text">{t('logbook_weekly_hours')}</h2>
          <p className="mt-1 text-xs text-text-muted">{t('logbook_this_week')}</p>
        </div>
        <p className="text-lg font-semibold text-text">{formatHours(weekTotal, t)}</p>
      </div>
      <div className="mt-5 flex h-36 items-end gap-3">
        {totals.map((day) => (
          <div key={day.key} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-24 w-full items-end rounded-md bg-surface-muted">
              <div
                className="w-full rounded-md bg-brand/70 transition-all"
                style={{ height: `${Math.max(8, (day.hours / maxHours) * 100)}%` }}
                title={formatHours(day.hours, t)}
              />
            </div>
            <span className="text-[11px] font-medium text-text-muted">{day.label}</span>
          </div>
        ))}
      </div>
    </MotionDiv>
  );
}

function RecentActivityPanel({ entries, locale, t }) {
  const recent = useMemo(
    () => entries
      .slice()
      .sort((a, b) => `${b.activity_date}-${b.created_at || ''}`.localeCompare(`${a.activity_date}-${a.created_at || ''}`))
      .slice(0, 5),
    [entries]
  );

  return (
    <MotionDiv variants={itemVariants} className="rounded-lg border border-surface-border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-text">{t('logbook_recent_activity')}</h2>
        <FileText size={17} className="text-brand" />
      </div>
      {recent.length > 0 ? (
        <div className="mt-4 space-y-4">
          {recent.map((entry) => (
            <Link key={entry.id} to={`/student/logbook/${entry.logbookId}`} className="group flex gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-muted text-brand">
                <CheckCircle2 size={16} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text group-hover:text-brand">{entry.title}</p>
                <p className="mt-0.5 truncate text-xs text-text-muted">{entry.company} - {formatHours(entry.hours, t)}</p>
                <p className="mt-0.5 text-xs text-text-light">{formatDate(entry.activity_date, locale)}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-surface-border bg-surface-muted p-5 text-sm text-text-muted">
          {t('logbook_no_recent_activity')}
        </div>
      )}
    </MotionDiv>
  );
}

export function Logbook() {
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const { addToast } = useToast();
  const locale = lang === 'id' ? 'id-ID' : 'en-US';
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [logbooks, setLogbooks] = useState([]);
  const [applications, setApplications] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const searchInputRef = useRef(null);

  const acceptedApplications = useMemo(
    () => applications.filter((app) => app.status === 'Accepted'),
    [applications]
  );

  const appOptions = useMemo(() => [
    { value: '', label: t('logbook_no_application') },
    ...acceptedApplications.map((app) => ({ value: String(app.id), label: appOptionLabel(app) })),
  ], [acceptedApplications, t]);

  const companyOptions = useMemo(() => {
    const seen = new Set();
    const companyItems = companies
      .map((company) => company?.name)
      .filter(Boolean)
      .filter((name) => {
        const key = name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name, label: name }));

    return [
      { value: '', label: t('logbook_select_company') },
      ...companyItems,
      { value: CUSTOM_COMPANY, label: t('logbook_company_custom') },
    ];
  }, [companies, t]);

  const semesterSelectOptions = useMemo(() => semesterOptions(t), [t]);
  const allEntries = useMemo(() => flattenEntries(logbooks), [logbooks]);

  const summary = useMemo(() => {
    const hours = logbooks.reduce((sum, logbook) => sum + numberValue(logbook.total_hours), 0);
    const target = logbooks.reduce((sum, logbook) => sum + numberValue(logbook.target_hours), 0);
    return {
      total: logbooks.length,
      entries: logbooks.reduce((sum, logbook) => sum + (logbook.entries?.length || 0), 0),
      hours,
      target,
      files: logbooks.reduce((sum, logbook) => sum + (logbook.attachment_count || 0), 0),
      progress: target > 0 ? Math.min(100, Math.round((hours / target) * 100)) : 0,
    };
  }, [logbooks]);

  const filteredLogbooks = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = term
      ? logbooks.filter((logbook) => [
        logbook.title,
        logbook.company,
        logbook.role,
        logbook.semester,
      ].filter(Boolean).some((value) => value.toLowerCase().includes(term)))
      : logbooks;

    return filtered.slice().sort((a, b) => {
      if (sortBy === 'progress') return progressPercent(b) - progressPercent(a);
      if (sortBy === 'hours') return numberValue(b.total_hours) - numberValue(a.total_hours);
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });
  }, [logbooks, query, sortBy]);

  const sortOptions = useMemo(() => [
    { value: 'latest', label: t('logbook_sort_latest') },
    { value: 'progress', label: t('logbook_sort_progress') },
    { value: 'hours', label: t('logbook_sort_hours') },
  ], [t]);

  const loadData = useCallback(async () => {
    try {
      const [logbooksData, applicationsData, companiesData] = await Promise.all([
        logbooksApi.list(),
        applicationsApi.mine().catch(() => ({ items: [] })),
        companiesApi.list().catch(() => ({ items: [] })),
      ]);
      setLogbooks(logbooksData.items || []);
      setApplications(applicationsData.items || []);
      setCompanies(companiesData.items || companiesData || []);
    } catch (err) {
      addToast({ type: 'error', title: t('logbook_load_failed'), message: err.message });
    } finally {
      setLoading(false);
    }
  }, [addToast, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleApplicationChange(event) {
    const applicationId = event.target.value;
    const app = acceptedApplications.find((item) => String(item.id) === applicationId);
    const companyName = app?.opportunity?.company?.name || '';
    setForm((current) => ({
      ...current,
      application_id: applicationId,
      title: app?.opportunity?.title || current.title,
      role: app?.opportunity?.title || current.role,
      company: companyName || current.company,
      company_source: companyName || current.company_source,
    }));
  }

  function handleCompanyChange(event) {
    const value = event.target.value;
    setForm((current) => ({
      ...current,
      company_source: value,
      company: value === CUSTOM_COMPANY ? '' : value,
    }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    const payload = payloadFromForm(form);
    if (!payload.title || !payload.role || !payload.company) {
      addToast({ type: 'error', title: t('logbook_form_invalid'), message: t('logbook_required_manual') });
      return;
    }

    setSubmitting(true);
    try {
      const created = await logbooksApi.create(payload);
      addToast({ type: 'success', title: t('logbook_created'), message: created.title });
      setShowCreate(false);
      setForm(emptyForm);
      await loadData();
      navigate(`/student/logbook/${created.id}`);
    } catch (err) {
      addToast({ type: 'error', title: t('logbook_create_failed'), message: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-brand" />
      </div>
    );
  }

  return (
    <MotionDiv variants={containerVariants} initial="hidden" animate="visible" className="space-y-5 pb-10">
      <MotionDiv variants={itemVariants} className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold leading-tight text-text">{t('logbook_title')}</h1>
          <p className="mt-2 text-sm leading-6 text-text-muted">{t('logbook_subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => searchInputRef.current?.focus()}>
            <SlidersHorizontal size={16} />
            {t('logbook_filter')}
          </Button>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus size={16} />
            {t('logbook_new')}
          </Button>
        </div>
      </MotionDiv>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Clock}
          tone="hours"
          label={t('logbook_total_hours')}
          value={formatHours(summary.hours, t)}
          helper={summary.target ? `${t('logbook_vs_target')} ${formatHours(summary.target, t)}` : t('logbook_no_target')}
        />
        <StatCard
          icon={BarChart3}
          tone="progress"
          label={t('logbook_progress')}
          value={`${summary.progress}%`}
          helper={`${summary.total} ${t('logbook_total_logbooks').toLowerCase()}`}
        />
        <StatCard icon={FileText} tone="entries" label={t('logbook_total_entries')} value={summary.entries} helper={t('logbook_activity_log')} />
        <StatCard icon={Paperclip} tone="files" label={t('logbook_total_files')} value={summary.files} helper={t('logbook_media')} />
      </div>

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <MotionDiv variants={itemVariants} className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm">
          <div className="border-b border-surface-border p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative min-w-0 flex-1">
                <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-light" />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('logbook_search_ph')}
                  className="h-10 w-full rounded-lg border border-surface-border bg-white pl-10 pr-3 text-sm text-text outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
                />
              </div>
              <div className="w-full lg:w-52">
                <Select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  options={sortOptions}
                  placeholder={t('logbook_sort_latest')}
                />
              </div>
            </div>
          </div>

          {filteredLogbooks.length > 0 ? (
            <div>
              {filteredLogbooks.map((logbook) => (
                <LogbookRow key={logbook.id} logbook={logbook} locale={locale} t={t} />
              ))}
            </div>
          ) : (
            <div className="p-8">
              <div className="rounded-lg border border-dashed border-surface-border bg-surface-muted px-6 py-10 text-center">
                <BookOpen size={42} className="mx-auto mb-4 text-brand/50" />
                <h2 className="text-base font-semibold text-text">{query ? t('logbook_no_results') : t('logbook_empty_title')}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-muted">
                  {query ? t('logbook_no_results_subtitle') : t('logbook_empty_subtitle')}
                </p>
                {!query && (
                  <Button onClick={() => setShowCreate(true)} className="mt-5 gap-2">
                    <Plus size={16} />
                    {t('logbook_new')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </MotionDiv>

        <div className="space-y-5">
          <WeeklyHoursPanel entries={allEntries} locale={locale} t={t} />
          <RecentActivityPanel entries={allEntries} locale={locale} t={t} />
          <MotionDiv variants={itemVariants} className="rounded-lg border border-surface-border bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-brand">
                <Target size={19} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-text">{t('logbook_quick_start_title')}</h2>
                <p className="mt-1 text-sm leading-6 text-text-muted">{t('logbook_quick_start_subtitle')}</p>
                <Button onClick={() => setShowCreate(true)} variant="secondary" size="sm" className="mt-4 gap-2">
                  <Plus size={15} />
                  {t('logbook_new')}
                </Button>
              </div>
            </div>
          </MotionDiv>
        </div>
      </div>

      <Modal
        isOpen={showCreate}
        onClose={() => !submitting && setShowCreate(false)}
        title={t('logbook_create_title')}
        size="lg"
        footer={(
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)} disabled={submitting}>
              {t('logbook_cancel')}
            </Button>
            <Button type="submit" form="logbook-create-form" disabled={submitting}>
              {submitting ? t('logbook_saving') : t('logbook_save')}
            </Button>
          </ModalFooter>
        )}
      >
        <form id="logbook-create-form" onSubmit={handleCreate} className="space-y-4">
          <Select
            label={t('logbook_application')}
            value={form.application_id}
            onChange={handleApplicationChange}
            options={appOptions}
            placeholder={t('logbook_no_application')}
          />
          <Input label={t('logbook_field_title')} value={form.title} onChange={(e) => updateForm('title', e.target.value)} required />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label={t('logbook_field_role')} value={form.role} onChange={(e) => updateForm('role', e.target.value)} required />
            <Select
              label={t('logbook_field_company')}
              value={form.company_source}
              onChange={handleCompanyChange}
              options={companyOptions}
              placeholder={t('logbook_select_company')}
            />
          </div>
          {form.company_source === CUSTOM_COMPANY && (
            <Input label={t('logbook_company_custom_label')} value={form.company} onChange={(e) => updateForm('company', e.target.value)} required />
          )}
          <Select
            label={t('logbook_field_semester')}
            value={form.semester}
            onChange={(e) => updateForm('semester', e.target.value)}
            options={semesterSelectOptions}
            placeholder={t('logbook_semester_select')}
          />
          <Input label={t('logbook_field_mentor')} value={form.mentor_name} onChange={(e) => updateForm('mentor_name', e.target.value)} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input type="date" label={t('logbook_field_start')} value={form.start_date} onChange={(e) => updateForm('start_date', e.target.value)} />
            <Input type="date" label={t('logbook_field_end')} value={form.end_date} onChange={(e) => updateForm('end_date', e.target.value)} />
            <Input type="number" min="0.5" step="0.5" label={t('logbook_field_target')} value={form.target_hours} onChange={(e) => updateForm('target_hours', e.target.value)} />
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">{t('logbook_field_notes')}</span>
            <textarea
              rows={4}
              value={form.notes}
              onChange={(e) => updateForm('notes', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/20"
            />
          </label>
        </form>
      </Modal>
    </MotionDiv>
  );
}
