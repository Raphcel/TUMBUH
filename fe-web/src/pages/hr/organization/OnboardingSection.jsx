import { useEffect, useState } from 'react';
import { Building2, KeyRound, Send, UserPlus } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { organizationsApi } from '../../../api/organizations';
import { WorkspaceCard } from './WorkspaceCard';

const emptyCompanyForm = {
  name: '',
  industry: '',
  location: '',
  website: '',
  description: '',
};

export function OnboardingSection({ initialToken, onJoined, onSubmitted, addToast }) {
  const [companyForm, setCompanyForm] = useState(emptyCompanyForm);
  const [joinCode, setJoinCode] = useState(initialToken || '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialToken) setJoinCode(initialToken);
  }, [initialToken]);

  const handleCompanyChange = (field) => (event) => {
    setCompanyForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const submitCompanyRequest = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await organizationsApi.createCompanyRequest(companyForm);
      await onSubmitted();
      addToast({ type: 'success', title: 'Submitted', message: 'Company request sent to admin.' });
    } catch (err) {
      addToast({ type: 'error', title: 'Failed', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const acceptInvite = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await organizationsApi.acceptInvite(joinCode.trim());
      await onJoined();
      addToast({ type: 'success', title: 'Joined', message: 'Organization joined successfully.' });
    } catch (err) {
      addToast({ type: 'error', title: 'Failed', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <WorkspaceCard icon={Building2} title="Create a company" eyebrow="Admin approval required">
        <form className="space-y-4" onSubmit={submitCompanyRequest}>
          <Input label="Company name" value={companyForm.name} onChange={handleCompanyChange('name')} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Industry" value={companyForm.industry} onChange={handleCompanyChange('industry')} required />
            <Input label="Location" value={companyForm.location} onChange={handleCompanyChange('location')} required />
          </div>
          <Input label="Website" value={companyForm.website} onChange={handleCompanyChange('website')} />
          <textarea
            value={companyForm.description}
            onChange={handleCompanyChange('description')}
            placeholder="What does this company do?"
            className="min-h-28 w-full rounded-lg border border-[#E6ECF5] px-3 py-2 text-sm shadow-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <Button type="submit" disabled={submitting} className="w-full gap-2">
            <Send size={16} />
            Submit for approval
          </Button>
        </form>
      </WorkspaceCard>

      <WorkspaceCard icon={KeyRound} title="Join a company" eyebrow="Invite code">
        <form className="space-y-4" onSubmit={acceptInvite}>
          <p className="text-sm leading-6 text-text-muted">
            Paste an invite code or open an invite link to join an existing company workspace.
          </p>
          <Input
            label="Invite code"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
            placeholder="Paste invite code or link token"
            required
          />
          <Button type="submit" disabled={submitting} className="w-full gap-2">
            <UserPlus size={16} />
            Join organization
          </Button>
        </form>
      </WorkspaceCard>
    </div>
  );
}
