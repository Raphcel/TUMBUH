import React, { useState, useEffect } from 'react';
import { Card, CardBody } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Link, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  FileText,
  CheckCircle,
  Clock,
  Plus,
  X,
  Building,
  Calendar,
  BookmarkCheck,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { applicationsApi } from '../../api/applications';
import { externshipsApi } from '../../api/externships';
import { opportunitiesApi } from '../../api/opportunities';
import { companyFollowsApi } from '../../api/companyFollows';
import { CalendarWidget } from '../../components/dashboard/CalendarWidget';
import { CompanyLogo } from '../../components/ui/CompanyLogo';

import { motion } from 'framer-motion';
import { useTranslation } from '../../context/LanguageContext';

const MotionDiv = motion.div;

export function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const [myApplications, setMyApplications] = useState([]);
  const [latestOpportunities, setLatestOpportunities] = useState([]);
  const [followedCompanies, setFollowedCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFollowingModal, setShowFollowingModal] = useState(false);

  const [showExternshipModal, setShowExternshipModal] = useState(false);
  const [externships, setExternships] = useState([]);
  const [newExternship, setNewExternship] = useState({
    title: '',
    company: '',
    duration: '',
    status: 'Ongoing',
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const [appsData, extData, oppsData, followsData] = await Promise.all([
          applicationsApi.mine(),
          externshipsApi.mine(),
          opportunitiesApi.list(0, 3),
          companyFollowsApi.mine(0, 100),
        ]);
        setMyApplications(appsData.items || []);
        setExternships(extData.items || []);
        const opps = Array.isArray(oppsData) ? oppsData : oppsData.items || [];
        setLatestOpportunities(opps.slice(0, 3));
        const follows = Array.isArray(followsData) ? followsData : followsData.items || [];
        setFollowedCompanies(follows.map((follow) => follow.company).filter(Boolean));
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Profile completeness calculation
  const profileFields = [
    user?.first_name, user?.last_name, user?.email, user?.phone,
    user?.nim, user?.major, user?.gpa, user?.bio, user?.cv_url, user?.avatar,
  ];
  const filledCount = profileFields.filter((f) => f != null && f !== '' && f !== 0).length;
  const completeness = Math.round((filledCount / 10) * 100);
  const completenessLabel = completeness === 100 ? t('sdash_complete') : completeness >= 80 ? t('sdash_good') : completeness >= 50 ? t('sdash_fair') : t('sdash_poor');
  const completenessColor = completeness === 100 ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : completeness >= 80 ? 'text-blue-700 bg-[#E6ECF5] border-blue-100' : completeness >= 50 ? 'text-yellow-700 bg-yellow-50 border-yellow-100' : 'text-red-700 bg-red-50 border-red-100';

  const activeApplications = myApplications.filter((app) =>
    ['Applied', 'Interview', 'Screening'].includes(app.status)
  );
  const previewFollowedCompanies = followedCompanies.slice(0, 4);

  const handleAddExternship = async (e) => {
    // ... (keep logic)
    e.preventDefault();
    try {
      const created = await externshipsApi.create({
        title: newExternship.title,
        company: newExternship.company,
        duration: newExternship.duration,
        status: newExternship.status,
      });
      setExternships([...externships, created]);
      setNewExternship({
        title: '',
        company: '',
        duration: '',
        status: 'Ongoing',
      });
      setShowExternshipModal(false);
    } catch (err) {
      console.error('Failed to add externship', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 100 }
    }
  };

  return (
    <MotionDiv
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-[1600px] mx-auto space-y-8 bg-surface-muted min-h-screen pb-20"
    >
      <motion.div variants={itemVariants} className="pb-0 mb-8 border-b border-surface-border pb-6">
        <h1 className="text-3xl font-bold text-text tracking-tight">
          {t('sdash_hello')} {user?.first_name || 'Student'}.
        </h1>
        <p className="text-text-muted mt-2 text-base">
          {t('sdash_overview')}
        </p>
      </motion.div>

      {/* Primary Focus Area - Active Applications & Quick Stats */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Main Stats Block - Restructured for priority */}
        <motion.div variants={itemVariants} className="xl:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <motion.div
            whileHover={{ y: -4, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}
            className="p-5 rounded-xl bg-surface border border-brand-muted shadow-sm relative overflow-hidden group transition-all"
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Briefcase size={80} className="text-brand -mt-4 -mr-4" />
            </div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">
              {t('sdash_active_apps')}
            </p>
            <p className="text-5xl font-bold text-brand mt-4">
              {activeApplications.length}
            </p>
            <p className="text-xs text-text-muted mt-2 pt-2 border-t border-surface-border">
              {t('sdash_require_attn')}
            </p>
          </motion.div>

          <motion.div
            whileHover={{ y: -4, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}
            className="p-5 rounded-xl bg-surface border border-surface-border shadow-sm relative overflow-hidden group transition-all"
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <FileText size={80} className="text-text-muted -mt-4 -mr-4" />
            </div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">
              {t('sdash_total_apps')}
            </p>
            <p className="text-4xl font-bold text-text tracking-tight mt-5">
              {myApplications.length}
            </p>
          </motion.div>

          <motion.div
            whileHover={{ y: -4, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}
            className="p-5 rounded-xl bg-surface border border-surface-border shadow-sm relative overflow-hidden group transition-all"
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <CheckCircle size={80} className="text-emerald-600 -mt-4 -mr-4" />
            </div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">
              {t('sdash_profile_status')}
            </p>
            <div className="flex items-center gap-3 mt-5">
              <span className="text-4xl font-bold text-text tracking-tight">{completeness}%</span>
            </div>
            <p className="text-xs text-text-muted mt-2 pt-2 border-t border-surface-border flex items-center justify-between">
              <span>{t('sdash_completion')}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${completenessColor}`}>
                {completenessLabel}
              </span>
            </p>
          </motion.div>
        </motion.div>

        {/* Lowongan Terbaru */}
        <motion.div variants={itemVariants} className="xl:col-span-1">
          <div className="bg-brand border border-brand-light p-5 rounded-xl min-h-full relative shadow-md flex flex-col overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mt-10 -mr-10 blur-2xl"></div>
            <p className="text-sm text-brand-muted font-medium mb-3 flex items-center gap-2">
              <Briefcase size={16} /> {t('sdash_latest_jobs')}
            </p>
            <div className="space-y-3 mt-2 flex-1">
              {latestOpportunities.map((opp) => (
                <Link
                  key={opp.id}
                  to={`/lowongan/${opp.id}`}
                  className="block text-sm text-white bg-white/5 p-3 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <p className="font-medium">{opp.title}</p>
                  <p className="text-xs text-white/60 mt-1">
                    {opp.company?.name || '-'} &middot; {opp.location}
                  </p>
                </Link>
              ))}
              {latestOpportunities.length === 0 && (
                <p className="text-sm text-white/60">{t('sdash_no_jobs')}</p>
              )}
            </div>
            <Button
              to="/lowongan"
              variant="outline"
              className="mt-4 w-full bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              {t('sdash_see_all')}
            </Button>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Active Applications List (Moved Up for priority) */}
          <motion.div variants={itemVariants} className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-lg font-bold text-text flex items-center gap-2">
                {t('sdash_active_tracker')}
              </h2>
              <Link
                to="/student/applications"
                className="text-sm font-medium text-brand hover:text-brand-light transition-colors"
              >
                {t('sdash_view_all')}
              </Link>
            </div>

            <div className="bg-surface border border-surface-border rounded-xl shadow-sm overflow-hidden">
              <div className="divide-y divide-surface-border">
                {activeApplications.slice(0, 4).map((app, index) => {
                  const job = app.opportunity;
                  return (
                    <motion.div
                      key={app.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ backgroundColor: "rgba(249, 250, 251, 0.5)" }}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 transition-colors gap-4"
                    >
                      <div className="flex items-start gap-4">
                        <CompanyLogo
                          company={job?.company}
                          className="h-10 w-10 rounded-lg border border-surface-border bg-surface-muted p-1.5"
                          fallbackClassName="text-sm font-bold text-brand"
                        />
                        <div>
                          <h3 className="font-semibold text-text group-hover:text-brand transition-colors text-base">{job?.title}</h3>
                          <p className="text-sm text-text-muted mt-0.5 flex items-center gap-1.5">
                            <span>{job?.company?.name}</span>
                            <span className="w-1 h-1 rounded-full bg-surface-border"></span>
                            <span className="flex items-center gap-1"><Clock size={12} /> {new Date(app.applied_at).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { month: 'short', day: 'numeric' })}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:w-auto w-full justify-end">
                        <Badge
                          variant={
                            app.status === 'Rejected'
                              ? 'error'
                              : app.status === 'Accepted'
                                ? 'success'
                                : app.status === 'Interview' ? 'warning' : 'info'
                          }
                        >
                          {app.status}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => navigate(`/lowongan/${app.opportunity_id}`)}
                        >
                          {t('sdash_details')}
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
                {activeApplications.length === 0 && (
                  <div className="p-8 text-center bg-surface-muted/30">
                    <p className="text-text-muted font-medium">{t('sdash_no_active')}</p>
                    <p className="text-sm text-text-light mt-1 mb-4">{t('sdash_no_active_sub')}</p>
                    <Link to="/lowongan">
                      <Button size="sm" variant="primary">{t('sdash_explore_jobs')}</Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Externships / Projects */}
          <motion.div variants={itemVariants} className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-lg font-bold text-text">
                {t('sdash_projects')}
              </h2>
              <button
                onClick={() => setShowExternshipModal(true)}
                className="text-sm flex items-center gap-1.5 text-brand bg-brand-muted/50 hover:bg-brand-muted px-3 py-1.5 rounded-lg font-medium transition-colors border border-brand/5"
              >
                <Plus size={16} /> {t('sdash_add_entry')}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {externships.map((ext, index) => (
                <motion.div
                  key={ext.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1, type: "spring", stiffness: 300, damping: 30 }}
                  whileHover={{ y: -2, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)" }}
                  className="p-5 bg-surface border border-surface-border rounded-xl shadow-sm transition-all"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-text">{ext.title}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${ext.status === 'Ongoing' ? 'bg-[#E6ECF5] text-blue-700 border border-blue-100' : 'bg-[#E6ECF5] text-[#0A1D3D]/60 border border-[#E6ECF5]'}`}>
                      {ext.status}
                    </span>
                  </div>

                  <p className="text-sm text-text-muted flex items-center gap-1.5">
                    <Building size={14} className="text-text-light" /> {ext.company}
                  </p>

                  <div className="mt-4 pt-3 border-t border-surface-border">
                    <span className="text-xs text-text-muted font-medium flex items-center gap-1.5 bg-surface-muted inline-flex px-2 py-1 rounded-md">
                      <Calendar size={12} /> {t('sdash_duration')}: {ext.duration}
                    </span>
                  </div>
                </motion.div>
              ))}
              {externships.length === 0 && (
                <div className="col-span-1 md:col-span-2 p-8 text-center bg-surface border border-surface-border border-dashed rounded-xl">
                  <Briefcase size={32} className="mx-auto text-surface-border mb-3" />
                  <p className="text-sm font-medium text-text-muted">{t('sdash_no_custom')}</p>
                  <p className="text-xs text-text-light mt-1">{t('sdash_no_custom_sub')}</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right Column - Secondary Context */}
        <motion.div variants={itemVariants} className="space-y-8">
          <div className="rounded-xl border border-surface-border bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-text flex items-center gap-2">
                <BookmarkCheck size={18} className="text-brand" />
                {lang === 'id' ? 'Perusahaan Diikuti' : 'Following'}
              </h2>
              <button
                type="button"
                onClick={() => setShowFollowingModal(true)}
                className="text-sm font-medium text-brand hover:text-brand-light transition-colors"
              >
                {t('sdash_view_all')}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {previewFollowedCompanies.map((company) => (
                <Link
                  key={company.id}
                  to={`/perusahaan/${company.id}`}
                  className="flex items-center gap-3 rounded-lg border border-surface-border bg-surface-muted/40 p-3 transition-colors hover:border-brand/30 hover:bg-brand-muted/30"
                >
                  <CompanyLogo
                    company={company}
                    className="h-10 w-10 rounded-lg border border-surface-border bg-white p-1"
                    fallbackClassName="text-text-muted"
                    fallbackIcon={Building}
                    useIconFallback
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text">{company.name}</p>
                    <p className="truncate text-xs text-text-muted">{company.industry || '-'}</p>
                  </div>
                </Link>
              ))}
              {followedCompanies.length === 0 && (
                <div className="rounded-lg border border-dashed border-surface-border bg-surface-muted/30 p-4 text-sm text-text-muted">
                  {lang === 'id' ? 'Belum ada perusahaan yang diikuti.' : 'You are not following any companies yet.'}
                </div>
              )}
              {followedCompanies.length > previewFollowedCompanies.length && (
                <button
                  type="button"
                  onClick={() => setShowFollowingModal(true)}
                  className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm font-medium text-brand transition-colors hover:border-brand/30 hover:bg-brand-muted/30"
                >
                  {lang === 'id'
                    ? `Lihat ${followedCompanies.length - previewFollowedCompanies.length} lainnya`
                    : `View ${followedCompanies.length - previewFollowedCompanies.length} more`}
                </button>
              )}
            </div>
          </div>
          <CalendarWidget applications={myApplications} />
        </motion.div>
      </div>

      {/* Custom Externship Modal */}
      <Modal
        isOpen={showExternshipModal}
        onClose={() => setShowExternshipModal(false)}
        title={t('sdash_add_exp')}
      >
        <form onSubmit={handleAddExternship} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              {t('sdash_role_title')}
            </label>
            <Input
              required
              placeholder="e.g. Freelance Designer"
              value={newExternship.title}
              onChange={(e) =>
                setNewExternship({
                  ...newExternship,
                  title: e.target.value,
                })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              {t('sdash_company_client')}
            </label>
            <Input
              required
              placeholder="e.g. Upwork"
              value={newExternship.company}
              onChange={(e) =>
                setNewExternship({
                  ...newExternship,
                  company: e.target.value,
                })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                {t('sdash_duration')}
              </label>
              <Input
                placeholder="e.g. 3 Months"
                value={newExternship.duration}
                onChange={(e) =>
                  setNewExternship({
                    ...newExternship,
                    duration: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                {t('sdash_status')}
              </label>
              <select
                className="w-full h-10 px-3 py-2 text-sm bg-white border border-[#E6ECF5] rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-[#0A1D3D]"
                value={newExternship.status}
                onChange={(e) =>
                  setNewExternship({
                    ...newExternship,
                    status: e.target.value,
                  })
                }
              >
                <option value="Ongoing">{t('sdash_ongoing')}</option>
                <option value="Completed">{t('sdash_completed')}</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 justify-center"
              onClick={() => setShowExternshipModal(false)}
            >
              {t('sdash_cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1 justify-center"
            >
              {t('sdash_add_entry')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showFollowingModal}
        onClose={() => setShowFollowingModal(false)}
        title={lang === 'id' ? 'Perusahaan Diikuti' : 'Following'}
        size="lg"
      >
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {followedCompanies.map((company) => (
            <Link
              key={company.id}
              to={`/perusahaan/${company.id}`}
              onClick={() => setShowFollowingModal(false)}
              className="flex items-center gap-4 rounded-lg border border-surface-border bg-white p-4 transition-colors hover:border-brand/30 hover:bg-brand-muted/30"
            >
              <CompanyLogo
                company={company}
                className="h-12 w-12 rounded-lg border border-surface-border bg-white p-1.5"
                fallbackClassName="text-text-muted"
                fallbackIcon={Building}
                useIconFallback
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text">{company.name}</p>
                <p className="truncate text-xs text-text-muted">{company.industry || '-'}</p>
                {company.location && (
                  <p className="mt-1 truncate text-xs text-text-light">{company.location}</p>
                )}
              </div>
            </Link>
          ))}
          {followedCompanies.length === 0 && (
            <div className="rounded-lg border border-dashed border-surface-border bg-surface-muted/30 p-6 text-center text-sm text-text-muted">
              {lang === 'id' ? 'Belum ada perusahaan yang diikuti.' : 'You are not following any companies yet.'}
            </div>
          )}
        </div>
      </Modal>
    </MotionDiv>
  );
}
