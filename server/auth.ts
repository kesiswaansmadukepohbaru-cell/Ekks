import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { DATA_DIR, getDb } from './db.ts';

export type UserRole = 'ADMIN' | 'KEPALA_SEKOLAH' | 'GURU' | 'STAF' | 'ORANG_TUA';

export interface AuthPayload {
  userId: number;
  username: string;
  fullName: string;
  role: UserRole;
  gtkId: number | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

const SECRET_FILE = path.join(DATA_DIR, '.jwt_secret');

function getJwtSecret(): string {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16) {
    return process.env.JWT_SECRET;
  }
  if (fs.existsSync(SECRET_FILE)) {
    return fs.readFileSync(SECRET_FILE, 'utf8').trim();
  }
  const generated = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(SECRET_FILE, generated, { encoding: 'utf8', mode: 0o600 });
  return generated;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '12h' });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as AuthPayload;
  } catch {
    return null;
  }
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (typeof req.query.token === 'string' && req.query.token.length > 0) {
    return req.query.token;
  }
  return null;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Autentikasi diperlukan. Silakan login terlebih dahulu.' });
    return;
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Sesi login telah berakhir atau tidak valid. Silakan login ulang.' });
    return;
  }

  // Verify user is still active in DB
  const db = getDb();
  const userRow = db
    .prepare('SELECT id, username, full_name, role, gtk_id, is_active FROM users WHERE id = ?')
    .get(decoded.userId) as
    | { id: number; username: string; full_name: string; role: UserRole; gtk_id: number | null; is_active: number }
    | undefined;

  if (!userRow || !userRow.is_active) {
    res.status(403).json({ error: 'Akun pengguna tidak aktif atau tidak ditemukan.' });
    return;
  }

  req.user = {
    userId: userRow.id,
    username: userRow.username,
    fullName: userRow.full_name,
    role: userRow.role,
    gtkId: userRow.gtk_id,
  };
  next();
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Autentikasi diperlukan.' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Akses ditolak. Fitur ini memerlukan peran: ${allowedRoles.join(', ')}.`,
      });
      return;
    }
    next();
  };
}

export function sanitizeText(value: unknown, maxLen = 2000): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLen);
}

export function parseAllowedRoles(jsonStr: string): UserRole[] {
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) return parsed as UserRole[];
  } catch {
    // ignore
  }
  return ['ADMIN', 'KEPALA_SEKOLAH'];
}

export function logAudit(
  req: AuthenticatedRequest,
  action: string,
  moduleName: string,
  targetId: string | number,
  details: string
): void {
  try {
    const db = getDb();
    const user = req.user;
    const ip =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0].trim()
        : req.socket.remoteAddress) || '127.0.0.1';
    db.prepare(
      `INSERT INTO audit_logs (user_id, username, user_role, action, module, target_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      user?.userId ?? null,
      user?.username ?? 'guest',
      user?.role ?? 'PUBLIC',
      action,
      moduleName,
      String(targetId),
      sanitizeText(details, 1000),
      ip
    );
  } catch {
    // Do not break primary flow if audit logging encounters an edge error
  }
}
