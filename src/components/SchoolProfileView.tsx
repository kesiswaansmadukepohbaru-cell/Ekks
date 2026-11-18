import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Calendar,
  ChevronRight,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Search,
  X,
} from 'lucide-react';
import type { Announcement, AuthUser, GalleryItem, GtkStaff, SchoolProfile } from '../types';

interface SchoolProfileViewProps {
  profile: SchoolProfile | null;
  gtk: GtkStaff[];
  announcements: Announcement[];
  gallery: GalleryItem[];
  stats: {
    totalStudents: number;
    totalTeachers: number;
    totalStaff: number;
    totalClasses: number;
  };
  currentUser: AuthUser | null;
  onOpenLogin: () => void;
  onEnterPortal: () => void;
}

const FALLBACK_HERO = '/src/assets/images/hero_school_campus_1794984787946.jpg';

export const SchoolProfileView: React.FC<SchoolProfileViewProps> = ({
  profile,
  gtk,
  announcements,
  gallery,
  stats,
  currentUser,
  onOpenLogin,
  onEnterPortal,
}) => {
  const [gtkSearch, setGtkSearch] = useState('');
  const [gtkCategory, setGtkCategory] = useState<string>('Semua');
  const [announcementCategory, setAnnouncementCategory] = useState<string>('Semua');
  const [selectedArticle, setSelectedArticle] = useState<Announcement | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryItem | null>(null);

  const filteredGtk = useMemo(() => {
    return gtk.filter((g) => {
      const matchCat = gtkCategory === 'Semua' || g.category === gtkCategory;
      const q = gtkSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        g.full_name.toLowerCase().includes(q) ||
        g.position.toLowerCase().includes(q) ||
        g.subject.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [gtk, gtkSearch, gtkCategory]);

  const filteredAnnouncements = useMemo(() => {
    if (announcementCategory === 'Semua') return announcements;
    return announcements.filter((a) => a.category === announcementCategory);
  }, [announcements, announcementCategory]);

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="w-full max-w-5xl space-y-6 animate-pulse">
          <div className="h-12 bg-slate-200 rounded-lg w-1/3" />
          <div className="h-72 bg-slate-200 rounded-xl w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 exact zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#beranda"
            className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
          >
            {profile.name}
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#profil" className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0">
              Profil
            </a>
            <a href="#program" className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0">
              Program
            </a>
            <a href="#direktori-gtk" className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0">
              Direktori GTK
            </a>
            <a href="#berita-galeri" className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0">
              Berita & Galeri
            </a>
            <a href="#kontak" className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0">
              Kontak
            </a>
          </nav>

          <div className="shrink-0">
            {currentUser ? (
              <button
                type="button"
                onClick={onEnterPortal}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Buka Portal SIMS
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenLogin}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Masuk Portal SIMS
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="beranda" className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <p className="text-xs font-medium text-emerald-700 tracking-wide">
                  NPSN {profile.npsn} · Akreditasi {profile.accreditation} · Sejak {profile.founded_year}
                </p>
                <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight text-slate-900 leading-[1.15] text-balance">
                  Pendidikan Menengah Unggul, Berkarakter Islami, dan Siap Masa Depan
                </h1>
                <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                  Portal resmi dan Sistem Informasi Manajemen Sekolah Terintegrasi (SIMS) {profile.name},
                  Kecamatan {profile.district}, Kabupaten {profile.regency}. Mengintegrasikan profil institusi,
                  data akademik, arsip digital administrasi, dan supervisi kinerja berbasis instrumen mutu.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={currentUser ? onEnterPortal : onOpenLogin}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <span>{currentUser ? `Lanjut ke Dashboard (${currentUser.fullName})` : 'Akses Sistem Manajemen (SIMS)'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="#profil"
                  className="inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  Pelajari Profil Sekolah
                </a>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-72 sm:h-80 lg:h-full min-h-[320px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                <img
                  src={profile.hero_image_url || FALLBACK_HERO}
                  alt={`Kampus Utama ${profile.name}`}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = FALLBACK_HERO;
                  }}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 text-white">
                  <p className="text-xs text-slate-200">
                    {profile.address} · {profile.regency}, {profile.province}
                  </p>
                  <p className="text-sm font-semibold mt-0.5">
                    Kepala Sekolah: {profile.principal_name}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4-column quantitative metrics strip */}
          <div className="mt-10 pt-8 border-t border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-slate-500">Peserta Didik Aktif</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums mt-1">
                {stats.totalStudents}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Kelas X, XI, dan XII</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Guru & Pendidik</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums mt-1">
                {stats.totalTeachers}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Tersertifikasi & profesional</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Tenaga Kependidikan</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums mt-1">
                {stats.totalStaff}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Tata usaha, pustakawan & layanan</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Rombongan Belajar</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums mt-1">
                {stats.totalClasses}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Kurikulum Merdeka & MIPA/IPS</p>
            </div>
          </div>
        </div>
      </section>

      {/* Identitas, Sejarah, Visi, Misi & Struktur Organisasi */}
      <section id="profil" className="max-w-7xl mx-auto px-6 py-16 space-y-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Identitas & Sejarah Sekolah</h2>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{profile.history}</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Identitas Satuan Pendidikan</h3>
              <dl className="divide-y divide-slate-100 text-sm">
                <div className="py-2 flex justify-between gap-4">
                  <dt className="text-slate-500">Nama Sekolah</dt>
                  <dd className="font-medium text-slate-900 text-right">{profile.name}</dd>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <dt className="text-slate-500">NPSN / NSS</dt>
                  <dd className="font-mono text-slate-900 text-right">
                    {profile.npsn} / {profile.nss}
                  </dd>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <dt className="text-slate-500">Akreditasi</dt>
                  <dd className="font-medium text-emerald-700 text-right">{profile.accreditation}</dd>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <dt className="text-slate-500">Kepala Sekolah</dt>
                  <dd className="font-medium text-slate-900 text-right">{profile.principal_name}</dd>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <dt className="text-slate-500">Tahun Berdiri</dt>
                  <dd className="font-mono text-slate-900 text-right">{profile.founded_year}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-8">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-emerald-700">Visi Sekolah</h3>
                <p className="text-lg font-semibold text-slate-900 mt-1.5 leading-snug">
                  “{profile.vision}”
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Misi Sekolah</h3>
                <ol className="space-y-2.5 text-sm text-slate-700">
                  {profile.mission.map((m, idx) => (
                    <li key={idx} className="flex gap-3">
                      <span className="font-mono text-xs font-semibold text-emerald-700 pt-0.5 tabular-nums">
                        {String(idx + 1).padStart(2, '0')}.
                      </span>
                      <span>{m}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900 mb-2.5">Tujuan Strategis</h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-slate-600">
                  {profile.objectives.map((obj, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Struktur Organisasi */}
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Struktur Organisasi Sekolah</h2>
            <p className="text-sm text-slate-600 mt-1">
              Susunan pimpinan dan koordinator unit manajemen {profile.name}.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {profile.org_structure.map((org, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs text-emerald-700 font-medium">{org.role}</p>
                <p className="text-base font-semibold text-slate-900 mt-1">{org.name}</p>
                <p className="text-xs text-slate-500 mt-1">{org.division}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Program Sekolah & Prestasi */}
      <section id="program" className="bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Program Akademik & Unggulan</h2>
              <p className="text-sm text-slate-600 mt-1">
                Penyelenggaraan pembelajaran abad ke-21 yang memadukan ilmu pengetahuan, karakter, dan kewirausahaan.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {profile.programs.map((prog, idx) => (
                <div key={idx} className="border border-slate-200 rounded-xl p-5 bg-slate-50/60">
                  <p className="text-xs text-slate-500">{String(idx + 1).padStart(2, '0')} · {prog.category}</p>
                  <h3 className="text-base font-semibold text-slate-900 mt-1">{prog.title}</h3>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">{prog.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Prestasi & Rekognisi</h2>
              <p className="text-sm text-slate-600 mt-1">
                Capaian terkini peserta didik dan institusi di tingkat kabupaten hingga nasional.
              </p>
            </div>
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white">
              {profile.achievements.map((ach, idx) => (
                <div key={idx} className="p-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-500">
                      {ach.year} · Tingkat {ach.level}
                    </p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">{ach.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Direktori Guru dan Tenaga Kependidikan */}
      <section id="direktori-gtk" className="max-w-7xl mx-auto px-6 py-16 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Direktori Guru & Tenaga Kependidikan</h2>
            <p className="text-sm text-slate-600 mt-1">
              Daftar pendidik dan tenaga kependidikan aktif {profile.name}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={gtkSearch}
                onChange={(e) => setGtkSearch(e.target.value)}
                placeholder="Cari nama, jabatan, mapel..."
                className="pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
              {['Semua', 'Kepala Sekolah', 'Guru', 'Tenaga Kependidikan'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setGtkCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    gtkCategory === cat ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Nama Lengkap</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Jabatan</th>
                  <th className="py-3 px-4">Mata Pelajaran</th>
                  <th className="py-3 px-4">Pendidikan</th>
                  <th className="py-3 px-4 text-right">Mulai Tugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGtk.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-medium text-slate-900">{item.full_name}</td>
                    <td className="py-3 px-4 text-slate-600">{item.category}</td>
                    <td className="py-3 px-4 text-slate-700">{item.position}</td>
                    <td className="py-3 px-4 text-slate-600">{item.subject}</td>
                    <td className="py-3 px-4 text-slate-600">{item.education}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">{item.join_year}</td>
                  </tr>
                ))}
                {filteredGtk.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Tidak ada data pendidik atau tenaga kependidikan yang sesuai pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pengumuman, Berita & Galeri */}
      <section id="berita-galeri" className="bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-16 space-y-14">
          {/* Pengumuman & Berita */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Pengumuman, Agenda & Berita Sekolah</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Informasi resmi kegiatan akademik, kesiswaan, dan agenda sekolah terbaru.
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
                {['Semua', 'Pengumuman', 'Agenda', 'Prestasi', 'Berita'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setAnnouncementCategory(cat)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      announcementCategory === cat ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredAnnouncements.map((ann) => (
                <article
                  key={ann.id}
                  className="border border-slate-200 rounded-xl p-5 flex flex-col justify-between hover:border-slate-300 transition-colors"
                >
                  <div>
                    <p className="text-xs text-slate-500">
                      {ann.category} · <span className="font-mono tabular-nums">{ann.event_date}</span>
                    </p>
                    <h3 className="text-base font-semibold text-slate-900 mt-1.5">{ann.title}</h3>
                    <p className="text-sm text-slate-600 mt-2 line-clamp-2">{ann.summary}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setSelectedArticle(ann)}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
                    >
                      Baca Selengkapnya <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Galeri Dokumentasi */}
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Galeri Foto & Dokumentasi Kegiatan</h2>
              <p className="text-sm text-slate-600 mt-1">
                Dokumentasi fasilitas pembelajaran, praktikum, dan kegiatan siswa {profile.name}.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {gallery.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setSelectedPhoto(photo)}
                  className="text-left group border border-slate-200 rounded-xl overflow-hidden bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  <div className="aspect-[4/3] bg-slate-200 overflow-hidden">
                    <img
                      src={photo.image_url}
                      alt={photo.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-slate-500">
                      {photo.category} · <span className="font-mono tabular-nums">{photo.event_date}</span>
                    </p>
                    <h3 className="text-sm font-semibold text-slate-900 mt-1 line-clamp-1">{photo.title}</h3>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{photo.caption}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Informasi Layanan & Kontak */}
      <section id="kontak" className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-6 space-y-4">
            <h2 className="text-2xl font-bold text-slate-900">Informasi Layanan & Kontak Sekolah</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Layanan administrasi Tata Usaha, PPDB, legalisir ijazah, serta konsultasi akademik orang tua
              dilayani setiap hari kerja Senin–Sabtu pukul 07.00–14.30 WIB.
            </p>
            <div className="space-y-3 pt-2 text-sm text-slate-700">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-emerald-700 shrink-0 mt-1" />
                <span>
                  {profile.address}, Kec. {profile.district}, Kab. {profile.regency}, {profile.province} {profile.postal_code}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="font-mono tabular-nums">{profile.phone}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{profile.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Media Komunikasi Digital: {profile.social_links?.instagram} · {profile.social_links?.podcast}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <GraduationCap className="w-5 h-5 text-emerald-700" />
              <h3 className="text-base font-semibold text-slate-900">Portal Layanan Terintegrasi (SIMS)</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Kepala Sekolah, Guru, Tenaga Kependidikan, Administrator, serta Orang Tua/Wali Siswa dapat
              mengakses dashboard akademik, arsip digital administrasi, serta modul supervisi kinerja melalui akun masing-masing.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={currentUser ? onEnterPortal : onOpenLogin}
                className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {currentUser ? 'Masuk ke Ruang Kerja SIMS' : 'Login Akun Pengguna SIMS'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {profile.name} · Sistem Informasi Manajemen Sekolah Terintegrasi</p>
          <p>Kecamatan {profile.district}, Kabupaten {profile.regency}, {profile.province}</p>
        </div>
      </footer>

      {/* Article Reader Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <p className="text-xs text-slate-500">
                {selectedArticle.category} · <span className="font-mono">{selectedArticle.event_date}</span>
              </p>
              <button
                type="button"
                onClick={() => setSelectedArticle(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                aria-label="Tutup artikel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <h3 className="text-xl font-bold text-slate-900">{selectedArticle.title}</h3>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{selectedArticle.content}</p>
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-3xl bg-white rounded-xl overflow-hidden border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
                <span>{selectedPhoto.category} · {selectedPhoto.event_date}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                aria-label="Tutup foto"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-slate-900 max-h-[65vh] flex items-center justify-center">
              <img
                src={selectedPhoto.image_url}
                alt={selectedPhoto.title}
                referrerPolicy="no-referrer"
                className="max-h-[65vh] w-auto object-contain"
              />
            </div>
            <div className="p-5">
              <h3 className="text-base font-semibold text-slate-900">{selectedPhoto.title}</h3>
              <p className="text-sm text-slate-600 mt-1">{selectedPhoto.caption}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
