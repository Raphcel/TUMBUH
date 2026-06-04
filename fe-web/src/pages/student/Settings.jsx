import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, LockKeyhole, Monitor, ShieldCheck, UserRoundCog } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { authApi } from '../../api/auth';
import { usersApi } from '../../api/users';
import { useTranslation } from '../../context/LanguageContext';
import { motion } from 'framer-motion';

const MotionDiv = motion.div;

const PHONE_COUNTRY_OPTIONS = [
  { value: '+62', label: 'Indonesia (+62)' },
];
const DEFAULT_PHONE_COUNTRY_CODE = '+62';
const INDONESIA_PHONE_MIN_DIGITS = 9;
const INDONESIA_PHONE_MAX_DIGITS = 12;

function normalizeName(value) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => (
      word ? `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}` : ''
    ))
    .join(' ');
}

function cleanPhoneInput(value) {
  return String(value || '').trim().replace(/[\s\-()]/g, '');
}

function getIndonesiaLocalPhone(value) {
  const cleaned = cleanPhoneInput(value);
  if (!cleaned) return '';

  if (cleaned.startsWith(DEFAULT_PHONE_COUNTRY_CODE)) {
    return cleaned.slice(DEFAULT_PHONE_COUNTRY_CODE.length).replace(/^0+/, '');
  }

  const countryDigits = DEFAULT_PHONE_COUNTRY_CODE.slice(1);
  if (cleaned.startsWith(countryDigits)) {
    return cleaned.slice(countryDigits.length).replace(/^0+/, '');
  }

  return cleaned.replace(/^0+/, '');
}

function normalizeIndonesiaPhone(value, isId) {
  const localNumber = getIndonesiaLocalPhone(value);
  if (!localNumber) {
    return { value: '', localNumber: '', error: '' };
  }

  if (!/^\d+$/.test(localNumber)) {
    return {
      value: '',
      localNumber,
      error: isId
        ? 'Nomor telepon hanya boleh berisi angka.'
        : 'Phone number can only contain digits.',
    };
  }

  if (!localNumber.startsWith('8')) {
    return {
      value: '',
      localNumber,
      error: isId
        ? 'Nomor Indonesia harus diawali 08 atau +628.'
        : 'Indonesian phone numbers must start with 08 or +628.',
    };
  }

  if (
    localNumber.length < INDONESIA_PHONE_MIN_DIGITS ||
    localNumber.length > INDONESIA_PHONE_MAX_DIGITS
  ) {
    return {
      value: '',
      localNumber,
      error: isId
        ? 'Nomor telepon harus 10-13 digit dalam format lokal Indonesia.'
        : 'Phone number must be 10-13 digits in Indonesian local format.',
    };
  }

  return {
    value: `${DEFAULT_PHONE_COUNTRY_CODE}${localNumber}`,
    localNumber,
    error: '',
  };
}

const tabs = [
  { id: 'account', icon: UserRoundCog, labelId: 'Manajemen Akun', labelEn: 'Account Management' },
  { id: 'privacy', icon: LockKeyhole, labelId: 'Kontrol Privasi', labelEn: 'Privacy Controls' },
  { id: 'notifications', icon: Bell, labelId: 'Preferensi Notifikasi', labelEn: 'Notification Preferences' },
  { id: 'system', icon: Monitor, labelId: 'Preferensi Sistem', labelEn: 'System Preferences' },
];

function ToggleRow({ title, description, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-lg border border-surface-border bg-surface px-4 py-4">
      <span>
        <span className="block text-sm font-semibold text-text">{title}</span>
        <span className="mt-1 block text-sm text-text-muted">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-5 w-5 accent-brand"
      />
    </label>
  );
}

export function StudentSettings() {
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth();
  const { addToast } = useToast();
  const { lang, setLang } = useTranslation();
  const isId = lang === 'id';
  const [activeTab, setActiveTab] = useState('account');
  const [saving, setSaving] = useState(false);
  const [passwordResetting, setPasswordResetting] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState(DEFAULT_PHONE_COUNTRY_CODE);
  const [formErrors, setFormErrors] = useState({});
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    bio: '',
  });
  const [privacy, setPrivacy] = useState({
    openToOpportunities: true,
    shareProfileWithHr: true,
  });
  const [notifications, setNotifications] = useState({
    jobRecommendations: true,
    applicationUpdates: true,
    messages: true,
  });

  useEffect(() => {
    setForm({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone: getIndonesiaLocalPhone(user?.phone || ''),
      bio: user?.bio || '',
    });
    setPhoneCountryCode(DEFAULT_PHONE_COUNTRY_CODE);
    setFormErrors({});
  }, [user]);

  const handleChange = (field) => (e) => {
    setForm((current) => ({ ...current, [field]: e.target.value }));
    setFormErrors((current) => ({ ...current, [field]: '' }));
  };

  const handleNameBlur = (field) => () => {
    setForm((current) => ({ ...current, [field]: normalizeName(current[field]) }));
  };

  const handlePhoneBlur = () => {
    const normalizedPhone = normalizeIndonesiaPhone(form.phone, isId);
    setForm((current) => ({ ...current, phone: normalizedPhone.localNumber }));
    setFormErrors((current) => ({ ...current, phone: normalizedPhone.error }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const normalizedPhone = normalizeIndonesiaPhone(form.phone, isId);
    const nextForm = {
      ...form,
      first_name: normalizeName(form.first_name),
      last_name: normalizeName(form.last_name),
      phone: normalizedPhone.localNumber,
    };

    setForm(nextForm);
    setFormErrors({ phone: normalizedPhone.error });

    if (normalizedPhone.error) {
      addToast({
        type: 'error',
        title: isId ? 'Periksa Form' : 'Check Form',
        message: normalizedPhone.error,
      });
      return;
    }

    setSaving(true);
    try {
      await usersApi.update({
        ...nextForm,
        phone: normalizedPhone.value,
      });
      await refreshUser();
      addToast({
        type: 'success',
        title: isId ? 'Berhasil' : 'Success',
        message: isId ? 'Pengaturan akun disimpan.' : 'Account settings saved.',
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: isId ? 'Gagal' : 'Failed',
        message: err.message || (isId ? 'Gagal menyimpan pengaturan.' : 'Failed to save settings.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) {
      addToast({
        type: 'error',
        title: isId ? 'Email Tidak Ditemukan' : 'Email Missing',
        message: isId
          ? 'Muat ulang halaman atau login kembali sebelum reset password.'
          : 'Reload the page or sign in again before resetting your password.',
      });
      return;
    }
    setPasswordResetting(true);
    try {
      await authApi.requestPasswordReset(user.email);
      addToast({
        type: 'success',
        title: isId ? 'Email Reset Dikirim' : 'Reset Email Sent',
        message: isId
          ? 'Cek email Anda untuk mengatur ulang password.'
          : 'Check your email to reset your password.',
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: isId ? 'Gagal' : 'Failed',
        message: err.message || (isId ? 'Gagal mengirim email reset.' : 'Failed to send reset email.'),
      });
    } finally {
      setPasswordResetting(false);
    }
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      await usersApi.deactivateMe();
      logout();
      addToast({
        type: 'success',
        title: isId ? 'Akun Dinonaktifkan' : 'Account Deactivated',
        message: isId
          ? 'Akun Anda telah dinonaktifkan. Hubungi admin untuk mengaktifkan kembali.'
          : 'Your account has been deactivated. Contact an admin to reactivate it.',
      });
      navigate('/login', { replace: true });
    } catch (err) {
      addToast({
        type: 'error',
        title: isId ? 'Gagal' : 'Failed',
        message: err.message || (isId ? 'Gagal menonaktifkan akun.' : 'Failed to deactivate account.'),
      });
    } finally {
      setDeactivating(false);
      setDeactivateOpen(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await usersApi.deleteMe(deleteEmail);
      logout();
      addToast({
        type: 'success',
        title: isId ? 'Akun Dihapus' : 'Account Deleted',
        message: isId
          ? 'Akun Anda telah dihapus permanen.'
          : 'Your account has been permanently deleted.',
      });
      navigate('/login', { replace: true });
    } catch (err) {
      addToast({
        type: 'error',
        title: isId ? 'Gagal' : 'Failed',
        message: err.message || (isId ? 'Gagal menghapus akun.' : 'Failed to delete account.'),
      });
    } finally {
      setDeleting(false);
    }
  };

  const deleteMatchesEmail = deleteEmail.trim().toLowerCase() === (user?.email || '').toLowerCase();

  return (
    <>
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="grid grid-cols-1 gap-8 xl:grid-cols-[256px_minmax(0,768px)]"
    >
      <aside>
        <p className="px-3 text-sm font-semibold uppercase tracking-[0.08em] text-text-muted">
          {isId ? 'Pengaturan' : 'Settings'}
        </p>
        <nav className="mt-3 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left ${
                  active
                    ? 'bg-[#E6ECF5] font-semibold text-brand-dark'
                    : 'text-text-muted hover:bg-surface-muted'
                }`}
              >
                <Icon size={18} />
                <span>{isId ? tab.labelId : tab.labelEn}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="space-y-8">
        {activeTab === 'account' && (
          <>
            <header className="border-b border-surface-border pb-4">
              <h1 className="text-3xl font-bold text-text">
                {isId ? 'Pengaturan Akun' : 'Account Settings'}
              </h1>
              <p className="mt-2 text-text-muted">
                {isId
                  ? 'Kelola informasi dasar akun Anda dan keamanan autentikasi.'
                  : 'Manage your account basics and authentication security.'}
              </p>
            </header>

            <Card>
              <CardBody>
                <h2 className="text-xl font-semibold text-text">
                  {isId ? 'Informasi Profil' : 'Profile Information'}
                </h2>
                <form className="mt-5 space-y-4" onSubmit={handleSave}>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Input
                      label={isId ? 'Nama Depan' : 'First Name'}
                      value={form.first_name}
                      onChange={handleChange('first_name')}
                      onBlur={handleNameBlur('first_name')}
                      className="border border-surface-border"
                    />
                    <Input
                      label={isId ? 'Nama Belakang' : 'Last Name'}
                      value={form.last_name}
                      onChange={handleChange('last_name')}
                      onBlur={handleNameBlur('last_name')}
                      className="border border-surface-border"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#0A1D3D]/80">
                      {isId ? 'Nomor Telepon' : 'Phone Number'}
                    </label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                      <Select
                        value={phoneCountryCode}
                        onChange={(event) => setPhoneCountryCode(event.target.value)}
                        options={PHONE_COUNTRY_OPTIONS}
                        placeholder="Indonesia (+62)"
                        className="border border-surface-border"
                      />
                      <Input
                        value={form.phone}
                        onChange={handleChange('phone')}
                        onBlur={handlePhoneBlur}
                        placeholder="081234567890"
                        inputMode="tel"
                        maxLength={18}
                        error={formErrors.phone}
                        className="border border-surface-border"
                      />
                    </div>
                    {!formErrors.phone && (
                      <p className="mt-1 text-xs text-text-muted">
                        {isId
                          ? 'Gunakan nomor Indonesia 10-13 digit. Contoh: 081234567890 akan disimpan sebagai +6281234567890.'
                          : 'Use a 10-13 digit Indonesian number. Example: 081234567890 is saved as +6281234567890.'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#0A1D3D]/80">
                      {isId ? 'Tentang Saya' : 'About Me'}
                    </label>
                    <textarea
                      className="min-h-[120px] w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                      value={form.bio}
                      onChange={handleChange('bio')}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving}>
                      {saving ? (isId ? 'Menyimpan...' : 'Saving...') : isId ? 'Simpan Perubahan' : 'Save Changes'}
                    </Button>
                  </div>
                </form>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h2 className="text-xl font-semibold text-text">Email Address</h2>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <Input
                    label={isId ? 'Alamat Email Saat Ini' : 'Current Email Address'}
                    value={user?.email || ''}
                    disabled
                    className="border border-surface-border"
                  />
                  <Button variant="outline" disabled>
                    {isId ? 'Perbarui Email' : 'Update Email'}
                  </Button>
                </div>
                <p className="mt-3 text-sm text-text-muted">
                  {isId
                    ? 'Perubahan email belum tersedia di backend saat ini.'
                    : 'Email changes are not yet supported by the backend.'}
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h2 className="text-xl font-semibold text-text">Password</h2>
                <div className="mt-4 flex flex-col gap-4 rounded-lg border border-surface-border bg-surface-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-text">
                      {isId ? 'Reset lewat email' : 'Reset by email'}
                    </p>
                    <p className="mt-1 text-sm text-text-muted">
                      {isId
                        ? `Kami akan mengirim link reset password ke ${user?.email || 'email Anda'}.`
                        : `We will send a password reset link to ${user?.email || 'your email'}.`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={passwordResetting}
                    className="inline-flex cursor-pointer items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-light focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {passwordResetting
                      ? (isId ? 'Mengirim...' : 'Sending...')
                      : (isId ? 'Ubah Kata Sandi' : 'Change Password')}
                  </button>
                </div>
              </CardBody>
            </Card>

            <div className="border-t-2 border-red-100 pt-6">
              <h2 className="text-xl font-semibold text-red-700">
                {isId ? 'Zona Bahaya' : 'Danger Zone'}
              </h2>
              <p className="mt-2 text-sm text-text-muted">
                {isId
                  ? 'Tindakan ini berdampak langsung pada akses dan data akun Anda.'
                  : 'These actions directly affect your account access and data.'}
              </p>
              <div className="mt-4 space-y-3">
                <div className="flex flex-col gap-3 rounded-lg border border-red-100 bg-red-50/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-text">{isId ? 'Nonaktifkan Akun' : 'Deactivate Account'}</p>
                    <p className="mt-1 text-sm text-text-muted">
                      {isId
                        ? 'Sembunyikan profil Anda sementara tanpa menghapus data.'
                        : 'Temporarily hide your profile without deleting data.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeactivateOpen(true)}
                    className="inline-flex cursor-pointer items-center justify-center rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-2"
                  >
                    {isId ? 'Nonaktifkan' : 'Deactivate'}
                  </button>
                </div>
                <div className="flex flex-col gap-3 rounded-lg border border-red-100 bg-red-50/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-text">{isId ? 'Hapus Akun Permanen' : 'Delete Account Permanently'}</p>
                    <p className="mt-1 text-sm text-text-muted">
                      {isId
                        ? 'Menghapus semua data, lamaran, dan profil Anda selamanya.'
                        : 'Delete all of your data, applications, and profile permanently.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteEmail('');
                      setDeleteOpen(true);
                    }}
                    className="inline-flex cursor-pointer items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-2"
                  >
                    {isId ? 'Hapus Akun' : 'Delete Account'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'privacy' && (
          <>
            <header className="border-b border-surface-border pb-4">
              <h1 className="text-3xl font-bold text-text">
                {isId ? 'Kontrol Privasi' : 'Privacy Controls'}
              </h1>
            </header>
            <div className="space-y-4">
              <ToggleRow
                title={isId ? 'Terbuka untuk Peluang' : 'Open to Opportunities'}
                description={isId ? 'Izinkan HR menemukan profil profesional Anda.' : 'Allow HR to discover your professional profile.'}
                checked={privacy.openToOpportunities}
                onChange={(e) => setPrivacy((current) => ({ ...current, openToOpportunities: e.target.checked }))}
              />
              <ToggleRow
                title={isId ? 'Bagikan Profil dengan HR' : 'Share Profile with HR'}
                description={isId ? 'Bagikan informasi portofolio saat melamar.' : 'Share portfolio information when applying.'}
                checked={privacy.shareProfileWithHr}
                onChange={(e) => setPrivacy((current) => ({ ...current, shareProfileWithHr: e.target.checked }))}
              />
            </div>
          </>
        )}

        {activeTab === 'notifications' && (
          <>
            <header className="border-b border-surface-border pb-4">
              <h1 className="text-3xl font-bold text-text">
                {isId ? 'Preferensi Notifikasi' : 'Notification Preferences'}
              </h1>
            </header>
            <div className="space-y-4">
              <ToggleRow
                title={isId ? 'Rekomendasi Pekerjaan' : 'Job Recommendations'}
                description={isId ? 'Terima email untuk peluang yang cocok.' : 'Receive email alerts for matching opportunities.'}
                checked={notifications.jobRecommendations}
                onChange={(e) => setNotifications((current) => ({ ...current, jobRecommendations: e.target.checked }))}
              />
              <ToggleRow
                title={isId ? 'Pembaruan Lamaran' : 'Application Updates'}
                description={isId ? 'Dapatkan kabar saat status lamaran berubah.' : 'Get notified when application status changes.'}
                checked={notifications.applicationUpdates}
                onChange={(e) => setNotifications((current) => ({ ...current, applicationUpdates: e.target.checked }))}
              />
              <ToggleRow
                title={isId ? 'Pesan' : 'Messages'}
                description={isId ? 'Terima notifikasi untuk pesan baru.' : 'Receive notifications for new messages.'}
                checked={notifications.messages}
                onChange={(e) => setNotifications((current) => ({ ...current, messages: e.target.checked }))}
              />
            </div>
          </>
        )}

        {activeTab === 'system' && (
          <>
            <header className="border-b border-surface-border pb-4">
              <h1 className="text-3xl font-bold text-text">
                {isId ? 'Preferensi Sistem' : 'System Preferences'}
              </h1>
            </header>
            <Card>
              <CardBody className="space-y-5">
                <div>
                  <p className="text-sm font-semibold text-text">{isId ? 'Bahasa' : 'Language'}</p>
                  <div className="mt-3 flex gap-3">
                    <Button
                      variant={lang === 'id' ? 'primary' : 'outline'}
                      onClick={() => setLang('id')}
                    >
                      Bahasa Indonesia
                    </Button>
                    <Button
                      variant={lang === 'en' ? 'primary' : 'outline'}
                      onClick={() => setLang('en')}
                    >
                      English
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg border border-surface-border bg-surface-muted/60 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text">
                    <ShieldCheck size={16} className="text-brand" />
                    {isId ? 'Tema' : 'Theme'}
                  </div>
                  <p className="mt-2 text-sm text-text-muted">
                    {isId
                      ? 'Mode terang/gelap belum tersedia di aplikasi saat ini.'
                      : 'Light/dark mode is not available in the app yet.'}
                  </p>
                </div>
              </CardBody>
            </Card>
          </>
        )}
      </section>
    </MotionDiv>

    <Modal
      isOpen={deactivateOpen}
      onClose={() => {
        if (!deactivating) setDeactivateOpen(false);
      }}
      title={isId ? 'Nonaktifkan Akun?' : 'Deactivate Account?'}
      footer={(
        <>
          <button
            type="button"
            onClick={() => setDeactivateOpen(false)}
            disabled={deactivating}
            className="inline-flex cursor-pointer items-center justify-center rounded-md border border-surface-border px-4 py-2 text-sm font-medium text-brand transition-colors hover:bg-surface-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isId ? 'Batal' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleDeactivate}
            disabled={deactivating}
            className="inline-flex cursor-pointer items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deactivating
              ? (isId ? 'Menonaktifkan...' : 'Deactivating...')
              : (isId ? 'Nonaktifkan Akun' : 'Deactivate Account')}
          </button>
        </>
      )}
    >
      <div className="space-y-3 text-sm text-text-muted">
        <p>
          {isId
            ? 'Anda akan keluar dan tidak dapat masuk lagi sampai admin mengaktifkan akun Anda.'
            : 'You will be signed out and cannot sign in again until an admin reactivates your account.'}
        </p>
        <p className="font-medium text-red-700">
          {isId
            ? 'Data akun tidak dihapus.'
            : 'Your account data will not be deleted.'}
        </p>
      </div>
    </Modal>

    <Modal
      isOpen={deleteOpen}
      onClose={() => {
        if (!deleting) setDeleteOpen(false);
      }}
      title={isId ? 'Hapus Akun Permanen?' : 'Delete Account Permanently?'}
      footer={(
        <>
          <button
            type="button"
            onClick={() => setDeleteOpen(false)}
            disabled={deleting}
            className="inline-flex cursor-pointer items-center justify-center rounded-md border border-surface-border px-4 py-2 text-sm font-medium text-brand transition-colors hover:bg-surface-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isId ? 'Batal' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={deleting || !deleteMatchesEmail}
            className="inline-flex cursor-pointer items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting
              ? (isId ? 'Menghapus...' : 'Deleting...')
              : (isId ? 'Hapus Permanen' : 'Delete Permanently')}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {isId
            ? 'Tindakan ini tidak dapat dibatalkan. Semua data akun, profil, lamaran, dan CV akan dihapus.'
            : 'This action cannot be undone. All account, profile, application, and CV data will be deleted.'}
        </div>
        <Input
          label={isId ? `Ketik email Anda: ${user?.email || ''}` : `Type your email: ${user?.email || ''}`}
          value={deleteEmail}
          onChange={(event) => setDeleteEmail(event.target.value)}
          placeholder={user?.email || 'email@example.com'}
          disabled={deleting}
          className="border border-surface-border"
        />
      </div>
    </Modal>
    </>
  );
}
