import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { companiesApi } from '../api/companies';
import { companyFollowsApi } from '../api/companyFollows';
import { MapPin, Users, Star, Bookmark, Search, SlidersHorizontal, X } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CompanyLogo } from '../components/ui/CompanyLogo';

export function Perusahaan() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedCompanies, setSavedCompanies] = useState([]);
  const [filterIndustry, setFilterIndustry] = useState('All');
  const [filterLocation, setFilterLocation] = useState('All');
  const [sortBy, setSortBy] = useState('A - Z');

  const industries = [
    { value: 'All', label: t('comp_all_industries') },
    { value: 'Technology', label: t('comp_technology') },
    { value: 'Finance', label: t('comp_finance') },
    { value: 'E-Commerce', label: t('comp_ecommerce') },
    { value: 'Education', label: t('comp_education') },
    { value: 'Consulting', label: t('comp_consulting') },
    { value: 'Others', label: t('comp_others') },
  ];
  const locations = [
    { value: 'All', label: t('comp_all_locations') },
    { value: 'Jakarta', label: 'Jakarta' },
    { value: 'Bandung', label: 'Bandung' },
    { value: 'Surabaya', label: 'Surabaya' },
    { value: 'Yogyakarta', label: 'Yogyakarta' },
    { value: 'Remote', label: 'Remote' },
  ];

  useEffect(() => {
    companiesApi
      .list(0, 100)
      .then((data) => {
        const comps = Array.isArray(data) ? data : data.items || [];
        setCompanies(comps);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user?.role !== 'student') return;

    companyFollowsApi
      .mine()
      .then((data) => {
        const follows = Array.isArray(data) ? data : data.items || [];
        setSavedCompanies(follows.map((follow) => follow.company_id));
      })
      .catch(console.error);
  }, [user]);

  const toggleSaveCompany = async (id) => {
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

    const wasFollowing = savedCompanies.includes(id);
    setSavedCompanies((prev) =>
      wasFollowing ? prev.filter((cid) => cid !== id) : [...prev, id]
    );

    try {
      if (wasFollowing) {
        await companyFollowsApi.unfollow(id);
      } else {
        await companyFollowsApi.follow(id);
      }
    } catch (err) {
      setSavedCompanies((prev) =>
        wasFollowing ? [...prev, id] : prev.filter((cid) => cid !== id)
      );
      addToast({
        type: 'error',
        title: 'Failed',
        message: err.message || 'Could not update company follow.',
      });
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterIndustry('All');
    setFilterLocation('All');
    setSortBy('A - Z');
  };

  const filteredCompanies = companies.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.industry || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchIndustry = filterIndustry === 'All' || (c.industry || '').toLowerCase() === filterIndustry.toLowerCase();
    const matchLocation = filterLocation === 'All' || (c.location || '').includes(filterLocation);
    return matchSearch && matchIndustry && matchLocation;
  });

  const sortedCompanies = [...filteredCompanies].sort((a, b) => {
    if (sortBy === 'A - Z') return a.name.localeCompare(b.name);
    if (sortBy === 'Z - A') return b.name.localeCompare(a.name);
    if (sortBy === 'Rating') return (b.rating || 0) - (a.rating || 0);
    return 0;
  });

  return (
    <div className="min-h-screen bg-[#E6ECF5]">
      <main className="mx-auto w-full max-w-[1480px] px-4 py-4 sm:px-6">
        <section className="mb-4">
          <div className="rounded-md border border-[#E6ECF5] bg-white p-3 shadow-sm">
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(260px,1fr)_220px_220px_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0A1D3D]/40" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t('comp_search_ph', 'Search company or industry')}
                  className="h-10 w-full rounded-md border border-[#E6ECF5] bg-white pl-9 pr-3 text-sm text-[#0A1D3D] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
                />
              </div>

              <select
                value={filterIndustry}
                onChange={(e) => setFilterIndustry(e.target.value)}
                className="h-10 rounded-md border border-[#E6ECF5] bg-white px-3 text-sm text-[#0A1D3D] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
              >
                {industries.map((industry) => (
                  <option key={industry.value} value={industry.value}>{industry.label}</option>
                ))}
              </select>

              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="h-10 rounded-md border border-[#E6ECF5] bg-white px-3 text-sm text-[#0A1D3D] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
              >
                {locations.map((location) => (
                  <option key={location.value} value={location.value}>{location.label}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-[#0A1D3D]/50 transition-colors hover:bg-[#E6ECF5] hover:text-[#0A1D3D]"
              >
                <X className="h-4 w-4" />
                {t('reset')}
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-2 border-t border-[#E6ECF5] pt-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 pr-1 text-xs font-semibold uppercase tracking-wide text-[#0A1D3D]/50">
                  <SlidersHorizontal className="h-4 w-4" />
                  {t('comp_filter')}
                </span>
                {industries.slice(1, 5).map((industry) => (
                  <button
                    key={industry.value}
                    type="button"
                    onClick={() => setFilterIndustry(industry.value)}
                    className={`h-8 rounded-md border px-3 text-xs font-semibold transition-colors ${
                      filterIndustry === industry.value
                        ? 'border-[#357963] bg-[#E6ECF5] text-[#357963]'
                        : 'border-[#E6ECF5] bg-white text-[#0A1D3D]/60 hover:bg-[#E6ECF5]'
                    }`}
                  >
                    {industry.label}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 text-xs text-[#0A1D3D]/50">
                <span className="font-semibold uppercase tracking-wide">{t('sort', 'Sort')}</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-8 rounded-md border border-[#E6ECF5] bg-white px-2 text-xs font-medium text-[#0A1D3D]/80 outline-none"
                >
                  <option>A - Z</option>
                  <option>Z - A</option>
                  <option>Rating</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-md border border-[#E6ECF5] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#E6ECF5] px-4 py-3">
            <h1 className="text-xs font-semibold uppercase tracking-wide text-[#0A1D3D]/50">
              {t('comp_found')} {sortedCompanies.length} {t('comp_companies')}
            </h1>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand" />
            </div>
          ) : sortedCompanies.length > 0 ? (
            <div className="bg-white">
              {sortedCompanies.map((company, index) => (
                <Link
                  key={company.id}
                  to={`/perusahaan/${company.id}`}
                  className={`group flex items-center justify-between px-4 py-3 transition-colors hover:bg-[#E6ECF5] ${
                    index < sortedCompanies.length - 1 ? 'border-b border-[#E6ECF5]/80' : ''
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-[#E6ECF5] bg-white p-1.5">
                      {company.logo
                        ? <img src={company.logo} alt={company.name} className="h-full w-full object-contain" />
                        : <span className="text-sm font-bold text-[#0A1D3D]/40">{company.name?.[0]}</span>
                      }
                    </div>

                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-[#0A1D3D] transition-colors group-hover:text-[#357963]">
                        {company.name}
                      </h2>
                      <p className="mt-0.5 truncate text-[11px] text-[#0A1D3D]/50">{company.industry || t('comp_others')}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#0A1D3D]/50">
                        {company.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {company.location}
                          </span>
                        )}
                        {company.employee_count && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-[#E6ECF5]" />
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" /> {Number(company.employee_count).toLocaleString('en-US')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="ml-4 flex shrink-0 items-center gap-4">
                    {company.rating && (
                      <span className="hidden items-center gap-1 text-xs font-semibold text-amber-500 sm:flex">
                        <Star className="h-3.5 w-3.5" fill="currentColor" /> {company.rating}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); toggleSaveCompany(company.id); }}
                      className={`transition-colors ${savedCompanies.includes(company.id) ? 'text-[#357963]' : 'text-[#0A1D3D]/40 hover:text-[#0A1D3D]/60'}`}
                      aria-label="Follow company"
                    >
                      <Bookmark className="h-4 w-4" fill={savedCompanies.includes(company.id) ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center text-[#0A1D3D]/50">
              <p>{t('comp_no_results')}</p>
              <button
                onClick={clearFilters}
                className="mt-3 text-sm text-brand hover:underline"
              >
                {t('comp_clear_filters')}
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
