import React, { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../api/admin';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Fingerprint,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

function formatJakartaTime(value) {
  if (!value) return '-';
  const date = new Date(String(value).includes('T') ? value : `${String(value).replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function levelClass(level) {
  if (level === 'error') return 'bg-red-50 text-red-700 border-red-100';
  if (level === 'warn') return 'bg-amber-50 text-amber-700 border-amber-100';
  return 'bg-emerald-50 text-emerald-700 border-emerald-100';
}

function ResultPanel({ result }) {
  if (!result) return <p className="text-sm text-gray-500">No verification run yet.</p>;
  return (
    <div className={`rounded-xl border p-3 text-sm ${result.valid ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-red-100 bg-red-50 text-red-800'}`}>
      <div className="font-semibold">{result.valid ? 'Valid' : 'Invalid'}</div>
      <div className="mt-1 break-words whitespace-pre-wrap">{result.reason || result.message}</div>
    </div>
  );
}

export function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('all');
  const [chainResult, setChainResult] = useState(null);
  const [tamperedHash, setTamperedHash] = useState(null);
  const [signatureResult, setSignatureResult] = useState(null);
  const [applicationId, setApplicationId] = useState('');
  const [error, setError] = useState('');

  const fetchEvents = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.auditEvents(200);
      setEntries(data.entries || []);
    } catch (err) {
      setError(err.message || 'Failed to load audit events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    const timer = setInterval(fetchEvents, 10000);
    return () => clearInterval(timer);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (level !== 'all' && entry.level !== level) return false;
      if (!needle) return true;
      return [
        entry.action,
        entry.userRole,
        entry.userEmail,
        entry.resource,
        entry.resourceId,
        entry.ip,
        entry.message,
        entry.detail,
        entry.eventHash,
      ].some((value) => String(value || '').toLowerCase().includes(needle));
    });
  }, [entries, level, query]);

  const stats = useMemo(() => {
    const total = entries.length;
    const allowed = entries.filter((entry) => entry.success === true).length;
    const warnings = entries.filter((entry) => entry.level === 'warn').length;
    const errors = entries.filter((entry) => entry.level === 'error').length;
    return {
      total,
      allowedRate: total ? Math.round((allowed / total) * 100) : 0,
      warnings,
      errors,
    };
  }, [entries]);

  const verifyChain = async () => {
    try {
      const data = await adminApi.verifyAuditChain();
      if (data.valid) {
        setTamperedHash(null);
        setChainResult({
          valid: true,
          reason: `${data.total} events checked. Legacy skipped: ${data.legacySkipped || 0}. Latest hash: ${data.latestHash}`,
        });
      } else {
        const te = data.tamperedEntry;
        setTamperedHash(te?.eventHash || null);
        const failInfo = data.firstFailure || {};
        let reason = `Chain broken at ${failInfo.file || '?'} line ${failInfo.line || '?'}: ${failInfo.reason || 'unknown'}`;
        if (te) {
          reason += `\n\nTampered entry → Action: ${te.action || '-'}, Actor: ${te.userEmail || te.userRole || '-'}, Resource: ${te.resource || '-'}${te.resourceId ? ' #' + te.resourceId : ''}, Hash: ${te.eventHash || '-'}`;
        }
        setChainResult({ valid: false, reason });
      }
    } catch (err) {
      setTamperedHash(null);
      setChainResult({ valid: false, reason: err.message || 'Chain verification failed.' });
    }
  };

  const verifySignature = async () => {
    if (!applicationId) {
      setSignatureResult({ valid: false, reason: 'Enter an application ID first.' });
      return;
    }
    try {
      const data = await adminApi.verifyApplicationSignature(applicationId);
      setSignatureResult({
        valid: data.valid,
        reason: `${data.reason} Algorithm: ${data.algorithm || '-'}`,
      });
    } catch (err) {
      setSignatureResult({ valid: false, reason: err.message || 'Signature verification failed.' });
    }
  };

  const cards = [
    { label: 'Audit events', value: stats.total, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Allowed rate', value: `${stats.allowedRate}%`, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Warnings', value: stats.warnings, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Errors', value: stats.errors, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="mt-1 text-gray-500">Admin security operations, event history, and integrity checks.</p>
        </div>
        <button
          onClick={fetchEvents}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${card.bg}`}>
                <Icon className={card.color} size={20} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="mt-1 text-sm text-gray-500">{card.label}</p>
            </div>
          );
        })}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Audit chain integrity</h2>
              <p className="text-sm text-gray-500">Verify the SHA-256 hash chain.</p>
            </div>
          </div>
          <button onClick={verifyChain} className="mb-3 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold hover:bg-gray-50">
            Verify chain
          </button>
          <ResultPanel result={chainResult} />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Fingerprint size={20} />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Application signature</h2>
              <p className="text-sm text-gray-500">Verify a signed application event.</p>
            </div>
          </div>
          <div className="mb-3 flex gap-2">
            <input
              value={applicationId}
              onChange={(event) => setApplicationId(event.target.value)}
              placeholder="Application ID"
              className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <button onClick={verifySignature} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold hover:bg-gray-50">
              Verify
            </button>
          </div>
          <ResultPanel result={signatureResult} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-bold text-gray-900">Event stream</h2>
            <p className="text-sm text-gray-500">Indonesian time, 24-hour format.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search events..."
                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 sm:w-72"
              />
            </div>
            <select
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              <option value="all">All levels</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>

        {error && <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">{error}</div>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">Signal</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Resource</th>
                <th className="px-5 py-3">Detail</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">Loading audit events...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">No matching audit events.</td></tr>
              ) : filtered.map((entry, index) => {
                const isTampered = tamperedHash && entry.eventHash === tamperedHash;
                return (
                <tr
                  key={`${entry.timestamp}-${entry.eventHash || index}`}
                  className={isTampered
                    ? 'border-b border-red-200 bg-red-50 ring-2 ring-inset ring-red-400'
                    : 'border-b border-gray-100 hover:bg-gray-50/60'}
                >
                  <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-gray-500">
                    <Clock3 className="mr-1 inline h-3.5 w-3.5" />
                    {formatJakartaTime(entry.timestamp)}
                  </td>
                  <td className="px-5 py-3.5">
                    {isTampered ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                        <AlertTriangle className="h-3 w-3" />
                        TAMPERED
                      </span>
                    ) : (
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${levelClass(entry.level)}`}>
                        {entry.level || 'info'}
                      </span>
                    )}
                  </td>
                  <td className={`px-5 py-3.5 font-semibold ${isTampered ? 'text-red-800' : 'text-gray-900'}`}>{entry.action || '-'}</td>
                  <td className="px-5 py-3.5">
                    <div className={`font-medium ${isTampered ? 'text-red-800' : 'text-gray-900'}`}>{entry.userEmail || entry.userRole || 'system'}</div>
                    <div className="text-xs text-gray-500">{entry.userId ? `ID ${entry.userId}` : 'internal'}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isTampered ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                      {entry.resource || 'system'}{entry.resourceId ? ` #${entry.resourceId}` : ''}
                    </span>
                  </td>
                  <td className={`max-w-xl px-5 py-3.5 ${isTampered ? 'text-red-700 font-semibold' : 'text-gray-600'}`}>
                    {isTampered ? '⚠ Hash chain integrity violation detected' : (entry.message || entry.detail || '-')}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
