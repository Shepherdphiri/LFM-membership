import React, { useState, useEffect, useRef } from 'react';
import {
  AdminStats,
  AdminMemberListItem,
  Branch,
  Member,
  ChurchEvent,
  ChurchSettings,
} from '../types';
import {
  adminLogin,
  fetchAdminStats,
  fetchAdminMembers,
  fetchAdminBranches,
  createAdminBranch,
  updateAdminBranch,
  toggleAdminMemberMonth,
  markAdminMemberThroughMonth,
  fetchAdminEvents,
  createAdminEvent,
  updateAdminEvent,
  deleteAdminEvent,
  broadcastAdminNotification,
  fetchAdminChurchSettings,
  updateAdminChurchSettings,
  resetAdminCleanSlate,
  getCloudDbConfig,
  updateCloudDbConfig,
  triggerCloudSync,
  testAirtableConnection,
} from '../services/api';
import {
  Lock,
  ShieldCheck,
  Users,
  Calendar,
  AlertTriangle,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  FileText,
  Megaphone,
  Download,
  X,
  LogOut,
  Edit2,
  Trash2,
  Check,
  Building,
  Church,
  Clock,
  MapPin,
  QrCode,
  CalendarCheck2,
  Upload,
  Camera,
  Maximize2,
  Minimize2,
  Database,
  Cloud,
  RefreshCw,
  Globe,
  Key,
  ExternalLink,
  HardDrive,
} from 'lucide-react';
import { localStore } from '../services/localStore';
import { cloudDb, CloudDbConfig } from '../services/cloudDb';
import { generateMemberStatementPDF } from '../utils/pdfGenerator';
import { playGentleChime } from '../utils/notifications';
import { generateQRCodeDataURL } from '../utils/qrcode';
import { DigitalIDCardModal } from './DigitalIDCardModal';

interface AdminPortalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated?: () => void;
}

const MONTHS_2026 = [
  { key: '2026-01', short: 'Jan', name: 'January' },
  { key: '2026-02', short: 'Feb', name: 'February' },
  { key: '2026-03', short: 'Mar', name: 'March' },
  { key: '2026-04', short: 'Apr', name: 'April' },
  { key: '2026-05', short: 'May', name: 'May' },
  { key: '2026-06', short: 'Jun', name: 'June' },
  { key: '2026-07', short: 'Jul', name: 'July' },
  { key: '2026-08', short: 'Aug', name: 'August' },
  { key: '2026-09', short: 'Sep', name: 'September' },
  { key: '2026-10', short: 'Oct', name: 'October' },
  { key: '2026-11', short: 'Nov', name: 'November' },
  { key: '2026-12', short: 'Dec', name: 'December' },
];

export const AdminPortal: React.FC<AdminPortalProps> = ({ isOpen, onClose, onSettingsUpdated }) => {
  if (!isOpen) return null;

  const [token, setToken] = useState<string | null>(() => localStorage.getItem('grace_admin_token'));
  const [adminUser, setAdminUser] = useState<any>(() => {
    const saved = localStorage.getItem('grace_admin_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Login form state
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('GraceChurch2026!');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Admin Dashboard state
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'branches' | 'members' | 'events' | 'reports' | 'broadcast' | 'database'>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<AdminMemberListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Cloud Database & Multi-Device Sync State
  const [cloudConfig, setCloudConfig] = useState<CloudDbConfig>(() => getCloudDbConfig());
  const [airtableTokenInput, setAirtableTokenInput] = useState(cloudConfig.airtableToken || '');
  const [airtableBaseInput, setAirtableBaseInput] = useState(cloudConfig.airtableBaseId || '');
  const [customVaultInput, setCustomVaultInput] = useState(cloudConfig.vaultId || '');
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(cloudConfig.supabaseUrl || '');
  const [supabaseKeyInput, setSupabaseKeyInput] = useState(cloudConfig.supabaseAnonKey || '');
  const [selectedProvider, setSelectedProvider] = useState<'cloudvault' | 'airtable' | 'supabase'>(cloudConfig.provider || 'cloudvault');
  const [isTestingAirtable, setIsTestingAirtable] = useState(false);
  const [airtableTestResult, setAirtableTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [cloudToast, setCloudToast] = useState<string | null>(null);

  // Church Settings & Logo State (Tax ID removed)
  const [churchNameInput, setChurchNameInput] = useState('Living Faith Membership Portal');
  const [churchTaglineInput, setChurchTaglineInput] = useState('Living Faith International Assemblies • Stewardship & Member Records');
  const [churchLogoInput, setChurchLogoInput] = useState('');
  const [churchAddressInput, setChurchAddressInput] = useState('Living Faith Cathedral Campus, Lilongwe, Malawi');
  const [churchPhoneInput, setChurchPhoneInput] = useState('+265 99 123 4567');
  const [churchEmailInput, setChurchEmailInput] = useState('office@livingfaithportal.org');
  const [churchPastorInput, setChurchPastorInput] = useState('Senior Pastor');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsToast, setSettingsToast] = useState<string | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/png');
        setChurchLogoInput(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setChurchLogoInput('');
    if (logoFileInputRef.current) {
      logoFileInputRef.current.value = '';
    }
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');

  // Full-screen state
  const [isFullScreen, setIsFullScreen] = useState(false);

  const handleResetCleanSlate = async () => {
    const confirmReset = window.confirm(
      'Are you sure you want to clear all test member registrations, dues records, events, and announcements to start with a 100% clean slate? Your 4 branches and church profile will be preserved.'
    );
    if (!confirmReset) return;

    try {
      if (token) {
        await resetAdminCleanSlate(token);
      }
      localStore.clearAllDataAndReset();
      setMembers([]);
      setAdminEvents([]);
      setStats({
        membersCount: 0,
        greenCount: 0,
        orangeCount: 0,
        redCount: 0,
        branchesCount: branches.length || 4,
        branches: branches,
        overdueMembers: [],
        recentContributions: [],
      });
      setDuesToast('All demo data cleared. Living Faith Portal is now completely clean.');
      playGentleChime();
      setTimeout(() => setDuesToast(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to reset data');
    }
  };

  const filteredMembers = members.filter((m) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      m.full_name.toLowerCase().includes(query) ||
      m.member_number.toLowerCase().includes(query) ||
      m.phone.toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    const matchesBranch = branchFilter === 'all' || m.branch_id.toString() === branchFilter;
    return matchesSearch && matchesStatus && matchesBranch;
  });

  // Branch Modal State
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [branchCurrencySymbol, setBranchCurrencySymbol] = useState('$');
  const [branchCurrencyCode, setBranchCurrencyCode] = useState('USD');
  const [branchDefaultDue, setBranchDefaultDue] = useState('20.00');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchToast, setBranchToast] = useState<string | null>(null);

  // Dues Ticking & Modal State
  const [duesModalMember, setDuesModalMember] = useState<AdminMemberListItem | null>(null);
  const [updatingMonthKey, setUpdatingMonthKey] = useState<string | null>(null);
  const [duesToast, setDuesToast] = useState<string | null>(null);

  // Events Management State
  const [adminEvents, setAdminEvents] = useState<ChurchEvent[]>([]);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ChurchEvent | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventCategory, setEventCategory] = useState<'service' | 'volunteer' | 'revival' | 'event' | 'ministry'>('service');
  const [eventStart, setEventStart] = useState('2026-10-04 09:30');
  const [eventEnd, setEventEnd] = useState('2026-10-04 12:00');
  const [eventLocation, setEventLocation] = useState('Main Sanctuary');
  const [eventMinistry, setEventMinistry] = useState('General Congregation');
  const [eventToast, setEventToast] = useState<string | null>(null);

  // Broadcast Form
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | string>('all');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);

  // Digital ID Card State
  const [cardModalMember, setCardModalMember] = useState<Member | null>(null);
  const [cardModalQR, setCardModalQR] = useState<string>('');

  // Fetch admin data
  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    setLoading(true);

    Promise.all([
      fetchAdminStats(token),
      fetchAdminBranches(token),
      fetchAdminMembers(token, {
        search: searchQuery || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        branchId: branchFilter === 'all' ? undefined : branchFilter,
      }),
      fetchAdminEvents(token),
      fetchAdminChurchSettings(token),
    ])
      .then(([statsData, branchesData, membersData, eventsData, churchData]) => {
        if (!isMounted) return;
        setStats(statsData);
        setBranches(branchesData);
        setMembers(membersData);
        setAdminEvents(eventsData);

        if (churchData) {
          setChurchNameInput(churchData.church_name || 'Living Faith Membership Portal');
          setChurchTaglineInput(churchData.tagline || '');
          setChurchLogoInput(churchData.logo_url || '');
          setChurchAddressInput(churchData.address || '');
          setChurchPhoneInput(churchData.phone || '');
          setChurchEmailInput(churchData.email || '');
          setChurchPastorInput(churchData.senior_pastor || '');
        }
      })
      .catch((err) => {
        console.error('Failed to load admin portal data:', err);
        if (err.message && err.message.includes('token')) {
          handleLogout();
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token, refreshTrigger, searchQuery, statusFilter, branchFilter]);

  // Subscribe to Cloud Database updates across devices
  useEffect(() => {
    const unsub = cloudDb.subscribe((cfg) => {
      setCloudConfig(cfg);
    });
    return unsub;
  }, []);

  // Listen for remote data merges to trigger re-fetch of stats and members
  useEffect(() => {
    const onStoreUpdated = () => {
      setRefreshTrigger((prev) => prev + 1);
    };
    window.addEventListener('church_store_updated', onStoreUpdated);
    return () => window.removeEventListener('church_store_updated', onStoreUpdated);
  }, []);

  // Active cross-device auto-sync polling every 5 seconds while Admin Portal is open
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      triggerCloudSync().catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const handleManualSync = async () => {
    setIsSyncingNow(true);
    try {
      await triggerCloudSync();
      setRefreshTrigger((prev) => prev + 1);
      playGentleChime();
      setCloudToast('Synchronized with Cloud Database successfully.');
      setTimeout(() => setCloudToast(null), 3000);
    } catch (e: any) {
      setCloudToast(e.message || 'Sync encountered an issue.');
      setTimeout(() => setCloudToast(null), 4000);
    } finally {
      setIsSyncingNow(false);
    }
  };

  const handleTestAirtable = async () => {
    if (!airtableTokenInput.trim() || !airtableBaseInput.trim()) {
      setAirtableTestResult({ success: false, message: 'Please enter both Personal Access Token and Base ID.' });
      return;
    }
    setIsTestingAirtable(true);
    setAirtableTestResult(null);
    try {
      const res = await testAirtableConnection(airtableTokenInput.trim(), airtableBaseInput.trim());
      setAirtableTestResult(res);
      if (res.success) playGentleChime();
    } catch (e: any) {
      setAirtableTestResult({ success: false, message: e.message || 'Network error reaching Airtable.' });
    } finally {
      setIsTestingAirtable(false);
    }
  };

  const handleSaveCloudSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = updateCloudDbConfig({
      provider: selectedProvider,
      syncEnabled: true,
      vaultId: customVaultInput.trim() || cloudConfig.vaultId,
      airtableToken: airtableTokenInput.trim(),
      airtableBaseId: airtableBaseInput.trim(),
      supabaseUrl: supabaseUrlInput.trim(),
      supabaseAnonKey: supabaseKeyInput.trim(),
    });
    setCloudConfig(updated);
    playGentleChime();
    setCloudToast(`Cloud provider set to ${selectedProvider === 'airtable' ? 'Airtable' : selectedProvider === 'supabase' ? 'Supabase' : 'Free Cloud Vault'}.`);
    setTimeout(() => setCloudToast(null), 3500);
    handleManualSync();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await adminLogin(username, password);
      setToken(res.token);
      setAdminUser(res.user);
      localStorage.setItem('grace_admin_token', res.token);
      localStorage.setItem('grace_admin_user', JSON.stringify(res.user));
      playGentleChime();
    } catch (err: any) {
      setLoginError(err.message || 'Login failed.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setAdminUser(null);
    localStorage.removeItem('grace_admin_token');
    localStorage.removeItem('grace_admin_user');
  };

  // Branch actions
  const handleOpenCreateBranch = () => {
    setEditingBranch(null);
    setBranchName('');
    setBranchCode('');
    setBranchCurrencySymbol('$');
    setBranchCurrencyCode('USD');
    setBranchDefaultDue('20.00');
    setBranchAddress('');
    setIsBranchModalOpen(true);
  };

  const handleOpenEditBranch = (b: Branch) => {
    setEditingBranch(b);
    setBranchName(b.name);
    setBranchCode(b.code);
    setBranchCurrencySymbol(b.currency_symbol);
    setBranchCurrencyCode(b.currency_code);
    setBranchDefaultDue(b.default_monthly_due.toString());
    setBranchAddress(b.address || '');
    setIsBranchModalOpen(true);
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !branchName.trim() || !branchCode.trim()) return;

    try {
      if (editingBranch) {
        await updateAdminBranch(token, editingBranch.id, {
          name: branchName.trim(),
          code: branchCode.trim(),
          currency_symbol: branchCurrencySymbol.trim(),
          currency_code: branchCurrencyCode.trim(),
          default_monthly_due: parseFloat(branchDefaultDue) || 20,
          address: branchAddress.trim(),
        });
        setBranchToast(`Branch ${branchName} updated.`);
      } else {
        await createAdminBranch(token, {
          name: branchName.trim(),
          code: branchCode.trim(),
          currency_symbol: branchCurrencySymbol.trim(),
          currency_code: branchCurrencyCode.trim(),
          default_monthly_due: parseFloat(branchDefaultDue) || 20,
          address: branchAddress.trim(),
        });
        setBranchToast(`Branch ${branchName} created.`);
      }
      setIsBranchModalOpen(false);
      setRefreshTrigger((prev) => prev + 1);
      playGentleChime();
      setTimeout(() => setBranchToast(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save branch');
    }
  };

  // Church Settings save
  const handleSaveChurchSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !churchNameInput.trim()) return;

    setSettingsSaving(true);
    try {
      await updateAdminChurchSettings(token, {
        church_name: churchNameInput.trim(),
        tagline: churchTaglineInput.trim(),
        logo_url: churchLogoInput.trim(),
        address: churchAddressInput.trim(),
        phone: churchPhoneInput.trim(),
        email: churchEmailInput.trim(),
        senior_pastor: churchPastorInput.trim(),
      });
      setSettingsToast('Church details updated successfully.');
      if (onSettingsUpdated) onSettingsUpdated();
      playGentleChime();
      setTimeout(() => setSettingsToast(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to update church settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  // MONTHLY DUES TICKING ACTION (Single click updates status directly)
  const handleToggleMonth = async (m: AdminMemberListItem, monthKey: string) => {
    if (!token) return;
    const isCurrentlyPaid = m.paid_months?.includes(monthKey);
    const newPaidStatus = !isCurrentlyPaid;

    setUpdatingMonthKey(`${m.id}-${monthKey}`);

    try {
      const res = await toggleAdminMemberMonth(token, m.id, monthKey, newPaidStatus);

      // Instantly update members list state
      setMembers((prev) =>
        prev.map((item) => {
          if (item.id === m.id) {
            return {
              ...item,
              status: res.newStatus as any,
              paid_months: res.paidMonths,
            };
          }
          return item;
        })
      );

      // If dues modal is open for this member, update it too
      if (duesModalMember && duesModalMember.id === m.id) {
        setDuesModalMember((prev) =>
          prev
            ? {
                ...prev,
                status: res.newStatus as any,
                paid_months: res.paidMonths,
              }
            : null
        );
      }

      setDuesToast(`${m.full_name}: ${monthKey} marked ${newPaidStatus ? 'PAID' : 'UNPAID'}. Standing: ${res.newStatus.toUpperCase()}`);
      playGentleChime();
      setTimeout(() => setDuesToast(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update dues month.');
    } finally {
      setUpdatingMonthKey(null);
    }
  };

  // MARK UP TO CURRENT MONTH (E.g. up to Sep 2026)
  const handleMarkThroughCurrentMonth = async (m: AdminMemberListItem, throughMonth: string = '2026-09') => {
    if (!token) return;
    setUpdatingMonthKey(`${m.id}-all`);

    try {
      const res = await markAdminMemberThroughMonth(token, m.id, throughMonth);

      setMembers((prev) =>
        prev.map((item) => {
          if (item.id === m.id) {
            return {
              ...item,
              status: res.newStatus as any,
              paid_months: res.paidMonths,
            };
          }
          return item;
        })
      );

      if (duesModalMember && duesModalMember.id === m.id) {
        setDuesModalMember((prev) =>
          prev
            ? {
                ...prev,
                status: res.newStatus as any,
                paid_months: res.paidMonths,
              }
            : null
        );
      }

      setDuesToast(`${m.full_name}: Months through ${throughMonth} marked PAID. Status: ${res.newStatus.toUpperCase()}`);
      playGentleChime();
      setTimeout(() => setDuesToast(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update member dues.');
    } finally {
      setUpdatingMonthKey(null);
    }
  };

  // Event Actions
  const handleOpenCreateEvent = () => {
    setEditingEvent(null);
    setEventTitle('');
    setEventDesc('');
    setEventCategory('service');
    setEventStart('2026-10-04 09:30');
    setEventEnd('2026-10-04 12:00');
    setEventLocation('Main Sanctuary');
    setEventMinistry('General Congregation');
    setIsEventModalOpen(true);
  };

  const handleOpenEditEvent = (ev: ChurchEvent) => {
    setEditingEvent(ev);
    setEventTitle(ev.title);
    setEventDesc(ev.description || '');
    setEventCategory(ev.category as any);
    setEventStart(ev.start_date);
    setEventEnd(ev.end_date || '');
    setEventLocation(ev.location);
    setEventMinistry(ev.target_ministry || 'General Congregation');
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !eventTitle.trim() || !eventStart.trim() || !eventLocation.trim()) return;

    try {
      if (editingEvent) {
        await updateAdminEvent(token, editingEvent.id, {
          title: eventTitle.trim(),
          description: eventDesc.trim(),
          category: eventCategory,
          start_date: eventStart.trim(),
          end_date: eventEnd.trim() || undefined,
          location: eventLocation.trim(),
          target_ministry: eventMinistry.trim(),
        });
        setEventToast('Event updated.');
      } else {
        await createAdminEvent(token, {
          title: eventTitle.trim(),
          description: eventDesc.trim(),
          category: eventCategory,
          start_date: eventStart.trim(),
          end_date: eventEnd.trim() || undefined,
          location: eventLocation.trim(),
          target_ministry: eventMinistry.trim(),
        });
        setEventToast('Event scheduled successfully.');
      }

      setIsEventModalOpen(false);
      setRefreshTrigger((prev) => prev + 1);
      playGentleChime();
      setTimeout(() => setEventToast(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save event');
    }
  };

  const handleDeleteEvent = async (id: number) => {
    if (!token || !window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await deleteAdminEvent(token, id);
      setAdminEvents((prev) => prev.filter((ev) => ev.id !== id));
      playGentleChime();
    } catch (err: any) {
      alert('Failed to delete event');
    }
  };

  // Broadcast
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !broadcastTitle.trim() || !broadcastMessage.trim()) return;

    try {
      await broadcastAdminNotification(token, {
        member_id: broadcastTarget === 'all' ? null : parseInt(broadcastTarget),
        title: broadcastTitle,
        message: broadcastMessage,
      });
      setBroadcastSuccess('Announcement broadcast sent to members!');
      setBroadcastTitle('');
      setBroadcastMessage('');
      setTimeout(() => setBroadcastSuccess(null), 3000);
      playGentleChime();
    } catch (err: any) {
      alert(err.message || 'Failed to broadcast');
    }
  };

  const handleOpenMemberIDCard = async (m: Member) => {
    const qr = await generateQRCodeDataURL(m.member_number);
    setCardModalQR(qr);
    setCardModalMember(m);
  };

  const handleExportMemberPDF = async (m: AdminMemberListItem) => {
    const qr = await generateQRCodeDataURL(m.member_number);
    const currentSettings: ChurchSettings = {
      id: 1,
      church_name: churchNameInput,
      tagline: churchTaglineInput,
      logo_url: churchLogoInput,
      address: churchAddressInput,
      phone: churchPhoneInput,
      email: churchEmailInput,
      senior_pastor: churchPastorInput,
      tax_id: '',
      updated_at: '',
    };
    generateMemberStatementPDF(
      m,
      [],
      {
        totalDues: m.totals.dues,
        totalKingdomInvestment: m.totals.kingdom,
        totalAllTime: m.totals.total,
        currentYearTotal: m.totals.total,
      },
      'September 2026',
      currentSettings,
      qr
    );
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${isFullScreen ? 'p-0' : 'p-1.5 sm:p-3 md:p-4'} bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200`}>
      <div className={`relative w-full ${isFullScreen ? 'h-full max-w-none rounded-none' : 'w-[98vw] max-w-[1536px] h-[95vh] rounded-2xl'} bg-white border border-slate-300 shadow-2xl overflow-hidden text-slate-800 flex flex-col transition-all duration-150`}>
        {/* Top Header */}
        <div className="bg-slate-900 border-b border-slate-800 p-3.5 sm:px-6 flex items-center justify-between gap-3 shrink-0 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white truncate">Church Administration & Records</h3>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                  ADMIN ONLY
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 truncate">
                {token ? `Authenticated as ${adminUser?.name || 'Senior Pastor'}` : 'Password Protected'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {token && (
              <button
                type="button"
                onClick={handleResetCleanSlate}
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 text-xs font-semibold transition border border-amber-900/50"
                title="Wipe demo test registrations to start 100% clean"
              >
                <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Clean Slate</span>
              </button>
            )}
            {token && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-300" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title={isFullScreen ? 'Exit Full Screen' : 'Expand to Full Screen'}
              aria-label="Toggle Full Screen"
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Toast for Dues / Actions */}
        {duesToast && (
          <div className="bg-amber-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>{duesToast}</span>
            </div>
            <button onClick={() => setDuesToast(null)} className="p-1 hover:opacity-80">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Content: Login or Dashboard */}
        {!token ? (
          /* LOGIN SCREEN */
          <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto bg-slate-50">
            <div className="w-full max-w-md bg-white border border-slate-200 p-6 sm:p-8 rounded-2xl shadow-lg space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 mx-auto flex items-center justify-center shadow-sm">
                  <Lock className="w-7 h-7" />
                </div>
                <h4 className="text-xl font-bold text-slate-900">Church Administrator Sign In</h4>
                <p className="text-xs text-slate-600">
                  Manage branches, dues months ticking, member statuses, and announcements.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    {loginError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:bg-white"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  <span className="font-bold text-slate-800 block mb-1">Pre-configured Admin Credentials:</span>
                  <div className="font-mono text-[11px] text-slate-700 space-y-0.5">
                    <div>User: <span className="text-amber-800 font-bold">admin</span></div>
                    <div>Pass: <span className="text-amber-800 font-bold">GraceChurch2026!</span></div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition shadow-sm disabled:opacity-50"
                >
                  {loginLoading ? 'Authenticating...' : 'Sign In to Administration'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* AUTHENTICATED ADMIN DASHBOARD */
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {/* Admin Tools Navigation - All 8 tools guaranteed fully visible */}
            <div className="border-b border-slate-200 bg-slate-100/90 p-1.5 sm:p-2 shrink-0">
              <nav aria-label="Admin Tools" className="grid grid-cols-2 xs:grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-1 sm:gap-1.5 w-full">
                {[
                  { id: 'overview', label: 'Overview', icon: ShieldCheck },
                  { id: 'settings', label: 'Profile & Logo', icon: Church },
                  { id: 'branches', label: 'Branches', count: branches.length, icon: Building },
                  { id: 'members', label: 'Members & Dues', count: members.length, icon: Users },
                  { id: 'events', label: 'Events', count: adminEvents.length, icon: Calendar },
                  { id: 'reports', label: 'Reports', icon: FileText },
                  { id: 'broadcast', label: 'Broadcast', icon: Megaphone },
                  { id: 'database', label: 'Cloud Database', icon: Database },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2 py-2.5 rounded-xl text-xs sm:text-xs md:text-sm transition-all duration-150 text-center select-none ${
                        isActive
                          ? 'bg-white text-amber-950 font-bold shadow-xs border border-amber-300 ring-1 ring-amber-500/20'
                          : 'bg-white/60 hover:bg-white text-slate-700 hover:text-slate-950 border border-slate-200/80 font-medium'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-700' : 'text-slate-500'}`} />
                      <span className="truncate">{tab.label}</span>
                      {typeof tab.count === 'number' && (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                            isActive
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-200/80 text-slate-600'
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Live Cross-Device Cloud Sync Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-6 py-2 bg-gradient-to-r from-amber-50/90 via-slate-50 to-amber-50/90 border-b border-slate-200 text-xs text-slate-700 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    cloudConfig.syncStatus === 'connected' ? 'bg-emerald-400' : cloudConfig.syncStatus === 'syncing' ? 'bg-amber-400' : 'bg-rose-400'
                  }`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    cloudConfig.syncStatus === 'connected' ? 'bg-emerald-500' : cloudConfig.syncStatus === 'syncing' ? 'bg-amber-500' : 'bg-rose-500'
                  }`}></span>
                </span>
                <span className="font-bold text-slate-900 truncate">
                  {cloudConfig.provider === 'airtable'
                    ? 'Airtable Sync Active (Free Plan)'
                    : cloudConfig.provider === 'supabase'
                    ? 'Supabase Sync Active (Free Tier)'
                    : 'Free Cloud Sync Active (Multi-Device)'}
                </span>
                <span className="text-slate-400 hidden sm:inline">•</span>
                <span className="text-slate-600 text-[11px] truncate hidden md:inline">
                  {cloudConfig.syncMessage || 'In sync across devices'}
                </span>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {cloudConfig.lastSyncTime && (
                  <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                    Updated {cloudConfig.lastSyncTime}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncingNow}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-amber-900 border border-amber-300 font-bold text-xs shadow-2xs transition disabled:opacity-50"
                  title="Force instant sync with Cloud Database"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNow ? 'animate-spin text-amber-600' : 'text-amber-700'}`} />
                  <span>{isSyncingNow ? 'Syncing...' : 'Sync Now'}</span>
                </button>
              </div>
            </div>

            {/* Cloud Action Toast */}
            {cloudToast && (
              <div className="bg-emerald-800 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shrink-0 shadow-sm animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>{cloudToast}</span>
                </div>
                <button onClick={() => setCloudToast(null)} className="p-1 hover:opacity-80">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Tab Contents with ample room for scrolling */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 pb-28">
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && stats && (
                <div className="space-y-6">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                      <span className="text-[11px] text-slate-500 uppercase font-bold block">Total Registered</span>
                      <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">{stats.membersCount}</span>
                      <span className="text-[11px] text-slate-500">Across {stats.branchesCount} church branches</span>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-emerald-200 shadow-sm">
                      <span className="text-[11px] text-emerald-800 uppercase font-bold block flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                        Green Light
                      </span>
                      <span className="text-2xl font-bold font-mono text-emerald-800 mt-1 block">{stats.greenCount}</span>
                      <span className="text-[11px] text-slate-500">Up to date on dues</span>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-amber-200 shadow-sm">
                      <span className="text-[11px] text-amber-800 uppercase font-bold block flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                        Orange Light
                      </span>
                      <span className="text-2xl font-bold font-mono text-amber-800 mt-1 block">{stats.orangeCount}</span>
                      <span className="text-[11px] text-slate-500">Current dues pending</span>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-rose-200 shadow-sm">
                      <span className="text-[11px] text-rose-800 uppercase font-bold block flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                        Red Light
                      </span>
                      <span className="text-2xl font-bold font-mono text-rose-800 mt-1 block">{stats.redCount}</span>
                      <span className="text-[11px] text-slate-500">2+ months overdue</span>
                    </div>
                  </div>

                  {/* Branches Summary */}
                  <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        <Building className="w-4 h-4 text-amber-700" />
                        Church Branches & Currencies
                      </h4>
                      <button
                        onClick={() => setActiveTab('branches')}
                        className="text-xs text-amber-800 hover:text-amber-900 font-bold"
                      >
                        Manage Branches →
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {branches.map((b) => (
                        <div key={b.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-800">{b.name}</span>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-bold">
                              {b.code}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 flex items-center gap-2 pt-1">
                            <span>Currency: <strong>{b.currency_symbol} {b.currency_code}</strong></span>
                            <span>•</span>
                            <span>Due: {b.currency_symbol}{b.default_monthly_due.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Overdue Pastoral Attention */}
                  {stats.overdueMembers.length > 0 && (
                    <div className="p-6 rounded-2xl bg-white border border-rose-200 shadow-sm space-y-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-rose-600" />
                        <h4 className="font-bold text-sm text-slate-900">
                          Members Requiring Stewardship Follow-Up ({stats.overdueMembers.length})
                        </h4>
                      </div>

                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                        {stats.overdueMembers.map((m) => (
                          <div key={m.id} className="p-3.5 flex items-center justify-between gap-3 text-xs bg-white">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                  m.status === 'red' ? 'bg-rose-600' : 'bg-amber-600'
                                }`}
                              ></span>
                              <span className="font-bold text-slate-900">{m.full_name}</span>
                              <span className="font-mono text-amber-800 font-semibold">({m.member_number})</span>
                              <span className="text-slate-500">• {m.branch_name}</span>
                            </div>
                            <button
                              onClick={() => {
                                const found = members.find((x) => x.id === m.id);
                                if (found) setDuesModalMember(found);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 text-xs font-bold"
                            >
                              Tick Dues Months →
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: CHURCH SETTINGS & LOGO */}
              {activeTab === 'settings' && (
                <div className="max-w-3xl mx-auto bg-white border border-slate-200 p-6 sm:p-8 rounded-2xl shadow-sm space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <div>
                      <h4 className="font-bold text-base text-slate-900 flex items-center gap-2">
                        <Church className="w-5 h-5 text-amber-700" />
                        Church Profile & Brand Settings
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Update the church branding, official logo, senior pastor, and contact info displayed on statements and digital ID cards.
                      </p>
                    </div>
                  </div>

                  {settingsToast && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                      {settingsToast}
                    </div>
                  )}

                  <form onSubmit={handleSaveChurchSettings} className="space-y-4 text-xs">
                    <div>
                      <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Church Full Name *
                      </label>
                      <input
                        type="text"
                        value={churchNameInput}
                        onChange={(e) => setChurchNameInput(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:bg-white font-serif"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Tagline / Subtitle
                      </label>
                      <input
                        type="text"
                        value={churchTaglineInput}
                        onChange={(e) => setChurchTaglineInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Church Logo (File Upload)
                      </label>
                      <p className="text-xs text-slate-500 mb-2">
                        Upload your church's official logo or emblem file. Displayed on digital ID cards, official receipts, and platform header.
                      </p>

                      <input
                        ref={logoFileInputRef}
                        type="file"
                        accept="image/png, image/jpeg, image/jpg, image/webp"
                        onChange={handleLogoFileUpload}
                        className="hidden"
                      />

                      {churchLogoInput ? (
                        <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                          <div className="w-16 h-16 rounded-xl bg-white border border-slate-300 p-1 shrink-0 flex items-center justify-center shadow-xs overflow-hidden">
                            <img
                              src={churchLogoInput}
                              alt="Church Logo"
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              Official Logo File Attached
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Logo is loaded and ready. Click "Save Church Profile" below to apply.
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                type="button"
                                onClick={() => logoFileInputRef.current?.click()}
                                className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors flex items-center gap-1.5"
                              >
                                <Upload className="w-3 h-3" />
                                Change Logo File
                              </button>
                              <button
                                type="button"
                                onClick={handleRemoveLogo}
                                className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors flex items-center gap-1.5"
                              >
                                <X className="w-3 h-3" />
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => logoFileInputRef.current?.click()}
                          className="w-full py-6 px-4 border-2 border-dashed border-slate-300 hover:border-amber-600 rounded-xl bg-slate-50 hover:bg-amber-50/40 text-center transition-all cursor-pointer group flex flex-col items-center justify-center gap-2"
                        >
                          <div className="w-10 h-10 rounded-full bg-white border border-slate-200 group-hover:border-amber-400 group-hover:bg-amber-100/50 flex items-center justify-center text-slate-600 group-hover:text-amber-700 transition-colors shadow-xs">
                            <Upload className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800 group-hover:text-amber-800">
                              Upload Church Logo File
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Click to choose an image from your computer or phone (PNG, JPG, WEBP)
                            </p>
                          </div>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                          Senior Pastor / Overseer
                        </label>
                        <input
                          type="text"
                          value={churchPastorInput}
                          onChange={(e) => setChurchPastorInput(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                          Church Phone Number
                        </label>
                        <input
                          type="text"
                          value={churchPhoneInput}
                          onChange={(e) => setChurchPhoneInput(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                          Official Church Email
                        </label>
                        <input
                          type="email"
                          value={churchEmailInput}
                          onChange={(e) => setChurchEmailInput(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                          Campus / Cathedral Address
                        </label>
                        <input
                          type="text"
                          value={churchAddressInput}
                          onChange={(e) => setChurchAddressInput(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:bg-white"
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={handleResetCleanSlate}
                        className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-800 text-slate-600 font-semibold text-xs transition border border-slate-200 inline-flex items-center justify-center gap-1.5"
                        title="Clear all demo/test data and start with 0 members"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                        Clear Demo Data (Clean Slate)
                      </button>

                      <button
                        type="submit"
                        disabled={settingsSaving}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition"
                      >
                        {settingsSaving ? 'Saving...' : 'Save Church Profile'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 3: BRANCHES & CURRENCIES */}
              {activeTab === 'branches' && (
                <div className="space-y-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        <Building className="w-4 h-4 text-amber-700" />
                        Church Branches & Currency Configuration
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Define church branches and specify the local currency (USD, ZAR, GBP, etc.) used for dues. Member IDs are automatically prefixed with the branch code.
                      </p>
                    </div>

                    <button
                      onClick={handleOpenCreateBranch}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Add New Church Branch
                    </button>
                  </div>

                  {/* Branches Table */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3.5">Branch Name</th>
                          <th className="p-3.5">ID Prefix Code</th>
                          <th className="p-3.5">Branch Currency</th>
                          <th className="p-3.5">Default Monthly Due</th>
                          <th className="p-3.5">Members</th>
                          <th className="p-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {branches.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-50">
                            <td className="p-3.5 font-bold text-slate-900">{b.name}</td>
                            <td className="p-3.5 font-mono text-amber-800 font-bold">{b.code}</td>
                            <td className="p-3.5 font-semibold text-slate-700">
                              <span className="font-mono text-amber-800 mr-1">{b.currency_symbol}</span>
                              {b.currency_code}
                            </td>
                            <td className="p-3.5 font-mono">
                              {b.currency_symbol}{b.default_monthly_due.toFixed(2)}
                            </td>
                            <td className="p-3.5 text-slate-500">{b.member_count || 0}</td>
                            <td className="p-3.5 text-right">
                              <button
                                onClick={() => handleOpenEditBranch(b)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-amber-800" />
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: MEMBERS DIRECTORY & DIRECT MONTHLY DUES TICKING */}
              {activeTab === 'members' && (
                <div className="space-y-4">
                  {/* Banner instructions */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CalendarCheck2 className="w-5 h-5 text-amber-700" />
                        <h4 className="font-bold text-sm text-slate-900">
                          2026 Monthly Dues Coverage — Instant Status Update
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600">
                        Admin can simply <strong>tick the months covered/paid</strong> by clicking on any month below. Status (🟢 Green, 🟠 Orange, 🔴 Red) updates immediately without re-entering payment forms!
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span> Paid
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span> Unpaid
                      </span>
                    </div>
                  </div>

                  {/* Search and Filters */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-1 items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search members by name, ID number, phone..."
                          className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-600 shadow-xs"
                        />
                      </div>

                      <select
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-amber-600 shadow-xs"
                      >
                        <option value="all">All Branches</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id.toString()}>
                            {b.name} ({b.code})
                          </option>
                        ))}
                      </select>

                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-amber-600 shadow-xs"
                      >
                        <option value="all">All Statuses</option>
                        <option value="green">🟢 Green</option>
                        <option value="orange">🟠 Orange</option>
                        <option value="red">🔴 Red</option>
                      </select>
                    </div>
                  </div>

                  {/* Members Table with In-line Dues Ticking */}
                  <div className="border border-slate-200 rounded-2xl overflow-x-auto bg-white shadow-sm">
                    <table className="w-full text-left text-xs min-w-[780px]">
                      <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3.5">Standing</th>
                          <th className="p-3.5">Member</th>
                          <th className="p-3.5">Branch & Dues</th>
                          <th className="p-3.5">2026 Dues Paid Months (Click to Tick / Toggle)</th>
                          <th className="p-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {filteredMembers.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 px-4 text-center">
                              <div className="max-w-sm mx-auto flex flex-col items-center justify-center text-slate-500">
                                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                                  <Users className="w-6 h-6" />
                                </div>
                                <div className="font-bold text-sm text-slate-800">
                                  {members.length === 0 ? 'No Members Registered Yet' : 'No Members Match Your Filter'}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                  {members.length === 0
                                    ? 'Believers who register via the Living Faith Portal registration form will immediately show up here for monthly dues tracking.'
                                    : 'Try clearing the search query or status filter to view all registered members.'}
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredMembers.map((m) => {
                          const paidList = m.paid_months || [];
                          return (
                            <tr key={m.id} className="hover:bg-slate-50">
                              {/* Standing Badge */}
                              <td className="p-3.5 align-middle">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    m.status === 'green'
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : m.status === 'orange'
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                                  }`}
                                >
                                  <span
                                    className={`w-2 h-2 rounded-full ${
                                      m.status === 'green'
                                        ? 'bg-emerald-600'
                                        : m.status === 'orange'
                                        ? 'bg-amber-600'
                                        : 'bg-rose-600'
                                    }`}
                                  ></span>
                                  {m.status}
                                </span>
                              </td>

                              {/* Member Identity & Photo */}
                              <td className="p-3.5 align-middle">
                                <div className="flex items-center gap-2.5">
                                  {m.photo_url ? (
                                    <div className="w-9 h-9 rounded-xl overflow-hidden border border-slate-300 shrink-0">
                                      <img src={m.photo_url} alt={m.full_name} className="w-full h-full object-cover" />
                                    </div>
                                  ) : (
                                    <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-center font-bold text-amber-800 shrink-0 text-xs">
                                      {m.full_name
                                        .split(' ')
                                        .map((n) => n[0])
                                        .join('')
                                        .slice(0, 2)}
                                    </div>
                                  )}

                                  <div>
                                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                      <span>{m.title ? `${m.title} ` : ''}{m.full_name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                                      <span className="text-amber-800 font-bold">{m.member_number}</span>
                                      <span>•</span>
                                      <span>{m.phone}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Branch & Due Amount */}
                              <td className="p-3.5 align-middle">
                                <div className="font-bold text-slate-800">{m.branch_name}</div>
                                <div className="text-[11px] text-slate-500">
                                  Compulsory:{' '}
                                  <strong className="text-slate-800 font-mono">
                                    {m.currency_symbol}{m.monthly_due_amount.toFixed(2)}/mo
                                  </strong>
                                </div>
                              </td>

                              {/* Interactive 12-Month Dues Ticking Grid */}
                              <td className="p-3.5 align-middle">
                                <div className="space-y-1.5">
                                  <div className="flex flex-wrap items-center gap-1">
                                    {MONTHS_2026.map((mo) => {
                                      const isPaid = paidList.includes(mo.key);
                                      const isUpdating = updatingMonthKey === `${m.id}-${mo.key}`;

                                      return (
                                        <button
                                          key={mo.key}
                                          type="button"
                                          disabled={isUpdating}
                                          onClick={() => handleToggleMonth(m, mo.key)}
                                          title={`Click to mark ${mo.name} 2026 as ${isPaid ? 'Unpaid' : 'Paid'}`}
                                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-0.5 border ${
                                            isPaid
                                              ? 'bg-emerald-700 text-white border-emerald-700 hover:bg-rose-700 hover:border-rose-700'
                                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300'
                                          } ${isUpdating ? 'opacity-40' : ''}`}
                                        >
                                          {isPaid ? <Check className="w-2.5 h-2.5 text-white" /> : null}
                                          <span>{mo.short}</span>
                                        </button>
                                      );
                                    })}
                                  </div>

                                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                    <span>
                                      <strong>{paidList.length}</strong> of 12 months covered
                                    </span>
                                    <span>•</span>
                                    <button
                                      type="button"
                                      onClick={() => handleMarkThroughCurrentMonth(m, '2026-09')}
                                      className="text-amber-800 hover:text-amber-900 font-bold underline underline-offset-2"
                                    >
                                      Mark Paid Up to Date (Sep)
                                    </button>
                                  </div>
                                </div>
                              </td>

                              {/* Actions */}
                              <td className="p-3.5 align-middle text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => setDuesModalMember(m)}
                                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 inline-flex items-center gap-1 text-[11px] font-semibold"
                                    title="Open Full Dues Modal"
                                  >
                                    <CalendarCheck2 className="w-3.5 h-3.5 text-amber-700" />
                                    <span>Dues</span>
                                  </button>

                                  <button
                                    onClick={() => handleOpenMemberIDCard(m)}
                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 inline-flex items-center gap-1 text-xs font-semibold"
                                    title="Digital ID Card & QR Code"
                                  >
                                    <QrCode className="w-3.5 h-3.5 text-amber-700" />
                                  </button>

                                  <button
                                    onClick={() => handleExportMemberPDF(m)}
                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 inline-flex items-center gap-1 text-xs font-semibold"
                                    title="Export Statement PDF"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: CHURCH EVENTS */}
              {activeTab === 'events' && (
                <div className="space-y-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-700" />
                        Church Events & Service Schedules
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Schedule upcoming church services, revival meetings, outreach, and conferences displayed on member dashboards.
                      </p>
                    </div>

                    <button
                      onClick={handleOpenCreateEvent}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Schedule New Event
                    </button>
                  </div>

                  {eventToast && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                      {eventToast}
                    </div>
                  )}

                  {adminEvents.length === 0 ? (
                    <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center shadow-sm">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div className="font-bold text-sm text-slate-800">No Church Events Scheduled Yet</div>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                        Services, revival programs, and conferences published here will immediately appear on member dashboards.
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenCreateEvent}
                        className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs inline-flex items-center gap-1.5 transition shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Schedule First Event
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {adminEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                {ev.category}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleOpenEditEvent(ev)}
                                  className="p-1 text-slate-500 hover:text-slate-900"
                                  title="Edit Event"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteEvent(ev.id)}
                                  className="p-1 text-slate-500 hover:text-rose-600"
                                  title="Delete Event"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <h4 className="font-bold text-base text-slate-900">{ev.title}</h4>

                            <div className="space-y-1 text-xs text-slate-600">
                              <div className="flex items-center gap-1.5 text-slate-800 font-mono font-medium">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>{ev.start_date} {ev.end_date ? `— ${ev.end_date}` : ''}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                <span>{ev.location}</span>
                              </div>
                            </div>

                            {ev.description && (
                              <p className="text-xs text-slate-600 leading-relaxed pt-1">
                                {ev.description}
                              </p>
                            )}
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                            <span>Target: {ev.target_ministry || 'All Welcome'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: MEMBER REPORTS */}
              {activeTab === 'reports' && (
                <div className="space-y-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-sm text-slate-900">Member Stewardship Reports</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Download official PDF stewardship and contribution statements with QR code verification for any registered church member:
                    </p>
                  </div>

                  {members.length === 0 ? (
                    <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center shadow-sm">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-2">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="font-bold text-sm text-slate-800">No Members Available For Reporting</div>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                        Once believers register on the Living Faith Portal, you can generate and download their official PDF stewardship statements here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {members.map((m) => (
                        <div key={m.id} className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                m.status === 'green' ? 'bg-emerald-600' : m.status === 'orange' ? 'bg-amber-600' : 'bg-rose-600'
                              }`}
                            ></div>
                            <div>
                              <span className="font-bold text-slate-900">{m.full_name}</span>
                              <span className="font-mono text-amber-800 font-semibold ml-2">({m.member_number})</span>
                              <span className="text-slate-500 ml-2">• {m.branch_name}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleExportMemberPDF(m)}
                            className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold flex items-center gap-1.5 shadow-xs"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download Report PDF
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 7: ANNOUNCEMENTS */}
              {activeTab === 'broadcast' && (
                <div className="max-w-2xl mx-auto bg-white border border-slate-200 p-6 sm:p-8 rounded-2xl shadow-sm space-y-4 text-xs">
                  <h4 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-amber-700" />
                    Broadcast Church Announcement
                  </h4>

                  {broadcastSuccess && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
                      {broadcastSuccess}
                    </div>
                  )}

                  <form onSubmit={handleSendBroadcast} className="space-y-4">
                    <div>
                      <label className="block font-bold uppercase text-slate-700 mb-1">Target</label>
                      <select
                        value={broadcastTarget}
                        onChange={(e) => setBroadcastTarget(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                      >
                        <option value="all">Broadcast to All Members</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id.toString()}>
                            {m.full_name} ({m.member_number})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold uppercase text-slate-700 mb-1">Title</label>
                      <input
                        type="text"
                        value={broadcastTitle}
                        onChange={(e) => setBroadcastTitle(e.target.value)}
                        required
                        placeholder="e.g. Sunday Service Time Update"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase text-slate-700 mb-1">Message</label>
                      <textarea
                        rows={3}
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        required
                        placeholder="Enter announcement text for the congregation..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-sm transition"
                    >
                      Broadcast Announcement
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 8: CLOUD DATABASE & MULTI-DEVICE SYNC */}
              {activeTab === 'database' && (
                <div className="space-y-6">
                  {/* Top Intro */}
                  <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-amber-700" />
                        <h4 className="font-bold text-base text-slate-900">Free Cloud Database & Cross-Device Sync</h4>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          100% FREE • NO SUBSCRIPTION
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 max-w-2xl">
                        Keep church records synchronized across all phones, tablets, and computers in real-time. When believers register on their devices, administrators can safely access and verify their details from any other device. Works identically when deployed to Vercel.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleManualSync}
                      disabled={isSyncingNow}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition disabled:opacity-50 shrink-0"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncingNow ? 'animate-spin' : ''}`} />
                      <span>{isSyncingNow ? 'Syncing...' : 'Sync Now Across Devices'}</span>
                    </button>
                  </div>

                  {/* Status Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Active Database</span>
                      <span className="text-sm font-bold text-slate-900 mt-1 block truncate">
                        {cloudConfig.provider === 'airtable'
                          ? 'Airtable (Free Plan)'
                          : cloudConfig.provider === 'supabase'
                          ? 'Supabase (Free Tier)'
                          : 'Free Cloud Vault'}
                      </span>
                      <span className="text-[10px] text-emerald-700 font-semibold mt-0.5 block flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> No Subscription Ever
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Connection State</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          cloudConfig.syncStatus === 'connected' ? 'bg-emerald-600' : cloudConfig.syncStatus === 'syncing' ? 'bg-amber-500' : 'bg-rose-500'
                        }`}></span>
                        <span className="text-sm font-bold capitalize text-slate-900">
                          {cloudConfig.syncStatus === 'connected' ? 'Connected' : cloudConfig.syncStatus}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Auto-sync every 8s
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Records In Cloud</span>
                      <span className="text-sm font-bold font-mono text-slate-900 mt-1 block">
                        {members.length} Members • {branches.length} Branches
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Available on all devices
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Last Cloud Sync</span>
                      <span className="text-sm font-bold font-mono text-slate-900 mt-1 block truncate">
                        {cloudConfig.lastSyncTime || 'Just now'}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Cross-device verified
                      </span>
                    </div>
                  </div>

                  {/* Provider Selection & Configuration Form */}
                  <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">Select Free Cloud Database Provider</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Choose your preferred database. Both Airtable and the built-in Cloud Vault are 100% free with no recurring subscriptions or credit card requirements:
                      </p>
                    </div>

                    {/* 3 Provider Options */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Option 1: Zero-Setup Cloud Vault */}
                      <div
                        onClick={() => setSelectedProvider('cloudvault')}
                        className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                          selectedProvider === 'cloudvault'
                            ? 'border-amber-600 bg-amber-50/40 ring-1 ring-amber-500/20'
                            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Cloud className="w-4 h-4 text-amber-700" />
                              <span className="font-bold text-sm text-slate-900">Free Cloud Vault</span>
                            </div>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Active / Default
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">
                            Zero setup required. Ready instantly. Syncs members, dues, and announcements across all devices and Vercel.
                          </p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-200/60 text-[10px] text-slate-500 font-semibold flex items-center justify-between">
                          <span>Cost: Free forever</span>
                          {selectedProvider === 'cloudvault' && <Check className="w-3.5 h-3.5 text-amber-700 font-bold" />}
                        </div>
                      </div>

                      {/* Option 2: Airtable (User Requested) */}
                      <div
                        onClick={() => setSelectedProvider('airtable')}
                        className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                          selectedProvider === 'airtable'
                            ? 'border-amber-600 bg-amber-50/40 ring-1 ring-amber-500/20'
                            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Database className="w-4 h-4 text-amber-700" />
                              <span className="font-bold text-sm text-slate-900">Airtable</span>
                            </div>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              Free Plan
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">
                            Connect your free Airtable Base. Visual spreadsheet with 1,000 free records per base. No credit card required.
                          </p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-200/60 text-[10px] text-slate-500 font-semibold flex items-center justify-between">
                          <span>Cost: $0/mo Free Tier</span>
                          {selectedProvider === 'airtable' && <Check className="w-3.5 h-3.5 text-amber-700 font-bold" />}
                        </div>
                      </div>

                      {/* Option 3: Supabase Free Tier */}
                      <div
                        onClick={() => setSelectedProvider('supabase')}
                        className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                          selectedProvider === 'supabase'
                            ? 'border-amber-600 bg-amber-50/40 ring-1 ring-amber-500/20'
                            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <HardDrive className="w-4 h-4 text-amber-700" />
                              <span className="font-bold text-sm text-slate-900">Supabase</span>
                            </div>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                              PostgreSQL Free
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">
                            Connect a free Supabase PostgreSQL project with instant REST API. 500MB free storage forever.
                          </p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-200/60 text-[10px] text-slate-500 font-semibold flex items-center justify-between">
                          <span>Cost: $0/mo Free Tier</span>
                          {selectedProvider === 'supabase' && <Check className="w-3.5 h-3.5 text-amber-700 font-bold" />}
                        </div>
                      </div>
                    </div>

                    {/* Provider Settings Form */}
                    <form onSubmit={handleSaveCloudSettings} className="space-y-4 pt-2">
                      {/* Configuration for Free Cloud Vault */}
                      {selectedProvider === 'cloudvault' && (
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">Zero-Setup Cloud Vault Settings</span>
                            <span className="text-[11px] text-emerald-700 font-semibold">Active & Synchronizing</span>
                          </div>
                          <p className="text-slate-600">
                            The cloud vault automatically mirrors registrations, dues ticking, and church events. Any device visiting the portal links to this shared church database.
                          </p>
                          <div>
                            <label className="block font-bold uppercase text-slate-700 mb-1">
                              Church Cloud Sync Vault ID
                            </label>
                            <input
                              type="text"
                              value={customVaultInput}
                              onChange={(e) => setCustomVaultInput(e.target.value)}
                              placeholder="Default: Global Church Vault"
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-600"
                            />
                            <span className="text-[10px] text-slate-500 block mt-1">
                              All admin devices and member devices using this Vault ID will share the same live data.
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Configuration for Airtable */}
                      {selectedProvider === 'airtable' && (
                        <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-4 text-xs">
                          <div className="space-y-1">
                            <span className="font-bold text-slate-900 block text-sm">Airtable Connection Details</span>
                            <p className="text-slate-600">
                              Airtable allows church admins to view and manage members in a spreadsheet-like interface for 100% free (up to 1,000 records).
                            </p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-bold uppercase text-slate-700 mb-1">
                                Airtable Personal Access Token *
                              </label>
                              <input
                                type="password"
                                value={airtableTokenInput}
                                onChange={(e) => setAirtableTokenInput(e.target.value)}
                                placeholder="pat..."
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-600"
                              />
                              <span className="text-[10px] text-slate-500 block mt-1">
                                Create at{' '}
                                <a
                                  href="https://airtable.com/create/tokens"
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-amber-800 underline font-semibold"
                                >
                                  airtable.com/create/tokens
                                </a>{' '}
                                with <code className="font-mono">data.records:read</code> &amp; <code className="font-mono">data.records:write</code>
                              </span>
                            </div>

                            <div>
                              <label className="block font-bold uppercase text-slate-700 mb-1">
                                Airtable Base ID *
                              </label>
                              <input
                                type="text"
                                value={airtableBaseInput}
                                onChange={(e) => setAirtableBaseInput(e.target.value)}
                                placeholder="app..."
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-600"
                              />
                              <span className="text-[10px] text-slate-500 block mt-1">
                                Found in your Airtable URL: <code className="font-mono">airtable.com/appXXXXXXXX...</code>
                              </span>
                            </div>
                          </div>

                          {/* Airtable Test Connection Button */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleTestAirtable}
                              disabled={isTestingAirtable}
                              className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold text-xs transition disabled:opacity-50 inline-flex items-center gap-1.5"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isTestingAirtable ? 'animate-spin text-amber-700' : ''}`} />
                              <span>{isTestingAirtable ? 'Testing Connection...' : 'Test Airtable Connection'}</span>
                            </button>
                          </div>

                          {airtableTestResult && (
                            <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                              airtableTestResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                            }`}>
                              {airtableTestResult.success ? (
                                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                              ) : (
                                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                              )}
                              <span>{airtableTestResult.message}</span>
                            </div>
                          )}

                          {/* Table structure hint for Airtable */}
                          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1 text-[11px] text-slate-600">
                            <span className="font-bold text-slate-800 block">Recommended Airtable Table:</span>
                            <p>
                              Create a table named <strong className="text-slate-900 font-mono">Members</strong> with columns: <span className="font-mono text-slate-700">Member Number, Full Name, Title, Phone, Email, Branch, Status, Monthly Due Amount, Join Date</span>.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Configuration for Supabase */}
                      {selectedProvider === 'supabase' && (
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 text-xs">
                          <div className="space-y-1">
                            <span className="font-bold text-slate-900 block text-sm">Supabase Connection Details</span>
                            <p className="text-slate-600">
                              Supabase provides a free PostgreSQL database with up to 500MB storage and zero subscription costs.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-bold uppercase text-slate-700 mb-1">
                                Supabase Project URL *
                              </label>
                              <input
                                type="text"
                                value={supabaseUrlInput}
                                onChange={(e) => setSupabaseUrlInput(e.target.value)}
                                placeholder="https://xyzcompany.supabase.co"
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-600"
                              />
                            </div>

                            <div>
                              <label className="block font-bold uppercase text-slate-700 mb-1">
                                Supabase Public Anon Key *
                              </label>
                              <input
                                type="password"
                                value={supabaseKeyInput}
                                onChange={(e) => setSupabaseKeyInput(e.target.value)}
                                placeholder="eyJhbGciOi..."
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-600"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Save Button */}
                      <div className="flex justify-end gap-3 pt-2">
                        <button
                          type="submit"
                          className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition inline-flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4 text-amber-400" />
                          <span>Save &amp; Apply Database Settings</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Vercel & Cross-Device Sync Guide Card */}
                  <div className="bg-amber-50/70 border border-amber-200 p-5 rounded-2xl space-y-3 text-xs text-slate-700">
                    <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
                      <Globe className="w-4.5 h-4.5 text-amber-800" />
                      <span>Cross-Device Sync on Vercel &amp; Production</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                      <div className="p-3 bg-white rounded-xl border border-amber-200/80 space-y-1">
                        <span className="font-bold text-slate-900 block text-xs">1. Believer Registers on Mobile</span>
                        <p className="text-[11px] text-slate-600">
                          When a new member fills the registration form on their phone, the portal saves the profile locally and pushes it to the free cloud database.
                        </p>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-amber-200/80 space-y-1">
                        <span className="font-bold text-slate-900 block text-xs">2. Admin Sees Record on Laptop</span>
                        <p className="text-[11px] text-slate-600">
                          When church admins log in on another device, the portal automatically syncs the registration into the member directory with orange pending status.
                        </p>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-amber-200/80 space-y-1">
                        <span className="font-bold text-slate-900 block text-xs">3. Dues &amp; Verification Mirrored</span>
                        <p className="text-[11px] text-slate-600">
                          When an admin ticks dues as paid or updates events, the changes sync back to the cloud. Believers immediately see their green light status.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL: Dedicated Member Dues Ticking */}
        {duesModalMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl p-6 text-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2.5">
                  <CalendarCheck2 className="w-5 h-5 text-amber-700" />
                  <div>
                    <h4 className="font-bold text-base text-slate-900">{duesModalMember.full_name}</h4>
                    <span className="text-xs text-amber-800 font-mono font-bold">
                      {duesModalMember.member_number} • {duesModalMember.branch_name}
                    </span>
                  </div>
                </div>
                <button onClick={() => setDuesModalMember(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status & Details */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Current Standing</span>
                  <span
                    className={`inline-flex items-center gap-1.5 font-bold uppercase mt-0.5 ${
                      duesModalMember.status === 'green'
                        ? 'text-emerald-800'
                        : duesModalMember.status === 'orange'
                        ? 'text-amber-800'
                        : 'text-rose-800'
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        duesModalMember.status === 'green'
                          ? 'bg-emerald-600'
                          : duesModalMember.status === 'orange'
                          ? 'bg-amber-600'
                          : 'bg-rose-600'
                      }`}
                    ></span>
                    {duesModalMember.status === 'green'
                      ? 'Up to Date'
                      : duesModalMember.status === 'orange'
                      ? 'Dues Pending'
                      : 'Overdue'}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Compulsory Monthly Due</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {duesModalMember.currency_symbol}
                    {duesModalMember.monthly_due_amount.toFixed(2)}/mo
                  </span>
                </div>
              </div>

              {/* Fast Action */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-600">Click any month to toggle covered status:</span>
                <button
                  type="button"
                  onClick={() => handleMarkThroughCurrentMonth(duesModalMember, '2026-09')}
                  className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs shadow-xs"
                >
                  Mark All Up to Sep Paid
                </button>
              </div>

              {/* 12 Months Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-1">
                {MONTHS_2026.map((mo) => {
                  const isPaid = duesModalMember.paid_months?.includes(mo.key);
                  const isUpdating = updatingMonthKey === `${duesModalMember.id}-${mo.key}`;

                  return (
                    <button
                      key={mo.key}
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleToggleMonth(duesModalMember, mo.key)}
                      className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                        isPaid
                          ? 'bg-emerald-700 border-emerald-700 text-white hover:bg-rose-700 hover:border-rose-700'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                      } ${isUpdating ? 'opacity-40' : ''}`}
                    >
                      <span className="text-xs font-bold">{mo.short}</span>
                      <div className="flex items-center gap-1 text-[10px]">
                        {isPaid ? (
                          <>
                            <Check className="w-3 h-3 text-white" />
                            <span className="font-bold">Paid</span>
                          </>
                        ) : (
                          <span className="text-slate-500">Unpaid</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setDuesModalMember(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Create / Edit Branch & Currency */}
        {isBranchModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl p-6 text-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h4 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Building className="w-5 h-5 text-amber-700" />
                  {editingBranch ? 'Edit Church Branch & Currency' : 'Add New Church Branch'}
                </h4>
                <button onClick={() => setIsBranchModalOpen(false)}>
                  <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
                </button>
              </div>

              <form onSubmit={handleSaveBranch} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1">Branch Name *</label>
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    required
                    placeholder="e.g. Lusaka Miracle Center"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold uppercase text-slate-700 mb-1">
                      Branch ID Code Prefix *
                    </label>
                    <input
                      type="text"
                      value={branchCode}
                      onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
                      required
                      placeholder="e.g. LUS or NYC"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                    <span className="text-[10px] text-slate-500">Member IDs will be LUS-1001, etc.</span>
                  </div>

                  <div>
                    <label className="block font-bold uppercase text-slate-700 mb-1">
                      Currency Symbol *
                    </label>
                    <input
                      type="text"
                      value={branchCurrencySymbol}
                      onChange={(e) => setBranchCurrencySymbol(e.target.value)}
                      required
                      placeholder="$, R, £, K, €"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold uppercase text-slate-700 mb-1">
                      Currency Code (ISO)
                    </label>
                    <input
                      type="text"
                      value={branchCurrencyCode}
                      onChange={(e) => setBranchCurrencyCode(e.target.value.toUpperCase())}
                      required
                      placeholder="USD, ZAR, GBP, ZMW"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase text-slate-700 mb-1">
                      Default Monthly Due
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={branchDefaultDue}
                      onChange={(e) => setBranchDefaultDue(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1">Branch Address / City</label>
                  <input
                    type="text"
                    value={branchAddress}
                    onChange={(e) => setBranchAddress(e.target.value)}
                    placeholder="e.g. 100 Independence Avenue, Lusaka"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBranchModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-sm"
                  >
                    {editingBranch ? 'Update Branch' : 'Save Branch'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Create / Edit Event */}
        {isEventModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl p-6 text-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h4 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-700" />
                  {editingEvent ? 'Edit Event' : 'Schedule Church Event'}
                </h4>
                <button onClick={() => setIsEventModalOpen(false)}>
                  <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
                </button>
              </div>

              <form onSubmit={handleSaveEvent} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold uppercase text-slate-700 mb-1">Category</label>
                    <select
                      value={eventCategory}
                      onChange={(e) => setEventCategory(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                    >
                      <option value="service">Worship Service</option>
                      <option value="revival">Revival Night</option>
                      <option value="event">Conference / Summit</option>
                      <option value="volunteer">Community Outreach</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold uppercase text-slate-700 mb-1">Location / Venue *</label>
                    <input
                      type="text"
                      value={eventLocation}
                      onChange={(e) => setEventLocation(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1">Start Date & Time *</label>
                  <input
                    type="text"
                    value={eventStart}
                    onChange={(e) => setEventStart(e.target.value)}
                    required
                    placeholder="YYYY-MM-DD HH:MM (e.g. 2026-10-04 09:30)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={eventDesc}
                    onChange={(e) => setEventDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEventModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-sm"
                  >
                    Save Event
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Digital Membership ID Card Modal for Admin */}
        <DigitalIDCardModal
          isOpen={!!cardModalMember}
          onClose={() => setCardModalMember(null)}
          member={cardModalMember}
          churchSettings={{
            id: 1,
            church_name: churchNameInput,
            tagline: churchTaglineInput,
            logo_url: churchLogoInput,
            address: churchAddressInput,
            phone: churchPhoneInput,
            email: churchEmailInput,
            senior_pastor: churchPastorInput,
            tax_id: '',
            updated_at: '',
          }}
          qrDataUrl={cardModalQR}
        />
      </div>
    </div>
  );
};
