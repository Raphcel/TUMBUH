import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Loader2,
  Mail,
  MapPin,
  PenLine,
  Save,
  Send,
  UserRound,
} from 'lucide-react';
import { applicationsApi } from '../api/applications';
import { opportunitiesApi } from '../api/opportunities';
import { usersApi } from '../api/users';
import { CompanyLogo } from '../components/ui/CompanyLogo';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from '../context/LanguageContext';

const MotionDiv = motion.div;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { y: 14, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 130, damping: 18 },
  },
};

function formatDate(value, locale, options = {}) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  });
}

function getUserName(user) {
  return `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || 'Student';
}

function isDeadlinePassed(deadline) {
  if (!deadline) return false;
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() > date.getTime();
}

function serializeAnswers(value) {
  return JSON.stringify(value || {});
}

function StatusPill({ children, tone = 'slate', icon: Icon }) {
  const tones = {
    slate: 'border-[#E6ECF5] bg-[#E6ECF5] text-[#0A1D3D]/60',
    brand: 'border-brand/15 bg-brand/10 text-brand',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${tones[tone] || tones.slate}`}>
      {Icon && React.createElement(Icon, { size: 13, className: Icon === Loader2 ? 'animate-spin' : '' })}
      {children}
    </span>
  );
}

function InlineMeta({ icon: Icon, label, value }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm text-text-muted">
      {React.createElement(Icon, { size: 15, className: 'flex-shrink-0 text-brand' })}
      <span className="text-text-light">{label}</span>
      <span className="min-w-0 truncate font-medium text-text">{value || '-'}</span>
    </div>
  );
}

export function ApplyLowongan() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();
  const { lang } = useTranslation();
  const locale = lang === 'id' ? 'id-ID' : 'en-US';
  const isId = lang === 'id';

  const copy = isId
    ? {
        back: 'Kembali',
        loading: 'Menyiapkan aplikasi...',
        notFound: 'Lowongan tidak ditemukan.',
        newTitle: 'Aplikasi baru',
        editTitle: 'Edit aplikasi terkirim',
        newSubtitle: 'Tulis pesan singkat untuk recruiter. Draft disimpan otomatis.',
        editSubtitle: 'Anda masih bisa mengubah jawaban sebelum deadline lowongan.',
        draftSaved: 'Draft tersimpan',
        draftSaving: 'Menyimpan draft',
        draftUnsaved: 'Belum tersimpan',
        draftError: 'Draft gagal disimpan',
        submittedSaved: 'Perubahan tersimpan',
        submittedDirty: 'Ada perubahan',
        locked: 'Terkunci',
        lockedHint: 'Deadline sudah lewat atau lowongan sudah ditutup. Aplikasi tidak bisa diedit lagi.',
        profile: 'Profil',
        cv: 'CV aktif',
        cvReady: 'CV aktif tersedia',
        cvMissing: 'Belum ada CV aktif',
        openCv: 'Lihat CV',
        openingCv: 'Membuka...',
        uploadCv: 'Upload CV',
        letterLabel: 'Pesan untuk recruiter',
        letterPlaceholder: 'Contoh: Saya tertarik dengan role ini karena pengalaman saya di organisasi kampus dan proyek terkait...',
        questionsTitle: 'Pertanyaan perusahaan',
        noQuestions: 'Belum ada pertanyaan tambahan untuk lowongan ini.',
        saveDraft: 'Simpan draft',
        submit: 'Kirim aplikasi',
        saveChanges: 'Simpan perubahan',
        submitting: 'Menyimpan...',
        submitSuccessTitle: 'Aplikasi terkirim',
        submitSuccessMessage: 'Aplikasi baru sudah masuk ke Lamaran Saya.',
        updateSuccessTitle: 'Aplikasi diperbarui',
        updateSuccessMessage: 'Perubahan aplikasi sudah tersimpan.',
        submitError: 'Gagal menyimpan aplikasi.',
        candidate: 'Kandidat',
        deadline: 'Deadline',
        location: 'Lokasi',
        type: 'Tipe',
        statusDraft: 'Draft',
        statusSubmitted: 'Terkirim',
        editUntil: 'Bisa diedit sampai',
      }
    : {
        back: 'Back',
        loading: 'Preparing application...',
        notFound: 'Opportunity not found.',
        newTitle: 'New application',
        editTitle: 'Edit submitted application',
        newSubtitle: 'Write a short note for the recruiter. Drafts save automatically.',
        editSubtitle: 'You can still edit your submission before the opportunity deadline.',
        draftSaved: 'Draft saved',
        draftSaving: 'Saving draft',
        draftUnsaved: 'Unsaved',
        draftError: 'Draft failed to save',
        submittedSaved: 'Changes saved',
        submittedDirty: 'Unsaved changes',
        locked: 'Locked',
        lockedHint: 'The deadline has passed or the opportunity is closed. This application can no longer be edited.',
        profile: 'Profile',
        cv: 'Active CV',
        cvReady: 'Active CV available',
        cvMissing: 'No active CV yet',
        openCv: 'View CV',
        openingCv: 'Opening...',
        uploadCv: 'Upload CV',
        letterLabel: 'Message to recruiter',
        letterPlaceholder: 'Example: I am interested in this role because of my campus organization experience and related projects...',
        questionsTitle: 'Company questions',
        noQuestions: 'No extra questions for this opportunity yet.',
        saveDraft: 'Save draft',
        submit: 'Submit application',
        saveChanges: 'Save changes',
        submitting: 'Saving...',
        submitSuccessTitle: 'Application submitted',
        submitSuccessMessage: 'Your new application is now in My Applications.',
        updateSuccessTitle: 'Application updated',
        updateSuccessMessage: 'Your application changes were saved.',
        submitError: 'Failed to save application.',
        candidate: 'Candidate',
        deadline: 'Deadline',
        location: 'Location',
        type: 'Type',
        statusDraft: 'Draft',
        statusSubmitted: 'Submitted',
        editUntil: 'Editable until',
      };

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [savedCoverLetter, setSavedCoverLetter] = useState('');
  const [questionAnswers, setQuestionAnswers] = useState({});
  const [savedQuestionAnswers, setSavedQuestionAnswers] = useState({});
  const [draftStatus, setDraftStatus] = useState('saved');
  const [saveState, setSaveState] = useState('idle');
  const [existingApplication, setExistingApplication] = useState(null);
  const [openingCV, setOpeningCV] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      setLoading(true);
      setLoadError('');

      try {
        const [jobData, draftData, applicationsData] = await Promise.all([
          opportunitiesApi.get(id),
          applicationsApi.getDraft(id).catch((err) => {
            if (err.status === 404) return null;
            throw err;
          }),
          applicationsApi.mine().catch(() => ({ items: [] })),
          refreshUser().catch(() => null),
        ]);

        if (cancelled) return;

        const existing = (applicationsData.items || []).find(
          (app) => Number(app.opportunity_id) === Number(id)
        );
        const initialLetter = existing?.cover_letter || draftData?.cover_letter || '';
        const initialAnswers = existing?.question_answers || draftData?.question_answers || {};

        setJob(jobData);
        setExistingApplication(existing || null);
        setCoverLetter(initialLetter);
        setSavedCoverLetter(initialLetter);
        setQuestionAnswers(initialAnswers);
        setSavedQuestionAnswers(initialAnswers);
        setDraftStatus('saved');
        loadedRef.current = true;
      } catch (err) {
        if (!cancelled) setLoadError(err.message || copy.notFound);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [copy.notFound, id, refreshUser]);

  const deadlinePassed = isDeadlinePassed(job?.deadline);
  const isSubmitted = Boolean(existingApplication);
  const canEditSubmitted = isSubmitted && !deadlinePassed && job?.is_active !== false;
  const canEdit = !isSubmitted || canEditSubmitted;
  const questions = Array.isArray(job?.application_questions) ? job.application_questions : [];
  const isDirty = coverLetter !== savedCoverLetter || serializeAnswers(questionAnswers) !== serializeAnswers(savedQuestionAnswers);

  useEffect(() => {
    if (!loadedRef.current || isSubmitted) return undefined;
    if (!isDirty) {
      setDraftStatus('saved');
      return undefined;
    }

    setDraftStatus('dirty');
    const timeoutId = window.setTimeout(async () => {
      setDraftStatus('saving');
      try {
        const saved = await applicationsApi.saveDraft(id, {
          cover_letter: coverLetter.trim() ? coverLetter : null,
          question_answers: questionAnswers,
        });
        setSavedCoverLetter(saved.cover_letter || '');
        setSavedQuestionAnswers(saved.question_answers || {});
        setDraftStatus('saved');
      } catch (err) {
        setDraftStatus('error');
        addToast({
          type: 'error',
          title: copy.draftError,
          message: err.message || copy.draftError,
        });
      }
    }, 750);

    return () => window.clearTimeout(timeoutId);
  }, [addToast, copy.draftError, coverLetter, id, isDirty, isSubmitted, questionAnswers, savedCoverLetter]);

  const company = job?.company || {};
  const userName = getUserName(user);
  const wordCount = coverLetter.trim().split(/\s+/).filter(Boolean).length;

  const statusLabel = isSubmitted
    ? canEditSubmitted
      ? isDirty ? copy.submittedDirty : copy.submittedSaved
      : copy.locked
    : {
        saved: copy.draftSaved,
        saving: copy.draftSaving,
        dirty: copy.draftUnsaved,
        error: copy.draftError,
      }[draftStatus];
  const statusTone = !canEdit ? 'red' : isDirty || draftStatus === 'dirty' || draftStatus === 'saving' ? 'amber' : 'brand';
  const statusIcon = saveState === 'saving' || draftStatus === 'saving' ? Loader2 : !canEdit ? Clock : CheckCircle2;

  const profileFacts = useMemo(() => [
    { icon: Mail, value: user?.email || '-' },
    { icon: GraduationCap, value: user?.major || user?.university || '-' },
    { icon: FileText, value: user?.has_cv ? copy.cvReady : copy.cvMissing },
  ], [copy.cvMissing, copy.cvReady, user]);

  const handleViewCV = async () => {
    setOpeningCV(true);
    try {
      await usersApi.viewMyCV();
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to open CV' });
    } finally {
      setOpeningCV(false);
    }
  };

  const saveDraftNow = async () => {
    if (isSubmitted || !isDirty) return;
    setSaveState('saving');
    setDraftStatus('saving');
    try {
        const saved = await applicationsApi.saveDraft(id, {
          cover_letter: coverLetter.trim() ? coverLetter : null,
          question_answers: questionAnswers,
        });
        setSavedCoverLetter(saved.cover_letter || '');
        setSavedQuestionAnswers(saved.question_answers || {});
        setDraftStatus('saved');
    } catch (err) {
      setDraftStatus('error');
      addToast({ type: 'error', title: copy.draftError, message: err.message || copy.draftError });
    } finally {
      setSaveState('idle');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canEdit || saveState === 'saving') return;

    setSaveState('saving');
    try {
      const payload = {
        cover_letter: coverLetter.trim() ? coverLetter.trim() : null,
        question_answers: questionAnswers,
      };
      const application = isSubmitted
        ? await applicationsApi.updateMine(existingApplication.id, payload)
        : await applicationsApi.apply(id, payload);

      setExistingApplication(application);
      setSavedCoverLetter(application.cover_letter || '');
      setSavedQuestionAnswers(application.question_answers || {});
      addToast({
        type: 'success',
        title: isSubmitted ? copy.updateSuccessTitle : copy.submitSuccessTitle,
        message: isSubmitted ? copy.updateSuccessMessage : copy.submitSuccessMessage,
      });
      navigate(`/student/applications?submitted=${application.id}`, {
        replace: true,
        state: { submittedApplicationId: application.id, submittedTitle: job?.title },
      });
    } catch (err) {
      addToast({ type: 'error', title: copy.submitError, message: err.message || copy.submitError });
    } finally {
      setSaveState('idle');
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[420px] place-items-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-brand" />
          <p className="text-sm font-medium text-text-muted">{copy.loading}</p>
        </div>
      </div>
    );
  }

  if (loadError || !job) {
    return (
      <div className="grid min-h-[420px] place-items-center">
        <div className="max-w-md rounded-2xl border border-dashed border-[#E6ECF5] bg-white p-6 text-center">
          <FileText size={34} className="mx-auto mb-3 text-[#0A1D3D]/30" />
          <p className="font-semibold text-text">{loadError || copy.notFound}</p>
          <Link to="/lowongan" className="mt-4 inline-flex text-sm font-semibold text-brand hover:text-brand-dark">
            {copy.back}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <MotionDiv
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-7xl space-y-5 pb-8"
    >
      <MotionDiv variants={itemVariants} className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link to={`/lowongan/${id}`} className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-text-muted transition-colors hover:text-brand">
            <ArrowLeft size={16} />
            {copy.back}
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <CompanyLogo
              company={company}
              className="h-11 w-11 rounded-xl border border-[#E6ECF5] bg-white p-1.5 shadow-sm"
              fallbackClassName="text-sm font-black uppercase text-brand"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-muted">{company.name || '-'}</p>
              <h1 className="line-clamp-2 text-2xl font-bold tracking-tight text-text sm:text-3xl">
                {job.title}
              </h1>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">
            {isSubmitted ? copy.editSubtitle : copy.newSubtitle}
          </p>
        </div>

        <StatusPill tone={statusTone} icon={statusIcon}>
          {statusLabel}
        </StatusPill>
      </MotionDiv>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <MotionDiv variants={itemVariants} className="overflow-hidden rounded-2xl border border-[#E6ECF5] bg-white shadow-sm">
          <div className="border-b border-[#E6ECF5] px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  <InlineMeta icon={MapPin} label={copy.location} value={job.location} />
                  <InlineMeta icon={Briefcase} label={copy.type} value={job.type} />
                  <InlineMeta icon={Clock} label={copy.deadline} value={formatDate(job.deadline, locale)} />
                </div>
              </div>
              <StatusPill tone={isSubmitted ? 'brand' : 'slate'} icon={isSubmitted ? BadgeCheck : PenLine}>
                {isSubmitted ? copy.statusSubmitted : copy.statusDraft}
              </StatusPill>
            </div>
          </div>

          <div className="divide-y divide-[#E6ECF5]">
            <section className="px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-text">
                    <UserRound size={16} className="text-brand" />
                    {copy.profile}
                  </div>
                  <p className="mt-1 text-sm text-text-muted">{userName}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profileFacts.map((fact) => (
                    <StatusPill key={fact.value} tone="slate" icon={fact.icon}>
                      {fact.value}
                    </StatusPill>
                  ))}
                </div>
              </div>
            </section>

            <section className="px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-text">
                    <FileText size={16} className="text-brand" />
                    {copy.cv}
                  </div>
                  <p className="mt-1 text-sm text-text-muted">
                    {user?.has_cv ? copy.cvReady : copy.cvMissing}
                  </p>
                </div>
                {user?.has_cv ? (
                  <button
                    type="button"
                    onClick={handleViewCV}
                    disabled={openingCV}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-[#E6ECF5] px-4 text-sm font-semibold text-brand transition hover:border-brand/30 hover:bg-brand/5 disabled:opacity-60"
                  >
                    {openingCV ? copy.openingCv : copy.openCv}
                  </button>
                ) : (
                  <Link to="/student/profile" className="inline-flex h-10 items-center justify-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-white transition hover:bg-amber-600">
                    {copy.uploadCv}
                  </Link>
                )}
              </div>
            </section>

            <section className="px-5 py-5 sm:px-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-text">
                <Building2 size={16} className="text-brand" />
                {copy.questionsTitle}
              </div>
              {questions.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {questions.map((question) => {
                    const value = questionAnswers[question.id] || '';
                    return (
                      <label key={question.id} className="block">
                        <span className="mb-1.5 block text-sm font-medium text-text">
                          {question.label}
                          {question.required && <span className="ml-1 text-red-500">*</span>}
                        </span>
                        {question.type === 'single_choice' ? (
                          <select
                            value={value}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setQuestionAnswers((current) => ({ ...current, [question.id]: nextValue }));
                            }}
                            disabled={!canEdit}
                            className="w-full rounded-xl border border-[#E6ECF5] bg-white px-3 py-2.5 text-sm text-text shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-[#E6ECF5] disabled:text-text-muted"
                          >
                            <option value="">{isId ? 'Pilih jawaban' : 'Choose an answer'}</option>
                            {(question.options || []).map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        ) : (
                          <textarea
                            value={value}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setQuestionAnswers((current) => ({ ...current, [question.id]: nextValue }));
                            }}
                            disabled={!canEdit}
                            rows={question.type === 'long_text' ? 4 : 2}
                            className="w-full resize-y rounded-xl border border-[#E6ECF5] bg-white px-3 py-2.5 text-sm leading-6 text-text shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-[#E6ECF5] disabled:text-text-muted"
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-sm text-text-muted">{copy.noQuestions}</p>
              )}
            </section>

            <section className="px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label htmlFor="cover-letter" className="flex items-center gap-2 text-sm font-semibold text-text">
                  <PenLine size={16} className="text-brand" />
                  {copy.letterLabel}
                </label>
                <span className="text-xs font-semibold text-text-light">{wordCount} words</span>
              </div>
              <textarea
                id="cover-letter"
                value={coverLetter}
                onChange={(event) => setCoverLetter(event.target.value)}
                disabled={!canEdit}
                placeholder={copy.letterPlaceholder}
                className="mt-3 min-h-[300px] w-full resize-y border-0 bg-transparent p-0 text-sm leading-7 text-text outline-none placeholder:text-[#0A1D3D]/40 disabled:cursor-not-allowed disabled:text-text-muted"
              />
            </section>
          </div>
        </MotionDiv>

        <MotionDiv variants={itemVariants} className="xl:sticky xl:top-24 xl:self-start">
          <aside className="rounded-2xl border border-[#E6ECF5] bg-white p-5 shadow-sm">
            <div className="border-b border-[#E6ECF5] pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-light">{copy.candidate}</p>
              <p className="mt-2 font-semibold text-text">{userName}</p>
              <p className="text-sm text-text-muted">{user?.email || '-'}</p>
            </div>

            <div className="space-y-3 border-b border-[#E6ECF5] py-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-muted">{copy.deadline}</span>
                <span className="font-semibold text-text">{formatDate(job.deadline, locale)}</span>
              </div>
              {isSubmitted && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-muted">{copy.editUntil}</span>
                  <span className={canEditSubmitted ? 'font-semibold text-brand' : 'font-semibold text-red-600'}>
                    {canEditSubmitted ? formatDate(job.deadline, locale) : copy.locked}
                  </span>
                </div>
              )}
            </div>

            {!canEdit && (
              <p className="border-b border-[#E6ECF5] py-4 text-sm leading-6 text-red-600">
                {copy.lockedHint}
              </p>
            )}

            <div className="space-y-2 pt-4">
              {!isSubmitted && (
                <button
                  type="button"
                  onClick={saveDraftNow}
                  disabled={!isDirty || saveState === 'saving'}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#E6ECF5] bg-white px-4 text-sm font-semibold text-text-muted transition hover:border-brand/30 hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save size={16} />
                  {copy.saveDraft}
                </button>
              )}
              <button
                type="submit"
                disabled={!canEdit || saveState === 'saving' || (isSubmitted && !isDirty)}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saveState === 'saving' ? <Loader2 size={16} className="animate-spin" /> : isSubmitted ? <Save size={16} /> : <Send size={16} />}
                {saveState === 'saving' ? copy.submitting : isSubmitted ? copy.saveChanges : copy.submit}
              </button>
            </div>
          </aside>
        </MotionDiv>
      </form>
    </MotionDiv>
  );
}
