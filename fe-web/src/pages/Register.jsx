import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Card, CardBody } from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { useTranslation } from '../context/LanguageContext';

export function Register() {
  const navigate = useNavigate();
  const { register, googleSignIn } = useAuth();
  const { lang } = useTranslation();
  const isId = lang === 'id';

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role: 'student',
    password: '',
    confirm: '',
  });
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const googleButtonRef = useRef(null);
  const formRef = useRef(form);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    // Clear error for this field when user types
    if (errors[key]) {
      setErrors({ ...errors, [key]: '' });
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!form.first_name) newErrors.first_name = isId ? 'Nama depan wajib diisi' : 'First name is required';
    if (!form.last_name) newErrors.last_name = isId ? 'Nama belakang wajib diisi' : 'Last name is required';

    if (!form.email) newErrors.email = isId ? 'Email wajib diisi' : 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = isId ? 'Format email tidak valid' : 'Invalid email format';
    else if (form.role === 'student' && !form.email.endsWith('ipb.ac.id')) newErrors.email = isId ? 'Gunakan email institusi IPB' : 'Use an IPB institutional email';

    if (!form.password) newErrors.password = isId ? 'Password wajib diisi' : 'Password is required';
    else if (form.password.length < 8) newErrors.password = isId ? 'Password minimal 8 karakter' : 'Password must be at least 8 characters';

    if (form.password !== form.confirm) {
      newErrors.confirm = isId ? 'Password tidak cocok' : 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => { formRef.current = form; }, [form]);

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return;

    const renderButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          setErrors({});
          setSuccess('');

          const { role, first_name, last_name } = formRef.current;
          const nameErrors = {};
          if (role === 'hr') {
            if (!first_name.trim()) nameErrors.first_name = isId ? 'Nama depan wajib diisi untuk HR' : 'First name is required for HR';
            if (!last_name.trim()) nameErrors.last_name = isId ? 'Nama belakang wajib diisi untuk HR' : 'Last name is required for HR';
          }
          if (Object.keys(nameErrors).length > 0) {
            setErrors(nameErrors);
            setShake(true);
            setTimeout(() => setShake(false), 500);
            return;
          }

          setGoogleLoading(true);
          try {
            const user = await googleSignIn({
              credential,
              role,
              first_name: first_name.trim() || null,
              last_name: last_name.trim() || null,
            });
            navigate(user.role === 'hr' ? '/hr/dashboard' : '/student/dashboard');
          } catch (err) {
            setErrors({ global: err.message || (isId ? 'Pendaftaran Google gagal.' : 'Google sign-up failed.') });
            setShake(true);
            setTimeout(() => setShake(false), 500);
          } finally {
            setGoogleLoading(false);
          }
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: googleButtonRef.current.offsetWidth || 360,
        text: 'signup_with',
      });
    };

    if (window.google?.accounts?.id) {
      renderButton();
      return;
    }

    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', renderButton, { once: true });
      return () => existing.removeEventListener('load', renderButton);
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = renderButton;
    document.head.appendChild(script);
  }, [googleClientId, googleSignIn, isId, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSuccess('');

    if (!validate()) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setLoading(true);
    try {
      const data = await register({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        password: form.password,
        role: form.role,
      });
      setSuccess(data.message || (isId ? 'Pendaftaran berhasil. Periksa email untuk verifikasi.' : 'Registration successful. Check your email to verify your account.'));
    } catch (err) {
      setErrors({ global: err.message || (isId ? 'Pendaftaran gagal. Silakan coba lagi.' : 'Registration failed. Please try again.') });
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E6ECF5] flex items-center justify-center p-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <img src="/tumbuh.svg" alt="tumbuh." className="h-10 w-10" />
            <span className="text-2xl font-bold text-[#0A1D3D] tracking-tight">
              tumbuh.
            </span>
          </Link>
          <h2 className="text-2xl font-bold text-[#0A1D3D]">{isId ? 'Buat Akun Baru' : 'Create a New Account'}</h2>
          <p className="mt-2 text-[#0A1D3D]/60">
            {isId ? 'Bergabunglah dengan komunitas karier IPB.' : 'Join the IPB career community.'}
          </p>
        </div>

        <Card>
          <CardBody>
            <motion.form
              onSubmit={handleSubmit}
              className="space-y-4"
              animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
              transition={{ duration: 0.4 }}
            >
              {errors.global && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {errors.global}
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                  {success}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label={isId ? 'Nama Depan' : 'First Name'}
                  placeholder="Budi"
                  value={form.first_name}
                  onChange={set('first_name')}
                  error={errors.first_name}
                />
                <Input
                  label={isId ? 'Nama Belakang' : 'Last Name'}
                  placeholder="Santoso"
                  value={form.last_name}
                  onChange={set('last_name')}
                  error={errors.last_name}
                />
              </div>
              <Input
                label={form.role === 'student' ? (isId ? 'Email Institusi (IPB)' : 'Institutional Email (IPB)') : 'Email'}
                type="text"
                placeholder={form.role === 'student' ? 'budi@apps.ipb.ac.id' : 'hr@company.com'}
                value={form.email}
                onChange={set('email')}
                error={errors.email}
              />
              <Select
                label={isId ? 'Peran' : 'Role'}
                value={form.role}
                onChange={set('role')}
                options={[
                  { label: isId ? 'Mahasiswa' : 'Student', value: 'student' },
                  { label: isId ? 'Perusahaan (HR)' : 'Company (HR)', value: 'hr' },
                ]}
              />
              <Input
                label="Password"
                type="password"
                placeholder="********"
                value={form.password}
                onChange={set('password')}
                error={errors.password}
              />
              <Input
                label={isId ? 'Konfirmasi Password' : 'Confirm Password'}
                type="password"
                placeholder="********"
                value={form.confirm}
                onChange={set('confirm')}
                error={errors.confirm}
              />

              <div className="block text-sm text-[#0A1D3D] pt-2">
                {isId ? 'Dengan mendaftar, Anda menyetujui ' : 'By registering, you agree to our '}
                <button
                  type="button"
                  onClick={() => window.open('/terms', '_blank')}
                  className="text-[#1E3A8A] font-medium hover:underline"
                >
                  {isId ? 'Syarat & Ketentuan' : 'Terms & Conditions'}
                </button>{' '}
                {isId ? 'kami.' : '.'}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (isId ? 'Memproses...' : 'Processing...') : (isId ? 'Daftar' : 'Register')}
              </Button>

              {googleClientId && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-[#E6ECF5]" />
                    <span className="text-xs uppercase tracking-wide text-[#0A1D3D]/40">
                      {isId ? 'atau' : 'or'}
                    </span>
                    <div className="h-px flex-1 bg-[#E6ECF5]" />
                  </div>
                  <div className={googleLoading ? 'pointer-events-none opacity-60' : ''} ref={googleButtonRef} />
                  {form.role === 'hr' && (
                    <p className="text-xs text-[#0A1D3D]/50">
                      {isId
                        ? 'Untuk HR, isi nama depan dan belakang di atas sebelum daftar dengan Google.'
                        : 'For HR, fill first and last name above before signing up with Google.'}
                    </p>
                  )}
                </div>
              )}
            </motion.form>

            <div className="mt-6 text-center text-sm">
              <p className="text-[#0A1D3D]/50">
                {isId ? 'Sudah punya akun?' : 'Already have an account?'}{' '}
                <Link
                  to="/login"
                  className="font-semibold text-[#1E3A8A] hover:text-[#0A1D3D]"
                >
                  {isId ? 'Masuk di sini' : 'Sign in here'}
                </Link>
              </p>
            </div>
          </CardBody>
        </Card>
      </motion.div>
    </div>
  );
}
