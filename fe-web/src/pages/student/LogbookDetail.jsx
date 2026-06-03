import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  Building,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Edit3,
  FileText,
  MapPin,
  Paperclip,
  Plus,
  Target,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { logbooksApi } from '../../api/logbooks';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal, ModalFooter } from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../context/LanguageContext';

const MotionDiv = motion.div;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const CATEGORIES = [
  { value: 'Development', dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  { value: 'Meeting', dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
  { value: 'Training', dot: 'bg-violet-500', bg: 'bg-violet-50', text: 'text-violet-700' },
  { value: 'Research', dot: 'bg-cyan-500', bg: 'bg-cyan-50', text: 'text-cyan-700' },
  { value: 'Documentation', dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
  { value: 'Presentation', dot: 'bg-rose-500', bg: 'bg-rose-50', text: 'text-rose-700' },
  { value: 'Administration', dot: 'bg-slate-500', bg: 'bg-slate-50', text: 'text-slate-700' },
  { value: 'Other', dot: 'bg-gray-500', bg: 'bg-gray-50', text: 'text-gray-700' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { y: 12, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 130, damping: 18 } },
};

const statStyles = {
  time: 'bg-emerald-50 text-brand',
  entries: 'bg-blue-50 text-blue-600',
  files: 'bg-amber-50 text-amber-600',
  progress: 'bg-green-50 text-green-600',
};

const emptyEntryForm = {
  activity_date: new Date().toISOString().slice(0, 10),
  title: '',
  category: 'Development',
  duration_minutes: '',
  start_time: '',
  end_time: '',
  location: '',
  description: '',
  file: null,
};

function numberValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function minutesFromHours(value) {
  return Math.round(numberValue(value) * 60);
}

function hoursFromMinutes(value) {
  return Number((numberValue(value) / 60).toFixed(4));
}

function formatHours(value, t) {
  return `${numberValue(value).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${t('logbook_hours_short')}`;
}

function formatMinutesFromHours(value, t) {
  return `${minutesFromHours(value).toLocaleString()} ${t('logbook_minutes_short')}`;
}

function formatDate(value, locale) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateRange(startDate, endDate, locale) {
  const start = formatDate(startDate, locale);
  const end = formatDate(endDate, locale);
  if (start && end) return `${start} - ${end}`;
  return start || end;
}

function formatTimeValue(value) {
  if (!value) return '';
  return String(value).slice(0, 5);
}

function formatTimeRange(startTime, endTime) {
  const start = formatTimeValue(startTime);
  const end = formatTimeValue(endTime);
  if (start && end) return `${start} - ${end}`;
  return start || end || '-';
}

function formatFileSize(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function progressPercent(logbook) {
  if (!logbook?.target_hours) return 0;
  return Math.min(100, Math.round((numberValue(logbook.total_hours) / logbook.target_hours) * 100));
}

function getCategoryConfig(category) {
  return CATEGORIES.find((item) => item.value === category) || CATEGORIES[CATEGORIES.length - 1];
}

function validateFile(file, t) {
  if (!file) return null;
  if (file.size > MAX_FILE_SIZE) return t('logbook_file_too_large');
  if (!ALLOWED_TYPES.includes(file.type)) return t('logbook_file_type_invalid');
  return null;
}

function logbookPayload(form) {
  return {
    title: form.title.trim(),
    role: form.role.trim(),
    company: form.company.trim(),
    semester: form.semester || null,
    mentor_name: form.mentor_name.trim() || null,
    start_date: form.start_date || null,
    end_date: form.end_date || null,
    target_hours: form.target_hours ? Number(form.target_hours) : null,
    notes: form.notes.trim() || null,
  };
}

function entryPayload(form) {
  return {
    activity_date: form.activity_date,
    title: form.title.trim(),
    category: form.category || null,
    hours: hoursFromMinutes(form.duration_minutes),
    start_time: form.start_time || null,
    end_time: form.end_time || null,
    location: form.location.trim() || null,
    description: form.description.trim() || null,
  };
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

function minutesFromTimeRange(startTime, endTime) {
  if (!startTime || !endTime) return '';
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return '';
  return String(end - start);
}

function sortedEntries(entries) {
  return entries
    .slice()
    .sort((a, b) => `${b.activity_date}-${b.start_time || ''}`.localeCompare(`${a.activity_date}-${a.start_time || ''}`));
}

function StatCard({ icon: Icon, tone, label, value, helper }) {
  return (
    <MotionDiv variants={itemVariants} className="rounded-lg border border-surface-border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-text-muted">{label}</p>
          <p className="mt-2 text-2xl font-semibold leading-none text-text">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${statStyles[tone] || statStyles.time}`}>
          <Icon size={20} />
        </div>
      </div>
      {helper && <p className="mt-3 text-xs leading-5 text-text-light">{helper}</p>}
    </MotionDiv>
  );
}

function IconButton({ children, label, className = '', ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-text-muted transition hover:border-surface-border hover:bg-white hover:text-brand ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function ProgressPanel({ logbook, percent, t }) {
  return (
    <MotionDiv variants={itemVariants} className="rounded-lg border border-surface-border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text">{t('logbook_progress')}</h2>
          <p className="mt-1 text-xs text-text-muted">{t('logbook_target')}</p>
        </div>
        <span className="rounded-md bg-brand-muted px-2 py-1 text-xs font-semibold text-brand">{percent}%</span>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-surface-muted">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-text">{formatMinutesFromHours(logbook.total_hours, t)}</p>
          <p className="mt-1 text-xs text-text-muted">
            {logbook.target_hours
              ? `${formatMinutesFromHours(logbook.target_hours, t)} ${t('logbook_target').toLowerCase()}`
              : t('logbook_no_target')}
          </p>
        </div>
        {logbook.target_hours && (
          <p className="text-right text-xs leading-5 text-text-light">
            {formatHours(logbook.total_hours, t)} / {formatHours(logbook.target_hours, t)}
          </p>
        )}
      </div>
    </MotionDiv>
  );
}

function ActivityHeatmap({ entries, logbook, locale, t }) {
  const initialMonth = useMemo(() => {
    const newest = sortedEntries(entries)[0]?.activity_date || logbook?.start_date || new Date().toISOString().slice(0, 10);
    const date = new Date(`${newest}T00:00:00`);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }, [entries, logbook?.start_date]);
  const [month, setMonth] = useState(initialMonth);

  useEffect(() => {
    setMonth(initialMonth);
  }, [initialMonth]);

  const cells = useMemo(() => {
    const totalsByDay = {};
    entries.forEach((entry) => {
      totalsByDay[entry.activity_date] = (totalsByDay[entry.activity_date] || 0) + minutesFromHours(entry.hours);
    });

    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const cursor = new Date(firstDay);
    cursor.setDate(firstDay.getDate() - firstDay.getDay());
    const end = new Date(lastDay);
    end.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

    const days = [];
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10);
      days.push({
        key,
        day: cursor.getDate(),
        inMonth: cursor.getMonth() === month.getMonth(),
        minutes: totalsByDay[key] || 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [entries, month]);

  const weekdays = useMemo(() => {
    const start = new Date(2024, 0, 7);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day.toLocaleDateString(locale, { weekday: 'short' });
    });
  }, [locale]);

  const monthLabel = month.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  function heatClass(minutes) {
    if (minutes >= 240) return 'bg-brand text-white';
    if (minutes >= 120) return 'bg-brand/70 text-white';
    if (minutes >= 60) return 'bg-brand/35 text-brand-dark';
    if (minutes > 0) return 'bg-brand/15 text-brand-dark';
    return 'bg-surface-muted text-text-light';
  }

  return (
    <MotionDiv variants={itemVariants} className="rounded-lg border border-surface-border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-text">{t('logbook_monthly_activity')}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-surface-border text-text-muted transition hover:text-brand"
            aria-label={t('logbook_previous_month')}
          >
            <ChevronLeft size={15} />
          </button>
          <span className="min-w-[116px] text-center text-xs font-medium text-text-muted">{monthLabel}</span>
          <button
            type="button"
            onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-surface-border text-text-muted transition hover:text-brand"
            aria-label={t('logbook_next_month')}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-7 gap-1.5">
        {weekdays.map((day) => (
          <div key={day} className="pb-1 text-center text-[11px] font-medium text-text-light">{day}</div>
        ))}
        {cells.map((cell) => (
          <div
            key={cell.key}
            title={`${cell.key}: ${cell.minutes} ${t('logbook_minutes_short')}`}
            className={`flex aspect-square items-center justify-center rounded-md text-[11px] font-semibold ${heatClass(cell.minutes)} ${cell.inMonth ? '' : 'opacity-40'}`}
          >
            {cell.day}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-text-light">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand/15" />&lt; 60</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand/35" />60-120</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand/70" />120-240</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand" />240+</span>
      </div>
    </MotionDiv>
  );
}

function EvidencePanel({ entries, t, onDownload, onDeleteAttachment }) {
  const attachments = useMemo(
    () => entries.flatMap((entry) => (entry.attachments || []).map((attachment) => ({ ...attachment, entryTitle: entry.title }))).slice(0, 5),
    [entries]
  );

  return (
    <MotionDiv variants={itemVariants} className="rounded-lg border border-surface-border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-text">{t('logbook_evidence_documents')}</h2>
        <Paperclip size={17} className="text-brand" />
      </div>
      {attachments.length > 0 ? (
        <div className="mt-4 space-y-2">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center gap-2 rounded-lg border border-surface-border p-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-600">
                <FileText size={15} />
              </div>
              <button type="button" onClick={() => onDownload(attachment)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-xs font-semibold text-text">{attachment.original_filename}</p>
                <p className="mt-0.5 truncate text-[11px] text-text-light">{formatFileSize(attachment.file_size)} - {attachment.entryTitle}</p>
              </button>
              <IconButton label={t('logbook_delete_attachment')} onClick={() => onDeleteAttachment(attachment.id)} className="hover:text-red-600">
                <Trash2 size={14} />
              </IconButton>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-surface-border bg-surface-muted p-5 text-sm leading-6 text-text-muted">
          {t('logbook_no_evidence')}
        </div>
      )}
    </MotionDiv>
  );
}

function ActivityTable({ entries, locale, t, onEdit, onDelete, onDownload, onDeleteAttachment, onUpload }) {
  const rows = useMemo(() => sortedEntries(entries), [entries]);
  const renderActions = (entry) => (
    <div className="flex justify-end gap-1">
      <IconButton label={t('logbook_edit')} onClick={() => onEdit(entry)}>
        <Edit3 size={14} />
      </IconButton>
      <label
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-transparent text-text-muted transition hover:border-surface-border hover:bg-white hover:text-brand"
        aria-label={t('logbook_attach')}
        title={t('logbook_attach')}
      >
        <Upload size={14} />
        <input
          type="file"
          className="hidden"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(event) => {
            onUpload(entry.id, event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </label>
      {(entry.attachments || []).length > 0 && (
        <IconButton label={t('logbook_delete_attachment')} onClick={() => onDeleteAttachment(entry.attachments[0].id)} className="hover:text-red-600">
          <Paperclip size={14} />
        </IconButton>
      )}
      <IconButton label={t('logbook_delete')} onClick={() => onDelete(entry.id)} className="hover:text-red-600">
        <Trash2 size={14} />
      </IconButton>
    </div>
  );
  const renderAttachmentList = (entry) => (
    <div className="flex flex-wrap gap-1.5">
      {(entry.attachments || []).length > 0 ? (
        entry.attachments.map((attachment) => (
          <button
            key={attachment.id}
            type="button"
            onClick={() => onDownload(attachment)}
            className="inline-flex max-w-[180px] items-center gap-1.5 rounded-md border border-surface-border bg-white px-2 py-1 text-xs text-text-muted transition hover:border-brand/30 hover:text-brand"
            title={attachment.original_filename}
          >
            <Paperclip size={12} />
            <span className="truncate">{attachment.original_filename}</span>
          </button>
        ))
      ) : null}
    </div>
  );

  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm">
      <div className="divide-y divide-surface-border md:hidden">
        {rows.map((entry) => {
          const config = getCategoryConfig(entry.category);
          return (
            <article key={entry.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-light">{formatDate(entry.activity_date, locale)}</p>
                  <h3 className="mt-1 break-words text-sm font-semibold text-text">{entry.title}</h3>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-base font-semibold text-text">{minutesFromHours(entry.hours)}</p>
                  <p className="text-xs text-text-light">{t('logbook_minutes_short')}</p>
                </div>
              </div>
              {entry.description && <p className="mt-2 break-words text-xs leading-5 text-text-muted">{entry.description}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                <span className="rounded-md bg-surface-muted px-2 py-1 font-medium text-text">{formatTimeRange(entry.start_time, entry.end_time)}</span>
                {entry.category && <span className={`rounded-md px-2 py-1 font-medium ${config.bg} ${config.text}`}>{entry.category}</span>}
                {entry.location && (
                  <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-surface-muted px-2 py-1">
                    <MapPin size={12} />
                    <span className="truncate">{entry.location}</span>
                  </span>
                )}
              </div>
              {(entry.attachments || []).length > 0 && <div className="mt-3">{renderAttachmentList(entry)}</div>}
              <div className="mt-3 flex justify-end border-t border-surface-border pt-3">{renderActions(entry)}</div>
            </article>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[760px] w-full border-collapse text-left text-sm">
          <thead className="border-b border-surface-border bg-surface-muted/70 text-xs font-semibold text-text-muted">
            <tr>
              <th className="px-4 py-3">{t('logbook_entry_date')}</th>
              <th className="px-4 py-3">{t('logbook_time')}</th>
              <th className="px-4 py-3">{t('logbook_activity')}</th>
              <th className="px-4 py-3 text-right">{t('logbook_entry_minutes')}</th>
              <th className="px-4 py-3 text-right">{t('logbook_actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {rows.map((entry) => {
              const config = getCategoryConfig(entry.category);
              return (
                <tr key={entry.id} className="align-top transition hover:bg-surface-muted/45">
                  <td className="whitespace-nowrap px-4 py-4 text-text-muted">{formatDate(entry.activity_date, locale)}</td>
                  <td className="whitespace-nowrap px-4 py-4 font-medium text-text">{formatTimeRange(entry.start_time, entry.end_time)}</td>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-text">{entry.title}</p>
                    {entry.description && <p className="mt-1 max-w-[360px] break-words text-xs leading-5 text-text-muted">{entry.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {entry.category && (
                        <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}>
                          {entry.category}
                        </span>
                      )}
                      {entry.location && (
                        <span className="inline-flex max-w-[220px] items-center gap-1.5 rounded-md bg-surface-muted px-2 py-0.5 text-xs text-text-muted">
                          <MapPin size={12} className="shrink-0 text-text-light" />
                          <span className="truncate">{entry.location}</span>
                        </span>
                      )}
                      {renderAttachmentList(entry)}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right">
                    <span className="font-semibold text-text">{minutesFromHours(entry.hours)}</span>
                    <span className="ml-1 text-xs text-text-light">{t('logbook_minutes_short')}</span>
                  </td>
                  <td className="px-4 py-4">
                    {renderActions(entry)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LogbookDetail() {
  const { logbookId } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const { addToast } = useToast();
  const locale = lang === 'id' ? 'id-ID' : 'en-US';
  const [logbook, setLogbook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showLogbookModal, setShowLogbookModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [logbookForm, setLogbookForm] = useState(null);
  const [entryForm, setEntryForm] = useState(emptyEntryForm);

  const entries = useMemo(() => logbook?.entries || [], [logbook]);
  const percent = progressPercent(logbook);
  const categoryOptions = useMemo(
    () => CATEGORIES.map((category) => ({ value: category.value, label: category.value })),
    []
  );
  const semesterSelectOptions = useMemo(() => semesterOptions(t), [t]);

  const loadLogbook = useCallback(async () => {
    try {
      const data = await logbooksApi.get(logbookId);
      setLogbook(data);
      setLogbookForm({
        title: data.title || '',
        role: data.role || '',
        company: data.company || '',
        semester: data.semester || '',
        mentor_name: data.mentor_name || '',
        start_date: data.start_date || '',
        end_date: data.end_date || '',
        target_hours: data.target_hours || '',
        notes: data.notes || '',
      });
    } catch (err) {
      addToast({ type: 'error', title: t('logbook_load_failed'), message: err.message });
    } finally {
      setLoading(false);
    }
  }, [addToast, logbookId, t]);

  useEffect(() => {
    loadLogbook();
  }, [loadLogbook]);

  function updateLogbookForm(field, value) {
    setLogbookForm((current) => ({ ...current, [field]: value }));
  }

  function updateEntryForm(field, value) {
    setEntryForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'start_time' || field === 'end_time') {
        const derivedMinutes = minutesFromTimeRange(next.start_time, next.end_time);
        if (derivedMinutes) next.duration_minutes = derivedMinutes;
      }
      return next;
    });
  }

  function openCreateEntry() {
    setEditingEntry(null);
    setEntryForm(emptyEntryForm);
    setShowEntryModal(true);
  }

  function openEditEntry(entry) {
    setEditingEntry(entry);
    setEntryForm({
      activity_date: entry.activity_date,
      title: entry.title || '',
      category: entry.category || 'Development',
      duration_minutes: String(minutesFromHours(entry.hours) || ''),
      start_time: formatTimeValue(entry.start_time),
      end_time: formatTimeValue(entry.end_time),
      location: entry.location || '',
      description: entry.description || '',
      file: null,
    });
    setShowEntryModal(true);
  }

  async function handleSaveLogbook(event) {
    event.preventDefault();
    const payload = logbookPayload(logbookForm);
    if (!payload.title || !payload.role || !payload.company) {
      addToast({ type: 'error', title: t('logbook_form_invalid'), message: t('logbook_required_manual') });
      return;
    }

    setSubmitting(true);
    try {
      const updated = await logbooksApi.update(logbook.id, payload);
      setLogbook(updated);
      setShowLogbookModal(false);
      addToast({ type: 'success', title: t('logbook_updated'), message: updated.title });
    } catch (err) {
      addToast({ type: 'error', title: t('logbook_update_failed'), message: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEntry(event) {
    event.preventDefault();
    const payload = entryPayload(entryForm);
    const fileError = validateFile(entryForm.file, t);

    if (!payload.title || !payload.activity_date || numberValue(entryForm.duration_minutes) <= 0) {
      addToast({ type: 'error', title: t('logbook_form_invalid'), message: t('logbook_entry_required') });
      return;
    }
    if (payload.start_time && payload.end_time && payload.end_time <= payload.start_time) {
      addToast({ type: 'error', title: t('logbook_form_invalid'), message: t('logbook_time_range_invalid') });
      return;
    }
    if (payload.activity_date > new Date().toISOString().slice(0, 10)) {
      addToast({ type: 'error', title: t('logbook_form_invalid'), message: t('logbook_future_date_invalid') });
      return;
    }
    if (fileError) {
      addToast({ type: 'error', title: t('logbook_file_invalid'), message: fileError });
      return;
    }

    setSubmitting(true);
    try {
      const saved = editingEntry
        ? await logbooksApi.updateEntry(editingEntry.id, payload)
        : await logbooksApi.createEntry(logbook.id, payload);
      if (!editingEntry && entryForm.file) {
        await logbooksApi.uploadAttachment(saved.id, entryForm.file);
      }
      setShowEntryModal(false);
      await loadLogbook();
      addToast({ type: 'success', title: editingEntry ? t('logbook_entry_updated') : t('logbook_entry_created'), message: payload.title });
    } catch (err) {
      addToast({ type: 'error', title: t('logbook_entry_save_failed'), message: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteLogbook() {
    if (!window.confirm(t('logbook_delete_confirm'))) return;
    setSubmitting(true);
    try {
      await logbooksApi.delete(logbook.id);
      addToast({ type: 'success', title: t('logbook_deleted'), message: logbook.title });
      navigate('/student/logbook');
    } catch (err) {
      addToast({ type: 'error', title: t('logbook_delete_failed'), message: err.message });
      setSubmitting(false);
    }
  }

  async function handleDeleteEntry(entryId) {
    if (!window.confirm(t('logbook_entry_delete_confirm'))) return;
    try {
      await logbooksApi.deleteEntry(entryId);
      await loadLogbook();
      addToast({ type: 'success', title: t('logbook_entry_deleted'), message: t('logbook_entry_deleted_message') });
    } catch (err) {
      addToast({ type: 'error', title: t('logbook_delete_failed'), message: err.message });
    }
  }

  async function handleUploadAttachment(entryId, file) {
    const error = validateFile(file, t);
    if (error) {
      addToast({ type: 'error', title: t('logbook_file_invalid'), message: error });
      return;
    }
    try {
      await logbooksApi.uploadAttachment(entryId, file);
      await loadLogbook();
      addToast({ type: 'success', title: t('logbook_attachment_uploaded'), message: file.name });
    } catch (err) {
      addToast({ type: 'error', title: t('logbook_upload_failed'), message: err.message });
    }
  }

  async function handleDownloadAttachment(attachment) {
    try {
      await logbooksApi.downloadAttachment(attachment.id, attachment.original_filename);
    } catch (err) {
      addToast({ type: 'error', title: t('logbook_download_failed'), message: err.message });
    }
  }

  async function handleDeleteAttachment(attachmentId) {
    if (!window.confirm(t('logbook_attachment_delete_confirm'))) return;
    try {
      await logbooksApi.deleteAttachment(attachmentId);
      await loadLogbook();
      addToast({ type: 'success', title: t('logbook_attachment_deleted'), message: t('logbook_attachment_deleted_message') });
    } catch (err) {
      addToast({ type: 'error', title: t('logbook_delete_failed'), message: err.message });
    }
  }

  async function handleExportPdf() {
    try {
      await logbooksApi.exportPdf(logbook.id, `${logbook.title}.pdf`);
    } catch (err) {
      addToast({ type: 'error', title: t('logbook_export_failed'), message: err.message });
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-brand" />
      </div>
    );
  }

  if (!logbook) {
    return (
      <div className="rounded-lg border border-dashed border-surface-border bg-white p-12 text-center">
        <BookOpen size={44} className="mx-auto mb-4 text-surface-border" />
        <p className="font-semibold text-text">{t('logbook_not_found')}</p>
        <Button to="/student/logbook" variant="outline" className="mt-5 gap-2">
          <ArrowLeft size={16} />
          {t('logbook_back')}
        </Button>
      </div>
    );
  }

  return (
    <MotionDiv variants={containerVariants} initial="hidden" animate="visible" className="space-y-5 pb-10">
      <MotionDiv variants={itemVariants}>
        <Link to="/student/logbook" className="inline-flex items-center gap-2 text-sm font-medium text-text-muted transition hover:text-brand">
          <ArrowLeft size={16} />
          {t('logbook_back')}
        </Link>
      </MotionDiv>

      <MotionDiv variants={itemVariants} className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-brand-muted text-brand">
                <Building size={28} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="break-words text-2xl font-semibold tracking-tight text-text">{logbook.title}</h1>
                  <span className="rounded-md bg-brand-muted px-2 py-1 text-xs font-semibold text-brand">{percent}%</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-text-muted">
                  <span className="inline-flex items-center gap-1.5"><Building size={14} />{logbook.company}</span>
                  <span className="inline-flex items-center gap-1.5"><User size={14} />{logbook.role}</span>
                  {logbook.semester && <span className="inline-flex items-center gap-1.5"><BookOpen size={14} />{logbook.semester}</span>}
                  {(logbook.start_date || logbook.end_date) && (
                    <span className="inline-flex items-center gap-1.5"><Calendar size={14} />{formatDateRange(logbook.start_date, logbook.end_date, locale)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowLogbookModal(true)} className="gap-2">
              <Edit3 size={16} />
              {t('logbook_edit')}
            </Button>
            <Button variant="outline" onClick={handleExportPdf} className="gap-2">
              <Download size={16} />
              {t('logbook_export_pdf')}
            </Button>
            <Button variant="danger" onClick={handleDeleteLogbook} disabled={submitting} className="gap-2">
              <Trash2 size={16} />
              {t('logbook_delete')}
            </Button>
          </div>
        </div>

        {(logbook.mentor_name || logbook.notes) && (
          <div className="grid gap-px border-t border-surface-border bg-surface-border md:grid-cols-2">
            <div className="bg-white p-4">
              <p className="text-xs font-medium text-text-light">{t('logbook_field_mentor')}</p>
              <p className="mt-1 text-sm font-medium text-text">{logbook.mentor_name || '-'}</p>
            </div>
            <div className="bg-white p-4">
              <p className="text-xs font-medium text-text-light">{t('logbook_field_notes')}</p>
              <p className="mt-1 break-words text-sm leading-6 text-text-muted">{logbook.notes || '-'}</p>
            </div>
          </div>
        )}
      </MotionDiv>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Clock} tone="time" label={t('logbook_total_minutes')} value={formatMinutesFromHours(logbook.total_hours, t)} helper={formatHours(logbook.total_hours, t)} />
        <StatCard icon={FileText} tone="entries" label={t('logbook_total_entries')} value={entries.length} helper={t('logbook_activity_log')} />
        <StatCard icon={Paperclip} tone="files" label={t('logbook_total_files')} value={logbook.attachment_count || 0} helper={t('logbook_media')} />
        <StatCard icon={Target} tone="progress" label={t('logbook_progress')} value={`${percent}%`} helper={logbook.target_hours ? `${formatMinutesFromHours(logbook.target_hours, t)} ${t('logbook_target').toLowerCase()}` : t('logbook_no_target')} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <MotionDiv variants={itemVariants} className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text">{t('logbook_activity_log')}</h2>
              <p className="mt-1 text-sm text-text-muted">{t('logbook_activity_precision_hint')}</p>
            </div>
            <Button onClick={openCreateEntry} className="gap-2">
              <Plus size={16} />
              {t('logbook_add_entry')}
            </Button>
          </div>

          {entries.length > 0 ? (
            <ActivityTable
              entries={entries}
              locale={locale}
              t={t}
              onEdit={openEditEntry}
              onDelete={handleDeleteEntry}
              onDownload={handleDownloadAttachment}
              onDeleteAttachment={handleDeleteAttachment}
              onUpload={handleUploadAttachment}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-surface-border bg-white p-12 text-center shadow-sm">
              <FileText size={42} className="mx-auto mb-4 text-surface-border" />
              <p className="font-semibold text-text">{t('logbook_no_entries')}</p>
              <Button onClick={openCreateEntry} className="mt-5 gap-2">
                <Plus size={16} />
                {t('logbook_add_entry')}
              </Button>
            </div>
          )}
        </MotionDiv>

        <div className="space-y-5">
          <ProgressPanel logbook={logbook} percent={percent} t={t} />
          <ActivityHeatmap entries={entries} logbook={logbook} locale={locale} t={t} />
          <EvidencePanel entries={entries} t={t} onDownload={handleDownloadAttachment} onDeleteAttachment={handleDeleteAttachment} />
        </div>
      </div>

      <Modal
        isOpen={showLogbookModal}
        onClose={() => !submitting && setShowLogbookModal(false)}
        title={t('logbook_edit_title')}
        size="lg"
        footer={(
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setShowLogbookModal(false)} disabled={submitting}>{t('logbook_cancel')}</Button>
            <Button type="submit" form="logbook-edit-form" disabled={submitting}>{submitting ? t('logbook_saving') : t('logbook_save')}</Button>
          </ModalFooter>
        )}
      >
        {logbookForm && (
          <form id="logbook-edit-form" onSubmit={handleSaveLogbook} className="space-y-4">
            <Input label={t('logbook_field_title')} value={logbookForm.title} onChange={(e) => updateLogbookForm('title', e.target.value)} required />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label={t('logbook_field_role')} value={logbookForm.role} onChange={(e) => updateLogbookForm('role', e.target.value)} required />
              <Input label={t('logbook_field_company')} value={logbookForm.company} onChange={(e) => updateLogbookForm('company', e.target.value)} required />
            </div>
            <Select
              label={t('logbook_field_semester')}
              value={logbookForm.semester}
              onChange={(e) => updateLogbookForm('semester', e.target.value)}
              options={semesterSelectOptions}
              placeholder={t('logbook_semester_select')}
            />
            <Input label={t('logbook_field_mentor')} value={logbookForm.mentor_name} onChange={(e) => updateLogbookForm('mentor_name', e.target.value)} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input type="date" label={t('logbook_field_start')} value={logbookForm.start_date} onChange={(e) => updateLogbookForm('start_date', e.target.value)} />
              <Input type="date" label={t('logbook_field_end')} value={logbookForm.end_date} onChange={(e) => updateLogbookForm('end_date', e.target.value)} />
              <Input type="number" min="0.5" step="0.5" label={t('logbook_field_target')} value={logbookForm.target_hours} onChange={(e) => updateLogbookForm('target_hours', e.target.value)} />
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">{t('logbook_field_notes')}</span>
              <textarea
                rows={4}
                value={logbookForm.notes}
                onChange={(e) => updateLogbookForm('notes', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/20"
              />
            </label>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={showEntryModal}
        onClose={() => !submitting && setShowEntryModal(false)}
        title={editingEntry ? t('logbook_edit_entry') : t('logbook_add_entry')}
        size="lg"
        footer={(
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setShowEntryModal(false)} disabled={submitting}>{t('logbook_cancel')}</Button>
            <Button type="submit" form="logbook-entry-form" disabled={submitting}>{submitting ? t('logbook_saving') : t('logbook_save')}</Button>
          </ModalFooter>
        )}
      >
        <form id="logbook-entry-form" onSubmit={handleSaveEntry} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input type="date" label={t('logbook_entry_date')} value={entryForm.activity_date} onChange={(e) => updateEntryForm('activity_date', e.target.value)} required />
            <Input type="number" min="1" step="1" label={t('logbook_entry_minutes')} value={entryForm.duration_minutes} onChange={(e) => updateEntryForm('duration_minutes', e.target.value)} required />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input type="time" label={t('logbook_start_time')} value={entryForm.start_time} onChange={(e) => updateEntryForm('start_time', e.target.value)} />
            <Input type="time" label={t('logbook_end_time')} value={entryForm.end_time} onChange={(e) => updateEntryForm('end_time', e.target.value)} />
            <Input label={t('logbook_location')} value={entryForm.location} onChange={(e) => updateEntryForm('location', e.target.value)} />
          </div>
          <Input label={t('logbook_entry_title')} value={entryForm.title} onChange={(e) => updateEntryForm('title', e.target.value)} required />
          <Select
            label={t('logbook_entry_category')}
            value={entryForm.category}
            onChange={(e) => updateEntryForm('category', e.target.value)}
            options={categoryOptions}
          />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">{t('logbook_entry_desc')}</span>
            <textarea
              rows={4}
              value={entryForm.description}
              onChange={(e) => updateEntryForm('description', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/20"
            />
          </label>
          {!editingEntry && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">{t('logbook_entry_file_optional')}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) => updateEntryForm('file', event.target.files?.[0] || null)}
                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand"
              />
              <span className="mt-1 block text-xs text-text-light">{t('logbook_file_hint')}</span>
            </label>
          )}
        </form>
      </Modal>
    </MotionDiv>
  );
}
