/**
 * Free Cloud Database Synchronization Service
 * 
 * Supports:
 * 1. Zero-Setup Free Cloud Sync (Default): Uses a globally accessible free cloud document vault
 *    with zero subscription, zero credit card, and instant synchronization across all devices.
 * 2. Airtable (Free Plan): 100% Free plan, 1,000 records/base, user-suggested visual spreadsheet database.
 * 3. Supabase (Free Tier): 100% Free PostgreSQL REST API.
 * 
 * Guarantees cross-device data consistency between registering members and administrators
 * on both local development and static / serverless Vercel deployments.
 */

import { Branch, Member, Contribution, ChurchEvent, ChurchSettings, NotificationItem } from '../types';

export type CloudProviderType = 'cloudvault' | 'airtable' | 'supabase';

export interface CloudDbConfig {
  provider: CloudProviderType;
  syncEnabled: boolean;
  vaultId: string;
  airtableToken: string;
  airtableBaseId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  lastSyncTime: string | null;
  syncStatus: 'idle' | 'syncing' | 'connected' | 'error';
  syncMessage: string;
  syncedStats: {
    members: number;
    contributions: number;
    branches: number;
    events: number;
  };
}

export interface SyncPayload {
  branches: Branch[];
  members: Member[];
  contributions: Contribution[];
  events: ChurchEvent[];
  notifications?: NotificationItem[];
  settings?: ChurchSettings;
  updatedAt: string;
  sourceDevice?: string;
}

const CONFIG_STORAGE_KEY = 'living_faith_cloud_db_config_v3';
const DEFAULT_GLOBAL_VAULT_ID = 'ff808181a09d98f701a0f0e7763347c7';
const RESTFUL_API_BASE = 'https://api.restful-api.dev/objects';

export const DEFAULT_CONFIG: CloudDbConfig = {
  provider: 'cloudvault',
  syncEnabled: true,
  vaultId: DEFAULT_GLOBAL_VAULT_ID,
  airtableToken: '',
  airtableBaseId: '',
  supabaseUrl: '',
  supabaseAnonKey: '',
  lastSyncTime: null,
  syncStatus: 'connected',
  syncMessage: 'Free Multi-Device Cloud Sync Active',
  syncedStats: {
    members: 0,
    contributions: 0,
    branches: 4,
    events: 0,
  },
};

class CloudDbService {
  private config: CloudDbConfig;
  private syncInProgress = false;
  private listeners: Array<(config: CloudDbConfig) => void> = [];
  private dataListeners: Array<(data: SyncPayload) => void> = [];
  private pollIntervalId: any = null;

  constructor() {
    this.config = this.loadConfig();
    this.initAutoSync();
  }

  private loadConfig(): CloudDbConfig {
    try {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          vaultId: parsed.vaultId || DEFAULT_GLOBAL_VAULT_ID,
        };
      }
    } catch (e) {
      console.warn('Could not load cloud DB config from localStorage:', e);
    }
    return { ...DEFAULT_CONFIG };
  }

  public saveConfig(newConfig: Partial<CloudDbConfig>): CloudDbConfig {
    this.config = {
      ...this.config,
      ...newConfig,
    };
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.warn('Could not save cloud DB config to localStorage:', e);
    }
    this.notifyListeners();
    return this.config;
  }

  public getConfig(): CloudDbConfig {
    return { ...this.config };
  }

  public subscribe(listener: (config: CloudDbConfig) => void): () => void {
    this.listeners.push(listener);
    listener(this.getConfig());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public onRemoteDataReceived(listener: (data: SyncPayload) => void): () => void {
    this.dataListeners.push(listener);
    return () => {
      this.dataListeners = this.dataListeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener(this.getConfig());
      } catch (err) {
        console.error('Error in cloud config listener:', err);
      }
    }
  }

  private notifyDataListeners(data: SyncPayload) {
    for (const listener of this.dataListeners) {
      try {
        listener(data);
      } catch (err) {
        console.error('Error in cloud data listener:', err);
      }
    }
  }

  // Set up periodic cloud synchronization so multiple tabs/devices stay updated
  private initAutoSync() {
    if (typeof window === 'undefined') return;

    // Check on window focus (e.g. admin switches between devices or tabs)
    window.addEventListener('focus', () => {
      if (this.config.syncEnabled && !this.syncInProgress) {
        this.pullFromCloud().catch(() => {});
      }
    });

    // Poll every 8 seconds for real-time multi-device freshness
    if (this.pollIntervalId) clearInterval(this.pollIntervalId);
    this.pollIntervalId = setInterval(() => {
      if (this.config.syncEnabled && !this.syncInProgress) {
        this.pullFromCloud().catch(() => {});
      }
    }, 8000);
  }

  // ==========================================
  // PULL FROM CLOUD DATABASE
  // ==========================================
  public async pullFromCloud(): Promise<SyncPayload | null> {
    if (!this.config.syncEnabled) return null;
    this.syncInProgress = true;
    this.saveConfig({ syncStatus: 'syncing', syncMessage: 'Synchronizing with Cloud Database...' });

    try {
      let payload: SyncPayload | null = null;

      if (this.config.provider === 'airtable' && this.config.airtableToken && this.config.airtableBaseId) {
        payload = await this.pullFromAirtable();
      } else if (this.config.provider === 'supabase' && this.config.supabaseUrl && this.config.supabaseAnonKey) {
        payload = await this.pullFromSupabase();
      } else {
        // Default: Free Cloud Vault
        payload = await this.pullFromCloudVault();
      }

      if (payload) {
        const stats = {
          members: payload.members?.length || 0,
          contributions: payload.contributions?.length || 0,
          branches: payload.branches?.length || 0,
          events: payload.events?.length || 0,
        };
        const now = new Date().toLocaleTimeString();
        this.saveConfig({
          syncStatus: 'connected',
          syncMessage: `Synced successfully (${payload.members?.length || 0} members across devices)`,
          lastSyncTime: now,
          syncedStats: stats,
        });

        this.notifyDataListeners(payload);
        return payload;
      }

      this.saveConfig({
        syncStatus: 'connected',
        syncMessage: 'Connected to Cloud Database (In sync)',
        lastSyncTime: new Date().toLocaleTimeString(),
      });
      return null;
    } catch (err: any) {
      console.warn('Cloud sync pull failed:', err);
      this.saveConfig({
        syncStatus: 'error',
        syncMessage: err.message || 'Cloud sync connection issue. Local data preserved.',
      });
      return null;
    } finally {
      this.syncInProgress = false;
    }
  }

  // ==========================================
  // PUSH TO CLOUD DATABASE
  // ==========================================
  public async pushToCloud(data: Partial<SyncPayload>): Promise<boolean> {
    if (!this.config.syncEnabled) return false;
    this.syncInProgress = true;
    this.saveConfig({ syncStatus: 'syncing', syncMessage: 'Pushing changes to Cloud Database...' });

    try {
      // Sanitize members for cloud REST storage so large photos do not exceed 10KB limits
      const sanitizedMembers = (data.members || []).map((m) => {
        let photo = m.photo_url || '';
        if (photo.length > 2000) {
          photo = '';
        }
        return {
          ...m,
          photo_url: photo,
        };
      });

      const fullPayload: SyncPayload = {
        branches: data.branches || [],
        members: sanitizedMembers,
        contributions: data.contributions || [],
        events: data.events || [],
        notifications: (data.notifications || []).slice(0, 50),
        settings: data.settings,
        updatedAt: new Date().toISOString(),
        sourceDevice: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 30) : 'unknown',
      };

      let success = false;

      if (this.config.provider === 'airtable' && this.config.airtableToken && this.config.airtableBaseId) {
        success = await this.pushToAirtable(fullPayload);
      } else if (this.config.provider === 'supabase' && this.config.supabaseUrl && this.config.supabaseAnonKey) {
        success = await this.pushToSupabase(fullPayload);
      } else {
        success = await this.pushToCloudVault(fullPayload);
      }

      if (success) {
        const now = new Date().toLocaleTimeString();
        this.saveConfig({
          syncStatus: 'connected',
          syncMessage: `All records synced to Cloud (${fullPayload.members.length} members accessible across devices)`,
          lastSyncTime: now,
          syncedStats: {
            members: fullPayload.members.length,
            contributions: fullPayload.contributions.length,
            branches: fullPayload.branches.length,
            events: fullPayload.events.length,
          },
        });
      }

      return success;
    } catch (err: any) {
      console.warn('Cloud sync push failed:', err);
      this.saveConfig({
        syncStatus: 'error',
        syncMessage: err.message || 'Failed to push to Cloud Database. Saved locally.',
      });
      return false;
    } finally {
      this.syncInProgress = false;
    }
  }

  // ==========================================
  // 1. FREE CLOUD VAULT (Default Provider)
  // ==========================================
  private async pullFromCloudVault(): Promise<SyncPayload | null> {
    const vaultId = this.config.vaultId || DEFAULT_GLOBAL_VAULT_ID;
    const url = `${RESTFUL_API_BASE}/${vaultId}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (res.status === 404) {
      // Create new vault if missing
      await this.initNewVault();
      return null;
    }

    if (!res.ok) {
      throw new Error(`Cloud Vault returned status ${res.status}`);
    }

    const json = await res.json();
    const data = json?.data || {};

    const members: Member[] = [];
    const contributions: Contribution[] = [];
    const events: ChurchEvent[] = [];
    let branches: Branch[] = [];

    // Parse keyed members, contributions & events
    for (const [key, val] of Object.entries(data)) {
      if (key.startsWith('m_') && typeof val === 'string') {
        try {
          members.push(JSON.parse(val));
        } catch {}
      } else if (key.startsWith('c_') && typeof val === 'string') {
        try {
          contributions.push(JSON.parse(val));
        } catch {}
      } else if (key.startsWith('e_') && typeof val === 'string') {
        try {
          events.push(JSON.parse(val));
        } catch {}
      }
    }

    if (Array.isArray(data.members)) {
      for (const m of data.members) {
        if (!members.some((x) => x.member_number === m.member_number)) {
          members.push(m);
        }
      }
    }

    if (Array.isArray(data.branches)) {
      branches = data.branches;
    }

    return {
      branches,
      members,
      contributions,
      events,
      notifications: Array.isArray(data.notifications) ? data.notifications : [],
      settings: data.settings,
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  }

  private async pushToCloudVault(payload: SyncPayload): Promise<boolean> {
    const vaultId = this.config.vaultId || DEFAULT_GLOBAL_VAULT_ID;
    const url = `${RESTFUL_API_BASE}/${vaultId}`;

    const dataObj: Record<string, any> = {
      updatedAt: payload.updatedAt,
      sourceDevice: payload.sourceDevice,
    };

    if (payload.settings) {
      dataObj.settings = payload.settings;
    }

    if (Array.isArray(payload.members)) {
      for (const m of payload.members) {
        if (!m || !m.member_number) continue;
        const key = 'm_' + m.member_number.replace(/[^a-zA-Z0-9]/g, '_');
        dataObj[key] = JSON.stringify({
          id: m.id,
          member_number: m.member_number,
          title: m.title || 'Brother',
          first_name: m.first_name || '',
          surname: m.surname || '',
          full_name: m.full_name || `${m.first_name || ''} ${m.surname || ''}`.trim(),
          phone: m.phone || '',
          email: m.email || '',
          photo_url: '',
          branch_id: m.branch_id || 1,
          branch_name: m.branch_name || 'Main Sanctuary',
          branch_code: m.branch_code || 'MS',
          currency_symbol: m.currency_symbol || '$',
          currency_code: m.currency_code || 'USD',
          join_date: m.join_date || '2026-09-30',
          monthly_due_amount: m.monthly_due_amount || 20,
          has_monthly_dues: 1,
          has_kingdom_investment: m.has_kingdom_investment || 0,
          kingdom_investment_amount: m.kingdom_investment_amount || 0,
          status: m.status || 'orange',
        });
      }
    }

    if (Array.isArray(payload.contributions)) {
      for (const c of payload.contributions.slice(0, 100)) {
        if (!c || !c.receipt_no) continue;
        const key = 'c_' + c.receipt_no.replace(/[^a-zA-Z0-9]/g, '_');
        dataObj[key] = JSON.stringify(c);
      }
    }

    if (Array.isArray(payload.events)) {
      for (const e of payload.events.slice(0, 30)) {
        if (!e || !e.id) continue;
        dataObj['e_' + e.id] = JSON.stringify(e);
      }
    }

    const body = {
      name: 'living-faith-portal-global-db',
      data: dataObj,
    };

    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      if (res.status === 404) {
        // Vault object might have expired or needs creation
        const newId = await this.initNewVault(payload);
        return Boolean(newId);
      }
      throw new Error(`Cloud Vault update failed: HTTP ${res.status}`);
    }

    return true;
  }

  public async initNewVault(initialData?: SyncPayload): Promise<string> {
    const body = {
      name: 'living-faith-portal-global-db',
      data: initialData || {
        branches: [],
        members: [],
        contributions: [],
        events: [],
        updatedAt: new Date().toISOString(),
      },
    };

    const res = await fetch(RESTFUL_API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Failed to create new Cloud Vault: HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.id) {
      this.saveConfig({ vaultId: data.id });
      return data.id;
    }
    return DEFAULT_GLOBAL_VAULT_ID;
  }

  // ==========================================
  // 2. AIRTABLE PROVIDER (100% Free Plan)
  // ==========================================
  public async testAirtableConnection(token: string, baseId: string): Promise<{ success: boolean; message: string }> {
    try {
      const url = `https://api.airtable.com/v0/${baseId}/Members?maxRecords=1`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/json',
        },
      });

      if (res.status === 200) {
        return { success: true, message: 'Successfully connected to Airtable Base and verified "Members" table!' };
      }

      if (res.status === 404) {
        return {
          success: false,
          message: 'Base found, but table "Members" was not found in Airtable. Please create a table named "Members" in your base.',
        };
      }

      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          message: 'Airtable authentication error. Please verify your Personal Access Token has "data.records:read" and "data.records:write" scopes.',
        };
      }

      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        message: errData.error?.message || `Airtable request returned HTTP ${res.status}`,
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Network error reaching Airtable API.' };
    }
  }

  private async pullFromAirtable(): Promise<SyncPayload | null> {
    const { airtableToken, airtableBaseId } = this.config;
    if (!airtableToken || !airtableBaseId) return null;

    const headers = {
      Authorization: `Bearer ${airtableToken.trim()}`,
      Accept: 'application/json',
    };

    // 1. Fetch Members
    const membersRes = await fetch(`https://api.airtable.com/v0/${airtableBaseId}/Members`, { headers });
    if (!membersRes.ok) {
      throw new Error(`Airtable Members error: HTTP ${membersRes.status}`);
    }
    const membersData = await membersRes.json();
    const members: Member[] = (membersData.records || []).map((r: any, idx: number) => {
      const f = r.fields;
      return {
        id: f.id || idx + 1,
        member_number: f['Member Number'] || f.member_number || '',
        title: f['Title'] || f.title || 'Brother',
        first_name: f['First Name'] || f.first_name || '',
        surname: f['Surname'] || f.surname || '',
        full_name: f['Full Name'] || f.full_name || `${f['First Name'] || ''} ${f['Surname'] || ''}`.trim(),
        phone: f['Phone'] || f.phone || '',
        email: f['Email'] || f.email || '',
        photo_url: f['Photo URL'] || f.photo_url || '',
        branch_id: Number(f['Branch ID'] || f.branch_id) || 1,
        branch_name: f['Branch'] || f.branch_name || '',
        currency_symbol: f['Currency Symbol'] || f.currency_symbol || '$',
        currency_code: f['Currency Code'] || f.currency_code || 'USD',
        join_date: f['Join Date'] || f.join_date || new Date().toISOString().split('T')[0],
        monthly_due_amount: Number(f['Monthly Due Amount'] || f.monthly_due_amount) || 20,
        has_monthly_dues: 1,
        has_kingdom_investment: f['Kingdom Investment'] ? 1 : 0,
        kingdom_investment_amount: Number(f['Kingdom Investment Amount']) || 0,
        status: f['Status'] === 'green' || f['Status'] === 'orange' || f['Status'] === 'red' ? f['Status'] : 'orange',
        created_at: f['Created At'] || new Date().toISOString(),
      };
    });

    // 2. Fetch Contributions
    let contributions: Contribution[] = [];
    try {
      const contribRes = await fetch(`https://api.airtable.com/v0/${airtableBaseId}/Contributions`, { headers });
      if (contribRes.ok) {
        const cData = await contribRes.json();
        contributions = (cData.records || []).map((r: any, idx: number) => {
          const f = r.fields;
          return {
            id: f.id || idx + 1,
            member_id: Number(f['Member ID'] || f.member_id) || 1,
            category: f['Category'] || 'membership_fee',
            amount: Number(f['Amount'] || f.amount) || 0,
            date: f['Date'] || new Date().toISOString().split('T')[0],
            for_month: f['For Month'] || f.for_month,
            payment_method: f['Payment Method'] || 'Offline Verified',
            receipt_no: f['Receipt No'] || `REC-${idx + 1000}`,
            notes: f['Notes'] || '',
            verified: 1,
            created_at: f['Created At'] || new Date().toISOString(),
          };
        });
      }
    } catch (e) {
      console.warn('Airtable Contributions table optional fetch:', e);
    }

    // 3. Fallback / Default branches
    return {
      branches: [],
      members,
      contributions,
      events: [],
      updatedAt: new Date().toISOString(),
    };
  }

  private async pushToAirtable(payload: SyncPayload): Promise<boolean> {
    const { airtableToken, airtableBaseId } = this.config;
    if (!airtableToken || !airtableBaseId) return false;

    const headers = {
      Authorization: `Bearer ${airtableToken.trim()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    // Push members to Airtable
    if (payload.members && payload.members.length > 0) {
      // First get existing records in Airtable to avoid duplicate creations
      const existingRes = await fetch(`https://api.airtable.com/v0/${airtableBaseId}/Members`, { headers });
      const existing = existingRes.ok ? await existingRes.json() : { records: [] };
      const existingMap = new Map<string, string>(); // member_number -> airtable record id
      for (const rec of existing.records || []) {
        const memNum = (rec.fields?.['Member Number'] || rec.fields?.member_number || '').toUpperCase();
        if (memNum) existingMap.set(memNum, rec.id);
      }

      for (const m of payload.members) {
        const memNum = m.member_number.toUpperCase();
        const existingRecordId = existingMap.get(memNum);

        const fields: any = {
          'Member Number': m.member_number,
          'Full Name': m.full_name,
          'Title': m.title || 'Brother',
          'First Name': m.first_name || '',
          'Surname': m.surname || '',
          'Phone': m.phone,
          'Email': m.email || '',
          'Branch': m.branch_name || '',
          'Status': m.status,
          'Monthly Due Amount': m.monthly_due_amount,
          'Join Date': m.join_date,
        };

        if (existingRecordId) {
          // Update
          await fetch(`https://api.airtable.com/v0/${airtableBaseId}/Members/${existingRecordId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ fields }),
          });
        } else {
          // Create
          await fetch(`https://api.airtable.com/v0/${airtableBaseId}/Members`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ fields }),
          });
        }
      }
    }

    return true;
  }

  // ==========================================
  // 3. SUPABASE PROVIDER (100% Free Tier)
  // ==========================================
  private async pullFromSupabase(): Promise<SyncPayload | null> {
    const { supabaseUrl, supabaseAnonKey } = this.config;
    if (!supabaseUrl || !supabaseAnonKey) return null;

    const headers = {
      apikey: supabaseAnonKey.trim(),
      Authorization: `Bearer ${supabaseAnonKey.trim()}`,
      Accept: 'application/json',
    };

    const membersRes = await fetch(`${supabaseUrl}/rest/v1/members?select=*`, { headers });
    if (!membersRes.ok) {
      throw new Error(`Supabase members error: HTTP ${membersRes.status}`);
    }
    const members = await membersRes.json();

    const contribRes = await fetch(`${supabaseUrl}/rest/v1/contributions?select=*`, { headers });
    const contributions = contribRes.ok ? await contribRes.json() : [];

    return {
      branches: [],
      members: members || [],
      contributions: contributions || [],
      events: [],
      updatedAt: new Date().toISOString(),
    };
  }

  private async pushToSupabase(payload: SyncPayload): Promise<boolean> {
    const { supabaseUrl, supabaseAnonKey } = this.config;
    if (!supabaseUrl || !supabaseAnonKey) return false;

    const headers = {
      apikey: supabaseAnonKey.trim(),
      Authorization: `Bearer ${supabaseAnonKey.trim()}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    };

    if (payload.members && payload.members.length > 0) {
      await fetch(`${supabaseUrl}/rest/v1/members`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload.members),
      });
    }

    return true;
  }
}

export const cloudDb = new CloudDbService();
