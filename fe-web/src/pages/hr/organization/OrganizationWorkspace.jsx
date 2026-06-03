import { useMemo, useState } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2,
  CheckCircle2,
  Clock3,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useOrganization } from '../../../hooks/useOrganization';
import { roleLabels } from './constants';
import { MembersSection } from './MembersSection';
import { OnboardingSection } from './OnboardingSection';
import { ProfileSection } from './ProfileSection';
import { StatusPill, WorkspaceCard } from './WorkspaceCard';

const MotionDiv = motion.div;

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'profile', label: 'Profile', icon: Building2 },
  { id: 'members', label: 'Members', icon: Users },
];

function companyInitials(name) {
  return (name || 'T')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function activityLabel(company) {
  if (!company) return 'No workspace yet';
  if (company.status === 'pending') return 'Waiting for approval';
  return 'Live workspace';
}

function OverviewSection({ company, membership, members, canEdit, setTab }) {
  const memberCount = members.filter((member) => member.status === 'active').length;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <WorkspaceCard title="Workspace summary" icon={LayoutDashboard}>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg bg-[#E6ECF5] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-light">Company</p>
            <p className="mt-2 truncate text-lg font-bold text-text">{company?.name || '-'}</p>
          </div>
          <div className="rounded-lg bg-[#E6ECF5] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-light">Your role</p>
            <p className="mt-2 text-lg font-bold text-text">{roleLabels[membership?.role] || '-'}</p>
          </div>
          <div className="rounded-lg bg-[#E6ECF5] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-light">Members</p>
            <p className="mt-2 text-lg font-bold text-text">{memberCount}</p>
          </div>
        </div>
        <div className="mt-5 rounded-lg border border-[#E6ECF5] bg-white p-4">
          <p className="text-sm font-semibold text-text">Next useful actions</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={() => setTab('profile')} className="justify-start gap-2">
              <Building2 size={15} />
              Edit company profile
            </Button>
            <Button type="button" variant="outline" onClick={() => setTab('members')} className="justify-start gap-2">
              <Users size={15} />
              Invite or review members
            </Button>
          </div>
        </div>
      </WorkspaceCard>

      <WorkspaceCard title="Access model" icon={ShieldCheck}>
        <div className="space-y-3 text-sm leading-6 text-text-muted">
          <p>
            {canEdit
              ? 'You can update the public company page and workspace settings.'
              : 'You can view the company workspace. Profile changes require owner or admin access.'}
          </p>
          <p>
            Recruiters can post opportunities under the company. Viewers can inspect the workspace without changing company content.
          </p>
        </div>
      </WorkspaceCard>
    </div>
  );
}

export function OrganizationWorkspace() {
  const { refreshUser } = useAuth();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('section') || 'overview');
  const {
    company,
    membership,
    members,
    permissions,
    onboardingRequired,
    loading,
    refreshOrganization,
    can,
  } = useOrganization();

  const status = useMemo(() => {
    if (!company) return { label: 'No organization', tone: 'neutral', icon: Clock3 };
    if (company.status === 'pending') return { label: 'Pending approval', tone: 'amber', icon: Clock3 };
    return { label: 'Approved', tone: 'green', icon: CheckCircle2 };
  }, [company]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-brand" />
      </div>
    );
  }

  if (tab === 'company') return <Navigate to="/hr/organization?section=profile" replace />;

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-none space-y-6 pb-12"
    >
      <div className="rounded-lg border border-[#E6ECF5] bg-white">
        <div className="border-b border-[#E6ECF5] px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-lg bg-brand text-lg font-bold text-white">
                {companyInitials(company?.name)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-2xl font-bold tracking-tight text-text">
                    {company?.name || 'Organization'}
                  </h1>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                </div>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-text-muted">
                  {company?.description || 'Create or join a company workspace, then manage the company profile, people, permissions, and invites in one place.'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button to="/hr/opportunities" variant="outline" size="sm" className="gap-2">
                <Settings2 size={14} />
                Opportunities
              </Button>
              <Button to={`/perusahaan/${company?.id || ''}`} variant="ghost" size="sm" disabled={!company?.id}>
                Public page
              </Button>
            </div>
          </div>
        </div>

        <div className="grid min-h-[560px] lg:grid-cols-[220px_1fr]">
          <aside className="border-b border-[#E6ECF5] bg-[#E6ECF5]/70 p-3 lg:border-b-0 lg:border-r">
            <div className="mb-3 rounded-lg bg-white p-3 shadow-sm ring-1 ring-[#E6ECF5]">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-light">Workspace</p>
              <p className="mt-1 truncate text-sm font-semibold text-text">{activityLabel(company)}</p>
              <p className="mt-1 text-xs text-text-muted">{roleLabels[membership?.role] || 'No role yet'}</p>
            </div>
            <nav className="flex gap-1 overflow-x-auto lg:block lg:space-y-1">
              {tabs.map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition ${
                      active ? 'bg-white text-brand shadow-sm ring-1 ring-[#E6ECF5]' : 'text-text-muted hover:bg-white hover:text-text'
                    }`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="p-4 sm:p-5">
            {onboardingRequired && (
              <OnboardingSection
                initialToken={searchParams.get('token') || ''}
                onSubmitted={refreshOrganization}
                onJoined={async () => Promise.all([refreshOrganization(), refreshUser()])}
                addToast={addToast}
              />
            )}
            {!onboardingRequired && company?.status === 'pending' && (
              <WorkspaceCard title="Awaiting admin approval" icon={Clock3}>
                <p className="text-sm leading-6 text-text-muted">
                  {company.name} is waiting for platform approval. The owner membership and company page controls activate after approval.
                </p>
              </WorkspaceCard>
            )}
            {!onboardingRequired && company?.status === 'approved' && tab === 'overview' && (
              <OverviewSection
                company={company}
                membership={membership}
                members={members}
                canEdit={can('manage_company_profile')}
                setTab={setTab}
              />
            )}
            {!onboardingRequired && company?.status === 'approved' && tab === 'profile' && (
              <ProfileSection
                company={company}
                canEdit={can('manage_company_profile')}
                addToast={addToast}
                onSaved={refreshOrganization}
              />
            )}
            {!onboardingRequired && company?.status === 'approved' && tab === 'members' && (
              <MembersSection
                members={members}
                permissions={permissions}
                canInvite={can('manage_invites')}
                addToast={addToast}
              />
            )}
          </main>
        </div>
      </div>
    </MotionDiv>
  );
}
