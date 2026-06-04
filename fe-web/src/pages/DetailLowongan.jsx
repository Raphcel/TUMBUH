import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { opportunitiesApi } from '../api/opportunities';
import { applicationsApi } from '../api/applications';
import { bookmarksApi } from '../api/bookmarks';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, MapPin, Bookmark, Briefcase, Building2, Clock, Tag, Lock, CheckCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { CompanyLogo } from '../components/ui/CompanyLogo';
import { useTranslation } from '../context/LanguageContext';

const TAB_KEYS = ['desc', 'qualif', 'benefits'];

export function DetailLowongan({ jobId, isEmbedded }) {
  const { id: paramId } = useParams();
  const id = jobId || paramId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { t, lang } = useTranslation();

  const [activeTab, setActiveTab] = useState('desc');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applied, setApplied] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);

  useEffect(() => {
    opportunitiesApi
      .get(id)
      .then((data) => setJob(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    setBookmarked(false);
    if (!user || user.role !== 'student' || !id) return;

    bookmarksApi
      .check(id)
      .then((data) => {
        setBookmarked(Boolean(data?.bookmarked ?? data?.is_bookmarked ?? data?.exists));
      })
      .catch(() => {});
  }, [id, user]);

  useEffect(() => {
    setApplied(false);
    if (!user || user.role !== 'student' || !id) return;

    applicationsApi
      .mine()
      .then((data) => {
        const exists = (data.items || []).some((app) => Number(app.opportunity_id) === Number(id));
        setApplied(exists);
      })
      .catch(() => {});
  }, [id, user]);

  const handleApply = () => {
    const applyPath = `/student/applications/apply/${id}`;
    if (!user) {
      navigate('/login', { state: { from: { pathname: applyPath, search: '' } } });
      return;
    }
    navigate(applyPath);
  };

  const handleToggleBookmark = async () => {
    if (!user) { setShowAuthModal(true); return; }
    if (user.role !== 'student') {
      addToast({
        title: lang === 'id' ? 'Khusus mahasiswa' : 'Student only',
        message: lang === 'id' ? 'Hanya akun mahasiswa yang bisa menyimpan lowongan.' : 'Only student accounts can save opportunities.',
        type: 'warning',
      });
      return;
    }

    setBookmarking(true);
    try {
      if (bookmarked) {
        await bookmarksApi.remove(job.id);
        setBookmarked(false);
        window.dispatchEvent(new CustomEvent('opportunity-bookmark-change', {
          detail: { opportunityId: job.id, bookmarked: false },
        }));
        addToast({
          title: lang === 'id' ? 'Dihapus' : 'Removed',
          message: lang === 'id' ? 'Lowongan dihapus dari simpanan.' : 'Opportunity removed from saved list.',
          type: 'success',
        });
      } else {
        await bookmarksApi.add(job.id);
        setBookmarked(true);
        window.dispatchEvent(new CustomEvent('opportunity-bookmark-change', {
          detail: { opportunityId: job.id, bookmarked: true },
        }));
        addToast({
          title: lang === 'id' ? 'Tersimpan' : 'Saved',
          message: lang === 'id' ? 'Lowongan berhasil disimpan.' : 'Opportunity saved.',
          type: 'success',
        });
      }
    } catch (err) {
      addToast({
        title: 'Error',
        message: err.message || (lang === 'id' ? 'Gagal memperbarui simpanan.' : 'Failed to update bookmark.'),
        type: 'error',
      });
    } finally {
      setBookmarking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    );
  }

  if (!job) {
    return <div className="py-20 text-center text-[#0A1D3D]/50">{t('det_not_found')}</div>;
  }

  const company = job.company || {};
  const requirements = Array.isArray(job.requirements) ? job.requirements : [];
  const benefits = Array.isArray(job.benefits) ? job.benefits : [];
  const deadlineStr = job.deadline
    ? new Date(job.deadline).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : '-';
  const panelClass = isEmbedded ? 'bg-white px-5 pt-4 pb-3' : 'rounded-md border border-[#E6ECF5] bg-white p-5 shadow-sm';
  const compactPanelClass = isEmbedded ? 'bg-white p-5' : 'rounded-md border border-[#E6ECF5] bg-white p-5 shadow-sm';
  const tabClass = isEmbedded ? 'border-y border-[#E6ECF5] bg-white px-5' : 'mb-6 overflow-x-auto rounded-md border border-[#E6ECF5] bg-white px-4 shadow-sm';
  const contentGapClass = isEmbedded ? 'gap-0 pb-0' : 'gap-6 pb-8';

  return (
    <div className={isEmbedded ? "h-full bg-white" : "min-h-screen bg-[#E6ECF5] pb-20 pt-16"}>
      {/* ── Auth Modal ── */}
      <Modal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} title={t('det_login_to_apply')} size="sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="text-[#357963]" size={24} />
          </div>
          <p className="text-[#0A1D3D]/50 mt-2">Kamu perlu login untuk melamar posisi ini.</p>
        </div>
        <div className="space-y-3">
          <Button to="/login" variant="primary" className="w-full justify-center">Masuk</Button>
          <Button to="/register" variant="outline" className="w-full justify-center">Buat Akun</Button>
        </div>
      </Modal>

      {/* ── Main Content ── */}
      <main className={isEmbedded ? "h-full w-full overflow-y-auto bg-white" : "mx-auto w-full max-w-[1180px] px-4 py-4 sm:px-6"}>
        {/* Back navigation */}
        {!isEmbedded && (
        <Link
          to="/lowongan"
          className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0A1D3D]/50 hover:text-[#357963]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('det_back')}
        </Link>
        )}

        {/* Job header card */}
        {isEmbedded ? (
          <section className="bg-white px-5 pt-4 pb-3">
            <div className="flex items-start gap-4">
              <CompanyLogo
                company={company}
                className="h-12 w-12 rounded-md border border-[#E6ECF5] bg-white p-1.5"
                imageClassName="h-full w-full object-contain"
                fallbackClassName="text-2xl font-bold text-[#0A1D3D]/40"
              />

              <div className="min-w-0 flex-1">
                <div className="relative min-h-[76px] pr-40 flex flex-col justify-end">
                  <div className="min-w-0">
                    <h1 className="mb-1 truncate text-lg font-semibold text-[#0A1D3D]">{job.title}</h1>
                    <Link
                      to={`/perusahaan/${company.id}`}
                      className="mb-2 block truncate text-sm font-medium text-[#0A1D3D]/50 transition-colors hover:text-[#357963]"
                    >
                      {company.name}
                    </Link>

                    <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[#0A1D3D]/50">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="text-[#0A1D3D]/40" size={16} />
                        <span>{job.location}</span>
                      </div>
                      {job.work_mode && (
                        <><div className="w-1.5 h-1.5 rounded-full bg-[#E6ECF5]" /><span>{job.work_mode}</span></>
                      )}
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E6ECF5]" />
                      <span>{job.type}</span>
                    </div>
                  </div>

                  <div className="absolute bottom-0 right-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleBookmark}
                      disabled={bookmarking}
                      aria-label="Simpan lowongan"
                      className={`flex h-9 w-9 items-center justify-center rounded-md border transition-colors disabled:opacity-60 ${
                        bookmarked
                          ? 'border-[#357963]/30 bg-[#357963]/20 text-[#357963]'
                          : 'border-[#E6ECF5] text-[#0A1D3D]/40 hover:border-[#357963] hover:text-[#357963]'
                      }`}
                    >
                      <Bookmark size={18} fill={bookmarked ? 'currentColor' : 'none'} />
                    </button>
                    {user?.role !== 'hr' && (
                      applied ? (
                        <div className="flex h-9 items-center gap-2 rounded-md bg-[#58C855] px-4 text-sm font-semibold text-white">
                          <CheckCircle size={16} /> {t('det_applied')}
                        </div>
                      ) : (
                        <button
                          onClick={handleApply}
                          className="h-9 rounded-md bg-[#58C855] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#45a843]"
                        >
                          {t('det_apply')}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="overflow-hidden rounded-md border border-[#E6ECF5] bg-white shadow-sm mb-6">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px]">
              {/* Left: Job details */}
              <div className="p-6">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <CompanyLogo
                    company={company}
                    className="h-16 w-16 shrink-0 rounded-md border border-[#E6ECF5] bg-white p-2 shadow-sm xl:h-20 xl:w-20"
                    imageClassName="h-full w-full object-contain"
                    fallbackClassName="text-2xl font-bold text-[#0A1D3D]/40"
                  />
                  <div className="flex-1 min-w-0 w-full">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#357963]">
                      {job.type} • {job.work_mode || 'Lainnya'}
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight text-[#0A1D3D] leading-tight mb-2">{job.title}</h1>
                    <Link
                      to={`/perusahaan/${company.id}`}
                      className="mb-4 inline-block text-base font-medium text-[#0A1D3D]/60 hover:text-[#357963] transition-colors"
                    >
                      {company.name}
                    </Link>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#0A1D3D]/50">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="text-[#0A1D3D]/40" size={16} />
                        <span>{job.location}</span>
                      </div>
                      {job.created_at && (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-[#E6ECF5]" />
                          <span>{t('det_posted')} {Math.round((Date.now() - new Date(job.created_at)) / 86400000)}d ago</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Green aside for action (Apply / Bookmark) */}
              <aside className="relative overflow-hidden flex flex-col justify-between border-t border-white/10 bg-[#357963] p-6 text-white lg:border-l lg:border-t-0">
                <div className="relative z-10">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">Batas Lamaran</p>
                  <p className="mt-1 text-lg font-semibold text-white">{deadlineStr}</p>
                </div>

                <div className="relative z-10 mt-6 flex flex-col gap-2.5">
                  {user?.role !== 'hr' && (
                    applied ? (
                      <div className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#58C855] text-sm font-semibold text-white shadow-sm">
                        <CheckCircle size={16} /> {t('det_applied')}
                      </div>
                    ) : (
                      <button
                        onClick={handleApply}
                        className="flex h-10 w-full items-center justify-center rounded-full bg-[#58C855] text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#45a843]"
                      >
                        {t('det_apply')}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    onClick={handleToggleBookmark}
                    disabled={bookmarking}
                    className={`flex h-10 w-full items-center justify-center gap-2 rounded-full border transition-all duration-200 disabled:opacity-60 shadow-sm ${
                      bookmarked
                        ? 'border-white bg-white text-[#357963] hover:bg-white/90'
                        : 'border-white/30 bg-transparent text-white hover:border-white hover:bg-white/10'
                    }`}
                  >
                    <Bookmark size={16} fill={bookmarked ? 'currentColor' : 'none'} />
                    <span>{bookmarked ? 'Tersimpan' : 'Simpan Lowongan'}</span>
                  </button>
                </div>

                {/* Background Leaf watermarks */}
                <svg
                  className="absolute -right-6 -bottom-6 h-[60%] w-auto pointer-events-none text-white opacity-[0.08] z-0"
                  viewBox="0 0 120 110"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M56.311 97.4178V95.5977M56.311 63.2918C56.311 56.0064 56.311 51.9217 56.311 44.6363C54.3392 30.0759 41.9326 1.50103 8.07958 3.68509C5.80451 23.4023 12.2657 62.9278 56.311 63.2918ZM56.311 63.2918V95.5977M65.8662 76.9422C65.8662 41.6332 96.2004 37.0527 111.368 39.1761C118.648 86.1335 77.6966 96.3561 56.311 95.5977M111.368 39.1761C111.368 39.1761 104.207 46.6413 94.9871 56.2536M33.1053 33.716C33.1053 33.716 41.9795 43.9768 47.6657 50.5514M68.5963 83.7674C76.5453 75.4802 86.6152 64.9818 94.9871 56.2536M94.9871 56.2536C94.9871 61.8453 94.9871 70.572 94.9871 70.572M94.9871 56.2536C91.7886 56.2536 86.7968 56.2536 86.7968 56.2536"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </aside>
            </div>
          </section>
        )}

        {/* Tabs */}
        <nav className={tabClass}>
          <ul className="flex whitespace-nowrap min-w-full">
            {TAB_KEYS.map((tabKey) => {
              const tabLabel = t(`det_tab_${tabKey}`);
              return (
              <li key={tabKey} className="mr-6">
                <button
                  onClick={() => setActiveTab(tabKey)}
                  className={`inline-block ${isEmbedded ? 'py-3 text-xs' : 'py-4 text-sm'} font-semibold transition-colors border-b-2 ${
                    activeTab === tabKey
                      ? 'text-[#357963] border-[#357963] font-semibold'
                      : 'text-[#0A1D3D]/50 border-transparent hover:text-[#0A1D3D]'
                  }`}
                >
                  {tabLabel}
                </button>
              </li>
              );
            })}
          </ul>
        </nav>

        {/* Content area */}
        <div className={`grid grid-cols-1 ${isEmbedded ? '' : 'lg:grid-cols-3'} ${contentGapClass}`}>
          {/* Left: main content */}
          <div className={`${isEmbedded ? '' : 'lg:col-span-2'} ${isEmbedded ? '' : 'space-y-6'}`}>
            {(activeTab === 'desc' || activeTab === 'qualif' || activeTab === 'benefits') && (
              <>
                {activeTab === 'desc' && (
                  <section className={isEmbedded ? `${compactPanelClass} border-b border-[#E6ECF5]` : compactPanelClass}>
                    <h2 className={isEmbedded ? "mb-3 text-sm font-semibold text-[#0A1D3D]" : "mb-4 text-lg font-semibold text-[#0A1D3D]"}>{t('det_desc')}</h2>
                    <div className={isEmbedded ? "whitespace-pre-line text-sm leading-6 text-[#0A1D3D]/60" : "whitespace-pre-line text-sm leading-7 text-[#0A1D3D]/60"}>{job.description}</div>
                  </section>
                )}

                {activeTab === 'qualif' && (
                  <section className={isEmbedded ? `${compactPanelClass} border-b border-[#E6ECF5]` : compactPanelClass}>
                    <h2 className={isEmbedded ? "mb-3 text-sm font-semibold text-[#0A1D3D]" : "mb-4 text-lg font-semibold text-[#0A1D3D]"}>{t('det_qualifications')}</h2>
                    {requirements.length > 0 ? (
                      <ul className={isEmbedded ? "list-disc pl-5 space-y-1.5 text-sm text-[#0A1D3D]/60" : "list-disc pl-5 space-y-2 text-sm text-[#0A1D3D]/60"}>
                        {requirements.map((req, idx) => <li key={idx}>{req}</li>)}
                      </ul>
                    ) : (
                      <p className="text-[#0A1D3D]/50 italic text-sm">{t('det_no_qualifications')}</p>
                    )}
                  </section>
                )}

                {activeTab === 'benefits' && (
                  <section className={isEmbedded ? `${compactPanelClass} border-b border-[#E6ECF5]` : compactPanelClass}>
                    <h2 className={isEmbedded ? "mb-3 text-sm font-semibold text-[#0A1D3D]" : "mb-4 text-lg font-semibold text-[#0A1D3D]"}>{t('det_benefits')}</h2>
                    {benefits.length > 0 ? (
                      <div className="flex flex-wrap gap-2.5">
                        {benefits.map((b, idx) => (
                          <span key={idx} className={isEmbedded ? "inline-flex items-center px-3 py-1.5 rounded-sm border border-[#E6ECF5] bg-white text-xs text-[#0A1D3D]/60 font-medium" : "inline-flex items-center px-4 py-1.5 rounded-full border border-[#E6ECF5] bg-white text-xs text-[#0A1D3D]/60 font-medium"}>
                            {b}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[#0A1D3D]/50 italic text-sm">{t('det_no_benefits')}</p>
                    )}
                  </section>
                )}
              </>
            )}

          </div>

          {/* Right: sidebar */}
          <div className={isEmbedded ? 'border-b border-[#E6ECF5]' : 'space-y-6'}>
            {/* Job info card */}
            <div className={isEmbedded ? "bg-white p-5 border-b border-[#E6ECF5]" : "rounded-md border border-[#E6ECF5] bg-white p-5 shadow-sm"}>
              <div className={isEmbedded ? "mb-4 flex items-center justify-between gap-3" : "mb-5 flex items-center justify-between gap-3"}>
                <h3 className={isEmbedded ? "text-sm font-semibold text-[#0A1D3D]" : "text-base font-semibold text-[#0A1D3D]"}>{t('det_overview')}</h3>
                <button
                  type="button"
                  onClick={handleToggleBookmark}
                  disabled={bookmarking}
                  aria-label={lang === 'id' ? 'Simpan lowongan' : 'Save opportunity'}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors disabled:opacity-60 ${
                    bookmarked
                      ? 'border-[#357963]/30 bg-[#357963]/10 text-[#357963]'
                      : 'border-[#E6ECF5] text-[#0A1D3D]/40 hover:border-[#357963] hover:text-[#357963]'
                  }`}
                >
                  <Bookmark size={16} fill={bookmarked ? 'currentColor' : 'none'} />
                </button>
              </div>
              <ul className={isEmbedded ? "grid grid-cols-2 gap-x-4 gap-y-3" : "space-y-4"}>
                <li className="flex gap-3">
                  <Briefcase className="text-[#0A1D3D]/40 shrink-0 mt-0.5" size={isEmbedded ? 16 : 18} />
                  <div>
                    <p className="text-xs text-[#0A1D3D]/50 mb-0.5">{t('det_type')}</p>
                    <p className="text-sm font-medium text-[#0A1D3D]">{job.type}</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <MapPin className="text-[#0A1D3D]/40 shrink-0 mt-0.5" size={isEmbedded ? 16 : 18} />
                  <div>
                    <p className="text-xs text-[#0A1D3D]/50 mb-0.5">{t('det_location')}</p>
                    <p className="text-sm font-medium text-[#0A1D3D]">{job.location}</p>
                  </div>
                </li>
                {job.work_mode && (
                  <li className="flex gap-3">
                    <Building2 className="text-[#0A1D3D]/40 shrink-0 mt-0.5" size={isEmbedded ? 16 : 18} />
                    <div>
                      <p className="text-xs text-[#0A1D3D]/50 mb-0.5">Model Kerja</p>
                      <p className="text-sm font-medium text-[#0A1D3D]">{job.work_mode}</p>
                    </div>
                  </li>
                )}
                {job.salary && (
                  <li className="flex gap-3">
                    <Tag className="text-[#0A1D3D]/40 shrink-0 mt-0.5" size={isEmbedded ? 16 : 18} />
                    <div>
                      <p className="text-xs text-[#0A1D3D]/50 mb-0.5">{t('det_salary')}</p>
                      <p className="text-sm font-medium text-[#0A1D3D]">{job.salary}</p>
                    </div>
                  </li>
                )}
                {job.deadline && (
                  <li className="flex gap-3">
                    <Clock className="text-[#0A1D3D]/40 shrink-0 mt-0.5" size={isEmbedded ? 16 : 18} />
                    <div>
                      <p className="text-xs text-[#0A1D3D]/50 mb-0.5">Deadline</p>
                      <p className="text-sm font-medium text-[#0A1D3D]">{deadlineStr}</p>
                    </div>
                  </li>
                )}
              </ul>
            </div>

            {/* Company profile card */}
            <div className={isEmbedded ? "bg-white p-5" : "rounded-md border border-[#E6ECF5] bg-white p-5 shadow-sm"}>
              <div className={isEmbedded ? "mb-3 flex items-center gap-3" : "flex items-center gap-4 mb-4"}>
                <CompanyLogo
                  company={company}
                  className="h-10 w-10 rounded-md border border-[#E6ECF5] bg-white p-1"
                  imageClassName="h-full w-full object-contain"
                  fallbackClassName="font-bold text-[#0A1D3D]/40"
                />
                <h3 className="text-base font-semibold text-[#0A1D3D] truncate">{company.name}</h3>
              </div>
              <p className="text-sm leading-6 text-[#0A1D3D]/60 mb-4 line-clamp-4">{company.description}</p>
              <Link
                to={`/perusahaan/${company.id}`}
                className="inline-flex items-center text-sm font-semibold text-[#357963] hover:text-[#295f4d] group transition-colors"
              >
                {t('det_view_profile')}
                <ArrowLeft className="ml-1 rotate-180 group-hover:translate-x-1 transition-transform" size={14} />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
