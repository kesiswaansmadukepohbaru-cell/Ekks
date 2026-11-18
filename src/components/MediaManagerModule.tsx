import React, { useEffect, useState } from 'react';
import { Edit3, Image as ImageIcon, Plus, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { GalleryItem, SchoolProfile } from '../types';

interface MediaManagerModuleProps {
  onRefreshPublicProfile: () => void;
}

const DEFAULT_HERO_IMAGE = '/src/assets/images/hero_school_campus_1794984787946.jpg';

export const MediaManagerModule: React.FC<MediaManagerModuleProps> = ({
  onRefreshPublicProfile,
}) => {
  const [heroUrl, setHeroUrl] = useState(DEFAULT_HERO_IMAGE);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroPreview, setHeroPreview] = useState<string>('');
  const [heroManualUrl, setHeroManualUrl] = useState('');
  const [savingHero, setSavingHero] = useState(false);

  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Add / Edit Gallery Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [galFile, setGalFile] = useState<File | null>(null);
  const [galPreview, setGalPreview] = useState('');
  const [galForm, setGalForm] = useState({
    title: '',
    category: 'Akademik',
    event_date: new Date().toISOString().slice(0, 10),
    caption: '',
    image_url: '',
  });
  const [savingGal, setSavingGal] = useState(false);

  const loadMedia = async () => {
    setLoading(true);
    try {
      const [pubRes, galRes] = await Promise.all([
        apiFetch<{ profile: SchoolProfile }>('/api/public/profile'),
        apiFetch<GalleryItem[]>('/api/gallery'),
      ]);
      const currentHero = pubRes.profile.hero_image_url || DEFAULT_HERO_IMAGE;
      setHeroUrl(currentHero);
      setHeroManualUrl(currentHero);
      setGallery(galRes);
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal memuat daftar gambar.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, []);

  const handleHeroFileChange = (file: File | null) => {
    if (heroPreview) URL.revokeObjectURL(heroPreview);
    setHeroFile(file);
    if (file) {
      setHeroPreview(URL.createObjectURL(file));
    } else {
      setHeroPreview('');
    }
  };

  const handleSaveHero = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingHero(true);
    setFeedback(null);
    try {
      const fd = new FormData();
      if (heroFile) {
        fd.append('image', heroFile);
      } else {
        fd.append('image_url', heroManualUrl.trim());
      }
      const res = await apiFetch<{ hero_image_url: string; message: string }>('/api/media/hero', {
        method: 'POST',
        body: fd,
      });
      setHeroUrl(res.hero_image_url);
      setHeroManualUrl(res.hero_image_url);
      handleHeroFileChange(null);
      setFeedback({ type: 'success', msg: res.message });
      onRefreshPublicProfile();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal memperbarui gambar utama.' });
    } finally {
      setSavingHero(false);
    }
  };

  const handleResetHero = async () => {
    setSavingHero(true);
    try {
      const fd = new FormData();
      fd.append('image_url', DEFAULT_HERO_IMAGE);
      const res = await apiFetch<{ hero_image_url: string; message: string }>('/api/media/hero', {
        method: 'POST',
        body: fd,
      });
      setHeroUrl(res.hero_image_url);
      setHeroManualUrl(res.hero_image_url);
      handleHeroFileChange(null);
      setFeedback({ type: 'success', msg: 'Gambar utama dikembalikan ke foto kampus standar.' });
      onRefreshPublicProfile();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal mereset gambar utama.' });
    } finally {
      setSavingHero(false);
    }
  };

  const openAddGallery = () => {
    setEditingItem(null);
    setGalFile(null);
    if (galPreview) URL.revokeObjectURL(galPreview);
    setGalPreview('');
    setGalForm({
      title: '',
      category: 'Akademik',
      event_date: new Date().toISOString().slice(0, 10),
      caption: '',
      image_url: '',
    });
    setModalOpen(true);
  };

  const openEditGallery = (item: GalleryItem) => {
    setEditingItem(item);
    setGalFile(null);
    if (galPreview) URL.revokeObjectURL(galPreview);
    setGalPreview('');
    setGalForm({
      title: item.title,
      category: item.category,
      event_date: item.event_date,
      caption: item.caption,
      image_url: item.image_url,
    });
    setModalOpen(true);
  };

  const handleGalleryFileChange = (file: File | null) => {
    if (galPreview) URL.revokeObjectURL(galPreview);
    setGalFile(file);
    if (file) {
      setGalPreview(URL.createObjectURL(file));
    } else {
      setGalPreview('');
    }
  };

  const handleSaveGallery = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGal(true);
    setFeedback(null);
    try {
      const fd = new FormData();
      fd.append('title', galForm.title);
      fd.append('category', galForm.category);
      fd.append('event_date', galForm.event_date);
      fd.append('caption', galForm.caption);
      if (galFile) {
        fd.append('image', galFile);
      } else if (galForm.image_url) {
        fd.append('image_url', galForm.image_url);
      }

      if (editingItem) {
        await apiFetch(`/api/gallery/${editingItem.id}`, {
          method: 'PUT',
          body: fd,
        });
        setFeedback({ type: 'success', msg: `Foto "${galForm.title}" berhasil diperbarui.` });
      } else {
        await apiFetch('/api/gallery', {
          method: 'POST',
          body: fd,
        });
        setFeedback({ type: 'success', msg: `Foto baru "${galForm.title}" berhasil ditambahkan ke galeri.` });
      }

      setModalOpen(false);
      onRefreshPublicProfile();
      await loadMedia();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menyimpan foto galeri.' });
    } finally {
      setSavingGal(false);
    }
  };

  const handleDeleteGallery = async (item: GalleryItem) => {
    try {
      await apiFetch(`/api/gallery/${item.id}`, { method: 'DELETE' });
      setFeedback({ type: 'success', msg: `Foto "${item.title}" dihapus dari galeri.` });
      onRefreshPublicProfile();
      await loadMedia();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menghapus foto.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kelola Gambar & Galeri Sekolah</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Ubah gambar banner utama kampus dan kelola dokumentasi foto pada halaman Web Profil Sekolah.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddGallery}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg self-start whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" /> Tambah Foto Galeri
        </button>
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

      {/* Hero Image Management */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Gambar Utama Halaman Profil (Hero Kampus)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Rasio disarankan 16:9 (landscape). Format didukung: JPG, PNG, atau WEBP maksimal 8 MB.
            </p>
          </div>
          <button
            type="button"
            disabled={savingHero}
            onClick={handleResetHero}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 self-start"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset ke Default
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5 items-start">
          <div className="lg:col-span-6">
            <div className="aspect-[16/9] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
              <img
                src={heroPreview || heroUrl}
                alt="Pratinjau Gambar Utama Kampus"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = DEFAULT_HERO_IMAGE;
                }}
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2 font-mono truncate">
              {heroFile ? `Berkas dipilih: ${heroFile.name}` : `Sumber aktif: ${heroUrl}`}
            </p>
          </div>

          <form onSubmit={handleSaveHero} className="lg:col-span-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Unggah Gambar Baru dari Perangkat
              </label>
              <label className="flex items-center justify-center gap-2 px-4 py-6 border border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors text-sm text-slate-700">
                <Upload className="w-4 h-4 text-emerald-700" />
                <span>{heroFile ? heroFile.name : 'Pilih berkas JPG / PNG / WEBP...'}</span>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={(e) => handleHeroFileChange(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Atau Gunakan URL / Path Gambar
              </label>
              <input
                type="text"
                value={heroManualUrl}
                onChange={(e) => {
                  setHeroManualUrl(e.target.value);
                  if (heroFile) handleHeroFileChange(null);
                }}
                placeholder="/src/assets/images/... atau https://..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={savingHero}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg"
              >
                {savingHero ? 'Menyimpan...' : 'Simpan Gambar Utama'}
              </button>
              {heroFile && (
                <button
                  type="button"
                  onClick={() => handleHeroFileChange(null)}
                  className="px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Batalkan Pilihan
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Gallery Items Management */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Galeri Foto & Dokumentasi Kegiatan</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Klik "Ubah Gambar" pada salah satu kartu untuk mengganti foto, judul, atau keterangan.
          </p>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500">Memuat daftar galeri...</div>
        ) : gallery.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            Belum ada foto di galeri. Klik "Tambah Foto Galeri" untuk menambahkan foto pertama.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {gallery.map((item) => (
              <div key={item.id} className="border border-slate-200 rounded-xl overflow-hidden flex flex-col bg-slate-50">
                <div className="aspect-[4/3] bg-slate-200 overflow-hidden">
                  <img
                    src={item.image_url}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <p className="text-xs text-slate-500">
                      {item.category} · <span className="font-mono">{item.event_date}</span>
                    </p>
                    <h3 className="text-sm font-semibold text-slate-900 mt-1 line-clamp-1">{item.title}</h3>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{item.caption}</p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => openEditGallery(item)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:border-emerald-600 hover:text-emerald-700 rounded-lg"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Ubah Gambar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteGallery(item)}
                      className="p-1.5 text-slate-500 hover:text-red-600 bg-white border border-slate-200 rounded-lg hover:bg-red-50"
                      title="Hapus Foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Gallery Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-emerald-700" />
                <h3 className="text-base font-semibold text-slate-900">
                  {editingItem ? 'Ubah Gambar & Detail Galeri' : 'Tambah Foto Galeri Baru'}
                </h3>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGallery} className="p-6 space-y-4 overflow-y-auto">
              {(galPreview || galForm.image_url) && (
                <div className="aspect-[4/3] max-h-48 w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                  <img
                    src={galPreview || galForm.image_url}
                    alt="Pratinjau foto"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {editingItem ? 'Ganti Berkas Gambar (Opsional)' : 'Unggah Berkas Gambar (JPG / PNG / WEBP) *'}
                </label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  required={!editingItem && !galForm.image_url}
                  onChange={(e) => handleGalleryFileChange(e.target.files?.[0] || null)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Atau URL / Path Gambar</label>
                <input
                  type="text"
                  value={galForm.image_url}
                  onChange={(e) => setGalForm({ ...galForm, image_url: e.target.value })}
                  placeholder="/media/... atau https://..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Judul Foto / Dokumentasi *</label>
                <input
                  required
                  value={galForm.title}
                  onChange={(e) => setGalForm({ ...galForm, title: e.target.value })}
                  placeholder="Contoh: Upacara Hari Pendidikan Nasional 2026"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Kategori</label>
                  <select
                    value={galForm.category}
                    onChange={(e) => setGalForm({ ...galForm, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Fasilitas">Fasilitas</option>
                    <option value="Akademik">Akademik</option>
                    <option value="Teknologi">Teknologi</option>
                    <option value="Kesiswaan">Kesiswaan</option>
                    <option value="Kegiatan">Kegiatan</option>
                    <option value="Prestasi">Prestasi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Kegiatan</label>
                  <input
                    type="date"
                    value={galForm.event_date}
                    onChange={(e) => setGalForm({ ...galForm, event_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Keterangan / Deskripsi Singkat</label>
                <textarea
                  rows={2}
                  value={galForm.caption}
                  onChange={(e) => setGalForm({ ...galForm, caption: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm border border-slate-200 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingGal}
                  className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg"
                >
                  {savingGal ? 'Menyimpan...' : 'Simpan Gambar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
