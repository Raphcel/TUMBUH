import React from 'react';
import { Outlet, useLocation, matchPath } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';

export function PublicLayout() {
  const location = useLocation();

  const transparentPaths = ['/', '/perusahaan/:id', '/lowongan/:id', '/panduan'];
  const isTransparent = transparentPaths.some(path =>
    matchPath({ path: path, end: true }, location.pathname)
  );

  return (
    <div className="flex min-h-screen flex-col font-sans text-[#0A1D3D] bg-[#E6ECF5]">
      <Navbar />
      <main className={`flex-1 ${!isTransparent ? 'pt-20' : ''}`}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
