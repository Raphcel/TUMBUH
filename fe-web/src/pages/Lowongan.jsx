import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { opportunitiesApi } from '../api/opportunities';
import { bookmarksApi } from '../api/bookmarks';
import { useAuth } from '../context/AuthContext';
import { MapPin, Bookmark, Search, ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import { DetailLowongan } from './DetailLowongan';
import { useTranslation } from '../context/LanguageContext';
import { CompanyLogo } from '../components/ui/CompanyLogo';

const PAGE_SIZE = 12;
const JOB_TYPES = ['All', 'Internship', 'Full-time', 'Scholarship'];
const SORT_OPTIONS = [
  { value: 'latest', label: 'Latest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'deadline', label: 'Deadline soon' },
];
const INDONESIA_PROVINCES = [
  'Aceh',
  'Bali',
  'Banten',
  'Bengkulu',
  'DI Yogyakarta',
  'DKI Jakarta',
  'Gorontalo',
  'Jambi',
  'Jawa Barat',
  'Jawa Tengah',
  'Jawa Timur',
  'Kalimantan Barat',
  'Kalimantan Selatan',
  'Kalimantan Tengah',
  'Kalimantan Timur',
  'Kalimantan Utara',
  'Kepulauan Bangka Belitung',
  'Kepulauan Riau',
  'Lampung',
  'Maluku',
  'Maluku Utara',
  'Nusa Tenggara Barat',
  'Nusa Tenggara Timur',
  'Papua',
  'Papua Barat',
  'Papua Barat Daya',
  'Papua Pegunungan',
  'Papua Selatan',
  'Papua Tengah',
  'Riau',
  'Sulawesi Barat',
  'Sulawesi Selatan',
  'Sulawesi Tengah',
  'Sulawesi Tenggara',
  'Sulawesi Utara',
  'Sumatera Barat',
  'Sumatera Selatan',
  'Sumatera Utara',
];

export function Lowongan() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  const [savedJobs, setSavedJobs] = useState([]);

  const [filterType, setFilterType] = useState(searchParams.get('type') || 'All');
  const [filterLocation, setFilterLocation] = useState(searchParams.get('location') || 'All');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'latest');

  const [filterCompanyId, setFilterCompanyId] = useState(() => {
    const cid = searchParams.get('companyId');
    return cid ? parseInt(cid, 10) : null;
  });
  const [filterCompanyName, setFilterCompanyName] = useState(searchParams.get('companyName') || '');

  const [page, setPage] = useState(0);
  const [allOpportunities, setAllOpportunities] = useState([]);
  const [totalOpportunities, setTotalOpportunities] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState(() => {
    const jid = searchParams.get('jobId');
    return jid ? parseInt(jid, 10) : null;
  });
  const [currentTimeMs] = useState(() => Date.now());

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const params = {};
    if (searchTerm) params.q = searchTerm;
    if (filterType !== 'All') params.type = filterType;
    if (filterLocation !== 'All') params.location = filterLocation;
    if (sortBy !== 'latest') params.sort = sortBy;
    if (filterCompanyId) {
      params.companyId = filterCompanyId;
      if (filterCompanyName) params.companyName = filterCompanyName;
    }
    const jobIdFromUrl = searchParams.get('jobId');
    if (jobIdFromUrl) params.jobId = jobIdFromUrl;
    setSearchParams(params, { replace: true });
  }, [searchTerm, filterType, filterLocation, sortBy, filterCompanyId, filterCompanyName, setSearchParams, searchParams]);

  useEffect(() => {
    setLoading(true);
    opportunitiesApi
      .list(page * PAGE_SIZE, PAGE_SIZE, {
        search: debouncedSearch || undefined,
        type: filterType !== 'All' ? filterType : undefined,
        location: filterLocation !== 'All' ? filterLocation : undefined,
        sort: sortBy,
        company_id: filterCompanyId || undefined,
      })
      .then((oppData) => {
        const opps = Array.isArray(oppData) ? oppData : oppData.items || [];
        const total = oppData.total ?? opps.length;
        setAllOpportunities(opps);
        setTotalOpportunities(total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [debouncedSearch, filterType, filterLocation, sortBy, filterCompanyId, page]);

  // Auto-select first job
  useEffect(() => {
    setSelectedJobId((current) => {
      if (allOpportunities.length > 0) {
        if (!current || !allOpportunities.find(j => j.id === current)) {
          return allOpportunities[0].id;
        }
        return current;
      }
      return null;
    });
  }, [allOpportunities]);

  useEffect(() => { setPage(0); }, [debouncedSearch, filterType, filterLocation, sortBy, filterCompanyId]);

  useEffect(() => {
    if (!user || user.role !== 'student') return;
    bookmarksApi.mine()
      .then((bks) => {
        const ids = (Array.isArray(bks) ? bks : bks.items || []).map((b) => b.opportunity_id ?? b.id);
        setSavedJobs(ids);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    function handleBookmarkChange(event) {
      const { opportunityId, bookmarked } = event.detail || {};
      if (!opportunityId) return;
      setSavedJobs((current) => {
        if (bookmarked) {
          return current.includes(opportunityId) ? current : [...current, opportunityId];
        }
        return current.filter((id) => id !== opportunityId);
      });
    }

    window.addEventListener('opportunity-bookmark-change', handleBookmarkChange);
    return () => window.removeEventListener('opportunity-bookmark-change', handleBookmarkChange);
  }, []);

  const totalPages = Math.ceil(totalOpportunities / PAGE_SIZE);

  const toggleSave = async (id) => {
    if (!user || user.role !== 'student') return;
    try {
      if (savedJobs.includes(id)) {
        await bookmarksApi.remove(id);
        setSavedJobs(savedJobs.filter((jid) => jid !== id));
      } else {
        await bookmarksApi.add(id);
        setSavedJobs([...savedJobs, id]);
      }
    } catch (err) {
      console.error('Bookmark error', err);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setDebouncedSearch(searchTerm);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterType('All');
    setFilterLocation('All');
    setSortBy('latest');
    setFilterCompanyId(null);
    setFilterCompanyName('');
    setSelectedJobId(null);
  };

  // Is a listing "new" (posted within 7 days)?
  const isNew = (job) => {
    if (!job.created_at) return false;
    const diff = (currentTimeMs - new Date(job.created_at)) / 86400000;
    return diff <= 7;
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = currentTimeMs - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days <= 0) return t('low_today', 'Today');
    return `${days}d ago`;
  };

  return (
    <div className="min-h-screen bg-[#E6ECF5] flex flex-col">
      <main className="max-w-[1480px] w-full mx-auto px-4 sm:px-6 py-4 flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Search + Filters */}
        <section className="mb-4 flex-none">
          <form
            onSubmit={handleSearch}
            className="rounded-md border border-[#E6ECF5] bg-white p-3 shadow-sm"
          >
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(260px,1fr)_220px_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0A1D3D]/40" />
                <input
                  className="h-10 w-full rounded-md border border-[#E6ECF5] bg-white pl-9 pr-3 text-sm text-[#0A1D3D] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
                  placeholder={t('low_search_ph')}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0A1D3D]/40" />
                <select
                  className="h-10 w-full appearance-none rounded-md border border-[#E6ECF5] bg-white pl-9 pr-3 text-sm text-[#0A1D3D] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                >
                  <option value="All">{t('low_location_ph')}</option>
                  {INDONESIA_PROVINCES.map((province) => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#58C855] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#45a843]"
              >
                <Search className="h-4 w-4" />
                {t('low_search_btn')}
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-2 border-t border-[#E6ECF5] pt-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 pr-1 text-xs font-semibold uppercase tracking-wide text-[#0A1D3D]/50">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filter
                </span>
                {JOB_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFilterType(type)}
                    className={`h-8 rounded-md border px-3 text-xs font-semibold transition-colors ${
                      filterType === type
                        ? 'border-[#357963] bg-[#E6ECF5] text-[#357963]'
                        : 'border-[#E6ECF5] bg-white text-[#0A1D3D]/60 hover:bg-[#E6ECF5]'
                    }`}
                  >
                    {type === 'All' ? t('low_type_all') : type}
                  </button>
                ))}
                {filterCompanyId && (
                  <div className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#357963]/30 bg-[#E6ECF5] pl-3 pr-2 text-xs font-semibold text-[#357963]">
                    <span>{filterCompanyName || t('navbar_companies')}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterCompanyId(null);
                        setFilterCompanyName('');
                      }}
                      className="rounded-full p-0.5 hover:bg-[#357963]/10 text-[#357963] transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-8 items-center gap-2 self-start rounded-md px-2.5 text-xs font-semibold text-[#0A1D3D]/50 transition-colors hover:bg-[#E6ECF5] hover:text-[#0A1D3D] lg:self-auto"
              >
                <X className="h-4 w-4" />
                {t('reset')}
              </button>
            </div>
          </form>
        </section>

        {/* Master-Detail Layout */}
        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 overflow-hidden">
          {/* Left: Job listings */}
          <div className="w-full lg:w-[44%] flex flex-col min-h-0 border border-[#E6ECF5] rounded-md bg-white overflow-hidden shadow-sm">
            {/* Results info */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E6ECF5] flex-none bg-white">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[#0A1D3D]/50">
                {loading ? t('loading') : `${t('low_found')} ${totalOpportunities} ${t('low_opportunities')}`}
              </h2>
              <label className="flex items-center gap-2 text-xs text-[#0A1D3D]/50">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-8 rounded-md border border-[#E6ECF5] bg-white px-2 text-xs font-medium text-[#0A1D3D]/80 outline-none"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Job listings */}
            <div className="overflow-y-auto flex-1 custom-scrollbar bg-white">
              {loading ? (
                <div className="flex justify-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
                </div>
              ) : allOpportunities.length > 0 ? (
                allOpportunities.map((job, index) => (
                  <article
                    key={job.id}
                    onClick={() => setSelectedJobId(job.id)}
                    className={`relative px-4 py-2.5 transition-colors cursor-pointer ${
                      index < allOpportunities.length - 1 ? 'border-b border-[#E6ECF5]/80' : ''
                    } ${
                      selectedJobId === job.id
                        ? 'bg-[#edf6f1] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-1px_0_rgba(23,77,54,0.06)]'
                        : 'hover:bg-[#E6ECF5]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <CompanyLogo
                        company={job.company}
                        className="h-9 w-9 rounded-sm border border-[#E6ECF5] bg-white p-1.5"
                        fallbackClassName="text-sm font-bold text-[#0A1D3D]/40"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className={`text-[13px] font-semibold truncate pr-2 transition-colors ${
                            selectedJobId === job.id ? 'text-[#357963]' : 'text-[#0A1D3D] hover:text-[#357963]'
                          }`}>
                            {job.title}
                          </h3>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleSave(job.id); }}
                            className={`shrink-0 transition-colors z-10 ${savedJobs.includes(job.id) ? 'text-[#357963]' : 'text-[#0A1D3D]/40 hover:text-[#0A1D3D]/60'}`}
                          >
                            <Bookmark className="w-4 h-4" fill={savedJobs.includes(job.id) ? 'currentColor' : 'none'} />
                          </button>
                        </div>
                        <p className={`text-[11px] mt-0.5 truncate ${
                          selectedJobId === job.id ? 'font-medium text-[#0A1D3D]/80' : 'text-[#0A1D3D]/50'
                        }`}>{job.company?.name}</p>
                        <div className="mt-1.5 flex items-end justify-between gap-3 text-[11px] text-[#0A1D3D]/50">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            {isNew(job) && (
                              <span className="bg-[#E6ECF5] text-[#357963] border border-[#357963]/15 font-semibold px-2 py-0.5 rounded-sm">
                                {t('new_badge')}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> <span className="truncate max-w-[100px]">{job.location}</span>
                            </span>
                            {job.work_mode && (
                              <><span className="w-1 h-1 bg-[#E6ECF5] rounded-full" /><span>{job.work_mode}</span></>
                            )}
                            <span className="w-1 h-1 bg-[#E6ECF5] rounded-full" />
                            <span>{job.type}</span>
                          </div>
                          <span className="shrink-0 font-medium text-[#0A1D3D]/40">{timeAgo(job.posted_at || job.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="py-20 text-center text-[#0A1D3D]/50">
                  <p>{t('low_no_results')}</p>
                  <button
                    onClick={clearFilters}
                    className="mt-3 text-brand hover:underline text-sm"
                  >
                    {t('low_clear_filters')}
                  </button>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-[#E6ECF5] flex justify-center items-center gap-1.5 flex-none bg-white">
                <button
                  className="w-8 h-8 flex items-center justify-center rounded-md border border-[#E6ECF5] text-[#0A1D3D]/40 hover:bg-[#E6ECF5] transition-colors disabled:opacity-40"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i).map((i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`w-8 h-8 flex items-center justify-center rounded-md font-semibold text-xs transition-colors ${
                      page === i ? 'bg-[#1f2937] text-white' : 'hover:bg-[#E6ECF5] text-[#0A1D3D]/80'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                {totalPages > 5 && <span className="text-[#0A1D3D]/40 px-1">...</span>}
                {totalPages > 5 && (
                  <button
                    onClick={() => setPage(totalPages - 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#E6ECF5] text-[#0A1D3D]/80 font-semibold text-xs transition-colors"
                  >
                    {totalPages}
                  </button>
                )}
                <button
                  className="w-8 h-8 flex items-center justify-center rounded-md border border-[#E6ECF5] text-[#0A1D3D]/60 hover:bg-[#E6ECF5] transition-colors disabled:opacity-40"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Right: Job detail pane */}
          <div className="hidden lg:flex lg:w-[56%] bg-white border border-[#E6ECF5] rounded-md overflow-hidden min-h-0 relative flex-col shadow-sm">
            {selectedJobId ? (
              <DetailLowongan jobId={selectedJobId} isEmbedded={true} />
            ) : (
              <div className="flex items-center justify-center h-full flex-1 text-[#0A1D3D]/50 flex-col gap-4">
                <Search className="w-12 h-12 text-[#0A1D3D]/30" />
                <p>{t('low_select_detail')}</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
