import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  FileText,
  User,
  Briefcase,
  Users,
  Building,
  Calendar,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  FileBadge2,
  ShieldCheck,
  BookOpen,
  Network,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from '../../context/LanguageContext';

const MotionDiv = motion.div;

export function Sidebar({ role = 'student', isCollapsed, isMobileOpen, toggleSidebar, closeMobile }) {
  const location = useLocation();
  const { t } = useTranslation();

  const studentLinks = [
    { name: t('nav_dashboard'), path: '/student/dashboard', icon: Home },
    { name: t('nav_calendar'), path: '/calendar', icon: Calendar },
    { name: t('nav_my_applications'), path: '/student/applications', icon: FileText },
    { name: t('nav_bookmarks'), path: '/student/bookmarks', icon: Bookmark },
    { name: t('nav_logbook'), path: '/student/logbook', icon: BookOpen },
    { name: t('nav_cv_builder'), path: '/student/cv-builder', icon: FileBadge2 },
    { name: t('nav_profile'), path: '/student/profile', icon: User },
  ];

  const hrLinks = [
    { name: t('nav_dashboard'), path: '/hr/dashboard', icon: Home },
    { name: t('nav_calendar'), path: '/calendar', icon: Calendar },
    { name: t('nav_organization'), path: '/hr/organization', icon: Network },
    { name: t('nav_opportunities'), path: '/hr/opportunities', icon: Briefcase },
  ];
  const adminLinks = [
    { name: t('nav_dashboard'), path: '/admin/dashboard', icon: Home },
    { name: t('nav_users'), path: '/admin/users', icon: Users },
    { name: t('nav_companies'), path: '/admin/companies', icon: Building },
    { name: t('nav_opportunities'), path: '/admin/opportunities', icon: Briefcase },
    { name: t('nav_audit'), path: '/admin/audit', icon: ShieldCheck },
  ];

  const links = role === 'admin' ? adminLinks : role === 'hr' ? hrLinks : studentLinks;

  return (
    <>
      <MotionDiv
        initial={false}
        animate={{
          width: isCollapsed ? 80 : 256,
        }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className={`flex h-screen flex-col border-r border-surface-border bg-surface fixed left-0 top-0 bottom-0 z-50 shadow-sm overflow-hidden transition-transform duration-300 lg:translate-x-0 ${isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full'
          }`}
        style={{ width: isCollapsed ? 80 : 256 }} // Fallback for motion
      >
        <div className="px-4 py-6 flex-1 flex flex-col">
          <div className={`flex items-center pb-2 border-b border-surface-border ${isCollapsed ? 'justify-center' : 'justify-between'} mb-8 px-2 relative h-10`}>
            {!isCollapsed && (
              <Link to="/" className="flex items-center gap-2" onClick={closeMobile}>
                <div className="h-8 w-8 rounded-md bg-brand flex items-center justify-center text-white font-bold text-xl">
                  T
                </div>
                <span className="text-xl font-bold text-text tracking-tight">
                  Tumbuh.
                </span>
              </Link>
            )}
            {isCollapsed && (
              <div className="h-8 w-8 rounded-md bg-brand flex items-center justify-center text-white font-bold text-xl">
                T
              </div>
            )}

            <button
              onClick={toggleSidebar}
              className="hidden lg:flex p-1 rounded-full text-text-muted hover:text-text hover:bg-surface-muted absolute w-6 h-6 border border-surface-border bg-surface shadow-sm items-center justify-center -right-3 top-2 z-50 transition-colors"
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>

          <ul className="mt-2 space-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              const isLinkActive = location.pathname === link.path;
              return (
                <li key={link.path} className="relative">
                  <Link
                    to={link.path}
                    onClick={closeMobile}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative overflow-hidden group ${isLinkActive ? 'text-brand font-medium' : 'text-text-muted hover:text-text'
                      }`}
                    title={isCollapsed ? link.name : ''}
                  >
                    {isLinkActive && (
                      <MotionDiv
                        layoutId="activeTabSidebar"
                        className="absolute inset-0 bg-brand-muted/50 rounded-lg"
                        initial={false}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}

                    <div className="absolute inset-0 bg-surface-muted opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg -z-10" />

                    <div className={`relative z-10 transition-transform duration-200 ${isLinkActive ? 'text-brand' : 'group-hover:scale-105'}`}>
                      <Icon size={18} strokeWidth={isLinkActive ? 2.5 : 2} />
                    </div>

                    {(!isCollapsed || isMobileOpen) && (
                      <span className="whitespace-nowrap z-10 text-sm">
                        {link.name}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </MotionDiv>
    </>
  );
}
