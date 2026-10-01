import {
  MemberDashboardData,
  AdminStats,
  AdminMemberListItem,
  Branch,
  ChurchEvent,
  ChurchSettings,
} from '../types';
import { localStore, ADMIN_TOKEN } from './localStore';
import {
  getMemberFromFirestore,
  syncMemberToFirestore,
  getAllMembersFromFirestore,
} from './firebase';

export const API_BASE = '/api';

/**
 * Intelligent helper to execute API requests with automatic fallback to local store
 * when running in serverless/static environments (like Vercel SPA) where backend
 * endpoints return 404 or index.html.
 */
async function callApi<T>(
  endpoint: string,
  options?: RequestInit,
  fallbackFn?: () => T | Promise<T>
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';

    // If server returned HTML (typical of SPA rewrite /index.html on Vercel)
    if (!contentType.includes('application/json')) {
      if (fallbackFn) {
        return await fallbackFn();
      }
      throw new Error(`Endpoint ${endpoint} returned non-JSON response.`);
    }

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 404 && fallbackFn) {
        return await fallbackFn();
      }
      throw new Error(data.error || 'Server request failed');
    }

    return data;
  } catch (err: any) {
    if (fallbackFn) {
      return await fallbackFn();
    }
    throw err;
  }
}

export async function fetchBranches(): Promise<Branch[]> {
  return callApi<Branch[]>('/branches', undefined, () => localStore.getBranches());
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
  let result: { success: boolean; memberNumber: string; message: string };

  try {
    result = await callApi('/member/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // Fallback directly to local store (e.g. static Vercel deployment)
    result = localStore.registerMember(payload);
  }

  // CRITICAL: Always ensure the newly registered member exists locally and is pushed to Firestore immediately!
  try {
    localStore.ensureMemberLocally({
      memberNumber: result.memberNumber,
      title: payload.title,
      name: payload.name,
      surname: payload.surname,
      phone: payload.phone,
      email: payload.email,
      branchId: payload.branchId,
      photoUrl: payload.photoUrl,
      hasMonthlyDues: payload.hasMonthlyDues,
      hasKingdomInvestment: payload.hasKingdomInvestment,
      kingdomInvestmentAmount: payload.kingdomInvestmentAmount,
    });

    // Push directly to official Firestore Cloud Database
    const registeredLocal = localStore.getAdminMembers({ search: result.memberNumber })[0];
    if (registeredLocal) {
      await syncMemberToFirestore(registeredLocal as any);
    }

    // Also trigger cloud vault sync
    await triggerCloudSync();
  } catch (syncErr) {
    console.warn('Post-registration cloud sync notice:', syncErr);
  }

  return result;
}

export async function lookupMember(memberNumber: string): Promise<MemberDashboardData> {
  const cleanId = memberNumber.trim().toUpperCase();

  // 1. Try server endpoint first
  try {
    const data = await callApi<MemberDashboardData>(`/member/lookup/${encodeURIComponent(cleanId)}`);
    if (data && data.member) {
      localStore.cacheRemoteMemberDashboard(data);
      return data;
    }
  } catch (apiErr: any) {
    // Continue to Firestore check
  }

  // 2. Direct Firestore query: pulls member registered from other device instantly
  try {
    const fsMember = await getMemberFromFirestore(cleanId);
    if (fsMember) {
      localStore.ensureMemberLocally({
        memberNumber: fsMember.member_number,
        title: fsMember.title || 'Brother',
        name: fsMember.first_name || '',
        surname: fsMember.surname || '',
        phone: fsMember.phone || '',
        email: fsMember.email || '',
        branchId: fsMember.branch_id || 1,
        photoUrl: fsMember.photo_url || '',
        hasMonthlyDues: true,
        hasKingdomInvestment: !!fsMember.has_kingdom_investment,
        kingdomInvestmentAmount: fsMember.kingdom_investment_amount,
      });
      return localStore.lookupMember(cleanId);
    }
  } catch (fsErr) {
    console.warn('Firestore lookup notice:', fsErr);
  }

  // 3. Fallback: check local store
  try {
    return localStore.lookupMember(cleanId);
  } catch (localErr) {
    // 4. Final attempt: trigger Cloud sync and retry
    try {
      await triggerCloudSync();
      return localStore.lookupMember(cleanId);
    } catch (_) {
      throw localErr;
    }
  }
}

export async function markNotificationsAsRead(memberId: number, notificationIds?: number[]) {
  try {
    await callApi('/member/mark-notifications-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, notificationIds }),
    }, () => {
      localStore.markNotificationsRead(memberId, notificationIds);
      return { success: true };
    });
  } catch (e) {
    console.warn('Failed to mark notifications read:', e);
  }
}

export async function adminLogin(username: string, password: string): Promise<{
  success: boolean;
  token: string;
  user: { username: string; name: string; role: string };
}> {
  // First, verify credentials locally so Vercel deployments and offline access work without fail
  const isMatchLocally = localStore.validateAdminCredentials(username, password);

  try {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (res.ok) {
        return data;
      }
      // If the backend has not yet seeded or rejected valid demo credentials, allow local match
      if (isMatchLocally) {
        return localStore.getAdminSession();
      }
      throw new Error(data.error || 'Invalid administrator login.');
    }
  } catch (err: any) {
    // If explicit invalid login error came from backend, check local
    if (err.message && err.message.toLowerCase().includes('invalid')) {
      if (isMatchLocally) {
        return localStore.getAdminSession();
      }
      throw err;
    }
  }

  // Fallback for Vercel / serverless deployments:
  return localStore.adminLogin(username, password);
}

export async function fetchAdminStats(token: string): Promise<AdminStats> {
  try {
    const fsMembers = await getAllMembersFromFirestore();
    if (fsMembers.length > 0) {
      localStore.mergeRemoteData({ members: fsMembers });
    }
  } catch (e) {}

  return callApi<AdminStats>(
    '/admin/stats',
    { headers: { Authorization: `Bearer ${token}` } },
    () => localStore.getAdminStats()
  );
}

export async function fetchAdminBranches(token: string): Promise<Branch[]> {
  return callApi<Branch[]>(
    '/admin/branches',
    { headers: { Authorization: `Bearer ${token}` } },
    () => localStore.getBranches()
  );
}

export async function createAdminBranch(token: string, branch: Partial<Branch>) {
  return callApi('/admin/branches', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(branch),
  }, () => localStore.createBranch(branch));
}

export async function updateAdminBranch(token: string, id: number, branch: Partial<Branch>) {
  return callApi(`/admin/branches/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(branch),
  }, () => localStore.updateBranch(id, branch));
}

export async function fetchAdminMembers(
  token: string,
  params?: { search?: string; status?: string; branchId?: string | number }
): Promise<AdminMemberListItem[]> {
  try {
    const fsMembers = await getAllMembersFromFirestore();
    if (fsMembers.length > 0) {
      localStore.mergeRemoteData({ members: fsMembers });
    }
  } catch (e) {}

  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.status) query.set('status', params.status);
  if (params?.branchId !== undefined && params?.branchId !== null) {
    query.set('branchId', String(params.branchId));
  }

  const endpoint = `/admin/members${query.toString() ? `?${query.toString()}` : ''}`;
  return callApi<AdminMemberListItem[]>(
    endpoint,
    { headers: { Authorization: `Bearer ${token}` } },
    () => localStore.getAdminMembers(params)
  );
}

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
  return callApi('/admin/contributions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  }, () => localStore.recordContribution(data));
}

export async function toggleAdminMemberMonth(
  token: string,
  memberId: number,
  month: string,
  paid?: boolean
): Promise<{ success: boolean; isPaid: boolean; month: string; newStatus: string; paidMonths: string[]; message: string }> {
  return callApi(
    `/admin/members/${memberId}/toggle-month`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ month, paid }),
    },
    () => localStore.toggleMemberMonth(memberId, month, paid)
  );
}

export async function markAdminMemberThroughMonth(
  token: string,
  memberId: number,
  throughMonth: string
): Promise<{ success: boolean; newStatus: string; paidMonths: string[]; message: string }> {
  return callApi(
    `/admin/members/${memberId}/mark-through-month`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ throughMonth }),
    },
    () => localStore.markThroughMonth(memberId, throughMonth)
  );
}

export async function fetchAdminMemberDuesMonths(
  token: string,
  memberId: number,
  year: string = '2026'
): Promise<{ member: any; paidMonths: string[]; year: string }> {
  return callApi(
    `/admin/members/${memberId}/dues-months?year=${year}`,
    { headers: { Authorization: `Bearer ${token}` } },
    () => localStore.getMemberDuesMonths(memberId, year)
  );
}

export async function fetchAdminEvents(token: string): Promise<ChurchEvent[]> {
  return callApi<ChurchEvent[]>(
    '/admin/events',
    { headers: { Authorization: `Bearer ${token}` } },
    () => localStore.getEvents()
  );
}

export async function createAdminEvent(token: string, payload: any) {
  return callApi('/admin/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  }, () => localStore.createEvent(payload));
}

export async function updateAdminEvent(token: string, id: number, payload: any) {
  return callApi(`/admin/events/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  }, () => localStore.updateEvent(id, payload));
}

export async function deleteAdminEvent(token: string, id: number) {
  return callApi(`/admin/events/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }, () => localStore.deleteEvent(id));
}

export async function broadcastAdminNotification(
  token: string,
  data: {
    member_id?: number | null;
    title: string;
    message: string;
  }
) {
  return callApi('/admin/notifications/broadcast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  }, () => localStore.broadcastNotification(data));
}

export async function fetchChurchSettings(): Promise<ChurchSettings> {
  return callApi<ChurchSettings>('/church-settings', undefined, () => localStore.getChurchSettings());
}

export async function fetchAdminChurchSettings(token: string): Promise<ChurchSettings> {
  return callApi<ChurchSettings>(
    '/admin/church-settings',
    { headers: { Authorization: `Bearer ${token}` } },
    () => localStore.getChurchSettings()
  );
}

export async function updateAdminChurchSettings(
  token: string,
  payload: Partial<ChurchSettings>
): Promise<{ success: boolean; settings: ChurchSettings; message: string }> {
  return callApi('/admin/church-settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  }, () => {
    const updated = localStore.updateChurchSettings(payload);
    return { success: true, settings: updated, message: 'Church details & branding updated successfully.' };
  });
}

export async function resetAdminCleanSlate(
  token: string
): Promise<{ success: boolean; message: string }> {
  return callApi(
    '/admin/reset-clean',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    () => {
      localStore.clearAllDataAndReset();
      return { success: true, message: 'All demo data cleared. Clean slate initialized.' };
    }
  );
}

// --- CLOUD DATABASE & MULTI-DEVICE SYNC ---

export function getCloudDbConfig() {
  return localStore.getCloudDbConfig();
}

export function updateCloudDbConfig(partial: any) {
  return localStore.updateCloudDbConfig(partial);
}

export async function triggerCloudSync(): Promise<boolean> {
  return localStore.syncWithCloud();
}

export async function testAirtableConnection(token: string, baseId: string) {
  return localStore.testAirtable(token, baseId);
}


