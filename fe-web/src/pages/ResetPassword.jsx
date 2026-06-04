import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { authApi } from '../api/auth';
import { useToast } from '../context/ToastContext';
import { useTranslation } from '../context/LanguageContext';

const MotionDiv = motion.div;

export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();
  const { lang } = useTranslation();
  const isId = lang === 'id';
  const token = searchParams.get('token') || '';
  const copy = useMemo(() => (
    isId
      ? {
          title: 'Atur Ulang Password',
          subtitle: 'Masukkan password baru untuk akun TUMBUH Anda.',
          missingToken: 'Token reset tidak ditemukan. Minta link reset baru dari halaman pengaturan.',
          newPassword: 'Password Baru',
          confirmPassword: 'Konfirmasi Password',
          passwordRequired: 'Password wajib diisi',
          passwordLength: 'Password minimal 8 karakter',
          confirmRequired: 'Konfirmasi password wajib diisi',
          mismatch: 'Konfirmasi password tidak sama',
          submit: 'Simpan Password Baru',
          saving: 'Menyimpan...',
          successTitle: 'Password Diubah',
          successMessage: 'Silakan masuk dengan password baru Anda.',
          failedTitle: 'Gagal',
          login: 'Kembali ke Login',
        }
      : {
          title: 'Reset Password',
          subtitle: 'Enter a new password for your TUMBUH account.',
          missingToken: 'Reset token is missing. Request a new reset link from settings.',
          newPassword: 'New Password',
          confirmPassword: 'Confirm Password',
          passwordRequired: 'Password is required',
          passwordLength: 'Password must be at least 8 characters',
          confirmRequired: 'Password confirmation is required',
          mismatch: 'Password confirmation does not match',
          submit: 'Save New Password',
          saving: 'Saving...',
          successTitle: 'Password Updated',
          successMessage: 'Please sign in with your new password.',
          failedTitle: 'Failed',
          login: 'Back to Login',
        }
  ), [isId]);
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const setField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.password) nextErrors.password = copy.passwordRequired;
    else if (form.password.length < 8) nextErrors.password = copy.passwordLength;
    if (!form.confirm) nextErrors.confirm = copy.confirmRequired;
    else if (form.password !== form.confirm) nextErrors.confirm = copy.mismatch;
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!token || !validate()) return;

    setSaving(true);
    try {
      await authApi.confirmPasswordReset(token, form.password);
      addToast({ type: 'success', title: copy.successTitle, message: copy.successMessage });
      navigate('/login', { replace: true });
    } catch (err) {
      addToast({
        type: 'error',
        title: copy.failedTitle,
        message: err.message || copy.failedTitle,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <Link to="/" className="mb-4 inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0f2854] text-2xl font-bold text-white">
              T
            </div>
            <span className="text-2xl font-bold tracking-tight text-gray-900">Tumbuh</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{copy.title}</h1>
          <p className="mt-2 text-sm text-gray-600">{copy.subtitle}</p>
        </div>

        <Card>
          <CardBody>
            {!token ? (
              <div className="space-y-5">
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {copy.missingToken}
                </div>
                <Button to="/login" variant="outline" className="w-full">
                  {copy.login}
                </Button>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={handleSubmit}>
                <Input
                  label={copy.newPassword}
                  type="password"
                  value={form.password}
                  onChange={setField('password')}
                  error={errors.password}
                  className="border border-surface-border"
                />
                <Input
                  label={copy.confirmPassword}
                  type="password"
                  value={form.confirm}
                  onChange={setField('confirm')}
                  error={errors.confirm}
                  className="border border-surface-border"
                />
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? copy.saving : copy.submit}
                </Button>
              </form>
            )}
          </CardBody>
        </Card>
      </MotionDiv>
    </div>
  );
}
