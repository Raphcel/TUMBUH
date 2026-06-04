import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardBody } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { useToast } from '../context/ToastContext';
import { useTranslation } from '../context/LanguageContext';
import { authApi } from '../api/auth';

const MotionDiv = motion.div;
const MotionForm = motion.form;
const MotionH2 = motion.h2;
const MotionP = motion.p;

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, googleSignIn } = useAuth();
  const { lang } = useTranslation();
  const copy = lang === 'id'
    ? {
        emailRequired: 'Email wajib diisi',
        emailInvalid: 'Format email tidak valid',
        passwordRequired: 'Password wajib diisi',
        successTitle: 'Login Berhasil',
        successMessage: 'Selamat datang kembali',
        failedTitle: 'Login Gagal',
        failedMessage: 'Login gagal. Periksa email dan password Anda.',
        title: 'Masuk ke Akun Anda',
        subtitle: 'Selamat datang kembali! Silakan masukkan detail Anda',
        remember: 'Ingat saya',
        forgot: 'Lupa password?',
        forgotTitle: 'Reset Password',
        forgotSubtitle: 'Masukkan email akun Anda. Kami akan mengirim link reset password jika akun terdaftar.',
        forgotEmailLabel: 'Email akun',
        forgotEmailPlaceholder: 'nama@apps.ipb.ac.id',
        forgotSubmit: 'Kirim Link Reset',
        forgotSending: 'Mengirim...',
        forgotSentTitle: 'Cek Email Anda',
        forgotSentMessage: 'Jika akun terdaftar, link reset password telah dikirim.',
        forgotFailedTitle: 'Reset Password Gagal',
        forgotFailedMessage: 'Tidak dapat mengirim link reset password. Coba lagi nanti.',
        cancel: 'Batal',
        processing: 'Memproses...',
        submit: 'Masuk',
        noAccount: 'Belum punya akun?',
        register: 'Daftar sekarang',
        demoFailed: 'Login demo gagal',
        or: 'atau',
        googleSignIn: 'Masuk dengan Google',
        googleFailed: 'Login Google gagal.',
      }
    : {
        emailRequired: 'Email is required',
        emailInvalid: 'Invalid email format',
        passwordRequired: 'Password is required',
        successTitle: 'Login Successful',
        successMessage: 'Welcome back',
        failedTitle: 'Login Failed',
        failedMessage: 'Login failed. Please check your email and password.',
        title: 'Sign In to Your Account',
        subtitle: 'Welcome back. Please enter your details.',
        remember: 'Remember me',
        forgot: 'Forgot password?',
        forgotTitle: 'Password Reset',
        forgotSubtitle: 'Enter your account email. We will send a password reset link if the account exists.',
        forgotEmailLabel: 'Account email',
        forgotEmailPlaceholder: 'name@apps.ipb.ac.id',
        forgotSubmit: 'Send Reset Link',
        forgotSending: 'Sending...',
        forgotSentTitle: 'Check Your Email',
        forgotSentMessage: 'If the account exists, a password reset link has been sent.',
        forgotFailedTitle: 'Password Reset Failed',
        forgotFailedMessage: 'Could not send a password reset link. Please try again later.',
        cancel: 'Cancel',
        processing: 'Processing...',
        submit: 'Sign In',
        noAccount: "Don't have an account?",
        register: 'Register now',
        demoFailed: 'Demo login failed',
        or: 'or',
        googleSignIn: 'Sign in with Google',
        googleFailed: 'Google sign-in failed.',
      };

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const googleButtonRef = useRef(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const redirectTo = location.state?.from?.pathname
    ? `${location.state.from.pathname}${location.state.from.search || ''}`
    : null;

  // Animation controls
  const [shake, setShake] = useState(false);

  const { addToast } = useToast();

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return;
    const renderButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          setErrors({});
          setGoogleLoading(true);
          try {
            const user = await googleSignIn({ credential, login_only: true });
            navigate(redirectTo || (user.role === 'hr' ? '/hr/dashboard' : '/student/dashboard'), { replace: Boolean(redirectTo) });
            addToast({ title: copy.successTitle, message: `${copy.successMessage}, ${user.first_name}!`, type: 'success' });
          } catch (err) {
            const msg = err.message || copy.googleFailed;
            setErrors({ global: msg });
            setShake(true);
            setTimeout(() => setShake(false), 500);
            addToast({ title: copy.failedTitle, message: msg, type: 'error' });
          } finally {
            setGoogleLoading(false);
          }
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: googleButtonRef.current.offsetWidth || 360,
        text: 'signin_with',
      });
    };
    if (window.google?.accounts?.id) { renderButton(); return; }
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) { existing.addEventListener('load', renderButton, { once: true }); return () => existing.removeEventListener('load', renderButton); }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = renderButton;
    document.head.appendChild(script);
  }, [googleClientId, googleSignIn, navigate, redirectTo, copy.successTitle, copy.successMessage, copy.googleFailed, copy.failedTitle, addToast]);

  const validate = () => {
    const newErrors = {};
    if (!email) newErrors.email = copy.emailRequired;
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = copy.emailInvalid;

    if (!password) newErrors.password = copy.passwordRequired;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrors({});

    if (!validate()) {
      setShake(true);
      setTimeout(() => setShake(false), 500); // Reset shake
      return;
    }

    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(redirectTo || (user.role === 'hr' ? '/hr/dashboard' : '/student/dashboard'), { replace: Boolean(redirectTo) });
      addToast({
        title: 'Login Berhasil',
        message: `${copy.successMessage}, ${user.first_name}!`,
        type: 'success',
      });
    } catch (err) {
      const msg = err.message || copy.failedMessage;
      // specific error mapping could go here if API returns field errors
      setErrors({ global: msg });
      setShake(true);
      setTimeout(() => setShake(false), 500);
      addToast({
        title: copy.failedTitle,
        message: msg,
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const openResetPassword = () => {
    setResetEmail(email);
    setResetError('');
    setResetOpen(true);
  };

  const closeResetPassword = () => {
    if (resetLoading) return;
    setResetOpen(false);
    setResetError('');
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    const requestedEmail = resetEmail.trim();
    if (!requestedEmail) {
      setResetError(copy.emailRequired);
      return;
    }
    if (!/\S+@\S+\.\S+/.test(requestedEmail)) {
      setResetError(copy.emailInvalid);
      return;
    }

    setResetLoading(true);
    setResetError('');
    try {
      await authApi.requestPasswordReset(requestedEmail);
      setResetOpen(false);
      addToast({
        type: 'success',
        title: copy.forgotSentTitle,
        message: copy.forgotSentMessage,
      });
    } catch (err) {
      const msg = err.message || copy.forgotFailedMessage;
      setResetError(msg);
      addToast({
        type: 'error',
        title: copy.forgotFailedTitle,
        message: msg,
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E6ECF5] flex items-center justify-center p-4">
      <MotionDiv
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
          <MotionH2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold text-[#0A1D3D]"
          >
            {copy.title}
          </MotionH2>
          <MotionP
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-2 text-[#0A1D3D]/60"
          >
            {copy.subtitle}
          </MotionP>
        </div>

        <Card>
          <CardBody>
            <MotionForm
              onSubmit={handleLogin}
              className="space-y-6"
              animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
              transition={{ duration: 0.4 }}
            >
              {errors.global && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {errors.global}
                </div>
              )}

              <Input
                label="Email"
                type="text"
                placeholder="nama@apps.ipb.ac.id"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors({ ...errors, email: '' });
                }}
                error={errors.email}
              />
              <Input
                label="Password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors({ ...errors, password: '' });
                }}
                error={errors.password}
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 rounded border-[#E6ECF5] text-[#1E3A8A] focus:ring-[#1E3A8A]"
                  />
                  <label
                    htmlFor="remember-me"
                    className="ml-2 block text-sm text-[#0A1D3D]"
                  >
                    {copy.remember}
                  </label>
                </div>
                <div className="text-sm">
                  <button
                    type="button"
                    onClick={openResetPassword}
                    className="font-medium text-[#1E3A8A] hover:text-[#0A1D3D]"
                  >
                    {copy.forgot}
                  </button>
                </div>
              </div>

              <Button type="submit" variant="primary" className="text-white w-full" disabled={loading}>
                {loading ? copy.processing : copy.submit}
              </Button>

              {googleClientId && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-[#E6ECF5]" />
                    <span className="text-xs uppercase tracking-wide text-[#0A1D3D]/40">{copy.or}</span>
                    <div className="h-px flex-1 bg-[#E6ECF5]" />
                  </div>
                  <div className={googleLoading ? 'pointer-events-none opacity-60' : ''} ref={googleButtonRef} />
                </div>
              )}
            </MotionForm>

            <div className="mt-6 text-center text-sm">
              <p className="text-[#0A1D3D]/50">
                {copy.noAccount}{' '}
                <Link
                  to="/register"
                  className="font-semibold text-[#1E3A8A] hover:text-[#0A1D3D]"
                >
                  {copy.register}
                </Link>
              </p>
            </div>
          </CardBody>
        </Card>
      </MotionDiv>

      <Modal
        isOpen={resetOpen}
        onClose={closeResetPassword}
        title={copy.forgotTitle}
        footer={
          <>
            <Button type="button" variant="outline" onClick={closeResetPassword} disabled={resetLoading}>
              {copy.cancel}
            </Button>
            <Button type="submit" form="password-reset-request-form" disabled={resetLoading}>
              {resetLoading ? copy.forgotSending : copy.forgotSubmit}
            </Button>
          </>
        }
      >
        <form id="password-reset-request-form" className="space-y-4" onSubmit={handleResetPassword}>
          <p className="text-sm leading-6 text-[#0A1D3D]/70">{copy.forgotSubtitle}</p>
          <Input
            label={copy.forgotEmailLabel}
            type="email"
            placeholder={copy.forgotEmailPlaceholder}
            value={resetEmail}
            onChange={(event) => {
              setResetEmail(event.target.value);
              if (resetError) setResetError('');
            }}
            error={resetError}
          />
        </form>
      </Modal>
    </div>
  );
}
