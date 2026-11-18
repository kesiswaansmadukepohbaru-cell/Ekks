import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Lock,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { apiFetch, downloadWithAuth, formatBytes, getAuthToken } from '../lib/api';
import {
  ROLE_LABELS,
  type ArchiveDocument,
  type ArchiveFolder,
  type AuthUser,
  type UserRole,
} from '../types';

interface ArchiveModuleProps {
  user: AuthUser;
}

const ALL_ROLES: UserRole[] = ['ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'STAF', 'ORANG_TUA'];

export const ArchiveModule: React.FC<ArchiveModuleProps> = ({ user }) => {
  const canUpload = ['ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'STAF'].includes(user.role);
  const canCreateFolder = ['ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'STAF'].includes(user.role);
  const canManageAccess = ['ADMIN', 'KEPALA_SEKOLAH', 'STAF'].includes(user.role);

  const [folders, setFolders] = useState<ArchiveFolder[]>([]);
  const [documents, setDocuments] = useState<ArchiveDocument[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [expandedRoots, setExpandedRoots] = useState<Record<number, boolean>>({});
  const [categoryFilter, setCategoryFilter] = useState('Semua');
  const [yearFilter, setYearFilter] = useState('Semua');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Modals
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderForm, setFolderForm] = useState({
    name: '',
    parent_id: '',
    category: 'Manajerial' as 'Manajerial' | 'Kewirausahaan' | 'Supervisi',
    academic_year: '2025/2026',
    description: '',
    allowed_roles: ['ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'STAF'] as UserRole[],
  });

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    folder_id: '',
    title: '',
    category: 'Manajerial' as 'Manajerial' | 'Kewirausahaan' | 'Supervisi',
    academic_year: '2025/2026',
    activity_name: '',
    description: '',
    allowed_roles: ['ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'STAF'] as UserRole[],
  });

  const [previewDoc, setPreviewDoc] = useState<ArchiveDocument | null>(null);
  const [previewText, setPreviewText] = useState<string>('');
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const [accessModalDoc, setAccessModalDoc] = useState<ArchiveDocument | null>(null);
  const [accessRoles, setAccessRoles] = useState<UserRole[]>([]);

  const loadArchive = async () => {
    setLoading(true);
    try {
      const [fRes, dRes] = await Promise.all([
        apiFetch<ArchiveFolder[]>('/api/archive/folders'),
        apiFetch<ArchiveDocument[]>('/api/archive/documents'),
      ]);
      setFolders(fRes);
      setDocuments(dRes);
      // Auto-expand root folders on first load
      if (Object.keys(expandedRoots).length === 0) {
        const exp: Record<number, boolean> = {};
        fRes.filter((f) => !f.parent_id).forEach((f) => {
          exp[f.id] = true;
        });
        setExpandedRoots(exp);
      }
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal memuat arsip digital.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArchive();
  }, []);

  const rootFolders = useMemo(() => folders.filter((f) => !f.parent_id), [folders]);
  const childrenByParent = useMemo(() => {
    const map = new Map<number, ArchiveFolder[]>();
    for (const f of folders) {
      if (f.parent_id) {
        const list = map.get(f.parent_id) || [];
        list.push(f);
        map.set(f.parent_id, list);
      }
    }
    return map;
  }, [folders]);

  const filteredDocuments = useMemo(() => {
    const q = search.trim().toLowerCase();
    const childIds = new Set<number>();
    if (selectedFolderId) {
      childIds.add(selectedFolderId);
      (childrenByParent.get(selectedFolderId) || []).forEach((c) => childIds.add(c.id));
    }

    return documents.filter((d) => {
      const matchFolder = !selectedFolderId || childIds.has(d.folder_id);
      const matchCat = categoryFilter === 'Semua' || d.category === categoryFilter;
      const matchYear = yearFilter === 'Semua' || d.academic_year === yearFilter;
      const matchSearch =
        !q ||
        d.title.toLowerCase().includes(q) ||
        d.original_filename.toLowerCase().includes(q) ||
        d.activity_name.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q);
      return matchFolder && matchCat && matchYear && matchSearch;
    });
  }, [documents, selectedFolderId, childrenByParent, categoryFilter, yearFilter, search]);

  const openUploadModal = () => {
    const defaultFolder =
      folders.find((f) => f.id === selectedFolderId) ||
      folders.find((f) => f.parent_id !== null) ||
      folders[0];
    setUploadFile(null);
    setUploadForm({
      folder_id: defaultFolder ? String(defaultFolder.id) : '',
      title: '',
      category: defaultFolder?.category || 'Manajerial',
      academic_year: '2025/2026',
      activity_name: '',
      description: '',
      allowed_roles: ['ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'STAF'],
    });
    setUploadModalOpen(true);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/archive/folders', {
        method: 'POST',
        body: JSON.stringify({
          ...folderForm,
          parent_id: folderForm.parent_id ? Number(folderForm.parent_id) : null,
        }),
      });
      setFolderModalOpen(false);
      setFeedback({ type: 'success', msg: `Folder "${folderForm.name}" berhasil dibuat.` });
      await loadArchive();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal membuat folder.' });
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setFeedback({ type: 'error', msg: 'Silakan pilih file yang akan diunggah.' });
      return;
    }
    const fd = new FormData();
    fd.append('file', uploadFile);
    fd.append('folder_id', uploadForm.folder_id);
    fd.append('title', uploadForm.title || uploadFile.name);
    fd.append('category', uploadForm.category);
    fd.append('academic_year', uploadForm.academic_year);
    fd.append('activity_name', uploadForm.activity_name);
    fd.append('description', uploadForm.description);
    fd.append('allowed_roles', JSON.stringify(uploadForm.allowed_roles));

    try {
      await apiFetch('/api/archive/documents', {
        method: 'POST',
        body: fd,
      });
      setUploadModalOpen(false);
      setFeedback({ type: 'success', msg: `Dokumen "${uploadForm.title || uploadFile.name}" berhasil diunggah.` });
      await loadArchive();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal mengunggah dokumen.' });
    }
  };

  const openPreview = async (doc: ArchiveDocument) => {
    setPreviewDoc(doc);
    setPreviewText('');
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl('');
    }
    setPreviewLoading(true);

    try {
      const token = getAuthToken();
      const res = await fetch(`/api/archive/documents/${doc.id}/preview`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Gagal memuat pratinjau dokumen.');
      const blob = await res.blob();
      if (doc.mime_type.startsWith('text/') || doc.original_filename.endsWith('.csv') || doc.original_filename.endsWith('.txt')) {
        const text = await blob.text();
        setPreviewText(text);
      } else {
        const url = URL.createObjectURL(blob);
        setPreviewBlobUrl(url);
      }
    } catch (err) {
      setPreviewText(err instanceof Error ? err.message : 'Pratinjau tidak tersedia.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSaveAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessModalDoc) return;
    try {
      await apiFetch(`/api/archive/documents/${accessModalDoc.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: accessModalDoc.title,
          description: accessModalDoc.description,
          allowed_roles: accessRoles,
        }),
      });
      setAccessModalDoc(null);
      setFeedback({ type: 'success', msg: 'Pengaturan hak akses dokumen diperbarui.' });
      await loadArchive();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal memperbarui hak akses.' });
    }
  };

  const handleDeleteDoc = async (doc: ArchiveDocument) => {
    try {
      await apiFetch(`/api/archive/documents/${doc.id}`, { method: 'DELETE' });
      setFeedback({ type: 'success', msg: `Dokumen "${doc.title}" telah dihapus.` });
      await loadArchive();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menghapus dokumen.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Arsip Digital & Dokumentasi Administrasi</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Pusat penyimpanan dokumen Manajerial, Kewirausahaan, dan Supervisi GTK terstruktur dengan kontrol akses peran.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreateFolder && (
            <button
              type="button"
              onClick={() => {
                setFolderForm({
                  name: '',
                  parent_id: selectedFolderId ? String(selectedFolderId) : '',
                  category: 'Manajerial',
                  academic_year: '2025/2026',
                  description: '',
                  allowed_roles: ['ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'STAF'],
                });
                setFolderModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap shrink-0"
            >
              <FolderPlus className="w-4 h-4" /> Buat Folder / Subfolder
            </button>
          )}
          {canUpload && (
            <button
              type="button"
              onClick={openUploadModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg whitespace-nowrap shrink-0"
            >
              <Upload className="w-4 h-4" /> Unggah Dokumen
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Folder & Subfolder Tree */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">Struktur Folder Arsip</h2>
            <button
              type="button"
              onClick={() => setSelectedFolderId(null)}
              className={`text-xs font-medium ${selectedFolderId === null ? 'text-emerald-700 font-semibold' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Semua Dokumen
            </button>
          </div>

          <div className="space-y-1">
            {rootFolders.map((root) => {
              const subs = childrenByParent.get(root.id) || [];
              const isExpanded = expandedRoots[root.id] ?? true;
              const isSelected = selectedFolderId === root.id;
              return (
                <div key={root.id} className="space-y-0.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setExpandedRoots((p) => ({ ...p, [root.id]: !isExpanded }))}
                      className="p-1 text-slate-400 hover:text-slate-700"
                      aria-label="Toggle subfolder"
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFolderId(root.id)}
                      className={`flex-1 flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-semibold transition-colors ${
                        isSelected ? 'bg-emerald-50 text-emerald-800' : 'text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {isExpanded ? <FolderOpen className="w-4 h-4 text-emerald-700 shrink-0" /> : <Folder className="w-4 h-4 text-emerald-700 shrink-0" />}
                        <span className="truncate">{root.name}</span>
                      </span>
                    </button>
                  </div>

                  {isExpanded && subs.length > 0 && (
                    <div className="pl-6 space-y-0.5">
                      {subs.map((sub) => {
                        const subSelected = selectedFolderId === sub.id;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => setSelectedFolderId(sub.id)}
                            className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${
                              subSelected ? 'bg-emerald-700 text-white font-medium' : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <Folder className={`w-3.5 h-3.5 shrink-0 ${subSelected ? 'text-white' : 'text-slate-400'}`} />
                              <span className="truncate">{sub.name}</span>
                            </span>
                            <span className={`font-mono text-[11px] tabular-nums ${subSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                              {sub.document_count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Document List & Search */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari judul dokumen, nama file, atau kegiatan..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="Semua">Semua Kategori</option>
                <option value="Manajerial">Manajerial</option>
                <option value="Kewirausahaan">Kewirausahaan</option>
                <option value="Supervisi">Supervisi</option>
              </select>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="Semua">Semua Tahun</option>
                <option value="2025/2026">2025/2026</option>
                <option value="2026/2027">2026/2027</option>
              </select>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Dokumen & Folder</th>
                    <th className="py-3 px-4">Kategori / Tahun</th>
                    <th className="py-3 px-4">Ukuran</th>
                    <th className="py-3 px-4">Akses Peran</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        Memuat dokumen arsip...
                      </td>
                    </tr>
                  ) : filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-500">
                        Tidak ada dokumen pada folder atau filter ini.
                      </td>
                    </tr>
                  ) : (
                    filteredDocuments.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4">
                          <div className="flex items-start gap-2.5">
                            <FileText className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900">{doc.title}</p>
                              <p className="text-xs text-slate-500">
                                {doc.folder_name} · <span className="font-mono">{doc.original_filename}</span>
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          <div className="font-medium text-slate-800">{doc.category}</div>
                          <div className="font-mono">{doc.academic_year}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-600">
                          {formatBytes(doc.file_size)}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {doc.allowed_roles.map((r) => ROLE_LABELS[r]).join(', ')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openPreview(doc)}
                              className="p-1.5 text-slate-600 hover:text-emerald-700 rounded-md hover:bg-slate-100"
                              title="Pratinjau Dokumen"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadWithAuth(`/api/archive/documents/${doc.id}/download`, doc.original_filename)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100"
                              title="Unduh Dokumen"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            {canManageAccess && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAccessModalDoc(doc);
                                  setAccessRoles(doc.allowed_roles);
                                }}
                                className="p-1.5 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100"
                                title="Atur Hak Akses"
                              >
                                <Lock className="w-4 h-4" />
                              </button>
                            )}
                            {(user.role === 'ADMIN' || user.role === 'KEPALA_SEKOLAH') && (
                              <button
                                type="button"
                                onClick={() => handleDeleteDoc(doc)}
                                className="p-1.5 text-slate-500 hover:text-red-600 rounded-md hover:bg-red-50"
                                title="Hapus Dokumen"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Create Folder Modal */}
      {folderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">Buat Folder / Subfolder Arsip</h3>
              <button type="button" onClick={() => setFolderModalOpen(false)} className="p-1 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateFolder} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nama Folder *</label>
                <input
                  required
                  value={folderForm.name}
                  onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
                  placeholder="Contoh: Laporan Kegiatan Semester Genap"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Folder Induk (Opsional)</label>
                  <select
                    value={folderForm.parent_id}
                    onChange={(e) => setFolderForm({ ...folderForm, parent_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">-- Folder Utama (Root) --</option>
                    {rootFolders.map((rf) => (
                      <option key={rf.id} value={String(rf.id)}>
                        {rf.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Kategori</label>
                  <select
                    value={folderForm.category}
                    onChange={(e) => setFolderForm({ ...folderForm, category: e.target.value as typeof folderForm.category })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Manajerial">Manajerial</option>
                    <option value="Kewirausahaan">Kewirausahaan</option>
                    <option value="Supervisi">Supervisi</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Izin Akses Peran</label>
                <div className="flex flex-wrap gap-3">
                  {ALL_ROLES.map((r) => (
                    <label key={r} className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={folderForm.allowed_roles.includes(r)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...folderForm.allowed_roles, r]
                            : folderForm.allowed_roles.filter((x) => x !== r);
                          setFolderForm({ ...folderForm, allowed_roles: next });
                        }}
                      />
                      {ROLE_LABELS[r]}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setFolderModalOpen(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg">
                  Buat Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">Unggah Dokumen ke Arsip Digital</h3>
              <button type="button" onClick={() => setUploadModalOpen(false)} className="p-1 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUploadDocument} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Pilih Berkas (PDF, Office, Gambar, CSV, TXT maks. 15MB) *</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt,.csv"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Judul Dokumen *</label>
                <input
                  required
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  placeholder="Contoh: SK Tim Penjaminan Mutu Sekolah 2026"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Folder Tujuan *</label>
                  <select
                    required
                    value={uploadForm.folder_id}
                    onChange={(e) => setUploadForm({ ...uploadForm, folder_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {folders.map((f) => (
                      <option key={f.id} value={String(f.id)}>
                        {f.parent_id ? `↳ ${f.name}` : f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Kategori</label>
                  <select
                    value={uploadForm.category}
                    onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value as typeof uploadForm.category })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Manajerial">Manajerial</option>
                    <option value="Kewirausahaan">Kewirausahaan</option>
                    <option value="Supervisi">Supervisi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tahun Pelajaran</label>
                  <input
                    value={uploadForm.academic_year}
                    onChange={(e) => setUploadForm({ ...uploadForm, academic_year: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nama Kegiatan</label>
                  <input
                    value={uploadForm.activity_name}
                    onChange={(e) => setUploadForm({ ...uploadForm, activity_name: e.target.value })}
                    placeholder="Opsional"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Hak Akses Dokumen</label>
                <div className="flex flex-wrap gap-3">
                  {ALL_ROLES.map((r) => (
                    <label key={r} className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={uploadForm.allowed_roles.includes(r)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...uploadForm.allowed_roles, r]
                            : uploadForm.allowed_roles.filter((x) => x !== r);
                          setUploadForm({ ...uploadForm, allowed_roles: next });
                        }}
                      />
                      {ROLE_LABELS[r]}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setUploadModalOpen(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg">
                  Unggah Sekarang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-4xl bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{previewDoc.title}</h3>
                <p className="text-xs text-slate-500 font-mono">
                  {previewDoc.original_filename} · {formatBytes(previewDoc.file_size)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadWithAuth(`/api/archive/documents/${previewDoc.id}/download`, previewDoc.original_filename)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" /> Unduh
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewDoc(null);
                    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
                  }}
                  className="p-1.5 text-slate-500 hover:text-slate-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              {previewLoading ? (
                <div className="py-12 text-center text-sm text-slate-500">Memuat pratinjau berkas...</div>
              ) : previewText ? (
                <pre className="p-4 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {previewText}
                </pre>
              ) : previewBlobUrl && previewDoc.mime_type.startsWith('image/') ? (
                <img src={previewBlobUrl} alt={previewDoc.title} className="max-h-[65vh] mx-auto rounded-lg" />
              ) : previewBlobUrl && previewDoc.mime_type === 'application/pdf' ? (
                <iframe src={previewBlobUrl} title={previewDoc.title} className="w-full h-[65vh] border border-slate-200 rounded-lg bg-white" />
              ) : (
                <div className="py-12 text-center space-y-3">
                  <p className="text-sm text-slate-600">
                    Format berkas <span className="font-mono">{previewDoc.original_filename}</span> siap diunduh untuk dibuka di aplikasi perkantoran.
                  </p>
                  <button
                    type="button"
                    onClick={() => downloadWithAuth(`/api/archive/documents/${previewDoc.id}/download`, previewDoc.original_filename)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg"
                  >
                    Unduh Berkas
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Document Access Permissions Modal */}
      {accessModalDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">Pengaturan Hak Akses Dokumen</h3>
              <button type="button" onClick={() => setAccessModalDoc(null)} className="p-1 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveAccess} className="p-6 space-y-4">
              <p className="text-sm font-medium text-slate-800">{accessModalDoc.title}</p>
              <div className="space-y-2">
                {ALL_ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={accessRoles.includes(r)}
                      onChange={(e) => {
                        setAccessRoles((prev) =>
                          e.target.checked ? [...prev, r] : prev.filter((x) => x !== r)
                        );
                      }}
                    />
                    {ROLE_LABELS[r]}
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setAccessModalDoc(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg">
                  Simpan Akses
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
