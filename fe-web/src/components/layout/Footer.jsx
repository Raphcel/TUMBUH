import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../context/LanguageContext';

export function Footer() {
  const { lang } = useTranslation();
  const copy = lang === 'id'
    ? {
        description: 'Platform karir mahasiswa untuk mempersiapkan masa depan yang lebih cerah.',
        student: 'Mahasiswa',
        findJobs: 'Cari Lowongan',
        careerGuide: 'Panduan Karir',
        companyProfile: 'Profil Perusahaan',
        company: 'Perusahaan',
        partner: 'Daftar Partner',
        recruitment: 'Solusi Rekrutmen',
        contact: 'Hubungi Kami',
        rights: 'Hak cipta dilindungi.',
      }
    : {
        description: 'A student career platform built to help prepare for a stronger professional future.',
        student: 'Students',
        findJobs: 'Find Opportunities',
        careerGuide: 'Career Guide',
        companyProfile: 'Company Profiles',
        company: 'Companies',
        partner: 'Become a Partner',
        recruitment: 'Recruitment Solutions',
        contact: 'Contact Us',
        rights: 'All rights reserved.',
      };

  return (
    <footer className="bg-white border-t border-[#E6ECF5]">
      <div className="mx-auto max-w-7xl overflow-hidden px-6 py-12 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="mb-8 md:mb-0">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <img src="/tumbuh.svg" alt="tumbuh." className="h-8 w-8" />
              <span className="text-xl font-bold text-[#1E3A8A] tracking-tight">
                tumbuh.
              </span>
            </Link>
            <p className="text-[#0A1D3D]/60 text-sm leading-6 max-w-xs">
              {copy.description}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold leading-6 text-[#1E3A8A]">
              {copy.student}
            </h3>
            <ul role="list" className="mt-6 space-y-4">
              <li>
                <Link
                  to="/lowongan"
                  className="text-sm leading-6 text-[#0A1D3D]/60 hover:text-[#1E3A8A]"
                >
                  {copy.findJobs}
                </Link>
              </li>
              <li>
                <Link
                  to="/panduan"
                  className="text-sm leading-6 text-[#0A1D3D]/60 hover:text-[#1E3A8A]"
                >
                  {copy.careerGuide}
                </Link>
              </li>
              <li>
                <Link
                  to="/perusahaan"
                  className="text-sm leading-6 text-[#0A1D3D]/60 hover:text-[#1E3A8A]"
                >
                  {copy.companyProfile}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold leading-6 text-[#1E3A8A]">
              {copy.company}
            </h3>
            <ul role="list" className="mt-6 space-y-4">
              <li>
                <Link
                  to="/register"
                  className="text-sm leading-6 text-[#0A1D3D]/60 hover:text-[#1E3A8A]"
                >
                  {copy.partner}
                </Link>
              </li>
              <li>
                <Link
                  to="/panduan"
                  className="text-sm leading-6 text-[#0A1D3D]/60 hover:text-[#1E3A8A]"
                >
                  {copy.recruitment}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold leading-6 text-[#1E3A8A]">
              {copy.contact}
            </h3>
            <ul role="list" className="mt-6 space-y-4">
              <li className="text-sm leading-6 text-[#0A1D3D]/60">
                support@tumbuh.me
              </li>
              <li className="text-sm leading-6 text-[#0A1D3D]/60">
                IPB University, Bogor
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-[#E6ECF5] pt-8">
          <p className="text-center text-xs leading-5 text-[#0A1D3D]/40">
            &copy; 2026 tumbuh. IPB. {copy.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}
