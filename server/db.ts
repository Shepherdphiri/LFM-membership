import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

let dbInstance: Database | null = null;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'church.sqlite');

export interface Branch {
  id: number;
  name: string;
  code: string; // e.g. MS, HRE, JHB, LON
  currency_symbol: string; // e.g. $, R, £, €
  currency_code: string; // e.g. USD, ZAR, GBP, EUR
  default_monthly_due: number;
  address?: string;
  created_at: string;
}

export interface Member {
  id: number;
  member_number: string;
  title: string;
  first_name: string;
  surname: string;
  full_name: string;
  phone: string;
  email?: string;
  photo_url?: string;
  branch_id: number;
  branch_name: string;
  branch_code: string;
  currency_symbol: string;
  currency_code: string;
  join_date: string;
  monthly_due_amount: number;
  has_monthly_dues?: number;
  has_kingdom_investment?: number;
  kingdom_investment_amount?: number;
  status: 'green' | 'orange' | 'red';
  notes?: string;
  created_at: string;
}

export interface Contribution {
  id: number;
  member_id: number;
  category: 'membership_fee' | 'kingdom_investment' | 'special_offering';
  amount: number;
  date: string;
  for_month?: string; // YYYY-MM
  payment_method: string;
  receipt_no: string;
  notes?: string;
  verified: number;
  created_at: string;
}

export interface NotificationItem {
  id: number;
  member_id: number | null;
  title: string;
  message: string;
  type: 'payment_receipt' | 'dues_reminder' | 'announcement' | 'kingdom_update' | 'status_alert';
  is_read: number;
  created_at: string;
}

export interface ChurchEvent {
  id: number;
  title: string;
  description: string;
  category: 'service' | 'event' | 'volunteer' | 'revival' | 'ministry';
  start_date: string;
  end_date?: string;
  location: string;
  target_ministry?: string;
  is_published: number;
  created_at: string;
}

export interface ChurchSettings {
  id: number;
  church_name: string;
  tagline: string;
  logo_url: string;
  address: string;
  phone: string;
  email: string;
  senior_pastor: string;
  tax_id: string;
  updated_at: string;
}

export function saveDatabase() {
  if (!dbInstance) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Error persisting SQLite database:', err);
  }
}

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
      initTablesAndSeed(dbInstance);
      saveDatabase();
      console.log('Loaded existing SQLite database from disk.');
      return dbInstance;
    } catch (e) {
      console.error('Failed reading existing sqlite db, creating new:', e);
    }
  }

  dbInstance = new SQL.Database();
  initTablesAndSeed(dbInstance);
  saveDatabase();
  console.log('Initialized and seeded new SQLite database.');
  return dbInstance;
}

function initTablesAndSeed(db: Database) {
  // Schema creation
  db.run(`
    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      code TEXT UNIQUE NOT NULL,
      currency_symbol TEXT NOT NULL DEFAULT '$',
      currency_code TEXT NOT NULL DEFAULT 'USD',
      default_monthly_due REAL DEFAULT 20.00,
      address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_number TEXT UNIQUE NOT NULL,
      title TEXT DEFAULT 'Brother',
      first_name TEXT NOT NULL,
      surname TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      photo_url TEXT,
      branch_id INTEGER NOT NULL,
      join_date TEXT NOT NULL,
      monthly_due_amount REAL DEFAULT 20.00,
      has_monthly_dues INTEGER DEFAULT 1,
      has_kingdom_investment INTEGER DEFAULT 0,
      kingdom_investment_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'green',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(branch_id) REFERENCES branches(id)
    );

    CREATE TABLE IF NOT EXISTS contributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      for_month TEXT,
      payment_method TEXT NOT NULL,
      receipt_no TEXT UNIQUE NOT NULL,
      notes TEXT,
      verified INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'service',
      start_date TEXT NOT NULL,
      end_date TEXT,
      location TEXT NOT NULL,
      target_ministry TEXT,
      is_published INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      name TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS church_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      church_name TEXT NOT NULL,
      tagline TEXT,
      logo_url TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      senior_pastor TEXT,
      tax_id TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_member_num ON members(member_number);
    CREATE INDEX IF NOT EXISTS idx_contrib_member ON contributions(member_id);
    CREATE INDEX IF NOT EXISTS idx_events_date ON events(start_date);
  `);

  // Migrations for existing database
  try {
    const memberCols = db.exec("PRAGMA table_info(members)");
    const colNames = memberCols[0]?.values.map((v: any) => v[1]) || [];
    if (!colNames.includes('photo_url')) {
      try { db.run("ALTER TABLE members ADD COLUMN photo_url TEXT"); } catch {}
    }
    if (!colNames.includes('has_monthly_dues')) {
      try { db.run("ALTER TABLE members ADD COLUMN has_monthly_dues INTEGER DEFAULT 1"); } catch {}
    }
    if (!colNames.includes('has_kingdom_investment')) {
      try { db.run("ALTER TABLE members ADD COLUMN has_kingdom_investment INTEGER DEFAULT 0"); } catch {}
    }
    if (!colNames.includes('kingdom_investment_amount')) {
      try { db.run("ALTER TABLE members ADD COLUMN kingdom_investment_amount REAL DEFAULT 0"); } catch {}
    }
    // Clean tithes and attendance
    db.run("DELETE FROM contributions WHERE category = 'tithe'");
    db.run("DROP TABLE IF EXISTS attendance");
  } catch (err) {
    console.warn('Migration warning:', err);
  }

  // Seed Settings if not exists
  const settingsCount = db.exec("SELECT COUNT(*) FROM church_settings");
  if (!settingsCount[0]?.values[0]?.[0]) {
    db.run(`
      INSERT INTO church_settings (id, church_name, tagline, logo_url, address, phone, email, senior_pastor, tax_id)
      VALUES (
        1,
        'Living Faith Membership Portal',
        'Living Faith International Assemblies • Stewardship & Member Records',
        '',
        'Living Faith Cathedral Campus, Lilongwe, Malawi',
        '+265 99 123 4567',
        'office@livingfaithportal.org',
        'Senior Pastor',
        ''
      );
    `);
  }

  // Seed Admin if not exists
  const adminCount = db.exec("SELECT COUNT(*) FROM admin_users");
  if (!adminCount[0]?.values[0]?.[0]) {
    db.run(`
      INSERT INTO admin_users (username, password_hash, role, name)
      VALUES ('admin', 'LivingFaith2026!', 'super_admin', 'Pastor David Sterling');
    `);
  } else {
    try {
      db.run(`UPDATE admin_users SET password_hash = 'LivingFaith2026!' WHERE username = 'admin' AND password_hash = 'GraceChurch2026!'`);
    } catch {}
  }

  // Ensure church settings logo is valid
  try {
    db.run("UPDATE church_settings SET logo_url = '/living-faith-logo.svg' WHERE logo_url IS NULL OR logo_url = '' OR logo_url LIKE '%example.com%'");
  } catch {}

  // Seed Branches if not exists
  const branchCount = db.exec("SELECT COUNT(*) FROM branches");
  if (!branchCount[0]?.values[0]?.[0]) {
    db.run(`
      INSERT INTO branches (name, code, currency_symbol, currency_code, default_monthly_due, address)
      VALUES 
      ('Lilongwe Branch (Malawi)', 'LLW', 'MK', 'MWK', 5000.00, 'Area 47, Sector 3, Lilongwe, Malawi'),
      ('Blantyre Branch (Malawi)', 'BT', 'MK', 'MWK', 5000.00, 'Victoria Avenue, Blantyre, Malawi'),
      ('Nkhatabay Branch (Malawi)', 'NKB', 'MK', 'MWK', 3000.00, 'Boma Center, Nkhatabay, Malawi'),
      ('Cape Town Branch (South Africa)', 'CPT', 'R', 'ZAR', 150.00, 'Foreshore, Cape Town, 8001, South Africa');
    `);
  }

  // Seed Members if not exists
  const membersCount = db.exec("SELECT COUNT(*) FROM members");
  if (!membersCount[0]?.values[0]?.[0]) {
    db.run(`
      INSERT INTO members (member_number, title, first_name, surname, full_name, phone, email, branch_id, join_date, monthly_due_amount, has_monthly_dues, has_kingdom_investment, kingdom_investment_amount, status)
      VALUES
      ('CPT-1001', 'Brother', 'Shepherd', 'Phiri', 'Shepherd Phiri', '+27 82 123 4567', 'shepherd.phiri@email.com', 4, '2026-09-01', 150.0, 1, 0, 0, 'green'),
      ('LLW-1001', 'Brother', 'John', 'Banda', 'John Banda', '+265991234567', 'john.banda@email.com', 1, '2026-09-01', 5000.0, 1, 0, 0, 'green'),
      ('LLW-1002', 'Brother', 'Samuel', 'Phiri', 'Samuel Phiri', '+265999887766', 'samuel.phiri@email.com', 1, '2026-09-01', 5000.0, 1, 1, 10000.0, 'green'),
      ('LLW-1003', 'Sister', 'Grace', 'Chisale', 'Grace Chisale', '+265888112233', 'grace.chisale@email.com', 1, '2026-09-01', 5000.0, 1, 0, 0, 'green'),
      ('LLW-1004', 'Sister', 'Tendai', 'Moyo', 'Tendai Moyo', '+26599445566', 'tendai.moyo@email.com', 1, '2026-09-01', 5000.0, 1, 0, 0, 'orange');
    `);
  }

  // Seed Contributions if not exists
  const contribCount = db.exec("SELECT COUNT(*) FROM contributions");
  if (!contribCount[0]?.values[0]?.[0]) {
    try {
      const cptMember = db.exec("SELECT id FROM members WHERE member_number = 'CPT-1001'")[0]?.values[0]?.[0] || 1;
      const llw1 = db.exec("SELECT id FROM members WHERE member_number = 'LLW-1001'")[0]?.values[0]?.[0] || 2;
      const llw2 = db.exec("SELECT id FROM members WHERE member_number = 'LLW-1002'")[0]?.values[0]?.[0] || 3;
      const llw3 = db.exec("SELECT id FROM members WHERE member_number = 'LLW-1003'")[0]?.values[0]?.[0] || 4;
      const llw4 = db.exec("SELECT id FROM members WHERE member_number = 'LLW-1004'")[0]?.values[0]?.[0] || 5;

      db.run(`
        INSERT INTO contributions (member_id, category, amount, date, for_month, payment_method, receipt_no, notes, verified)
        VALUES
        (${cptMember}, 'membership_fee', 150.0, '2026-09-05', '2026-09', 'bank_transfer', 'REC-2026-09101', 'September 2026 Monthly Dues', 1),
        (${llw1}, 'membership_fee', 5000.0, '2026-09-06', '2026-09', 'mobile_money', 'REC-2026-09102', 'September 2026 Monthly Dues', 1),
        (${llw2}, 'membership_fee', 5000.0, '2026-09-07', '2026-09', 'mobile_money', 'REC-2026-09103', 'September 2026 Monthly Dues', 1),
        (${llw3}, 'membership_fee', 5000.0, '2026-09-08', '2026-09', 'cash', 'REC-2026-09104', 'September 2026 Monthly Dues', 1),
        (${llw4}, 'membership_fee', 5000.0, '2026-08-15', '2026-08', 'cash', 'REC-2026-08105', 'August 2026 Monthly Dues', 1);
      `);

      // Update statuses
      db.run(`UPDATE members SET status = 'green' WHERE id IN (${cptMember}, ${llw1}, ${llw2}, ${llw3})`);
      db.run(`UPDATE members SET status = 'orange' WHERE id = ${llw4}`);
    } catch (e) {
      console.warn('Could not seed contributions:', e);
    }
  }

  // Seed Events if not exists
  const eventsCount = db.exec("SELECT COUNT(*) FROM events");
  if (!eventsCount[0]?.values[0]?.[0]) {
    db.run(`
      INSERT INTO events (title, description, category, start_date, location, target_ministry, is_published)
      VALUES
      ('NIGHT OF WORSHIP', 'An evening of prophetic praise, deep worship, and spiritual renewal for all saints.', 'service', '2026-10-05 18:00', 'Main Sanctuary', 'All Members', 1),
      ('Living Faith Sunday Celebration Service', 'Glorious Sunday morning gathering with communion and the prophetic word of faith.', 'service', '2026-10-04 09:00', 'Cathedral Sanctuary', 'General Congregation', 1);
    `);
  }

  saveDatabase();
}

// Helper functions for queries
export async function queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return results;
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const items = await queryAll<T>(sql, params);
  return items.length > 0 ? items[0] : null;
}

export async function runExec(sql: string, params: any[] = []): Promise<{ lastInsertId: number; changes: number }> {
  const db = await getDb();
  db.run(sql, params);
  const lastIdRes = db.exec("SELECT last_insert_rowid() as id");
  const lastId = lastIdRes.length > 0 && lastIdRes[0].values.length > 0 ? (lastIdRes[0].values[0][0] as number) : 0;
  saveDatabase();
  return { lastInsertId: lastId, changes: 1 };
}

// Generate unique branch-based ID: e.g. HRE-1002, MS-1005
export async function generateBranchMemberId(branchCode: string): Promise<string> {
  const cleanCode = branchCode.trim().toUpperCase();
  // Find highest existing number for this branch code
  const existing = await queryAll<{ member_number: string }>(
    `SELECT member_number FROM members WHERE member_number LIKE ?`,
    [`${cleanCode}-%`]
  );

  let maxNum = 1000;
  for (const m of existing) {
    const parts = m.member_number.split('-');
    if (parts.length >= 2) {
      const parsed = parseInt(parts[1]);
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `${cleanCode}-${nextNum}`;
}

// Compute dynamic status based on contributions
export async function updateAndGetMemberStatus(memberId: number): Promise<'green' | 'orange' | 'red'> {
  const currentMonth = '2026-09';
  const prevMonth = '2026-08';
  
  const currentDues = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM contributions WHERE member_id = ? AND category = 'membership_fee' AND for_month = ?`,
    [memberId, currentMonth]
  );
  
  const prevDues = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM contributions WHERE member_id = ? AND category = 'membership_fee' AND for_month = ?`,
    [memberId, prevMonth]
  );

  let calculatedStatus: 'green' | 'orange' | 'red' = 'green';
  const hasCurrent = currentDues && currentDues.count > 0;
  const hasPrev = prevDues && prevDues.count > 0;

  if (hasCurrent) {
    calculatedStatus = 'green';
  } else if (hasPrev) {
    calculatedStatus = 'orange';
  } else {
    calculatedStatus = 'red';
  }

  await runExec(`UPDATE members SET status = ? WHERE id = ?`, [calculatedStatus, memberId]);
  return calculatedStatus;
}

export async function getMemberPaidMonths(memberId: number, year: string = '2026'): Promise<string[]> {
  const rows = await queryAll<{ for_month: string }>(
    `SELECT DISTINCT for_month FROM contributions WHERE member_id = ? AND category = 'membership_fee' AND for_month LIKE ? ORDER BY for_month ASC`,
    [memberId, `${year}-%`]
  );
  return rows.map((r) => r.for_month).filter(Boolean);
}
