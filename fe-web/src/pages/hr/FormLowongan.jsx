import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { useToast } from '../../context/ToastContext';
import { opportunitiesApi } from '../../api/opportunities';
import { ArrowLeft, Building2, Plus, Trash2, X } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import { buildMajorOptions } from '../../data/ipbMajors';
import { getSkillSuggestions, normalizeSkillLabel, normalizeSkillList } from '../../data/skills';
import { useOrganization } from '../../hooks/useOrganization';

function formatRupiah(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return `Rp ${new Intl.NumberFormat('id-ID').format(Number(digits))}`;
}

function formatSalaryInput(value) {
  const parts = String(value || '').match(/\d[\d.,]*/g) || [];
  if (!parts.length) return value;
  const amounts = parts
    .map((part) => formatRupiah(part))
    .filter(Boolean)
    .slice(0, 2);

  if (amounts.length === 1) return amounts[0];
  return `${amounts[0]} - ${amounts[1]}`;
}

export function FormLowongan() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { lang } = useTranslation();
  const isEdit = Boolean(id);
  const isId = lang === 'id';
  const { company, onboardingRequired, loading: organizationLoading } = useOrganization();
  const canCreate = isEdit || company?.status === 'approved';

  const [form, setForm] = useState({
    title: '',
    type: 'Internship',
    location: '',
    salary: '',
    description: '',
    requirements: [''],
    target_majors: [''],
    skill_tags: [],
    deadline: '',
    is_active: true,
  });
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [skillInput, setSkillInput] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    opportunitiesApi
      .get(id)
      .then((data) => {
        setForm({
          title: data.title || '',
          type: data.type || 'Internship',
          location: data.location || '',
          salary: data.salary || '',
          description: data.description || '',
          requirements:
            Array.isArray(data.requirements) && data.requirements.length > 0
              ? data.requirements
              : [''],
          target_majors:
            Array.isArray(data.target_majors) && data.target_majors.length > 0
              ? data.target_majors
              : [''],
          skill_tags:
            Array.isArray(data.skill_tags) && data.skill_tags.length > 0
              ? normalizeSkillList(data.skill_tags)
              : [],
          deadline: data.deadline ? data.deadline.split('T')[0] : '',
          is_active: data.is_active !== false,
        });
      })
      .catch(() => {
        addToast({ type: 'error', title: 'Error', message: isId ? 'Gagal memuat data lowongan.' : 'Failed to load opportunity data.' });
        navigate('/hr/opportunities');
      })
      .finally(() => setLoading(false));
  }, [addToast, id, isEdit, isId, navigate]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({ ...form, [field]: value });
  };

  const handleSalaryChange = (e) => {
    setForm({ ...form, salary: formatSalaryInput(e.target.value) });
  };

  const handleReqChange = (index) => (e) => {
    const reqs = [...form.requirements];
    reqs[index] = e.target.value;
    setForm({ ...form, requirements: reqs });
  };

  const addRequirement = () => {
    setForm({ ...form, requirements: [...form.requirements, ''] });
  };

  const removeRequirement = (index) => {
    const reqs = form.requirements.filter((_, i) => i !== index);
    setForm({ ...form, requirements: reqs.length > 0 ? reqs : [''] });
  };

  const handleListChange = (field, index) => (e) => {
    const values = [...form[field]];
    values[index] = e.target.value;
    setForm({ ...form, [field]: values });
  };

  const addListItem = (field) => {
    setForm({ ...form, [field]: [...form[field], ''] });
  };

  const removeListItem = (field, index) => {
    const values = form[field].filter((_, i) => i !== index);
    setForm({ ...form, [field]: values.length > 0 ? values : [''] });
  };

  const cleanList = (values) => {
    const seen = new Set();
    return values
      .map((value) => value.trim())
      .filter((value) => {
        const key = value.toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const addSkillTag = (value) => {
    const skill = normalizeSkillLabel(value);
    if (!skill) return;

    setForm((current) => ({
      ...current,
      skill_tags: normalizeSkillList([...current.skill_tags, skill]),
    }));
    setSkillInput('');
  };

  const removeSkillTag = (skill) => {
    setForm((current) => ({
      ...current,
      skill_tags: current.skill_tags.filter((item) => item.toLowerCase() !== skill.toLowerCase()),
    }));
  };

  const handleSkillInputKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addSkillTag(skillInput);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.type || !form.location) {
      addToast({ type: 'error', title: isId ? 'Validasi' : 'Validation', message: isId ? 'Judul, tipe, dan lokasi wajib diisi.' : 'Title, type, and location are required.' });
      return;
    }

    setSubmitting(true);
    const formattedSalary = formatSalaryInput(form.salary);
    const payload = {
      ...form,
      requirements: form.requirements.filter((r) => r.trim() !== ''),
      target_majors: cleanList(form.target_majors),
      skill_tags: normalizeSkillList(form.skill_tags),
      deadline: form.deadline || null,
      salary: formattedSalary || null,
      description: form.description || null,
    };

    try {
      if (isEdit) {
        await opportunitiesApi.update(id, payload);
        addToast({ type: 'success', title: isId ? 'Berhasil' : 'Success', message: isId ? 'Lowongan berhasil diperbarui.' : 'Opportunity updated successfully.' });
      } else {
        await opportunitiesApi.create(payload);
        addToast({ type: 'success', title: isId ? 'Berhasil' : 'Success', message: isId ? 'Lowongan baru berhasil dibuat.' : 'New opportunity created successfully.' });
      }
      navigate('/hr/opportunities');
    } catch (err) {
      addToast({ type: 'error', title: isId ? 'Gagal' : 'Failed', message: err.message || (isId ? 'Terjadi kesalahan.' : 'Something went wrong.') });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || organizationLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!canCreate || onboardingRequired) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-lg rounded-2xl border-[#E6ECF5]">
          <CardBody className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-text">
                {isId ? 'Atur organisasi terlebih dahulu' : 'Set up your organization first'}
              </h1>
              <p className="mt-2 text-sm text-text-muted">
                {isId ? 'Buat atau gabung perusahaan sebelum membuat lowongan.' : 'Create or join a company before publishing opportunities.'}
              </p>
            </div>
            <Button type="button" onClick={() => navigate('/hr/onboarding')} className="w-full">
              {isId ? 'Lanjutkan' : 'Continue'}
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  const selectedSkillTags = normalizeSkillList(form.skill_tags);
  const skillSuggestions = getSkillSuggestions(selectedSkillTags, skillInput, 8);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/hr/opportunities')}
          className="p-2 hover:bg-[#E6ECF5] rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-[#0A1D3D]">
          {isEdit ? (isId ? 'Edit Lowongan' : 'Edit Opportunity') : (isId ? 'Buat Lowongan Baru' : 'Create New Opportunity')}
        </h1>
      </div>

      <Card>
        <CardBody>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <Input
              label={isId ? 'Judul Posisi' : 'Position Title'}
              value={form.title}
              onChange={handleChange('title')}
              placeholder="Contoh: Frontend Developer Intern"
              required
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#0A1D3D]/80 mb-1">{isId ? 'Tipe' : 'Type'}</label>
                <Select
                  value={form.type}
                  onChange={handleChange('type')}
                  options={[
                    { value: 'Internship', label: 'Internship' },
                    { value: 'Full-time', label: 'Full-time' },
                    { value: 'Scholarship', label: 'Scholarship' },
                  ]}
                />
              </div>
              <Input
                label={isId ? 'Lokasi' : 'Location'}
                value={form.location}
                onChange={handleChange('location')}
                placeholder="Contoh: Jakarta, Indonesia"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={isId ? 'Gaji (opsional)' : 'Salary (optional)'}
                value={form.salary}
                onChange={handleSalaryChange}
                onBlur={() => setForm((current) => ({ ...current, salary: formatSalaryInput(current.salary) }))}
                placeholder="Contoh: Rp 3.000.000 - Rp 5.000.000"
              />
              <Input
                label={isId ? 'Deadline (opsional)' : 'Deadline (optional)'}
                type="date"
                value={form.deadline}
                onChange={handleChange('deadline')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#0A1D3D]/80 mb-1">{isId ? 'Deskripsi' : 'Description'}</label>
              <textarea
                className="w-full rounded-lg border border-[#E6ECF5] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[120px] resize-y"
                value={form.description}
                onChange={handleChange('description')}
                placeholder={isId ? 'Deskripsikan lowongan ini...' : 'Describe this opportunity...'}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-[#0A1D3D]/80 mb-2">{isId ? 'Target jurusan' : 'Target majors'}</label>
                <div className="space-y-2">
                  {form.target_majors.map((major, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Select
                        value={major}
                        onChange={handleListChange('target_majors', index)}
                        placeholder={isId ? 'Pilih jurusan IPB' : 'Choose an IPB major'}
                        options={buildMajorOptions(form.target_majors)}
                        className="flex-1"
                      />
                      {form.target_majors.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeListItem('target_majors', index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => addListItem('target_majors')}
                  className="mt-2 text-sm text-primary hover:text-accent flex items-center gap-1 font-medium"
                >
                  <Plus size={14} /> {isId ? 'Tambah jurusan' : 'Add major'}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#0A1D3D]/80 mb-2">{isId ? 'Tag keahlian' : 'Skill tags'}</label>
                <div className="rounded-lg border border-[#E6ECF5] bg-white p-3 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                  {selectedSkillTags.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {selectedSkillTags.map((skill) => (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => removeSkillTag(skill)}
                          className="inline-flex items-center gap-1 rounded-full border border-brand/15 bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand-dark transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        >
                          {skill}
                          <X size={13} />
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      value={skillInput}
                      onChange={(event) => setSkillInput(event.target.value)}
                      onKeyDown={handleSkillInputKeyDown}
                      placeholder={isId ? 'Cari atau ketik skill' : 'Search or type a skill'}
                      className="min-w-0 flex-1 border-none bg-transparent text-sm outline-none placeholder:text-[#0A1D3D]/40"
                    />
                    <button
                      type="button"
                      onClick={() => addSkillTag(skillInput)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-surface-border text-primary transition-colors hover:border-primary hover:bg-primary/5"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>

                {skillSuggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {skillSuggestions.map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => addSkillTag(skill)}
                        className="rounded-full border border-surface-border bg-white px-2.5 py-1 text-xs font-medium text-text-muted transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#0A1D3D]/80 mb-2">{isId ? 'Persyaratan' : 'Requirements'}</label>
              <div className="space-y-2">
                {form.requirements.map((req, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={req}
                      onChange={handleReqChange(index)}
                      placeholder={`Persyaratan ${index + 1}`}
                      className="flex-1"
                    />
                    {form.requirements.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRequirement(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addRequirement}
                className="mt-2 text-sm text-primary hover:text-accent flex items-center gap-1 font-medium"
              >
                <Plus size={14} /> {isId ? 'Tambah Persyaratan' : 'Add Requirement'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={handleChange('is_active')}
                className="rounded border-[#E6ECF5]"
              />
              <label htmlFor="is_active" className="text-sm text-[#0A1D3D]/80">
                {isId ? 'Lowongan aktif' : 'Active opportunity'}
              </label>
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/hr/opportunities')}
              >
                {isId ? 'Batal' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (isId ? 'Menyimpan...' : 'Saving...') : isEdit ? (isId ? 'Simpan Perubahan' : 'Save Changes') : (isId ? 'Buat Lowongan' : 'Create Opportunity')}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
