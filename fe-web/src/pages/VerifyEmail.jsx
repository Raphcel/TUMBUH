import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { authApi } from '../api/auth';
import { useTranslation } from '../context/LanguageContext';

export function VerifyEmail() {
  const [params] = useSearchParams();
  const { lang } = useTranslation();
  const isId = lang === 'id';
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      setMessage(isId ? 'Token verifikasi tidak ditemukan.' : 'Verification token is missing.');
      return;
    }

    authApi
      .verifyEmail(token)
      .then((data) => {
        setStatus('success');
        setMessage(data.message || (isId ? 'Email berhasil diverifikasi.' : 'Email verified successfully.'));
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.message || (isId ? 'Verifikasi email gagal.' : 'Email verification failed.'));
      });
  }, [isId, params]);

  return (
    <div className="min-h-screen bg-[#E6ECF5] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardBody className="text-center space-y-5">
          <div className={`mx-auto h-12 w-12 rounded-full flex items-center justify-center font-bold ${
            status === 'success' ? 'bg-green-100 text-green-700' : status === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {status === 'loading' ? '...' : status === 'success' ? 'OK' : '!'}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0A1D3D]">
              {status === 'loading'
                ? (isId ? 'Memverifikasi email...' : 'Verifying email...')
                : status === 'success'
                  ? (isId ? 'Email Terverifikasi' : 'Email Verified')
                  : (isId ? 'Verifikasi Gagal' : 'Verification Failed')}
            </h1>
            <p className="mt-2 text-[#0A1D3D]/60">{message}</p>
          </div>
          <Button to="/login" className="w-full">
            {isId ? 'Masuk' : 'Sign In'}
          </Button>
          <Link to="/" className="block text-sm text-[#0A1D3D]/50 hover:text-[#0A1D3D]">
            {isId ? 'Kembali ke beranda' : 'Back to home'}
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
