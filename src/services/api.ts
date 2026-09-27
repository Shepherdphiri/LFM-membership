import {
  MemberDashboardData,
  AdminStats,
  AdminMemberListItem,
  Branch,
  ChurchEvent,
  ChurchSettings,
} from '../types';

export const API_BASE = '/api';

export async function fetchBranches(): Promise<Branch[]> {
  const res = await fetch(`${API_BASE}/branches`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch branches');
  return data;
}

export async function registerMember(payload: {
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
}): Promise<{ success: boolean; memberNumber: string; message: string }> {
  const res = await fetch(`${API_BASE}/member/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  return data;
}

export async function lookupMember(memberNumber: string): Promise<MemberDashboardData> {
  const cleanId = memberNumber.trim();
  const res = await fetch(`${API_BASE}/member/lookup/${encodeURIComponent(cleanId)}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Member not found.');
  }
  return data;
}

export async function markNotificationsAsRead(memberId: number, notificationIds?: number[]) {
  try {
    await fetch(`${API_BASE}/member/mark-notifications-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, notificationIds }),
    });
  } catch (e) {
    console.error('Failed to mark notifications read:', e);
  }
}

export async function adminLogin(username: string, password: string) {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Invalid administrator login.');
  return data;
}

export async function fetchAdminStats(token: string): Promise<AdminStats> {
  const res = await fetch(`${API_BASE}/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch admin stats.');
  return data;
}

export async function fetchAdminBranches(token: string): Promise<Branch[]> {
  const res = await fetch(`${API_BASE}/admin/branches`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch branches.');
  return data;
}

export async function createAdminBranch(token: string, branch: Partial<Branch>) {
  const res = await fetch(`${API_BASE}/admin/branches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(branch),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create branch');
  return data;
}

export async function updateAdminBranch(token: string, id: number, branch: Partial<Branch>) {
  const res = await fetch(`${API_BASE}/admin/branches/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(branch),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update branch');
  return data;
}

export async function fetchAdminMembers(
  token: string,
  params?: { search?: string; status?: string; branchId?: string }
): Promise<AdminMemberListItem[]> {
  const url = new URL(`${window.location.origin}${API_BASE}/admin/members`);
  if (params?.search) url.searchParams.set('search', params.search);
  if (params?.status) url.searchParams.set('status', params.status);
  if (params?.branchId) url.searchParams.set('branchId', params.branchId);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch members.');
  return data;
}

// Admin records offline payments (Dues, Kingdom Investment)
export async function recordAdminContribution(
  token: string,
  data: {
    member_id: number;
    category: 'membership_fee' | 'kingdom_investment' | 'special_offering';
    amount: number;
    date: string;
    for_month?: string;
    payment_method: string;
    notes?: string;
  }
) {
  const res = await fetch(`${API_BASE}/admin/contributions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  const resData = await res.json();
  if (!res.ok) throw new Error(resData.error || 'Failed to record contribution.');
  return resData;
}

// Admin Monthly Dues Tick / Toggle by Month
export async function toggleAdminMemberMonth(
  token: string,
  memberId: number,
  month: string,
  paid?: boolean
): Promise<{ success: boolean; isPaid: boolean; month: string; newStatus: string; paidMonths: string[]; message: string }> {
  const res = await fetch(`${API_BASE}/admin/members/${memberId}/toggle-month`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ month, paid }),
  });
  const resData = await res.json();
  if (!res.ok) throw new Error(resData.error || 'Failed to update dues month.');
  return resData;
}

// Admin Mark All Months Through Current Month (e.g. up to 2026-09)
export async function markAdminMemberThroughMonth(
  token: string,
  memberId: number,
  throughMonth: string
): Promise<{ success: boolean; newStatus: string; paidMonths: string[]; message: string }> {
  const res = await fetch(`${API_BASE}/admin/members/${memberId}/mark-through-month`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ throughMonth }),
  });
  const resData = await res.json();
  if (!res.ok) throw new Error(resData.error || 'Failed to mark months through current month.');
  return resData;
}

// Admin Fetch Member Dues Months
export async function fetchAdminMemberDuesMonths(
  token: string,
  memberId: number,
  year: string = '2026'
): Promise<{ member: any; paidMonths: string[]; year: string }> {
  const res = await fetch(`${API_BASE}/admin/members/${memberId}/dues-months?year=${year}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const resData = await res.json();
  if (!res.ok) throw new Error(resData.error || 'Failed to fetch dues months.');
  return resData;
}

export async function fetchAdminEvents(token: string): Promise<ChurchEvent[]> {
  const res = await fetch(`${API_BASE}/admin/events`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch events');
  return data;
}

export async function createAdminEvent(token: string, payload: any) {
  const res = await fetch(`${API_BASE}/admin/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create event');
  return data;
}

export async function updateAdminEvent(token: string, id: number, payload: any) {
  const res = await fetch(`${API_BASE}/admin/events/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update event');
  return data;
}

export async function deleteAdminEvent(token: string, id: number) {
  const res = await fetch(`${API_BASE}/admin/events/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete event');
  return data;
}

export async function broadcastAdminNotification(
  token: string,
  data: {
    member_id?: number | null;
    title: string;
    message: string;
  }
) {
  const res = await fetch(`${API_BASE}/admin/notifications/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  const resData = await res.json();
  if (!res.ok) throw new Error(resData.error || 'Failed to broadcast notification.');
  return resData;
}

export async function fetchChurchSettings(): Promise<ChurchSettings> {
  const res = await fetch(`${API_BASE}/church-settings`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch church details');
  return data;
}

export async function fetchAdminChurchSettings(token: string): Promise<ChurchSettings> {
  const res = await fetch(`${API_BASE}/admin/church-settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch church settings');
  return data;
}

export async function updateAdminChurchSettings(token: string, payload: Partial<ChurchSettings>): Promise<{ success: boolean; settings: ChurchSettings; message: string }> {
  const res = await fetch(`${API_BASE}/admin/church-settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update church settings');
  return data;
}
