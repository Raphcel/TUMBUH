import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { companiesApi } from '../api/companies';
import { companyFollowsApi } from '../api/companyFollows';
import { MapPin, Users, Star, ChevronDown, Bookmark } from 'lucide-react';
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

  const [filterIndustry, setFilterIndustry] = useState(t('comp_all_industries'));
  const [filterLocation, setFilterLocation] = useState(t('comp_all_locations'));

  const [sortBy, setSortBy] = useState('A - Z');

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
    if (user?.role !== 'student') {
      return;
    }

    companyFollowsApi
      .mine()
      .then((data) => {
        const follows = Array.isArray(data) ? data : data.items || [];
        setSavedCompanies(follows.map((follow) => follow.company_id));
      })
      .catch(console.error);
  }, [user]);

  const filteredCompanies = companies.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.industry || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchIndustry = filterIndustry === t('comp_all_industries') || c.industry === filterIndustry;
    const matchLocation = filterLocation === t('comp_all_locations') || (c.location || '').includes(filterLocation);
    return matchSearch && matchIndustry && matchLocation;
  });

  const sortedCompanies = [...filteredCompanies].sort((a, b) => {
    if (sortBy === 'A - Z') return a.name.localeCompare(b.name);
    if (sortBy === 'Z - A') return b.name.localeCompare(a.name);
    if (sortBy === 'Rating') return (b.rating || 0) - (a.rating || 0);
    return 0;
  });

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* ── Sidebar Filter ── */}
          <aside className="w-56 shrink-0 hidden md:block">
            <div className="sticky top-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-900">{t('comp_filter')}</h2>
                <button
                  onClick={() => { setFilterIndustry(t('comp_all_industries')); setFilterLocation(t('comp_all_locations')); }}
                  className="text-xs text-gray-400 hover:text-gray-700"
                >
                  ↑
                </button>
              </div>

              {/* Industry filter */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">{t('comp_industry')}</h3>
                </div>
                <ul className="space-y-2">
                  {[t('comp_all_industries'), t('comp_technology'), t('comp_finance'), t('comp_ecommerce'), t('comp_education'), t('comp_consulting'), t('comp_others')].map((ind) => (
                    <li key={ind}>
                      <label className="flex items-center gap-2.5 cursor-pointer group">
                        <input
                          type="radio"
                          name="industry"
                          checked={filterIndustry === ind}
                          onChange={() => setFilterIndustry(ind)}
                          className="w-4 h-4 accent-brand"
                        />
                        <span className={`text-sm ${filterIndustry === ind ? 'text-brand font-medium' : 'text-gray-600 group-hover:text-gray-900'}`}>
                          {ind}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Location filter */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">{t('comp_location')}</h3>
                </div>
                <ul className="space-y-2">
                  {[t('comp_all_locations'), 'Jakarta', 'Bandung', 'Surabaya', 'Yogyakarta', 'Remote'].map((loc) => (
                    <li key={loc}>
                      <label className="flex items-center gap-2.5 cursor-pointer group">
                        <input
                          type="radio"
                          name="location"
                          checked={filterLocation === loc}
                          onChange={() => setFilterLocation(loc)}
                          className="w-4 h-4 accent-brand"
                        />
                        <span className={`text-sm ${filterLocation === loc ? 'text-brand font-medium' : 'text-gray-600 group-hover:text-gray-900'}`}>
                          {loc}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Company size filter placeholder */}
              <div>
                <button className="flex items-center justify-between w-full text-sm font-semibold text-gray-800">
                  {t('comp_company_size')} <ChevronDown size={14} />
                </button>
              </div>
            </div>
          </aside>

          {/* ── Main content ── */}
          <div className="flex-1 min-w-0">
            {/* Results header */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-gray-600">
                {t('comp_found')} <span className="font-semibold text-gray-900">{sortedCompanies.length}</span> {t('comp_companies')}
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  <option>A - Z</option>
                  <option>Z - A</option>
                  <option>Rating</option>
                </select>
              </div>
            </div>

            {/* Company list */}
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
              </div>
            ) : sortedCompanies.length > 0 ? (
              <div className="space-y-3">
                {sortedCompanies.map((company) => (
                  <Link
                    key={company.id}
                    to={`/perusahaan/${company.id}`}
                    className="flex items-center justify-between p-5 border border-gray-200 rounded-xl bg-white hover:border-brand hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      {/* Logo */}
                      <CompanyLogo
                        company={company}
                        className="h-12 w-12 rounded-lg border border-gray-200 bg-white p-2"
                        fallbackClassName="text-lg font-bold text-gray-400"
                      />

                      <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-brand transition-colors">
                          {company.name}
                        </h3>
                        <p className="text-sm text-gray-500 mb-2">{company.industry}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          {company.location && (
                            <span className="flex items-center gap-1">
                              <MapPin size={12} /> {company.location}
                            </span>
                          )}
                          {company.employee_count && (
                            <span className="flex items-center gap-1">
                              <Users size={12} /> {company.employee_count}
                            </span>
                          )}
                          {company.rating && (
                            <span className="flex items-center gap-1 text-yellow-500">
                              <Star size={12} fill="currentColor" /> {company.rating}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 ml-4 flex items-center gap-4">
                      <button
                        onClick={(e) => { e.preventDefault(); toggleSaveCompany(company.id); }}
                        className={`transition-colors z-10 ${savedCompanies.includes(company.id) ? 'text-brand' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        <Bookmark className="w-5 h-5" fill={savedCompanies.includes(company.id) ? 'currentColor' : 'none'} />
                      </button>
                      <svg className="w-5 h-5 text-gray-300 group-hover:text-brand transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M6 18L18 6M18 6H9M18 6v9" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center text-gray-500">
                <p>{t('comp_no_results')}</p>
                <button
                  onClick={() => { setFilterIndustry(t('comp_all_industries')); setFilterLocation(t('comp_all_locations')); setSearchTerm(''); }}
                  className="mt-3 text-brand hover:underline text-sm"
                >
                  {t('comp_clear_filters')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
