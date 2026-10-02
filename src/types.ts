export type TrafficLightStatus = 'green' | 'orange' | 'red' | 'void';

export interface Branch {
  id: number;
  name: string;
  code: string; // e.g. MS, HRE, JHB, LON
  currency_symbol: string; // e.g. $, R, £, €
  currency_code: string; // e.g. USD, ZAR, GBP, EUR
  default_monthly_due: number;
  address?: string;
  member_count?: number;
  created_at: string;
}

export interface Member {
  id: number;
  member_number: string;
  title?: string;
  first_name?: string;
  surname?: string;
  full_name: string;
  phone: string;
  email?: string;
  photo_url?: string;
  branch_id: number;
  branch_name?: string;
  branch_code?: string;
  currency_symbol?: string;
  currency_code?: string;
  join_date: string;
  monthly_due_amount: number;
  has_monthly_dues?: boolean | number;
  has_kingdom_investment?: boolean | number;
  kingdom_investment_amount?: number;
  status: TrafficLightStatus;
  notes?: string;
  verified?: number;
  created_at: string;
}

export interface Contribution {
  id: number;
  member_id: number;
  category: 'membership_fee' | 'kingdom_investment' | 'special_offering';
  amount: number;
  currency_symbol?: string;
  currency_code?: string;
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

export interface MemberDashboardData {
  member: Member;
  status: TrafficLightStatus;
  statusReason: string;
  currencySymbol: string;
  currencyCode: string;
  settings?: ChurchSettings;
  paidMonths?: string[];
  summary: {
    totalDues: number;
    totalKingdomInvestment: number;
    totalSpecial: number;
    totalAllTime: number;
    currentYearTotal: number;
    currentMonthDuesPaid: boolean;
    monthlyDueAmount: number;
  };
  contributions: Contribution[];
  upcomingEvents: ChurchEvent[];
  notifications: NotificationItem[];
}

export interface AdminStats {
  membersCount: number;
  greenCount: number;
  orangeCount: number;
  redCount: number;
  branchesCount: number;
  branches: Branch[];
  overdueMembers: Member[];
  recentContributions: (Contribution & { member_name: string; member_number: string; currency_symbol: string })[];
}

export interface AdminMemberListItem extends Member {
  paid_months?: string[];
  totals: {
    dues: number;
    kingdom: number;
    total: number;
  };
}
