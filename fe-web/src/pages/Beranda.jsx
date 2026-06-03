import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { opportunitiesApi } from '../api/opportunities';
import { companiesApi } from '../api/companies';
import { MapPin, Search, ArrowRight, Briefcase, Globe, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from '../context/LanguageContext';

const POPULAR_TAGS = ['Internship', 'Full-time', 'Remote', 'Data Analyst', 'UI/UX Designer'];

export function Beranda() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    companiesApi.list(0, 100)
      .then((data) => {
        const comps = Array.isArray(data) ? data : data.items || [];
        setCompanies(comps);
      })
      .catch(console.error);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (locationQuery) params.set('location', locationQuery);
    navigate(`/lowongan?${params.toString()}`);
  };

  const CATEGORY_CARDS = [
    {
      label: 'Internship',
      count: t('cat_internship_count'),
      desc: t('cat_internship_desc'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        </svg>
      ),
      color: 'green',
      hoverBorder: 'hover:border-green-200',
      hoverText: 'group-hover:text-green-600',
      iconBg: 'bg-green-50 text-green-600 group-hover:bg-green-100',
      type: 'Internship',
    },
    {
      label: 'Full-time',
      count: t('cat_fulltime_count'),
      desc: t('cat_fulltime_desc'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        </svg>
      ),
      color: 'blue',
      hoverBorder: 'hover:border-blue-200',
      hoverText: 'group-hover:text-blue-600',
      iconBg: 'bg-blue-50 text-blue-600 group-hover:bg-blue-100',
      type: 'Full-time',
    },
    {
      label: 'Remote',
      count: t('cat_remote_count'),
      desc: t('cat_remote_desc'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        </svg>
      ),
      color: 'purple',
      hoverBorder: 'hover:border-purple-200',
      hoverText: 'group-hover:text-purple-600',
      iconBg: 'bg-purple-50 text-purple-600 group-hover:bg-purple-100',
      type: 'Remote',
    },
    {
      label: 'Part-time',
      count: t('cat_parttime_count'),
      desc: t('cat_parttime_desc'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        </svg>
      ),
      color: 'yellow',
      hoverBorder: 'hover:border-yellow-200',
      hoverText: 'group-hover:text-yellow-600',
      iconBg: 'bg-yellow-50 text-yellow-600 group-hover:bg-yellow-100',
      type: 'Part-time',
    },
  ];

  const STATS = [
    { value: '10K+', label: t('stat_companies') },
    { value: '50K+', label: t('stat_opportunities') },
    { value: '200K+', label: t('stat_talent') },
    { value: '98%', label: t('stat_satisfied') },
  ];

  // Duplicate for seamless scroll
  const scrollCompanies = [...companies, ...companies];

  return (
    <>
      {/* ── Hero ── */}
      <section className="bg-[#0b1c2d] text-white relative pt-16 overflow-hidden">
        <div className="max-w-7xl mx-auto pt-25 px-4 sm:px-6 lg:px-8 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center pb-20">
          {/* Left: copy + search */}
          <div className="max-w-2xl">
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="text-5xl md:text-6xl font-bold leading-tight mb-6"
            >
              {t('hero_title_1')}<br />
              <span className="text-blue-400">{t('hero_title_2')}</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="text-lg text-gray-300 mb-8 max-w-lg"
            >
              {t('hero_subtitle')}
            </motion.p>

            {/* Search bar */}
            <motion.form
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              onSubmit={handleSearch}
              className="bg-white rounded-lg p-2 flex flex-col md:flex-row gap-2 shadow-lg mb-6"
            >
              <div className="flex-1 flex items-center border-b md:border-b-0 md:border-r border-gray-200 px-3 py-2">
                <Search className="w-5 h-5 text-gray-400 mr-2 shrink-0" />
                <input
                  type="text"
                  className="w-full text-gray-800 placeholder-gray-400 text-sm bg-transparent focus:outline-none"
                  placeholder={t('hero_search_ph')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex-1 flex items-center px-3 py-2">
                <MapPin className="w-5 h-5 text-gray-400 mr-2 shrink-0" />
                <input
                  type="text"
                  className="w-full text-gray-800 placeholder-gray-400 text-sm bg-transparent focus:outline-none"
                  placeholder={t('hero_location_ph')}
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="bg-brand hover:bg-brand-dark text-white px-8 py-3 rounded-md font-medium transition-colors w-full md:w-auto"
              >
                {t('hero_search_btn')}
              </button>
            </motion.form>

            {/* Popular tags */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.45 }}
              className="flex flex-wrap items-center gap-3 text-sm text-gray-300"
            >
              <span>{t('hero_popular')}</span>
              {POPULAR_TAGS.map((tag) => (
                <Link
                  key={tag}
                  to={`/lowongan?q=${encodeURIComponent(tag)}`}
                  className="px-3 py-1 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </motion.div>
          </div>

          {/* Right: hero image with floating card */}
          <div className="relative hidden lg:block">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl -z-10" />
            <div className="absolute bottom-0 right-32 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl -z-10" />
          </div>
        </div>

        {/* ── Trusted Brands ── */}
        <div className="relative z-10 py-16 bottom-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm text-gray-400 mb-6 font-medium">{t('hero_trusted')}</p>
            {companies.length > 0 ? (
              <div className="flex overflow-hidden">
                <div className="flex space-x-16 animate-scroll">
                  {scrollCompanies.map((company, idx) => (
                    <Link
                      key={`${company.id}-${idx}`}
                      to={`/perusahaan/${company.id}`}
                      className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity min-w-max"
                    >
                      {company.logo ? (
                        <img src={company.logo} alt={company.name} className="h-8 w-auto object-contain brightness-0 invert" />
                      ) : (
                        <span className="text-xl font-bold text-gray-300">{company.name}</span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-60">
                {['gojek', 'tokopedia', 'DANA', 'BCA', 'Ruangguru', 'Telkomsel'].map((name) => (
                  <span key={name} className="text-xl font-bold text-gray-300">{name}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Category Cards ── */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-10">
            <h2 className="text-3xl font-bold text-gray-900">{t('cat_title')}</h2>
            <Link
              to="/lowongan"
              className="text-brand font-medium flex items-center gap-1 hover:underline text-sm"
            >
              {t('cat_see_all')} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {CATEGORY_CARDS.map((cat) => (
              <Link
                key={cat.label}
                to={`/lowongan?type=${encodeURIComponent(cat.type)}`}
                className={`group block p-6 border border-gray-200 rounded-2xl ${cat.hoverBorder} hover:shadow-lg transition-all bg-white relative overflow-hidden`}
              >
                <div className="mb-8">
                  <h3 className={`text-xl font-bold text-gray-900 mb-1 ${cat.hoverText} transition-colors`}>{cat.label}</h3>
                  <p className="text-xs text-gray-500 font-medium mb-3">{cat.count}</p>
                  <p className="text-sm text-gray-600">{cat.desc}</p>
                </div>
                <div className={`absolute bottom-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${cat.iconBg}`}>
                  {cat.icon}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats Footer ── */}
      <footer className="bg-[#0b1c2d] text-white py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-gray-800">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <h4 className="text-3xl font-bold mb-2">{stat.value}</h4>
                <p className="text-gray-400 text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </footer>
    </>
  );
}
