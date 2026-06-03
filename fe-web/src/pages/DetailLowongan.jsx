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
    return <div className="py-20 text-center text-gray-500">{t('det_not_found')}</div>;
  }

  const company = job.company || {};
  const requirements = Array.isArray(job.requirements) ? job.requirements : [];
  const benefits = Array.isArray(job.benefits) ? job.benefits : [];
  const deadlineStr = job.deadline
    ? new Date(job.deadline).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : '-';
  const panelClass = isEmbedded ? 'bg-white px-5 pt-4 pb-3' : 'rounded-2xl border border-surface-border bg-white p-5 shadow-sm';
  const compactPanelClass = isEmbedded ? 'bg-white p-5' : 'rounded-2xl border border-surface-border bg-white p-5 shadow-sm';
  const tabClass = isEmbedded ? 'border-y border-gray-200 bg-white px-5' : 'mb-6 overflow-x-auto rounded-2xl border border-surface-border bg-white px-4 shadow-sm';
  const contentGapClass = isEmbedded ? 'gap-0 pb-0' : 'gap-6 pb-8';

  return (
    <div className={isEmbedded ? "h-full bg-[#fcfcfd]" : "min-h-screen bg-surface-muted pb-20"}>
      {/* ── Auth Modal ── */}
      <Modal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} title={t('det_login_to_apply')} size="sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="text-brand" size={24} />
          </div>
          <p className="text-gray-500 mt-2">Kamu perlu login untuk melamar posisi ini.</p>
        </div>
        <div className="space-y-3">
          <Button to="/login" variant="primary" className="w-full justify-center">Masuk</Button>
          <Button to="/register" variant="outline" className="w-full justify-center">Buat Akun</Button>
        </div>
      </Modal>

      {/* ── Main Content ── */}
      <main className={isEmbedded ? "h-full w-full overflow-y-auto bg-white" : "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8"}>
        {/* Back navigation */}
        {!isEmbedded && (
        <Link
          to="/lowongan"
          className="inline-flex items-center text-sm text-gray-500 hover:text-brand transition-colors mb-6 group"
        >
          <ArrowLeft className="mr-2 text-lg group-hover:-translate-x-1 transition-transform" size={16} />
          {t('det_back')}
        </Link>
        )}

        {/* Job header card */}
        <section className={isEmbedded ? panelClass : `${panelClass} mb-6 xl:p-6`}>
          <div className={isEmbedded ? "flex items-start gap-4" : "flex flex-col items-start gap-5 sm:flex-row sm:items-center"}>
            {/* Company logo */}
            <Link
              to={`/perusahaan/${company.id}`}
              className={isEmbedded ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white p-1.5 transition-colors hover:border-[#357963]" : "flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-surface-border bg-white p-2 shadow-sm transition-colors hover:border-brand xl:h-20 xl:w-20"}
              aria-label={`View ${company.name} profile`}
            >
              {company.logo
                ? <img alt={company.name} className="w-full h-auto object-contain" src={company.logo} />
                : <span className="text-2xl font-bold text-gray-400">{company.name?.[0]}</span>
              }
            </Link>

            <div className="min-w-0 flex-1">
              <div className={isEmbedded ? "relative min-h-[76px] pr-40 flex flex-col justify-end" : "flex justify-between items-start"}>
                <div className="min-w-0">
                  <h1 className={isEmbedded ? "mb-1 truncate text-lg font-semibold text-gray-950" : "mb-1 text-xl font-bold text-text xl:text-2xl"}>{job.title}</h1>
                  <Link
                    to={`/perusahaan/${company.id}`}
                    className={isEmbedded ? "mb-2 block truncate text-sm font-medium text-gray-500 transition-colors hover:text-[#357963]" : "mb-3 block text-base text-text-muted transition-colors hover:text-[#357963] xl:text-lg"}
                  >
                    {company.name}
                  </Link>

                  <div className={isEmbedded ? "mb-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-500" : "mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-muted"}>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="text-gray-400" size={16} />
                      <span>{job.location}</span>
                    </div>
                    {job.work_mode && (
                      <><div className="w-1 h-1 rounded-full bg-gray-300" /><span>{job.work_mode}</span></>
                    )}
                    <div className="w-1 h-1 rounded-full bg-gray-300" />
                    <span>{job.type}</span>
                    {isEmbedded && job.created_at && (
                      <>
                        <div className="w-1 h-1 rounded-full bg-gray-300" />
                        <span>{t('det_posted')} {Math.round((Date.now() - new Date(job.created_at)) / 86400000)}d</span>
                      </>
                    )}
                  </div>
                </div>

                <div className={isEmbedded ? "absolute bottom-0 right-0 flex items-center gap-2" : "flex items-center gap-3"}>
                  <button
                    type="button"
                    onClick={handleToggleBookmark}
                    disabled={bookmarking}
                    aria-label="Simpan lowongan"
                    className={`hidden h-9 w-9 items-center justify-center rounded-md border transition-colors disabled:opacity-60 sm:flex ${
                      bookmarked
                        ? 'border-[#357963]/30 bg-[#357963]/20 text-[#357963]'
                        : 'border-surface-border text-text-muted hover:border-[#357963] hover:text-[#357963]'
                    }`}
                  >
                    <Bookmark size={18} fill={bookmarked ? 'currentColor' : 'none'} />
                  </button>
                  {user?.role !== 'hr' && (
                    applied ? (
                      <div className="flex h-9 items-center gap-2 rounded-md bg-[#357963] px-4 text-sm font-semibold text-white">
                        <CheckCircle size={16} /> {t('det_applied')}
                      </div>
                    ) : (
                      <button
                        onClick={handleApply}
                        className="h-9 rounded-md bg-[#357963] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#295f4d]"
                      >
                        {t('det_apply')}
                      </button>
                    )
                  )}
                </div>
              </div>

              {!isEmbedded && (
                <div className="flex flex-col justify-between gap-4 border-t border-surface-border pt-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    {job.created_at && (
                      <span>{t('det_posted')} {Math.round((Date.now() - new Date(job.created_at)) / 86400000)}d</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

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
                      ? 'text-brand border-brand font-semibold'
                      : 'text-gray-500 border-transparent hover:text-gray-800'
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
                  <section className={isEmbedded ? `${compactPanelClass} border-b border-gray-200` : compactPanelClass}>
                    <h2 className={isEmbedded ? "mb-3 text-sm font-semibold text-gray-950" : "mb-4 text-lg font-bold text-text"}>{t('det_desc')}</h2>
                    <div className={isEmbedded ? "whitespace-pre-line text-sm leading-6 text-gray-600" : "whitespace-pre-line text-sm leading-7 text-text-muted"}>{job.description}</div>
                  </section>
                )}

                {activeTab === 'qualif' && (
                  <section className={isEmbedded ? `${compactPanelClass} border-b border-gray-200` : compactPanelClass}>
                    <h2 className={isEmbedded ? "mb-3 text-sm font-semibold text-gray-950" : "mb-4 text-lg font-bold text-text"}>{t('det_qualifications')}</h2>
                    {requirements.length > 0 ? (
                      <ul className={isEmbedded ? "list-disc pl-5 space-y-1.5 text-sm text-gray-600" : "list-disc pl-5 space-y-2 text-gray-600"}>
                        {requirements.map((req, idx) => <li key={idx}>{req}</li>)}
                      </ul>
                    ) : (
                      <p className="text-gray-500 italic text-sm">{t('det_no_qualifications')}</p>
                    )}
                  </section>
                )}

                {activeTab === 'benefits' && (
                  <section className={isEmbedded ? `${compactPanelClass} border-b border-gray-200` : compactPanelClass}>
                    <h2 className={isEmbedded ? "mb-3 text-sm font-semibold text-gray-950" : "mb-4 text-lg font-bold text-text"}>{t('det_benefits')}</h2>
                    {benefits.length > 0 ? (
                      <div className="flex flex-wrap gap-2.5">
                        {benefits.map((b, idx) => (
                          <span key={idx} className={isEmbedded ? "inline-flex items-center px-3 py-1.5 rounded-sm border border-gray-200 bg-white text-xs text-gray-600 font-medium" : "inline-flex items-center px-4 py-2 rounded-full border border-gray-200 bg-white text-sm text-gray-600 font-medium"}>
                            {b}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic text-sm">{t('det_no_benefits')}</p>
                    )}
                  </section>
                )}
              </>
            )}

          </div>

          {/* Right: sidebar */}
          <div className={isEmbedded ? 'border-b border-gray-200' : 'space-y-6'}>
            {/* Job info card */}
            <div className={isEmbedded ? "bg-white p-5 border-b border-gray-200" : "rounded-2xl border border-surface-border bg-white p-5 shadow-sm"}>
              <div className={isEmbedded ? "mb-4 flex items-center justify-between gap-3" : "mb-5 flex items-center justify-between gap-3"}>
                <h3 className={isEmbedded ? "text-sm font-semibold text-gray-950" : "text-base font-bold text-gray-900"}>{t('det_overview')}</h3>
                <button
                  type="button"
                  onClick={handleToggleBookmark}
                  disabled={bookmarking}
                  aria-label={lang === 'id' ? 'Simpan lowongan' : 'Save opportunity'}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors disabled:opacity-60 ${
                    bookmarked
                      ? 'border-brand/20 bg-brand/10 text-brand'
                      : 'border-surface-border text-text-muted hover:border-brand hover:text-brand'
                  }`}
                >
                  <Bookmark size={18} fill={bookmarked ? 'currentColor' : 'none'} />
                </button>
              </div>
              <ul className={isEmbedded ? "grid grid-cols-2 gap-x-4 gap-y-3" : "space-y-4"}>
                <li className="flex gap-3">
                  <Briefcase className="text-gray-400 shrink-0 mt-0.5" size={isEmbedded ? 16 : 20} />
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">{t('det_type')}</p>
                    <p className="text-sm font-medium text-gray-900">{job.type}</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <MapPin className="text-gray-400 shrink-0 mt-0.5" size={isEmbedded ? 16 : 20} />
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">{t('det_location')}</p>
                    <p className="text-sm font-medium text-gray-900">{job.location}</p>
                  </div>
                </li>
                {job.work_mode && (
                  <li className="flex gap-3">
                    <Building2 className="text-gray-400 shrink-0 mt-0.5" size={isEmbedded ? 16 : 20} />
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Model Kerja</p>
                      <p className="text-sm font-medium text-gray-900">{job.work_mode}</p>
                    </div>
                  </li>
                )}
                {job.salary && (
                  <li className="flex gap-3">
                    <Tag className="text-gray-400 shrink-0 mt-0.5" size={isEmbedded ? 16 : 20} />
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">{t('det_salary')}</p>
                      <p className="text-sm font-medium text-gray-900">{job.salary}</p>
                    </div>
                  </li>
                )}
                {job.deadline && (
                  <li className="flex gap-3">
                    <Clock className="text-gray-400 shrink-0 mt-0.5" size={isEmbedded ? 16 : 20} />
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Deadline</p>
                      <p className="text-sm font-medium text-gray-900">{deadlineStr}</p>
                    </div>
                  </li>
                )}
              </ul>
            </div>

            {/* Company profile card */}
            <div className={isEmbedded ? "bg-white p-5" : "rounded-2xl border border-surface-border bg-white p-5 shadow-sm"}>
              <div className={isEmbedded ? "mb-3 flex items-center gap-3" : "flex items-center gap-4 mb-4"}>
                <Link
                  to={`/perusahaan/${company.id}`}
                  className={isEmbedded ? "w-10 h-10 rounded-md border border-gray-100 flex items-center justify-center p-1 bg-white shrink-0 transition-colors hover:border-[#357963]" : "w-12 h-12 rounded-lg border border-gray-100 flex items-center justify-center p-1 bg-white shrink-0 transition-colors hover:border-brand"}
                >
                  {company.logo
                    ? <img alt={company.name} className="w-full h-auto object-contain" src={company.logo} />
                    : <span className="font-bold text-gray-400">{company.name?.[0]}</span>
                  }
                </Link>
                <Link
                  to={`/perusahaan/${company.id}`}
                  className={isEmbedded ? "truncate text-sm font-semibold text-gray-950 transition-colors hover:text-[#357963]" : "text-base font-bold text-gray-900 transition-colors hover:text-brand"}
                >
                  {company.name}
                </Link>
              </div>
              <p className={isEmbedded ? "mb-3 line-clamp-3 text-sm leading-6 text-gray-600" : "text-sm text-gray-600 mb-4 line-clamp-4"}>{company.description}</p>
              <Link
                to={`/perusahaan/${company.id}`}
                className="inline-flex items-center text-sm font-semibold text-brand hover:text-brand-dark group transition-colors"
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
