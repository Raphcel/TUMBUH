import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardBody } from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { useToast } from '../context/ToastContext';
import { useTranslation } from '../context/LanguageContext';

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
        forgotMessage: 'Hubungi admin di support@tumbuh.me untuk reset password.',
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
        forgotMessage: 'Contact support@tumbuh.me to reset your password.',
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
            const user = await googleSignIn({ credential });
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

  /** Quick-access demo buttons — logs in with seeded accounts */
  const quickLogin = async (demoEmail) => {
    setErrors({});
    setLoading(true);
    try {
      const user = await login(demoEmail, 'password123');
      navigate(redirectTo || (user.role === 'hr' ? '/hr/dashboard' : '/student/dashboard'), { replace: Boolean(redirectTo) });
    } catch (err) {
      setErrors({ global: err.message || copy.demoFailed });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="h-10 w-10 rounded-lg bg-[#0f2854] flex items-center justify-center text-white font-bold text-2xl">
              T
            </div>
            <span className="text-2xl font-bold text-gray-900 tracking-tight">
              Tumbuh
            </span>
          </Link>
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold text-gray-900"
          >
            {copy.title}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-2 text-gray-600"
          >
            {copy.subtitle}
          </motion.p>
        </div>

        <Card>
          <CardBody>
            <motion.form
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
                    className="h-4 w-4 rounded border-gray-300 text-[#0f2854] focus:ring-[#0f2854]"
                  />
                  <label
                    htmlFor="remember-me"
                    className="ml-2 block text-sm text-gray-900"
                  >
                    {copy.remember}
                  </label>
                </div>
                <div className="text-sm">
                  <button
                    type="button"
                    onClick={() => addToast({ type: 'info', title: copy.forgotTitle, message: copy.forgotMessage })}
                    className="font-medium text-[#0f2854] hover:text-[#183a6d]"
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
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-xs uppercase tracking-wide text-gray-400">{copy.or}</span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>
                  <div className={googleLoading ? 'pointer-events-none opacity-60' : ''} ref={googleButtonRef} />
                </div>
              )}
            </motion.form>

            <div className="mt-6 text-center text-sm">
              <p className="text-gray-500">
                {copy.noAccount}{' '}
                <Link
                  to="/register"
                  className="font-semibold text-[#0f2854] hover:text-[#183a6d]"
                >
                  {copy.register}
                </Link>
              </p>
            </div>
          </CardBody>
        </Card>
      </motion.div>
    </div>
  );
}
