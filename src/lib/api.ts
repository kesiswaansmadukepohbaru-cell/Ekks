import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SupervisionAssessment, SupervisionItem } from '../types';

const TOKEN_KEY = 'sims_du_auth_token';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export async function apiFetch<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const json = await res.json();
      if (json?.error) errMsg = json.error;
    } catch {
      // fallback
    }
    throw new Error(errMsg);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.blob()) as unknown as T;
}

export function downloadWithAuth(url: string, fallbackFilename: string): void {
  const token = getAuthToken();
  const sep = url.includes('?') ? '&' : '?';
  const fullUrl = token ? `${url}${sep}token=${encodeURIComponent(token)}` : url;
  const link = document.createElement('a');
  link.href = fullUrl;
  link.download = fallbackFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportSupervisionPdf(
  assessment: SupervisionAssessment,
  items: SupervisionItem[]
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFillColor(15, 23, 42);
  doc.rect(14, 12, 269, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('SISTEM SUPERVISI DIGITAL — SMA DARUL ULUM KEPOHBARU', 148.5, 18.5, { align: 'center' });

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(assessment.instrument_subtitle || assessment.instrument_title, 148.5, 28, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nama Sekolah          : ${assessment.school_name}`, 14, 36);
  doc.text(`GTK / Kepala Sekolah  : ${assessment.target_name}`, 14, 41);
  doc.text(`Supervisor / Penilai  : ${assessment.supervisor_name}`, 155, 36);
  doc.text(`Tanggal / Semester    : ${assessment.assessment_date} (${assessment.academic_year} · ${assessment.semester})`, 155, 41);

  const tableRows = items.map((it) => [
    it.item_number,
    `${it.section_title}\n${it.indicator_text}`,
    it.physical_evidence.map((e) => `• ${e}`).join('\n'),
    it.inspection_method,
    it.general_item_link,
    it.score === 1 ? 'v' : '',
    it.score === 2 ? 'v' : '',
    it.score === 3 ? 'v' : '',
    it.score === 4 ? 'v' : '',
    it.score ?? '-',
    it.score_notes || '-',
  ]);

  autoTable(doc, {
    startY: 46,
    head: [
      [
        'No',
        'Indikator yang Diperiksa',
        'Bukti Fisik / Hal yang Diperiksa',
        'Cara Periksa',
        'Kaitan',
        '1',
        '2',
        '3',
        '4',
        'Skor',
        'Catatan',
      ],
    ],
    body: tableRows,
    styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 52 },
      2: { cellWidth: 72 },
      3: { cellWidth: 24 },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 7, halign: 'center' },
      6: { cellWidth: 7, halign: 'center' },
      7: { cellWidth: 7, halign: 'center' },
      8: { cellWidth: 7, halign: 'center' },
      9: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      10: { cellWidth: 55 },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  autoTable(doc, {
    startY: finalY,
    body: [
      ['Jumlah skor', String(assessment.total_score)],
      ['Skor maksimal (jumlah butir × 4)', String(assessment.max_score)],
      ['Nilai = Jumlah skor ÷ Skor maksimal × 100', Number(assessment.final_value).toFixed(2)],
      ['Predikat', assessment.predicate],
      ['Butir belum diisi (harus 0)', String(assessment.unfilled_count)],
      ['Butir bertanda ganda (harus 0)', '0'],
    ],
    styles: { fontSize: 8.5, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 90, fontStyle: 'bold', fillColor: [240, 249, 244] },
      1: { cellWidth: 45, halign: 'center', fontStyle: 'bold', fillColor: [240, 249, 244] },
    },
    margin: { left: 148 },
  });

  const notesY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Catatan Pemeriksa (Temuan, Kekuatan, Saran):', 14, notesY);
  doc.setFont('helvetica', 'normal');
  doc.text(assessment.examiner_notes || '-', 14, notesY + 5, { maxWidth: 265 });

  doc.save(`Laporan_Supervisi_${assessment.target_name.replace(/\s+/g, '_')}_${assessment.assessment_date}.pdf`);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function calculatePredicateClient(finalValue: number): string {
  if (finalValue >= 91) return 'Sangat Baik';
  if (finalValue >= 76) return 'Baik';
  if (finalValue >= 61) return 'Cukup (Butuh Perbaikan)';
  if (finalValue >= 51) return 'Kurang';
  return 'Sangat Kurang';
}
