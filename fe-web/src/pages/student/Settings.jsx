import React, { useEffect, useState } from 'react';
import { Bell, LockKeyhole, Monitor, ShieldCheck, UserRoundCog } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usersApi } from '../../api/users';
import { useTranslation } from '../../context/LanguageContext';
import { motion } from 'framer-motion';

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
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();
  const { lang, setLang } = useTranslation();
  const isId = lang === 'id';
  const [activeTab, setActiveTab] = useState('account');
  const [saving, setSaving] = useState(false);
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
      phone: user?.phone || '',
      bio: user?.bio || '',
    });
  }, [user]);

  const handleChange = (field) => (e) => {
    setForm((current) => ({ ...current, [field]: e.target.value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await usersApi.update(form);
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

  return (
    <motion.div
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
                      className="border border-surface-border"
                    />
                    <Input
                      label={isId ? 'Nama Belakang' : 'Last Name'}
                      value={form.last_name}
                      onChange={handleChange('last_name')}
                      className="border border-surface-border"
                    />
                  </div>
                  <Input
                    label={isId ? 'Nomor Telepon' : 'Phone Number'}
                    value={form.phone}
                    onChange={handleChange('phone')}
                    className="border border-surface-border"
                  />
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
                <div className="mt-4 max-w-md space-y-4">
                  <Input
                    label={isId ? 'Kata Sandi Saat Ini' : 'Current Password'}
                    type="password"
                    disabled
                    className="border border-surface-border"
                  />
                  <Input
                    label={isId ? 'Kata Sandi Baru' : 'New Password'}
                    type="password"
                    disabled
                    className="border border-surface-border"
                  />
                  <Button disabled>{isId ? 'Ubah Kata Sandi' : 'Change Password'}</Button>
                </div>
              </CardBody>
            </Card>

            <div className="border-t-2 border-red-100 pt-6">
              <h2 className="text-xl font-semibold text-red-700">
                {isId ? 'Zona Bahaya' : 'Danger Zone'}
              </h2>
              <p className="mt-2 text-sm text-text-muted">
                {isId
                  ? 'Tindakan di area ini belum aktif di backend.'
                  : 'Actions in this area are not active in the backend yet.'}
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
                  <Button variant="outline" disabled className="border-red-300 text-red-700">
                    {isId ? 'Nonaktifkan' : 'Deactivate'}
                  </Button>
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
                  <Button variant="danger" disabled>
                    {isId ? 'Hapus Akun' : 'Delete Account'}
                  </Button>
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
    </motion.div>
  );
}
