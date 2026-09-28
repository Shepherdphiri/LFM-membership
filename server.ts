import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  getDb,
  queryAll,
  queryOne,
  runExec,
  updateAndGetMemberStatus,
  generateBranchMemberId,
  getMemberPaidMonths,
  Member,
  Branch,
  Contribution,
  NotificationItem,
  ChurchEvent,
  ChurchSettings,
} from './server/db.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize SQLite database on startup
getDb().catch((err) => {
  console.error('Failed to initialize SQLite database:', err);
});

// Helper for generating receipt numbers
function generateReceiptNumber(): string {
  const seq = Math.floor(1000 + Math.random() * 9000);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `REC-${year}-${month}${seq}`;
}

// ==========================================
// PUBLIC ENDPOINTS: BRANCHES & REGISTRATION
// ==========================================

// Get all active branches (for registration dropdown and branch directory)
app.get('/api/branches', async (req, res) => {
  try {
    const branches = await queryAll<Branch>(`SELECT * FROM branches ORDER BY name ASC`);
    res.json(branches);
  } catch (err) {
    console.error('Error fetching branches:', err);
    res.status(500).json({ error: 'Failed to fetch church branches' });
  }
});

// Get configured church profile & details (public)
app.get('/api/church-settings', async (req, res) => {
  try {
    const settings = await queryOne<ChurchSettings>(`SELECT * FROM church_settings WHERE id = 1`);
    if (!settings) {
      return res.json({
        id: 1,
        church_name: 'Living Faith Membership Portal',
        tagline: 'Living Faith International Assemblies • Stewardship & Member Records',
        logo_url: '',
        address: 'Living Faith Cathedral Campus, Lilongwe, Malawi',
        phone: '+265 99 123 4567',
        email: 'office@livingfaithportal.org',
        senior_pastor: 'Senior Pastor',
        tax_id: '',
      });
    }
    res.json(settings);
  } catch (err) {
    console.error('Error fetching church settings:', err);
    res.status(500).json({ error: 'Failed to fetch church details' });
  }
});

// First-time member registration (Title, Name, Surname, Phone number, Church branch, Photo, Commitments)
app.post('/api/member/register', async (req, res) => {
  try {
    const {
      title,
      name,
      surname,
      phone,
      email,
      branchId,
      photoUrl,
      hasMonthlyDues,
      hasKingdomInvestment,
      kingdomInvestmentAmount,
    } = req.body;

    if (!name?.trim() || !surname?.trim() || !phone?.trim() || !branchId) {
      return res.status(400).json({
        error: 'Please fill in Title, First Name, Surname, Phone number, and select your Church Branch.',
      });
    }

    const branch = await queryOne<Branch>(`SELECT * FROM branches WHERE id = ?`, [branchId]);
    if (!branch) {
      return res.status(404).json({ error: 'Selected church branch was not found.' });
    }

    // Generate unique ID based on branch code (e.g. HRE-1002, MS-1005)
    const memberNumber = await generateBranchMemberId(branch.code);
    const fullName = `${name.trim()} ${surname.trim()}`;
    const today = new Date().toISOString().split('T')[0];

    const result = await runExec(
      `INSERT INTO members (
        member_number, title, first_name, surname, full_name, phone, email, photo_url,
        branch_id, join_date, monthly_due_amount, has_monthly_dues, has_kingdom_investment, kingdom_investment_amount, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'orange')`,
      [
        memberNumber,
        title || 'Brother',
        name.trim(),
        surname.trim(),
        fullName,
        phone.trim(),
        email?.trim() || '',
        photoUrl || '',
        branch.id,
        today,
        branch.default_monthly_due,
        1, // Monthly dues is compulsory!
        hasKingdomInvestment ? 1 : 0,
        parseFloat(kingdomInvestmentAmount) || 0,
      ]
    );

    // Welcome notification
    await runExec(
      `INSERT INTO notifications (member_id, title, message, type)
       VALUES (?, ?, ?, 'announcement')`,
      [
        result.lastInsertId,
        `Welcome to ${branch.name}`,
        `Your unique Membership ID is ${memberNumber}. Your monthly dues commitment is set to ${branch.currency_symbol}${branch.default_monthly_due.toFixed(2)}/mo${hasKingdomInvestment ? ` and Kingdom Investment commitment is active` : ''}. Use this ID anytime to view your digital ID card, stewardship progress, and church events.`,
      ]
    );

    res.json({
      success: true,
      memberNumber,
      message: `Registration successful! Your unique ID is ${memberNumber}.`,
    });
  } catch (err) {
    console.error('Error registering member:', err);
    res.status(500).json({ error: 'Failed to register membership.' });
  }
});

// ==========================================
// PUBLIC MEMBER DASHBOARD (Read-Only By ID)
// ==========================================

// Lookup member dashboard by unique ID (e.g. MS-1001, HRE-1001, JHB-1001, LON-1001)
app.get('/api/member/lookup/:memberNumber', async (req, res) => {
  try {
    const rawNumber = req.params.memberNumber.trim().toUpperCase();
    if (!rawNumber) {
      return res.status(400).json({ error: 'Membership ID is required.' });
    }

    // Join with branches table to get currency symbol & code
    const member = await queryOne<any>(
      `SELECT m.*, b.name as branch_name, b.code as branch_code, b.currency_symbol, b.currency_code
       FROM members m
       JOIN branches b ON m.branch_id = b.id
       WHERE UPPER(m.member_number) = ?`,
      [rawNumber]
    );

    if (!member) {
      return res.status(404).json({
        error: `Member with ID "${rawNumber}" not found. If this is your first time, please use the Register tab to create your account.`,
      });
    }

    // Refresh dynamic status
    const currentStatus = await updateAndGetMemberStatus(member.id);
    member.status = currentStatus;

    // Contributions ledger (with dates)
    const contributions = await queryAll<Contribution>(
      `SELECT * FROM contributions WHERE member_id = ? ORDER BY date DESC, id DESC`,
      [member.id]
    );

    // Paid dues months (e.g. for year 2026)
    const paidMonths = await getMemberPaidMonths(member.id, '2026');

    // Summary calculation
    let totalDues = 0;
    let totalKingdomInvestment = 0;
    let totalSpecial = 0;
    const currentMonth = '2026-09';
    const currentMonthDuesPaid = paidMonths.includes(currentMonth);

    for (const c of contributions) {
      if (c.category === 'membership_fee') {
        totalDues += c.amount;
      } else if (c.category === 'kingdom_investment') {
        totalKingdomInvestment += c.amount;
      } else {
        totalSpecial += c.amount;
      }
    }

    const totalAllTime = totalDues + totalKingdomInvestment + totalSpecial;

    // Upcoming church events & services (organized by dates)
    const upcomingEvents = await queryAll<ChurchEvent>(
      `SELECT * FROM events WHERE is_published = 1 ORDER BY start_date ASC LIMIT 10`
    );

    // In-app notifications
    const notifications = await queryAll<NotificationItem>(
      `SELECT * FROM notifications 
       WHERE (member_id = ? OR member_id IS NULL) 
       ORDER BY created_at DESC LIMIT 10`,
      [member.id]
    );

    // Status explanation text
    let statusReason = '';
    if (currentStatus === 'green') {
      statusReason = 'Account in Good Standing: Monthly membership dues are current and contributions are active.';
    } else if (currentStatus === 'orange') {
      statusReason = `Monthly Dues Pending: September 2026 dues (${member.currency_symbol}${member.monthly_due_amount.toFixed(2)}) pending offline receipt.`;
    } else {
      statusReason = 'Account Overdue: Membership fees have not been received for 2 or more consecutive months.';
    }

    // Church settings
    const churchSettings = await queryOne<ChurchSettings>(`SELECT * FROM church_settings WHERE id = 1`);

    res.json({
      member,
      status: currentStatus,
      statusReason,
      currencySymbol: member.currency_symbol || '$',
      currencyCode: member.currency_code || 'USD',
      settings: churchSettings || undefined,
      paidMonths,
      summary: {
        totalDues,
        totalKingdomInvestment,
        totalSpecial,
        totalAllTime,
        currentYearTotal: totalAllTime,
        currentMonthDuesPaid,
        monthlyDueAmount: member.monthly_due_amount,
      },
      contributions,
      upcomingEvents,
      notifications,
    });
  } catch (error) {
    console.error('Error looking up member:', error);
    res.status(500).json({ error: 'Internal database error.' });
  }
});

// Mark notifications as read
app.post('/api/member/mark-notifications-read', async (req, res) => {
  try {
    const { memberId, notificationIds } = req.body;
    if (notificationIds && Array.isArray(notificationIds) && notificationIds.length > 0) {
      const placeholders = notificationIds.map(() => '?').join(',');
      await runExec(
        `UPDATE notifications SET is_read = 1 WHERE id IN (${placeholders})`,
        notificationIds
      );
    } else if (memberId) {
      await runExec(
        `UPDATE notifications SET is_read = 1 WHERE member_id = ? OR member_id IS NULL`,
        [memberId]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// ==========================================
// ADMIN PORTAL ENDPOINTS (Secure / Protected)
// ==========================================

const ADMIN_TOKEN = 'grace-admin-secure-token-2026-auth';

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }

  const admin = await queryOne<any>(
    `SELECT * FROM admin_users WHERE username = ? AND password_hash = ?`,
    [username.trim(), password]
  );

  if (!admin) {
    return res.status(401).json({ error: 'Invalid administrator credentials.' });
  }

  res.json({
    success: true,
    token: ADMIN_TOKEN,
    user: {
      username: admin.username,
      name: admin.name,
      role: admin.role,
    },
  });
});

// Auth Middleware
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.includes(ADMIN_TOKEN)) {
    return res.status(403).json({ error: 'Unauthorized administrator access.' });
  }
  next();
};

// Admin overview stats
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const members = await queryAll<any>(`
      SELECT m.*, b.name as branch_name, b.code as branch_code, b.currency_symbol, b.currency_code
      FROM members m
      JOIN branches b ON m.branch_id = b.id
    `);

    for (const m of members) {
      m.status = await updateAndGetMemberStatus(m.id);
    }

    const greenCount = members.filter((m) => m.status === 'green').length;
    const orangeCount = members.filter((m) => m.status === 'orange').length;
    const redCount = members.filter((m) => m.status === 'red').length;

    const branches = await queryAll<Branch>(`SELECT * FROM branches ORDER BY name ASC`);

    const overdueMembers = members.filter((m) => m.status === 'red' || m.status === 'orange');

    const recentContributions = await queryAll<any>(`
      SELECT c.*, m.full_name as member_name, m.member_number, b.currency_symbol
      FROM contributions c
      JOIN members m ON c.member_id = m.id
      JOIN branches b ON m.branch_id = b.id
      ORDER BY c.date DESC, c.id DESC
      LIMIT 10
    `);

    res.json({
      membersCount: members.length,
      greenCount,
      orangeCount,
      redCount,
      branchesCount: branches.length,
      branches,
      overdueMembers,
      recentContributions,
    });
  } catch (err) {
    console.error('Error fetching admin stats:', err);
    res.status(500).json({ error: 'Failed to retrieve admin stats' });
  }
});

// Admin Branch Management (Create & Edit Branch with Currency)
app.get('/api/admin/branches', requireAdmin, async (req, res) => {
  try {
    const branches = await queryAll<any>(`
      SELECT b.*, COUNT(m.id) as member_count
      FROM branches b
      LEFT JOIN members m ON b.id = m.branch_id
      GROUP BY b.id
      ORDER BY b.name ASC
    `);
    res.json(branches);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
});

app.post('/api/admin/branches', requireAdmin, async (req, res) => {
  try {
    const { name, code, currency_symbol, currency_code, default_monthly_due, address } = req.body;
    if (!name?.trim() || !code?.trim()) {
      return res.status(400).json({ error: 'Branch name and Branch Code (e.g. HRE, NYC) are required.' });
    }

    const cleanCode = code.trim().toUpperCase();
    const cleanSym = currency_symbol?.trim() || '$';
    const cleanCurrCode = currency_code?.trim().toUpperCase() || 'USD';
    const due = parseFloat(default_monthly_due) || 20.0;

    const result = await runExec(
      `INSERT INTO branches (name, code, currency_symbol, currency_code, default_monthly_due, address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), cleanCode, cleanSym, cleanCurrCode, due, address?.trim() || '']
    );

    res.json({
      success: true,
      branch: {
        id: result.lastInsertId,
        name: name.trim(),
        code: cleanCode,
        currency_symbol: cleanSym,
        currency_code: cleanCurrCode,
        default_monthly_due: due,
        address: address?.trim() || '',
      },
    });
  } catch (err: any) {
    console.error('Error creating branch:', err);
    res.status(500).json({ error: 'Failed to create branch. Code or name may already exist.' });
  }
});

app.put('/api/admin/branches/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, code, currency_symbol, currency_code, default_monthly_due, address } = req.body;

    await runExec(
      `UPDATE branches
       SET name = ?, code = ?, currency_symbol = ?, currency_code = ?, default_monthly_due = ?, address = ?
       WHERE id = ?`,
      [
        name.trim(),
        code.trim().toUpperCase(),
        currency_symbol?.trim() || '$',
        currency_code?.trim().toUpperCase() || 'USD',
        parseFloat(default_monthly_due) || 20.0,
        address?.trim() || '',
        id,
      ]
    );

    res.json({ success: true, message: 'Branch and currency settings updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update branch' });
  }
});

// Admin Church Settings & Logo Configuration
app.get('/api/admin/church-settings', requireAdmin, async (req, res) => {
  try {
    const settings = await queryOne<ChurchSettings>(`SELECT * FROM church_settings WHERE id = 1`);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch church settings' });
  }
});

app.put('/api/admin/church-settings', requireAdmin, async (req, res) => {
  try {
    const { church_name, tagline, logo_url, address, phone, email, senior_pastor, tax_id } = req.body;
    if (!church_name?.trim()) {
      return res.status(400).json({ error: 'Church name is required.' });
    }

    await runExec(
      `UPDATE church_settings
       SET church_name = ?, tagline = ?, logo_url = ?, address = ?, phone = ?, email = ?, senior_pastor = ?, tax_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`,
      [
        church_name.trim(),
        tagline?.trim() || '',
        logo_url?.trim() || '',
        address?.trim() || '',
        phone?.trim() || '',
        email?.trim() || '',
        senior_pastor?.trim() || '',
        tax_id?.trim() || '',
      ]
    );

    const updated = await queryOne<ChurchSettings>(`SELECT * FROM church_settings WHERE id = 1`);
    res.json({ success: true, settings: updated, message: 'Church details & branding updated successfully.' });
  } catch (err) {
    console.error('Error updating church settings:', err);
    res.status(500).json({ error: 'Failed to update church settings' });
  }
});

// Admin Member Directory
app.get('/api/admin/members', requireAdmin, async (req, res) => {
  try {
    const { search, status, branchId } = req.query;
    let sql = `
      SELECT m.*, b.name as branch_name, b.code as branch_code, b.currency_symbol, b.currency_code
      FROM members m
      JOIN branches b ON m.branch_id = b.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      sql += ` AND (m.full_name LIKE ? OR m.member_number LIKE ? OR m.phone LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    if (status && status !== 'all') {
      sql += ` AND m.status = ?`;
      params.push(status);
    }
    if (branchId && branchId !== 'all') {
      sql += ` AND m.branch_id = ?`;
      params.push(parseInt(branchId as string));
    }

    sql += ` ORDER BY m.full_name ASC`;
    const members = await queryAll<any>(sql, params);

    const enriched = await Promise.all(
      members.map(async (m) => {
        const currentStatus = await updateAndGetMemberStatus(m.id);
        const paidMonths = await getMemberPaidMonths(m.id, '2026');
        const totals = await queryOne<any>(
          `SELECT 
            SUM(CASE WHEN category = 'membership_fee' THEN amount ELSE 0 END) as dues,
            SUM(CASE WHEN category = 'kingdom_investment' THEN amount ELSE 0 END) as kingdom,
            SUM(amount) as total
           FROM contributions WHERE member_id = ?`,
          [m.id]
        );
        return {
          ...m,
          status: currentStatus,
          paid_months: paidMonths,
          totals: {
            dues: totals?.dues || 0,
            kingdom: totals?.kingdom || 0,
            total: totals?.total || 0,
          },
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Admin Monthly Dues Management: Get Member Paid Months for year
app.get('/api/admin/members/:id/dues-months', requireAdmin, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    const year = (req.query.year as string) || '2026';
    const member = await queryOne<any>(
      `SELECT m.*, b.name as branch_name, b.code as branch_code, b.currency_symbol, b.currency_code
       FROM members m
       JOIN branches b ON m.branch_id = b.id
       WHERE m.id = ?`,
      [memberId]
    );
    if (!member) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    const currentStatus = await updateAndGetMemberStatus(memberId);
    const paidMonths = await getMemberPaidMonths(memberId, year);
    res.json({
      member: { ...member, status: currentStatus },
      paidMonths,
      year,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dues months' });
  }
});

// Admin Monthly Dues: Tick / Toggle month covered
app.post('/api/admin/members/:id/toggle-month', requireAdmin, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    const { month, paid } = req.body; // month format: 'YYYY-MM'
    if (!month || !month.includes('-')) {
      return res.status(400).json({ error: 'Valid Month (YYYY-MM) is required.' });
    }

    const member = await queryOne<any>(
      `SELECT m.*, b.currency_symbol FROM members m JOIN branches b ON m.branch_id = b.id WHERE m.id = ?`,
      [memberId]
    );
    if (!member) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    const existing = await queryOne<any>(
      `SELECT id FROM contributions WHERE member_id = ? AND category = 'membership_fee' AND for_month = ?`,
      [memberId, month]
    );

    let isNowPaid = false;
    if (paid === true || (paid === undefined && !existing)) {
      // Mark as covered/paid
      if (!existing) {
        const receiptNo = generateReceiptNumber();
        const today = new Date().toISOString().split('T')[0];
        await runExec(
          `INSERT INTO contributions (member_id, category, amount, date, for_month, payment_method, receipt_no, notes, verified)
           VALUES (?, 'membership_fee', ?, ?, ?, 'Offline Verified Dues', ?, 'Marked as covered by church administrator', 1)`,
          [memberId, member.monthly_due_amount, today, month, receiptNo]
        );
      }
      isNowPaid = true;
    } else {
      // Un-tick / Mark as unpaid
      if (existing) {
        await runExec(`DELETE FROM contributions WHERE id = ?`, [existing.id]);
      }
      isNowPaid = false;
    }

    // Refresh traffic light status immediately
    const newStatus = await updateAndGetMemberStatus(memberId);
    const year = month.split('-')[0];
    const paidMonths = await getMemberPaidMonths(memberId, year);

    res.json({
      success: true,
      isPaid: isNowPaid,
      month,
      newStatus,
      paidMonths,
      message: `${member.full_name}: ${month} marked as ${isNowPaid ? 'Covered / Paid' : 'Pending / Unpaid'}.`
    });
  } catch (err) {
    console.error('Error toggling member month dues:', err);
    res.status(500).json({ error: 'Failed to update member dues status' });
  }
});

// Admin Mark All Months Through Current Month (e.g. up to 2026-09)
app.post('/api/admin/members/:id/mark-through-month', requireAdmin, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    const { throughMonth } = req.body; // e.g. '2026-09'
    const target = throughMonth || '2026-09';
    const [yearStr, monthStr] = target.split('-');
    const year = yearStr || '2026';
    const endMonth = parseInt(monthStr) || 9;

    const member = await queryOne<any>(
      `SELECT m.*, b.currency_symbol FROM members m JOIN branches b ON m.branch_id = b.id WHERE m.id = ?`,
      [memberId]
    );
    if (!member) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    const today = new Date().toISOString().split('T')[0];
    for (let m = 1; m <= endMonth; m++) {
      const mStr = `${year}-${String(m).padStart(2, '0')}`;
      const existing = await queryOne<any>(
        `SELECT id FROM contributions WHERE member_id = ? AND category = 'membership_fee' AND for_month = ?`,
        [memberId, mStr]
      );
      if (!existing) {
        const receiptNo = generateReceiptNumber();
        await runExec(
          `INSERT INTO contributions (member_id, category, amount, date, for_month, payment_method, receipt_no, notes, verified)
           VALUES (?, 'membership_fee', ?, ?, ?, 'Offline Verified Dues', ?, 'Marked through current month by church administrator', 1)`,
          [memberId, member.monthly_due_amount, today, mStr, receiptNo]
        );
      }
    }

    const newStatus = await updateAndGetMemberStatus(memberId);
    const paidMonths = await getMemberPaidMonths(memberId, year);

    res.json({
      success: true,
      newStatus,
      paidMonths,
      message: `${member.full_name} marked as paid through ${target}.`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark through month' });
  }
});

// Admin Events Management (CRUD)
app.get('/api/admin/events', requireAdmin, async (req, res) => {
  try {
    const events = await queryAll<ChurchEvent>(`SELECT * FROM events ORDER BY start_date DESC`);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load events' });
  }
});

app.post('/api/admin/events', requireAdmin, async (req, res) => {
  try {
    const { title, description, category, start_date, end_date, location, target_ministry } = req.body;
    if (!title || !start_date || !location) {
      return res.status(400).json({ error: 'Title, start date, and location are required.' });
    }

    const result = await runExec(
      `INSERT INTO events (title, description, category, start_date, end_date, location, target_ministry, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [title.trim(), description || '', category || 'service', start_date, end_date || null, location.trim(), target_ministry || 'General Congregation']
    );

    res.json({ success: true, eventId: result.lastInsertId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create event' });
  }
});

app.put('/api/admin/events/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, description, category, start_date, end_date, location, target_ministry } = req.body;

    await runExec(
      `UPDATE events 
       SET title = ?, description = ?, category = ?, start_date = ?, end_date = ?, location = ?, target_ministry = ?
       WHERE id = ?`,
      [title, description, category, start_date, end_date || null, location, target_ministry, id]
    );

    res.json({ success: true, message: 'Event updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

app.delete('/api/admin/events/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await runExec(`DELETE FROM events WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Event deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Admin Broadcast Notification
app.post('/api/admin/notifications/broadcast', requireAdmin, async (req, res) => {
  try {
    const { member_id, title, message } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message required.' });
    }

    await runExec(
      `INSERT INTO notifications (member_id, title, message, type)
       VALUES (?, ?, ?, 'announcement')`,
      [member_id || null, title, message]
    );

    res.json({ success: true, message: 'Notification broadcast successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to broadcast notification' });
  }
});

// Setup Vite or static files
async function setupApp() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Church Portal running at http://0.0.0.0:${PORT}`);
  });
}

setupApp().catch((err) => {
  console.error('Failed to start server:', err);
});
