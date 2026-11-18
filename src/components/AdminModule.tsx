import React, { useEffect, useState } from 'react';
import {
  Database,
  Download,
  Edit3,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { apiFetch, downloadWithAuth, formatBytes } from '../lib/api';
import {
  ROLE_LABELS,
  type Announcement,
  type AuditLog,
  type AuthUser,
  type BackupFile,
  type GtkStaff,
  type SchoolProfile,
  type UserRole,
} from '../types';

interface AdminModuleProps {
  user: AuthUser;
  onRefreshPublicProfile: () => void;
}

interface UserRow {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  nip_or_nik: string;
  phone: string;
  gtk_id: number | null;
  is_active: number;
  last_login_at: string | null;
}

export const AdminModule: React.FC<AdminModuleProps> = ({ user, onRefreshPublicProfile }) => {
  const isAdmin = user.role === 'ADMIN';
  const [subTab, setSubTab] = useState<'users' | 'profile' | 'audit' | 'backups'>(
    isAdmin ? 'users' : 'audit'
  );

  const [users, setUsers] = useState<UserRow[]>([]);
  const [gtkList, setGtkList] = useState<GtkStaff[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [profileForm, setProfileForm] = useState<SchoolProfile | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    full_name: '',
    role: 'GURU' as UserRole,
    password: '',
    nip_or_nik: '',
    phone: '',
    gtk_id: '',
    is_active: 1,
  });

  const [annForm, setAnnForm] = useState({
    title: '',
    category: 'Pengumuman' as Announcement['category'],
    summary: '',
    content: '',
    event_date: new Date().toISOString().slice(0, 10),
  });

  const loadData = async () => {
    try {
      const promises: Promise<unknown>[] = [
        apiFetch<AuditLog[]>('/api/admin/audit-logs?limit=100'),
        apiFetch<{ profile: SchoolProfile }>('/api/public/profile'),
        apiFetch<Announcement[]>('/api/announcements'),
      ];
      if (isAdmin) {
        promises.push(apiFetch<UserRow[]>('/api/admin/users'));
        promises.push(apiFetch<GtkStaff[]>('/api/gtk'));
        promises.push(apiFetch<BackupFile[]>('/api/admin/backups'));
      }
      const results = await Promise.all(promises);
      setAuditLogs(results[0] as AuditLog[]);
      setProfileForm((results[1] as { profile: SchoolProfile }).profile);
      setAnnouncements(results[2] as Announcement[]);
      if (isAdmin) {
        setUsers(results[3] as UserRow[]);
        setGtkList(results[4] as GtkStaff[]);
        setBackups(results[5] as BackupFile[]);
      }
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal memuat data administrasi.' });
    }
  };

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...userForm,
        gtk_id: userForm.gtk_id ? Number(userForm.gtk_id) : null,
      };
      if (editingUser) {
        await apiFetch(`/api/admin/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setFeedback({ type: 'success', msg: `Akun ${userForm.username} berhasil diperbarui.` });
      } else {
        await apiFetch('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback({ type: 'success', msg: `Akun baru ${userForm.username} berhasil dibuat.` });
      }
      setUserModalOpen(false);
      await loadData();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menyimpan akun pengguna.' });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm) return;
    try {
      await apiFetch('/api/school-profile', {
        method: 'PUT',
        body: JSON.stringify(profileForm),
      });
      setFeedback({ type: 'success', msg: 'Profil sekolah berhasil diperbarui.' });
      onRefreshPublicProfile();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menyimpan profil sekolah.' });
    }
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/announcements', {
        method: 'POST',
        body: JSON.stringify(annForm),
      });
      setAnnForm({
        title: '',
        category: 'Pengumuman',
        summary: '',
        content: '',
        event_date: new Date().toISOString().slice(0, 10),
      });
      setFeedback({ type: 'success', msg: 'Pengumuman baru berhasil dipublikasikan.' });
      onRefreshPublicProfile();
      await loadData();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menerbitkan pengumuman.' });
    }
  };

  const handleDeleteAnnouncement = async (id: number) => {
    try {
      await apiFetch(`/api/announcements/${id}`, { method: 'DELETE' });
      onRefreshPublicProfile();
      await loadData();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menghapus pengumuman.' });
    }
  };

  const handleCreateBackup = async () => {
    try {
      const res = await apiFetch<{ message: string }>('/api/admin/backups', { method: 'POST' });
      setFeedback({ type: 'success', msg: res.message });
      await loadData();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal membuat cadangan.' });
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    try {
      const res = await apiFetch<{ message: string }>(`/api/admin/backups/${encodeURIComponent(filename)}/restore`, {
        method: 'POST',
      });
      setFeedback({ type: 'success', msg: res.message });
      onRefreshPublicProfile();
      await loadData();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal memulihkan database.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Administrasi, Keamanan & Tata Kelola Sistem</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Pengelolaan akun multi-user (RBAC), publikasi informasi sekolah, audit log aktivitas, serta cadangan database.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setSubTab('users')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'users' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pengguna (RBAC)
            </button>
          )}
          <button
            type="button"
            onClick={() => setSubTab('profile')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'profile' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Profil & Pengumuman
          </button>
          <button
            type="button"
            onClick={() => setSubTab('audit')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'audit' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Audit Log
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setSubTab('backups')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'backups' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Backup & Recovery
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-center justify-between px-4 py-3 rounded-lg border text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <span>{feedback.msg}</span>
          <button type="button" onClick={() => setFeedback(null)} className="p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB: USERS RBAC */}
      {subTab === 'users' && isAdmin && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setEditingUser(null);
                setUserForm({
                  username: '',
                  email: '',
                  full_name: '',
                  role: 'GURU',
                  password: '',
                  nip_or_nik: '',
                  phone: '',
                  gtk_id: '',
                  is_active: 1,
                });
                setUserModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Akun Pengguna
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Username / Email</th>
                    <th className="py-3 px-4">Nama Lengkap</th>
                    <th className="py-3 px-4">Peran (RBAC)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Login Terakhir</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-slate-900">{u.username}</div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">{u.full_name}</td>
                      <td className="py-3 px-4 text-xs font-semibold text-emerald-700">{ROLE_LABELS[u.role]}</td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-700">
                        {u.is_active ? 'Aktif' : 'Non-Aktif'}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500">
                        {u.last_login_at ? u.last_login_at.slice(0, 16).replace('T', ' ') : '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUser(u);
                            setUserForm({
                              username: u.username,
                              email: u.email,
                              full_name: u.full_name,
                              role: u.role,
                              password: '',
                              nip_or_nik: u.nip_or_nik,
                              phone: u.phone,
                              gtk_id: u.gtk_id ? String(u.gtk_id) : '',
                              is_active: u.is_active,
                            });
                            setUserModalOpen(true);
                          }}
                          className="p-1.5 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: PROFIL & PENGUMUMAN */}
      {subTab === 'profile' && profileForm && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form onSubmit={handleSaveProfile} className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Identitas & Visi-Misi Sekolah</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Nama Sekolah</label>
                <input
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">NPSN</label>
                <input
                  value={profileForm.npsn}
                  onChange={(e) => setProfileForm({ ...profileForm, npsn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Akreditasi</label>
                <input
                  value={profileForm.accreditation}
                  onChange={(e) => setProfileForm({ ...profileForm, accreditation: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nama Kepala Sekolah</label>
                <input
                  value={profileForm.principal_name}
                  onChange={(e) => setProfileForm({ ...profileForm, principal_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Telepon</label>
                <input
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Visi Sekolah</label>
                <textarea
                  rows={3}
                  value={profileForm.vision}
                  onChange={(e) => setProfileForm({ ...profileForm, vision: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg">
                Simpan Perubahan Profil
              </button>
            </div>
          </form>

          <div className="lg:col-span-5 space-y-4">
            <form onSubmit={handlePublishAnnouncement} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h2 className="text-base font-semibold text-slate-900">Terbitkan Pengumuman / Berita</h2>
              <input
                required
                placeholder="Judul pengumuman *"
                value={annForm.title}
                onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={annForm.category}
                  onChange={(e) => setAnnForm({ ...annForm, category: e.target.value as Announcement['category'] })}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Pengumuman">Pengumuman</option>
                  <option value="Berita">Berita</option>
                  <option value="Agenda">Agenda</option>
                  <option value="Prestasi">Prestasi</option>
                </select>
                <input
                  type="date"
                  value={annForm.event_date}
                  onChange={(e) => setAnnForm({ ...annForm, event_date: e.target.value })}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <textarea
                required
                rows={3}
                placeholder="Isi pengumuman / berita *"
                value={annForm.content}
                onChange={(e) => setAnnForm({ ...annForm, content: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <button type="submit" className="w-full py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg">
                Publikasikan
              </button>
            </form>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">Daftar Pengumuman Aktif</h3>
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {announcements.map((a) => (
                  <div key={a.id} className="py-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">
                        {a.category} · {a.event_date}
                      </p>
                      <p className="text-sm font-medium text-slate-900 truncate">{a.title}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAnnouncement(a.id)}
                      className="p-1 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: AUDIT LOGS */}
      {subTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">Riwayat Aktivitas Pengguna (Audit Log)</h2>
            <p className="text-xs text-slate-500">Rekam jejak autentikasi, perubahan data, unggah/unduh dokumen, dan penilaian supervisi.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Pengguna</th>
                  <th className="py-3 px-4">Aksi</th>
                  <th className="py-3 px-4">Modul</th>
                  <th className="py-3 px-4">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {log.created_at.slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-semibold text-slate-900">{log.username}</span>{' '}
                      <span className="text-slate-500">({log.user_role})</span>
                    </td>
                    <td className="py-2.5 px-4 font-mono font-semibold text-emerald-700">{log.action}</td>
                    <td className="py-2.5 px-4 text-slate-700">{log.module}</td>
                    <td className="py-2.5 px-4 text-slate-600">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: BACKUP & RECOVERY */}
      {subTab === 'backups' && isAdmin && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Database className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">Cadangan & Pemulihan Database SQLite</h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Buat snapshot database konsisten secara berkala, unduh salinan aman, atau pulihkan sistem ke titik cadangan sebelumnya.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCreateBackup}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg whitespace-nowrap shrink-0"
            >
              Buat Backup Sekarang
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Nama Berkas Snapshot</th>
                  <th className="py-3 px-4">Ukuran</th>
                  <th className="py-3 px-4">Dibuat Pada</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backups.map((b) => (
                  <tr key={b.filename}>
                    <td className="py-3 px-4 font-mono text-xs text-slate-900">{b.filename}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">{formatBytes(b.size)}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">
                      {b.created_at.slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => downloadWithAuth(`/api/admin/backups/${encodeURIComponent(b.filename)}/download`, b.filename)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50"
                        >
                          <Download className="w-3.5 h-3.5" /> Unduh
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRestoreBackup(b.filename)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200 rounded-md hover:bg-amber-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Pulihkan
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {backups.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      Belum ada snapshot backup. Klik "Buat Backup Sekarang" untuk membuat cadangan pertama.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Add/Edit Modal */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">
                {editingUser ? 'Edit Akun Pengguna' : 'Buat Akun Pengguna Baru'}
              </h3>
              <button type="button" onClick={() => setUserModalOpen(false)} className="p-1 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveUser} className="p-6 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Username *</label>
                  <input
                    required
                    disabled={!!editingUser}
                    value={userForm.username}
                    onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    disabled={!!editingUser}
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-100"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nama Lengkap *</label>
                  <input
                    required
                    value={userForm.full_name}
                    onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Kategori Peran (RBAC)</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="ADMIN">Administrator</option>
                    <option value="KEPALA_SEKOLAH">Kepala Sekolah</option>
                    <option value="GURU">Guru</option>
                    <option value="STAF">Staf / Tendik</option>
                    <option value="ORANG_TUA">Orang Tua / Wali</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {editingUser ? 'Kata Sandi Baru (Opsional)' : 'Kata Sandi (min 8 kar) *'}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tautkan Data GTK (Opsional)</label>
                  <select
                    value={userForm.gtk_id}
                    onChange={(e) => setUserForm({ ...userForm, gtk_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">-- Tidak Ditautkan --</option>
                    {gtkList.map((g) => (
                      <option key={g.id} value={String(g.id)}>
                        {g.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Status Akun</label>
                  <select
                    value={userForm.is_active}
                    onChange={(e) => setUserForm({ ...userForm, is_active: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value={1}>Aktif</option>
                    <option value={0}>Non-Aktif</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setUserModalOpen(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg">
                  Simpan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
