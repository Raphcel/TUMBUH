import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Link, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { LanguageProvider, useTranslation } from './context/LanguageContext';
import { PublicLayout } from './layouts/PublicLayout';
import { DashboardLayout } from './layouts/DashboardLayout';

// ── Helper: lazy-load a named export ──────────────────────────────────────
const lazyNamed = (factory, name) =>
  lazy(() => factory().then((m) => ({ default: m[name] })));

// ── Public pages ───────────────────────────────────────────────────────────
const Beranda         = lazyNamed(() => import('./pages/Beranda'),           'Beranda');
const Lowongan        = lazyNamed(() => import('./pages/Lowongan'),          'Lowongan');
const DetailLowongan  = lazyNamed(() => import('./pages/DetailLowongan'),    'DetailLowongan');
const ApplyLowongan   = lazyNamed(() => import('./pages/ApplyLowongan'),     'ApplyLowongan');
const Perusahaan      = lazyNamed(() => import('./pages/Perusahaan'),        'Perusahaan');
const DetailPerusahaan = lazyNamed(() => import('./pages/DetailPerusahaan'), 'DetailPerusahaan');
const Panduan         = lazyNamed(() => import('./pages/Panduan'),           'Panduan');
const Login           = lazyNamed(() => import('./pages/Login'),             'Login');
const Register        = lazyNamed(() => import('./pages/Register'),          'Register');
const VerifyEmail     = lazyNamed(() => import('./pages/VerifyEmail'),       'VerifyEmail');
const ResetPassword   = lazyNamed(() => import('./pages/ResetPassword'),     'ResetPassword');
const Notifications   = lazyNamed(() => import('./pages/Notifications'),     'Notifications');
const Calendar        = lazyNamed(() => import('./pages/Calendar'),          'Calendar');

// ── Student pages ──────────────────────────────────────────────────────────
const StudentDashboard = lazyNamed(() => import('./pages/student/Dashboard'), 'StudentDashboard');
const LamaranSaya      = lazyNamed(() => import('./pages/student/LamaranSaya'), 'LamaranSaya');
const Bookmarks        = lazyNamed(() => import('./pages/student/Bookmarks'),   'Bookmarks');
const ProfilStudent    = lazyNamed(() => import('./pages/student/Profil'),       'ProfilStudent');
const StudentSettings  = lazyNamed(() => import('./pages/student/Settings'),     'StudentSettings');
const CVBuilder        = lazyNamed(() => import('./pages/student/CVBuilder'),    'CVBuilder');
const Logbook          = lazyNamed(() => import('./pages/student/Logbook'),      'Logbook');
const LogbookDetail    = lazyNamed(() => import('./pages/student/LogbookDetail'), 'LogbookDetail');

// ── HR pages ───────────────────────────────────────────────────────────────
const HRDashboard        = lazyNamed(() => import('./pages/hr/Dashboard'),         'HRDashboard');
const KelolaLowongan     = lazyNamed(() => import('./pages/hr/KelolaLowongan'),    'KelolaLowongan');
const OpportunityManagement = lazyNamed(() => import('./pages/hr/OpportunityManagement'), 'OpportunityManagement');
const FormLowongan       = lazyNamed(() => import('./pages/hr/FormLowongan'),      'FormLowongan');
const OrganizationPage   = lazyNamed(() => import('./pages/hr/Organization'),      'OrganizationPage');

// ── Admin pages ────────────────────────────────────────────────────────────
const AdminDashboard      = lazyNamed(() => import('./pages/admin/Dashboard'),        'AdminDashboard');
const UserManagement      = lazyNamed(() => import('./pages/admin/UserManagement'),   'UserManagement');
const CompanyManagement   = lazyNamed(() => import('./pages/admin/CompanyManagement'),'CompanyManagement');
const AuditLog            = lazyNamed(() => import('./pages/admin/AuditLog'),         'AuditLog');

// ── Suspense fallback ──────────────────────────────────────────────────────
function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
    </div>
  );
}

function ErrorBoundaryFallback() {
  const { lang } = useTranslation();
  const copy = lang === 'id'
    ? {
        title: 'Terjadi Kesalahan',
        description: 'Maaf, terjadi kesalahan yang tidak terduga. Silakan muat ulang halaman.',
        action: 'Muat Ulang',
      }
    : {
        title: 'Something Went Wrong',
        description: 'An unexpected error occurred. Please reload the page.',
        action: 'Reload',
      };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#E6ECF5] px-4">
      <h1 className="text-4xl font-bold text-[#0A1D3D] mb-4">{copy.title}</h1>
      <p className="text-[#0A1D3D]/60 mb-8 text-center max-w-md">
        {copy.description}
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors"
      >
        {copy.action}
      </button>
    </div>
  );
}

/**
 * ErrorBoundary — catches render errors and shows a fallback UI.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorBoundaryFallback />;
    }
    return this.props.children;
  }
}

/**
 * NotFound — 404 page for unmatched routes.
 */
function NotFound() {
  const { lang } = useTranslation();
  const copy = lang === 'id'
    ? {
        title: 'Halaman Tidak Ditemukan',
        description: 'Halaman yang Anda cari tidak ada atau telah dipindahkan.',
        action: 'Kembali ke Beranda',
      }
    : {
        title: 'Page Not Found',
        description: 'The page you are looking for does not exist or has been moved.',
        action: 'Back to Home',
      };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#E6ECF5] px-4">
      <h1 className="text-7xl font-bold text-brand mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-[#0A1D3D] mb-2">{copy.title}</h2>
      <p className="text-[#0A1D3D]/60 mb-8 text-center max-w-md">
        {copy.description}
      </p>
      <Link
        to="/"
        className="px-6 py-3 bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors"
      >
        {copy.action}
      </Link>
    </div>
  );
}

/**
 * ProtectedRoute — redirects to /login if unauthenticated, or to a
 * role-specific dashboard when the user's role doesn't match.
 */
function ProtectedRoute({ allowedRole, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E3A8A]" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  if (allowedRole && user.role !== allowedRole) {
    const dest = user.role === 'admin' ? '/admin/dashboard' : user.role === 'hr' ? '/hr/dashboard' : '/student/dashboard';
    return <Navigate to={dest} replace />;
  }

  return children;
}

function LegacyApplyRedirect() {
  const { id } = useParams();
  return <Navigate to={`/student/applications/apply/${id}`} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Beranda />} />
        <Route path="/lowongan" element={<Lowongan />} />
        <Route path="/lowongan/:id" element={<DetailLowongan />} />
        <Route path="/perusahaan" element={<Perusahaan />} />
        <Route path="/perusahaan/:id" element={<DetailPerusahaan />} />
        <Route path="/panduan" element={<Panduan />} />
      </Route>

      {/* Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        path="/lowongan/:id/apply"
        element={
          <ProtectedRoute allowedRole="student">
            <LegacyApplyRedirect />
          </ProtectedRoute>
        }
      />

      {/* Shared Protected Routes */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/notifications" element={<Notifications />} />
      </Route>

      {/* Student Routes */}
      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRole="student">
            <DashboardLayout role="student" />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<StudentDashboard />} />
        <Route path="applications" element={<LamaranSaya />} />
        <Route path="applications/apply/:id" element={<ApplyLowongan />} />
        <Route path="bookmarks" element={<Bookmarks />} />
        <Route path="logbook" element={<Logbook />} />
        <Route path="logbook/:logbookId" element={<LogbookDetail />} />
        <Route path="cv-builder" element={<CVBuilder />} />
        <Route path="profile" element={<ProfilStudent />} />
        <Route path="settings" element={<StudentSettings />} />
      </Route>

      {/* HR Routes */}
      <Route
        path="/hr"
        element={
          <ProtectedRoute allowedRole="hr">
            <DashboardLayout role="hr" />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<HRDashboard />} />
        <Route path="organization" element={<OrganizationPage />} />
        <Route path="onboarding" element={<OrganizationPage />} />
        <Route path="join" element={<OrganizationPage />} />
        <Route path="opportunities" element={<KelolaLowongan />} />
        <Route path="lowongan/baru" element={<FormLowongan />} />
        <Route path="opportunities/:id/edit" element={<FormLowongan />} />
        <Route path="opportunities/:id" element={<OpportunityManagement />} />
        <Route path="applicants" element={<Navigate to="/hr/opportunities" replace />} />
        <Route path="company" element={<Navigate to="/hr/organization?section=profile" replace />} />
        <Route path="calendar" element={<Calendar />} />
      </Route>

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRole="admin">
            <DashboardLayout role="admin" />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="companies" element={<CompanyManagement />} />
        <Route path="opportunities" element={<AdminDashboard />} />
        <Route path="audit" element={<AuditLog />} />
      </Route>

      {/* 404 Catch-All */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <LanguageProvider>
      <ErrorBoundary>
        <AuthProvider>
          <ToastProvider>
            <Suspense fallback={<PageSpinner />}>
              <AppRoutes />
            </Suspense>
          </ToastProvider>
        </AuthProvider>
      </ErrorBoundary>
    </LanguageProvider>
  );
}

export default App;
