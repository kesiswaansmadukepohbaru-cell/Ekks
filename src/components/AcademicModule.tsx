import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Download,
  Edit3,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { apiFetch, downloadWithAuth } from '../lib/api';
import type {
  AcademicYear,
  AuthUser,
  GtkStaff,
  SchoolClass,
  Student,
  StudentAcademicRecord,
} from '../types';

interface AcademicModuleProps {
  user: AuthUser;
}

export const AcademicModule: React.FC<AcademicModuleProps> = ({ user }) => {
  const canEdit = user.role === 'ADMIN' || user.role === 'STAF';
  const isParent = user.role === 'ORANG_TUA';

  const [subTab, setSubTab] = useState<'students' | 'classes' | 'gtk' | 'years'>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [gtkList, setGtkList] = useState<GtkStaff[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState<string>('Semua');
  const [statusFilter, setStatusFilter] = useState<string>('Semua');
  const [gtkCategoryFilter, setGtkCategoryFilter] = useState<string>('Semua');

  // Modals
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentForm, setStudentForm] = useState({
    nis: '',
    nisn: '',
    full_name: '',
    gender: 'L' as 'L' | 'P',
    birth_place: 'Bojonegoro',
    birth_date: '2009-01-01',
    religion: 'Islam',
    address: '',
    parent_name: '',
    parent_phone: '',
    class_id: '',
    entry_year: new Date().getFullYear(),
    status: 'Aktif' as 'Aktif' | 'Lulus' | 'Pindah' | 'Keluar',
    notes: '',
  });

  const [selectedStudentForRecords, setSelectedStudentForRecords] = useState<Student | null>(null);
  const [studentRecords, setStudentRecords] = useState<StudentAcademicRecord[]>([]);
  const [recordForm, setRecordForm] = useState({
    academic_year_id: '',
    semester: 'Genap' as 'Ganjil' | 'Genap',
    class_name: '',
    attendance_pct: 96,
    average_score: 85,
    conduct_grade: 'Baik',
    homeroom_notes: '',
  });

  const [gtkModalOpen, setGtkModalOpen] = useState(false);
  const [editingGtk, setEditingGtk] = useState<GtkStaff | null>(null);
  const [gtkForm, setGtkForm] = useState({
    nip: '',
    nuptk: '',
    full_name: '',
    gender: 'L' as 'L' | 'P',
    category: 'Guru' as 'Kepala Sekolah' | 'Guru' | 'Tenaga Kependidikan',
    position: '',
    subject: '',
    employment_status: 'GTY',
    education: 'S1',
    phone: '',
    email: '',
    join_year: new Date().getFullYear(),
  });

  const [classModalOpen, setClassModalOpen] = useState(false);
  const [classForm, setClassForm] = useState({
    name: '',
    grade_level: 10,
    program: 'Kurikulum Merdeka',
    academic_year_id: '',
    homeroom_teacher_id: '',
    room_name: '',
    capacity: 36,
  });

  const [yearModalOpen, setYearModalOpen] = useState(false);
  const [yearForm, setYearForm] = useState({
    year_label: '2026/2027',
    semester: 'Ganjil' as 'Ganjil' | 'Genap',
    start_date: '2026-07-13',
    end_date: '2026-12-19',
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [stuRes, clsRes, gtkRes, ayRes] = await Promise.all([
        apiFetch<Student[]>('/api/students'),
        apiFetch<SchoolClass[]>('/api/classes'),
        apiFetch<GtkStaff[]>('/api/gtk'),
        apiFetch<AcademicYear[]>('/api/academic-years'),
      ]);
      setStudents(stuRes);
      setClasses(clsRes);
      setGtkList(gtkRes);
      setAcademicYears(ayRes);
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal memuat data akademik.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      const matchClass = classFilter === 'Semua' || String(s.class_id || '') === classFilter;
      const matchStatus = statusFilter === 'Semua' || s.status === statusFilter;
      const matchQ =
        !q ||
        s.full_name.toLowerCase().includes(q) ||
        s.nis.toLowerCase().includes(q) ||
        s.nisn.toLowerCase().includes(q) ||
        s.parent_name.toLowerCase().includes(q);
      return matchClass && matchStatus && matchQ;
    });
  }, [students, search, classFilter, statusFilter]);

  const filteredGtk = useMemo(() => {
    const q = search.trim().toLowerCase();
    return gtkList.filter((g) => {
      const matchCat = gtkCategoryFilter === 'Semua' || g.category === gtkCategoryFilter;
      const matchQ =
        !q ||
        g.full_name.toLowerCase().includes(q) ||
        g.nip.toLowerCase().includes(q) ||
        g.position.toLowerCase().includes(q) ||
        g.subject.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [gtkList, search, gtkCategoryFilter]);

  const openNewStudent = () => {
    setEditingStudent(null);
    setStudentForm({
      nis: '',
      nisn: '',
      full_name: '',
      gender: 'L',
      birth_place: 'Bojonegoro',
      birth_date: '2009-01-01',
      religion: 'Islam',
      address: '',
      parent_name: '',
      parent_phone: '',
      class_id: classes[0] ? String(classes[0].id) : '',
      entry_year: new Date().getFullYear(),
      status: 'Aktif',
      notes: '',
    });
    setStudentModalOpen(true);
  };

  const openEditStudent = (s: Student) => {
    setEditingStudent(s);
    setStudentForm({
      nis: s.nis,
      nisn: s.nisn,
      full_name: s.full_name,
      gender: s.gender,
      birth_place: s.birth_place,
      birth_date: s.birth_date,
      religion: s.religion,
      address: s.address,
      parent_name: s.parent_name,
      parent_phone: s.parent_phone,
      class_id: s.class_id ? String(s.class_id) : '',
      entry_year: s.entry_year,
      status: s.status,
      notes: s.notes || '',
    });
    setStudentModalOpen(true);
  };

  const saveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...studentForm,
        class_id: studentForm.class_id ? Number(studentForm.class_id) : null,
      };
      if (editingStudent) {
        await apiFetch(`/api/students/${editingStudent.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setFeedback({ type: 'success', msg: `Data siswa ${studentForm.full_name} berhasil diperbarui.` });
      } else {
        await apiFetch('/api/students', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback({ type: 'success', msg: `Siswa baru ${studentForm.full_name} berhasil ditambahkan.` });
      }
      setStudentModalOpen(false);
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menyimpan data siswa.' });
    }
  };

  const deleteStudent = async (s: Student) => {
    try {
      await apiFetch(`/api/students/${s.id}`, { method: 'DELETE' });
      setFeedback({ type: 'success', msg: `Data siswa ${s.full_name} dihapus.` });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menghapus data siswa.' });
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiFetch<{ message: string }>('/api/students/import', {
        method: 'POST',
        body: formData,
      });
      setFeedback({ type: 'success', msg: res.message });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal mengimpor file Excel.' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openStudentRecords = async (s: Student) => {
    setSelectedStudentForRecords(s);
    const activeAy = academicYears.find((a) => a.is_active === 1) || academicYears[0];
    setRecordForm({
      academic_year_id: activeAy ? String(activeAy.id) : '',
      semester: activeAy?.semester || 'Genap',
      class_name: s.class_name || '-',
      attendance_pct: 96,
      average_score: 85,
      conduct_grade: 'Baik',
      homeroom_notes: '',
    });
    try {
      const recs = await apiFetch<StudentAcademicRecord[]>(`/api/students/${s.id}/records`);
      setStudentRecords(recs);
    } catch {
      setStudentRecords([]);
    }
  };

  const saveStudentRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForRecords) return;
    try {
      await apiFetch(`/api/students/${selectedStudentForRecords.id}/records`, {
        method: 'POST',
        body: JSON.stringify({
          ...recordForm,
          academic_year_id: Number(recordForm.academic_year_id),
        }),
      });
      const recs = await apiFetch<StudentAcademicRecord[]>(`/api/students/${selectedStudentForRecords.id}/records`);
      setStudentRecords(recs);
      setFeedback({ type: 'success', msg: 'Riwayat akademik siswa berhasil ditambahkan.' });
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menyimpan catatan akademik.' });
    }
  };

  const saveGtk = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingGtk) {
        await apiFetch(`/api/gtk/${editingGtk.id}`, {
          method: 'PUT',
          body: JSON.stringify(gtkForm),
        });
        setFeedback({ type: 'success', msg: `Data GTK ${gtkForm.full_name} diperbarui.` });
      } else {
        await apiFetch('/api/gtk', {
          method: 'POST',
          body: JSON.stringify(gtkForm),
        });
        setFeedback({ type: 'success', msg: `Data GTK ${gtkForm.full_name} ditambahkan.` });
      }
      setGtkModalOpen(false);
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menyimpan data GTK.' });
    }
  };

  const saveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/classes', {
        method: 'POST',
        body: JSON.stringify({
          ...classForm,
          academic_year_id: Number(classForm.academic_year_id),
          homeroom_teacher_id: classForm.homeroom_teacher_id ? Number(classForm.homeroom_teacher_id) : null,
        }),
      });
      setClassModalOpen(false);
      setFeedback({ type: 'success', msg: `Kelas ${classForm.name} berhasil ditambahkan.` });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menambah kelas.' });
    }
  };

  const saveYear = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/academic-years', {
        method: 'POST',
        body: JSON.stringify(yearForm),
      });
      setYearModalOpen(false);
      setFeedback({ type: 'success', msg: `Tahun pelajaran ${yearForm.year_label} ditambahkan.` });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menambah tahun pelajaran.' });
    }
  };

  const activateYear = async (id: number) => {
    try {
      await apiFetch(`/api/academic-years/${id}/activate`, { method: 'PUT' });
      setFeedback({ type: 'success', msg: 'Tahun pelajaran aktif diperbarui.' });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal mengaktifkan tahun pelajaran.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isParent ? 'Data Akademik Putra/Putri' : 'Manajemen Data Akademik & Peserta Didik'}
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            {isParent
              ? 'Biodata dan riwayat perkembangan akademik siswa yang terhubung dengan akun Anda.'
              : 'Database induk siswa, rombongan belajar, guru & tenaga kependidikan, serta impor/ekspor Excel.'}
          </p>
        </div>

        {!isParent && (
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start overflow-x-auto">
            {[
              { id: 'students', label: 'Data Siswa' },
              { id: 'classes', label: 'Kelas & Rombel' },
              { id: 'gtk', label: 'Guru & Tendik' },
              { id: 'years', label: 'Tahun Pelajaran' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id as typeof subTab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  subTab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
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

      {/* TAB 1: DATA SISWA */}
      {subTab === 'students' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama, NIS, NISN, wali..."
                  className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 w-64"
                />
              </div>
              {!isParent && (
                <>
                  <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Semua">Semua Kelas</option>
                    {classes.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Semua">Semua Status</option>
                    <option value="Aktif">Aktif</option>
                    <option value="Lulus">Lulus</option>
                    <option value="Pindah">Pindah</option>
                    <option value="Keluar">Keluar</option>
                  </select>
                </>
              )}
            </div>

            {!isParent && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadWithAuth('/api/students/export', 'Data_Induk_Siswa_SMA_Darul_Ulum.xlsx')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" /> Ekspor Excel
                </button>
                {canEdit && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleImportExcel}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap shrink-0"
                    >
                      <Upload className="w-3.5 h-3.5" /> Impor Excel
                    </button>
                    <button
                      type="button"
                      onClick={openNewStudent}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tambah Siswa
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">NIS / NISN</th>
                    <th className="py-3 px-4">Nama Lengkap</th>
                    <th className="py-3 px-4">JK</th>
                    <th className="py-3 px-4">Kelas</th>
                    <th className="py-3 px-4">Orang Tua / Wali</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Memuat data peserta didik...
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Tidak ada data peserta didik yang sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-600">
                          <div className="font-semibold text-slate-900">{s.nis}</div>
                          <div>{s.nisn}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{s.full_name}</div>
                          <div className="text-xs text-slate-500">
                            {s.birth_place}, {s.birth_date}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-700">{s.gender}</td>
                        <td className="py-3 px-4 text-slate-700">{s.class_name || 'Alumni / Non-Kelas'}</td>
                        <td className="py-3 px-4">
                          <div className="text-slate-800">{s.parent_name}</div>
                          <div className="text-xs font-mono text-slate-500">{s.parent_phone}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-xs font-semibold ${
                              s.status === 'Aktif'
                                ? 'text-emerald-700'
                                : s.status === 'Lulus'
                                ? 'text-slate-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openStudentRecords(s)}
                              className="p-1.5 text-slate-600 hover:text-emerald-700 rounded-md hover:bg-slate-100"
                              title="Riwayat & Catatan Akademik"
                            >
                              <BookOpen className="w-4 h-4" />
                            </button>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => openEditStudent(s)}
                                className="p-1.5 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100"
                                title="Edit Biodata Siswa"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}
                            {user.role === 'ADMIN' && (
                              <button
                                type="button"
                                onClick={() => deleteStudent(s)}
                                className="p-1.5 text-slate-500 hover:text-red-600 rounded-md hover:bg-red-50"
                                title="Hapus Data Siswa"
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
      )}

      {/* TAB 2: KELAS & ROMBEL */}
      {subTab === 'classes' && !isParent && (
        <div className="space-y-4">
          {canEdit && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const activeAy = academicYears.find((a) => a.is_active === 1) || academicYears[0];
                  setClassForm({
                    name: '',
                    grade_level: 10,
                    program: 'Kurikulum Merdeka',
                    academic_year_id: activeAy ? String(activeAy.id) : '',
                    homeroom_teacher_id: '',
                    room_name: '',
                    capacity: 36,
                  });
                  setClassModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Rombongan Belajar
              </button>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Nama Rombel</th>
                    <th className="py-3 px-4">Tingkat</th>
                    <th className="py-3 px-4">Program</th>
                    <th className="py-3 px-4">Ruang</th>
                    <th className="py-3 px-4">Wali Kelas</th>
                    <th className="py-3 px-4 text-right">Siswa / Kapasitas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classes.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-semibold text-slate-900">{c.name}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-700">Kelas {c.grade_level}</td>
                      <td className="py-3 px-4 text-slate-600">{c.program}</td>
                      <td className="py-3 px-4 text-slate-600">{c.room_name}</td>
                      <td className="py-3 px-4 text-slate-800">{c.homeroom_teacher_name || '-'}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <span className="font-semibold text-emerald-700">{c.student_count ?? 0}</span> / {c.capacity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GURU & TENDIK */}
      {subTab === 'gtk' && !isParent && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama, NIP, jabatan..."
                  className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 w-60"
                />
              </div>
              <select
                value={gtkCategoryFilter}
                onChange={(e) => setGtkCategoryFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="Semua">Semua Kategori</option>
                <option value="Kepala Sekolah">Kepala Sekolah</option>
                <option value="Guru">Guru</option>
                <option value="Tenaga Kependidikan">Tenaga Kependidikan</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              {(user.role === 'ADMIN' || user.role === 'KEPALA_SEKOLAH' || user.role === 'STAF') && (
                <button
                  type="button"
                  onClick={() => downloadWithAuth('/api/gtk/export', 'Data_GTK_SMA_Darul_Ulum_Kepohbaru.xlsx')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" /> Ekspor Excel
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingGtk(null);
                    setGtkForm({
                      nip: '',
                      nuptk: '',
                      full_name: '',
                      gender: 'L',
                      category: 'Guru',
                      position: '',
                      subject: '',
                      employment_status: 'GTY',
                      education: 'S1',
                      phone: '',
                      email: '',
                      join_year: new Date().getFullYear(),
                    });
                    setGtkModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah GTK
                </button>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">NIP / NUPTK</th>
                    <th className="py-3 px-4">Nama Lengkap</th>
                    <th className="py-3 px-4">Kategori & Jabatan</th>
                    <th className="py-3 px-4">Mapel</th>
                    <th className="py-3 px-4">Status / Pend.</th>
                    {canEdit && <th className="py-3 px-4 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredGtk.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-600">
                        <div>{g.nip}</div>
                        <div className="text-slate-400">{g.nuptk}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{g.full_name}</div>
                        <div className="text-xs text-slate-500">{g.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-900">{g.position}</div>
                        <div className="text-xs text-slate-500">{g.category}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{g.subject}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {g.employment_status} · {g.education}
                      </td>
                      {canEdit && (
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingGtk(g);
                              setGtkForm({
                                nip: g.nip,
                                nuptk: g.nuptk,
                                full_name: g.full_name,
                                gender: g.gender,
                                category: g.category,
                                position: g.position,
                                subject: g.subject,
                                employment_status: g.employment_status,
                                education: g.education,
                                phone: g.phone || '',
                                email: g.email || '',
                                join_year: g.join_year,
                              });
                              setGtkModalOpen(true);
                            }}
                            className="p-1.5 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TAHUN PELAJARAN */}
      {subTab === 'years' && !isParent && (
        <div className="space-y-4">
          {canEdit && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setYearModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Tahun Pelajaran
              </button>
            </div>
          )}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Tahun Pelajaran</th>
                  <th className="py-3 px-4">Semester</th>
                  <th className="py-3 px-4">Periode</th>
                  <th className="py-3 px-4">Status</th>
                  {user.role === 'ADMIN' && <th className="py-3 px-4 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {academicYears.map((ay) => (
                  <tr key={ay.id}>
                    <td className="py-3 px-4 font-semibold font-mono text-slate-900">{ay.year_label}</td>
                    <td className="py-3 px-4 text-slate-700">{ay.semester}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">
                      {ay.start_date} s.d. {ay.end_date}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-semibold ${ay.is_active ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {ay.is_active ? 'Aktif' : 'Non-Aktif'}
                      </span>
                    </td>
                    {user.role === 'ADMIN' && (
                      <td className="py-3 px-4 text-right">
                        {!ay.is_active && (
                          <button
                            type="button"
                            onClick={() => activateYear(ay.id)}
                            className="px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-50"
                          >
                            Aktifkan
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student Add/Edit Modal */}
      {studentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">
                {editingStudent ? 'Edit Biodata Peserta Didik' : 'Tambah Peserta Didik Baru'}
              </h3>
              <button type="button" onClick={() => setStudentModalOpen(false)} className="p-1 text-slate-500 hover:text-slate-900">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={saveStudent} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">NIS *</label>
                  <input
                    required
                    value={studentForm.nis}
                    onChange={(e) => setStudentForm({ ...studentForm, nis: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">NISN *</label>
                  <input
                    required
                    value={studentForm.nisn}
                    onChange={(e) => setStudentForm({ ...studentForm, nisn: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nama Lengkap *</label>
                  <input
                    required
                    value={studentForm.full_name}
                    onChange={(e) => setStudentForm({ ...studentForm, full_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Jenis Kelamin</label>
                  <select
                    value={studentForm.gender}
                    onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value as 'L' | 'P' })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Kelas / Rombel</label>
                  <select
                    value={studentForm.class_id}
                    onChange={(e) => setStudentForm({ ...studentForm, class_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">-- Tidak Terdaftar di Kelas --</option>
                    {classes.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name} ({c.program})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tempat Lahir</label>
                  <input
                    value={studentForm.birth_place}
                    onChange={(e) => setStudentForm({ ...studentForm, birth_place: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Lahir</label>
                  <input
                    type="date"
                    value={studentForm.birth_date}
                    onChange={(e) => setStudentForm({ ...studentForm, birth_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nama Orang Tua / Wali</label>
                  <input
                    value={studentForm.parent_name}
                    onChange={(e) => setStudentForm({ ...studentForm, parent_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">No. HP Orang Tua / Wali</label>
                  <input
                    value={studentForm.parent_phone}
                    onChange={(e) => setStudentForm({ ...studentForm, parent_phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tahun Masuk</label>
                  <input
                    type="number"
                    value={studentForm.entry_year}
                    onChange={(e) => setStudentForm({ ...studentForm, entry_year: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Status Siswa</label>
                  <select
                    value={studentForm.status}
                    onChange={(e) => setStudentForm({ ...studentForm, status: e.target.value as typeof studentForm.status })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Lulus">Lulus</option>
                    <option value="Pindah">Pindah</option>
                    <option value="Keluar">Keluar</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Alamat Lengkap</label>
                  <input
                    value={studentForm.address}
                    onChange={(e) => setStudentForm({ ...studentForm, address: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setStudentModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg"
                >
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg">
                  Simpan Biodata
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Academic History Modal */}
      {selectedStudentForRecords && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Riwayat Pendidikan & Catatan Akademik
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedStudentForRecords.full_name} · NIS {selectedStudentForRecords.nis}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedStudentForRecords(null)} className="p-1 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto">
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="py-2.5 px-3">Tahun / Sem</th>
                      <th className="py-2.5 px-3">Kelas</th>
                      <th className="py-2.5 px-3 text-right">Hadir</th>
                      <th className="py-2.5 px-3 text-right">Rata-rata</th>
                      <th className="py-2.5 px-3">Sikap</th>
                      <th className="py-2.5 px-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {studentRecords.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2.5 px-3 font-mono">{r.year_label} · {r.semester}</td>
                        <td className="py-2.5 px-3">{r.class_name}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{r.attendance_pct}%</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700">{r.average_score}</td>
                        <td className="py-2.5 px-3">{r.conduct_grade}</td>
                        <td className="py-2.5 px-3 text-slate-600">{r.homeroom_notes}</td>
                      </tr>
                    ))}
                    {studentRecords.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-500">
                          Belum ada riwayat semester tercatat.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {(user.role === 'ADMIN' || user.role === 'GURU' || user.role === 'STAF') && (
                <form onSubmit={saveStudentRecord} className="border-t border-slate-200 pt-4 space-y-3">
                  <h4 className="text-sm font-semibold text-slate-900">Tambah Catatan Semester</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <select
                      value={recordForm.academic_year_id}
                      onChange={(e) => setRecordForm({ ...recordForm, academic_year_id: e.target.value })}
                      className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      {academicYears.map((a) => (
                        <option key={a.id} value={String(a.id)}>
                          {a.year_label} ({a.semester})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Kehadiran %"
                      value={recordForm.attendance_pct}
                      onChange={(e) => setRecordForm({ ...recordForm, attendance_pct: Number(e.target.value) })}
                      className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                    />
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Rata Nilai"
                      value={recordForm.average_score}
                      onChange={(e) => setRecordForm({ ...recordForm, average_score: Number(e.target.value) })}
                      className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                    />
                    <input
                      placeholder="Nilai Sikap"
                      value={recordForm.conduct_grade}
                      onChange={(e) => setRecordForm({ ...recordForm, conduct_grade: e.target.value })}
                      className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      placeholder="Catatan perkembangan dari wali kelas..."
                      value={recordForm.homeroom_notes}
                      onChange={(e) => setRecordForm({ ...recordForm, homeroom_notes: e.target.value })}
                      className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                    <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg">
                      Simpan
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GTK Modal */}
      {gtkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">
                {editingGtk ? 'Edit Data GTK' : 'Tambah Guru / Tenaga Kependidikan'}
              </h3>
              <button type="button" onClick={() => setGtkModalOpen(false)} className="p-1 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={saveGtk} className="p-6 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  required
                  placeholder="Nama Lengkap *"
                  value={gtkForm.full_name}
                  onChange={(e) => setGtkForm({ ...gtkForm, full_name: e.target.value })}
                  className="sm:col-span-2 px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  placeholder="NIP"
                  value={gtkForm.nip}
                  onChange={(e) => setGtkForm({ ...gtkForm, nip: e.target.value })}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
                <input
                  placeholder="NUPTK"
                  value={gtkForm.nuptk}
                  onChange={(e) => setGtkForm({ ...gtkForm, nuptk: e.target.value })}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
                <select
                  value={gtkForm.category}
                  onChange={(e) => setGtkForm({ ...gtkForm, category: e.target.value as typeof gtkForm.category })}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Guru">Guru</option>
                  <option value="Tenaga Kependidikan">Tenaga Kependidikan</option>
                  <option value="Kepala Sekolah">Kepala Sekolah</option>
                </select>
                <input
                  required
                  placeholder="Jabatan *"
                  value={gtkForm.position}
                  onChange={(e) => setGtkForm({ ...gtkForm, position: e.target.value })}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  placeholder="Mata Pelajaran"
                  value={gtkForm.subject}
                  onChange={(e) => setGtkForm({ ...gtkForm, subject: e.target.value })}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  placeholder="Status Kepegawaian (PNS/PPPK/GTY)"
                  value={gtkForm.employment_status}
                  onChange={(e) => setGtkForm({ ...gtkForm, employment_status: e.target.value })}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  placeholder="Pendidikan Terakhir"
                  value={gtkForm.education}
                  onChange={(e) => setGtkForm({ ...gtkForm, education: e.target.value })}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  placeholder="Email"
                  value={gtkForm.email}
                  onChange={(e) => setGtkForm({ ...gtkForm, email: e.target.value })}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setGtkModalOpen(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg">
                  Simpan Data GTK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Class Modal */}
      {classModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">Tambah Rombongan Belajar</h3>
              <button type="button" onClick={() => setClassModalOpen(false)} className="p-1 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={saveClass} className="p-6 space-y-3">
              <input
                required
                placeholder="Nama Kelas (mis. X-3)"
                value={classForm.name}
                onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={classForm.grade_level}
                  onChange={(e) => setClassForm({ ...classForm, grade_level: Number(e.target.value) })}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value={10}>Tingkat X (10)</option>
                  <option value={11}>Tingkat XI (11)</option>
                  <option value={12}>Tingkat XII (12)</option>
                </select>
                <input
                  placeholder="Program (MIPA/IPS)"
                  value={classForm.program}
                  onChange={(e) => setClassForm({ ...classForm, program: e.target.value })}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <select
                value={classForm.homeroom_teacher_id}
                onChange={(e) => setClassForm({ ...classForm, homeroom_teacher_id: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">-- Pilih Wali Kelas --</option>
                {gtkList.filter((g) => g.category === 'Guru').map((g) => (
                  <option key={g.id} value={String(g.id)}>
                    {g.full_name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="Ruang (mis. Ruang 03)"
                  value={classForm.room_name}
                  onChange={(e) => setClassForm({ ...classForm, room_name: e.target.value })}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  type="number"
                  placeholder="Kapasitas"
                  value={classForm.capacity}
                  onChange={(e) => setClassForm({ ...classForm, capacity: Number(e.target.value) })}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setClassModalOpen(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg">
                  Simpan Kelas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Academic Year Modal */}
      {yearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">Tambah Tahun Pelajaran</h3>
              <button type="button" onClick={() => setYearModalOpen(false)} className="p-1 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={saveYear} className="p-6 space-y-3">
              <input
                required
                placeholder="Label (mis. 2026/2027)"
                value={yearForm.year_label}
                onChange={(e) => setYearForm({ ...yearForm, year_label: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
              <select
                value={yearForm.semester}
                onChange={(e) => setYearForm({ ...yearForm, semester: e.target.value as 'Ganjil' | 'Genap' })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={yearForm.start_date}
                  onChange={(e) => setYearForm({ ...yearForm, start_date: e.target.value })}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  type="date"
                  value={yearForm.end_date}
                  onChange={(e) => setYearForm({ ...yearForm, end_date: e.target.value })}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setYearModalOpen(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg">
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
