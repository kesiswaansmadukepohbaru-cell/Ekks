import React, { useEffect, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiFetch } from '../lib/api';
import { ROLE_LABELS, type AuthUser, type StudentAcademicRecord } from '../types';

interface DashboardHomeProps {
  user: AuthUser;
  onNavigate: (tab: string) => void;
}

interface StudentGrowthPoint {
  year: string;
  masuk: number;
  putra: number;
  putri: number;
  aktif: number;
  lulus: number;
  akumulasi: number;
}

interface StudentGradePoint {
  group_label: string;
  total: number;
  putra: number;
  putri: number;
}

interface TeacherSupervisionPoint {
  target_gtk_id: number;
  target_name: string;
  position: string;
  subject: string;
  avg_value: number;
  max_value: number;
  min_value: number;
  assessment_count: number;
  last_date: string;
  predicate: string;
}

interface PredicateDistributionPoint {
  predicate: string;
  count: number;
}

interface DashboardData {
  role: string;
  activeAcademicYear?: { year_label: string; semester: string };
  // Parent view
  children?: {
    id: number;
    nis: string;
    nisn: string;
    full_name: string;
    class_name: string;
    program: string;
    homeroom_teacher: string;
    status: string;
  }[];
  academicRecords?: StudentAcademicRecord[];
  // Staff/Admin/Kepsek/Guru view
  studentStats?: {
    totalActive: number;
    totalMale: number;
    totalFemale: number;
    totalGraduated: number;
  };
  gtkStats?: {
    totalActive: number;
    teachers: number;
    staff: number;
  };
  classSummary?: {
    id: number;
    name: string;
    grade_level: number;
    program: string;
    capacity: number;
    homeroom_teacher: string;
    student_count: number;
  }[];
  studentGrowthByYear?: StudentGrowthPoint[];
  studentByGrade?: StudentGradePoint[];
  recentAnnouncements: {
    id: number;
    title: string;
    category: string;
    summary: string;
    event_date: string;
  }[];
  visibleArchiveActivity?: {
    id: number;
    title: string;
    category: string;
    academic_year: string;
    uploaded_at: string;
    uploader_name: string;
  }[];
  archiveCountByCategory?: { category: string; count: number }[];
  supervisionSummary?: {
    totalAssessments: number;
    finalAssessmentsCount: number;
    avgScore: number;
    recentAssessments: {
      id: number;
      target_name: string;
      final_value: number;
      predicate: string;
      status: string;
      assessment_date: string;
      instrument_title: string;
    }[];
    scheduleStats: { status: string; count: number }[];
    followUpStats: { status: string; count: number }[];
    instrumentPerformance: { name: string; avg_value: number | null; total_assessed: number }[];
    teacherSupervisionStats?: TeacherSupervisionPoint[];
    predicateDistribution?: PredicateDistributionPoint[];
  };
}

const PREDICATE_COLORS: Record<string, string> = {
  'Sangat Baik': '#047857',
  Baik: '#0284c7',
  'Cukup (Butuh Perbaikan)': '#d97706',
  Kurang: '#ea580c',
  'Sangat Kurang': '#dc2626',
};

function getScoreBarColor(score: number): string {
  if (score >= 91) return '#047857';
  if (score >= 76) return '#0284c7';
  if (score >= 61) return '#d97706';
  if (score >= 51) return '#ea580c';
  return '#dc2626';
}

function shortenPersonName(name: string): string {
  const base = name.split(',')[0]?.trim() || name;
  return base.length > 22 ? `${base.slice(0, 20)}...` : base;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number | string;
    color?: string;
    payload?: Record<string, unknown>;
  }>;
  label?: string;
}

const StudentGrowthTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload as unknown as StudentGrowthPoint | undefined;
  if (!point) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 shadow-sm text-xs space-y-1">
      <p className="font-semibold text-slate-900">Tahun Masuk {label}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-slate-600 tabular-nums">
        <span>Siswa Baru</span>
        <span className="font-semibold text-slate-900 text-right">{point.masuk}</span>
        <span>Putra / Putri</span>
        <span className="text-right">
          {point.putra} / {point.putri}
        </span>
        <span>Aktif / Alumni</span>
        <span className="text-right">
          {point.aktif} / {point.lulus}
        </span>
        <span className="pt-1 border-t border-slate-100 font-medium text-slate-800">Akumulasi</span>
        <span className="pt-1 border-t border-slate-100 font-bold text-emerald-700 text-right">
          {point.akumulasi}
        </span>
      </div>
    </div>
  );
};

const TeacherSupervisionTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload as unknown as
    | (TeacherSupervisionPoint & { shortName: string })
    | undefined;
  if (!point) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 shadow-sm text-xs space-y-1 max-w-xs">
      <p className="font-semibold text-slate-900">{point.target_name}</p>
      <p className="text-slate-500">{point.position}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-1 border-t border-slate-100 tabular-nums">
        <span className="text-slate-600">Rata-rata Nilai</span>
        <span className="font-bold text-emerald-700 text-right">{Number(point.avg_value).toFixed(2)}</span>
        <span className="text-slate-600">Predikat</span>
        <span className="font-medium text-slate-900 text-right">{point.predicate}</span>
        <span className="text-slate-600">Jumlah Penilaian</span>
        <span className="text-slate-800 text-right">{point.assessment_count} kali</span>
      </div>
    </div>
  );
};

export const DashboardHome: React.FC<DashboardHomeProps> = ({ user, onNavigate }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [studentChartMode, setStudentChartMode] = useState<'trend' | 'grade'>('trend');
  const [supervisionChartMode, setSupervisionChartMode] = useState<'teacher' | 'instrument'>('teacher');

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<DashboardData>('/api/dashboard')
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Gagal memuat dashboard.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user.id]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-slate-200 rounded-xl" />
          <div className="h-80 bg-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
        {error || 'Data dashboard tidak tersedia.'}
      </div>
    );
  }

  // Dedicated Parent View (ORANG_TUA)
  if (user.role === 'ORANG_TUA') {
    const children = data.children || [];
    const records = data.academicRecords || [];
    const parentChartData = [...records]
      .reverse()
      .map((r) => ({
        label: `${r.student_name?.split(' ')[0] || 'Siswa'} (${r.semester})`,
        Nilai: r.average_score,
        Kehadiran: r.attendance_pct,
      }));

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Portal Orang Tua / Wali Siswa</h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Tahun Pelajaran {data.activeAcademicYear?.year_label || '2025/2026'} · Semester{' '}
              {data.activeAcademicYear?.semester || 'Genap'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('academic')}
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg self-start whitespace-nowrap shrink-0"
          >
            Lihat Detail Akademik Anak
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {children.map((child) => (
            <div key={child.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-500 font-mono tabular-nums">
                    NIS {child.nis} · NISN {child.nisn}
                  </p>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5">{child.full_name}</h2>
                </div>
                <span className="text-xs font-semibold text-emerald-700">{child.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Kelas / Program</p>
                  <p className="font-medium text-slate-900">
                    {child.class_name} ({child.program})
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Wali Kelas</p>
                  <p className="font-medium text-slate-900">{child.homeroom_teacher || '-'}</p>
                </div>
              </div>
            </div>
          ))}
          {children.length === 0 && (
            <div className="col-span-full bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-600">
              Belum ada data peserta didik yang tertaut dengan akun ini. Hubungi Administrator atau Tata Usaha sekolah.
            </div>
          )}
        </div>

        {parentChartData.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-900">Grafik Perkembangan Nilai & Kehadiran</h2>
              <p className="text-xs text-slate-500">Perbandingan rata-rata nilai akademik dan persentase kehadiran per semester</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={parentChartData} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#475569' }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Nilai" name="Rata-rata Nilai" fill="#047857" radius={[4, 4, 0, 0]} barSize={32} />
                  <Line type="monotone" dataKey="Kehadiran" name="Kehadiran (%)" stroke="#0284c7" strokeWidth={2.5} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">Riwayat Perkembangan Akademik Anak</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4">Tahun / Semester</th>
                  <th className="py-3 px-4">Kelas</th>
                  <th className="py-3 px-4 text-right">Kehadiran</th>
                  <th className="py-3 px-4 text-right">Rata-rata Nilai</th>
                  <th className="py-3 px-4">Sikap</th>
                  <th className="py-3 px-4">Catatan Wali Kelas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((rec) => (
                  <tr key={rec.id}>
                    <td className="py-3 px-4 font-medium text-slate-900">{rec.student_name}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {rec.year_label} · {rec.semester}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{rec.class_name}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{rec.attendance_pct}%</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">
                      {rec.average_score}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{rec.conduct_grade}</td>
                    <td className="py-3 px-4 text-slate-600">{rec.homeroom_notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Pengumuman & Agenda Sekolah Terbaru</h2>
          <div className="divide-y divide-slate-100">
            {data.recentAnnouncements.map((ann) => (
              <div key={ann.id} className="py-3">
                <p className="text-xs text-slate-500">
                  {ann.category} · <span className="font-mono">{ann.event_date}</span>
                </p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{ann.title}</p>
                <p className="text-xs text-slate-600 mt-0.5">{ann.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Staff / Guru / Kepala Sekolah / Admin Dashboard
  const studentGrowthData = data.studentGrowthByYear || [];
  const studentGradeData = data.studentByGrade || [];
  const classChartData = (data.classSummary || []).map((c) => ({
    name: c.name,
    Siswa: c.student_count,
    Kapasitas: c.capacity,
  }));

  const teacherSupervisionData = (data.supervisionSummary?.teacherSupervisionStats || []).map((t) => ({
    ...t,
    shortName: shortenPersonName(t.target_name),
  }));

  const instrumentChartData = (data.supervisionSummary?.instrumentPerformance || [])
    .filter((i) => i.avg_value !== null)
    .map((i) => ({
      name: i.name.replace('Spesifikasi: ', '').slice(0, 26),
      Nilai: i.avg_value ?? 0,
      total_assessed: i.total_assessed,
    }));

  const predicateAll = data.supervisionSummary?.predicateDistribution || [];
  const predicateActive = predicateAll.filter((p) => p.count > 0);
  const totalFinalSupervisions = data.supervisionSummary?.finalAssessmentsCount ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Ringkasan Manajemen Sekolah
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            {ROLE_LABELS[user.role]} · Tahun Pelajaran {data.activeAcademicYear?.year_label || '2025/2026'} Semester{' '}
            {data.activeAcademicYear?.semester || 'Genap'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(user.role === 'ADMIN' || user.role === 'KEPALA_SEKOLAH') && (
            <button
              type="button"
              onClick={() => onNavigate('supervision')}
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Buka Supervisi Digital
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('archive')}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Arsip Digital
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Peserta Didik Aktif</p>
          <p className="text-3xl font-bold text-slate-900 tabular-nums mt-1">
            {data.studentStats?.totalActive ?? 0}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            L: {data.studentStats?.totalMale ?? 0} · P: {data.studentStats?.totalFemale ?? 0} · Alumni:{' '}
            {data.studentStats?.totalGraduated ?? 0}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Guru & Tenaga Kependidikan</p>
          <p className="text-3xl font-bold text-slate-900 tabular-nums mt-1">
            {data.gtkStats?.totalActive ?? 0}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            Pendidik: {data.gtkStats?.teachers ?? 0} · Tendik: {data.gtkStats?.staff ?? 0}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Rombongan Belajar</p>
          <p className="text-3xl font-bold text-slate-900 tabular-nums mt-1">
            {data.classSummary?.length ?? 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">Kelas X, XI, dan XII aktif</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Rata-rata Nilai Supervisi</p>
          <p className="text-3xl font-bold text-emerald-700 tabular-nums mt-1">
            {data.supervisionSummary?.avgScore?.toFixed(2) ?? '0.00'}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            Dari {totalFinalSupervisions} penilaian final
          </p>
        </div>
      </div>

      {/* Primary Analytics Row: Perkembangan Jumlah Siswa & Hasil Supervisi Guru */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Statistik Perkembangan Jumlah Siswa
              </h2>
              <p className="text-xs text-slate-500">
                {studentChartMode === 'trend'
                  ? 'Pertumbuhan jumlah siswa masuk & akumulasi per angkatan'
                  : 'Sebaran jumlah siswa putra dan putri berdasarkan tingkat kelas'}
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start shrink-0">
              <button
                type="button"
                onClick={() => setStudentChartMode('trend')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  studentChartMode === 'trend'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tren Angkatan
              </button>
              <button
                type="button"
                onClick={() => setStudentChartMode('grade')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  studentChartMode === 'grade'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Per Tingkat
              </button>
            </div>
          </div>

          <div className="h-72">
            {studentChartMode === 'trend' ? (
              studentGrowthData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={studentGrowthData} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="studentCumulativeFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0f172a" stopOpacity={0.14} />
                        <stop offset="95%" stopColor="#0f172a" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#475569' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#475569' }} />
                    <Tooltip content={<StudentGrowthTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area
                      type="monotone"
                      dataKey="akumulasi"
                      name="Akumulasi Siswa"
                      stroke="#0f172a"
                      strokeWidth={2}
                      fill="url(#studentCumulativeFill)"
                    />
                    <Bar dataKey="putra" name="Putra (L)" stackId="gender" fill="#047857" barSize={28} />
                    <Bar
                      dataKey="putri"
                      name="Putri (P)"
                      stackId="gender"
                      fill="#0284c7"
                      radius={[4, 4, 0, 0]}
                      barSize={28}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-slate-500">
                  <p>Belum ada data perkembangan peserta didik.</p>
                  <button
                    type="button"
                    onClick={() => onNavigate('academic')}
                    className="px-3 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-50"
                  >
                    Kelola Data Siswa
                  </button>
                </div>
              )
            ) : studentGradeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={studentGradeData} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="group_label" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#475569' }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="putra" name="Putra (L)" fill="#047857" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="putri" name="Putri (P)" fill="#0284c7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                Belum ada data sebaran tingkat siswa.
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 tabular-nums">
            <span>
              Total Terdaftar:{' '}
              <strong className="text-slate-800">
                {(data.studentStats?.totalActive ?? 0) + (data.studentStats?.totalGraduated ?? 0)}
              </strong>{' '}
              siswa · {studentGrowthData.length} angkatan
            </span>
            <button
              type="button"
              onClick={() => onNavigate('academic')}
              className="font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
            >
              Kelola Data Induk Siswa
            </button>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Statistik Hasil Supervisi Guru & GTK
              </h2>
              <p className="text-xs text-slate-500">
                {supervisionChartMode === 'teacher'
                  ? 'Rata-rata skor akhir per GTK ternilai (batas Baik ≥ 76 · Sangat Baik ≥ 91)'
                  : 'Capaian nilai rata-rata berdasarkan instrumen supervisi'}
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start shrink-0">
              <button
                type="button"
                onClick={() => setSupervisionChartMode('teacher')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  supervisionChartMode === 'teacher'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Per Guru
              </button>
              <button
                type="button"
                onClick={() => setSupervisionChartMode('instrument')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  supervisionChartMode === 'instrument'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Per Instrumen
              </button>
            </div>
          </div>

          <div className="h-72">
            {supervisionChartMode === 'teacher' ? (
              teacherSupervisionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={teacherSupervisionData}
                    layout="vertical"
                    margin={{ top: 8, right: 24, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: '#475569' }} />
                    <YAxis
                      type="category"
                      dataKey="shortName"
                      width={145}
                      tick={{ fontSize: 11, fill: '#334155' }}
                    />
                    <Tooltip content={<TeacherSupervisionTooltip />} />
                    <ReferenceLine x={76} stroke="#0284c7" strokeDasharray="4 4" />
                    <ReferenceLine x={91} stroke="#047857" strokeDasharray="4 4" />
                    <Bar dataKey="avg_value" name="Nilai Supervisi" radius={[0, 4, 4, 0]} barSize={24}>
                      {teacherSupervisionData.map((entry) => (
                        <Cell key={entry.target_gtk_id} fill={getScoreBarColor(entry.avg_value)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-slate-500">
                  <p>Belum ada hasil penilaian supervisi guru yang berstatus Final.</p>
                  <button
                    type="button"
                    onClick={() => onNavigate('supervision')}
                    className="px-3 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-50"
                  >
                    Mulai Penilaian Supervisi
                  </button>
                </div>
              )
            ) : instrumentChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={instrumentChartData}
                  layout="vertical"
                  margin={{ top: 8, right: 24, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={150}
                    tick={{ fontSize: 11, fill: '#334155' }}
                  />
                  <Tooltip />
                  <ReferenceLine x={76} stroke="#0284c7" strokeDasharray="4 4" />
                  <ReferenceLine x={91} stroke="#047857" strokeDasharray="4 4" />
                  <Bar dataKey="Nilai" fill="#0f172a" radius={[0, 4, 4, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                Belum ada data capaian per instrumen supervisi.
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 tabular-nums">
            <span>
              {teacherSupervisionData.length} GTK dinilai · {totalFinalSupervisions} penilaian final
            </span>
            <button
              type="button"
              onClick={() => onNavigate('supervision')}
              className="font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
            >
              Detail Rekap Supervisi
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Charts Row: Rekap Rombel & Distribusi Predikat Supervisi */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Rekapitulasi Siswa per Rombel</h2>
              <p className="text-xs text-slate-500">Perbandingan jumlah siswa aktif terhadap daya tampung kelas</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('academic')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
            >
              Kelola Kelas
            </button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classChartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#475569' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Siswa" name="Siswa Aktif" fill="#047857" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Kapasitas" name="Kapasitas Kelas" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Distribusi Predikat Supervisi</h2>
              <p className="text-xs text-slate-500">Sebaran mutu hasil supervisi berstatus Final</p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              n = {totalFinalSupervisions}
            </span>
          </div>

          {predicateActive.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center flex-1">
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={predicateActive}
                      dataKey="count"
                      nameKey="predicate"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={3}
                    >
                      {predicateActive.map((entry) => (
                        <Cell
                          key={entry.predicate}
                          fill={PREDICATE_COLORS[entry.predicate] || '#64748b'}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2.5 text-xs">
                {predicateAll.map((item) => {
                  const pct =
                    totalFinalSupervisions > 0
                      ? ((item.count / totalFinalSupervisions) * 100).toFixed(0)
                      : '0';
                  return (
                    <div key={item.predicate} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: PREDICATE_COLORS[item.predicate] || '#64748b' }}
                        />
                        <span className="text-slate-700 truncate">{item.predicate}</span>
                      </div>
                      <span className="font-mono tabular-nums text-slate-900 font-semibold shrink-0">
                        {item.count} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
              Belum ada distribusi predikat penilaian final.
            </div>
          )}
        </div>
      </div>

      {/* Bottom Operational Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Aktivitas Arsip Dokumen</h2>
            <button
              type="button"
              onClick={() => onNavigate('archive')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Lihat Semua
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {(data.visibleArchiveActivity || []).map((doc) => (
              <div key={doc.id} className="py-2.5">
                <p className="text-xs text-slate-500">
                  {doc.category} · {doc.academic_year}
                </p>
                <p className="text-sm font-medium text-slate-900 line-clamp-1 mt-0.5">{doc.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">Oleh {doc.uploader_name || 'Sistem'}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Hasil Supervisi Terbaru</h2>
            <button
              type="button"
              onClick={() => onNavigate('supervision')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Rekapitulasi
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {(data.supervisionSummary?.recentAssessments || []).map((ass) => (
              <div key={ass.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{ass.target_name}</p>
                  <p className="text-xs text-slate-500 truncate">{ass.instrument_title}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold font-mono tabular-nums text-emerald-700">
                    {Number(ass.final_value).toFixed(2)}
                  </p>
                  <p className="text-[11px] text-slate-500">{ass.predicate}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Pengumuman Terbaru</h2>
          <div className="divide-y divide-slate-100">
            {data.recentAnnouncements.map((ann) => (
              <div key={ann.id} className="py-2.5">
                <p className="text-xs text-slate-500">
                  {ann.category} · <span className="font-mono">{ann.event_date}</span>
                </p>
                <p className="text-sm font-medium text-slate-900 line-clamp-1 mt-0.5">{ann.title}</p>
                <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">{ann.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
