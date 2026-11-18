export type UserRole = 'ADMIN' | 'KEPALA_SEKOLAH' | 'GURU' | 'STAF' | 'ORANG_TUA';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  nipOrNik: string;
  phone: string;
  gtkId: number | null;
  lastLoginAt?: string;
}

export interface SchoolProfile {
  id: number;
  name: string;
  npsn: string;
  nss: string;
  accreditation: string;
  address: string;
  district: string;
  regency: string;
  province: string;
  postal_code: string;
  phone: string;
  email: string;
  website: string;
  principal_name: string;
  principal_nip: string;
  founded_year: number;
  vision: string;
  mission: string[];
  objectives: string[];
  history: string;
  org_structure: { role: string; name: string; division: string }[];
  programs: { title: string; category: string; description: string }[];
  achievements: { year: string; title: string; level: string }[];
  social_links: Record<string, string>;
  hero_image_url?: string;
}

export interface GtkStaff {
  id: number;
  nip: string;
  nuptk: string;
  full_name: string;
  gender: 'L' | 'P';
  category: 'Kepala Sekolah' | 'Guru' | 'Tenaga Kependidikan';
  position: string;
  subject: string;
  employment_status: string;
  education: string;
  phone?: string;
  email?: string;
  join_year: number;
  is_active?: number;
}

export interface AcademicYear {
  id: number;
  year_label: string;
  semester: 'Ganjil' | 'Genap';
  is_active: number;
  start_date: string;
  end_date: string;
}

export interface SchoolClass {
  id: number;
  name: string;
  grade_level: number;
  program: string;
  academic_year_id: number;
  year_label?: string;
  semester?: string;
  homeroom_teacher_id: number | null;
  homeroom_teacher_name?: string;
  room_name: string;
  capacity: number;
  student_count?: number;
}

export interface Student {
  id: number;
  nis: string;
  nisn: string;
  full_name: string;
  gender: 'L' | 'P';
  birth_place: string;
  birth_date: string;
  religion: string;
  address: string;
  parent_name: string;
  parent_phone: string;
  parent_user_id: number | null;
  class_id: number | null;
  class_name?: string;
  grade_level?: number;
  program?: string;
  entry_year: number;
  status: 'Aktif' | 'Lulus' | 'Pindah' | 'Keluar';
  notes: string;
}

export interface StudentAcademicRecord {
  id: number;
  student_id: number;
  student_name?: string;
  academic_year_id: number;
  year_label?: string;
  semester: 'Ganjil' | 'Genap';
  class_name: string;
  attendance_pct: number;
  average_score: number;
  conduct_grade: string;
  homeroom_notes: string;
}

export interface Announcement {
  id: number;
  title: string;
  category: 'Pengumuman' | 'Berita' | 'Agenda' | 'Prestasi';
  summary: string;
  content: string;
  event_date: string;
  author_name?: string;
}

export interface GalleryItem {
  id: number;
  title: string;
  category: string;
  image_url: string;
  caption: string;
  event_date: string;
}

export interface ArchiveFolder {
  id: number;
  name: string;
  parent_id: number | null;
  category: 'Manajerial' | 'Kewirausahaan' | 'Supervisi';
  academic_year: string;
  description: string;
  allowed_roles: UserRole[];
  document_count: number;
}

export interface ArchiveDocument {
  id: number;
  folder_id: number;
  folder_name?: string;
  title: string;
  original_filename: string;
  stored_filename: string;
  mime_type: string;
  file_size: number;
  category: 'Manajerial' | 'Kewirausahaan' | 'Supervisi';
  academic_year: string;
  activity_name: string;
  description: string;
  allowed_roles: UserRole[];
  uploader_name?: string;
  uploaded_at: string;
}

export interface SupervisionItem {
  id: number;
  instrument_id: number;
  section_code: string;
  section_title: string;
  item_number: string;
  indicator_text: string;
  physical_evidence: string[];
  inspection_method: string;
  general_item_link: string;
  sort_order: number;
  score?: number | null;
  score_notes?: string;
  recommendation?: string;
}

export interface SupervisionInstrument {
  id: number;
  code: string;
  title: string;
  subtitle: string;
  description: string;
  target_role: string;
  total_items: number;
  max_score: number;
  items: SupervisionItem[];
}

export interface SupervisionSchedule {
  id: number;
  instrument_id: number;
  instrument_title: string;
  target_gtk_id: number;
  target_gtk_name: string;
  target_position: string;
  supervisor_name: string;
  scheduled_date: string;
  academic_year: string;
  semester: string;
  status: 'Terjadwal' | 'Berlangsung' | 'Selesai';
  notes: string;
}

export interface SupervisionAssessment {
  id: number;
  instrument_id: number;
  instrument_title: string;
  instrument_subtitle?: string;
  instrument_code?: string;
  total_items?: number;
  target_gtk_id: number;
  target_name: string;
  target_nip?: string;
  target_position?: string;
  school_name: string;
  supervisor_name: string;
  assessment_date: string;
  academic_year: string;
  semester: string;
  status: 'Draft' | 'Final';
  total_score: number;
  max_score: number;
  final_value: number;
  predicate: string;
  unfilled_count: number;
  examiner_notes: string;
}

export interface SupervisionFollowUp {
  id: number;
  assessment_id: number;
  target_name?: string;
  assessment_date?: string;
  instrument_title?: string;
  action_plan: string;
  pic_name: string;
  due_date: string;
  status: 'Belum Dimulai' | 'Dalam Proses' | 'Terlaksana';
  progress_notes: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  username: string;
  user_role: string;
  action: string;
  module: string;
  target_id: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export interface BackupFile {
  filename: string;
  size: number;
  created_at: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  KEPALA_SEKOLAH: 'Kepala Sekolah',
  GURU: 'Guru',
  STAF: 'Staf / Tendik',
  ORANG_TUA: 'Orang Tua / Wali',
};
