import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { companiesApi } from '../api/companies';
import { companyFollowsApi } from '../api/companyFollows';
import { opportunitiesApi } from '../api/opportunities';
import { MapPin, Globe, Users, Star, Bookmark, Building2, ArrowLeft, Briefcase, PenLine, Plus, Check } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';

export function DetailPerusahaan() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [company, setCompany] = useState(null);
  const [companyJobs, setCompanyJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState(null);

  useEffect(() => {
    Promise.all([companiesApi.get(id), opportunitiesApi.listByCompany(id)])
      .then(([compData, oppData]) => {
        setCompany(compData);
        setCompanyJobs(Array.isArray(oppData) ? oppData : oppData.items || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    companiesApi.listReviews(id)
      .then((data) => setReviews(data.items || []))
      .catch(console.error)
      .finally(() => setReviewsLoading(false));
  }, [id]);

  useEffect(() => {
    if (!user || user.role !== 'student') {
      setIsFollowing(false);
      return;
    }

    companyFollowsApi
      .status(id)
      .then((data) => setIsFollowing(Boolean(data.is_following)))
      .catch(console.error);
  }, [id, user]);

  const handleToggleFollow = async () => {
    if (!user) {
      addToast({
        type: 'info',
        title: 'Login required',
        message: 'Please log in as a student to follow companies.',
      });
      navigate('/login');
      return;
    }
    if (user.role !== 'student') {
      addToast({
        type: 'warning',
        title: 'Student only',
        message: 'Only student accounts can follow companies.',
      });
      return;
    }

    setFollowLoading(true);
    try {
      if (isFollowing) {
        await companyFollowsApi.unfollow(id);
        setIsFollowing(false);
      } else {
        await companyFollowsApi.follow(id);
        setIsFollowing(true);
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Failed',
        message: err.message || 'Could not update company follow.',
      });
    } finally {
      setFollowLoading(false);
    }
  };

  const handleOpenReviewModal = () => {
    if (!user) {
      addToast({
        type: 'info',
        title: 'Login required',
        message: 'Please log in as a student to write reviews.',
      });
      navigate('/login');
      return;
    }
    if (user.role !== 'student') {
      addToast({
        type: 'warning',
        title: 'Student only',
        message: 'Only student accounts can write reviews.',
      });
      return;
    }
    setReviewRating(5);
    setReviewContent('');
    setEditingReviewId(null);
    setIsReviewModalOpen(true);
  };

  const handleOpenEditReviewModal = (review) => {
    setReviewRating(review.rating);
    setReviewContent(review.content);
    setEditingReviewId(review.id);
    setIsReviewModalOpen(true);
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus ulasan ini?')) {
      return;
    }

    try {
      await companiesApi.deleteReview(id, reviewId);
      addToast({
        type: 'success',
        title: 'Ulasan dihapus',
        message: 'Ulasan Anda telah berhasil dihapus.',
      });
      // Reload company details and reviews
      companiesApi.get(id).then(setCompany).catch(console.error);
      companiesApi.listReviews(id).then((data) => setReviews(data.items || [])).catch(console.error);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Gagal menghapus',
        message: err.message || 'Tidak dapat menghapus ulasan.',
      });
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (reviewContent.trim().length < 5) {
      addToast({
        type: 'warning',
        title: 'Review too short',
        message: 'Review content must be at least 5 characters long.',
      });
      return;
    }

    setSubmittingReview(true);
    try {
      if (editingReviewId) {
        await companiesApi.updateReview(id, editingReviewId, {
          rating: reviewRating,
          content: reviewContent,
        });
        addToast({
          type: 'success',
          title: 'Ulasan diperbarui',
          message: 'Ulasan Anda telah berhasil diperbarui.',
        });
      } else {
        await companiesApi.createReview(id, {
          rating: reviewRating,
          content: reviewContent,
        });
        addToast({
          type: 'success',
          title: 'Review submitted',
          message: 'Your review has been published successfully.',
        });
      }
      setIsReviewModalOpen(false);
      setEditingReviewId(null);
      // Reload reviews and company details
      companiesApi.get(id).then(setCompany).catch(console.error);
      companiesApi.listReviews(id).then((data) => setReviews(data.items || [])).catch(console.error);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Submission failed',
        message: err.message || 'Could not submit review.',
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand" />
      </div>
    );
  }

  if (!company) {
    return <div className="py-20 text-center text-[#0A1D3D]/50">{t('dcomp_not_found')}</div>;
  }

  const facts = [
    { label: t('dcomp_industry'), value: company.industry || t('comp_others'), icon: Building2 },
    { label: t('dcomp_location'), value: company.location || '-', icon: MapPin },
    { label: t('comp_company_size'), value: company.employee_count ? Number(company.employee_count).toLocaleString('en-US') : '-', icon: Users },
  ];

  const renderStars = (rating, isDarkBg = false, starSize = "h-5 w-5") => {
    const num = Number(rating) || 0;
    const fullStars = Math.floor(num);
    const hasHalf = num % 1 >= 0.25 && num % 1 < 0.75;
    const roundedFull = num % 1 >= 0.75 ? fullStars + 1 : fullStars;

    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((index) => {
          if (index <= roundedFull) {
            return (
              <Star
                key={index}
                className={`${starSize} text-amber-400`}
                fill="currentColor"
              />
            );
          } else if (index === roundedFull + 1 && hasHalf) {
            const gradId = `star-grad-${index}-${Math.floor(Math.random() * 1000000)}`;
            return (
              <svg
                key={index}
                className={`${starSize} text-amber-400`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <defs>
                  <linearGradient id={gradId}>
                    <stop offset="50%" stopColor="currentColor" />
                    <stop offset="50%" stopColor="transparent" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polygon
                  points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                  fill={`url(#${gradId})`}
                />
              </svg>
            );
          } else {
            return (
              <Star
                key={index}
                className={`${starSize} ${isDarkBg ? 'text-white/20' : 'text-[#0A1D3D]/30'}`}
                fill="none"
              />
            );
          }
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#E6ECF5] pb-10 pt-16">
      <main className="mx-auto w-full max-w-[1180px] px-4 py-4 sm:px-6">
        <Link
          to="/perusahaan"
          className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0A1D3D]/50 hover:text-[#357963]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('navbar_companies')}
        </Link>

        <section className="overflow-hidden rounded-md border border-[#E6ECF5] bg-white shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px]">
            <div className="flex flex-col justify-between h-full">
              <div className="px-6 pt-6 pb-4">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md border border-[#E6ECF5] bg-white p-2.5 shadow-sm">
                    {company.logo
                      ? <img src={company.logo} alt={company.name} className="h-full w-full object-contain" />
                      : <span className="text-3xl font-bold text-[#0A1D3D]/40">{company.name?.[0]}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0 w-full">
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#357963]">
                          {company.industry || t('comp_others')}
                        </p>
                        <h1 className="text-3xl font-semibold tracking-tight text-[#0A1D3D] leading-tight">{company.name}</h1>
                      </div>
                      <div className="shrink-0 pt-1">
                        <button
                          onClick={handleToggleFollow}
                          disabled={followLoading}
                          className={`inline-flex items-center gap-1.5 h-9 border px-4 text-xs font-semibold rounded-full transition-all duration-200 disabled:opacity-60 shadow-sm ${
                            isFollowing
                              ? 'border-[#357963] bg-[#357963] text-white hover:bg-[#295f4d]'
                              : 'border-[#E6ECF5] bg-white text-[#0A1D3D] hover:border-[#357963] hover:text-[#357963]'
                          }`}
                        >
                          {isFollowing ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              <span>Mengikuti</span>
                            </>
                          ) : (
                            <>
                              <Plus className="h-3.5 w-3.5" />
                              <span>Ikuti</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="max-w-3xl text-sm leading-6 text-[#0A1D3D]/60">
                      {company.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 border-t border-[#E6ECF5] sm:grid-cols-3">
                {facts.map((fact, index) => <Fact key={fact.label} fact={fact} bordered={index > 0} />)}
              </div>
            </div>

            <aside className="relative overflow-hidden flex flex-col justify-between border-t border-white/10 bg-[#357963] p-5 text-white lg:border-l lg:border-t-0">
              <div className="relative z-10">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">Lowongan Tersedia</p>
                <p className="mt-1 text-3xl font-semibold text-white">{companyJobs.length}</p>
              </div>
              {company.rating && (
                <div className="relative z-10 border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">Rating</p>
                    <button
                      onClick={() => document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth' })}
                      className="rounded-full p-1.5 text-white/65 hover:bg-white/10 hover:text-white transition-all duration-200"
                      title="Tulis Ulasan"
                    >
                      <PenLine className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-col gap-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold text-white">{company.rating}</span>
                      <span className="text-sm text-white/60">/ 5.0</span>
                    </div>
                    <div className="mt-1">
                      {renderStars(company.rating, true, "h-5 w-5")}
                    </div>
                  </div>
                </div>
              )}

              {/* Background Leaf watermarks */}
              <svg
                className="absolute -right-6 -bottom-6 h-[55%] w-auto pointer-events-none text-white opacity-[0.08] z-0"
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

              <svg
                className="absolute -right-4 top-2 h-[35%] w-auto pointer-events-none text-white opacity-[0.06] z-0 rotate-[35deg]"
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

        {company.why_join && Array.isArray(company.why_join) && (
          <section className="mt-4 overflow-hidden rounded-md border border-[#E6ECF5] bg-white shadow-sm">
            <SectionTitle eyebrow="Culture" title={`Mengapa Bergabung dengan ${company.name}?`} />
            <div className="grid grid-cols-1 border-t border-[#E6ECF5] md:grid-cols-2">
              {company.why_join.map((reason, idx) => (
                <div key={idx} className="border-b border-[#E6ECF5] px-5 py-4 text-sm leading-6 text-[#0A1D3D]/60 md:border-r">
                  <span className="mb-2 block h-0.5 w-8 bg-[#357963]" />
                  {reason}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-4 overflow-hidden rounded-md border border-[#E6ECF5] bg-white shadow-sm">
          <SectionTitle
            dark={true}
            accentType="leaf"
            title={t('dcomp_open_positions')}
            badge={
              <span className="inline-flex items-center rounded-full bg-[#58C855]/15 px-2.5 py-0.5 text-xs font-semibold text-[#58C855] border border-[#58C855]/20">
                {companyJobs.length} Aktif
              </span>
            }
          />
          {companyJobs.length > 0 ? (
            <div className="border-t border-[#E6ECF5] p-5 bg-[#E6ECF5]/10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {companyJobs.slice(0, 3).map((job) => (
                  <div
                    key={job.id}
                    className="group flex flex-col justify-between rounded-md border border-[#E6ECF5] bg-white p-5 shadow-sm hover:border-[#357963]/30 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-block rounded-sm bg-[#E6ECF5] border border-[#357963]/15 px-2 py-0.5 text-[10px] font-semibold text-[#357963]">
                          {job.type}
                        </span>
                        {job.work_mode && (
                          <span className="text-[10px] font-semibold text-[#0A1D3D]/40 uppercase tracking-wider">
                            {job.work_mode}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-3 text-[15px] font-semibold text-[#0A1D3D] group-hover:text-[#357963] transition-colors line-clamp-2 leading-snug">
                        {job.title}
                      </h3>
                      <div className="mt-4 flex items-center gap-1.5 text-xs text-[#0A1D3D]/50">
                        <MapPin className="h-3.5 w-3.5 text-[#0A1D3D]/40 shrink-0" />
                        <span className="truncate">{job.location}</span>
                      </div>
                      {job.salary && (
                        <p className="mt-3.5 text-xs font-semibold text-[#357963] bg-[#E6ECF5]/50 px-2 py-1 rounded w-fit">
                          {job.salary}
                        </p>
                      )}
                    </div>
                    <div className="mt-5 pt-4 border-t border-[#E6ECF5] flex items-center justify-between">
                      <Link
                        to={`/lowongan/${job.id}`}
                        className="text-xs font-semibold text-[#357963] hover:text-[#295f4d] inline-flex items-center gap-1 transition-colors"
                      >
                        Detail Lowongan
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              {companyJobs.length > 3 && (
                <div className="mt-5 text-center">
                  <Link
                    to={`/lowongan?companyId=${company.id}&companyName=${encodeURIComponent(company.name)}`}
                    className="inline-flex items-center justify-center h-9 border border-[#E6ECF5] px-5 text-xs font-semibold rounded-md bg-white text-[#0A1D3D]/70 hover:border-[#357963] hover:text-[#357963] transition-colors"
                  >
                    Lihat Semua
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="border-t border-[#E6ECF5] py-12 text-center text-sm italic text-[#0A1D3D]/40">{t('dcomp_no_positions')}</div>
          )}
        </section>

        <section id="reviews-section" className="mt-4 overflow-hidden rounded-md border border-[#E6ECF5] bg-white shadow-sm">
          <SectionTitle
            dark={true}
            accentType="circles"
            title={t('dcomp_reviews')}
            action={
              <button
                onClick={handleOpenReviewModal}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#58C855] px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#45a843]"
              >
                <PenLine className="h-3.5 w-3.5" />
                <span>Tulis Ulasan</span>
              </button>
            }
          />
          <div className="grid grid-cols-1 border-t border-[#E6ECF5] lg:grid-cols-[240px_1fr]">
            <div className="border-b border-[#E6ECF5] px-5 py-4 lg:border-b-0 lg:border-r bg-[#E6ECF5]/20">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A1D3D]/40">Average Rating</p>
              <div className="mt-2 flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-semibold leading-none text-[#0A1D3D]">{company.rating || '-'}</span>
                  {company.rating && <span className="text-sm text-[#0A1D3D]/40">/ 5.0</span>}
                </div>
                {company.rating && (
                  <div className="mt-1">
                    {renderStars(company.rating, false, "h-4 w-4")}
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-[#0A1D3D]/50">Berdasarkan ulasan mahasiswa dan karyawan.</p>
            </div>
            <div className="divide-y divide-[#E6ECF5] px-5">
              {reviewsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-brand" />
                </div>
              ) : reviews.length > 0 ? (
                reviews.map((rev) => (
                  <div key={rev.id} className="py-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E6ECF5] text-xs font-bold text-[#357963] overflow-hidden border border-[#357963]/15">
                        {rev.user?.avatar ? (
                          <img src={rev.user.avatar} alt={`${rev.user.first_name} ${rev.user.last_name}`} className="h-full w-full object-cover" />
                        ) : (
                          `${rev.user?.first_name?.[0] || ''}${rev.user?.last_name?.[0] || ''}`
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                          <div>
                            <p className="text-sm font-semibold text-[#0A1D3D]">
                              {rev.user?.first_name} {rev.user?.last_name}
                            </p>
                            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#0A1D3D]/40">
                              <span>
                                {new Date(rev.created_at).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                })}
                              </span>
                              {rev.user_id === user?.id && (
                                <>
                                  <span>•</span>
                                  <button
                                    onClick={() => handleOpenEditReviewModal(rev)}
                                    className="text-[#357963] hover:underline font-semibold cursor-pointer"
                                  >
                                    Edit
                                  </button>
                                </>
                              )}
                              {(rev.user_id === user?.id || user?.role === 'admin') && (
                                <>
                                  <span>•</span>
                                  <button
                                    onClick={() => handleDeleteReview(rev.id)}
                                    className="text-red-650 hover:underline font-semibold cursor-pointer"
                                  >
                                    Hapus
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          {renderStars(rev.rating, false, "h-3.5 w-3.5")}
                          <span className="text-[11px] font-semibold text-amber-500">{rev.rating}.0</span>
                        </div>
                      </div>
                    </div>
                    <p className="mt-2.5 text-sm leading-6 text-[#0A1D3D]/60 whitespace-pre-line pl-12">
                      {rev.content}
                    </p>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm font-semibold text-[#0A1D3D]">Belum ada ulasan tertulis.</p>
                  <p className="mt-1 text-sm text-[#0A1D3D]/50">
                    Jadilah mahasiswa pertama yang menulis ulasan untuk perusahaan ini!
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Review Writing Modal */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title="Tulis Ulasan Perusahaan"
        size="md"
      >
        <form onSubmit={handleSubmitReview} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#0A1D3D]/50 mb-2">Rating Anda</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewRating(star)}
                  className="transition-transform active:scale-90 focus:outline-none"
                >
                  <Star
                    className={`h-8 w-8 cursor-pointer ${star <= reviewRating ? 'text-amber-400' : 'text-[#0A1D3D]/30 hover:text-amber-300'}`}
                    fill={star <= reviewRating ? 'currentColor' : 'none'}
                  />
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#0A1D3D]/40 mt-1.5">
              Pilih peringkat dari 1 sampai 5 bintang.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#0A1D3D]/50 mb-2">Ulasan Tertulis</label>
            <textarea
              required
              rows={4}
              value={reviewContent}
              onChange={(e) => setReviewContent(e.target.value)}
              placeholder="Ceritakan pengalaman Anda magang atau bekerja di perusahaan ini. Bagaimana budaya kerjanya, mentor, atau tugas-tugasnya?"
              className="w-full rounded-md border border-[#E6ECF5] p-3 text-sm text-[#0A1D3D] focus:border-[#357963] focus:ring-1 focus:ring-[#357963] outline-none transition-all duration-200"
            />
            <p className="text-[11px] text-[#0A1D3D]/40 mt-1.5">
              Minimum 5 karakter. Ulasan Anda akan dibaca oleh mahasiswa lain yang ingin mendaftar.
            </p>
          </div>

          <div className="flex justify-end gap-3 border-t border-[#E6ECF5] pt-4 mt-6">
            <button
              type="button"
              onClick={() => setIsReviewModalOpen(false)}
              className="rounded-md border border-[#E6ECF5] px-4 py-2 text-xs font-semibold text-[#0A1D3D]/80 hover:bg-[#E6ECF5] transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submittingReview}
              className="rounded-md bg-[#357963] px-4 py-2 text-xs font-semibold text-white hover:bg-[#295f4d] disabled:opacity-60 transition-colors"
            >
              {submittingReview ? 'Mengirim...' : 'Kirim Ulasan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function SectionTitle({ eyebrow, title, action, badge = null, dark = false, accentType = null }) {
  return (
    <div className={`relative overflow-hidden flex items-center justify-between gap-4 px-5 py-4 ${dark ? 'bg-[#0A1D3D] text-white' : ''}`}>
      <div className="relative z-10 flex items-center gap-2.5">
        <div>
          {eyebrow && (
            <p className={`mb-1 text-xs font-semibold uppercase tracking-[0.18em] ${dark ? 'text-[#58C855]' : 'text-[#357963]'}`}>
              {eyebrow}
            </p>
          )}
          <h2 className={`text-lg font-semibold ${dark ? 'text-white' : 'text-[#0A1D3D]'}`}>{title}</h2>
        </div>
        {badge}
      </div>
      {action && <div className="relative z-10">{action}</div>}

      {dark && accentType === 'leaf' && (
        <svg
          className="absolute right-0 top-1/2 -translate-y-1/2 h-[140%] w-auto pointer-events-none text-[#58C855] z-0"
          viewBox="0 0 197 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Leaf and surrounding top-half elements from design.svg */}
          <path
            d="M56.311 97.4178V95.5977M56.311 63.2918C56.311 56.0064 56.311 51.9217 56.311 44.6363C54.3392 30.0759 41.9326 1.50103 8.07958 3.68509C5.80451 23.4023 12.2657 62.9278 56.311 63.2918ZM56.311 63.2918V95.5977M65.8662 76.9422C65.8662 41.6332 96.2004 37.0527 111.368 39.1761C118.648 86.1335 77.6966 96.3561 56.311 95.5977M111.368 39.1761C111.368 39.1761 104.207 46.6413 94.9871 56.2536M33.1053 33.716C33.1053 33.716 41.9795 43.9768 47.6657 50.5514M68.5963 83.7674C76.5453 75.4802 86.6152 64.9818 94.9871 56.2536M94.9871 56.2536C94.9871 61.8453 94.9871 70.572 94.9871 70.572M94.9871 56.2536C91.7886 56.2536 86.7968 56.2536 86.7968 56.2536"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M62.2261 51.4615C65.7145 35.3843 83.0657 3.32109 124.563 3.6851M121.378 6.87018L124.563 3.6851L121.378 0.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="19.4549" cy="78.3072" r="12.1954" stroke="currentColor" strokeWidth="2" />
          <path
            d="M151.409 4.64011C160.418 4.64036 167.744 12.1447 167.744 21.4301C167.744 30.7158 160.418 38.2209 151.409 38.2212C142.4 38.2212 135.073 30.7159 135.073 21.4301C135.073 12.1446 142.4 4.64011 151.409 4.64011Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M157.734 32.3505C157.734 29.3844 156.609 27.6413 155.259 26.6356C153.882 25.6111 152.218 25.3139 151.117 25.3583C151.11 25.3583 151.103 25.3583 151.096 25.3583C148.292 25.3583 146.587 26.5267 145.565 27.9589C144.526 29.4165 144.174 31.1809 144.174 32.3505C144.174 32.6266 143.95 32.8505 143.674 32.8505C143.397 32.8505 143.174 32.6266 143.174 32.3505C143.174 31.0227 143.564 29.0416 144.751 27.3778C145.589 26.2031 146.814 25.2029 148.536 24.702C146.871 23.7857 145.743 22.0038 145.743 19.9598C145.743 16.9825 148.135 14.5605 151.096 14.5604C154.057 14.5604 156.45 16.9825 156.45 19.9598C156.45 22.0135 155.311 23.8014 153.633 24.7137C154.38 24.9463 155.148 25.3058 155.856 25.8329C157.479 27.0412 158.734 29.0925 158.734 32.3505C158.734 32.6266 158.51 32.8504 158.234 32.8505C157.958 32.8505 157.734 32.6266 157.734 32.3505Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M182.35 117.438H175.524V71.027C175.524 71.027 178.796 71.027 182.35 71.027M186.9 117.438V57.3766H195.545C195.545 57.3766 195.545 93.9828 195.545 117.438M150.499 95.5977H158.689V117.438H150.499V95.5977ZM163.239 83.3124V117.438H170.974V83.3124H163.239Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )}

      {dark && accentType === 'circles' && (
        <svg
          className="absolute right-0 top-1/2 -translate-y-1/2 h-[140%] w-auto pointer-events-none text-[#58C855] z-0"
          viewBox="0 115 197 101"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <mask id="path-7-outside-1_211_174" maskUnits="userSpaceOnUse" x="8.44141" y="89.5926" width="71" height="63" fill="black">
              <rect fill="white" x="8.44141" y="89.5926" width="71" height="63"/>
              <path d="M49.9408 97.4178C49.9408 101.187 46.885 104.243 43.1156 104.243C39.3461 104.243 36.2904 101.187 36.2904 97.4178C36.2904 93.6483 39.3461 90.5926 43.1156 90.5926C46.885 90.5926 49.9408 93.6483 49.9408 97.4178Z"/>
            </mask>
          </defs>
          <path
            d="M110.002 118.803L131.388 114.253C132.298 121.533 126.929 137.277 98.1722 142.009M100.447 137.004C102.116 134.274 106.999 128.359 113.188 126.539M89.0719 146.559C91.6503 145.649 98.8092 144.921 106.817 149.289M88.1619 141.554C90.5886 138.217 93.986 128.632 91.802 118.803C92.257 120.168 93.44 122.99 94.532 123.354"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M166.424 205.256H121.833L122.743 161.575C121.833 146.988 137.289 125.174 166.424 125.174C190.085 125.174 196 142.893 196 151.109V174.315C196 194.765 173.856 205.256 166.424 205.256Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="43.5705" cy="129.724" r="3.1401" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M9.44462 122.899H9.9447L9.94454 122.89L9.44462 122.899ZM78.1516 122.899L77.6516 122.89V122.899H78.1516ZM77.6516 151.564C77.6516 151.84 77.8755 152.064 78.1516 152.064C78.4277 152.064 78.6516 151.84 78.6516 151.564H78.1516H77.6516ZM9.44462 151.564H9.94462V122.899H9.44462H8.94462V151.564H9.44462ZM9.44462 122.899L9.94454 122.89C9.87026 118.73 11.1 112.475 15.0197 107.274C18.9209 102.097 25.5192 97.9178 36.2904 97.9178V97.4178V96.9178C25.2209 96.9178 18.3205 101.232 14.2211 106.672C10.1401 112.088 8.86731 118.574 8.9447 122.907L9.44462 122.899ZM49.9408 97.4178L49.9725 97.9168C54.677 97.6181 61.7083 98.5184 67.4996 102.164C73.2566 105.787 77.8307 112.146 77.6517 122.89L78.1516 122.899L78.6515 122.907C78.8365 111.81 74.0828 105.126 68.0323 101.317C62.016 97.5305 54.7598 96.6108 49.9091 96.9188L49.9408 97.4178ZM78.1516 122.899H77.6516V151.564H78.1516H78.6516V122.899H78.1516ZM49.9408 97.4178H48.9408C48.9408 100.635 46.3328 103.243 43.1156 103.243V104.243V105.243C47.4373 105.243 50.9408 101.74 50.9408 97.4178H49.9408ZM43.1156 104.243V103.243C39.8984 103.243 37.2904 100.635 37.2904 97.4178H36.2904H35.2904C35.2904 101.74 38.7939 105.243 43.1156 105.243V104.243ZM36.2904 97.4178H37.2904C37.2904 94.2006 39.8984 91.5926 43.1156 91.5926V90.5926V89.5926C38.7939 89.5926 35.2904 93.0961 35.2904 97.4178H36.2904ZM43.1156 90.5926V91.5926C46.3328 91.5926 48.9408 94.2006 48.9408 97.4178H49.9408H50.9408C50.9408 93.0961 47.4373 89.5926 43.1156 89.5926V90.5926ZM102.223 203.436C102.223 198.67 100.393 195.828 98.1602 194.181C95.9333 192.538 93.2536 192.047 91.4453 192.103C91.417 192.103 91.3887 192.105 91.3604 192.105L91.3574 192.106H91.3467C86.7777 192.106 83.9699 193.998 82.2881 196.334C80.5881 198.696 80.0166 201.544 80.0166 203.436C80.0166 203.712 79.7927 203.936 79.5166 203.936C79.2405 203.936 79.0166 203.712 79.0166 203.436C79.0166 201.384 79.6277 198.317 81.4766 195.749C82.8933 193.782 85.0246 192.127 88.1084 191.443C85.1706 190.185 83.1114 187.269 83.1113 183.87C83.1113 179.322 86.7986 175.635 91.3467 175.635C95.8949 175.635 99.582 179.322 99.582 183.87C99.582 187.277 97.5131 190.2 94.5635 191.452C95.948 191.789 97.4201 192.393 98.7529 193.376C101.259 195.225 103.223 198.374 103.223 203.436C103.223 203.712 102.999 203.936 102.723 203.936C102.447 203.936 102.223 203.712 102.223 203.436Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M27.4723 188.062L27.7542 187.999L46.3567 183.848C47.5816 190.137 45.6087 196.896 40.5442 201.55C32.7905 208.674 20.7298 208.163 13.6057 200.41C6.59485 192.779 6.97744 180.977 14.3815 173.814L27.4723 188.062ZM23.958 168.802C30.2545 167.568 37.025 169.54 41.6842 174.611C43.9132 177.037 45.3947 179.885 46.1409 182.871L28.0241 186.914L24.015 168.941C24.0038 168.891 23.9823 168.845 23.958 168.802ZM15.1179 173.137C17.4674 171.087 20.1865 169.714 23.03 169.008C23.0259 169.057 23.0275 169.108 23.0389 169.159L26.7505 185.798L15.1179 173.137Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M141.853 190.695V165.215C141.398 157.48 145.13 142.1 163.694 142.464H178.709V164.305C178.709 169.31 175.524 179.32 162.784 179.32H154.139C154.139 179.32 162.532 166.366 170.064 154.74M170.064 154.74C171.818 152.032 173.526 149.397 175.069 147.014L170.064 154.74ZM170.064 154.74L161.874 155.659M170.064 154.74V162.03"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M65.4113 206.621C61.2316 202.708 56.8538 194.217 59.2301 182.505M189.175 34.626L76.7867 153.384C65.945 164.377 60.9066 174.242 59.2301 182.505M59.2301 182.505C57.9536 174.922 51.2149 159.755 34.4705 159.755"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <rect x="26.78" y="120.213" width="34.491" height="29.0309" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="28.6001" y="129.314" width="30.8509" height="19.9306" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="35.8804" y="115.663" width="14.4704" height="4.46016" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )}
    </div>
  );
}

function Fact({ fact, bordered }) {
  const Icon = fact.icon;
  return (
    <div className={`px-5 py-3 ${bordered ? 'border-l border-[#E6ECF5]' : ''}`}>
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#0A1D3D]/40">
        <Icon className="h-3.5 w-3.5" />
        {fact.label}
      </p>
      <p className="truncate text-sm font-semibold text-[#0A1D3D]">{fact.value}</p>
    </div>
  );
}

function JobRow({ job }) {
  return (
    <Link to={`/lowongan/${job.id}`} className="group block px-5 py-4 transition-colors hover:bg-[#E6ECF5]">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_32px] md:items-center">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-[#0A1D3D] group-hover:text-[#357963]">{job.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#0A1D3D]/50">
            {job.location && <span>{job.location}</span>}
            {job.work_mode && <><span className="text-[#0A1D3D]/30">|</span><span>{job.work_mode}</span></>}
          </div>
        </div>
        <span className="w-fit rounded-sm border border-[#E6ECF5] px-2 py-1 text-xs font-semibold text-[#0A1D3D]/60">
          {job.type}
        </span>
        <Bookmark className="hidden h-4 w-4 text-[#0A1D3D]/30 group-hover:text-[#0A1D3D]/50 md:block" />
      </div>
    </Link>
  );
}
