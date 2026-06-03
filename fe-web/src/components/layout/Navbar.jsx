import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, matchPath } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Menu, X, Globe } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { UserMenu } from './UserMenu';
import { useTranslation } from '../../context/LanguageContext';

export function Navbar() {
  const [openNav, setOpenNav] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { t, lang, setLang } = useTranslation();

  const NAV_LINKS = [
    { name: t('navbar_opportunities'), path: '/lowongan' },
    { name: t('navbar_companies'), path: '/perusahaan' },
    { name: t('navbar_career_advice'), path: '/panduan' },
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const location = useLocation();
  const { user } = useAuth();

  // Paths where the navbar starts transparent (over dark hero)
  const transparentPaths = ['/'];
  const isTransparent = transparentPaths.some((p) =>
    matchPath({ path: p, end: true }, location.pathname)
  ) && !scrolled && !openNav;

  const isActive = (path) =>
    path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(path);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.4 }}
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isTransparent
          ? 'bg-transparent'
          : 'bg-white border-b border-[#E6ECF5] shadow-sm'
      }`}
    >
      <nav
        className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16"
        aria-label="Global"
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src="/tumbuh.svg" alt="tumbuh." className="w-7 h-7" />
          <span className={`text-xl font-bold tracking-tight transition-colors ${isTransparent ? 'text-white' : 'text-[#0A1D3D]'}`}>
            tumbuh.
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden lg:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.name}
              to={link.path}
              className={`text-sm font-medium transition-colors pb-0.5 border-b-2 ${
                isActive(link.path)
                  ? 'text-[#1E3A8A] border-[#1E3A8A]'
                  : isTransparent
                    ? 'text-white/90 border-transparent hover:text-white'
                    : 'text-[#0A1D3D]/60 border-transparent hover:text-[#0A1D3D]'
              }`}
            >
              {link.name}
            </Link>
          ))}
        </div>

        {/* Auth actions */}
        <div className="hidden lg:flex items-center gap-3">
          {user ? (
            <UserMenu isTransparent={isTransparent} />
          ) : (
            <>
              <button
                onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
                title={t('language')}
                className={`p-2 rounded-md transition-colors flex items-center gap-1 text-sm font-medium ${
                  isTransparent ? 'text-white/80 hover:bg-white/10' : 'text-[#0A1D3D]/60 hover:bg-[#E6ECF5]'
                }`}
              >
                <Globe size={16} />
                <span className="uppercase text-xs font-bold">{lang}</span>
              </button>
              <Link
                to="/login"
                className={`text-sm font-medium px-4 py-2 border rounded-md transition-all ${
                  isTransparent
                    ? 'border-white/50 text-white hover:bg-white/10'
                    : 'border-[#E6ECF5] text-[#0A1D3D] hover:bg-[#E6ECF5]'
                }`}
              >
                {t('navbar_login')}
              </Link>
              <Link
                to="/register"
                className="text-sm font-medium px-4 py-2 bg-[#1E3A8A] hover:bg-[#0A1D3D] text-white rounded-md transition-colors"
              >
                {t('navbar_register')}
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className={`lg:hidden p-2 rounded-md transition-colors ${isTransparent ? 'text-white' : 'text-[#0A1D3D]'}`}
          onClick={() => setOpenNav(!openNav)}
        >
          <span className="sr-only">Buka menu</span>
          {openNav ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {openNav && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden bg-white border-t border-[#E6ECF5] shadow-sm overflow-hidden"
          >
            <div className="px-4 py-4 space-y-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  onClick={() => setOpenNav(false)}
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(link.path)
                      ? 'bg-[#E6ECF5] text-[#1E3A8A] font-semibold'
                      : 'text-[#0A1D3D] hover:bg-[#E6ECF5] hover:text-[#1E3A8A]'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
              <div className="pt-3 border-t border-[#E6ECF5] mt-3 flex flex-col gap-2">
                {user ? (
                  <UserMenu isMobile />
                ) : (
                  <>
                    <Link to="/login" onClick={() => setOpenNav(false)} className="text-center py-2 text-sm font-medium text-[#0A1D3D] border border-[#E6ECF5] rounded-md hover:bg-[#E6ECF5]">
                      {t('navbar_login')}
                    </Link>
                    <Link to="/register" onClick={() => setOpenNav(false)} className="text-center py-2 text-sm font-medium text-white bg-[#1E3A8A] hover:bg-[#0A1D3D] rounded-md">
                      {t('navbar_register')}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
