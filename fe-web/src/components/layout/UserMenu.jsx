import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';
import { resolveUploadUrl } from '../../api/client';
import { useCloseOnScroll } from '../../hooks/useCloseOnScroll';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LogOut,
    ChevronDown,
    LayoutDashboard,
    FileText,
    User,
    Briefcase,
    Network,
    Settings,
    Languages,
    Check,
    FileBadge2,
    Users,
    Building,
    ShieldCheck,
} from 'lucide-react';

const MotionButton = motion.button;
const MotionDiv = motion.div;

export function UserMenu({ isTransparent = false, isMobile = false }) {
    const { user, logout } = useAuth();
    const { t, lang, setLang } = useTranslation();
    const navigate = useNavigate();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [showLangMenu, setShowLangMenu] = useState(false);
    useCloseOnScroll(dropdownOpen, () => {
        setDropdownOpen(false);
        setShowLangMenu(false);
    });

    const handleLogout = () => {
        logout();
        navigate('/');
        setDropdownOpen(false);
    };

    const studentLinks = [
        { name: t('nav_dashboard'),        path: '/student/dashboard',    icon: <LayoutDashboard size={16} /> },
        { name: t('nav_my_applications'),  path: '/student/applications', icon: <FileText size={16} /> },
        { name: t('nav_cv_builder'),       path: '/student/cv-builder',   icon: <FileBadge2 size={16} /> },
        { name: t('nav_profile'),          path: '/student/profile',      icon: <User size={16} /> },
    ];

    const hrLinks = [
        { name: t('nav_dashboard'),        path: '/hr/dashboard',    icon: <LayoutDashboard size={16} /> },
        { name: t('nav_opportunities'),    path: '/hr/opportunities', icon: <Briefcase size={16} /> },
        { name: t('nav_organization'),     path: '/hr/organization', icon: <Network size={16} /> },
    ];

    const adminLinks = [
        { name: t('nav_dashboard'),     path: '/admin/dashboard',   icon: <LayoutDashboard size={16} /> },
        { name: t('nav_users'),         path: '/admin/users',       icon: <Users size={16} /> },
        { name: t('nav_companies'),     path: '/admin/companies',   icon: <Building size={16} /> },
        { name: t('nav_opportunities'), path: '/admin/opportunities', icon: <Briefcase size={16} /> },
        { name: t('nav_audit'),         path: '/admin/audit',       icon: <ShieldCheck size={16} /> },
    ];

    const currentLinks =
        user?.role === 'admin' ? adminLinks :
        user?.role === 'hr'    ? hrLinks    :
        studentLinks;

    const LANGS = [
        { code: 'en', label: t('lang_en') },
        { code: 'id', label: t('lang_id') },
    ];

    return (
        <div className="relative">
            <MotionButton
                onClick={() => { setDropdownOpen(!dropdownOpen); setShowLangMenu(false); }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center gap-2 text-sm font-medium transition-colors focus:outline-none p-1.5 rounded-lg ${
                    isTransparent ? 'text-text-inverse hover:bg-white/10' : 'text-text hover:bg-surface-muted'
                } ${isMobile ? 'w-full justify-center mt-4 border border-surface-border' : ''}`}
            >
                <img
                    src={
                        resolveUploadUrl(user?.avatar) ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.first_name || 'User')}&background=0f2854&color=fff`
                    }
                    alt="Avatar"
                    className="h-8 w-8 rounded-full object-cover ring-2 ring-transparent transition-all"
                />
                <div className="text-left hidden md:block">
                    <p className={`text-sm font-semibold leading-tight ${isTransparent ? 'text-white' : 'text-text'}`}>
                        {user?.first_name || 'User'}
                    </p>
                    <p className={`text-[10px] leading-tight capitalize ${isTransparent ? 'text-white/80' : 'text-text-muted'}`}>
                        {user?.role || 'Guest'}
                    </p>
                </div>
                {!isMobile && (
                    <ChevronDown
                        size={16}
                        className={`transition-transform duration-300 ease-[0.22,1,0.36,1] ${dropdownOpen ? 'rotate-180' : ''}`}
                    />
                )}
            </MotionButton>

            <AnimatePresence>
                {dropdownOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => { setDropdownOpen(false); setShowLangMenu(false); }} />
                        <MotionDiv
                            initial={{ opacity: 0, y: 4, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.98 }}
                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                            className={`absolute mt-2 w-64 bg-surface rounded-xl shadow-lg border border-surface-border py-2 z-50 origin-top overflow-hidden ring-1 ring-black/5 ${
                                isMobile ? 'bottom-full mb-2 left-1/2 -translate-x-1/2 origin-bottom' : 'right-0 top-full'
                            }`}
                        >
                            {/* ── User header ── */}
                            <div className="px-4 py-3 border-b border-surface-border bg-surface-muted/50">
                                <p className="text-sm font-bold text-text">
                                    {user?.first_name} {user?.last_name}
                                </p>
                                <p className="text-xs text-text-muted truncate mt-0.5">
                                    {user?.email}
                                </p>
                                <span className="inline-block mt-2 px-2 py-0.5 bg-brand-muted text-brand text-[10px] font-bold uppercase tracking-wider rounded-full">
                                    {user?.role}
                                </span>
                            </div>

                            {/* ── Nav links ── */}
                            <div className="py-1">
                                {currentLinks.map((link) => (
                                    <Link
                                        key={link.path}
                                        to={link.path}
                                        onClick={() => setDropdownOpen(false)}
                                        className="flex items-center gap-3 px-4 py-2 text-sm text-text-muted hover:bg-surface-muted hover:text-brand transition-colors"
                                    >
                                        <span className="text-text-light">{link.icon}</span>
                                        {link.name}
                                    </Link>
                                ))}
                            </div>

                            {/* ── Language toggle ── */}
                            <div className="border-t border-surface-border pt-1">
                                <button
                                    onClick={() => setShowLangMenu(!showLangMenu)}
                                    className="w-full flex items-center justify-between gap-3 px-4 py-2 text-sm text-text-muted hover:bg-surface-muted hover:text-text transition-colors text-left"
                                >
                                    <span className="flex items-center gap-3">
                                        <Languages size={16} className="text-text-light" />
                                        {t('language')}
                                    </span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-surface-muted rounded text-text-light">
                                        {lang.toUpperCase()}
                                    </span>
                                </button>

                                <AnimatePresence>
                                    {showLangMenu && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.18 }}
                                            className="overflow-hidden bg-surface-muted/50"
                                        >
                                            {LANGS.map(({ code, label }) => (
                                                <button
                                                    key={code}
                                                    onClick={() => { setLang(code); setShowLangMenu(false); setDropdownOpen(false); }}
                                                    className="w-full flex items-center justify-between gap-3 pl-10 pr-4 py-2 text-sm text-text-muted hover:bg-surface-muted hover:text-brand transition-colors"
                                                >
                                                    {label}
                                                    {lang === code && <Check size={14} className="text-brand" />}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* ── Settings & Logout ── */}
                            <div className="border-t border-surface-border py-1 mt-1">
                                <Link
                                    to={
                                        user?.role === 'admin' ? '/admin/dashboard' :
                                        user?.role === 'hr'    ? '/hr/organization?section=profile' :
                                        '/student/settings'
                                    }
                                    onClick={() => setDropdownOpen(false)}
                                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-muted hover:bg-surface-muted hover:text-text transition-colors text-left"
                                >
                                    <Settings size={16} className="text-text-light" />
                                    {t('nav_settings')}
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors text-left"
                                >
                                    <LogOut size={16} />
                                    {t('nav_logout')}
                                </button>
                            </div>
                        </MotionDiv>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
