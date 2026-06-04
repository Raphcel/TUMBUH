import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Users, Briefcase, FileText, BarChart3, Building2, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';
import { opportunitiesApi } from '../../api/opportunities';
import { applicationsApi } from '../../api/applications';
import { CalendarWidget } from '../../components/dashboard/CalendarWidget';
import { useOrganization } from '../../hooks/useOrganization';

import { motion } from 'framer-motion';

const MotionDiv = motion.div;

/* ── Status config ──────────────────────────────────────── */
const STATUS_CONFIG = {
  Applied:   { color: '#3B82F6', label: 'Applied' },
  Screening: { color: '#F59E0B', label: 'Screening' },
  Interview: { color: '#8B5CF6', label: 'Interview' },
  Accepted:  { color: '#22C55E', label: 'Accepted' },
  Rejected:  { color: '#EF4444', label: 'Rejected' },
};

const STATUS_ORDER = ['Applied', 'Screening', 'Interview', 'Accepted', 'Rejected'];

/* ── Donut Chart (SVG) ──────────────────────────────────── */
function DonutChart({ data, size = 200 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <div className="text-center">
          <div className="text-4xl font-bold text-[#0A1D3D]/30">0</div>
          <div className="text-sm text-[#0A1D3D]/40 mt-1">No applicants</div>
        </div>
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.38;
  const strokeWidth = size * 0.14;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;
  const segments = data.filter(d => d.value > 0).map((d) => {
    const pct = d.value / total;
    const dashLength = pct * circumference;
    const gap = circumference - dashLength;
    const offset = -cumulativeOffset;
    cumulativeOffset += dashLength;
    return { ...d, pct, dashLength, gap, offset };
  });

  const [hovered, setHovered] = useState(null);
  const activeSegment = hovered !== null ? segments.find(s => s.label === hovered) : null;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background ring */}
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#E6ECF5" strokeWidth={strokeWidth} />
        {/* Data segments */}
        {segments.map((seg, i) => (
          <circle
            key={seg.label}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${seg.dashLength} ${seg.gap}`}
            strokeDashoffset={seg.offset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{
              transition: 'all 0.4s cubic-bezier(.4,0,.2,1)',
              opacity: hovered === null || hovered === seg.label ? 1 : 0.3,
              cursor: 'pointer',
            }}
            onMouseEnter={() => setHovered(seg.label)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>
      {/* Center label */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        style={{ transition: 'all 0.2s ease' }}
      >
        <span className="text-3xl font-bold text-[#0A1D3D]">
          {activeSegment ? activeSegment.value : total}
        </span>
        <span className="text-xs font-medium text-[#0A1D3D]/50 mt-0.5">
          {activeSegment ? activeSegment.label : 'Total'}
        </span>
      </div>
    </div>
  );
}

/* ── Horizontal bar for per-job breakdown ───────────────── */
function JobApplicantBar({ job, statusCounts, maxTotal, index }) {
  const total = STATUS_ORDER.reduce((s, st) => s + (statusCounts[st] || 0), 0);
  const barWidth = maxTotal > 0 ? (total / maxTotal) * 100 : 0;

  return (
    <MotionDiv
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 120 }}
      className="group"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-[#0A1D3D] truncate max-w-[200px]" title={job.title}>
          {job.title}
        </span>
        <span className="text-xs font-semibold text-[#0A1D3D]/60 tabular-nums ml-2 shrink-0">
          {total} applicant{total !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="relative h-7 bg-[#E6ECF5]/70 rounded-lg overflow-hidden">
        {total > 0 ? (
          <div className="absolute inset-y-0 left-0 flex rounded-lg overflow-hidden" style={{ width: `${barWidth}%`, transition: 'width 0.6s cubic-bezier(.4,0,.2,1)' }}>
            {STATUS_ORDER.map((status) => {
              const count = statusCounts[status] || 0;
              if (count === 0) return null;
              const segPct = (count / total) * 100;
              return (
                <div
                  key={status}
                  className="h-full relative group/seg"
                  style={{
                    width: `${segPct}%`,
                    backgroundColor: STATUS_CONFIG[status].color,
                    minWidth: '4px',
                    transition: 'all 0.4s ease',
                  }}
                  title={`${STATUS_CONFIG[status].label}: ${count}`}
                >
                  <div className="opacity-0 group-hover/seg:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-[#0A1D3D] text-white text-[10px] font-medium px-2 py-1 rounded shadow-lg whitespace-nowrap z-10 pointer-events-none transition-opacity">
                    {STATUS_CONFIG[status].label}: {count}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-[#0A1D3D]/30">
            No applicants yet
          </div>
        )}
      </div>
    </MotionDiv>
  );
}

/* ── Pipeline funnel bars ────────────────────────────────── */
function PipelineStage({ status, count, total, index }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const config = STATUS_CONFIG[status];

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.08, type: 'spring', stiffness: 100 }}
      className="flex flex-col items-center gap-2 flex-1 min-w-0"
    >
      {/* Vertical bar */}
      <div className="w-full max-w-[52px] h-28 bg-[#E6ECF5]/60 rounded-xl relative overflow-hidden">
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: `${pct}%` }}
          transition={{ delay: 0.3 + index * 0.1, duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          className="absolute bottom-0 left-0 right-0 rounded-xl"
          style={{ backgroundColor: config.color }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-[#0A1D3D] drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">
            {count}
          </span>
        </div>
      </div>
      {/* Label */}
      <span className="text-[11px] font-medium text-[#0A1D3D]/60 text-center leading-tight">
        {config.label}
      </span>
      {/* Percentage */}
      <span className="text-[10px] font-semibold tabular-nums" style={{ color: config.color }}>
        {pct.toFixed(0)}%
      </span>
    </MotionDiv>
  );
}


/* ════════════════════════════════════════════════════════════
   Main Dashboard
   ════════════════════════════════════════════════════════════ */
export function HRDashboard() {
  const { company, onboardingRequired, loading: organizationLoading } = useOrganization();
  const companyId = company?.status === 'approved' ? company.id : null;
  const [myJobs, setMyJobs] = useState([]);
  const [allApplications, setAllApplications] = useState([]);   // flat list of all apps
  const [jobApplicantMap, setJobApplicantMap] = useState({});    // jobId → apps[]
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (organizationLoading) return;
    if (!companyId) {
      setLoading(false);
      return;
    }
    async function fetchData() {
      try {
        const jobsData = await opportunitiesApi.listByCompany(companyId);
        const jobs = Array.isArray(jobsData) ? jobsData : jobsData.items || [];
        setMyJobs(jobs);

        const flatApps = [];
        const map = {};
        await Promise.all(
          jobs.map(async (job) => {
            try {
              const appsData = await applicationsApi.listByOpportunity(job.id);
              const apps = (appsData.items || []).map(a => ({ ...a, jobTitle: job.title }));
              map[job.id] = apps;
              flatApps.push(...apps);
            } catch (err) {
              console.debug('Failed to load applicants for dashboard job', err);
              map[job.id] = [];
            }
          })
        );
        setAllApplications(flatApps);
        setJobApplicantMap(map);
      } catch (err) {
        console.error('Failed to load dashboard', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [companyId, organizationLoading]);

  /* ── Derived stats ───────────────────────────────────── */
  const statusCounts = useMemo(() => {
    const counts = {};
    STATUS_ORDER.forEach(s => { counts[s] = 0; });
    allApplications.forEach(a => {
      if (counts[a.status] !== undefined) counts[a.status]++;
    });
    return counts;
  }, [allApplications]);

  const totalApplicants = allApplications.length;
  const pendingReview = statusCounts.Applied || 0;
  const acceptedCount = statusCounts.Accepted || 0;
  const rejectedCount = statusCounts.Rejected || 0;

  const donutData = STATUS_ORDER.map(s => ({
    label: STATUS_CONFIG[s].label,
    value: statusCounts[s],
    color: STATUS_CONFIG[s].color,
  }));

  /* Per-job status breakdown */
  const jobBreakdowns = useMemo(() => {
    return myJobs.map(job => {
      const apps = jobApplicantMap[job.id] || [];
      const counts = {};
      STATUS_ORDER.forEach(s => { counts[s] = 0; });
      apps.forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++; });
      return { job, statusCounts: counts, total: apps.length };
    }).sort((a, b) => b.total - a.total);
  }, [myJobs, jobApplicantMap]);

  const maxJobTotal = jobBreakdowns.reduce((m, j) => Math.max(m, j.total), 0);

  /* ── Loading ─────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  /* ── Onboarding required ─────────────────────────────── */
  if (onboardingRequired || !companyId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-lg rounded-2xl border-[#E6ECF5]">
          <CardBody className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-text">Set up your organization</h1>
              <p className="mt-2 text-sm text-text-muted">
                Create a company request or join an existing company before managing recruitment.
              </p>
            </div>
            <Button to="/hr/onboarding" className="w-full">
              Continue
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  /* ── Stats cards ─────────────────────────────────────── */
  const stats = [
    {
      title: 'Total Applicants',
      value: totalApplicants,
      icon: Users,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      title: 'Active Jobs',
      value: myJobs.length,
      icon: Briefcase,
      color: 'text-accent',
      bg: 'bg-accent/10',
    },
    {
      title: 'Pending Review',
      value: pendingReview,
      icon: FileText,
      color: 'text-orange-600',
      bg: 'bg-orange-100',
    },
    {
      title: 'Accepted',
      value: acceptedCount,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      title: 'Rejected',
      value: rejectedCount,
      icon: XCircle,
      color: 'text-red-500',
      bg: 'bg-red-50',
    },
  ];

  /* ── Framer variants ─────────────────────────────────── */
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
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
      className="space-y-8 pb-20"
    >
      {/* ── Header ──────────────────────────────────────── */}
      <MotionDiv variants={itemVariants}>
        <h1 className="text-3xl font-semibold text-primary tracking-tight">
          Recruitment Dashboard
        </h1>
        <p className="text-secondary mt-2">Overview of your hiring pipeline.</p>
      </MotionDiv>

      {/* ── Stat Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat, index) => (
          <MotionDiv
            key={index}
            variants={itemVariants}
            whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}
          >
            <Card className="border-[#E6ECF5] shadow-sm transition-all h-full">
              <CardBody className="flex items-center gap-3 p-4 lg:p-5">
                <div className={`p-2.5 rounded-xl ${stat.bg} shrink-0`}>
                  <stat.icon size={20} className={stat.color} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-secondary truncate">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold text-primary mt-0.5">
                    {stat.value}
                  </p>
                </div>
              </CardBody>
            </Card>
          </MotionDiv>
        ))}
      </div>

      {/* ── Charts Row ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">

          {/* Recruitment Pipeline + Donut */}
          <MotionDiv variants={itemVariants} className="space-y-4">
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              <BarChart3 size={20} /> Recruitment Pipeline
            </h2>
            <Card className="border-[#E6ECF5] shadow-sm">
              <CardBody className="p-6">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  {/* Donut */}
                  <div className="shrink-0">
                    <DonutChart data={donutData} size={180} />
                  </div>
                  {/* Pipeline bars */}
                  <div className="flex-1 w-full">
                    <div className="flex items-end gap-3 justify-between">
                      {STATUS_ORDER.map((status, i) => (
                        <PipelineStage
                          key={status}
                          status={status}
                          count={statusCounts[status]}
                          total={totalApplicants}
                          index={i}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-[#E6ECF5]">
                  {STATUS_ORDER.map(s => (
                    <div key={s} className="flex items-center gap-1.5 text-xs text-[#0A1D3D]/60">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_CONFIG[s].color }} />
                      {STATUS_CONFIG[s].label}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </MotionDiv>

          {/* Per-Job Applicant Breakdown */}
          <MotionDiv variants={itemVariants} className="space-y-4">
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              <TrendingUp size={20} /> Applicants per Position
            </h2>
            <Card className="border-[#E6ECF5] shadow-sm">
              <CardBody className="p-6 space-y-4">
                {jobBreakdowns.length > 0 ? (
                  jobBreakdowns.map((item, i) => (
                    <JobApplicantBar
                      key={item.job.id}
                      job={item.job}
                      statusCounts={item.statusCounts}
                      maxTotal={maxJobTotal}
                      index={i}
                    />
                  ))
                ) : (
                  <div className="text-center py-8 text-[#0A1D3D]/40 text-sm">
                    No job postings yet. Create your first job to start tracking applicants.
                  </div>
                )}
              </CardBody>
            </Card>
          </MotionDiv>

          {/* Recent Jobs */}
          <MotionDiv variants={itemVariants} className="space-y-4">
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              <Briefcase size={20} /> Recent Jobs
            </h2>
            <div className="space-y-3">
              {myJobs.slice(0, 3).map((job) => (
                <MotionDiv
                  key={job.id}
                  whileHover={{ scale: 1.01 }}
                  className="group"
                >
                  <Card className="border-[#E6ECF5] group-hover:border-primary/30 transition-colors">
                    <CardBody className="p-4 flex justify-between items-center">
                      <div>
                        <h3 className="font-medium text-primary">{job.title}</h3>
                        <p className="text-xs text-secondary mt-1">
                          {job.location} • {job.type}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${job.is_active !== false ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {job.is_active !== false ? 'Aktif' : 'Ditutup'}
                      </span>
                    </CardBody>
                  </Card>
                </MotionDiv>
              ))}
            </div>
          </MotionDiv>
        </div>

        {/* Sidebar — Calendar */}
        <MotionDiv variants={itemVariants} className="space-y-6">
          <CalendarWidget opportunities={myJobs} />
        </MotionDiv>
      </div>
    </MotionDiv>
  );
}
