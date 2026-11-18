import React, { useState } from 'react';
import { Eye, EyeOff, Lock, ShieldCheck, User, X } from 'lucide-react';
import { apiFetch, setAuthToken } from '../lib/api';
import { ROLE_LABELS, type AuthUser, type UserRole } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
}

const DEMO_ACCOUNTS: { role: UserRole; username: string; password: string; desc: string }[] = [
  { role: 'ADMIN', username: 'admin', password: 'DarulUlum2026!', desc: 'Akses penuh sistem, RBAC, database & backup' },
  { role: 'KEPALA_SEKOLAH', username: 'kepsek', password: 'DarulUlum2026!', desc: 'Dashboard pimpinan, arsip & penilaian supervisi' },
  { role: 'GURU', username: 'guru1', password: 'DarulUlum2026!', desc: 'Data akademik, arsip izin & hasil supervisi pribadi' },
  { role: 'STAF', username: 'staf1', password: 'DarulUlum2026!', desc: 'Kelola biodata siswa, rombel & unggah arsip TU' },
  { role: 'ORANG_TUA', username: 'ortu1', password: 'DarulUlum2026!', desc: 'Pantau perkembangan akademik anak terhubung' },
];

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const performLogin = async (u: string, p: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: u, password: p }),
      });
      setAuthToken(res.token);
      onSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal login. Periksa kembali kredensial Anda.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(username, password);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            <h2 id="login-modal-title" className="text-base font-semibold text-slate-900">
              Masuk Portal SIMS SMA Darul Ulum Kepohbaru
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Tutup modal login"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="login-username" className="block text-sm font-medium text-slate-700 mb-1.5">
              Username atau Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username atau email sekolah"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1.5">
              Kata Sandi
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi"
                className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Memverifikasi Sesi...' : 'Masuk ke Dashboard'}
          </button>

          <div className="pt-4 border-t border-slate-200">
            <p className="text-xs font-medium text-slate-600 mb-2.5">
              Akses Cepat Uji Coba Multi-Peran (Password: <span className="font-mono text-slate-800">DarulUlum2026!</span>)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setUsername(acc.username);
                    setPassword(acc.password);
                    performLogin(acc.username, acc.password);
                  }}
                  className="text-left p-2.5 rounded-lg border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/50 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
                    <span>{ROLE_LABELS[acc.role]}</span>
                    <span className="font-mono text-emerald-700">{acc.username}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{acc.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
