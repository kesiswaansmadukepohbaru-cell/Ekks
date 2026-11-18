import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { SUPERVISION_INSTRUMENTS, calculateSupervisionPredicate } from './instrumentsData.ts';

export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
export const MEDIA_DIR = path.join(UPLOADS_DIR, 'media');
export const BACKUPS_DIR = path.resolve(process.cwd(), 'backups');
export const DB_PATH = path.join(DATA_DIR, 'sims_darul_ulum.db');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(MEDIA_DIR, { recursive: true });
fs.mkdirSync(BACKUPS_DIR, { recursive: true });

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('foreign_keys = ON');
    dbInstance.pragma('journal_mode = WAL');
  }
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function initDatabase(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS school_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      npsn TEXT NOT NULL,
      nss TEXT NOT NULL,
      accreditation TEXT NOT NULL,
      address TEXT NOT NULL,
      district TEXT NOT NULL,
      regency TEXT NOT NULL,
      province TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      website TEXT NOT NULL,
      principal_name TEXT NOT NULL,
      principal_nip TEXT NOT NULL,
      founded_year INTEGER NOT NULL,
      vision TEXT NOT NULL,
      mission_json TEXT NOT NULL,
      objectives_json TEXT NOT NULL,
      history TEXT NOT NULL,
      org_structure_json TEXT NOT NULL,
      programs_json TEXT NOT NULL,
      achievements_json TEXT NOT NULL,
      social_links_json TEXT NOT NULL,
      hero_image_url TEXT NOT NULL DEFAULT '/src/assets/images/hero_school_campus_1794984787946.jpg',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS academic_years (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year_label TEXT NOT NULL,
      semester TEXT NOT NULL CHECK (semester IN ('Ganjil', 'Genap')),
      is_active INTEGER NOT NULL DEFAULT 0,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gtk_staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nip TEXT NOT NULL,
      nuptk TEXT NOT NULL,
      full_name TEXT NOT NULL,
      gender TEXT NOT NULL CHECK (gender IN ('L', 'P')),
      category TEXT NOT NULL CHECK (category IN ('Kepala Sekolah', 'Guru', 'Tenaga Kependidikan')),
      position TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT '-',
      employment_status TEXT NOT NULL,
      education TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      join_year INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'STAF', 'ORANG_TUA')),
      nip_or_nik TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      gtk_id INTEGER REFERENCES gtk_staff(id) ON DELETE SET NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      grade_level INTEGER NOT NULL CHECK (grade_level IN (10, 11, 12)),
      program TEXT NOT NULL,
      academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      homeroom_teacher_id INTEGER REFERENCES gtk_staff(id) ON DELETE SET NULL,
      room_name TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 36
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nis TEXT NOT NULL UNIQUE,
      nisn TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      gender TEXT NOT NULL CHECK (gender IN ('L', 'P')),
      birth_place TEXT NOT NULL,
      birth_date TEXT NOT NULL,
      religion TEXT NOT NULL DEFAULT 'Islam',
      address TEXT NOT NULL,
      parent_name TEXT NOT NULL,
      parent_phone TEXT NOT NULL,
      parent_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
      entry_year INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Lulus', 'Pindah', 'Keluar')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS student_academic_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      semester TEXT NOT NULL CHECK (semester IN ('Ganjil', 'Genap')),
      class_name TEXT NOT NULL,
      attendance_pct REAL NOT NULL DEFAULT 95.0,
      average_score REAL NOT NULL DEFAULT 82.0,
      conduct_grade TEXT NOT NULL DEFAULT 'Baik',
      homeroom_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('Pengumuman', 'Berita', 'Agenda', 'Prestasi')),
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      event_date TEXT NOT NULL,
      author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS gallery_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      image_url TEXT NOT NULL,
      caption TEXT NOT NULL,
      event_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS archive_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER REFERENCES archive_folders(id) ON DELETE CASCADE,
      category TEXT NOT NULL CHECK (category IN ('Manajerial', 'Kewirausahaan', 'Supervisi')),
      academic_year TEXT NOT NULL DEFAULT '2025/2026',
      description TEXT NOT NULL DEFAULT '',
      allowed_roles_json TEXT NOT NULL DEFAULT '["ADMIN","KEPALA_SEKOLAH","GURU","STAF"]',
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS archive_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id INTEGER NOT NULL REFERENCES archive_folders(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      stored_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('Manajerial', 'Kewirausahaan', 'Supervisi')),
      academic_year TEXT NOT NULL,
      activity_name TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      allowed_roles_json TEXT NOT NULL DEFAULT '["ADMIN","KEPALA_SEKOLAH","GURU","STAF"]',
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS supervision_instruments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      description TEXT NOT NULL,
      target_role TEXT NOT NULL,
      total_items INTEGER NOT NULL,
      max_score INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS supervision_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instrument_id INTEGER NOT NULL REFERENCES supervision_instruments(id) ON DELETE CASCADE,
      section_code TEXT NOT NULL,
      section_title TEXT NOT NULL,
      item_number TEXT NOT NULL,
      indicator_text TEXT NOT NULL,
      physical_evidence_json TEXT NOT NULL,
      inspection_method TEXT NOT NULL,
      general_item_link TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS supervision_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instrument_id INTEGER NOT NULL REFERENCES supervision_instruments(id) ON DELETE CASCADE,
      target_gtk_id INTEGER NOT NULL REFERENCES gtk_staff(id) ON DELETE CASCADE,
      supervisor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      scheduled_date TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      semester TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Terjadwal' CHECK (status IN ('Terjadwal', 'Berlangsung', 'Selesai')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS supervision_assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instrument_id INTEGER NOT NULL REFERENCES supervision_instruments(id) ON DELETE CASCADE,
      schedule_id INTEGER REFERENCES supervision_schedules(id) ON DELETE SET NULL,
      target_gtk_id INTEGER NOT NULL REFERENCES gtk_staff(id) ON DELETE CASCADE,
      target_name TEXT NOT NULL,
      school_name TEXT NOT NULL,
      supervisor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      supervisor_name TEXT NOT NULL,
      assessment_date TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      semester TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Final')),
      total_score INTEGER NOT NULL DEFAULT 0,
      max_score INTEGER NOT NULL DEFAULT 0,
      final_value REAL NOT NULL DEFAULT 0,
      predicate TEXT NOT NULL DEFAULT 'Sangat Kurang',
      unfilled_count INTEGER NOT NULL DEFAULT 0,
      examiner_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS supervision_assessment_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assessment_id INTEGER NOT NULL REFERENCES supervision_assessments(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES supervision_items(id) ON DELETE CASCADE,
      score INTEGER CHECK (score IS NULL OR (score >= 1 AND score <= 4)),
      notes TEXT NOT NULL DEFAULT '',
      recommendation TEXT NOT NULL DEFAULT '',
      UNIQUE(assessment_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS supervision_follow_ups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assessment_id INTEGER NOT NULL REFERENCES supervision_assessments(id) ON DELETE CASCADE,
      action_plan TEXT NOT NULL,
      pic_name TEXT NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Belum Dimulai' CHECK (status IN ('Belum Dimulai', 'Dalam Proses', 'Terlaksana')),
      progress_notes TEXT NOT NULL DEFAULT '',
      evidence_doc_id INTEGER REFERENCES archive_documents(id) ON DELETE SET NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      target_id TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '',
      ip_address TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const profileCols = db.prepare(`PRAGMA table_info(school_profile)`).all() as { name: string }[];
  if (!profileCols.some((c) => c.name === 'hero_image_url')) {
    db.exec(
      `ALTER TABLE school_profile ADD COLUMN hero_image_url TEXT NOT NULL DEFAULT '/src/assets/images/hero_school_campus_1794984787946.jpg'`
    );
  }

  seedInitialData(db);
}

function seedInitialData(db: Database.Database): void {
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  if (userCount > 0) {
    ensureSupervisionInstrumentsSeeded(db);
    return;
  }

  const seedTx = db.transaction(() => {
    // 1. School Profile
    db.prepare(`
      INSERT INTO school_profile (
        id, name, npsn, nss, accreditation, address, district, regency, province,
        postal_code, phone, email, website, principal_name, principal_nip, founded_year,
        vision, mission_json, objectives_json, history, org_structure_json,
        programs_json, achievements_json, social_links_json, updated_at
      ) VALUES (
        1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).run(
      'SMA Darul Ulum Kepohbaru',
      '20541289',
      '302050516004',
      'A (Unggul) — BAN-S/M',
      'Jl. Raya Kepohbaru No. 45, Desa Kepoh',
      'Kepohbaru',
      'Bojonegoro',
      'Jawa Timur',
      '62194',
      '(0353) 331482',
      'info@smadukepohbaru.sch.id',
      'https://smadukepohbaru.sch.id',
      'Drs. H. Ahmad Fauzan, M.Pd.',
      '196904121995121003',
      1988,
      'Terwujudnya insan yang beriman, bertakwa, berakhlak mulia, unggul dalam prestasi akademik dan non-akademik, berbudaya literasi digital, serta berjiwa kewirausahaan.',
      JSON.stringify([
        'Menanamkan nilai keimanan, ketakwaan, dan akhlakul karimah dalam seluruh aktivitas pembelajaran dan pembiasaan sekolah.',
        'Melaksanakan pembelajaran aktif, inovatif, dan terdiferensiasi berbasis Kurikulum Merdeka dan Rapor Pendidikan.',
        'Mengembangkan budaya literasi, riset ilmiah remaja, dan kecakapan teknologi informasi secara berkelanjutan.',
        'Menumbuhkan jiwa kemandirian dan kewirausahaan peserta didik melalui program proyek berbasis potensi lokal.',
        'Meningkatkan profesionalisme guru dan tenaga kependidikan melalui supervisi kolaboratif dan komunitas belajar.'
      ]),
      JSON.stringify([
        'Mencapai rata-rata indeks Rapor Pendidikan pada kategori Baik dan Sangat Baik di seluruh indikator mutu.',
        'Menyiapkan lulusan yang diterima di perguruan tinggi negeri unggulan serta memiliki kecakapan hidup mandiri.',
        'Mewujudkan tata kelola administrasi sekolah berbasis arsip digital terstruktur dan transparan.',
        'Menciptakan iklim lingkungan belajar yang aman, inklusif, sehat, dan bebas perundungan.'
      ]),
      'SMA Darul Ulum Kepohbaru berdiri sejak tahun 1988 di Kecamatan Kepohbaru, Kabupaten Bojonegoro atas prakarsa tokoh masyarakat dan Yayasan Pendidikan Darul Ulum. Selama lebih dari tiga dekade, sekolah ini konsisten memadukan penguatan karakter pesantren dengan keunggulan kurikulum nasional modern untuk melayani putra-putri wilayah Bojonegoro bagian timur.',
      JSON.stringify([
        { role: 'Kepala Sekolah', name: 'Drs. H. Ahmad Fauzan, M.Pd.', division: 'Pimpinan Satuan Pendidikan' },
        { role: 'Komite Sekolah', name: 'H. Mochammad Sholeh, S.E.', division: 'Mitra Strategis & Pengawasan' },
        { role: 'Waka Kurikulum', name: 'Siti Aminah, S.Pd., M.Pd.', division: 'Pengembangan KSP & Pembelajaran' },
        { role: 'Waka Kesiswaan', name: 'Muhammad Ridwan, S.Pd.', division: 'Pembinaan OSIS, Prestasi & BK' },
        { role: 'Waka Sarpras & Humas', name: 'Eko Prasetyo, S.Kom.', division: 'Sarana Prasarana & Digitalisasi' },
        { role: 'Kepala Tata Usaha', name: 'Nurul Hidayati, S.E.', division: 'Administrasi & Arsip Digital' }
      ]),
      JSON.stringify([
        {
          title: 'Kurikulum Merdeka & Kelas Riset',
          category: 'Akademik',
          description: 'Pembelajaran terdiferensiasi berbasis asesmen diagnostik, Projek Penguatan Profil Pelajar Pancasila (P5), dan bimbingan olimpiade sains.'
        },
        {
          title: 'Inkubator Kewirausahaan Siswa',
          category: 'Kewirausahaan',
          description: 'Pengembangan unit usaha siswa di bidang agribisnis lokal, desain grafis, dan koperasi digital yang bermitra dengan pelaku UMKM Bojonegoro.'
        },
        {
          title: 'Tahfidz & Pembinaan Karakter Islami',
          category: 'Karakter',
          description: 'Pembiasaan shalat berjamaah, kajian kitab akhlak, dan program tahfidz Al-Quran terintegrasi dengan layanan Bimbingan Konseling.'
        },
        {
          title: 'Digitalisasi Sekolah & Literasi TIK',
          category: 'Teknologi',
          description: 'Penerapan sistem informasi manajemen terpadu, laboratorium komputer berkecepatan tinggi, dan pelatihan pemrograman dasar.'
        }
      ]),
      JSON.stringify([
        { year: '2026', title: 'Juara 1 Olimpiade Sains Nasional (OSN) Biologi Tingkat Kabupaten Bojonegoro', level: 'Kabupaten' },
        { year: '2025', title: 'Sekolah Adiwiyata Tingkat Provinsi Jawa Timur', level: 'Provinsi' },
        { year: '2025', title: 'Juara 2 Lomba Karya Tulis Ilmiah Kewirausahaan SMA Se-Jawa Timur', level: 'Provinsi' },
        { year: '2025', title: 'Predikat Akreditasi A (Unggul) dengan Nilai 94 dari BAN-S/M', level: 'Nasional' }
      ]),
      JSON.stringify({
        facebook: 'SMA Darul Ulum Kepohbaru Official',
        instagram: '@smadukepohbaru',
        youtube: 'SMADU Kepohbaru Media',
        podcast: 'Siniar Suara Darul Ulum'
      }),
      new Date().toISOString()
    );

    // 2. Academic Years
    const ay1 = db.prepare(`
      INSERT INTO academic_years (year_label, semester, is_active, start_date, end_date)
      VALUES (?, ?, ?, ?, ?)
    `).run('2025/2026', 'Genap', 1, '2026-01-05', '2026-06-20').lastInsertRowid as number;

    const ay2 = db.prepare(`
      INSERT INTO academic_years (year_label, semester, is_active, start_date, end_date)
      VALUES (?, ?, ?, ?, ?)
    `).run('2026/2027', 'Ganjil', 0, '2026-07-13', '2026-12-19').lastInsertRowid as number;

    // 3. GTK Staff
    const insertGtk = db.prepare(`
      INSERT INTO gtk_staff (
        nip, nuptk, full_name, gender, category, position, subject,
        employment_status, education, phone, email, join_year, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const gtkPrincipalId = insertGtk.run(
      '196904121995121003', '4744747649200012', 'Drs. H. Ahmad Fauzan, M.Pd.', 'L',
      'Kepala Sekolah', 'Kepala Sekolah', 'Manajemen Pendidikan', 'GTY', 'S2 Pendidikan',
      '081234560001', 'fauzan@smadukepohbaru.sch.id', 2005
    ).lastInsertRowid as number;

    const gtkWakaKurId = insertGtk.run(
      '198207152009032008', '5047760661300043', 'Siti Aminah, S.Pd., M.Pd.', 'P',
      'Guru', 'Waka Kurikulum & Guru Matematika', 'Matematika', 'PNS', 'S2 Pendidikan Matematika',
      '081234560002', 'aminah@smadukepohbaru.sch.id', 2009
    ).lastInsertRowid as number;

    const gtkWakaKesId = insertGtk.run(
      '198503212011011004', '6653763664200022', 'Muhammad Ridwan, S.Pd.', 'L',
      'Guru', 'Waka Kesiswaan & Guru Biologi', 'Biologi', 'GTY', 'S1 Pendidikan Biologi',
      '081234560003', 'ridwan@smadukepohbaru.sch.id', 2011
    ).lastInsertRowid as number;

    const gtkGuruTikId = insertGtk.run(
      '199011082016041002', '8440768669130093', 'Eko Prasetyo, S.Kom.', 'L',
      'Guru', 'Waka Sarpras & Guru Informatika', 'Informatika', 'GTY', 'S1 Teknik Informatika',
      '081234560004', 'eko@smadukepohbaru.sch.id', 2016
    ).lastInsertRowid as number;

    const gtkGuruIndId = insertGtk.run(
      '198809142014022005', '1246766667230112', 'Dewi Kartika Sari, S.Pd.', 'P',
      'Guru', 'Guru Bahasa Indonesia', 'Bahasa Indonesia', 'PPPK', 'S1 Pendidikan Bahasa Indonesia',
      '081234560005', 'dewi@smadukepohbaru.sch.id', 2014
    ).lastInsertRowid as number;

    const gtkGuruIngId = insertGtk.run(
      '199204192018082001', '7751770671230082', 'Rina Wahyuni, S.Pd., M.Pd.', 'P',
      'Guru', 'Guru Bahasa Inggris', 'Bahasa Inggris', 'GTY', 'S2 Pendidikan Bahasa Inggris',
      '081234560006', 'rina@smadukepohbaru.sch.id', 2018
    ).lastInsertRowid as number;

    const gtkGuruEkoId = insertGtk.run(
      '198712032015011007', '3535765666130053', 'Budi Santoso, S.E.', 'L',
      'Guru', 'Guru Ekonomi & Pembina Kewirausahaan', 'Ekonomi', 'GTY', 'S1 Pendidikan Ekonomi',
      '081234560007', 'budi@smadukepohbaru.sch.id', 2015
    ).lastInsertRowid as number;

    const gtkTuId = insertGtk.run(
      '198406102010012011', '2942762663300062', 'Nurul Hidayati, S.E.', 'P',
      'Tenaga Kependidikan', 'Kepala Tata Usaha', '-', 'PTY', 'S1 Manajemen',
      '081234560008', 'nurul.tu@smadukepohbaru.sch.id', 2010
    ).lastInsertRowid as number;

    insertGtk.run(
      '199402252020031003', '9557772673130042', 'Ahmad Zaki Mubarroq, S.IP.', 'L',
      'Tenaga Kependidikan', 'Pustakawan & Pengelola Literasi', '-', 'PTY', 'S1 Ilmu Perpustakaan',
      '081234560009', 'zaki@smadukepohbaru.sch.id', 2020
    );

    insertGtk.run(
      '199508172021072002', '6149773674230033', 'Fitria Rahmawati, A.Md.', 'P',
      'Tenaga Kependidikan', 'Staf Administrasi & Operator Dapodik', '-', 'PTY', 'D3 Administrasi Perkantoran',
      '081234560010', 'fitria@smadukepohbaru.sch.id', 2021
    );

    // 4. Users (All 5 RBAC categories)
    const pwHash = bcrypt.hashSync('DarulUlum2026!', 10);
    const insertUser = db.prepare(`
      INSERT INTO users (username, email, password_hash, full_name, role, nip_or_nik, phone, gtk_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const adminUserId = insertUser.run(
      'admin', 'admin@smadukepohbaru.sch.id', pwHash,
      'Administrator SIMS', 'ADMIN', '199001012020011001', '081234560000', null
    ).lastInsertRowid as number;

    const kepsekUserId = insertUser.run(
      'kepsek', 'fauzan@smadukepohbaru.sch.id', pwHash,
      'Drs. H. Ahmad Fauzan, M.Pd.', 'KEPALA_SEKOLAH', '196904121995121003', '081234560001', gtkPrincipalId
    ).lastInsertRowid as number;

    insertUser.run(
      'guru1', 'aminah@smadukepohbaru.sch.id', pwHash,
      'Siti Aminah, S.Pd., M.Pd.', 'GURU', '198207152009032008', '081234560002', gtkWakaKurId
    );

    const stafUserId = insertUser.run(
      'staf1', 'nurul.tu@smadukepohbaru.sch.id', pwHash,
      'Nurul Hidayati, S.E.', 'STAF', '198406102010012011', '081234560008', gtkTuId
    ).lastInsertRowid as number;

    const parentUserId = insertUser.run(
      'ortu1', 'wali.hasan@gmail.com', pwHash,
      'H. Abdul Karim (Wali Siswa)', 'ORANG_TUA', '3522140505780004', '081335001122', null
    ).lastInsertRowid as number;

    // 5. Classes (Rombongan Belajar)
    const insertClass = db.prepare(`
      INSERT INTO classes (name, grade_level, program, academic_year_id, homeroom_teacher_id, room_name, capacity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const clsX1 = insertClass.run('X-1', 10, 'Kurikulum Merdeka', ay1, gtkGuruIndId, 'Ruang 01', 34).lastInsertRowid as number;
    const clsX2 = insertClass.run('X-2', 10, 'Kurikulum Merdeka', ay1, gtkGuruIngId, 'Ruang 02', 34).lastInsertRowid as number;
    const clsXI1 = insertClass.run('XI-MIPA-1', 11, 'MIPA', ay1, gtkWakaKurId, 'Ruang 05', 32).lastInsertRowid as number;
    const clsXI2 = insertClass.run('XI-IPS-1', 11, 'IPS', ay1, gtkGuruEkoId, 'Ruang 06', 32).lastInsertRowid as number;
    const clsXII1 = insertClass.run('XII-MIPA-1', 12, 'MIPA', ay1, gtkWakaKesId, 'Ruang 09', 32).lastInsertRowid as number;
    const clsXII2 = insertClass.run('XII-IPS-1', 12, 'IPS', ay1, gtkGuruTikId, 'Ruang 10', 32).lastInsertRowid as number;

    // 6. Students
    const insertStudent = db.prepare(`
      INSERT INTO students (
        nis, nisn, full_name, gender, birth_place, birth_date, religion, address,
        parent_name, parent_phone, parent_user_id, class_id, entry_year, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const stu1 = insertStudent.run(
      '2024001', '0081234501', 'Ahmad Hasan Al-Karim', 'L', 'Bojonegoro', '2008-05-14', 'Islam',
      'Ds. Kepoh RT 03/RW 01, Kec. Kepohbaru', 'H. Abdul Karim', '081335001122', parentUserId, clsXI1, 2024, 'Aktif',
      'Anggota Tim Olimpiade Biologi & Pengurus OSIS'
    ).lastInsertRowid as number;

    const stu2 = insertStudent.run(
      '2025004', '0094512004', 'Nadia Zahra Al-Karim', 'P', 'Bojonegoro', '2009-09-21', 'Islam',
      'Ds. Kepoh RT 03/RW 01, Kec. Kepohbaru', 'H. Abdul Karim', '081335001122', parentUserId, clsX1, 2025, 'Aktif',
      'Aktif di Klub Literasi & Pramuka'
    ).lastInsertRowid as number;

    const sampleStudents = [
      ['2025001', '0094512001', 'Aulia Putri Rahmawati', 'P', 'Bojonegoro', '2009-03-11', 'Ds. Mudung, Kec. Kepohbaru', 'Suharto', '081335002211', clsX1, 2025, 'Aktif'],
      ['2025002', '0094512002', 'Bagas Pratama Putra', 'L', 'Bojonegoro', '2009-07-19', 'Ds. Krangkong, Kec. Kepohbaru', 'Joko Susilo', '081335002212', clsX1, 2025, 'Aktif'],
      ['2025003', '0094512003', 'Citra Dewi Lestari', 'P', 'Lamongan', '2009-11-02', 'Ds. Sumberagung, Kec. Kepohbaru', 'Bambang Hermawan', '081335002213', clsX2, 2025, 'Aktif'],
      ['2025005', '0094512005', 'Dimas Arya Wijaya', 'L', 'Bojonegoro', '2009-02-27', 'Ds. Ngranggonanyar, Kec. Kepohbaru', 'Supriyadi', '081335002215', clsX2, 2025, 'Aktif'],
      ['2024002', '0081234502', 'Fatimah Az-Zahra', 'P', 'Bojonegoro', '2008-08-09', 'Ds. Bayemgede, Kec. Kepohbaru', 'H. Ridwan Kamil', '081335002216', clsXI1, 2024, 'Aktif'],
      ['2024003', '0081234503', 'Galih Ramadhan', 'L', 'Bojonegoro', '2008-10-04', 'Ds. Cengkir, Kec. Kepohbaru', 'Slamet Riyadi', '081335002217', clsXI1, 2024, 'Aktif'],
      ['2024004', '0081234504', 'Hana Safira Putri', 'P', 'Tuban', '2008-04-18', 'Ds. Pejok, Kec. Kepohbaru', 'M. Yusuf', '081335002218', clsXI2, 2024, 'Aktif'],
      ['2024005', '0081234505', 'Ilham Maulana Malik', 'L', 'Bojonegoro', '2008-12-25', 'Ds. Sidomukti, Kec. Kepohbaru', 'Ahmad Yani', '081335002219', clsXI2, 2024, 'Aktif'],
      ['2023001', '0079812001', 'Khairunnisa Salsabila', 'P', 'Bojonegoro', '2007-06-15', 'Ds. Kepoh, Kec. Kepohbaru', 'M. Syaiful', '081335002220', clsXII1, 2023, 'Aktif'],
      ['2023002', '0079812002', 'Muhammad Fajar Siddiq', 'L', 'Bojonegoro', '2007-01-30', 'Ds. Woro, Kec. Kepohbaru', 'Sudirman', '081335002221', clsXII1, 2023, 'Aktif'],
      ['2023003', '0079812003', 'Nabila Kusuma Wardani', 'P', 'Bojonegoro', '2007-09-07', 'Ds. Bumirejo, Kec. Kepohbaru', 'Agus Salim', '081335002222', clsXII2, 2023, 'Aktif'],
      ['2023004', '0079812004', 'Rizky Akbar Firmansyah', 'L', 'Bojonegoro', '2007-03-23', 'Ds. Mojosari, Kec. Kepohbaru', 'Haryanto', '081335002223', clsXII2, 2023, 'Aktif'],
      ['2022001', '0061122001', 'Syifa Nur Azizah', 'P', 'Bojonegoro', '2006-05-11', 'Ds. Karangan, Kec. Kepohbaru', 'H. Mukhtar', '081335002224', null, 2022, 'Lulus'],
      ['2022002', '0061122002', 'Taufik Hidayatullah', 'L', 'Bojonegoro', '2006-08-14', 'Ds. Betet, Kec. Kepohbaru', 'Mustofa', '081335002225', null, 2022, 'Lulus'],
    ];

    for (const s of sampleStudents) {
      insertStudent.run(
        s[0], s[1], s[2], s[3], s[4], s[5], 'Islam', s[6], s[7], s[8], null, s[9], s[10], s[11], ''
      );
    }

    // 7. Student Academic Records (especially for linked children + sample others)
    const insertRecord = db.prepare(`
      INSERT INTO student_academic_records (
        student_id, academic_year_id, semester, class_name, attendance_pct, average_score, conduct_grade, homeroom_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertRecord.run(stu1, ay1, 'Ganjil', 'XI-MIPA-1', 98.5, 89.4, 'Sangat Baik', 'Menunjukkan capaian unggul di Biologi dan aktif memimpin kegiatan OSIS.');
    insertRecord.run(stu1, ay1, 'Genap', 'XI-MIPA-1', 97.2, 90.8, 'Sangat Baik', 'Terus pertahankan kedisiplinan dan persiapan menuju seleksi OSN Provinsi.');
    insertRecord.run(stu2, ay1, 'Ganjil', 'X-1', 96.0, 86.5, 'Baik', 'Adaptasi belajar sangat baik dan aktif dalam kegiatan literasi sekolah.');
    insertRecord.run(stu2, ay1, 'Genap', 'X-1', 97.8, 87.9, 'Sangat Baik', 'Perkembangan kemampuan menulis karya ilmiah remaja sangat menonjol.');

    // 8. Announcements & News
    const insertAnn = db.prepare(`
      INSERT INTO announcements (title, category, summary, content, event_date, author_id, is_published)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    insertAnn.run(
      'Penerimaan Peserta Didik Baru (PPDB) Tahun Pelajaran 2026/2027',
      'Pengumuman',
      'Pendaftaran jalur prestasi akademik, tahfidz, dan reguler dibuka mulai Mei 2026.',
      'SMA Darul Ulum Kepohbaru membuka Penerimaan Peserta Didik Baru Tahun Pelajaran 2026/2027. Calon peserta didik dapat mendaftar melalui sekretariat PPDB di kampus sekolah dengan membawa fotokopi rapor semester 1–5, akta kelahiran, dan kartu keluarga.',
      '2026-05-15',
      adminUserId
    );
    insertAnn.run(
      'Pelaksanaan Supervisi Akademik Semester Genap Berbasis Instrumen Digital',
      'Agenda',
      'Jadwal observasi pembelajaran dan telaah perangkat ajar guru dilaksanakan mulai pekan kedua November.',
      'Kepala Sekolah bersama Tim Supervisi akan melaksanakan rangkaian supervisi pembelajaran yang mencakup kesepakatan pra-observasi, observasi kelas, umpan balik dialogis, dan penyusunan Rencana Tindak Lanjut melalui portal SIMS.',
      '2026-11-24',
      kepsekUserId
    );
    insertAnn.run(
      'Siswa SMA Darul Ulum Raih Juara 1 OSN Biologi Kabupaten Bojonegoro',
      'Prestasi',
      'Ahmad Hasan Al-Karim (XI-MIPA-1) berhasil melaju ke tingkat Provinsi Jawa Timur.',
      'Selamat kepada Ahmad Hasan Al-Karim beserta pembina Bapak Muhammad Ridwan, S.Pd. atas capaian Juara 1 Olimpiade Sains Nasional (OSN) Bidang Biologi tingkat Kabupaten Bojonegoro.',
      '2026-10-18',
      adminUserId
    );
    insertAnn.run(
      'Expo Kewirausahaan Siswa & Panen Karya P5 Kurikulum Merdeka',
      'Berita',
      'Menampilkan 12 produk inovasi agribisnis dan ekonomi kreatif karya siswa kelas X dan XI.',
      'Kegiatan Panen Karya P5 dan Expo Kewirausahaan menghadirkan komite sekolah, orang tua/wali murid, serta mitra UMKM Kecamatan Kepohbaru untuk mengapresiasi hasil proyek kewirausahaan siswa.',
      '2026-11-05',
      stafUserId
    );

    // 9. Gallery Items (referencing generated local images)
    const insertGal = db.prepare(`
      INSERT INTO gallery_items (title, category, image_url, caption, event_date)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertGal.run(
      'Lingkungan Kampus Utama SMA Darul Ulum Kepohbaru',
      'Fasilitas',
      '/src/assets/images/hero_school_campus_1794984787946.jpg',
      'Suasana halaman utama dan gedung pembelajaran yang asri, nyaman, serta mendukung iklim belajar positif.',
      '2026-09-12'
    );
    insertGal.run(
      'Praktikum Laboratorium Sains & Biologi',
      'Akademik',
      '/src/assets/images/gallery_science_lab_1794984788782.jpg',
      'Kegiatan praktikum kimia dan biologi siswa kelas XI MIPA menggunakan fasilitas mikroskop dan alat ukur standar.',
      '2026-10-08'
    );
    insertGal.run(
      'Pembelajaran Digital di Laboratorium Informatika',
      'Teknologi',
      '/src/assets/images/gallery_computer_lab_1794984788886.jpg',
      'Integrasi literasi digital dan pemrograman web dasar dalam mata pelajaran Informatika.',
      '2026-10-22'
    );
    insertGal.run(
      'Diskusi Kelompok & Literasi Taman Baca',
      'Kesiswaan',
      '/src/assets/images/gallery_campus_activity_1794984789497.jpg',
      'Sesi diskusi kelompok siswa di gazebo perpustakaan sekolah dalam program pembiasaan literasi pagi.',
      '2026-11-02'
    );

    // 10. Digital Archive Folders (Exact structure from prompt Section C)
    const insertFolder = db.prepare(`
      INSERT INTO archive_folders (name, parent_id, category, academic_year, description, allowed_roles_json, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const fManajerial = insertFolder.run(
      '1. Manajerial', null, 'Manajerial', '2025/2026',
      'Dokumen perencanaan, pelaksanaan, evaluasi, dan administrasi manajemen sekolah.',
      '["ADMIN","KEPALA_SEKOLAH","GURU","STAF"]', adminUserId
    ).lastInsertRowid as number;

    const fManPerencanaan = insertFolder.run('Perencanaan program sekolah', fManajerial, 'Manajerial', '2025/2026', 'RKJM, RKT, RKAS, KSP, dan dokumen visi-misi sekolah.', '["ADMIN","KEPALA_SEKOLAH","GURU","STAF"]', adminUserId).lastInsertRowid as number;
    const fManPelaksanaan = insertFolder.run('Pelaksanaan program kerja', fManajerial, 'Manajerial', '2025/2026', 'Laporan pelaksanaan kegiatan, daftar hadir, notula, dan MoU.', '["ADMIN","KEPALA_SEKOLAH","GURU","STAF"]', adminUserId).lastInsertRowid as number;
    insertFolder.run('Evaluasi dan laporan kegiatan', fManajerial, 'Manajerial', '2025/2026', 'LPJ, hasil refleksi pembelajaran, dan laporan tahunan sekolah.', '["ADMIN","KEPALA_SEKOLAH","STAF"]', adminUserId);
    insertFolder.run('Dokumen administrasi manajemen sekolah', fManajerial, 'Manajerial', '2025/2026', 'SK Tim, tata tertib, POS P3K, dan kartu inventaris ruang.', '["ADMIN","KEPALA_SEKOLAH","STAF"]', adminUserId);

    const fKewirausahaan = insertFolder.run(
      '2. Kewirausahaan', null, 'Kewirausahaan', '2025/2026',
      'Arsip program kewirausahaan sekolah, kemitraan, dokumentasi, dan laporan hasil.',
      '["ADMIN","KEPALA_SEKOLAH","GURU","STAF"]', adminUserId
    ).lastInsertRowid as number;

    const fKewProgram = insertFolder.run('Program kewirausahaan sekolah', fKewirausahaan, 'Kewirausahaan', '2025/2026', 'Master plan kewirausahaan, analisis SWOT, dan MoU mitra.', '["ADMIN","KEPALA_SEKOLAH","GURU","STAF"]', adminUserId).lastInsertRowid as number;
    insertFolder.run('Perencanaan dan pelaksanaan kegiatan', fKewirausahaan, 'Kewirausahaan', '2025/2026', 'Proposal proyek P5 kewirausahaan, RKA, dan jadwal pelaksanaan.', '["ADMIN","KEPALA_SEKOLAH","GURU","STAF"]', adminUserId);
    insertFolder.run('Dokumentasi kegiatan', fKewirausahaan, 'Kewirausahaan', '2025/2026', 'Foto kegiatan expo, kunjungan mitra, dan produk karya siswa.', '["ADMIN","KEPALA_SEKOLAH","GURU","STAF"]', adminUserId);
    insertFolder.run('Laporan hasil kegiatan', fKewirausahaan, 'Kewirausahaan', '2025/2026', 'Laporan evaluasi dan tindak lanjut program kewirausahaan.', '["ADMIN","KEPALA_SEKOLAH","GURU","STAF"]', adminUserId);

    const fSupervisi = insertFolder.run(
      '3. Supervisi Tenaga Pendidik dan Kependidikan', null, 'Supervisi', '2025/2026',
      'Arsip instrumen, jadwal, hasil penilaian, catatan rekomendasi, dan tindak lanjut supervisi.',
      '["ADMIN","KEPALA_SEKOLAH","GURU","STAF"]', adminUserId
    ).lastInsertRowid as number;

    const fSupInstrumen = insertFolder.run('Instrumen supervisi', fSupervisi, 'Supervisi', '2025/2026', 'Dokumen instrumen supervisi pembelajaran, tendik, dan pengelolaan kinerja.', '["ADMIN","KEPALA_SEKOLAH","GURU","STAF"]', adminUserId).lastInsertRowid as number;
    insertFolder.run('Jadwal supervisi', fSupervisi, 'Supervisi', '2025/2026', 'Jadwal supervisi semester ganjil dan genap beserta surat tugas tim.', '["ADMIN","KEPALA_SEKOLAH","GURU","STAF"]', adminUserId);
    const fSupHasil = insertFolder.run('Hasil penilaian', fSupervisi, 'Supervisi', '2025/2026', 'Rekapitulasi skor dan nilai hasil observasi kinerja GTK.', '["ADMIN","KEPALA_SEKOLAH"]', adminUserId).lastInsertRowid as number;
    insertFolder.run('Catatan dan rekomendasi', fSupervisi, 'Supervisi', '2025/2026', 'Catatan umpan balik dialogis pasca-observasi dan saran perbaikan.', '["ADMIN","KEPALA_SEKOLAH","GURU"]', adminUserId);
    insertFolder.run('Tindak lanjut hasil supervisi', fSupervisi, 'Supervisi', '2025/2026', 'Rencana Tindak Lanjut (RTL), bukti coaching, dan peningkatan kompetensi.', '["ADMIN","KEPALA_SEKOLAH","GURU","STAF"]', adminUserId);

    // Seed real previewable & downloadable sample documents in uploads/
    const sampleDocs = [
      {
        folderId: fManPerencanaan,
        title: 'Rencana Kerja Tahunan (RKT) SMA Darul Ulum 2025/2026',
        filename: 'RKT_SMADU_Kepohbaru_2025_2026.txt',
        category: 'Manajerial',
        year: '2025/2026',
        activity: 'Penyusunan RKT Berbasis Rapor Pendidikan',
        roles: '["ADMIN","KEPALA_SEKOLAH","GURU","STAF"]',
        content:
          'RENCANA KERJA TAHUNAN (RKT) SMA DARUL ULUM KEPOHBARU\nTahun Pelajaran: 2025/2026\n\n1. Prioritas Mutu Pembelajaran\n- Peningkatan kualitas refleksi guru melalui komunitas belajar bulanan.\n- Pendampingan penyusunan modul ajar terdiferensiasi.\n\n2. Program Kewirausahaan & Penguatan Karakter\n- Inkubator bisnis siswa dan pameran karya P5.\n\n3. Digitalisasi Administrasi & Arsip Sekolah\n- Penerapan SIMS terintegrasi untuk data induk siswa, GTK, dan arsip digital.'
      },
      {
        folderId: fManPelaksanaan,
        title: 'Notula & Daftar Hadir Sosialisasi Visi-Misi Sekolah',
        filename: 'Notula_Sosialisasi_Visi_Misi_2026.txt',
        category: 'Manajerial',
        year: '2025/2026',
        activity: 'Rapat Kerja Awal Semester Genap',
        roles: '["ADMIN","KEPALA_SEKOLAH","GURU","STAF"]',
        content:
          'NOTULA SOSIALISASI VISI-MISI SMA DARUL ULUM KEPOHBARU\nTanggal: 12 Januari 2026\nPeserta: Kepala Sekolah, Dewan Guru, Tenaga Kependidikan, Komite, Perwakilan Orang Tua.\n\nRingkasan Keputusan:\n1. Penguatan budaya disiplin, literasi 15 menit pagi, dan akhlak mulia.\n2. Penyelarasan program kerja Waka dengan target Rapor Pendidikan 2026.'
      },
      {
        folderId: fKewProgram,
        title: 'Master Plan Inkubator Kewirausahaan Siswa 2026',
        filename: 'MasterPlan_Kewirausahaan_SMADU_2026.txt',
        category: 'Kewirausahaan',
        year: '2025/2026',
        activity: 'Program Pengembangan Kewirausahaan Sekolah',
        roles: '["ADMIN","KEPALA_SEKOLAH","GURU","STAF"]',
        content:
          'MASTER PLAN PROGRAM KEWIRAUSAHAAN SMA DARUL ULUM KEPOHBARU\n\nUnit Usaha Binaan:\n1. Agro-Edu Kepohbaru (Budidaya hidroponik dan pengolahan hasil pertanian lokal)\n2. Darul Ulum Creative Studio (Desain grafis, percetakan, dan media digital sekolah)\n3. Koperasi Siswa Digital\n\nMitra Eksternal: Paguyuban UMKM Kecamatan Kepohbaru & Koperasi Mitra Bojonegoro.'
      },
      {
        folderId: fSupInstrumen,
        title: 'Panduan Penggunaan Instrumen Supervisi Kinerja 2026',
        filename: 'Panduan_Instrumen_Supervisi_2026.txt',
        category: 'Supervisi',
        year: '2025/2026',
        activity: 'Sosialisasi Supervisi Akademik & Manajerial',
        roles: '["ADMIN","KEPALA_SEKOLAH","GURU","STAF"]',
        content:
          'PANDUAN INSTRUMEN SUPERVISI DIGITAL\n\nSkala Penilaian:\n1 = Kurang memadai / belum tampak bukti fisik\n2 = Cukup / sebagian bukti tersedia\n3 = Baik / bukti lengkap namun perlu penguatan konsistensi\n4 = Sangat Baik / bukti lengkap, berdampak, dan berkelanjutan\n\nRumus Nilai Akhir: (Jumlah Skor / Skor Maksimal) x 100\nPredikat: 91-100 Sangat Baik | 76-90 Baik | 61-75 Cukup | 51-60 Kurang | <=50 Sangat Kurang.'
      },
      {
        folderId: fSupHasil,
        title: 'Rekapitulasi Hasil Penilaian Supervisi Semester Ganjil',
        filename: 'Rekap_Hasil_Supervisi_Ganjil_2025_2026.csv',
        category: 'Supervisi',
        year: '2025/2026',
        activity: 'Evaluasi Kinerja Semester Ganjil',
        roles: '["ADMIN","KEPALA_SEKOLAH"]',
        content:
          'No,Nama GTK,Instrumen,Skor,Skor Maksimal,Nilai Akhir,Predikat\n1,Drs. H. Ahmad Fauzan M.Pd.,Siklus Peningkatan Kualitas Praktik Pembelajaran,36,40,90.00,Baik\n2,Siti Aminah S.Pd. M.Pd.,Memandu Perencanaan Pembelajaran,33,36,91.67,Sangat Baik\n3,Muhammad Ridwan S.Pd.,Aktivasi Kegiatan Komunitas Belajar,35,40,87.50,Baik'
      }
    ];

    const insertDoc = db.prepare(`
      INSERT INTO archive_documents (
        folder_id, title, original_filename, stored_filename, mime_type, file_size,
        category, academic_year, activity_name, description, allowed_roles_json, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const d of sampleDocs) {
      const stored = `seed_${Date.now()}_${d.filename}`;
      const fullPath = path.join(UPLOADS_DIR, stored);
      fs.writeFileSync(fullPath, d.content, 'utf8');
      const mime = d.filename.endsWith('.csv') ? 'text/csv' : 'text/plain';
      insertDoc.run(
        d.folderId,
        d.title,
        d.filename,
        stored,
        mime,
        Buffer.byteLength(d.content, 'utf8'),
        d.category,
        d.year,
        d.activity,
        `Dokumen resmi arsip ${d.category} SMA Darul Ulum Kepohbaru`,
        d.roles,
        adminUserId
      );
    }

    // 11. Supervision Instruments & Items (All 8 sheets from attached PDF)
    ensureSupervisionInstrumentsSeeded(db);

    // 12. Sample Supervision Schedules & Assessments
    const instrUmum = db.prepare(`SELECT id, max_score FROM supervision_instruments WHERE code = 'TUGAS_KEPALA_SEKOLAH'`).get() as { id: number; max_score: number };
    const instrSiklus = db.prepare(`SELECT id, max_score FROM supervision_instruments WHERE code = 'SPEC_SIKLUS_PEMBELAJARAN'`).get() as { id: number; max_score: number };
    const instrPerencanaan = db.prepare(`SELECT id, max_score FROM supervision_instruments WHERE code = 'SPEC_PERENCANAAN_PEMBELAJARAN'`).get() as { id: number; max_score: number };

    const sched1 = db.prepare(`
      INSERT INTO supervision_schedules (instrument_id, target_gtk_id, supervisor_user_id, scheduled_date, academic_year, semester, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(instrUmum.id, gtkPrincipalId, adminUserId, '2026-10-15', '2025/2026', 'Genap', 'Selesai', 'Penilaian Kinerja Kepala Sekolah (PKKS) Instrumen Umum').lastInsertRowid as number;

    const sched2 = db.prepare(`
      INSERT INTO supervision_schedules (instrument_id, target_gtk_id, supervisor_user_id, scheduled_date, academic_year, semester, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(instrSiklus.id, gtkPrincipalId, adminUserId, '2026-10-20', '2025/2026', 'Genap', 'Selesai', 'Observasi siklus peningkatan kualitas praktik pembelajaran').lastInsertRowid as number;

    const sched3 = db.prepare(`
      INSERT INTO supervision_schedules (instrument_id, target_gtk_id, supervisor_user_id, scheduled_date, academic_year, semester, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(instrPerencanaan.id, gtkWakaKurId, kepsekUserId, '2026-11-24', '2025/2026', 'Genap', 'Terjadwal', 'Supervisi perangkat ajar & ATP Kurikulum Merdeka').lastInsertRowid as number;

    // Seed Assessment 1 (Spec Siklus - exact sample scores 4,3,3,4,4,4,3,3,4,4 = 36/40 = 90.00 Baik!)
    const ass1 = db.prepare(`
      INSERT INTO supervision_assessments (
        instrument_id, schedule_id, target_gtk_id, target_name, school_name,
        supervisor_user_id, supervisor_name, assessment_date, academic_year, semester,
        status, total_score, max_score, final_value, predicate, unfilled_count, examiner_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      instrSiklus.id, sched2, gtkPrincipalId, 'Drs. H. Ahmad Fauzan, M.Pd.', 'SMA Darul Ulum Kepohbaru',
      adminUserId, 'Tim Penilai / Pengawas Pembina', '2026-10-20', '2025/2026', 'Genap',
      'Final', 36, 40, 90.0, calculateSupervisionPredicate(90.0), 0,
      'Siklus supervisi pembelajaran berjalan konsisten dengan dokumentasi pra-observasi dan umpan balik dialogis. Disarankan memperluas observasi sejawat lintas mata pelajaran.'
    ).lastInsertRowid as number;

    const siklusItems = db.prepare(`SELECT id FROM supervision_items WHERE instrument_id = ? ORDER BY sort_order ASC`).all(instrSiklus.id) as { id: number }[];
    const sampleScoresSiklus = [4, 3, 3, 4, 4, 4, 3, 3, 4, 4];
    const insertScore = db.prepare(`
      INSERT INTO supervision_assessment_scores (assessment_id, item_id, score, notes, recommendation)
      VALUES (?, ?, ?, ?, ?)
    `);
    siklusItems.forEach((item, idx) => {
      const sc = sampleScoresSiklus[idx] ?? 3;
      insertScore.run(
        ass1,
        item.id,
        sc,
        sc === 4 ? 'Bukti fisik lengkap dan terverifikasi.' : 'Dokumen tersedia, perlu penguatan tindak lanjut berkala.',
        sc === 4 ? 'Pertahankan konsistensi praktik baik.' : 'Lengkapi catatan evaluasi dampak pada siklus berikutnya.'
      );
    });

    // Seed Assessment 2 (Umum Kepala Sekolah: 76/84 = 90.48 Baik)
    const ass2 = db.prepare(`
      INSERT INTO supervision_assessments (
        instrument_id, schedule_id, target_gtk_id, target_name, school_name,
        supervisor_user_id, supervisor_name, assessment_date, academic_year, semester,
        status, total_score, max_score, final_value, predicate, unfilled_count, examiner_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      instrUmum.id, sched1, gtkPrincipalId, 'Drs. H. Ahmad Fauzan, M.Pd.', 'SMA Darul Ulum Kepohbaru',
      adminUserId, 'Pengawas SMA Kab. Bojonegoro', '2026-10-15', '2025/2026', 'Genap',
      'Final', 76, 84, Number(((76 / 84) * 100).toFixed(2)), calculateSupervisionPredicate((76 / 84) * 100), 0,
      'Tata kelola manajerial, digitalisasi sekolah, dan pelaksanaan supervisi GTK telah memenuhi standar mutu dengan baik.'
    ).lastInsertRowid as number;

    const umumItems = db.prepare(`SELECT id FROM supervision_items WHERE instrument_id = ? ORDER BY sort_order ASC`).all(instrUmum.id) as { id: number }[];
    umumItems.forEach((item, idx) => {
      const sc = idx % 3 === 0 ? 3 : 4; // 7 items * 3 + 14 items * 4 = 21 + 56 = 77 -> adjust one to 3 -> let's make exact sum 76
      const adjusted = idx === 1 ? 3 : sc;
      insertScore.run(
        ass2,
        item.id,
        adjusted,
        adjusted === 4 ? 'Dokumen fisik dan digital lengkap.' : 'Sebagian dokumen perlu pembaruan semester berjalan.',
        adjusted === 4 ? 'Siap untuk didiseminasikan.' : 'Lengkapi lampiran dokumentasi dan daftar hadir.'
      );
    });

    // Recalculate ass2 exact score
    const exactSum2 = (db.prepare(`SELECT SUM(score) as s FROM supervision_assessment_scores WHERE assessment_id = ?`).get(ass2) as { s: number }).s;
    const exactVal2 = Number(((exactSum2 / 84) * 100).toFixed(2));
    db.prepare(`UPDATE supervision_assessments SET total_score = ?, final_value = ?, predicate = ? WHERE id = ?`)
      .run(exactSum2, exactVal2, calculateSupervisionPredicate(exactVal2), ass2);

    // Seed Assessment 3 (Guru Perencanaan Pembelajaran for Siti Aminah - 33/36 = 91.67 Sangat Baik)
    const ass3 = db.prepare(`
      INSERT INTO supervision_assessments (
        instrument_id, schedule_id, target_gtk_id, target_name, school_name,
        supervisor_user_id, supervisor_name, assessment_date, academic_year, semester,
        status, total_score, max_score, final_value, predicate, unfilled_count, examiner_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      instrPerencanaan.id, sched3, gtkWakaKurId, 'Siti Aminah, S.Pd., M.Pd.', 'SMA Darul Ulum Kepohbaru',
      kepsekUserId, 'Drs. H. Ahmad Fauzan, M.Pd.', '2026-11-10', '2025/2026', 'Genap',
      'Final', 33, 36, 91.67, calculateSupervisionPredicate(91.67), 0,
      'Perangkat ATP dan Modul Ajar Matematika sudah terdiferensiasi dengan asesmen formatif yang jelas.'
    ).lastInsertRowid as number;

    const perencItems = db.prepare(`SELECT id FROM supervision_items WHERE instrument_id = ? ORDER BY sort_order ASC`).all(instrPerencanaan.id) as { id: number }[];
    perencItems.forEach((item, idx) => {
      const sc = idx < 6 ? 4 : 3; // 24 + 9 = 33
      insertScore.run(
        ass3,
        item.id,
        sc,
        'Perangkat pembelajaran sesuai CP dan konteks siswa.',
        sc === 4 ? 'Dijadikan model praktik baik pada komunitas belajar.' : 'Perkaya refleksi akhir semester bersama MGMP.'
      );
    });

    // Seed Follow-up Monitoring items
    const insertFollowUp = db.prepare(`
      INSERT INTO supervision_follow_ups (assessment_id, action_plan, pic_name, due_date, status, progress_notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertFollowUp.run(
      ass1,
      'Menyelenggarakan sesi observasi sejawat lintas rumpun mata pelajaran IPA dan IPS',
      'Siti Aminah, S.Pd., M.Pd.',
      '2026-12-10',
      'Dalam Proses',
      'Jadwal observasi sejawat telah disusun untuk 6 guru sasaran pada bulan November–Desember.'
    );
    insertFollowUp.run(
      ass2,
      'Pembaruan Kartu Inventaris Ruang (KIR) dan unggah arsip digital sarpras ke folder Manajerial',
      'Nurul Hidayati, S.E.',
      '2026-11-30',
      'Terlaksana',
      'Seluruh KIR ruang kelas dan laboratorium telah diperbarui dan diarsipkan.'
    );
    insertFollowUp.run(
      ass3,
      'Berbagi praktik baik penyusunan modul ajar terdiferensiasi di Komunitas Belajar sekolah',
      'Siti Aminah, S.Pd., M.Pd.',
      '2026-12-05',
      'Belum Dimulai',
      'Materi presentasi sedang disiapkan untuk pertemuan Komunitas Belajar pekan depan.'
    );

    // Seed initial Audit Log
    db.prepare(`
      INSERT INTO audit_logs (user_id, username, user_role, action, module, target_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(adminUserId, 'admin', 'ADMIN', 'SYSTEM_INIT', 'Database', '1', 'Inisialisasi database relasional SIMS SMA Darul Ulum Kepohbaru beserta 8 instrumen supervisi.', '127.0.0.1');
  });

  seedTx();
}

function ensureSupervisionInstrumentsSeeded(db: Database.Database): void {
  const existingCount = (db.prepare('SELECT COUNT(*) as count FROM supervision_instruments').get() as { count: number }).count;
  if (existingCount >= SUPERVISION_INSTRUMENTS.length) return;

  const insertInstrument = db.prepare(`
    INSERT OR IGNORE INTO supervision_instruments (code, title, subtitle, description, target_role, total_items, max_score, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO supervision_items (
      instrument_id, section_code, section_title, item_number, indicator_text,
      physical_evidence_json, inspection_method, general_item_link, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const instr of SUPERVISION_INSTRUMENTS) {
    const existing = db.prepare('SELECT id FROM supervision_instruments WHERE code = ?').get(instr.code) as { id: number } | undefined;
    if (existing) continue;
    const totalItems = instr.items.length;
    const maxScore = totalItems * 4;
    const res = insertInstrument.run(
      instr.code,
      instr.title,
      instr.subtitle,
      instr.description,
      instr.target_role,
      totalItems,
      maxScore,
      instr.sort_order
    );
    const instrId = res.lastInsertRowid as number;
    instr.items.forEach((item, index) => {
      insertItem.run(
        instrId,
        item.section_code,
        item.section_title,
        item.item_number,
        item.indicator_text,
        JSON.stringify(item.physical_evidence),
        item.inspection_method,
        item.general_item_link,
        index + 1
      );
    });
  }
}
