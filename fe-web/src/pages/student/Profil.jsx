import React, { useEffect, useRef, useState } from 'react';
import {
  BriefcaseBusiness,
  FolderKanban,
  Github,
  Globe,
  Instagram,
  Linkedin,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { AvatarCropModal } from '../../components/profile/AvatarCropModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usersApi } from '../../api/users';
import { externshipsApi } from '../../api/externships';
import { resolveUploadUrl } from '../../api/client';
import { useTranslation } from '../../context/LanguageContext';
import { buildMajorOptions } from '../../data/ipbMajors';
import { commonSkills, normalizeSkillLabel, normalizeSkillList } from '../../data/skills';

const socialFields = [
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { key: 'github', label: 'GitHub', icon: Github },
  { key: 'instagram', label: 'Instagram', icon: Instagram },
  { key: 'website', label: 'Website', icon: Globe },
];

const socialDomains = {
  linkedin: 'linkedin.com',
  github: 'github.com',
  instagram: 'instagram.com',
};

function normalizeUrl(value) {
  const cleaned = value.trim();
  if (!cleaned) return '';
  return cleaned.includes('://') ? cleaned : `https://${cleaned}`;
}

function normalizeSocialLinks(links, isId) {
  const normalized = {};
  const errors = {};

  socialFields.forEach(({ key, label }) => {
    const rawValue = links[key] || '';
    const url = normalizeUrl(rawValue);
    if (!url) return;

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      errors[key] = isId
        ? `${label} harus berupa tautan yang valid.`
        : `${label} must be a valid link.`;
      return;
    }

    const hostname = parsed.hostname.toLowerCase();
    const hasValidHost = hostname === 'localhost' || hostname.includes('.');
    if (!['http:', 'https:'].includes(parsed.protocol) || !hasValidHost) {
      errors[key] = isId
        ? `${label} harus memakai tautan http atau https.`
        : `${label} must use an http or https link.`;
      return;
    }

    const expectedDomain = socialDomains[key];
    if (expectedDomain && !hostname.endsWith(expectedDomain)) {
      errors[key] = isId
        ? `${label} harus memakai domain ${expectedDomain}.`
        : `${label} must use ${expectedDomain}.`;
      return;
    }

    normalized[key] = url;
  });

  return { normalized, errors };
}

const emptyEntryForm = {
  title: '',
  company: '',
  duration: '',
  description: '',
  entry_type: 'Experience',
  status: 'Ongoing',
};

function SkillPill({ children, selected = false, onClick, removable = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        selected
          ? 'border-brand/20 bg-brand/10 text-brand-dark'
          : 'border-surface-border bg-surface-muted text-text'
      }`}
    >
      {children}
      {removable && <span className="ml-1.5 text-text-light">x</span>}
    </button>
  );
}

function TimelineEntry({ entry, onEdit, onDelete }) {
  return (
    <div className="relative border-l-2 border-surface-border pl-6">
      <span className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-4 border-white bg-brand shadow-sm" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text">{entry.title}</h3>
          <p className="mt-1 text-sm text-text-muted">{entry.company}</p>
        </div>
        <div className="flex items-center gap-2">
          {entry.duration && (
            <span className="rounded bg-surface-muted px-2 py-1 text-xs text-text-muted">
              {entry.duration}
            </span>
          )}
          <button
            type="button"
            onClick={() => onEdit(entry)}
            className="rounded-md p-2 text-text-muted hover:bg-surface-muted hover:text-brand"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(entry.id)}
            className="rounded-md p-2 text-text-muted hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {entry.description && (
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-text-muted">
          {entry.description}
        </p>
      )}
    </div>
  );
}

function ProjectCard({ entry, onEdit, onDelete }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#becabe] bg-[#f7f9fb]">
      <div className="flex h-32 items-end justify-end bg-gradient-to-br from-brand/20 to-transparent p-4">
        <FolderKanban className="text-brand/60" />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-text">{entry.title}</h3>
            <p className="mt-1 text-sm text-text-muted">{entry.company}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(entry)}
              className="rounded-md p-2 text-text-muted hover:bg-white hover:text-brand"
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(entry.id)}
              className="rounded-md p-2 text-text-muted hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-text-muted">
          {entry.description || '-'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {entry.duration && (
            <span className="rounded border border-surface-border bg-white px-2 py-1 text-xs text-text-muted">
              {entry.duration}
            </span>
          )}
          <span className="rounded border border-surface-border bg-white px-2 py-1 text-xs text-text-muted">
            {entry.status}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ProfilStudent() {
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();
  const { lang } = useTranslation();
  const isId = lang === 'id';
  const avatarInputRef = useRef(null);
  const cvInputRef = useRef(null);

  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [profileForm, setProfileForm] = useState({
    bio: '',
    avatar: '',
    nim: '',
    major: '',
    gpa: '',
    social_links: {},
    skills: [],
  });
  const [customSkill, setCustomSkill] = useState('');
  const [socialErrors, setSocialErrors] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarCropFile, setAvatarCropFile] = useState(null);
  const [uploadingCV, setUploadingCV] = useState(false);
  const [openingCV, setOpeningCV] = useState(false);
  const [downloadingCV, setDownloadingCV] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [entrySaving, setEntrySaving] = useState(false);
  const [entryForm, setEntryForm] = useState(emptyEntryForm);

  useEffect(() => {
    setProfileForm({
      bio: user?.bio || '',
      avatar: user?.avatar || '',
      nim: user?.nim || '',
      major: user?.major || '',
      gpa: user?.gpa ?? '',
      social_links: user?.social_links || {},
      skills: normalizeSkillList(user?.skills || []),
    });
  }, [user]);

  useEffect(() => {
    async function fetchEntries() {
      try {
        const data = await externshipsApi.mine();
        setEntries(data.items || []);
      } catch (err) {
        console.error('Failed to load profile entries', err);
      } finally {
        setLoadingEntries(false);
      }
    }

    fetchEntries();
  }, []);

  const fullName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || '-';
  const avatarUrl =
    resolveUploadUrl(profileForm.avatar) ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=0f2854&color=fff`;
  const experienceEntries = entries.filter((entry) => entry.entry_type === 'Experience');
  const projectEntries = entries.filter((entry) => entry.entry_type === 'Project');

  const handleProfileChange = (field) => (e) => {
    setProfileForm((current) => ({ ...current, [field]: e.target.value }));
  };

  const handleSocialChange = (field) => (e) => {
    setSocialErrors((current) => ({ ...current, [field]: undefined }));
    setProfileForm((current) => ({
      ...current,
      social_links: { ...current.social_links, [field]: e.target.value },
    }));
  };

  const toggleSkill = (skill) => {
    setProfileForm((current) => ({
      ...current,
      skills: current.skills.includes(skill)
        ? current.skills.filter((item) => item !== skill)
        : [...current.skills, skill],
    }));
  };

  const addCustomSkill = () => {
    const value = normalizeSkillLabel(customSkill);
    if (!value || profileForm.skills.some((skill) => skill.toLowerCase() === value.toLowerCase())) return;
    setProfileForm((current) => ({ ...current, skills: [...current.skills, value] }));
    setCustomSkill('');
  };

  const saveProfile = async () => {
    const { normalized, errors } = normalizeSocialLinks(profileForm.social_links, isId);
    setSocialErrors(errors);
    if (Object.keys(errors).length > 0) {
      addToast({
        type: 'error',
        title: isId ? 'Tautan tidak valid' : 'Invalid links',
        message: isId
          ? 'Periksa format tautan sosial Anda.'
          : 'Please check your social link formats.',
      });
      return;
    }

    setSavingProfile(true);
    try {
      await usersApi.update({
        bio: profileForm.bio,
        nim: profileForm.nim || null,
        major: profileForm.major || null,
        gpa: profileForm.gpa === '' ? null : Number(profileForm.gpa),
        social_links: normalized,
        skills: normalizeSkillList(profileForm.skills),
      });
      setProfileForm((current) => ({ ...current, social_links: normalized }));
      await refreshUser();
      setProfileEditOpen(false);
      addToast({
        type: 'success',
        title: isId ? 'Berhasil' : 'Success',
        message: isId ? 'Profil berhasil diperbarui.' : 'Profile updated.',
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: isId ? 'Gagal' : 'Failed',
        message: err.message || (isId ? 'Gagal memperbarui profil.' : 'Failed to update profile.'),
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      addToast({
        type: 'error',
        title: 'Error',
        message: isId ? 'Ukuran gambar maksimal 2MB.' : 'Maximum image size is 2MB.',
      });
      return;
    }
    setAvatarCropFile(file);
  };

  const cancelAvatarCrop = () => {
    setAvatarCropFile(null);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const uploadCroppedAvatar = async (file) => {
    setUploadingAvatar(true);
    try {
      await usersApi.uploadAvatar(file);
      await refreshUser();
      setAvatarCropFile(null);
      addToast({
        type: 'success',
        title: isId ? 'Berhasil' : 'Success',
        message: isId ? 'Foto profil diperbarui.' : 'Profile photo updated.',
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: isId ? 'Gagal' : 'Failed',
        message: err.message || (isId ? 'Gagal mengunggah foto.' : 'Failed to upload photo.'),
      });
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleCVSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      addToast({
        type: 'error',
        title: 'Error',
        message: isId ? 'Ukuran CV maksimal 5MB.' : 'Maximum CV size is 5MB.',
      });
      return;
    }
    setUploadingCV(true);
    try {
      await usersApi.uploadCV(file);
      await refreshUser();
      addToast({
        type: 'success',
        title: isId ? 'Berhasil' : 'Success',
        message: isId ? 'Resume berhasil diunggah.' : 'Resume uploaded.',
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: isId ? 'Gagal' : 'Failed',
        message: err.message || (isId ? 'Gagal mengunggah resume.' : 'Failed to upload resume.'),
      });
    } finally {
      setUploadingCV(false);
      e.target.value = '';
    }
  };

  const handleViewCV = async () => {
    setOpeningCV(true);
    try {
      await usersApi.viewMyCV();
    } catch (err) {
      addToast({ type: 'error', title: isId ? 'Gagal' : 'Failed', message: err.message || (isId ? 'Gagal membuka CV.' : 'Failed to open CV.') });
    } finally {
      setOpeningCV(false);
    }
  };

  const handleDownloadCV = async () => {
    setDownloadingCV(true);
    try {
      await usersApi.downloadMyCV();
    } catch (err) {
      addToast({ type: 'error', title: isId ? 'Gagal' : 'Failed', message: err.message || (isId ? 'Gagal mengunduh CV.' : 'Failed to download CV.') });
    } finally {
      setDownloadingCV(false);
    }
  };

  const openNewEntryModal = (entryType) => {
    setEditingEntryId(null);
    setEntryForm({ ...emptyEntryForm, entry_type: entryType });
    setEntryModalOpen(true);
  };

  const openEditEntryModal = (entry) => {
    setEditingEntryId(entry.id);
    setEntryForm({
      title: entry.title || '',
      company: entry.company || '',
      duration: entry.duration || '',
      description: entry.description || '',
      entry_type: entry.entry_type || 'Experience',
      status: entry.status || 'Ongoing',
    });
    setEntryModalOpen(true);
  };

  const handleEntryChange = (field) => (e) => {
    setEntryForm((current) => ({ ...current, [field]: e.target.value }));
  };

  const handleEntrySave = async (e) => {
    e.preventDefault();
    setEntrySaving(true);
    try {
      const saved = editingEntryId
        ? await externshipsApi.update(editingEntryId, entryForm)
        : await externshipsApi.create(entryForm);
      setEntries((current) =>
        editingEntryId
          ? current.map((entry) => (entry.id === editingEntryId ? saved : entry))
          : [saved, ...current]
      );
      setEntryModalOpen(false);
    } catch (err) {
      addToast({
        type: 'error',
        title: isId ? 'Gagal' : 'Failed',
        message: err.message || (isId ? 'Gagal menyimpan entri.' : 'Failed to save entry.'),
      });
    } finally {
      setEntrySaving(false);
    }
  };

  const handleEntryDelete = async (id) => {
    try {
      await externshipsApi.delete(id);
      setEntries((current) => current.filter((entry) => entry.id !== id));
    } catch (err) {
      addToast({
        type: 'error',
        title: isId ? 'Gagal' : 'Failed',
        message: err.message || (isId ? 'Gagal menghapus entri.' : 'Failed to delete entry.'),
      });
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        <aside className="space-y-6">
          <Card className="border-[#becabe]">
            <div className="h-24 bg-[#E6ECF5]" />
            <CardBody className="-mt-20 flex flex-col items-center text-center">
              <img
                src={avatarUrl}
                alt={fullName}
                className="h-32 w-32 rounded-full border-4 border-white bg-[#E6ECF5] object-cover shadow-lg"
              />
              <h1 className="mt-4 text-2xl font-semibold text-text">{fullName}</h1>
              <p className="mt-1 text-sm text-text-muted">
                {user?.major || (isId ? 'Mahasiswa' : 'Student')}
              </p>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-text-muted">
                <MapPin size={14} />
                {user?.university || 'IPB University'}
              </p>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
              <input ref={cvInputRef} type="file" accept=".pdf" className="hidden" onChange={handleCVSelect} />

              <div className="mt-5 flex w-full border-b border-surface-border pb-6">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => cvInputRef.current?.click()}
                  disabled={uploadingCV}
                >
                  {uploadingCV ? (isId ? 'Mengunggah...' : 'Uploading...') : 'Resume'}
                </Button>
              </div>

              <div className="mt-4 flex w-full gap-3">
                {user?.has_cv && (
                  <>
                    <Button variant="ghost" className="flex-1" onClick={handleViewCV} disabled={openingCV}>
                      {openingCV ? (isId ? 'Membuka...' : 'Opening...') : isId ? 'Lihat Resume' : 'View Resume'}
                    </Button>
                    <Button variant="ghost" className="flex-1" onClick={handleDownloadCV} disabled={downloadingCV}>
                      {downloadingCV ? (isId ? 'Mengunduh...' : 'Downloading...') : isId ? 'Unduh' : 'Download'}
                    </Button>
                  </>
                )}
                <Button to="/student/cv-builder" variant="ghost" className="flex-1">
                  CV Maker
                </Button>
              </div>

              <div className="mt-5 flex gap-3">
                {socialFields.map((field) => {
                  const url = user?.social_links?.[field.key];
                  return url ? (
                    <a
                      key={field.key}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      title={field.label}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-text-muted transition-colors hover:text-brand"
                    >
                      {React.createElement(field.icon, { size: 18 })}
                    </a>
                  ) : null;
                })}
              </div>

              <div className="mt-5 flex w-full gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  <Upload size={16} className="mr-1.5" />
                  {uploadingAvatar ? (isId ? 'Mengunggah...' : 'Uploading...') : isId ? 'Foto' : 'Photo'}
                </Button>
                <Button className="flex-1" onClick={() => setProfileEditOpen(true)}>
                  <Pencil size={16} className="mr-1.5" />
                  {isId ? 'Edit Profil' : 'Edit Profile'}
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card className="border-[#becabe]">
            <CardBody>
              <h2 className="text-xl font-semibold text-text">{isId ? 'Tentang Saya' : 'About Me'}</h2>
              <p className="mt-4 whitespace-pre-line text-sm leading-6 text-text-muted">
                {user?.bio || (isId ? 'Tambahkan ringkasan profesional Anda.' : 'Add your professional summary.')}
              </p>
            </CardBody>
          </Card>

          <Card className="border-[#becabe]">
            <CardBody>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-text">
                  {isId ? 'Keahlian & Ekspertise' : 'Skills & Expertise'}
                </h2>
                <Button size="sm" variant="ghost" onClick={() => setProfileEditOpen(true)}>
                  <Pencil size={15} />
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(user?.skills || []).length > 0 ? (
                  user.skills.map((skill) => <SkillPill key={skill} selected>{skill}</SkillPill>)
                ) : (
                  <p className="text-sm text-text-muted">
                    {isId ? 'Belum ada keahlian ditambahkan.' : 'No skills added yet.'}
                  </p>
                )}
              </div>
            </CardBody>
          </Card>
        </aside>

        <section className="space-y-6">
          <Card className="border-[#becabe]">
            <CardBody>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BriefcaseBusiness size={20} className="text-brand" />
                  <h2 className="text-2xl font-semibold text-text">
                    {isId ? 'Pengalaman' : 'Experience'}
                  </h2>
                </div>
                <Button size="sm" onClick={() => openNewEntryModal('Experience')}>
                  <Plus size={16} className="mr-1.5" />
                  {isId ? 'Tambah' : 'Add'}
                </Button>
              </div>
              <div className="mt-6 space-y-8">
                {loadingEntries ? (
                  <p className="text-sm text-text-muted">{isId ? 'Memuat...' : 'Loading...'}</p>
                ) : experienceEntries.length > 0 ? (
                  experienceEntries.map((entry) => (
                    <TimelineEntry
                      key={entry.id}
                      entry={entry}
                      onEdit={openEditEntryModal}
                      onDelete={handleEntryDelete}
                    />
                  ))
                ) : (
                  <p className="text-sm text-text-muted">
                    {isId ? 'Belum ada pengalaman yang ditampilkan.' : 'No experience to display yet.'}
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          <Card className="border-[#becabe]">
            <CardBody>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FolderKanban size={20} className="text-brand" />
                  <h2 className="text-2xl font-semibold text-text">
                    {isId ? 'Proyek Unggulan' : 'Featured Projects'}
                  </h2>
                </div>
                <Button size="sm" onClick={() => openNewEntryModal('Project')}>
                  <Plus size={16} className="mr-1.5" />
                  {isId ? 'Tambah' : 'Add'}
                </Button>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                {loadingEntries ? (
                  <p className="text-sm text-text-muted">{isId ? 'Memuat...' : 'Loading...'}</p>
                ) : projectEntries.length > 0 ? (
                  projectEntries.map((entry) => (
                    <ProjectCard
                      key={entry.id}
                      entry={entry}
                      onEdit={openEditEntryModal}
                      onDelete={handleEntryDelete}
                    />
                  ))
                ) : (
                  <p className="text-sm text-text-muted md:col-span-2">
                    {isId ? 'Belum ada proyek yang ditampilkan.' : 'No projects to display yet.'}
                  </p>
                )}
              </div>
            </CardBody>
          </Card>
        </section>
      </div>

      <Modal
        isOpen={profileEditOpen}
        onClose={() => setProfileEditOpen(false)}
        title={isId ? 'Edit Profil Profesional' : 'Edit Professional Profile'}
        size="lg"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Input
              label={isId ? 'NIM' : 'Student ID'}
              value={profileForm.nim}
              onChange={handleProfileChange('nim')}
              className="border border-surface-border"
              placeholder="G6401201001"
            />
            <Select
              label={isId ? 'Jurusan' : 'Major'}
              value={profileForm.major}
              onChange={handleProfileChange('major')}
              options={buildMajorOptions([profileForm.major])}
              className="border border-surface-border"
              placeholder={isId ? 'Pilih jurusan IPB' : 'Choose an IPB major'}
            />
            <Input
              label="GPA"
              type="number"
              min="0"
              max="4"
              step="0.01"
              value={profileForm.gpa}
              onChange={handleProfileChange('gpa')}
              className="border border-surface-border"
              placeholder="3.85"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#0A1D3D]/80">
              {isId ? 'Tentang Saya' : 'About Me'}
            </label>
            <textarea
              className="min-h-[120px] w-full rounded-lg border border-surface-border px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={profileForm.bio}
              onChange={handleProfileChange('bio')}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-[#0A1D3D]/80">
              {isId ? 'Tautan Sosial' : 'Social Links'}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              {socialFields.map(({ key, label }) => (
                <Input
                  key={key}
                  label={label}
                  value={profileForm.social_links[key] || ''}
                  onChange={handleSocialChange(key)}
                  error={socialErrors[key]}
                  className="border border-surface-border"
                  placeholder={`https://${key}.com/...`}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-[#0A1D3D]/80">
              {isId ? 'Keahlian' : 'Skills'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {commonSkills.map((skill) => (
                <SkillPill
                  key={skill}
                  selected={profileForm.skills.includes(skill)}
                  onClick={() => toggleSkill(skill)}
                >
                  {skill}
                </SkillPill>
              ))}
            </div>
            <div className="mt-4 flex gap-3">
              <Input
                value={customSkill}
                onChange={(e) => setCustomSkill(e.target.value)}
                className="border border-surface-border"
                placeholder={isId ? 'Tambah keahlian khusus' : 'Add custom skill'}
              />
              <Button type="button" variant="outline" onClick={addCustomSkill}>
                {isId ? 'Tambah' : 'Add'}
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {profileForm.skills
                .filter((skill) => !commonSkills.includes(skill))
                .map((skill) => (
                  <SkillPill
                    key={skill}
                    selected
                    removable
                    onClick={() => toggleSkill(skill)}
                  >
                    {skill}
                  </SkillPill>
                ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setProfileEditOpen(false)}>
              {isId ? 'Batal' : 'Cancel'}
            </Button>
            <Button onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? (isId ? 'Menyimpan...' : 'Saving...') : isId ? 'Simpan' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      <AvatarCropModal
        file={avatarCropFile}
        isOpen={Boolean(avatarCropFile)}
        onCancel={cancelAvatarCrop}
        onConfirm={uploadCroppedAvatar}
        isId={isId}
        uploading={uploadingAvatar}
      />

      <Modal
        isOpen={entryModalOpen}
        onClose={() => setEntryModalOpen(false)}
        title={
          editingEntryId
            ? isId
              ? 'Edit Entri'
              : 'Edit Entry'
            : isId
              ? 'Tambah Entri'
              : 'Add Entry'
        }
        size="lg"
      >
        <form onSubmit={handleEntrySave} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0A1D3D]/80">
                {isId ? 'Jenis' : 'Type'}
              </label>
              <select
                className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                value={entryForm.entry_type}
                onChange={handleEntryChange('entry_type')}
              >
                <option value="Experience">{isId ? 'Pengalaman' : 'Experience'}</option>
                <option value="Project">{isId ? 'Proyek' : 'Project'}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0A1D3D]/80">
                {isId ? 'Status' : 'Status'}
              </label>
              <select
                className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                value={entryForm.status}
                onChange={handleEntryChange('status')}
              >
                <option value="Ongoing">{isId ? 'Berjalan' : 'Ongoing'}</option>
                <option value="Completed">{isId ? 'Selesai' : 'Completed'}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label={isId ? 'Judul' : 'Title'}
              value={entryForm.title}
              onChange={handleEntryChange('title')}
              className="border border-surface-border"
              required
            />
            <Input
              label={isId ? 'Organisasi / Klien' : 'Organization / Client'}
              value={entryForm.company}
              onChange={handleEntryChange('company')}
              className="border border-surface-border"
              required
            />
          </div>
          <Input
            label={isId ? 'Durasi' : 'Duration'}
            value={entryForm.duration}
            onChange={handleEntryChange('duration')}
            className="border border-surface-border"
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0A1D3D]/80">
              {isId ? 'Deskripsi' : 'Description'}
            </label>
            <textarea
              className="min-h-[120px] w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
              value={entryForm.description}
              onChange={handleEntryChange('description')}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setEntryModalOpen(false)}>
              {isId ? 'Batal' : 'Cancel'}
            </Button>
            <Button type="submit" disabled={entrySaving}>
              {entrySaving ? (isId ? 'Menyimpan...' : 'Saving...') : isId ? 'Simpan' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
