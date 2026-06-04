import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { motion } from 'framer-motion';

import { useAuth } from '../context/AuthContext';

import { TopLayout } from '../components/layout/TopLayout';

export function DashboardLayout({ role }) {
  const { user } = useAuth();
  const location = useLocation();
  const activeRole = role || user?.role || 'student';
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-surface-muted font-sans text-text">
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <Sidebar
        role={activeRole}
        isCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen}
        toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        closeMobile={() => setIsMobileMenuOpen(false)}
      />

      <motion.main
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ease-[0.22,1,0.36,1] w-full lg:w-auto ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
          }`}
      >
        <TopLayout onMenuClick={() => setIsMobileMenuOpen(true)} />
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
          <Outlet />
        </div>
      </motion.main>
    </div>
  );
}
