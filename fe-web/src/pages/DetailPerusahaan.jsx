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

            <aside className="flex flex-col justify-between border-t border-white/10 bg-[#357963] p-5 text-white lg:border-l lg:border-t-0">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">Lowongan Tersedia</p>
                <p className="mt-1 text-3xl font-semibold text-white">{companyJobs.length}</p>
              </div>
              {company.rating && (
                <div className="border-t border-white/10 pt-4">
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
            eyebrow="Recruitment"
            title={t('dcomp_open_positions')}
            action={<span className="text-sm font-semibold text-[#357963]">{companyJobs.length} active</span>}
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
            eyebrow="Reviews"
            title={t('dcomp_reviews')}
            action={
              <button
                onClick={handleOpenReviewModal}
                className="rounded-md border border-[#E6ECF5] px-3 py-1.5 text-xs font-semibold text-[#0A1D3D]/80 transition-colors hover:border-[#357963] hover:text-[#357963]"
              >
                Tulis Ulasan
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

function SectionTitle({ eyebrow, title, action }) {
  return (
    <div className="flex items-end justify-between gap-4 px-5 py-4">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#357963]">{eyebrow}</p>}
        <h2 className="text-lg font-semibold text-[#0A1D3D]">{title}</h2>
      </div>
      {action}
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
