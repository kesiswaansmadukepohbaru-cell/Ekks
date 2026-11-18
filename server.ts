import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { createServer as createViteServer } from 'vite';
import {
  BACKUPS_DIR,
  DB_PATH,
  MEDIA_DIR,
  UPLOADS_DIR,
  closeDb,
  getDb,
  initDatabase,
} from './server/db.ts';
import {
  type AuthenticatedRequest,
  type UserRole,
  logAudit,
  parseAllowedRoles,
  requireAuth,
  requireRole,
  sanitizeText,
  signToken,
} from './server/auth.ts';
import { calculateSupervisionPredicate } from './server/instrumentsData.ts';

// Initialize SQLite database & seed data
initDatabase();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Secure Multer Upload Configuration for Digital Archive
const ALLOWED_ARCHIVE_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.jpg',
  '.jpeg',
  '.png',
  '.txt',
  '.csv',
]);

const archiveStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}_${crypto.randomUUID()}${ext}`;
    cb(null, safeName);
  },
});

const uploadArchive = multer({
  storage: archiveStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_ARCHIVE_EXTENSIONS.has(ext)) {
      cb(new Error(`Tipe file "${ext}" tidak diizinkan. Format yang didukung: PDF, Office, Gambar, CSV, TXT.`));
      return;
    }
    cb(null, true);
  },
});

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Public media static serving & secure image upload
app.use('/media', express.static(MEDIA_DIR));

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, MEDIA_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `img_${Date.now()}_${crypto.randomUUID()}${ext}`;
    cb(null, safeName);
  },
});

const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      cb(new Error('Format gambar harus JPG, JPEG, PNG, atau WEBP.'));
      return;
    }
    cb(null, true);
  },
});

// ==========================================
// 1. PUBLIC SCHOOL PROFILE ROUTES
// ==========================================
app.get('/api/public/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/public/profile', (_req, res) => {
  const db = getDb();
  const profile = db.prepare('SELECT * FROM school_profile WHERE id = 1').get() as Record<string, unknown>;
  const gtkPublic = db
    .prepare(
      `SELECT id, full_name, gender, category, position, subject, education, join_year
       FROM gtk_staff WHERE is_active = 1 ORDER BY
       CASE category WHEN 'Kepala Sekolah' THEN 1 WHEN 'Guru' THEN 2 ELSE 3 END, full_name ASC`
    )
    .all();
  const announcements = db
    .prepare(
      `SELECT id, title, category, summary, content, event_date, created_at
       FROM announcements WHERE is_published = 1 ORDER BY event_date DESC, id DESC LIMIT 12`
    )
    .all();
  const gallery = db
    .prepare('SELECT id, title, category, image_url, caption, event_date FROM gallery_items ORDER BY event_date DESC, id DESC')
    .all();

  const stats = {
    totalStudents: (db.prepare(`SELECT COUNT(*) as c FROM students WHERE status = 'Aktif'`).get() as { c: number }).c,
    totalTeachers: (db.prepare(`SELECT COUNT(*) as c FROM gtk_staff WHERE is_active = 1 AND category IN ('Guru','Kepala Sekolah')`).get() as { c: number }).c,
    totalStaff: (db.prepare(`SELECT COUNT(*) as c FROM gtk_staff WHERE is_active = 1 AND category = 'Tenaga Kependidikan'`).get() as { c: number }).c,
    totalClasses: (db.prepare(`SELECT COUNT(*) as c FROM classes`).get() as { c: number }).c,
  };

  res.json({
    profile: {
      ...profile,
      mission: JSON.parse(String(profile.mission_json || '[]')),
      objectives: JSON.parse(String(profile.objectives_json || '[]')),
      org_structure: JSON.parse(String(profile.org_structure_json || '[]')),
      programs: JSON.parse(String(profile.programs_json || '[]')),
      achievements: JSON.parse(String(profile.achievements_json || '[]')),
      social_links: JSON.parse(String(profile.social_links_json || '{}')),
    },
    gtk: gtkPublic,
    announcements,
    gallery,
    stats,
  });
});

// ==========================================
// 2. AUTHENTICATION & SESSION ROUTES
// ==========================================
app.post('/api/auth/login', (req: AuthenticatedRequest, res) => {
  const username = sanitizeText(req.body?.username, 120);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!username || !password) {
    res.status(400).json({ error: 'Username/email dan kata sandi wajib diisi.' });
    return;
  }

  const db = getDb();
  const user = db
    .prepare('SELECT * FROM users WHERE username = ? OR email = ?')
    .get(username, username) as
    | {
        id: number;
        username: string;
        email: string;
        password_hash: string;
        full_name: string;
        role: UserRole;
        nip_or_nik: string;
        phone: string;
        gtk_id: number | null;
        is_active: number;
      }
    | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Username atau kata sandi salah.' });
    return;
  }

  if (!user.is_active) {
    res.status(403).json({ error: 'Akun Anda sedang dinonaktifkan oleh Administrator.' });
    return;
  }

  db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  const token = signToken({
    userId: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
    gtkId: user.gtk_id,
  });

  req.user = {
    userId: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
    gtkId: user.gtk_id,
  };
  logAudit(req, 'LOGIN', 'Auth', user.id, `Login berhasil sebagai ${user.role}`);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      nipOrNik: user.nip_or_nik,
      phone: user.phone,
      gtkId: user.gtk_id,
    },
  });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = db
    .prepare('SELECT id, username, email, full_name, role, nip_or_nik, phone, gtk_id, last_login_at FROM users WHERE id = ?')
    .get(req.user!.userId) as Record<string, unknown>;

  let linkedChildren: unknown[] = [];
  if (req.user!.role === 'ORANG_TUA') {
    linkedChildren = db
      .prepare(
        `SELECT s.id, s.nis, s.nisn, s.full_name, s.status, c.name as class_name, c.grade_level
         FROM students s LEFT JOIN classes c ON s.class_id = c.id
         WHERE s.parent_user_id = ?`
      )
      .all(req.user!.userId);
  }

  let gtkProfile: unknown = null;
  if (req.user!.gtkId) {
    gtkProfile = db.prepare('SELECT * FROM gtk_staff WHERE id = ?').get(req.user!.gtkId);
  }

  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      nipOrNik: user.nip_or_nik,
      phone: user.phone,
      gtkId: user.gtk_id,
      lastLoginAt: user.last_login_at,
    },
    linkedChildren,
    gtkProfile,
  });
});

app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  if (newPassword.length < 8) {
    res.status(400).json({ error: 'Kata sandi baru minimal 8 karakter.' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.userId) as { password_hash: string };
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    res.status(400).json({ error: 'Kata sandi saat ini tidak sesuai.' });
    return;
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user!.userId);
  logAudit(req, 'CHANGE_PASSWORD', 'Auth', req.user!.userId, 'Pengguna memperbarui kata sandi');
  res.json({ message: 'Kata sandi berhasil diperbarui.' });
});

// ==========================================
// 3. ROLE-SCOPED DASHBOARD ROUTE
// ==========================================
app.get('/api/dashboard', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const role = req.user!.role;

  const activeAcademicYear = db.prepare('SELECT * FROM academic_years WHERE is_active = 1 LIMIT 1').get();
  const recentAnnouncements = db
    .prepare('SELECT id, title, category, summary, event_date FROM announcements WHERE is_published = 1 ORDER BY event_date DESC, id DESC LIMIT 5')
    .all();

  if (role === 'ORANG_TUA') {
    const children = db
      .prepare(
        `SELECT s.*, c.name as class_name, c.grade_level, c.program, g.full_name as homeroom_teacher
         FROM students s
         LEFT JOIN classes c ON s.class_id = c.id
         LEFT JOIN gtk_staff g ON c.homeroom_teacher_id = g.id
         WHERE s.parent_user_id = ?`
      )
      .all(req.user!.userId) as { id: number }[];

    const childIds = children.map((c) => c.id);
    let records: unknown[] = [];
    if (childIds.length > 0) {
      const placeholders = childIds.map(() => '?').join(',');
      records = db
        .prepare(
          `SELECT r.*, s.full_name as student_name, a.year_label
           FROM student_academic_records r
           JOIN students s ON r.student_id = s.id
           JOIN academic_years a ON r.academic_year_id = a.id
           WHERE r.student_id IN (${placeholders})
           ORDER BY r.id DESC`
        )
        .all(...childIds);
    }

    res.json({
      role,
      activeAcademicYear,
      children,
      academicRecords: records,
      recentAnnouncements,
    });
    return;
  }

  // Staff/Teacher/Principal/Admin metrics
  const studentStats = {
    totalActive: (db.prepare(`SELECT COUNT(*) as c FROM students WHERE status = 'Aktif'`).get() as { c: number }).c,
    totalMale: (db.prepare(`SELECT COUNT(*) as c FROM students WHERE status = 'Aktif' AND gender = 'L'`).get() as { c: number }).c,
    totalFemale: (db.prepare(`SELECT COUNT(*) as c FROM students WHERE status = 'Aktif' AND gender = 'P'`).get() as { c: number }).c,
    totalGraduated: (db.prepare(`SELECT COUNT(*) as c FROM students WHERE status = 'Lulus'`).get() as { c: number }).c,
  };

  const gtkStats = {
    totalActive: (db.prepare(`SELECT COUNT(*) as c FROM gtk_staff WHERE is_active = 1`).get() as { c: number }).c,
    teachers: (db.prepare(`SELECT COUNT(*) as c FROM gtk_staff WHERE is_active = 1 AND category IN ('Guru','Kepala Sekolah')`).get() as { c: number }).c,
    staff: (db.prepare(`SELECT COUNT(*) as c FROM gtk_staff WHERE is_active = 1 AND category = 'Tenaga Kependidikan'`).get() as { c: number }).c,
  };

  const classSummary = db
    .prepare(
      `SELECT c.id, c.name, c.grade_level, c.program, c.capacity,
              g.full_name as homeroom_teacher,
              COUNT(s.id) as student_count
       FROM classes c
       LEFT JOIN gtk_staff g ON c.homeroom_teacher_id = g.id
       LEFT JOIN students s ON s.class_id = c.id AND s.status = 'Aktif'
       GROUP BY c.id
       ORDER BY c.grade_level ASC, c.name ASC`
    )
    .all();

  const rawGrowthRows = db
    .prepare(
      `SELECT entry_year,
              COUNT(*) as total,
              SUM(CASE WHEN gender = 'L' THEN 1 ELSE 0 END) as male,
              SUM(CASE WHEN gender = 'P' THEN 1 ELSE 0 END) as female,
              SUM(CASE WHEN status = 'Aktif' THEN 1 ELSE 0 END) as active_count,
              SUM(CASE WHEN status = 'Lulus' THEN 1 ELSE 0 END) as graduated_count
       FROM students
       GROUP BY entry_year
       ORDER BY entry_year ASC`
    )
    .all() as {
      entry_year: number;
      total: number;
      male: number;
      female: number;
      active_count: number;
      graduated_count: number;
    }[];

  let runningCumulative = 0;
  const studentGrowthByYear = rawGrowthRows.map((row) => {
    runningCumulative += row.total;
    return {
      year: String(row.entry_year),
      masuk: row.total,
      putra: row.male,
      putri: row.female,
      aktif: row.active_count,
      lulus: row.graduated_count,
      akumulasi: runningCumulative,
    };
  });

  const studentByGrade = db
    .prepare(
      `SELECT
        CASE
          WHEN s.status = 'Lulus' THEN 'Alumni'
          WHEN c.grade_level = 10 THEN 'Kelas X'
          WHEN c.grade_level = 11 THEN 'Kelas XI'
          WHEN c.grade_level = 12 THEN 'Kelas XII'
          ELSE 'Lainnya'
        END as group_label,
        CASE
          WHEN c.grade_level = 10 THEN 1
          WHEN c.grade_level = 11 THEN 2
          WHEN c.grade_level = 12 THEN 3
          WHEN s.status = 'Lulus' THEN 4
          ELSE 5
        END as sort_idx,
        COUNT(*) as total,
        SUM(CASE WHEN s.gender = 'L' THEN 1 ELSE 0 END) as putra,
        SUM(CASE WHEN s.gender = 'P' THEN 1 ELSE 0 END) as putri
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       GROUP BY group_label, sort_idx
       ORDER BY sort_idx ASC`
    )
    .all();

  const archiveDocs = db
    .prepare(
      `SELECT d.id, d.title, d.category, d.academic_year, d.uploaded_at, d.allowed_roles_json, u.full_name as uploader_name
       FROM archive_documents d
       LEFT JOIN users u ON d.uploaded_by = u.id
       ORDER BY d.uploaded_at DESC LIMIT 10`
    )
    .all() as { allowed_roles_json: string }[];

  const visibleArchiveActivity = archiveDocs
    .filter((doc) => role === 'ADMIN' || parseAllowedRoles(doc.allowed_roles_json).includes(role))
    .slice(0, 5);

  const archiveCountByCategory = db
    .prepare(`SELECT category, COUNT(*) as count FROM archive_documents GROUP BY category`)
    .all();

  // Supervision stats (scoped for GURU vs KEPALA_SEKOLAH/ADMIN)
  let assessmentQuery = `
    SELECT sa.id, sa.target_name, sa.final_value, sa.predicate, sa.status, sa.assessment_date,
           si.title as instrument_title, si.code as instrument_code
    FROM supervision_assessments sa
    JOIN supervision_instruments si ON sa.instrument_id = si.id
  `;
  const params: unknown[] = [];
  const isGuruScoped = role === 'GURU' && Boolean(req.user!.gtkId);
  if (isGuruScoped) {
    assessmentQuery += ` WHERE sa.target_gtk_id = ? OR sa.supervisor_user_id = ?`;
    params.push(req.user!.gtkId, req.user!.userId);
  }
  assessmentQuery += ` ORDER BY sa.assessment_date DESC, sa.id DESC`;

  const assessments = db.prepare(assessmentQuery).all(...params) as {
    id: number;
    target_name: string;
    final_value: number;
    predicate: string;
    status: string;
    assessment_date: string;
    instrument_title: string;
  }[];

  const finalAssessments = assessments.filter((a) => a.status === 'Final');
  const avgSupervisionScore =
    finalAssessments.length > 0
      ? Number((finalAssessments.reduce((acc, cur) => acc + cur.final_value, 0) / finalAssessments.length).toFixed(2))
      : 0;

  const scheduleStats = db
    .prepare(`SELECT status, COUNT(*) as count FROM supervision_schedules GROUP BY status`)
    .all();

  const followUpStats = db
    .prepare(`SELECT status, COUNT(*) as count FROM supervision_follow_ups GROUP BY status`)
    .all();

  const instrumentSql = `
    SELECT si.title as name,
           ROUND(AVG(sa.final_value), 2) as avg_value,
           COUNT(sa.id) as total_assessed
    FROM supervision_instruments si
    LEFT JOIN supervision_assessments sa
      ON sa.instrument_id = si.id
      AND sa.status = 'Final'
      ${isGuruScoped ? 'AND (sa.target_gtk_id = ? OR sa.supervisor_user_id = ?)' : ''}
    GROUP BY si.id
    ORDER BY si.sort_order ASC
  `;
  const instrumentPerformance = isGuruScoped
    ? db.prepare(instrumentSql).all(req.user!.gtkId, req.user!.userId)
    : db.prepare(instrumentSql).all();

  const teacherSql = `
    SELECT sa.target_gtk_id,
           sa.target_name,
           COALESCE(g.position, 'Guru') as position,
           COALESCE(g.subject, '-') as subject,
           ROUND(AVG(sa.final_value), 2) as avg_value,
           MAX(sa.final_value) as max_value,
           MIN(sa.final_value) as min_value,
           COUNT(sa.id) as assessment_count,
           MAX(sa.assessment_date) as last_date
    FROM supervision_assessments sa
    LEFT JOIN gtk_staff g ON sa.target_gtk_id = g.id
    WHERE sa.status = 'Final'
    ${isGuruScoped ? 'AND (sa.target_gtk_id = ? OR sa.supervisor_user_id = ?)' : ''}
    GROUP BY sa.target_gtk_id, sa.target_name
    ORDER BY avg_value DESC, sa.target_name ASC
  `;
  const rawTeacherStats = (
    isGuruScoped
      ? db.prepare(teacherSql).all(req.user!.gtkId, req.user!.userId)
      : db.prepare(teacherSql).all()
  ) as {
    target_gtk_id: number;
    target_name: string;
    position: string;
    subject: string;
    avg_value: number;
    max_value: number;
    min_value: number;
    assessment_count: number;
    last_date: string;
  }[];

  const teacherSupervisionStats = rawTeacherStats.map((t) => ({
    ...t,
    predicate: calculateSupervisionPredicate(t.avg_value),
  }));

  const predicateOrder = [
    'Sangat Baik',
    'Baik',
    'Cukup (Butuh Perbaikan)',
    'Kurang',
    'Sangat Kurang',
  ];
  const predicateCounts = new Map<string, number>();
  predicateOrder.forEach((p) => predicateCounts.set(p, 0));
  for (const a of finalAssessments) {
    predicateCounts.set(a.predicate, (predicateCounts.get(a.predicate) ?? 0) + 1);
  }
  const predicateDistribution = predicateOrder.map((predicate) => ({
    predicate,
    count: predicateCounts.get(predicate) ?? 0,
  }));

  res.json({
    role,
    activeAcademicYear,
    studentStats,
    gtkStats,
    classSummary,
    studentGrowthByYear,
    studentByGrade,
    recentAnnouncements,
    visibleArchiveActivity,
    archiveCountByCategory,
    supervisionSummary: {
      totalAssessments: assessments.length,
      finalAssessmentsCount: finalAssessments.length,
      avgScore: avgSupervisionScore,
      recentAssessments: assessments.slice(0, 5),
      scheduleStats,
      followUpStats,
      instrumentPerformance,
      teacherSupervisionStats,
      predicateDistribution,
    },
  });
});

// ==========================================
// 4. ACADEMIC, CLASSES, GTK & STUDENT ROUTES
// ==========================================
app.get('/api/academic-years', requireAuth, (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM academic_years ORDER BY year_label DESC, semester DESC').all();
  res.json(rows);
});

app.post('/api/academic-years', requireAuth, requireRole('ADMIN', 'STAF'), (req: AuthenticatedRequest, res) => {
  const year_label = sanitizeText(req.body?.year_label, 30);
  const semester = req.body?.semester === 'Ganjil' ? 'Ganjil' : 'Genap';
  const start_date = sanitizeText(req.body?.start_date, 20);
  const end_date = sanitizeText(req.body?.end_date, 20);
  if (!year_label || !start_date || !end_date) {
    res.status(400).json({ error: 'Tahun pelajaran, tanggal mulai, dan tanggal selesai wajib diisi.' });
    return;
  }
  const db = getDb();
  const info = db
    .prepare('INSERT INTO academic_years (year_label, semester, is_active, start_date, end_date) VALUES (?, ?, 0, ?, ?)')
    .run(year_label, semester, start_date, end_date);
  logAudit(req, 'CREATE', 'AcademicYear', info.lastInsertRowid as number, `${year_label} (${semester})`);
  res.status(201).json({ id: info.lastInsertRowid, year_label, semester, is_active: 0, start_date, end_date });
});

app.put('/api/academic-years/:id/activate', requireAuth, requireRole('ADMIN'), (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('UPDATE academic_years SET is_active = 0').run();
    db.prepare('UPDATE academic_years SET is_active = 1 WHERE id = ?').run(id);
  });
  tx();
  logAudit(req, 'ACTIVATE', 'AcademicYear', id, 'Mengaktifkan tahun pelajaran');
  res.json({ message: 'Tahun pelajaran aktif berhasil diperbarui.' });
});

app.get('/api/classes', requireAuth, (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.*, a.year_label, a.semester, g.full_name as homeroom_teacher_name,
              (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.status = 'Aktif') as student_count
       FROM classes c
       LEFT JOIN academic_years a ON c.academic_year_id = a.id
       LEFT JOIN gtk_staff g ON c.homeroom_teacher_id = g.id
       ORDER BY c.grade_level ASC, c.name ASC`
    )
    .all();
  res.json(rows);
});

app.post('/api/classes', requireAuth, requireRole('ADMIN', 'STAF'), (req: AuthenticatedRequest, res) => {
  const name = sanitizeText(req.body?.name, 50);
  const grade_level = Number(req.body?.grade_level);
  const program = sanitizeText(req.body?.program, 60) || 'Kurikulum Merdeka';
  const academic_year_id = Number(req.body?.academic_year_id);
  const homeroom_teacher_id = req.body?.homeroom_teacher_id ? Number(req.body.homeroom_teacher_id) : null;
  const room_name = sanitizeText(req.body?.room_name, 50) || '-';
  const capacity = Number(req.body?.capacity) || 36;

  if (!name || ![10, 11, 12].includes(grade_level) || !academic_year_id) {
    res.status(400).json({ error: 'Nama kelas, tingkat (10/11/12), dan tahun pelajaran wajib diisi.' });
    return;
  }

  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO classes (name, grade_level, program, academic_year_id, homeroom_teacher_id, room_name, capacity)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(name, grade_level, program, academic_year_id, homeroom_teacher_id, room_name, capacity);
  logAudit(req, 'CREATE', 'Class', info.lastInsertRowid as number, `Menambah kelas ${name}`);
  res.status(201).json({ id: info.lastInsertRowid });
});

app.delete('/api/classes/:id', requireAuth, requireRole('ADMIN'), (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  db.prepare('DELETE FROM classes WHERE id = ?').run(id);
  logAudit(req, 'DELETE', 'Class', id, 'Menghapus kelas');
  res.json({ message: 'Kelas berhasil dihapus.' });
});

// GTK (Guru & Tenaga Kependidikan)
app.get('/api/gtk', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const search = sanitizeText(req.query.search, 100);
  const category = sanitizeText(req.query.category, 50);

  let sql = 'SELECT * FROM gtk_staff WHERE 1=1';
  const params: unknown[] = [];
  if (search) {
    sql += ' AND (full_name LIKE ? OR nip LIKE ? OR position LIKE ? OR subject LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  if (category && category !== 'Semua') {
    sql += ' AND category = ?';
    params.push(category);
  }
  sql += ` ORDER BY CASE category WHEN 'Kepala Sekolah' THEN 1 WHEN 'Guru' THEN 2 ELSE 3 END, full_name ASC`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

app.post('/api/gtk', requireAuth, requireRole('ADMIN', 'STAF'), (req: AuthenticatedRequest, res) => {
  const nip = sanitizeText(req.body?.nip, 40) || '-';
  const nuptk = sanitizeText(req.body?.nuptk, 40) || '-';
  const full_name = sanitizeText(req.body?.full_name, 120);
  const gender = req.body?.gender === 'P' ? 'P' : 'L';
  const category = ['Kepala Sekolah', 'Guru', 'Tenaga Kependidikan'].includes(req.body?.category)
    ? req.body.category
    : 'Guru';
  const position = sanitizeText(req.body?.position, 100);
  const subject = sanitizeText(req.body?.subject, 100) || '-';
  const employment_status = sanitizeText(req.body?.employment_status, 30) || 'GTY';
  const education = sanitizeText(req.body?.education, 80) || 'S1';
  const phone = sanitizeText(req.body?.phone, 30) || '-';
  const email = sanitizeText(req.body?.email, 120) || '-';
  const join_year = Number(req.body?.join_year) || new Date().getFullYear();

  if (!full_name || !position) {
    res.status(400).json({ error: 'Nama lengkap dan jabatan wajib diisi.' });
    return;
  }

  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO gtk_staff (nip, nuptk, full_name, gender, category, position, subject, employment_status, education, phone, email, join_year, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    )
    .run(nip, nuptk, full_name, gender, category, position, subject, employment_status, education, phone, email, join_year);
  logAudit(req, 'CREATE', 'GTK', info.lastInsertRowid as number, `Menambah GTK ${full_name}`);
  res.status(201).json({ id: info.lastInsertRowid });
});

app.put('/api/gtk/:id', requireAuth, requireRole('ADMIN', 'STAF'), (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const full_name = sanitizeText(req.body?.full_name, 120);
  const position = sanitizeText(req.body?.position, 100);
  if (!full_name || !position) {
    res.status(400).json({ error: 'Nama lengkap dan jabatan wajib diisi.' });
    return;
  }
  const db = getDb();
  db.prepare(
    `UPDATE gtk_staff SET nip=?, nuptk=?, full_name=?, gender=?, category=?, position=?, subject=?,
     employment_status=?, education=?, phone=?, email=?, join_year=?, is_active=? WHERE id=?`
  ).run(
    sanitizeText(req.body?.nip, 40) || '-',
    sanitizeText(req.body?.nuptk, 40) || '-',
    full_name,
    req.body?.gender === 'P' ? 'P' : 'L',
    ['Kepala Sekolah', 'Guru', 'Tenaga Kependidikan'].includes(req.body?.category) ? req.body.category : 'Guru',
    position,
    sanitizeText(req.body?.subject, 100) || '-',
    sanitizeText(req.body?.employment_status, 30) || 'GTY',
    sanitizeText(req.body?.education, 80) || 'S1',
    sanitizeText(req.body?.phone, 30) || '-',
    sanitizeText(req.body?.email, 120) || '-',
    Number(req.body?.join_year) || 2020,
    req.body?.is_active === 0 ? 0 : 1,
    id
  );
  logAudit(req, 'UPDATE', 'GTK', id, `Memperbarui data GTK ${full_name}`);
  res.json({ message: 'Data GTK berhasil diperbarui.' });
});

app.delete('/api/gtk/:id', requireAuth, requireRole('ADMIN'), (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  db.prepare('DELETE FROM gtk_staff WHERE id = ?').run(id);
  logAudit(req, 'DELETE', 'GTK', id, 'Menghapus data GTK');
  res.json({ message: 'Data GTK berhasil dihapus.' });
});

app.get('/api/gtk/export', requireAuth, requireRole('ADMIN', 'KEPALA_SEKOLAH', 'STAF'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT nip, nuptk, full_name, gender, category, position, subject, employment_status, education, phone, email, join_year FROM gtk_staff ORDER BY full_name ASC').all() as Record<string, unknown>[];
  const mapped = rows.map((r, idx) => ({
    No: idx + 1,
    NIP: r.nip,
    NUPTK: r.nuptk,
    'Nama Lengkap': r.full_name,
    JK: r.gender,
    Kategori: r.category,
    Jabatan: r.position,
    'Mata Pelajaran': r.subject,
    Status: r.employment_status,
    Pendidikan: r.education,
    Telepon: r.phone,
    Email: r.email,
    'Tahun Masuk': r.join_year,
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(mapped);
  XLSX.utils.book_append_sheet(wb, ws, 'Data_GTK');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  logAudit(req, 'EXPORT_EXCEL', 'GTK', 'all', `Ekspor ${rows.length} data GTK ke Excel`);
  res.setHeader('Content-Disposition', 'attachment; filename="Data_GTK_SMA_Darul_Ulum_Kepohbaru.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// Students (Database Induk Peserta Didik)
app.get('/api/students', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const role = req.user!.role;
  const search = sanitizeText(req.query.search, 100);
  const status = sanitizeText(req.query.status, 30);
  const classId = req.query.classId ? Number(req.query.classId) : null;

  let sql = `
    SELECT s.*, c.name as class_name, c.grade_level, c.program
    FROM students s
    LEFT JOIN classes c ON s.class_id = c.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  // RBAC: Orang Tua hanya melihat anak yang terhubung dengan akunnya
  if (role === 'ORANG_TUA') {
    sql += ' AND s.parent_user_id = ?';
    params.push(req.user!.userId);
  }

  if (search) {
    sql += ' AND (s.full_name LIKE ? OR s.nis LIKE ? OR s.nisn LIKE ? OR s.parent_name LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  if (status && status !== 'Semua') {
    sql += ' AND s.status = ?';
    params.push(status);
  }
  if (classId) {
    sql += ' AND s.class_id = ?';
    params.push(classId);
  }

  sql += ' ORDER BY c.grade_level ASC, c.name ASC, s.full_name ASC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

app.post('/api/students', requireAuth, requireRole('ADMIN', 'STAF'), (req: AuthenticatedRequest, res) => {
  const nis = sanitizeText(req.body?.nis, 30);
  const nisn = sanitizeText(req.body?.nisn, 30);
  const full_name = sanitizeText(req.body?.full_name, 120);
  const gender = req.body?.gender === 'P' ? 'P' : 'L';
  const birth_place = sanitizeText(req.body?.birth_place, 80) || 'Bojonegoro';
  const birth_date = sanitizeText(req.body?.birth_date, 20) || '2009-01-01';
  const religion = sanitizeText(req.body?.religion, 30) || 'Islam';
  const address = sanitizeText(req.body?.address, 250) || '-';
  const parent_name = sanitizeText(req.body?.parent_name, 120) || '-';
  const parent_phone = sanitizeText(req.body?.parent_phone, 30) || '-';
  const parent_user_id = req.body?.parent_user_id ? Number(req.body.parent_user_id) : null;
  const class_id = req.body?.class_id ? Number(req.body.class_id) : null;
  const entry_year = Number(req.body?.entry_year) || new Date().getFullYear();
  const status = ['Aktif', 'Lulus', 'Pindah', 'Keluar'].includes(req.body?.status) ? req.body.status : 'Aktif';
  const notes = sanitizeText(req.body?.notes, 500);

  if (!nis || !nisn || !full_name) {
    res.status(400).json({ error: 'NIS, NISN, dan Nama Lengkap peserta didik wajib diisi.' });
    return;
  }

  const db = getDb();
  try {
    const info = db
      .prepare(
        `INSERT INTO students (nis, nisn, full_name, gender, birth_place, birth_date, religion, address,
         parent_name, parent_phone, parent_user_id, class_id, entry_year, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        nis, nisn, full_name, gender, birth_place, birth_date, religion, address,
        parent_name, parent_phone, parent_user_id, class_id, entry_year, status, notes
      );
    logAudit(req, 'CREATE', 'Student', info.lastInsertRowid as number, `Menambah siswa ${full_name} (NIS ${nis})`);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal menyimpan data siswa (periksa duplikasi NIS/NISN).' });
  }
});

app.put('/api/students/:id', requireAuth, requireRole('ADMIN', 'STAF'), (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const nis = sanitizeText(req.body?.nis, 30);
  const nisn = sanitizeText(req.body?.nisn, 30);
  const full_name = sanitizeText(req.body?.full_name, 120);
  if (!nis || !nisn || !full_name) {
    res.status(400).json({ error: 'NIS, NISN, dan Nama Lengkap wajib diisi.' });
    return;
  }
  const db = getDb();
  try {
    db.prepare(
      `UPDATE students SET nis=?, nisn=?, full_name=?, gender=?, birth_place=?, birth_date=?, religion=?,
       address=?, parent_name=?, parent_phone=?, parent_user_id=?, class_id=?, entry_year=?, status=?, notes=?
       WHERE id=?`
    ).run(
      nis,
      nisn,
      full_name,
      req.body?.gender === 'P' ? 'P' : 'L',
      sanitizeText(req.body?.birth_place, 80) || 'Bojonegoro',
      sanitizeText(req.body?.birth_date, 20) || '2009-01-01',
      sanitizeText(req.body?.religion, 30) || 'Islam',
      sanitizeText(req.body?.address, 250) || '-',
      sanitizeText(req.body?.parent_name, 120) || '-',
      sanitizeText(req.body?.parent_phone, 30) || '-',
      req.body?.parent_user_id ? Number(req.body.parent_user_id) : null,
      req.body?.class_id ? Number(req.body.class_id) : null,
      Number(req.body?.entry_year) || 2025,
      ['Aktif', 'Lulus', 'Pindah', 'Keluar'].includes(req.body?.status) ? req.body.status : 'Aktif',
      sanitizeText(req.body?.notes, 500),
      id
    );
    logAudit(req, 'UPDATE', 'Student', id, `Memperbarui biodata siswa ${full_name}`);
    res.json({ message: 'Data siswa berhasil diperbarui.' });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal memperbarui data siswa.' });
  }
});

app.delete('/api/students/:id', requireAuth, requireRole('ADMIN'), (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  db.prepare('DELETE FROM students WHERE id = ?').run(id);
  logAudit(req, 'DELETE', 'Student', id, 'Menghapus data siswa');
  res.json({ message: 'Data siswa berhasil dihapus.' });
});

app.get('/api/students/export', requireAuth, requireRole('ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'STAF'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.nis, s.nisn, s.full_name, s.gender, s.birth_place, s.birth_date, s.religion,
              s.address, s.parent_name, s.parent_phone, c.name as class_name, s.entry_year, s.status
       FROM students s LEFT JOIN classes c ON s.class_id = c.id
       ORDER BY c.grade_level ASC, c.name ASC, s.full_name ASC`
    )
    .all() as Record<string, unknown>[];

  const mapped = rows.map((r, idx) => ({
    No: idx + 1,
    NIS: r.nis,
    NISN: r.nisn,
    'Nama Lengkap': r.full_name,
    JK: r.gender,
    'Tempat Lahir': r.birth_place,
    'Tanggal Lahir': r.birth_date,
    Agama: r.religion,
    Alamat: r.address,
    'Nama Orang Tua/Wali': r.parent_name,
    'No. HP Wali': r.parent_phone,
    Kelas: r.class_name || '-',
    'Tahun Masuk': r.entry_year,
    Status: r.status,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(mapped);
  XLSX.utils.book_append_sheet(wb, ws, 'Data_Induk_Siswa');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  logAudit(req, 'EXPORT_EXCEL', 'Student', 'all', `Ekspor ${rows.length} data siswa ke Excel`);
  res.setHeader('Content-Disposition', 'attachment; filename="Data_Induk_Siswa_SMA_Darul_Ulum.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

app.post(
  '/api/students/import',
  requireAuth,
  requireRole('ADMIN', 'STAF'),
  uploadMemory.single('file'),
  (req: AuthenticatedRequest, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'File Excel (.xlsx/.xls) wajib diunggah.' });
      return;
    }

    try {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) {
        res.status(400).json({ error: 'Workbook Excel kosong.' });
        return;
      }
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]);
      const db = getDb();
      const classMap = new Map<string, number>();
      const allClasses = db.prepare('SELECT id, name FROM classes').all() as { id: number; name: string }[];
      allClasses.forEach((c) => classMap.set(c.name.toUpperCase(), c.id));

      const upsert = db.prepare(`
        INSERT INTO students (
          nis, nisn, full_name, gender, birth_place, birth_date, religion, address,
          parent_name, parent_phone, class_id, entry_year, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(nis) DO UPDATE SET
          nisn=excluded.nisn,
          full_name=excluded.full_name,
          gender=excluded.gender,
          birth_place=excluded.birth_place,
          birth_date=excluded.birth_date,
          address=excluded.address,
          parent_name=excluded.parent_name,
          parent_phone=excluded.parent_phone,
          class_id=COALESCE(excluded.class_id, students.class_id),
          status=excluded.status
      `);

      let importedCount = 0;
      const tx = db.transaction(() => {
        for (const r of rows) {
          const nis = sanitizeText(String(r['NIS'] ?? r['nis'] ?? ''), 30);
          const nisn = sanitizeText(String(r['NISN'] ?? r['nisn'] ?? nis), 30);
          const fullName = sanitizeText(String(r['Nama Lengkap'] ?? r['full_name'] ?? r['Nama'] ?? ''), 120);
          if (!nis || !fullName) continue;
          const genderRaw = String(r['JK'] ?? r['gender'] ?? 'L').toUpperCase();
          const gender = genderRaw.startsWith('P') ? 'P' : 'L';
          const className = sanitizeText(String(r['Kelas'] ?? r['class_name'] ?? ''), 50).toUpperCase();
          const classId = classMap.get(className) ?? null;
          const statusRaw = sanitizeText(String(r['Status'] ?? r['status'] ?? 'Aktif'), 20);
          const status = ['Aktif', 'Lulus', 'Pindah', 'Keluar'].includes(statusRaw) ? statusRaw : 'Aktif';

          upsert.run(
            nis,
            nisn || nis,
            fullName,
            gender,
            sanitizeText(String(r['Tempat Lahir'] ?? 'Bojonegoro'), 80),
            sanitizeText(String(r['Tanggal Lahir'] ?? '2009-01-01'), 20),
            sanitizeText(String(r['Agama'] ?? 'Islam'), 30),
            sanitizeText(String(r['Alamat'] ?? '-'), 250),
            sanitizeText(String(r['Nama Orang Tua/Wali'] ?? r['Orang Tua'] ?? '-'), 120),
            sanitizeText(String(r['No. HP Wali'] ?? r['Telepon'] ?? '-'), 30),
            classId,
            Number(r['Tahun Masuk']) || new Date().getFullYear(),
            status
          );
          importedCount++;
        }
      });
      tx();
      logAudit(req, 'IMPORT_EXCEL', 'Student', 'batch', `Impor ${importedCount} data siswa dari Excel`);
      res.json({ message: `Berhasil mengimpor ${importedCount} data peserta didik.`, importedCount });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Format file Excel tidak valid.' });
    }
  }
);

app.get('/api/students/:id/records', requireAuth, (req: AuthenticatedRequest, res) => {
  const studentId = Number(req.params.id);
  const db = getDb();
  if (req.user!.role === 'ORANG_TUA') {
    const owned = db.prepare('SELECT id FROM students WHERE id = ? AND parent_user_id = ?').get(studentId, req.user!.userId);
    if (!owned) {
      res.status(403).json({ error: 'Anda tidak memiliki izin mengakses riwayat akademik siswa ini.' });
      return;
    }
  }
  const records = db
    .prepare(
      `SELECT r.*, a.year_label FROM student_academic_records r
       JOIN academic_years a ON r.academic_year_id = a.id
       WHERE r.student_id = ? ORDER BY r.id DESC`
    )
    .all(studentId);
  res.json(records);
});

app.post('/api/students/:id/records', requireAuth, requireRole('ADMIN', 'GURU', 'STAF'), (req: AuthenticatedRequest, res) => {
  const studentId = Number(req.params.id);
  const academic_year_id = Number(req.body?.academic_year_id);
  const semester = req.body?.semester === 'Ganjil' ? 'Ganjil' : 'Genap';
  const class_name = sanitizeText(req.body?.class_name, 40) || '-';
  const attendance_pct = Math.min(100, Math.max(0, Number(req.body?.attendance_pct) || 95));
  const average_score = Math.min(100, Math.max(0, Number(req.body?.average_score) || 80));
  const conduct_grade = sanitizeText(req.body?.conduct_grade, 40) || 'Baik';
  const homeroom_notes = sanitizeText(req.body?.homeroom_notes, 500);

  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO student_academic_records (student_id, academic_year_id, semester, class_name, attendance_pct, average_score, conduct_grade, homeroom_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(studentId, academic_year_id, semester, class_name, attendance_pct, average_score, conduct_grade, homeroom_notes);
  logAudit(req, 'CREATE', 'AcademicRecord', info.lastInsertRowid as number, `Menambah catatan akademik siswa ID ${studentId}`);
  res.status(201).json({ id: info.lastInsertRowid });
});

// ==========================================
// 5. SCHOOL PROFILE & ANNOUNCEMENTS ROUTES
// ==========================================
app.put('/api/school-profile', requireAuth, requireRole('ADMIN', 'KEPALA_SEKOLAH'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const b = req.body || {};
  db.prepare(
    `UPDATE school_profile SET
     name=?, npsn=?, nss=?, accreditation=?, address=?, district=?, regency=?, province=?,
     postal_code=?, phone=?, email=?, website=?, principal_name=?, principal_nip=?,
     vision=?, mission_json=?, objectives_json=?, history=?, updated_at=?
     WHERE id=1`
  ).run(
    sanitizeText(b.name, 150),
    sanitizeText(b.npsn, 30),
    sanitizeText(b.nss, 30),
    sanitizeText(b.accreditation, 80),
    sanitizeText(b.address, 250),
    sanitizeText(b.district, 80),
    sanitizeText(b.regency, 80),
    sanitizeText(b.province, 80),
    sanitizeText(b.postal_code, 20),
    sanitizeText(b.phone, 40),
    sanitizeText(b.email, 120),
    sanitizeText(b.website, 150),
    sanitizeText(b.principal_name, 120),
    sanitizeText(b.principal_nip, 40),
    sanitizeText(b.vision, 1000),
    JSON.stringify(Array.isArray(b.mission) ? b.mission : []),
    JSON.stringify(Array.isArray(b.objectives) ? b.objectives : []),
    sanitizeText(b.history, 3000),
    new Date().toISOString()
  );
  logAudit(req, 'UPDATE', 'SchoolProfile', '1', 'Memperbarui profil sekolah');
  res.json({ message: 'Profil sekolah berhasil diperbarui.' });
});

app.get('/api/announcements', requireAuth, (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.*, u.full_name as author_name FROM announcements a
       LEFT JOIN users u ON a.author_id = u.id
       ORDER BY a.event_date DESC, a.id DESC`
    )
    .all();
  res.json(rows);
});

app.post('/api/announcements', requireAuth, requireRole('ADMIN', 'KEPALA_SEKOLAH', 'STAF'), (req: AuthenticatedRequest, res) => {
  const title = sanitizeText(req.body?.title, 200);
  const category = ['Pengumuman', 'Berita', 'Agenda', 'Prestasi'].includes(req.body?.category)
    ? req.body.category
    : 'Pengumuman';
  const summary = sanitizeText(req.body?.summary, 400);
  const content = sanitizeText(req.body?.content, 4000);
  const event_date = sanitizeText(req.body?.event_date, 20) || new Date().toISOString().slice(0, 10);
  if (!title || !content) {
    res.status(400).json({ error: 'Judul dan isi pengumuman wajib diisi.' });
    return;
  }
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO announcements (title, category, summary, content, event_date, author_id, is_published)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    )
    .run(title, category, summary || content.slice(0, 140), content, event_date, req.user!.userId);
  logAudit(req, 'CREATE', 'Announcement', info.lastInsertRowid as number, `Menerbitkan ${category}: ${title}`);
  res.status(201).json({ id: info.lastInsertRowid });
});

app.delete('/api/announcements/:id', requireAuth, requireRole('ADMIN', 'KEPALA_SEKOLAH', 'STAF'), (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
  logAudit(req, 'DELETE', 'Announcement', id, 'Menghapus pengumuman/berita');
  res.json({ message: 'Pengumuman berhasil dihapus.' });
});

// ==========================================
// 5B. MEDIA, HERO IMAGE & GALLERY MANAGEMENT ROUTES
// ==========================================
app.post(
  '/api/media/hero',
  requireAuth,
  requireRole('ADMIN', 'KEPALA_SEKOLAH', 'STAF'),
  uploadImage.single('image'),
  (req: AuthenticatedRequest, res) => {
    let imageUrl = sanitizeText(req.body?.image_url, 400);
    if (req.file) {
      imageUrl = `/media/${req.file.filename}`;
    }
    if (!imageUrl) {
      res.status(400).json({ error: 'Unggah file gambar atau masukkan URL gambar yang valid.' });
      return;
    }

    const db = getDb();
    db.prepare('UPDATE school_profile SET hero_image_url = ?, updated_at = ? WHERE id = 1').run(
      imageUrl,
      new Date().toISOString()
    );
    logAudit(req, 'UPDATE_HERO_IMAGE', 'Media', '1', `Mengubah gambar utama kampus menjadi ${imageUrl}`);
    res.json({ hero_image_url: imageUrl, message: 'Gambar utama halaman profil berhasil diperbarui.' });
  }
);

app.get('/api/gallery', requireAuth, (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM gallery_items ORDER BY event_date DESC, id DESC').all();
  res.json(rows);
});

app.post(
  '/api/gallery',
  requireAuth,
  requireRole('ADMIN', 'KEPALA_SEKOLAH', 'STAF'),
  uploadImage.single('image'),
  (req: AuthenticatedRequest, res) => {
    const title = sanitizeText(req.body?.title, 160);
    const category = sanitizeText(req.body?.category, 60) || 'Kegiatan';
    const caption = sanitizeText(req.body?.caption, 400);
    const event_date = sanitizeText(req.body?.event_date, 20) || new Date().toISOString().slice(0, 10);
    let imageUrl = sanitizeText(req.body?.image_url, 400);
    if (req.file) {
      imageUrl = `/media/${req.file.filename}`;
    }

    if (!title || !imageUrl) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Judul foto dan berkas gambar/URL wajib diisi.' });
      return;
    }

    const db = getDb();
    const info = db
      .prepare(
        `INSERT INTO gallery_items (title, category, image_url, caption, event_date)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(title, category, imageUrl, caption || title, event_date);

    logAudit(req, 'CREATE_GALLERY', 'Media', info.lastInsertRowid as number, `Menambah foto galeri: ${title}`);
    res.status(201).json({ id: info.lastInsertRowid, image_url: imageUrl });
  }
);

app.put(
  '/api/gallery/:id',
  requireAuth,
  requireRole('ADMIN', 'KEPALA_SEKOLAH', 'STAF'),
  uploadImage.single('image'),
  (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const db = getDb();
    const existing = db.prepare('SELECT * FROM gallery_items WHERE id = ?').get(id) as
      | { id: number; title: string; category: string; image_url: string; caption: string; event_date: string }
      | undefined;

    if (!existing) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(404).json({ error: 'Foto galeri tidak ditemukan.' });
      return;
    }

    const title = sanitizeText(req.body?.title, 160) || existing.title;
    const category = sanitizeText(req.body?.category, 60) || existing.category;
    const caption = sanitizeText(req.body?.caption, 400) || existing.caption;
    const event_date = sanitizeText(req.body?.event_date, 20) || existing.event_date;
    let imageUrl = sanitizeText(req.body?.image_url, 400) || existing.image_url;

    if (req.file) {
      imageUrl = `/media/${req.file.filename}`;
      if (existing.image_url.startsWith('/media/')) {
        const oldPath = path.join(MEDIA_DIR, path.basename(existing.image_url));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    db.prepare(
      `UPDATE gallery_items SET title = ?, category = ?, image_url = ?, caption = ?, event_date = ? WHERE id = ?`
    ).run(title, category, imageUrl, caption, event_date, id);

    logAudit(req, 'UPDATE_GALLERY', 'Media', id, `Memperbarui gambar galeri: ${title}`);
    res.json({ id, image_url: imageUrl, message: 'Foto galeri berhasil diperbarui.' });
  }
);

app.delete(
  '/api/gallery/:id',
  requireAuth,
  requireRole('ADMIN', 'KEPALA_SEKOLAH', 'STAF'),
  (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const db = getDb();
    const existing = db.prepare('SELECT image_url, title FROM gallery_items WHERE id = ?').get(id) as
      | { image_url: string; title: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Foto galeri tidak ditemukan.' });
      return;
    }
    if (existing.image_url.startsWith('/media/')) {
      const oldPath = path.join(MEDIA_DIR, path.basename(existing.image_url));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    db.prepare('DELETE FROM gallery_items WHERE id = ?').run(id);
    logAudit(req, 'DELETE_GALLERY', 'Media', id, `Menghapus foto galeri: ${existing.title}`);
    res.json({ message: 'Foto galeri berhasil dihapus.' });
  }
);

// ==========================================
// 6. DIGITAL ARCHIVE ROUTES (FOLDERS, SUBFOLDERS, UPLOAD, PREVIEW, DOWNLOAD, RBAC)
// ==========================================
app.get('/api/archive/folders', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const role = req.user!.role;
  const rows = db
    .prepare(
      `SELECT f.*,
              (SELECT COUNT(*) FROM archive_documents d WHERE d.folder_id = f.id) as document_count
       FROM archive_folders f
       ORDER BY f.parent_id IS NOT NULL, f.id ASC`
    )
    .all() as (Record<string, unknown> & { allowed_roles_json: string })[];

  const visible = rows.filter((f) => role === 'ADMIN' || parseAllowedRoles(f.allowed_roles_json).includes(role));
  res.json(
    visible.map((f) => ({
      ...f,
      allowed_roles: parseAllowedRoles(f.allowed_roles_json),
    }))
  );
});

app.post('/api/archive/folders', requireAuth, requireRole('ADMIN', 'KEPALA_SEKOLAH', 'STAF', 'GURU'), (req: AuthenticatedRequest, res) => {
  const name = sanitizeText(req.body?.name, 140);
  const parent_id = req.body?.parent_id ? Number(req.body.parent_id) : null;
  const category = ['Manajerial', 'Kewirausahaan', 'Supervisi'].includes(req.body?.category)
    ? req.body.category
    : 'Manajerial';
  const academic_year = sanitizeText(req.body?.academic_year, 20) || '2025/2026';
  const description = sanitizeText(req.body?.description, 400);
  const allowedRoles: UserRole[] = Array.isArray(req.body?.allowed_roles) && req.body.allowed_roles.length > 0
    ? req.body.allowed_roles
    : ['ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'STAF'];

  if (!name) {
    res.status(400).json({ error: 'Nama folder wajib diisi.' });
    return;
  }

  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO archive_folders (name, parent_id, category, academic_year, description, allowed_roles_json, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(name, parent_id, category, academic_year, description, JSON.stringify(allowedRoles), req.user!.userId);
  logAudit(req, 'CREATE', 'ArchiveFolder', info.lastInsertRowid as number, `Membuat folder arsip: ${name}`);
  res.status(201).json({ id: info.lastInsertRowid });
});

app.delete('/api/archive/folders/:id', requireAuth, requireRole('ADMIN', 'KEPALA_SEKOLAH'), (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const folder = db.prepare('SELECT name FROM archive_folders WHERE id = ?').get(id) as { name: string } | undefined;
  if (!folder) {
    res.status(404).json({ error: 'Folder tidak ditemukan.' });
    return;
  }
  db.prepare('DELETE FROM archive_folders WHERE id = ?').run(id);
  logAudit(req, 'DELETE', 'ArchiveFolder', id, `Menghapus folder arsip: ${folder.name}`);
  res.json({ message: 'Folder berhasil dihapus.' });
});

app.get('/api/archive/documents', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const role = req.user!.role;
  const folderId = req.query.folderId ? Number(req.query.folderId) : null;
  const category = sanitizeText(req.query.category, 40);
  const year = sanitizeText(req.query.year, 20);
  const search = sanitizeText(req.query.search, 120);

  let sql = `
    SELECT d.*, f.name as folder_name, u.full_name as uploader_name
    FROM archive_documents d
    LEFT JOIN archive_folders f ON d.folder_id = f.id
    LEFT JOIN users u ON d.uploaded_by = u.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (folderId) {
    sql += ' AND (d.folder_id = ? OR f.parent_id = ?)';
    params.push(folderId, folderId);
  }
  if (category && category !== 'Semua') {
    sql += ' AND d.category = ?';
    params.push(category);
  }
  if (year && year !== 'Semua') {
    sql += ' AND d.academic_year = ?';
    params.push(year);
  }
  if (search) {
    sql += ' AND (d.title LIKE ? OR d.original_filename LIKE ? OR d.activity_name LIKE ? OR d.description LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY d.uploaded_at DESC, d.id DESC';

  const rows = db.prepare(sql).all(...params) as (Record<string, unknown> & { allowed_roles_json: string })[];
  const visible = rows
    .filter((doc) => role === 'ADMIN' || parseAllowedRoles(doc.allowed_roles_json).includes(role))
    .map((doc) => ({
      ...doc,
      allowed_roles: parseAllowedRoles(doc.allowed_roles_json),
    }));

  res.json(visible);
});

app.post(
  '/api/archive/documents',
  requireAuth,
  requireRole('ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'STAF'),
  uploadArchive.single('file'),
  (req: AuthenticatedRequest, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'File dokumen wajib diunggah.' });
      return;
    }

    const folder_id = Number(req.body?.folder_id);
    const title = sanitizeText(req.body?.title, 200) || req.file.originalname;
    const category = ['Manajerial', 'Kewirausahaan', 'Supervisi'].includes(req.body?.category)
      ? req.body.category
      : 'Manajerial';
    const academic_year = sanitizeText(req.body?.academic_year, 20) || '2025/2026';
    const activity_name = sanitizeText(req.body?.activity_name, 160);
    const description = sanitizeText(req.body?.description, 500);
    let allowedRoles: UserRole[] = ['ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'STAF'];
    if (typeof req.body?.allowed_roles === 'string') {
      try {
        const parsed = JSON.parse(req.body.allowed_roles);
        if (Array.isArray(parsed) && parsed.length > 0) allowedRoles = parsed;
      } catch {
        // fallback
      }
    }

    if (!folder_id) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Folder tujuan wajib dipilih.' });
      return;
    }

    const db = getDb();
    const folder = db.prepare('SELECT id, allowed_roles_json FROM archive_folders WHERE id = ?').get(folder_id) as
      | { id: number; allowed_roles_json: string }
      | undefined;
    if (!folder) {
      fs.unlinkSync(req.file.path);
      res.status(404).json({ error: 'Folder arsip tidak ditemukan.' });
      return;
    }

    const info = db
      .prepare(
        `INSERT INTO archive_documents (
          folder_id, title, original_filename, stored_filename, mime_type, file_size,
          category, academic_year, activity_name, description, allowed_roles_json, uploaded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        folder_id,
        title,
        sanitizeText(req.file.originalname, 200),
        req.file.filename,
        req.file.mimetype || 'application/octet-stream',
        req.file.size,
        category,
        academic_year,
        activity_name,
        description,
        JSON.stringify(allowedRoles),
        req.user!.userId
      );

    logAudit(req, 'UPLOAD_DOCUMENT', 'Archive', info.lastInsertRowid as number, `Mengunggah "${title}" (${req.file.originalname})`);
    res.status(201).json({ id: info.lastInsertRowid });
  }
);

app.put('/api/archive/documents/:id', requireAuth, requireRole('ADMIN', 'KEPALA_SEKOLAH', 'STAF'), (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const title = sanitizeText(req.body?.title, 200);
  const allowedRoles: UserRole[] = Array.isArray(req.body?.allowed_roles) && req.body.allowed_roles.length > 0
    ? req.body.allowed_roles
    : ['ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'STAF'];

  const db = getDb();
  db.prepare(
    `UPDATE archive_documents SET title = COALESCE(NULLIF(?, ''), title), allowed_roles_json = ?, description = ? WHERE id = ?`
  ).run(title, JSON.stringify(allowedRoles), sanitizeText(req.body?.description, 500), id);
  logAudit(req, 'UPDATE_ACCESS', 'Archive', id, `Memperbarui izin akses dokumen ID ${id}`);
  res.json({ message: 'Hak akses dokumen berhasil diperbarui.' });
});

app.get('/api/archive/documents/:id/preview', requireAuth, (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const doc = db.prepare('SELECT * FROM archive_documents WHERE id = ?').get(id) as
    | {
        id: number;
        title: string;
        original_filename: string;
        stored_filename: string;
        mime_type: string;
        allowed_roles_json: string;
      }
    | undefined;

  if (!doc) {
    res.status(404).json({ error: 'Dokumen tidak ditemukan.' });
    return;
  }

  const allowed = parseAllowedRoles(doc.allowed_roles_json);
  if (req.user!.role !== 'ADMIN' && !allowed.includes(req.user!.role)) {
    res.status(403).json({ error: 'Anda tidak memiliki izin mengakses dokumen ini.' });
    return;
  }

  const filePath = path.resolve(UPLOADS_DIR, path.basename(doc.stored_filename));
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Berkas fisik tidak ditemukan di penyimpanan.' });
    return;
  }

  logAudit(req, 'PREVIEW_DOCUMENT', 'Archive', id, `Pratinjau dokumen "${doc.title}"`);
  res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.original_filename)}"`);
  res.sendFile(filePath);
});

app.get('/api/archive/documents/:id/download', requireAuth, (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const doc = db.prepare('SELECT * FROM archive_documents WHERE id = ?').get(id) as
    | {
        id: number;
        title: string;
        original_filename: string;
        stored_filename: string;
        allowed_roles_json: string;
      }
    | undefined;

  if (!doc) {
    res.status(404).json({ error: 'Dokumen tidak ditemukan.' });
    return;
  }

  const allowed = parseAllowedRoles(doc.allowed_roles_json);
  if (req.user!.role !== 'ADMIN' && !allowed.includes(req.user!.role)) {
    res.status(403).json({ error: 'Anda tidak memiliki izin mengunduh dokumen ini.' });
    return;
  }

  const filePath = path.resolve(UPLOADS_DIR, path.basename(doc.stored_filename));
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Berkas fisik tidak ditemukan di penyimpanan.' });
    return;
  }

  logAudit(req, 'DOWNLOAD_DOCUMENT', 'Archive', id, `Mengunduh dokumen "${doc.title}"`);
  res.download(filePath, doc.original_filename);
});

app.delete('/api/archive/documents/:id', requireAuth, requireRole('ADMIN', 'KEPALA_SEKOLAH', 'STAF'), (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const doc = db.prepare('SELECT * FROM archive_documents WHERE id = ?').get(id) as
    | { id: number; title: string; stored_filename: string; uploaded_by: number }
    | undefined;
  if (!doc) {
    res.status(404).json({ error: 'Dokumen tidak ditemukan.' });
    return;
  }
  if (req.user!.role === 'STAF' && doc.uploaded_by !== req.user!.userId) {
    res.status(403).json({ error: 'Staf hanya dapat menghapus dokumen yang diunggahnya sendiri.' });
    return;
  }
  const filePath = path.resolve(UPLOADS_DIR, path.basename(doc.stored_filename));
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  db.prepare('DELETE FROM archive_documents WHERE id = ?').run(id);
  logAudit(req, 'DELETE_DOCUMENT', 'Archive', id, `Menghapus dokumen "${doc.title}"`);
  res.json({ message: 'Dokumen berhasil dihapus.' });
});

// ==========================================
// 7. DIGITAL SUPERVISION ROUTES (EXACT PDF INSTRUMENTS)
// ==========================================
app.get('/api/supervision/instruments', requireAuth, (_req, res) => {
  const db = getDb();
  const instruments = db.prepare('SELECT * FROM supervision_instruments ORDER BY sort_order ASC').all() as Record<string, unknown>[];
  const items = db.prepare('SELECT * FROM supervision_items ORDER BY instrument_id ASC, sort_order ASC').all() as (Record<string, unknown> & {
    instrument_id: number;
    physical_evidence_json: string;
  })[];

  const grouped = instruments.map((inst) => ({
    ...inst,
    items: items
      .filter((it) => it.instrument_id === inst.id)
      .map((it) => ({
        ...it,
        physical_evidence: JSON.parse(it.physical_evidence_json || '[]'),
      })),
  }));

  res.json(grouped);
});

app.get('/api/supervision/schedules', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  let sql = `
    SELECT sc.*, si.title as instrument_title, si.code as instrument_code,
           g.full_name as target_gtk_name, g.position as target_position,
           u.full_name as supervisor_name
    FROM supervision_schedules sc
    JOIN supervision_instruments si ON sc.instrument_id = si.id
    JOIN gtk_staff g ON sc.target_gtk_id = g.id
    LEFT JOIN users u ON sc.supervisor_user_id = u.id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  if (req.user!.role === 'GURU' && req.user!.gtkId) {
    sql += ' AND (sc.target_gtk_id = ? OR sc.supervisor_user_id = ?)';
    params.push(req.user!.gtkId, req.user!.userId);
  }
  sql += ' ORDER BY sc.scheduled_date DESC, sc.id DESC';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/supervision/schedules', requireAuth, requireRole('ADMIN', 'KEPALA_SEKOLAH'), (req: AuthenticatedRequest, res) => {
  const instrument_id = Number(req.body?.instrument_id);
  const target_gtk_id = Number(req.body?.target_gtk_id);
  const scheduled_date = sanitizeText(req.body?.scheduled_date, 20);
  const academic_year = sanitizeText(req.body?.academic_year, 20) || '2025/2026';
  const semester = req.body?.semester === 'Ganjil' ? 'Ganjil' : 'Genap';
  const notes = sanitizeText(req.body?.notes, 400);

  if (!instrument_id || !target_gtk_id || !scheduled_date) {
    res.status(400).json({ error: 'Instrumen, GTK sasaran, dan tanggal jadwal wajib diisi.' });
    return;
  }

  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO supervision_schedules (instrument_id, target_gtk_id, supervisor_user_id, scheduled_date, academic_year, semester, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'Terjadwal', ?)`
    )
    .run(instrument_id, target_gtk_id, req.user!.userId, scheduled_date, academic_year, semester, notes);
  logAudit(req, 'CREATE', 'SupervisionSchedule', info.lastInsertRowid as number, `Menjadwalkan supervisi tanggal ${scheduled_date}`);
  res.status(201).json({ id: info.lastInsertRowid });
});

app.get('/api/supervision/assessments', requireAuth, requireRole('ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'STAF'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  let sql = `
    SELECT sa.*, si.title as instrument_title, si.code as instrument_code, si.total_items
    FROM supervision_assessments sa
    JOIN supervision_instruments si ON sa.instrument_id = si.id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  if (req.user!.role === 'GURU' || req.user!.role === 'STAF') {
    if (req.user!.gtkId) {
      sql += ' AND (sa.target_gtk_id = ? OR sa.supervisor_user_id = ?)';
      params.push(req.user!.gtkId, req.user!.userId);
    } else {
      sql += ' AND sa.supervisor_user_id = ?';
      params.push(req.user!.userId);
    }
  }
  sql += ' ORDER BY sa.assessment_date DESC, sa.id DESC';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/supervision/assessments/:id', requireAuth, requireRole('ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'STAF'), (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const assessment = db
    .prepare(
      `SELECT sa.*, si.title as instrument_title, si.subtitle as instrument_subtitle,
              si.code as instrument_code, si.total_items, g.nip as target_nip, g.position as target_position
       FROM supervision_assessments sa
       JOIN supervision_instruments si ON sa.instrument_id = si.id
       LEFT JOIN gtk_staff g ON sa.target_gtk_id = g.id
       WHERE sa.id = ?`
    )
    .get(id) as (Record<string, unknown> & { target_gtk_id: number; supervisor_user_id: number; instrument_id: number }) | undefined;

  if (!assessment) {
    res.status(404).json({ error: 'Data penilaian supervisi tidak ditemukan.' });
    return;
  }

  if ((req.user!.role === 'GURU' || req.user!.role === 'STAF') && req.user!.gtkId !== assessment.target_gtk_id && req.user!.userId !== assessment.supervisor_user_id) {
    res.status(403).json({ error: 'Anda hanya dapat melihat hasil supervisi pribadi.' });
    return;
  }

  const items = db
    .prepare(
      `SELECT it.*, sc.score, sc.notes as score_notes, sc.recommendation
       FROM supervision_items it
       LEFT JOIN supervision_assessment_scores sc ON sc.item_id = it.id AND sc.assessment_id = ?
       WHERE it.instrument_id = ?
       ORDER BY it.sort_order ASC`
    )
    .all(id, assessment.instrument_id) as (Record<string, unknown> & { physical_evidence_json: string })[];

  const followUps = db.prepare('SELECT * FROM supervision_follow_ups WHERE assessment_id = ? ORDER BY id DESC').all(id);

  res.json({
    assessment,
    items: items.map((it) => ({
      ...it,
      physical_evidence: JSON.parse(it.physical_evidence_json || '[]'),
    })),
    followUps,
  });
});

app.post('/api/supervision/assessments', requireAuth, requireRole('ADMIN', 'KEPALA_SEKOLAH'), (req: AuthenticatedRequest, res) => {
  const instrument_id = Number(req.body?.instrument_id);
  const target_gtk_id = Number(req.body?.target_gtk_id);
  const schedule_id = req.body?.schedule_id ? Number(req.body.schedule_id) : null;
  const assessment_date = sanitizeText(req.body?.assessment_date, 20) || new Date().toISOString().slice(0, 10);
  const academic_year = sanitizeText(req.body?.academic_year, 20) || '2025/2026';
  const semester = req.body?.semester === 'Ganjil' ? 'Ganjil' : 'Genap';
  const supervisor_name = sanitizeText(req.body?.supervisor_name, 120) || req.user!.fullName;
  const examiner_notes = sanitizeText(req.body?.examiner_notes, 2000);
  const requestedStatus = req.body?.status === 'Final' ? 'Final' : 'Draft';
  const scoresInput: { item_id: number; score: number | null; notes?: string; recommendation?: string }[] = Array.isArray(req.body?.scores)
    ? req.body.scores
    : [];

  if (!instrument_id || !target_gtk_id) {
    res.status(400).json({ error: 'Instrumen supervisi dan GTK yang dinilai wajib dipilih.' });
    return;
  }

  const db = getDb();
  const instrument = db.prepare('SELECT * FROM supervision_instruments WHERE id = ?').get(instrument_id) as
    | { id: number; total_items: number; max_score: number }
    | undefined;
  const gtk = db.prepare('SELECT id, full_name FROM gtk_staff WHERE id = ?').get(target_gtk_id) as
    | { id: number; full_name: string }
    | undefined;
  const school = db.prepare('SELECT name FROM school_profile WHERE id = 1').get() as { name: string };

  if (!instrument || !gtk) {
    res.status(404).json({ error: 'Instrumen atau GTK sasaran tidak ditemukan.' });
    return;
  }

  const validItems = db.prepare('SELECT id FROM supervision_items WHERE instrument_id = ?').all(instrument_id) as { id: number }[];
  const scoreMap = new Map<number, { score: number | null; notes: string; recommendation: string }>();
  for (const s of scoresInput) {
    const val = s.score !== null && s.score !== undefined ? Number(s.score) : null;
    if (val !== null && ![1, 2, 3, 4].includes(val)) {
      res.status(400).json({ error: 'Skor setiap butir harus bernilai 1, 2, 3, atau 4.' });
      return;
    }
    scoreMap.set(Number(s.item_id), {
      score: val,
      notes: sanitizeText(s.notes, 1000),
      recommendation: sanitizeText(s.recommendation, 1000),
    });
  }

  let totalScore = 0;
  let unfilledCount = 0;
  for (const it of validItems) {
    const entry = scoreMap.get(it.id);
    if (!entry || entry.score === null) {
      unfilledCount++;
    } else {
      totalScore += entry.score;
    }
  }

  if (requestedStatus === 'Final' && unfilledCount > 0) {
    res.status(400).json({
      error: `Penilaian tidak dapat difinalisasi: masih ada ${unfilledCount} butir yang belum diisi (harus 0).`,
    });
    return;
  }

  const maxScore = instrument.total_items * 4;
  const finalValue = maxScore > 0 ? Number(((totalScore / maxScore) * 100).toFixed(2)) : 0;
  const predicate = calculateSupervisionPredicate(finalValue);

  const tx = db.transaction(() => {
    const assId = db
      .prepare(
        `INSERT INTO supervision_assessments (
          instrument_id, schedule_id, target_gtk_id, target_name, school_name,
          supervisor_user_id, supervisor_name, assessment_date, academic_year, semester,
          status, total_score, max_score, final_value, predicate, unfilled_count, examiner_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        instrument_id,
        schedule_id,
        target_gtk_id,
        gtk.full_name,
        school.name,
        req.user!.userId,
        supervisor_name,
        assessment_date,
        academic_year,
        semester,
        requestedStatus,
        totalScore,
        maxScore,
        finalValue,
        predicate,
        unfilledCount,
        examiner_notes
      ).lastInsertRowid as number;

    const insertScore = db.prepare(
      `INSERT INTO supervision_assessment_scores (assessment_id, item_id, score, notes, recommendation)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const it of validItems) {
      const entry = scoreMap.get(it.id);
      insertScore.run(assId, it.id, entry?.score ?? null, entry?.notes ?? '', entry?.recommendation ?? '');
    }

    if (schedule_id) {
      db.prepare(`UPDATE supervision_schedules SET status = ? WHERE id = ?`)
        .run(requestedStatus === 'Final' ? 'Selesai' : 'Berlangsung', schedule_id);
    }

    return assId;
  });

  const assId = tx();
  logAudit(req, 'CREATE_SUPERVISION', 'Supervision', assId, `Menyimpan penilaian supervisi (${requestedStatus}) untuk ${gtk.full_name} — Nilai ${finalValue}`);
  res.status(201).json({ id: assId, total_score: totalScore, max_score: maxScore, final_value: finalValue, predicate });
});

app.put('/api/supervision/assessments/:id', requireAuth, requireRole('ADMIN', 'KEPALA_SEKOLAH'), (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM supervision_assessments WHERE id = ?').get(id) as
    | { id: number; instrument_id: number; schedule_id: number | null; target_name: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Penilaian supervisi tidak ditemukan.' });
    return;
  }

  const instrument = db.prepare('SELECT total_items FROM supervision_instruments WHERE id = ?').get(existing.instrument_id) as { total_items: number };
  const validItems = db.prepare('SELECT id FROM supervision_items WHERE instrument_id = ?').all(existing.instrument_id) as { id: number }[];
  const requestedStatus = req.body?.status === 'Final' ? 'Final' : 'Draft';
  const examiner_notes = sanitizeText(req.body?.examiner_notes, 2000);
  const supervisor_name = sanitizeText(req.body?.supervisor_name, 120);
  const assessment_date = sanitizeText(req.body?.assessment_date, 20);
  const scoresInput: { item_id: number; score: number | null; notes?: string; recommendation?: string }[] = Array.isArray(req.body?.scores)
    ? req.body.scores
    : [];

  const scoreMap = new Map<number, { score: number | null; notes: string; recommendation: string }>();
  for (const s of scoresInput) {
    const val = s.score !== null && s.score !== undefined ? Number(s.score) : null;
    if (val !== null && ![1, 2, 3, 4].includes(val)) {
      res.status(400).json({ error: 'Skor setiap butir harus bernilai 1, 2, 3, atau 4.' });
      return;
    }
    scoreMap.set(Number(s.item_id), {
      score: val,
      notes: sanitizeText(s.notes, 1000),
      recommendation: sanitizeText(s.recommendation, 1000),
    });
  }

  let totalScore = 0;
  let unfilledCount = 0;
  for (const it of validItems) {
    const entry = scoreMap.get(it.id);
    if (!entry || entry.score === null) {
      unfilledCount++;
    } else {
      totalScore += entry.score;
    }
  }

  if (requestedStatus === 'Final' && unfilledCount > 0) {
    res.status(400).json({
      error: `Penilaian tidak dapat difinalisasi: masih ada ${unfilledCount} butir yang belum diisi (harus 0).`,
    });
    return;
  }

  const maxScore = instrument.total_items * 4;
  const finalValue = maxScore > 0 ? Number(((totalScore / maxScore) * 100).toFixed(2)) : 0;
  const predicate = calculateSupervisionPredicate(finalValue);

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE supervision_assessments SET
       supervisor_name = COALESCE(NULLIF(?, ''), supervisor_name),
       assessment_date = COALESCE(NULLIF(?, ''), assessment_date),
       status = ?, total_score = ?, max_score = ?, final_value = ?,
       predicate = ?, unfilled_count = ?, examiner_notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(supervisor_name, assessment_date, requestedStatus, totalScore, maxScore, finalValue, predicate, unfilledCount, examiner_notes, id);

    const upsertScore = db.prepare(`
      INSERT INTO supervision_assessment_scores (assessment_id, item_id, score, notes, recommendation)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(assessment_id, item_id) DO UPDATE SET
        score=excluded.score, notes=excluded.notes, recommendation=excluded.recommendation
    `);
    for (const it of validItems) {
      const entry = scoreMap.get(it.id);
      if (entry) {
        upsertScore.run(id, it.id, entry.score, entry.notes, entry.recommendation);
      }
    }

    if (existing.schedule_id) {
      db.prepare(`UPDATE supervision_schedules SET status = ? WHERE id = ?`)
        .run(requestedStatus === 'Final' ? 'Selesai' : 'Berlangsung', existing.schedule_id);
    }
  });
  tx();

  logAudit(req, 'UPDATE_SUPERVISION', 'Supervision', id, `Memperbarui penilaian supervisi (${requestedStatus}) ${existing.target_name} — Nilai ${finalValue}`);
  res.json({ total_score: totalScore, max_score: maxScore, final_value: finalValue, predicate, unfilled_count: unfilledCount });
});

app.get('/api/supervision/assessments/:id/export-excel', requireAuth, requireRole('ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'STAF'), (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const assessment = db
    .prepare(
      `SELECT sa.*, si.title as instrument_title, si.subtitle as instrument_subtitle
       FROM supervision_assessments sa
       JOIN supervision_instruments si ON sa.instrument_id = si.id
       WHERE sa.id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;

  if (!assessment) {
    res.status(404).json({ error: 'Penilaian tidak ditemukan.' });
    return;
  }

  const items = db
    .prepare(
      `SELECT it.*, sc.score, sc.notes as score_notes, sc.recommendation
       FROM supervision_items it
       LEFT JOIN supervision_assessment_scores sc ON sc.item_id = it.id AND sc.assessment_id = ?
       WHERE it.instrument_id = ?
       ORDER BY it.sort_order ASC`
    )
    .all(id, assessment.instrument_id) as Record<string, unknown>[];

  const aoa: unknown[][] = [
    [String(assessment.instrument_subtitle || assessment.instrument_title)],
    ['Nama Sekolah', String(assessment.school_name)],
    ['GTK / Kepala Sekolah (yang dinilai)', String(assessment.target_name)],
    ['Supervisor / Penilai', String(assessment.supervisor_name)],
    ['Tanggal Penilaian', `${assessment.assessment_date} (${assessment.academic_year} - ${assessment.semester})`],
    [],
    ['No', 'Aspek / Bagian', 'Indikator / Rincian Tugas', 'Bukti Fisik / Hal yang Diperiksa', 'Cara Periksa', 'Kaitan Butir Umum', 'Skala 1', 'Skala 2', 'Skala 3', 'Skala 4', 'Skor', 'Catatan', 'Rekomendasi'],
  ];

  for (const it of items) {
    const evidence = JSON.parse(String(it.physical_evidence_json || '[]')).join('; ');
    const sc = it.score as number | null;
    aoa.push([
      it.item_number,
      it.section_title,
      it.indicator_text,
      evidence,
      it.inspection_method,
      it.general_item_link,
      sc === 1 ? 'v' : '',
      sc === 2 ? 'v' : '',
      sc === 3 ? 'v' : '',
      sc === 4 ? 'v' : '',
      sc ?? '',
      it.score_notes || '',
      it.recommendation || '',
    ]);
  }

  aoa.push([]);
  aoa.push(['', '', 'Jumlah skor', '', '', '', '', '', '', '', assessment.total_score]);
  aoa.push(['', '', 'Skor maksimal (jumlah butir × 4)', '', '', '', '', '', '', '', assessment.max_score]);
  aoa.push(['', '', 'Nilai = Jumlah skor ÷ Skor maksimal × 100', '', '', '', '', '', '', '', assessment.final_value]);
  aoa.push(['', '', 'Predikat', '', '', '', '', '', '', '', assessment.predicate]);
  aoa.push(['', '', 'Butir belum diisi (harus 0)', '', '', '', '', '', '', '', assessment.unfilled_count]);
  aoa.push(['', '', 'Catatan Pemeriksa', String(assessment.examiner_notes || '')]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, 'Hasil_Supervisi');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  logAudit(req, 'EXPORT_EXCEL', 'Supervision', id, `Ekspor hasil supervisi ID ${id} ke Excel`);
  res.setHeader('Content-Disposition', `attachment; filename="Laporan_Supervisi_${id}_${String(assessment.target_name).replace(/\s+/g, '_')}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

app.get('/api/supervision/follow-ups', requireAuth, requireRole('ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'STAF'), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT fu.*, sa.target_name, sa.assessment_date, si.title as instrument_title
       FROM supervision_follow_ups fu
       JOIN supervision_assessments sa ON fu.assessment_id = sa.id
       JOIN supervision_instruments si ON sa.instrument_id = si.id
       ORDER BY fu.due_date ASC, fu.id DESC`
    )
    .all();
  res.json(rows);
});

app.post('/api/supervision/follow-ups', requireAuth, requireRole('ADMIN', 'KEPALA_SEKOLAH'), (req: AuthenticatedRequest, res) => {
  const assessment_id = Number(req.body?.assessment_id);
  const action_plan = sanitizeText(req.body?.action_plan, 500);
  const pic_name = sanitizeText(req.body?.pic_name, 120);
  const due_date = sanitizeText(req.body?.due_date, 20);
  const progress_notes = sanitizeText(req.body?.progress_notes, 500);

  if (!assessment_id || !action_plan || !pic_name || !due_date) {
    res.status(400).json({ error: 'Rencana tindak lanjut, penanggung jawab, dan target tanggal wajib diisi.' });
    return;
  }

  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO supervision_follow_ups (assessment_id, action_plan, pic_name, due_date, status, progress_notes)
       VALUES (?, ?, ?, ?, 'Belum Dimulai', ?)`
    )
    .run(assessment_id, action_plan, pic_name, due_date, progress_notes);
  logAudit(req, 'CREATE', 'SupervisionFollowUp', info.lastInsertRowid as number, `Menambah rencana tindak lanjut supervisi`);
  res.status(201).json({ id: info.lastInsertRowid });
});

app.put('/api/supervision/follow-ups/:id', requireAuth, requireRole('ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'STAF'), (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const status = ['Belum Dimulai', 'Dalam Proses', 'Terlaksana'].includes(req.body?.status)
    ? req.body.status
    : 'Dalam Proses';
  const progress_notes = sanitizeText(req.body?.progress_notes, 500);
  const db = getDb();
  db.prepare(
    `UPDATE supervision_follow_ups SET status = ?, progress_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(status, progress_notes, id);
  logAudit(req, 'UPDATE', 'SupervisionFollowUp', id, `Memperbarui progres tindak lanjut: ${status}`);
  res.json({ message: 'Status tindak lanjut berhasil diperbarui.' });
});

// ==========================================
// 8. ADMIN: USER RBAC, AUDIT LOGS, BACKUP & RECOVERY
// ==========================================
app.get('/api/admin/users', requireAuth, requireRole('ADMIN'), (_req, res) => {
  const db = getDb();
  const users = db
    .prepare(
      `SELECT u.id, u.username, u.email, u.full_name, u.role, u.nip_or_nik, u.phone,
              u.gtk_id, u.is_active, u.created_at, u.last_login_at, g.position as gtk_position
       FROM users u LEFT JOIN gtk_staff g ON u.gtk_id = g.id
       ORDER BY u.id ASC`
    )
    .all();
  res.json(users);
});

app.post('/api/admin/users', requireAuth, requireRole('ADMIN'), (req: AuthenticatedRequest, res) => {
  const username = sanitizeText(req.body?.username, 60).toLowerCase();
  const email = sanitizeText(req.body?.email, 120).toLowerCase();
  const full_name = sanitizeText(req.body?.full_name, 120);
  const role: UserRole = ['ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'STAF', 'ORANG_TUA'].includes(req.body?.role)
    ? req.body.role
    : 'GURU';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const nip_or_nik = sanitizeText(req.body?.nip_or_nik, 40);
  const phone = sanitizeText(req.body?.phone, 30);
  const gtk_id = req.body?.gtk_id ? Number(req.body.gtk_id) : null;

  if (!username || !email || !full_name || password.length < 8) {
    res.status(400).json({ error: 'Username, email, nama lengkap, dan kata sandi (min. 8 karakter) wajib diisi.' });
    return;
  }

  const db = getDb();
  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = db
      .prepare(
        `INSERT INTO users (username, email, password_hash, full_name, role, nip_or_nik, phone, gtk_id, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .run(username, email, hash, full_name, role, nip_or_nik, phone, gtk_id);
    logAudit(req, 'CREATE_USER', 'Admin', info.lastInsertRowid as number, `Membuat akun ${username} (${role})`);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Username atau email sudah terdaftar.' });
  }
});

app.put('/api/admin/users/:id', requireAuth, requireRole('ADMIN'), (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const full_name = sanitizeText(req.body?.full_name, 120);
  const role: UserRole = ['ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'STAF', 'ORANG_TUA'].includes(req.body?.role)
    ? req.body.role
    : 'GURU';
  const is_active = req.body?.is_active === 0 ? 0 : 1;
  const newPassword = typeof req.body?.password === 'string' ? req.body.password : '';

  const db = getDb();
  if (newPassword.length >= 8) {
    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET full_name=?, role=?, nip_or_nik=?, phone=?, gtk_id=?, is_active=?, password_hash=? WHERE id=?').run(
      full_name,
      role,
      sanitizeText(req.body?.nip_or_nik, 40),
      sanitizeText(req.body?.phone, 30),
      req.body?.gtk_id ? Number(req.body.gtk_id) : null,
      is_active,
      hash,
      id
    );
  } else {
    db.prepare('UPDATE users SET full_name=?, role=?, nip_or_nik=?, phone=?, gtk_id=?, is_active=? WHERE id=?').run(
      full_name,
      role,
      sanitizeText(req.body?.nip_or_nik, 40),
      sanitizeText(req.body?.phone, 30),
      req.body?.gtk_id ? Number(req.body.gtk_id) : null,
      is_active,
      id
    );
  }
  logAudit(req, 'UPDATE_USER', 'Admin', id, `Memperbarui akun pengguna ID ${id} (${role})`);
  res.json({ message: 'Akun pengguna berhasil diperbarui.' });
});

app.get('/api/admin/audit-logs', requireAuth, requireRole('ADMIN', 'KEPALA_SEKOLAH'), (req, res) => {
  const limit = Math.min(200, Math.max(10, Number(req.query.limit) || 80));
  const db = getDb();
  const rows = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?').all(limit);
  res.json(rows);
});

app.get('/api/admin/backups', requireAuth, requireRole('ADMIN'), (_req, res) => {
  const files = fs
    .readdirSync(BACKUPS_DIR)
    .filter((f) => f.endsWith('.db'))
    .map((f) => {
      const stat = fs.statSync(path.join(BACKUPS_DIR, f));
      return {
        filename: f,
        size: stat.size,
        created_at: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  res.json(files);
});

app.post('/api/admin/backups', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `sims_backup_${timestamp}.db`;
  const targetPath = path.join(BACKUPS_DIR, filename);

  try {
    const db = getDb();
    await db.backup(targetPath);
    logAudit(req, 'BACKUP_DB', 'Database', filename, `Membuat cadangan database ${filename}`);
    res.status(201).json({ filename, message: 'Cadangan database berhasil dibuat.' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal membuat backup database.' });
  }
});

app.get('/api/admin/backups/:filename/download', requireAuth, requireRole('ADMIN'), (req: AuthenticatedRequest, res) => {
  const safeName = path.basename(req.params.filename);
  const fullPath = path.join(BACKUPS_DIR, safeName);
  if (!safeName.endsWith('.db') || !fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'File backup tidak ditemukan.' });
    return;
  }
  logAudit(req, 'DOWNLOAD_BACKUP', 'Database', safeName, `Mengunduh file backup ${safeName}`);
  res.download(fullPath, safeName);
});

app.post('/api/admin/backups/:filename/restore', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  const safeName = path.basename(req.params.filename);
  const fullPath = path.join(BACKUPS_DIR, safeName);
  if (!safeName.endsWith('.db') || !fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'File backup tidak ditemukan.' });
    return;
  }

  try {
    const db = getDb();
    const safetyBackup = path.join(BACKUPS_DIR, `pre_restore_${Date.now()}.db`);
    await db.backup(safetyBackup);
    closeDb();
    fs.copyFileSync(fullPath, DB_PATH);
    initDatabase();
    logAudit(req, 'RESTORE_DB', 'Database', safeName, `Memulihkan database dari snapshot ${safeName}`);
    res.json({ message: `Database berhasil dipulihkan dari ${safeName}.` });
  } catch (err) {
    initDatabase();
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memulihkan database.' });
  }
});

// Global error handler for Multer / JSON errors
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(400).json({ error: err.message || 'Permintaan tidak valid.' });
});

// ==========================================
// VITE DEV MIDDLEWARE / STATIC PRODUCTION
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SIMS SMA Darul Ulum Kepohbaru running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
