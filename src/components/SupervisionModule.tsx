import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Plus,
  Printer,
  Save,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  apiFetch,
  calculatePredicateClient,
  downloadWithAuth,
  exportSupervisionPdf,
} from '../lib/api';
import type {
  AuthUser,
  GtkStaff,
  SupervisionAssessment,
  SupervisionFollowUp,
  SupervisionInstrument,
  SupervisionItem,
  SupervisionSchedule,
} from '../types';

interface SupervisionModuleProps {
  user: AuthUser;
}

interface ScoreDraft {
  score: number | null;
  notes: string;
  recommendation: string;
}

export const SupervisionModule: React.FC<SupervisionModuleProps> = ({ user }) => {
  const canAssess = user.role === 'ADMIN' || user.role === 'KEPALA_SEKOLAH';

  const [subTab, setSubTab] = useState<'rekap' | 'form' | 'schedules' | 'followups' | 'catalog'>('rekap');
  const [instruments, setInstruments] = useState<SupervisionInstrument[]>([]);
  const [assessments, setAssessments] = useState<SupervisionAssessment[]>([]);
  const [schedules, setSchedules] = useState<SupervisionSchedule[]>([]);
  const [followUps, setFollowUps] = useState<SupervisionFollowUp[]>([]);
  const [gtkList, setGtkList] = useState<GtkStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Active Assessment Form State
  const [editingAssessmentId, setEditingAssessmentId] = useState<number | null>(null);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<number>(0);
  const [selectedGtkId, setSelectedGtkId] = useState<number>(0);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [supervisorName, setSupervisorName] = useState(user.fullName);
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [academicYear, setAcademicYear] = useState('2025/2026');
  const [semester, setSemester] = useState<'Ganjil' | 'Genap'>('Genap');
  const [examinerNotes, setExaminerNotes] = useState('');
  const [scoresByItemId, setScoresByItemId] = useState<Record<number, ScoreDraft>>({});
  const [saving, setSaving] = useState(false);

  // Catalog filter
  const [catalogInstrumentId, setCatalogInstrumentId] = useState<number>(0);

  // Schedule modal
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    instrument_id: '',
    target_gtk_id: '',
    scheduled_date: new Date().toISOString().slice(0, 10),
    academic_year: '2025/2026',
    semester: 'Genap' as 'Ganjil' | 'Genap',
    notes: '',
  });

  // Follow-up modal
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({
    assessment_id: '',
    action_plan: '',
    pic_name: '',
    due_date: new Date().toISOString().slice(0, 10),
    progress_notes: '',
  });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [instRes, assRes, schedRes, fuRes, gtkRes] = await Promise.all([
        apiFetch<SupervisionInstrument[]>('/api/supervision/instruments'),
        apiFetch<SupervisionAssessment[]>('/api/supervision/assessments'),
        apiFetch<SupervisionSchedule[]>('/api/supervision/schedules'),
        apiFetch<SupervisionFollowUp[]>('/api/supervision/follow-ups'),
        apiFetch<GtkStaff[]>('/api/gtk'),
      ]);
      setInstruments(instRes);
      setAssessments(assRes);
      setSchedules(schedRes);
      setFollowUps(fuRes);
      setGtkList(gtkRes);

      if (instRes.length > 0 && selectedInstrumentId === 0) {
        setSelectedInstrumentId(instRes[0].id);
        setCatalogInstrumentId(instRes[0].id);
      }
      if (gtkRes.length > 0 && selectedGtkId === 0) {
        setSelectedGtkId(gtkRes[0].id);
      }
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal memuat modul supervisi.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const currentInstrument = useMemo(
    () => instruments.find((i) => i.id === selectedInstrumentId) || null,
    [instruments, selectedInstrumentId]
  );

  const catalogInstrument = useMemo(
    () => instruments.find((i) => i.id === catalogInstrumentId) || instruments[0] || null,
    [instruments, catalogInstrumentId]
  );

  // Live calculation matching exact PDF formula
  const liveSummary = useMemo(() => {
    if (!currentInstrument) {
      return { totalScore: 0, maxScore: 0, finalValue: 0, predicate: 'Sangat Kurang', unfilled: 0 };
    }
    let totalScore = 0;
    let unfilled = 0;
    for (const item of currentInstrument.items) {
      const entry = scoresByItemId[item.id];
      if (!entry || entry.score === null || entry.score === undefined) {
        unfilled++;
      } else {
        totalScore += entry.score;
      }
    }
    const maxScore = currentInstrument.items.length * 4;
    const finalValue = maxScore > 0 ? Number(((totalScore / maxScore) * 100).toFixed(2)) : 0;
    const predicate = calculatePredicateClient(finalValue);
    return { totalScore, maxScore, finalValue, predicate, unfilled };
  }, [currentInstrument, scoresByItemId]);

  const startNewAssessment = (instrumentId?: number, targetGtkId?: number, scheduleId?: number) => {
    const instId = instrumentId || instruments[0]?.id || 0;
    const gtkId = targetGtkId || gtkList[0]?.id || 0;
    setEditingAssessmentId(null);
    setSelectedInstrumentId(instId);
    setSelectedGtkId(gtkId);
    setSelectedScheduleId(scheduleId ?? null);
    setSupervisorName(user.fullName);
    setAssessmentDate(new Date().toISOString().slice(0, 10));
    setExaminerNotes('');
    setScoresByItemId({});
    setSubTab('form');
  };

  const openAssessmentDetail = async (id: number) => {
    try {
      const detail = await apiFetch<{
        assessment: SupervisionAssessment;
        items: SupervisionItem[];
      }>(`/api/supervision/assessments/${id}`);
      const ass = detail.assessment;
      setEditingAssessmentId(ass.id);
      setSelectedInstrumentId(ass.instrument_id);
      setSelectedGtkId(ass.target_gtk_id);
      setSelectedScheduleId(null);
      setSupervisorName(ass.supervisor_name);
      setAssessmentDate(ass.assessment_date);
      setAcademicYear(ass.academic_year);
      setSemester((ass.semester as 'Ganjil' | 'Genap') || 'Genap');
      setExaminerNotes(ass.examiner_notes || '');
      const map: Record<number, ScoreDraft> = {};
      for (const it of detail.items) {
        map[it.id] = {
          score: it.score ?? null,
          notes: it.score_notes || '',
          recommendation: it.recommendation || '',
        };
      }
      setScoresByItemId(map);
      setSubTab('form');
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal membuka detail penilaian.' });
    }
  };

  const handleSaveAssessment = async (status: 'Draft' | 'Final') => {
    if (!currentInstrument || !selectedGtkId) return;
    if (status === 'Final' && liveSummary.unfilled > 0) {
      setFeedback({
        type: 'error',
        msg: `Masih terdapat ${liveSummary.unfilled} butir yang belum diisi (harus 0 untuk finalisasi).`,
      });
      return;
    }

    setSaving(true);
    try {
      const scores = currentInstrument.items.map((it) => ({
        item_id: it.id,
        score: scoresByItemId[it.id]?.score ?? null,
        notes: scoresByItemId[it.id]?.notes ?? '',
        recommendation: scoresByItemId[it.id]?.recommendation ?? '',
      }));

      const payload = {
        instrument_id: currentInstrument.id,
        target_gtk_id: selectedGtkId,
        schedule_id: selectedScheduleId,
        supervisor_name: supervisorName,
        assessment_date: assessmentDate,
        academic_year: academicYear,
        semester,
        status,
        examiner_notes: examinerNotes,
        scores,
      };

      if (editingAssessmentId) {
        await apiFetch(`/api/supervision/assessments/${editingAssessmentId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        const res = await apiFetch<{ id: number }>('/api/supervision/assessments', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setEditingAssessmentId(res.id);
      }

      setFeedback({
        type: 'success',
        msg: `Penilaian supervisi berhasil disimpan sebagai ${status} (Nilai: ${liveSummary.finalValue.toFixed(2)} — ${liveSummary.predicate}).`,
      });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menyimpan penilaian.' });
    } finally {
      setSaving(false);
    }
  };

  const handleExportCurrentPdf = async () => {
    if (editingAssessmentId) {
      const detail = await apiFetch<{ assessment: SupervisionAssessment; items: SupervisionItem[] }>(
        `/api/supervision/assessments/${editingAssessmentId}`
      );
      exportSupervisionPdf(detail.assessment, detail.items);
      return;
    }
    if (!currentInstrument) return;
    const targetGtk = gtkList.find((g) => g.id === selectedGtkId);
    const mockAss: SupervisionAssessment = {
      id: 0,
      instrument_id: currentInstrument.id,
      instrument_title: currentInstrument.title,
      instrument_subtitle: currentInstrument.subtitle,
      target_gtk_id: selectedGtkId,
      target_name: targetGtk?.full_name || '-',
      school_name: 'SMA Darul Ulum Kepohbaru',
      supervisor_name: supervisorName,
      assessment_date: assessmentDate,
      academic_year: academicYear,
      semester,
      status: 'Draft',
      total_score: liveSummary.totalScore,
      max_score: liveSummary.maxScore,
      final_value: liveSummary.finalValue,
      predicate: liveSummary.predicate,
      unfilled_count: liveSummary.unfilled,
      examiner_notes: examinerNotes,
    };
    const mergedItems = currentInstrument.items.map((it) => ({
      ...it,
      score: scoresByItemId[it.id]?.score ?? null,
      score_notes: scoresByItemId[it.id]?.notes ?? '',
      recommendation: scoresByItemId[it.id]?.recommendation ?? '',
    }));
    exportSupervisionPdf(mockAss, mergedItems);
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/supervision/schedules', {
        method: 'POST',
        body: JSON.stringify({
          ...scheduleForm,
          instrument_id: Number(scheduleForm.instrument_id),
          target_gtk_id: Number(scheduleForm.target_gtk_id),
        }),
      });
      setScheduleModalOpen(false);
      setFeedback({ type: 'success', msg: 'Jadwal supervisi berhasil ditambahkan.' });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal membuat jadwal.' });
    }
  };

  const handleCreateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/supervision/follow-ups', {
        method: 'POST',
        body: JSON.stringify({
          ...followUpForm,
          assessment_id: Number(followUpForm.assessment_id),
        }),
      });
      setFollowUpModalOpen(false);
      setFeedback({ type: 'success', msg: 'Rencana Tindak Lanjut (RTL) berhasil ditambahkan.' });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menyimpan tindak lanjut.' });
    }
  };

  const updateFollowUpStatus = async (fu: SupervisionFollowUp, status: SupervisionFollowUp['status']) => {
    try {
      await apiFetch(`/api/supervision/follow-ups/${fu.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status, progress_notes: fu.progress_notes }),
      });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal memperbarui status.' });
    }
  };

  const chartData = useMemo(
    () =>
      assessments.slice(0, 8).map((a) => ({
        label: `${a.target_name.split(' ').slice(0, 2).join(' ')} (${a.assessment_date.slice(5)})`,
        Nilai: Number(a.final_value),
      })),
    [assessments]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sistem Supervisi Digital</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Penilaian kinerja kepala sekolah, guru, dan tenaga kependidikan mengacu pada 8 instrumen resmi (skala 1–4).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          {[
            { id: 'rekap', label: 'Rekap & Grafik' },
            { id: 'form', label: 'Formulir Penilaian' },
            { id: 'schedules', label: 'Jadwal' },
            { id: 'followups', label: 'Tindak Lanjut' },
            { id: 'catalog', label: 'Instrumen (8)' },
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
      </div>

      {feedback && (
        <div
          className={`flex items-center justify-between px-4 py-3 rounded-lg border text-sm no-print ${
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

      {/* SUBTAB 1: REKAP & GRAFIK */}
      {subTab === 'rekap' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Total Penilaian Tercatat</p>
              <p className="text-3xl font-bold text-slate-900 tabular-nums mt-1">{assessments.length}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Rata-rata Nilai Akhir</p>
              <p className="text-3xl font-bold text-emerald-700 tabular-nums mt-1">
                {assessments.length > 0
                  ? (assessments.reduce((a, b) => a + Number(b.final_value), 0) / assessments.length).toFixed(2)
                  : '0.00'}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Jadwal Terdaftar</p>
              <p className="text-3xl font-bold text-slate-900 tabular-nums mt-1">{schedules.length}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Rencana Tindak Lanjut</p>
              <p className="text-3xl font-bold text-slate-900 tabular-nums mt-1">{followUps.length}</p>
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Visualisasi Nilai Hasil Supervisi</h2>
                  <p className="text-xs text-slate-500">Skala 0–100 (Sangat Baik 91–100 · Baik 76–90 · Cukup 61–75)</p>
                </div>
                {canAssess && (
                  <button
                    type="button"
                    onClick={() => startNewAssessment()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
                  >
                    <Plus className="w-3.5 h-3.5" /> Buat Penilaian Baru
                  </button>
                )}
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#475569' }} />
                    <Tooltip />
                    <Bar dataKey="Nilai" fill="#047857" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Rekapitulasi Hasil Penilaian Supervisi</h2>
              {canAssess && (
                <button
                  type="button"
                  onClick={() => startNewAssessment()}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  + Penilaian Baru
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">GTK yang Dinilai</th>
                    <th className="py-3 px-4">Instrumen Penilaian</th>
                    <th className="py-3 px-4 text-right">Skor</th>
                    <th className="py-3 px-4 text-right">Nilai</th>
                    <th className="py-3 px-4">Predikat</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Memuat data supervisi...
                      </td>
                    </tr>
                  ) : assessments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Belum ada penilaian supervisi tersimpan.
                      </td>
                    </tr>
                  ) : (
                    assessments.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono text-xs text-slate-600">{a.assessment_date}</td>
                        <td className="py-3 px-4 font-medium text-slate-900">{a.target_name}</td>
                        <td className="py-3 px-4 text-slate-700">{a.instrument_title}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          {a.total_score} / {a.max_score}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-700">
                          {Number(a.final_value).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-slate-800">{a.predicate}</td>
                        <td className="py-3 px-4 text-xs font-semibold text-slate-600">{a.status}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openAssessmentDetail(a.id)}
                              className="px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-100"
                            >
                              {canAssess ? 'Buka / Nilai' : 'Lihat'}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const detail = await apiFetch<{ assessment: SupervisionAssessment; items: SupervisionItem[] }>(
                                  `/api/supervision/assessments/${a.id}`
                                );
                                exportSupervisionPdf(detail.assessment, detail.items);
                              }}
                              className="p-1.5 text-slate-600 hover:text-emerald-700 rounded-md hover:bg-slate-100"
                              title="Ekspor PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                downloadWithAuth(
                                  `/api/supervision/assessments/${a.id}/export-excel`,
                                  `Laporan_Supervisi_${a.id}.xlsx`
                                )
                              }
                              className="p-1.5 text-slate-600 hover:text-emerald-700 rounded-md hover:bg-slate-100"
                              title="Ekspor Excel"
                            >
                              <FileSpreadsheet className="w-4 h-4" />
                            </button>
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

      {/* SUBTAB 2: FORMULIR PENILAIAN DIGITAL */}
      {subTab === 'form' && (
        <div className="space-y-6">
          {/* Header Identity & Instrument Selector */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <p className="text-xs font-semibold text-emerald-700">
                  INSTRUMEN SUPERVISI DIGITAL — SMA DARUL ULUM KEPOHBARU
                </p>
                <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                  {currentInstrument?.subtitle || 'Pilih Instrumen Supervisi'}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  <Printer className="w-3.5 h-3.5" /> Cetak
                </button>
                <button
                  type="button"
                  onClick={handleExportCurrentPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  <Download className="w-3.5 h-3.5" /> Ekspor PDF
                </button>
                {editingAssessmentId && (
                  <button
                    type="button"
                    onClick={() =>
                      downloadWithAuth(
                        `/api/supervision/assessments/${editingAssessmentId}/export-excel`,
                        `Laporan_Supervisi_${editingAssessmentId}.xlsx`
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Ekspor Excel
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Instrumen Penilaian (8 Lembar Referensi)</label>
                <select
                  disabled={!canAssess || editingAssessmentId !== null}
                  value={selectedInstrumentId}
                  onChange={(e) => {
                    setSelectedInstrumentId(Number(e.target.value));
                    setScoresByItemId({});
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                >
                  {instruments.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.title} ({inst.total_items} butir · Maks {inst.max_score})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">GTK / Kepala Sekolah yang Dinilai</label>
                <select
                  disabled={!canAssess || editingAssessmentId !== null}
                  value={selectedGtkId}
                  onChange={(e) => setSelectedGtkId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                >
                  {gtkList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.full_name} ({g.position})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Penilaian</label>
                <input
                  type="date"
                  disabled={!canAssess}
                  value={assessmentDate}
                  onChange={(e) => setAssessmentDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-100"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Supervisor / Penilai</label>
                <input
                  disabled={!canAssess}
                  value={supervisorName}
                  onChange={(e) => setSupervisorName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tahun Pelajaran</label>
                <input
                  disabled={!canAssess}
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Semester</label>
                <select
                  disabled={!canAssess}
                  value={semester}
                  onChange={(e) => setSemester(e.target.value as 'Ganjil' | 'Genap')}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                >
                  <option value="Ganjil">Ganjil</option>
                  <option value="Genap">Genap</option>
                </select>
              </div>
            </div>

            {currentInstrument && (
              <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                {currentInstrument.description} Beri tanda pada satu kolom skala (1–4) untuk setiap butir. Kolom Skor terisi otomatis.
              </p>
            )}
          </div>

          {/* Rubric Assessment Table */}
          {currentInstrument && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-900 text-white text-xs">
                      <th className="py-3 px-3 w-14 text-center">No</th>
                      <th className="py-3 px-3 min-w-[220px]">Indikator / Rincian Tugas</th>
                      <th className="py-3 px-3 min-w-[260px]">Bukti Fisik / Hal yang Diperiksa</th>
                      <th className="py-3 px-3 w-36">Cara Periksa & Kaitan</th>
                      <th className="py-3 px-3 w-44 text-center">Skala (1–4)</th>
                      <th className="py-3 px-3 w-16 text-center">Skor</th>
                      <th className="py-3 px-3 min-w-[220px]">Catatan & Rekomendasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {currentInstrument.items.map((item, idx) => {
                      const prevSection = idx > 0 ? currentInstrument.items[idx - 1].section_title : '';
                      const showSection = item.section_title !== prevSection;
                      const draft = scoresByItemId[item.id] || { score: null, notes: '', recommendation: '' };

                      return (
                        <React.Fragment key={item.id}>
                          {showSection && (
                            <tr className="bg-slate-100 border-y border-slate-200">
                              <td colSpan={7} className="py-2.5 px-4 text-xs font-bold text-slate-900">
                                {item.section_title}
                              </td>
                            </tr>
                          )}
                          <tr className="align-top hover:bg-slate-50/50">
                            <td className="py-3 px-3 text-center font-mono font-semibold text-slate-900 tabular-nums">
                              {item.item_number}
                            </td>
                            <td className="py-3 px-3 font-medium text-slate-900 leading-relaxed">
                              {item.indicator_text}
                            </td>
                            <td className="py-3 px-3 text-xs text-slate-600">
                              <ul className="list-disc pl-4 space-y-1">
                                {item.physical_evidence.map((ev, eIdx) => (
                                  <li key={eIdx}>{ev}</li>
                                ))}
                              </ul>
                            </td>
                            <td className="py-3 px-3 text-xs text-slate-600">
                              <div>{item.inspection_method}</div>
                              <div className="text-[11px] font-mono text-slate-500 mt-1">
                                Kaitan: {item.general_item_link}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center justify-center gap-1">
                                {[1, 2, 3, 4].map((val) => {
                                  const active = draft.score === val;
                                  return (
                                    <button
                                      key={val}
                                      type="button"
                                      disabled={!canAssess}
                                      onClick={() =>
                                        setScoresByItemId((prev) => ({
                                          ...prev,
                                          [item.id]: { ...draft, score: val },
                                        }))
                                      }
                                      className={`w-9 h-9 rounded-lg font-mono text-xs font-semibold border transition-colors ${
                                        active
                                          ? 'bg-emerald-700 text-white border-emerald-700'
                                          : 'bg-white text-slate-700 border-slate-300 hover:border-emerald-600'
                                      } disabled:opacity-70`}
                                      aria-label={`Skala ${val} untuk butir ${item.item_number}`}
                                    >
                                      {val}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold tabular-nums text-slate-900">
                              {draft.score ?? '-'}
                            </td>
                            <td className="py-3 px-3 space-y-1.5">
                              <textarea
                                rows={2}
                                disabled={!canAssess}
                                placeholder="Catatan temuan..."
                                value={draft.notes}
                                onChange={(e) =>
                                  setScoresByItemId((prev) => ({
                                    ...prev,
                                    [item.id]: { ...draft, notes: e.target.value },
                                  }))
                                }
                                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-50"
                              />
                              <input
                                type="text"
                                disabled={!canAssess}
                                placeholder="Rekomendasi perbaikan..."
                                value={draft.recommendation}
                                onChange={(e) =>
                                  setScoresByItemId((prev) => ({
                                    ...prev,
                                    [item.id]: { ...draft, recommendation: e.target.value },
                                  }))
                                }
                                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-50"
                              />
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Automatic Recapitulation Footer matching PDF */}
              <div className="p-6 bg-slate-50 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-6 space-y-2">
                  <label className="block text-xs font-semibold text-slate-900">
                    Catatan Pemeriksa (Temuan, Kekuatan, Saran)
                  </label>
                  <textarea
                    rows={4}
                    disabled={!canAssess}
                    value={examinerNotes}
                    onChange={(e) => setExaminerNotes(e.target.value)}
                    placeholder="Tuliskan temuan utama, kekuatan praktik, dan saran tindak lanjut..."
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg disabled:bg-slate-100"
                  />
                  <div className="text-xs text-slate-500 pt-1">
                    Keterangan Predikat: 91–100 Sangat Baik · 76–90 Baik · 61–75 Cukup (Butuh Perbaikan) · 51–60 Kurang · ≤50 Sangat Kurang
                  </div>
                </div>

                <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <dl className="divide-y divide-slate-200 text-sm">
                    <div className="px-4 py-2.5 flex justify-between">
                      <dt className="text-slate-600">Jumlah skor</dt>
                      <dd className="font-mono font-bold tabular-nums text-slate-900">{liveSummary.totalScore}</dd>
                    </div>
                    <div className="px-4 py-2.5 flex justify-between">
                      <dt className="text-slate-600">Skor maksimal (jumlah butir × 4)</dt>
                      <dd className="font-mono font-bold tabular-nums text-slate-900">{liveSummary.maxScore}</dd>
                    </div>
                    <div className="px-4 py-2.5 flex justify-between bg-emerald-50/70">
                      <dt className="font-semibold text-slate-900">Nilai = Jumlah skor ÷ Skor maksimal × 100</dt>
                      <dd className="font-mono font-bold tabular-nums text-emerald-700 text-base">
                        {liveSummary.finalValue.toFixed(2)}
                      </dd>
                    </div>
                    <div className="px-4 py-2.5 flex justify-between bg-emerald-50/70">
                      <dt className="font-semibold text-slate-900">Predikat</dt>
                      <dd className="font-bold text-emerald-800">{liveSummary.predicate}</dd>
                    </div>
                    <div className="px-4 py-2.5 flex justify-between">
                      <dt className="text-slate-600">Butir belum diisi (harus 0)</dt>
                      <dd className={`font-mono font-bold tabular-nums ${liveSummary.unfilled === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {liveSummary.unfilled}
                      </dd>
                    </div>
                    <div className="px-4 py-2.5 flex justify-between">
                      <dt className="text-slate-600">Butir bertanda ganda (harus 0)</dt>
                      <dd className="font-mono font-bold tabular-nums text-emerald-700">0</dd>
                    </div>
                  </dl>
                </div>
              </div>

              {canAssess && (
                <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-end gap-3 no-print">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveAssessment('Draft')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    <Save className="w-4 h-4" /> Simpan Draft
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveAssessment('Final')}
                    className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Finalisasi Penilaian
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: JADWAL SUPERVISI */}
      {subTab === 'schedules' && (
        <div className="space-y-4">
          {canAssess && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setScheduleForm({
                    instrument_id: instruments[0] ? String(instruments[0].id) : '',
                    target_gtk_id: gtkList[0] ? String(gtkList[0].id) : '',
                    scheduled_date: new Date().toISOString().slice(0, 10),
                    academic_year: '2025/2026',
                    semester: 'Genap',
                    notes: '',
                  });
                  setScheduleModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" /> Buat Jadwal Supervisi
              </button>
            </div>
          )}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">GTK Sasaran</th>
                    <th className="py-3 px-4">Instrumen</th>
                    <th className="py-3 px-4">Penilai</th>
                    <th className="py-3 px-4">Status</th>
                    {canAssess && <th className="py-3 px-4 text-right">Tindakan</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schedules.map((sc) => (
                    <tr key={sc.id}>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700">{sc.scheduled_date}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{sc.target_gtk_name}</div>
                        <div className="text-xs text-slate-500">{sc.target_position}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{sc.instrument_title}</td>
                      <td className="py-3 px-4 text-slate-600">{sc.supervisor_name || '-'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs font-semibold ${
                            sc.status === 'Selesai' ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {sc.status}
                        </span>
                      </td>
                      {canAssess && (
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => startNewAssessment(sc.instrument_id, sc.target_gtk_id, sc.id)}
                            className="px-3 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-50"
                          >
                            Mulai Penilaian
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

      {/* SUBTAB 4: MONITORING TINDAK LANJUT (RTL) */}
      {subTab === 'followups' && (
        <div className="space-y-4">
          {canAssess && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setFollowUpForm({
                    assessment_id: assessments[0] ? String(assessments[0].id) : '',
                    action_plan: '',
                    pic_name: gtkList[0]?.full_name || '',
                    due_date: new Date().toISOString().slice(0, 10),
                    progress_notes: '',
                  });
                  setFollowUpModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Rencana Tindak Lanjut
              </button>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Rencana Tindak Lanjut</th>
                    <th className="py-3 px-4">Supervisi Terkait</th>
                    <th className="py-3 px-4">Penanggung Jawab</th>
                    <th className="py-3 px-4">Target Selesai</th>
                    <th className="py-3 px-4">Status Progres</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {followUps.map((fu) => (
                    <tr key={fu.id}>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{fu.action_plan}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{fu.progress_notes}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        <div className="font-medium text-slate-800">{fu.target_name}</div>
                        <div>{fu.instrument_title}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{fu.pic_name}</td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">{fu.due_date}</td>
                      <td className="py-3 px-4">
                        <select
                          value={fu.status}
                          onChange={(e) => updateFollowUpStatus(fu, e.target.value as SupervisionFollowUp['status'])}
                          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-medium"
                        >
                          <option value="Belum Dimulai">Belum Dimulai</option>
                          <option value="Dalam Proses">Dalam Proses</option>
                          <option value="Terlaksana">Terlaksana</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: KATALOG 8 INSTRUMEN */}
      {subTab === 'catalog' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-3 space-y-1">
            {instruments.map((inst) => (
              <button
                key={inst.id}
                type="button"
                onClick={() => setCatalogInstrumentId(inst.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  catalogInstrument?.id === inst.id
                    ? 'bg-emerald-700 text-white'
                    : 'hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div className="text-xs font-semibold leading-snug">{inst.title}</div>
                <div className={`text-[11px] mt-1 font-mono ${catalogInstrument?.id === inst.id ? 'text-emerald-100' : 'text-slate-500'}`}>
                  {inst.total_items} butir · Skor maks {inst.max_score}
                </div>
              </button>
            ))}
          </div>
          {catalogInstrument && (
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-slate-900">{catalogInstrument.title}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{catalogInstrument.description}</p>
                </div>
                {canAssess && (
                  <button
                    type="button"
                    onClick={() => startNewAssessment(catalogInstrument.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shrink-0"
                  >
                    <ClipboardList className="w-3.5 h-3.5" /> Gunakan Instrumen Ini
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-200">
                {catalogInstrument.items.map((it) => (
                  <div key={it.id} className="py-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">
                        <span className="font-mono text-emerald-700 mr-2">{it.item_number}.</span>
                        {it.indicator_text}
                      </p>
                      <span className="text-[11px] font-mono text-slate-500 shrink-0">{it.general_item_link}</span>
                    </div>
                    <ul className="list-disc pl-6 text-xs text-slate-600 space-y-0.5">
                      {it.physical_evidence.map((ev, i) => (
                        <li key={i}>{ev}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Schedule Modal */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">Buat Jadwal Supervisi</h3>
              <button type="button" onClick={() => setScheduleModalOpen(false)} className="p-1 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSchedule} className="p-6 space-y-3">
              <select
                required
                value={scheduleForm.instrument_id}
                onChange={(e) => setScheduleForm({ ...scheduleForm, instrument_id: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {instruments.map((inst) => (
                  <option key={inst.id} value={String(inst.id)}>
                    {inst.title}
                  </option>
                ))}
              </select>
              <select
                required
                value={scheduleForm.target_gtk_id}
                onChange={(e) => setScheduleForm({ ...scheduleForm, target_gtk_id: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {gtkList.map((g) => (
                  <option key={g.id} value={String(g.id)}>
                    {g.full_name} ({g.position})
                  </option>
                ))}
              </select>
              <input
                type="date"
                required
                value={scheduleForm.scheduled_date}
                onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_date: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <textarea
                rows={2}
                placeholder="Catatan fokus supervisi..."
                value={scheduleForm.notes}
                onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setScheduleModalOpen(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg">
                  Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Follow-Up Modal */}
      {followUpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">Tambah Rencana Tindak Lanjut</h3>
              <button type="button" onClick={() => setFollowUpModalOpen(false)} className="p-1 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateFollowUp} className="p-6 space-y-3">
              <select
                required
                value={followUpForm.assessment_id}
                onChange={(e) => setFollowUpForm({ ...followUpForm, assessment_id: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {assessments.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.target_name} — {a.instrument_title} ({a.final_value})
                  </option>
                ))}
              </select>
              <textarea
                required
                rows={3}
                placeholder="Rencana aksi tindak lanjut *"
                value={followUpForm.action_plan}
                onChange={(e) => setFollowUpForm({ ...followUpForm, action_plan: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <input
                required
                placeholder="Penanggung Jawab *"
                value={followUpForm.pic_name}
                onChange={(e) => setFollowUpForm({ ...followUpForm, pic_name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <input
                type="date"
                required
                value={followUpForm.due_date}
                onChange={(e) => setFollowUpForm({ ...followUpForm, due_date: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setFollowUpModalOpen(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg">
                  Simpan RTL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
