import { useEffect, useState } from 'react';
import { Building2, ExternalLink, LockKeyhole, MapPin, Save } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { CompanyLogo } from '../../../components/ui/CompanyLogo';
import { Input } from '../../../components/ui/Input';
import { companiesApi } from '../../../api/companies';
import { WorkspaceCard, StatusPill } from './WorkspaceCard';

export function ProfileSection({ company, canEdit, addToast, onSaved }) {
  const [form, setForm] = useState({
    name: '',
    industry: '',
    location: '',
    website: '',
    logo: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: company?.name || '',
      industry: company?.industry || '',
      location: company?.location || '',
      website: company?.website || '',
      logo: company?.logo || '',
      description: company?.description || '',
    });
  }, [company]);

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!canEdit || !company?.id) return;
    setSaving(true);
    try {
      await companiesApi.update(company.id, form);
      await onSaved();
      addToast({ type: 'success', title: 'Saved', message: 'Company profile updated.' });
    } catch (err) {
      addToast({ type: 'error', title: 'Failed', message: err.message || 'Could not save company profile.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
      <WorkspaceCard title="Public identity" icon={Building2}>
        <div className="flex items-start gap-4">
          <CompanyLogo
            company={{ ...company, logo: form.logo }}
            className="h-20 w-20 rounded-lg border border-[#E6ECF5] bg-white p-2 ring-1 ring-[#E6ECF5]"
            fallbackClassName="text-xl font-bold text-brand"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-light">Company page</p>
            <h3 className="mt-1 truncate text-xl font-bold text-text">{company?.name || 'Company'}</h3>
            <p className="mt-1 flex items-center gap-1 text-sm text-text-muted">
              <MapPin size={14} />
              {company?.location || 'Location not set'}
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-[#E6ECF5] p-3">
            <p className="text-xs text-text-light">Industry</p>
            <p className="mt-1 truncate text-sm font-semibold text-text">{company?.industry || '-'}</p>
          </div>
          <div className="rounded-lg bg-[#E6ECF5] p-3">
            <p className="text-xs text-text-light">Status</p>
            <div className="mt-1"><StatusPill tone="green">Approved</StatusPill></div>
          </div>
        </div>
        <div className="mt-5 rounded-lg border border-[#E6ECF5] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-light">Preview card</p>
          <div className="mt-3 flex items-center gap-3">
            <CompanyLogo
              company={{ ...company, logo: form.logo }}
              className="h-10 w-10 rounded-lg border border-[#E6ECF5] bg-white p-1.5"
              fallbackClassName="text-sm font-bold text-brand"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text">{company?.name || 'Company'}</p>
              <p className="truncate text-xs text-text-muted">{company?.tagline || company?.industry || 'No tagline yet'}</p>
            </div>
          </div>
        </div>
        <Button to={`/perusahaan/${company?.id}`} variant="outline" size="sm" className="mt-5 w-full gap-2">
          <ExternalLink size={14} />
          View public page
        </Button>
      </WorkspaceCard>

      <WorkspaceCard
        title="Profile details"
        icon={canEdit ? Save : LockKeyhole}
        action={!canEdit && <StatusPill tone="amber">View only</StatusPill>}
      >
        {!canEdit && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            <LockKeyhole size={15} />
            Owner or admin access is required to edit this company profile.
          </div>
        )}
        <form className="space-y-4" onSubmit={handleSave}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Company name" value={form.name} onChange={handleChange('name')} disabled={!canEdit} />
            <Input label="Industry" value={form.industry} onChange={handleChange('industry')} disabled={!canEdit} />
            <Input label="Location" value={form.location} onChange={handleChange('location')} disabled={!canEdit} />
            <Input label="Website" value={form.website} onChange={handleChange('website')} disabled={!canEdit} />
            <Input label="Logo URL" value={form.logo} onChange={handleChange('logo')} disabled={!canEdit} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0A1D3D]/80">Description</label>
            <textarea
              rows={7}
              value={form.description}
              onChange={handleChange('description')}
              disabled={!canEdit}
              className="w-full rounded-lg border border-[#E6ECF5] px-3 py-2 text-sm shadow-sm disabled:bg-[#E6ECF5] disabled:text-[#0A1D3D]/50 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving || !canEdit} className="gap-2">
              <Save size={16} />
              {saving ? 'Saving...' : 'Save profile'}
            </Button>
          </div>
        </form>
      </WorkspaceCard>
    </div>
  );
}
