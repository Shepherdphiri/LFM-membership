import {
  Branch,
  Member,
  Contribution,
  NotificationItem,
  ChurchEvent,
  ChurchSettings,
  MemberDashboardData,
  AdminStats,
  AdminMemberListItem,
  TrafficLightStatus,
} from '../types';
import { cloudDb, CloudDbConfig, SyncPayload } from './cloudDb';

export const ADMIN_TOKEN = 'grace-admin-secure-token-2026-auth';

interface LocalDatabase {
  branches: Branch[];
  members: Member[];
  contributions: Contribution[];
  events: ChurchEvent[];
  notifications: NotificationItem[];
  settings: ChurchSettings;
  adminUser: {
    username: string;
    passwordHash: string;
    role: string;
    name: string;
  };
}

const STORAGE_KEY = 'living_faith_clean_v5';

const INITIAL_BRANCHES: Branch[] = [
  {
    id: 1,
    name: 'Lilongwe Branch (Malawi)',
    code: 'LLW',
    currency_symbol: 'MK',
    currency_code: 'MWK',
    default_monthly_due: 5000.0,
    address: 'Area 47, Sector 3, Lilongwe, Malawi',
    created_at: '2026-01-01',
  },
  {
    id: 2,
    name: 'Blantyre Branch (Malawi)',
    code: 'BT',
    currency_symbol: 'MK',
    currency_code: 'MWK',
    default_monthly_due: 5000.0,
    address: 'Victoria Avenue, Blantyre, Malawi',
    created_at: '2026-01-01',
  },
  {
    id: 3,
    name: 'Nkhatabay Branch (Malawi)',
    code: 'NKB',
    currency_symbol: 'MK',
    currency_code: 'MWK',
    default_monthly_due: 3000.0,
    address: 'Boma Center, Nkhatabay, Malawi',
    created_at: '2026-01-01',
  },
  {
    id: 4,
    name: 'Cape Town Branch (South Africa)',
    code: 'CPT',
    currency_symbol: 'R',
    currency_code: 'ZAR',
    default_monthly_due: 150.0,
    address: 'Foreshore, Cape Town, 8001, South Africa',
    created_at: '2026-01-01',
  },
];

const INITIAL_MEMBERS: Member[] = [];

const INITIAL_CONTRIBUTIONS: Contribution[] = [];

const INITIAL_EVENTS: ChurchEvent[] = [];

const INITIAL_SETTINGS: ChurchSettings = {
  id: 1,
  church_name: 'Living Faith Membership Portal',
  tagline: 'Living Faith International Assemblies • Stewardship & Member Records',
  logo_url: '',
  address: 'Living Faith Cathedral Campus, Lilongwe, Malawi',
  phone: '+265 99 123 4567',
  email: 'office@livingfaithportal.org',
  senior_pastor: 'Senior Pastor',
  tax_id: '',
  updated_at: '2026-09-28',
};

const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

class LocalChurchStore {
  private db: LocalDatabase;

  constructor() {
    this.db = this.load();

    // Listen for real-time remote updates from the free Cloud Database
    cloudDb.onRemoteDataReceived((remoteData) => {
      this.mergeRemoteData(remoteData);
    });

    // Initial pull from cloud so data synced on another device is immediately loaded
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        cloudDb.pullFromCloud().catch(() => {});
      }, 200);
    }
  }

  private load(): LocalDatabase {
    // Clear old test caches from earlier sessions
    try {
      localStorage.removeItem('living_faith_clean_portal_v4');
      localStorage.removeItem('living_faith_church_store_v2');
      localStorage.removeItem('living_faith_portal_clean_v3');
      localStorage.removeItem('grace_church_db_v2');
      localStorage.removeItem('grace_church_store_v1');
    } catch (_) {}

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        let modified = false;
        if (!parsed.settings || !parsed.settings.church_name || parsed.settings.church_name.includes('GracePoint')) {
          parsed.settings = {
            ...INITIAL_SETTINGS,
            ...(parsed.settings || {}),
            church_name: 'Living Faith Membership Portal',
            tagline: 'Living Faith International Assemblies • Stewardship & Member Records',
          };
          modified = true;
        }
        if (!parsed.branches || parsed.branches.length !== 4 || !parsed.branches.some((b: Branch) => b.name.includes('Lilongwe'))) {
          parsed.branches = INITIAL_BRANCHES;
          modified = true;
        }
        // Purge any lingering demo seed members
        if (parsed.members && parsed.members.some((m: Member) => m.member_number === 'LLW-1001' && m.first_name === 'Emmanuel')) {
          parsed.members = [];
          parsed.contributions = [];
          parsed.events = [];
          parsed.notifications = [];
          modified = true;
        }
        if (modified) {
          this.save(parsed, true);
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to load local store from localStorage:', e);
    }

    const defaultDb: LocalDatabase = {
      branches: INITIAL_BRANCHES,
      members: INITIAL_MEMBERS,
      contributions: INITIAL_CONTRIBUTIONS,
      events: INITIAL_EVENTS,
      notifications: INITIAL_NOTIFICATIONS,
      settings: INITIAL_SETTINGS,
      adminUser: {
        username: 'admin',
        passwordHash: 'GraceChurch2026!',
        role: 'super_admin',
        name: 'Senior Pastor',
      },
    };
    this.save(defaultDb, true);
    return defaultDb;
  }

  public clearAllDataAndReset(): void {
    this.db = {
      branches: INITIAL_BRANCHES,
      members: [],
      contributions: [],
      events: [],
      notifications: [],
      settings: this.db.settings || INITIAL_SETTINGS,
      adminUser: this.db.adminUser,
    };
    this.save();
  }

  public mergeRemoteData(remote: SyncPayload) {
    let hasChanges = false;

    // 1. Merge members
    if (Array.isArray(remote.members)) {
      for (const remoteMember of remote.members) {
        if (!remoteMember || !remoteMember.member_number) continue;
        const cleanNum = remoteMember.member_number.trim().toUpperCase();
        const existingIdx = this.db.members.findIndex(
          (m) => m.member_number.trim().toUpperCase() === cleanNum
        );
        if (existingIdx === -1) {
          this.db.members.push(remoteMember);
          hasChanges = true;
        } else {
          const local = this.db.members[existingIdx];
          if (
            local.status !== remoteMember.status ||
            local.phone !== remoteMember.phone ||
            local.full_name !== remoteMember.full_name ||
            local.monthly_due_amount !== remoteMember.monthly_due_amount
          ) {
            this.db.members[existingIdx] = { ...local, ...remoteMember };
            hasChanges = true;
          }
        }
      }
    }

    // 2. Merge contributions
    if (Array.isArray(remote.contributions)) {
      for (const remoteContrib of remote.contributions) {
        if (!remoteContrib || !remoteContrib.receipt_no) continue;
        const exists = this.db.contributions.some(
          (c) => c.receipt_no === remoteContrib.receipt_no ||
                 (c.member_id === remoteContrib.member_id && c.for_month === remoteContrib.for_month && c.category === remoteContrib.category)
        );
        if (!exists) {
          this.db.contributions.push(remoteContrib);
          hasChanges = true;
        }
      }
    }

    // 3. Merge events
    if (Array.isArray(remote.events)) {
      for (const remoteEvent of remote.events) {
        if (!remoteEvent || !remoteEvent.title) continue;
        const exists = this.db.events.some(
          (e) => e.title === remoteEvent.title && e.start_date === remoteEvent.start_date
        );
        if (!exists) {
          this.db.events.push(remoteEvent);
          hasChanges = true;
        }
      }
    }

    // 4. Merge settings
    if (remote.settings && remote.settings.church_name) {
      if (!this.db.settings || !this.db.settings.updated_at || (remote.settings.updated_at && remote.settings.updated_at >= this.db.settings.updated_at)) {
        this.db.settings = { ...this.db.settings, ...remote.settings };
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.save(this.db, true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('church_store_updated'));
      }
    }
  }

  private save(data?: LocalDatabase, skipCloudPush = false) {
    try {
      const toSave = data || this.db;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));

      if (!skipCloudPush) {
        cloudDb.pushToCloud({
          branches: toSave.branches,
          members: toSave.members,
          contributions: toSave.contributions,
          events: toSave.events,
          notifications: toSave.notifications,
          settings: toSave.settings,
        }).catch((err) => {
          console.warn('Background Cloud push warning:', err);
        });
      }
    } catch (e) {
      console.warn('Failed to persist local store to localStorage:', e);
    }
  }

  private generateReceiptNo(): string {
    const seq = Math.floor(1000 + Math.random() * 9000);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `REC-${year}-${month}${seq}`;
  }

  public calculateMemberStatus(memberId: number): TrafficLightStatus {
    const currentMonth = '2026-09';
    const prevMonth = '2026-08';

    const hasCurrent = this.db.contributions.some(
      (c) => c.member_id === memberId && c.category === 'membership_fee' && c.for_month === currentMonth
    );
    if (hasCurrent) return 'green';

    const hasPrev = this.db.contributions.some(
      (c) => c.member_id === memberId && c.category === 'membership_fee' && c.for_month === prevMonth
    );
    if (hasPrev) return 'orange';

    return 'red';
  }

  public getPaidMonths(memberId: number, year: string = '2026'): string[] {
    return Array.from(
      new Set(
        this.db.contributions
          .filter(
            (c) =>
              c.member_id === memberId &&
              c.category === 'membership_fee' &&
              c.for_month &&
              c.for_month.startsWith(`${year}-`)
          )
          .map((c) => c.for_month!)
      )
    ).sort();
  }

  // --- ADMIN AUTH ---
  public validateAdminCredentials(username: string, password: string): boolean {
    const cleanUser = username.trim().toLowerCase();
    return cleanUser === this.db.adminUser.username.toLowerCase() && password === this.db.adminUser.passwordHash;
  }

  public getAdminSession() {
    return {
      success: true,
      token: ADMIN_TOKEN,
      user: {
        username: this.db.adminUser.username,
        name: this.db.adminUser.name,
        role: this.db.adminUser.role,
      },
    };
  }

  public adminLogin(username: string, password: string) {
    if (this.validateAdminCredentials(username, password)) {
      return this.getAdminSession();
    }
    throw new Error('Invalid administrator credentials.');
  }

  // --- BRANCHES ---
  public getBranches(): Branch[] {
    return [...this.db.branches].sort((a, b) => a.name.localeCompare(b.name));
  }

  public createBranch(data: Partial<Branch>): Branch {
    const id = this.db.branches.length ? Math.max(...this.db.branches.map((b) => b.id)) + 1 : 1;
    const newBranch: Branch = {
      id,
      name: data.name?.trim() || 'New Branch',
      code: (data.code?.trim() || 'BR').toUpperCase(),
      currency_symbol: data.currency_symbol?.trim() || '$',
      currency_code: (data.currency_code?.trim() || 'USD').toUpperCase(),
      default_monthly_due: Number(data.default_monthly_due) || 20.0,
      address: data.address?.trim() || '',
      created_at: new Date().toISOString(),
    };
    this.db.branches.push(newBranch);
    this.save();
    return newBranch;
  }

  public updateBranch(id: number, data: Partial<Branch>): Branch {
    const index = this.db.branches.findIndex((b) => b.id === id);
    if (index === -1) throw new Error('Branch not found');
    this.db.branches[index] = {
      ...this.db.branches[index],
      ...data,
      name: data.name?.trim() || this.db.branches[index].name,
      code: (data.code?.trim() || this.db.branches[index].code).toUpperCase(),
    };
    this.save();
    return this.db.branches[index];
  }

  // --- SETTINGS ---
  public getChurchSettings(): ChurchSettings {
    return { ...this.db.settings };
  }

  public updateChurchSettings(payload: Partial<ChurchSettings>): ChurchSettings {
    this.db.settings = {
      ...this.db.settings,
      ...payload,
      updated_at: new Date().toISOString(),
    };
    this.save();
    return this.db.settings;
  }

  // --- MEMBERS ---
  public registerMember(payload: {
    title: string;
    name: string;
    surname: string;
    phone: string;
    email?: string;
    branchId: number;
    photoUrl?: string;
    hasMonthlyDues?: boolean;
    hasKingdomInvestment?: boolean;
    kingdomInvestmentAmount?: number;
  }): { success: boolean; memberNumber: string; message: string } {
    const branch = this.db.branches.find((b) => b.id === payload.branchId);
    if (!branch) throw new Error('Selected church branch was not found.');

    // Generate unique ID based on branch code (e.g. HRE-1002)
    const existingCodeMembers = this.db.members.filter((m) => m.member_number.startsWith(`${branch.code}-`));
    let maxNum = 1000;
    for (const m of existingCodeMembers) {
      const parts = m.member_number.split('-');
      if (parts[1]) {
        const n = parseInt(parts[1], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    }
    const memberNumber = `${branch.code}-${maxNum + 1}`;
    const id = this.db.members.length ? Math.max(...this.db.members.map((m) => m.id)) + 1 : 1;
    const fullName = `${payload.name.trim()} ${payload.surname.trim()}`;
    const today = new Date().toISOString().split('T')[0];

    const newMember: Member = {
      id,
      member_number: memberNumber,
      title: payload.title || 'Brother',
      first_name: payload.name.trim(),
      surname: payload.surname.trim(),
      full_name: fullName,
      phone: payload.phone.trim(),
      email: payload.email?.trim() || '',
      photo_url: payload.photoUrl || '',
      branch_id: branch.id,
      branch_name: branch.name,
      branch_code: branch.code,
      currency_symbol: branch.currency_symbol,
      currency_code: branch.currency_code,
      join_date: today,
      monthly_due_amount: branch.default_monthly_due,
      has_monthly_dues: 1,
      has_kingdom_investment: payload.hasKingdomInvestment ? 1 : 0,
      kingdom_investment_amount: Number(payload.kingdomInvestmentAmount) || 0,
      status: 'orange',
      created_at: today,
    };

    this.db.members.push(newMember);

    // Welcome notification
    this.db.notifications.unshift({
      id: this.db.notifications.length ? Math.max(...this.db.notifications.map((n) => n.id)) + 1 : 1,
      member_id: id,
      title: `Welcome to ${branch.name}`,
      message: `Your unique Membership ID is ${memberNumber}. Your monthly dues commitment is set to ${branch.currency_symbol}${branch.default_monthly_due.toFixed(2)}/mo.`,
      type: 'announcement',
      is_read: 0,
      created_at: today,
    });

    this.save();

    return {
      success: true,
      memberNumber,
      message: `Registration successful! Your unique ID is ${memberNumber}.`,
    };
  }

  public lookupMember(memberNumber: string): MemberDashboardData {
    const cleanId = memberNumber.trim().toUpperCase();
    const member = this.db.members.find((m) => m.member_number.toUpperCase() === cleanId);
    if (!member) {
      throw new Error(`Member with ID "${cleanId}" not found. If this is your first time, please register.`);
    }

    const branch = this.db.branches.find((b) => b.id === member.branch_id);
    const currSym = branch?.currency_symbol || member.currency_symbol || '$';
    const currCode = branch?.currency_code || member.currency_code || 'USD';

    // Compute dynamic status
    const status = this.calculateMemberStatus(member.id);
    member.status = status;
    member.branch_name = branch?.name || member.branch_name;
    member.currency_symbol = currSym;
    member.currency_code = currCode;

    const contributions = this.db.contributions
      .filter((c) => c.member_id === member.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const paidMonths = this.getPaidMonths(member.id, '2026');

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

    let statusReason = '';
    if (status === 'green') {
      statusReason = 'Account in Good Standing: Monthly membership dues are current and contributions are active.';
    } else if (status === 'orange') {
      statusReason = `Monthly Dues Pending: September 2026 dues (${currSym}${member.monthly_due_amount.toFixed(2)}) pending offline receipt.`;
    } else {
      statusReason = 'Account Overdue: Membership fees have not been received for 2 or more consecutive months.';
    }

    const upcomingEvents = this.db.events
      .filter((e) => e.is_published)
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

    const notifications = this.db.notifications
      .filter((n) => n.member_id === member.id || n.member_id === null)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      member,
      status,
      statusReason,
      currencySymbol: currSym,
      currencyCode: currCode,
      settings: this.db.settings,
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
    };
  }

  public ensureMemberLocally(data: {
    memberNumber: string;
    title: string;
    name: string;
    surname: string;
    phone: string;
    email?: string;
    branchId: number;
    photoUrl?: string;
    hasMonthlyDues?: boolean;
    hasKingdomInvestment?: boolean;
    kingdomInvestmentAmount?: number;
  }) {
    const cleanNum = data.memberNumber.trim().toUpperCase();
    const existing = this.db.members.find((m) => m.member_number.toUpperCase() === cleanNum);
    if (!existing) {
      const branch = this.db.branches.find((b) => b.id === data.branchId) || this.db.branches[0];
      const id = this.db.members.length ? Math.max(...this.db.members.map((m) => m.id)) + 1 : 1;
      const today = new Date().toISOString().split('T')[0];
      const newMember: Member = {
        id,
        member_number: cleanNum,
        title: data.title || 'Brother',
        first_name: data.name,
        surname: data.surname,
        full_name: `${data.name} ${data.surname}`.trim(),
        phone: data.phone,
        email: data.email || '',
        photo_url: data.photoUrl || '',
        branch_id: branch ? branch.id : 1,
        branch_name: branch ? branch.name : 'Main Sanctuary',
        branch_code: branch ? branch.code : 'MS',
        currency_symbol: branch ? branch.currency_symbol : '$',
        currency_code: branch ? branch.currency_code : 'USD',
        join_date: today,
        monthly_due_amount: branch ? branch.default_monthly_due : 20,
        has_monthly_dues: 1,
        has_kingdom_investment: data.hasKingdomInvestment ? 1 : 0,
        kingdom_investment_amount: Number(data.kingdomInvestmentAmount) || 0,
        status: 'orange',
        created_at: today,
      };
      this.db.members.push(newMember);
      this.save();
    }
  }

  public cacheRemoteMemberDashboard(dashData: MemberDashboardData) {
    if (!dashData?.member?.member_number) return;
    const cleanNum = dashData.member.member_number.toUpperCase();
    const idx = this.db.members.findIndex((m) => m.member_number.toUpperCase() === cleanNum);
    if (idx === -1) {
      this.db.members.push(dashData.member);
    } else {
      this.db.members[idx] = { ...this.db.members[idx], ...dashData.member };
    }
    if (Array.isArray(dashData.contributions)) {
      for (const c of dashData.contributions) {
        if (!this.db.contributions.some((item) => item.id === c.id || item.receipt_no === c.receipt_no)) {
          this.db.contributions.push(c);
        }
      }
    }
    this.save(this.db, true);
  }

  public markNotificationsRead(memberId: number, notificationIds?: number[]) {
    if (notificationIds && notificationIds.length > 0) {
      this.db.notifications.forEach((n) => {
        if (notificationIds.includes(n.id)) n.is_read = 1;
      });
    } else if (memberId) {
      this.db.notifications.forEach((n) => {
        if (n.member_id === memberId || n.member_id === null) n.is_read = 1;
      });
    }
    this.save();
  }

  // --- ADMIN DATA ---
  public getAdminStats(): AdminStats {
    const branches = this.getBranches();
    const members = this.db.members.map((m) => {
      const branch = branches.find((b) => b.id === m.branch_id);
      const status = this.calculateMemberStatus(m.id);
      return {
        ...m,
        status,
        branch_name: branch?.name || m.branch_name,
        currency_symbol: branch?.currency_symbol || m.currency_symbol || '$',
        currency_code: branch?.currency_code || m.currency_code || 'USD',
      };
    });

    const greenCount = members.filter((m) => m.status === 'green').length;
    const orangeCount = members.filter((m) => m.status === 'orange').length;
    const redCount = members.filter((m) => m.status === 'red').length;
    const overdueMembers = members.filter((m) => m.status === 'red' || m.status === 'orange');

    const recentContributions = this.db.contributions
      .slice(-10)
      .reverse()
      .map((c) => {
        const m = members.find((mem) => mem.id === c.member_id);
        return {
          ...c,
          member_name: m?.full_name || 'Member',
          member_number: m?.member_number || '',
          currency_symbol: m?.currency_symbol || '$',
        };
      });

    return {
      membersCount: members.length,
      greenCount,
      orangeCount,
      redCount,
      branchesCount: branches.length,
      branches,
      overdueMembers,
      recentContributions,
    };
  }

  public getAdminMembers(params?: {
    search?: string;
    status?: string;
    branchId?: string | number;
  }): AdminMemberListItem[] {
    let list = this.db.members.map((m) => {
      const branch = this.db.branches.find((b) => b.id === m.branch_id);
      const status = this.calculateMemberStatus(m.id);
      const paidMonths = this.getPaidMonths(m.id, '2026');
      const memberContribs = this.db.contributions.filter((c) => c.member_id === m.id);

      let dues = 0;
      let kingdom = 0;
      let total = 0;
      for (const c of memberContribs) {
        if (c.category === 'membership_fee') dues += c.amount;
        else if (c.category === 'kingdom_investment') kingdom += c.amount;
        total += c.amount;
      }

      return {
        ...m,
        status,
        branch_name: branch?.name || m.branch_name,
        branch_code: branch?.code || m.branch_code,
        currency_symbol: branch?.currency_symbol || m.currency_symbol || '$',
        currency_code: branch?.currency_code || m.currency_code || 'USD',
        paid_months: paidMonths,
        totals: { dues, kingdom, total },
      };
    });

    if (params?.search) {
      const term = params.search.toLowerCase();
      list = list.filter(
        (m) =>
          m.full_name.toLowerCase().includes(term) ||
          m.member_number.toLowerCase().includes(term) ||
          m.phone.toLowerCase().includes(term)
      );
    }

    if (params?.status && params.status !== 'all') {
      list = list.filter((m) => m.status === params.status);
    }

    if (params?.branchId && params.branchId !== 'all') {
      const bId = Number(params.branchId);
      list = list.filter((m) => m.branch_id === bId);
    }

    return list.sort((a, b) => a.full_name.localeCompare(b.full_name));
  }

  public toggleMemberMonth(
    memberId: number,
    month: string,
    paid?: boolean
  ): {
    success: boolean;
    isPaid: boolean;
    month: string;
    newStatus: TrafficLightStatus;
    paidMonths: string[];
    message: string;
  } {
    const member = this.db.members.find((m) => m.id === memberId);
    if (!member) throw new Error('Member not found');

    const existingIndex = this.db.contributions.findIndex(
      (c) => c.member_id === memberId && c.category === 'membership_fee' && c.for_month === month
    );

    let isNowPaid = false;
    if (paid === true || (paid === undefined && existingIndex === -1)) {
      if (existingIndex === -1) {
        const newContrib: Contribution = {
          id: this.db.contributions.length ? Math.max(...this.db.contributions.map((c) => c.id)) + 1 : 1,
          member_id: memberId,
          category: 'membership_fee',
          amount: member.monthly_due_amount,
          date: new Date().toISOString().split('T')[0],
          for_month: month,
          payment_method: 'Offline Verified Dues',
          receipt_no: this.generateReceiptNo(),
          notes: 'Marked as covered by church administrator',
          verified: 1,
          created_at: new Date().toISOString(),
        };
        this.db.contributions.push(newContrib);
      }
      isNowPaid = true;
    } else {
      if (existingIndex !== -1) {
        this.db.contributions.splice(existingIndex, 1);
      }
      isNowPaid = false;
    }

    const newStatus = this.calculateMemberStatus(memberId);
    member.status = newStatus;
    const year = month.split('-')[0] || '2026';
    const paidMonths = this.getPaidMonths(memberId, year);

    this.save();

    return {
      success: true,
      isPaid: isNowPaid,
      month,
      newStatus,
      paidMonths,
      message: `${member.full_name}: ${month} marked as ${isNowPaid ? 'Covered / Paid' : 'Pending / Unpaid'}.`,
    };
  }

  public markThroughMonth(
    memberId: number,
    throughMonth: string = '2026-09'
  ): {
    success: boolean;
    newStatus: TrafficLightStatus;
    paidMonths: string[];
    message: string;
  } {
    const member = this.db.members.find((m) => m.id === memberId);
    if (!member) throw new Error('Member not found');

    const [yearStr, monthStr] = throughMonth.split('-');
    const year = yearStr || '2026';
    const endMonth = parseInt(monthStr, 10) || 9;
    const today = new Date().toISOString().split('T')[0];

    for (let m = 1; m <= endMonth; m++) {
      const mStr = `${year}-${String(m).padStart(2, '0')}`;
      const exists = this.db.contributions.some(
        (c) => c.member_id === memberId && c.category === 'membership_fee' && c.for_month === mStr
      );
      if (!exists) {
        this.db.contributions.push({
          id: this.db.contributions.length ? Math.max(...this.db.contributions.map((c) => c.id)) + 1 : 1,
          member_id: memberId,
          category: 'membership_fee',
          amount: member.monthly_due_amount,
          date: today,
          for_month: mStr,
          payment_method: 'Offline Verified Dues',
          receipt_no: this.generateReceiptNo(),
          notes: 'Marked through current month by church administrator',
          verified: 1,
          created_at: today,
        });
      }
    }

    const newStatus = this.calculateMemberStatus(memberId);
    member.status = newStatus;
    const paidMonths = this.getPaidMonths(memberId, year);
    this.save();

    return {
      success: true,
      newStatus,
      paidMonths,
      message: `${member.full_name} marked as paid through ${throughMonth}.`,
    };
  }

  public getMemberDuesMonths(memberId: number, year: string = '2026') {
    const member = this.db.members.find((m) => m.id === memberId);
    if (!member) throw new Error('Member not found');
    const status = this.calculateMemberStatus(memberId);
    const paidMonths = this.getPaidMonths(memberId, year);
    return {
      member: { ...member, status },
      paidMonths,
      year,
    };
  }

  public recordContribution(data: {
    member_id: number;
    category: 'membership_fee' | 'kingdom_investment' | 'special_offering';
    amount: number;
    date: string;
    for_month?: string;
    payment_method: string;
    notes?: string;
  }) {
    const member = this.db.members.find((m) => m.id === data.member_id);
    if (!member) throw new Error('Member not found');

    const newContrib: Contribution = {
      id: this.db.contributions.length ? Math.max(...this.db.contributions.map((c) => c.id)) + 1 : 1,
      ...data,
      receipt_no: this.generateReceiptNo(),
      verified: 1,
      created_at: new Date().toISOString(),
    };
    this.db.contributions.push(newContrib);
    const newStatus = this.calculateMemberStatus(member.id);
    member.status = newStatus;
    this.save();
    return { success: true, contribution: newContrib };
  }

  // --- EVENTS ---
  public getEvents(): ChurchEvent[] {
    return [...this.db.events].sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
  }

  public createEvent(payload: any): ChurchEvent {
    const id = this.db.events.length ? Math.max(...this.db.events.map((e) => e.id)) + 1 : 1;
    const newEv: ChurchEvent = {
      id,
      title: payload.title?.trim() || 'Church Event',
      description: payload.description || '',
      category: payload.category || 'service',
      start_date: payload.start_date,
      end_date: payload.end_date || undefined,
      location: payload.location || 'Main Sanctuary',
      target_ministry: payload.target_ministry || 'General Congregation',
      is_published: 1,
      created_at: new Date().toISOString(),
    };
    this.db.events.unshift(newEv);
    this.save();
    return newEv;
  }

  public updateEvent(id: number, payload: any): ChurchEvent {
    const index = this.db.events.findIndex((e) => e.id === id);
    if (index === -1) throw new Error('Event not found');
    this.db.events[index] = {
      ...this.db.events[index],
      ...payload,
    };
    this.save();
    return this.db.events[index];
  }

  public deleteEvent(id: number) {
    this.db.events = this.db.events.filter((e) => e.id !== id);
    this.save();
    return { success: true };
  }

  // --- NOTIFICATIONS ---
  public broadcastNotification(data: { member_id?: number | null; title: string; message: string }) {
    const id = this.db.notifications.length ? Math.max(...this.db.notifications.map((n) => n.id)) + 1 : 1;
    const newNotif: NotificationItem = {
      id,
      member_id: data.member_id || null,
      title: data.title,
      message: data.message,
      type: 'announcement',
      is_read: 0,
      created_at: new Date().toISOString(),
    };
    this.db.notifications.unshift(newNotif);
    this.save();
    return { success: true, notification: newNotif };
  }

  // --- CLOUD DATABASE SYNC CONTROLS ---
  public async syncWithCloud(): Promise<boolean> {
    const payload = await cloudDb.pullFromCloud();
    if (payload) {
      this.mergeRemoteData(payload);
      return true;
    }
    // Also push current state up to ensure parity
    await cloudDb.pushToCloud({
      branches: this.db.branches,
      members: this.db.members,
      contributions: this.db.contributions,
      events: this.db.events,
      notifications: this.db.notifications,
      settings: this.db.settings,
    });
    return true;
  }

  public getCloudDbConfig(): CloudDbConfig {
    return cloudDb.getConfig();
  }

  public updateCloudDbConfig(partial: Partial<CloudDbConfig>): CloudDbConfig {
    const updated = cloudDb.saveConfig(partial);
    if (updated.syncEnabled) {
      cloudDb.pushToCloud({
        branches: this.db.branches,
        members: this.db.members,
        contributions: this.db.contributions,
        events: this.db.events,
        notifications: this.db.notifications,
        settings: this.db.settings,
      }).catch(() => {});
    }
    return updated;
  }

  public async testAirtable(token: string, baseId: string) {
    return cloudDb.testAirtableConnection(token, baseId);
  }
}

export const localStore = new LocalChurchStore();
