import { useMemo, useState } from 'react';
import { Copy, MailPlus, ShieldCheck, Users, UserPlus } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input, Select } from '../../../components/ui/Input';
import { organizationsApi } from '../../../api/organizations';
import { permissionLabels, roleLabels, roleOptions } from './constants';
import { StatusPill, WorkspaceCard } from './WorkspaceCard';

function fullName(user) {
  if (!user) return 'Unknown member';
  return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
}

function initials(user) {
  return fullName(user)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function MembersSection({ members, permissions, canInvite, addToast }) {
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'recruiter' });
  const [invite, setInvite] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const activeMembers = useMemo(
    () => members.filter((member) => member.status === 'active'),
    [members],
  );

  const pendingMembers = useMemo(
    () => members.filter((member) => member.status === 'pending'),
    [members],
  );

  const createInvite = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const data = await organizationsApi.createInvite({
        email: inviteForm.email.trim() || null,
        role: inviteForm.role,
      });
      setInvite(data);
      addToast({ type: 'success', title: 'Invite ready', message: 'Invite link created.' });
    } catch (err) {
      addToast({ type: 'error', title: 'Failed', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const copyInvite = async () => {
    const value = invite?.invite_url || invite?.token;
    if (!value) return;
    await navigator.clipboard.writeText(value);
    addToast({ type: 'success', title: 'Copied', message: 'Invite copied.' });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <WorkspaceCard
        title="Members"
        eyebrow={`${activeMembers.length} active${pendingMembers.length ? `, ${pendingMembers.length} pending` : ''}`}
        icon={Users}
      >
        <div className="overflow-hidden rounded-lg border border-[#E6ECF5]">
          <div className="grid grid-cols-[1.2fr_140px_120px] gap-3 bg-[#E6ECF5] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-text-light">
            <span>Person</span>
            <span>Role</span>
            <span>Status</span>
          </div>
          <div className="divide-y divide-[#E6ECF5]">
            {members.map((member) => (
              <div key={member.id || member.user_id} className="grid grid-cols-[1.2fr_140px_120px] items-center gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand/10 text-xs font-bold text-brand">
                    {initials(member.user)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text">{fullName(member.user)}</p>
                    <p className="truncate text-xs text-text-muted">{member.user?.email || '-'}</p>
                  </div>
                </div>
                <span className="text-sm font-medium text-text">{roleLabels[member.role] || member.role}</span>
                <StatusPill tone={member.status === 'active' ? 'green' : 'amber'}>{member.status}</StatusPill>
              </div>
            ))}
            {members.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-text-muted">
                No members are visible yet.
              </div>
            )}
          </div>
        </div>
      </WorkspaceCard>

      <div className="space-y-5">
        <WorkspaceCard title="Invite people" icon={MailPlus}>
          {canInvite ? (
            <form className="space-y-3" onSubmit={createInvite}>
              <Input
                label="Email"
                value={inviteForm.email}
                onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="name@company.com"
              />
              <Select
                label="Role"
                value={inviteForm.role}
                onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value }))}
                options={roleOptions}
              />
              <Button type="submit" disabled={submitting} className="w-full gap-2">
                <UserPlus size={16} />
                {submitting ? 'Creating...' : 'Create invite'}
              </Button>
            </form>
          ) : (
            <p className="text-sm leading-6 text-text-muted">
              Owner or admin access is required to invite people.
            </p>
          )}
          {invite && (
            <div className="mt-4 space-y-3 rounded-lg border border-[#E6ECF5] bg-[#E6ECF5] p-3">
              <code className="block break-all text-xs text-text">{invite.invite_url || invite.token}</code>
              <Button type="button" variant="outline" size="sm" onClick={copyInvite} className="w-full gap-2">
                <Copy size={14} />
                Copy invite
              </Button>
            </div>
          )}
        </WorkspaceCard>

        <WorkspaceCard title="Your permissions" icon={ShieldCheck}>
          <div className="flex flex-wrap gap-2">
            {permissions.length > 0 ? permissions.map((permission) => (
              <StatusPill key={permission} tone="brand">
                {permissionLabels[permission] || permission}
              </StatusPill>
            )) : (
              <p className="text-sm leading-6 text-text-muted">
                This role can view the organization but cannot make workspace changes.
              </p>
            )}
          </div>
        </WorkspaceCard>
      </div>
    </div>
  );
}
