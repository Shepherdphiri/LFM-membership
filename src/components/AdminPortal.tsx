import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  updateAdminChurchLogo,
  resetAdminCleanSlate,
  deleteAdminMember,
  markAdminMemberVoid,
  triggerCloudSync,
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
  Ban,
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
  CheckCheck,
} from 'lucide-react';
import { localStore } from '../services/localStore';
import {
  getAllMembersFromFirestore,
  getAllEventsFromFirestore,
  getChurchSettingsFromFirestore,
  subscribeToChurchSettingsFromFirestore,
} from '../services/firebase';
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
  const [password, setPassword] = useState('LivingFaith2026!');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Admin Dashboard state (Clean 7 tools, no database selector clutter)
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'branches' | 'members' | 'events' | 'reports' | 'broadcast'>('overview');
  const [stats, setStats] = useState<AdminStats>(() => localStore.getAdminStats());
  const [branches, setBranches] = useState<Branch[]>(() => localStore.getBranches());
  const [members, setMembers] = useState<AdminMemberListItem[]>(() => localStore.getAdminMembers());
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Cloud Synchronization State
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [cloudToast, setCloudToast] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Live via Google Cloud Firestore');

  // Church Settings & Logo State
  const initialSettings = localStore.getChurchSettings();
  const [churchNameInput, setChurchNameInput] = useState(initialSettings.church_name || 'Living Faith Membership Portal');
  const [churchTaglineInput, setChurchTaglineInput] = useState(initialSettings.tagline || 'Living Faith International Assemblies • Stewardship & Member Records');
  const [churchLogoInput, setChurchLogoInput] = useState(initialSettings.logo_url || '/living-faith-logo.svg');
  const [churchAddressInput, setChurchAddressInput] = useState(initialSettings.address || 'Living Faith Cathedral Campus, Lilongwe, Malawi');
  const [churchPhoneInput, setChurchPhoneInput] = useState(initialSettings.phone || '+265 99 123 4567');
  const [churchEmailInput, setChurchEmailInput] = useState(initialSettings.email || 'office@livingfaithportal.org');
  const [churchPastorInput, setChurchPastorInput] = useState(initialSettings.senior_pastor || 'Senior Pastor');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsToast, setSettingsToast] = useState<string | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  // Always-active computed stats so Overview data is NEVER gone or blank
  const currentStats = useMemo<AdminStats>(() => {
    const local = localStore.getAdminStats();
    const sourceMembers = members.length > 0 ? members : localStore.getAdminMembers();
    const sourceBranches = branches.length > 0 ? branches : localStore.getBranches();

    const greenCount = sourceMembers.filter((m) => m.status === 'green').length;
    const orangeCount = sourceMembers.filter((m) => m.status === 'orange').length;
    const redCount = sourceMembers.filter((m) => m.status === 'red').length;

    const recent = (stats?.recentContributions && stats.recentContributions.length > 0)
      ? stats.recentContributions
      : (local.recentContributions && local.recentContributions.length > 0)
      ? local.recentContributions
      : [];

    return {
      membersCount: sourceMembers.length,
      greenCount: stats && stats.membersCount > 0 ? stats.greenCount : greenCount,
      orangeCount: stats && stats.membersCount > 0 ? stats.orangeCount : orangeCount,
      redCount: stats && stats.membersCount > 0 ? stats.redCount : redCount,
      branchesCount: sourceBranches.length,
      branches: sourceBranches,
      overdueMembers: sourceMembers.filter((m) => m.status !== 'green'),
      recentContributions: recent,
    };
  }, [stats, members, branches]);

  const [logoSyncing, setLogoSyncing] = useState(false);

  const handleUploadAndSyncLogoNow = async (specificLogo?: string) => {
    const targetLogo = specificLogo || churchLogoInput;
    if (!token || !targetLogo) return;

    setLogoSyncing(true);
    try {
      const res = await updateAdminChurchLogo(token, targetLogo);
      setChurchLogoInput(targetLogo);
      setSettingsToast(res.message);
      setCloudToast('Church logo uploaded and synchronized across all connected devices in real time.');
      if (onSettingsUpdated) onSettingsUpdated();
      playGentleChime();
      setTimeout(() => setSettingsToast(null), 3500);
      setTimeout(() => setCloudToast(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to sync logo across devices');
    } finally {
      setLogoSyncing(false);
    }
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, WEBP, or SVG).');
      return;
    }

    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        setChurchLogoInput(dataUrl);
        if (token) {
          await handleUploadAndSyncLogoNow(dataUrl);
        }
      };
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 512;
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

        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }

        let dataUrl: string;
        try {
          dataUrl = canvas.toDataURL('image/webp', 0.92);
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/png');
          }
        } catch (_) {
          dataUrl = canvas.toDataURL('image/png');
        }

        setChurchLogoInput(dataUrl);
        if (token) {
          await handleUploadAndSyncLogoNow(dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    const defaultLogo = '/living-faith-logo.svg';
    setChurchLogoInput(defaultLogo);
    if (logoFileInputRef.current) {
      logoFileInputRef.current.value = '';
    }
    if (token) {
      await handleUploadAndSyncLogoNow(defaultLogo);
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

  // Member Deletion / Void State
  const [deleteModalMember, setDeleteModalMember] = useState<AdminMemberListItem | null>(null);
  const [isDeletingMember, setIsDeletingMember] = useState(false);

  const handleConfirmDeleteMember = async () => {
    if (!token || !deleteModalMember) return;
    setIsDeletingMember(true);
    try {
      await deleteAdminMember(token, deleteModalMember.member_number);
      setMembers((prev) => prev.filter((m) => m.member_number !== deleteModalMember.member_number));
      setRefreshTrigger((prev) => prev + 1);
      setDuesToast(`Member ${deleteModalMember.full_name} (${deleteModalMember.member_number}) permanently deleted.`);
      setDeleteModalMember(null);
      setTimeout(() => setDuesToast(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to delete member.');
    } finally {
      setIsDeletingMember(false);
    }
  };

  const handleConfirmVoidMember = async () => {
    if (!token || !deleteModalMember) return;
    setIsDeletingMember(true);
    try {
      await markAdminMemberVoid(token, deleteModalMember.member_number);
      setMembers((prev) =>
        prev.map((m) =>
          m.member_number === deleteModalMember.member_number ? { ...m, status: 'void' as any } : m
        )
      );
      setRefreshTrigger((prev) => prev + 1);
      setDuesToast(`Member ${deleteModalMember.full_name} (${deleteModalMember.member_number}) marked as VOID.`);
      setDeleteModalMember(null);
      setTimeout(() => setDuesToast(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to void member.');
    } finally {
      setIsDeletingMember(false);
    }
  };

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

    Promise.allSettled([
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
      .then(([statsRes, branchesRes, membersRes, eventsRes, churchRes]) => {
        if (!isMounted) return;
        let statsData = statsRes.status === 'fulfilled' ? statsRes.value : null;
        const branchesData = branchesRes.status === 'fulfilled' ? branchesRes.value : [];
        const membersData = membersRes.status === 'fulfilled' ? membersRes.value : [];
        const eventsData = eventsRes.status === 'fulfilled' ? eventsRes.value : [];
        const churchData = churchRes.status === 'fulfilled' ? churchRes.value : null;

        const finalBranches = branchesData.length > 0 ? branchesData : localStore.getBranches();
        const finalMembers = membersData.length > 0 ? membersData : localStore.getAdminMembers();
        const finalEvents = eventsData.length > 0 ? eventsData : localStore.getEvents();

        const greenCount = finalMembers.filter((m) => m.status === 'green').length;
        const orangeCount = finalMembers.filter((m) => m.status === 'orange').length;
        const redCount = finalMembers.filter((m) => m.status === 'red').length;

        const computedStats: AdminStats = (statsData && statsData.membersCount > 0)
          ? statsData
          : {
              membersCount: finalMembers.length,
              greenCount,
              orangeCount,
              redCount,
              branchesCount: finalBranches.length,
              branches: finalBranches,
              overdueMembers: finalMembers.filter((m) => m.status !== 'green'),
              recentContributions: statsData?.recentContributions || localStore.getAdminStats().recentContributions || [],
            };

        setStats(computedStats);
        setBranches(finalBranches);
        setMembers(finalMembers);
        setAdminEvents(finalEvents);

        if (churchData) {
          setChurchNameInput(churchData.church_name || 'Living Faith Membership Portal');
          setChurchTaglineInput(churchData.tagline || 'Living Faith International Assemblies • Stewardship & Member Records');
          const validLogo = churchData.logo_url && !churchData.logo_url.includes('example.com')
            ? churchData.logo_url
            : '/living-faith-logo.svg';
          setChurchLogoInput(validLogo);
          setChurchAddressInput(churchData.address || 'Living Faith Cathedral Campus, Lilongwe, Malawi');
          setChurchPhoneInput(churchData.phone || '+265 99 123 4567');
          setChurchEmailInput(churchData.email || 'office@livingfaithportal.org');
          setChurchPastorInput(churchData.senior_pastor || 'Senior Pastor');
        }
      })
      .catch((err) => {
        console.error('Failed to load admin portal data:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token, refreshTrigger, searchQuery, statusFilter, branchFilter]);

  // Listen for remote data merges to trigger re-fetch of stats and members
  useEffect(() => {
    const onStoreUpdated = () => {
      setRefreshTrigger((prev) => prev + 1);
    };
    window.addEventListener('church_store_updated', onStoreUpdated);
    return () => window.removeEventListener('church_store_updated', onStoreUpdated);
  }, []);

  // Real-time Firestore subscription to church settings & logo across all devices
  useEffect(() => {
    const unsubscribe = subscribeToChurchSettingsFromFirestore((remote) => {
      if (remote && remote.church_name) {
        setChurchNameInput(remote.church_name);
        if (remote.tagline) setChurchTaglineInput(remote.tagline);
        if (remote.logo_url) setChurchLogoInput(remote.logo_url);
        if (remote.address) setChurchAddressInput(remote.address);
        if (remote.phone) setChurchPhoneInput(remote.phone);
        if (remote.email) setChurchEmailInput(remote.email);
        if (remote.senior_pastor) setChurchPastorInput(remote.senior_pastor);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleManualSync = async () => {
    setIsSyncingNow(true);
    try {
      await triggerCloudSync();
      setLastSyncTime(new Date().toLocaleTimeString());
      setRefreshTrigger((prev) => prev + 1);
      playGentleChime();
      setCloudToast('Google Cloud Firestore synchronized successfully across all devices.');
      setTimeout(() => setCloudToast(null), 3000);
    } catch (e: any) {
      setCloudToast(e.message || 'Sync encountered an issue.');
      setTimeout(() => setCloudToast(null), 4000);
    } finally {
      setIsSyncingNow(false);
    }
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
            {churchLogoInput ? (
              <img
                src={churchLogoInput}
                alt="Church Logo"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/living-faith-logo.svg'; }}
                className="w-10 h-10 rounded-xl object-contain bg-slate-800 border border-slate-700 p-0.5 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white truncate">
                  {churchNameInput || 'Living Faith Membership Portal'}
                </h3>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                  ADMIN
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
                    <div>Pass: <span className="text-amber-800 font-bold">LivingFaith2026!</span></div>
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
            {/* Admin Tools Navigation - All 7 tools guaranteed fully visible */}
            <div className="border-b border-slate-200 bg-slate-100/90 p-1.5 sm:p-2 shrink-0">
              <nav aria-label="Admin Tools" className="grid grid-cols-2 xs:grid-cols-4 sm:grid-cols-4 lg:grid-cols-7 gap-1 sm:gap-1.5 w-full">
                {[
                  { id: 'overview', label: 'Overview', icon: ShieldCheck },
                  { id: 'settings', label: 'Profile & Logo', icon: Church },
                  { id: 'branches', label: 'Branches', count: branches.length, icon: Building },
                  { id: 'members', label: 'Members & Dues', count: members.length, icon: Users },
                  { id: 'events', label: 'Events', count: adminEvents.length, icon: Calendar },
                  { id: 'reports', label: 'Reports', icon: FileText },
                  { id: 'broadcast', label: 'Broadcast', icon: Megaphone },
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

            {/* Live Cross-Device Cloud Sync Status Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-6 py-2 bg-gradient-to-r from-amber-50/90 via-slate-50 to-amber-50/90 border-b border-slate-200 text-xs text-slate-700 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="font-bold text-slate-900 truncate">
                  Live Cloud Synchronization Active
                </span>
                <span className="text-slate-400 hidden sm:inline">•</span>
                <span className="text-slate-600 text-[11px] truncate hidden md:inline">
                  Records, logo &amp; events mirrored across all devices
                </span>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                  {lastSyncTime}
                </span>
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncingNow}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white hover:bg-slate-50 text-amber-900 border border-amber-300 font-bold text-xs shadow-2xs transition disabled:opacity-50"
                  title="Force instant sync with cloud database"
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
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Church Identity Header Banner */}
                  <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        onClick={() => logoFileInputRef.current?.click()}
                        className="relative group cursor-pointer shrink-0"
                        title="Click to upload or update Church Logo across all devices"
                      >
                        <img
                          src={churchLogoInput || '/living-faith-logo.svg'}
                          alt="Church Official Logo"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/living-faith-logo.svg'; }}
                          className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-contain bg-slate-800/90 border border-amber-500/30 p-1 shrink-0 shadow-inner group-hover:ring-2 group-hover:ring-amber-400 transition"
                        />
                        <div className="absolute inset-0 bg-slate-950/70 rounded-xl flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition text-[9px] font-bold text-amber-300">
                          <Camera className="w-4 h-4 mb-0.5" />
                          <span>Change</span>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-lg sm:text-xl font-serif tracking-tight text-white truncate">
                            {churchNameInput || 'Living Faith Membership Portal'}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            Live Sync Active
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5 truncate">
                          {churchTaglineInput || 'Living Faith International Assemblies • Stewardship & Member Records'}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1.5 flex-wrap">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-amber-400" />
                            {churchAddressInput || 'Cathedral Campus, Lilongwe, Malawi'}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-amber-400" />
                            Pastor: {churchPastorInput || 'Senior Pastor'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() => logoFileInputRef.current?.click()}
                        disabled={logoSyncing}
                        className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                        title="Upload Church Logo from computer or mobile"
                      >
                        {logoSyncing ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        <span>{logoSyncing ? 'Syncing...' : 'Upload Logo'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('members')}
                        className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs flex items-center gap-1.5 border border-white/20 transition"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Manage Dues</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('events')}
                        className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs flex items-center gap-1.5 border border-white/20 transition"
                      >
                        <Calendar className="w-3.5 h-3.5 text-amber-300" />
                        <span>Events</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('settings')}
                        className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs flex items-center gap-1.5 border border-white/20 transition"
                      >
                        <Church className="w-3.5 h-3.5 text-amber-300" />
                        <span>Profile & Logo</span>
                      </button>
                    </div>
                  </div>

                  {/* Stewardship Health & Compliance Ratio */}
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          <CheckCheck className="w-4 h-4 text-emerald-600" />
                          Membership Dues Compliance Rate (September 2026)
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Real-time breakdown of members in good standing versus pending or overdue monthly dues.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700 font-mono">
                        <span className="text-emerald-700">
                          {Math.round((currentStats.greenCount / Math.max(currentStats.membersCount, 1)) * 100)}% Up To Date
                        </span>
                      </div>
                    </div>

                    {/* Multi-segment Progress Bar */}
                    <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex">
                      <div
                        style={{ width: `${(currentStats.greenCount / Math.max(currentStats.membersCount, 1)) * 100}%` }}
                        className="h-full bg-emerald-500 transition-all duration-300"
                        title={`Green (Up to date): ${currentStats.greenCount}`}
                      />
                      <div
                        style={{ width: `${(currentStats.orangeCount / Math.max(currentStats.membersCount, 1)) * 100}%` }}
                        className="h-full bg-amber-500 transition-all duration-300"
                        title={`Orange (Pending): ${currentStats.orangeCount}`}
                      />
                      <div
                        style={{ width: `${(currentStats.redCount / Math.max(currentStats.membersCount, 1)) * 100}%` }}
                        className="h-full bg-rose-500 transition-all duration-300"
                        title={`Red (Overdue): ${currentStats.redCount}`}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 pt-1">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        Green: <strong>{currentStats.greenCount}</strong> members ({Math.round((currentStats.greenCount / Math.max(currentStats.membersCount, 1)) * 100)}%)
                      </span>
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                        Orange: <strong>{currentStats.orangeCount}</strong> members ({Math.round((currentStats.orangeCount / Math.max(currentStats.membersCount, 1)) * 100)}%)
                      </span>
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                        Red: <strong>{currentStats.redCount}</strong> members ({Math.round((currentStats.redCount / Math.max(currentStats.membersCount, 1)) * 100)}%)
                      </span>
                    </div>
                  </div>

                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                      <span className="text-[11px] text-slate-500 uppercase font-bold block">Total Registered</span>
                      <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">{currentStats.membersCount}</span>
                      <span className="text-[11px] text-slate-500">Across {currentStats.branchesCount} church branches</span>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-emerald-200 shadow-sm">
                      <span className="text-[11px] text-emerald-800 uppercase font-bold block flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                        Green Light
                      </span>
                      <span className="text-2xl font-bold font-mono text-emerald-800 mt-1 block">{currentStats.greenCount}</span>
                      <span className="text-[11px] text-slate-500">Up to date on dues</span>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-amber-200 shadow-sm">
                      <span className="text-[11px] text-amber-800 uppercase font-bold block flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                        Orange Light
                      </span>
                      <span className="text-2xl font-bold font-mono text-amber-800 mt-1 block">{currentStats.orangeCount}</span>
                      <span className="text-[11px] text-slate-500">Current dues pending</span>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-rose-200 shadow-sm">
                      <span className="text-[11px] text-rose-800 uppercase font-bold block flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                        Red Light
                      </span>
                      <span className="text-2xl font-bold font-mono text-rose-800 mt-1 block">{currentStats.redCount}</span>
                      <span className="text-[11px] text-slate-500">2+ months overdue</span>
                    </div>
                  </div>

                  {/* Recent Stewardship Contributions & Dues Activity */}
                  <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-amber-700" />
                          Recent Stewardship Dues & Contributions Ledger
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Latest member dues receipts mirrored across Google Cloud Firestore and church branches.
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab('reports')}
                        className="text-xs text-amber-800 hover:text-amber-900 font-bold"
                      >
                        View Full Ledger in Reports →
                      </button>
                    </div>

                    {currentStats.recentContributions && currentStats.recentContributions.length > 0 ? (
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                            <tr>
                              <th className="p-3">Receipt No</th>
                              <th className="p-3">Member</th>
                              <th className="p-3">Category</th>
                              <th className="p-3">Coverage</th>
                              <th className="p-3">Amount</th>
                              <th className="p-3">Method</th>
                              <th className="p-3">Date</th>
                              <th className="p-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {currentStats.recentContributions.slice(0, 8).map((c) => (
                              <tr key={c.id} className="hover:bg-slate-50/80 transition">
                                <td className="p-3 font-mono text-slate-700 font-bold">{c.receipt_no}</td>
                                <td className="p-3">
                                  <div className="font-bold text-slate-900">{c.member_name}</div>
                                  <div className="font-mono text-[10px] text-amber-800">{c.member_number}</div>
                                </td>
                                <td className="p-3 text-slate-600 capitalize">
                                  {c.category === 'membership_fee' ? 'Monthly Dues' : c.category.replace('_', ' ')}
                                </td>
                                <td className="p-3 font-mono text-slate-700">{c.for_month || '—'}</td>
                                <td className="p-3 font-bold font-mono text-slate-900">
                                  {c.currency_symbol || '$'}{Number(c.amount).toFixed(2)}
                                </td>
                                <td className="p-3 text-slate-600 capitalize">
                                  {c.payment_method?.replace('_', ' ') || 'Cash'}
                                </td>
                                <td className="p-3 text-slate-500 font-mono text-[11px]">{c.date}</td>
                                <td className="p-3">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                                    Verified
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-6 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500">
                        No recent contributions recorded. Tick dues on the Members tab to record dues payments.
                      </div>
                    )}
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
                  {currentStats.overdueMembers.length > 0 && (
                    <div className="p-6 rounded-2xl bg-white border border-rose-200 shadow-sm space-y-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-rose-600" />
                        <h4 className="font-bold text-sm text-slate-900">
                          Members Requiring Stewardship Follow-Up ({currentStats.overdueMembers.length})
                        </h4>
                      </div>

                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                        {currentStats.overdueMembers.map((m) => (
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
                        accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml, .png, .jpg, .jpeg, .webp, .svg"
                        onChange={handleLogoFileUpload}
                        className="hidden"
                      />

                      {churchLogoInput ? (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                          <div className="w-20 h-20 rounded-xl bg-white border border-slate-300 p-1.5 shrink-0 flex items-center justify-center shadow-xs overflow-hidden">
                            <img
                              src={churchLogoInput}
                              alt="Church Logo Preview"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/living-faith-logo.svg'; }}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                Official Church Logo Attached
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                                Real-Time Cloud Sync
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                              This logo is broadcast live via Google Cloud Firestore to all connected devices, member digital ID cards, official dues receipts, and header displays.
                            </p>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleUploadAndSyncLogoNow()}
                                disabled={logoSyncing}
                                className="px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                              >
                                {logoSyncing ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Cloud className="w-3.5 h-3.5 text-slate-950" />
                                )}
                                <span>{logoSyncing ? 'Syncing to Devices...' : 'Sync Logo to All Devices Now'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => logoFileInputRef.current?.click()}
                                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors flex items-center gap-1.5"
                              >
                                <Upload className="w-3 h-3 text-slate-600" />
                                Change Logo File
                              </button>
                              <button
                                type="button"
                                onClick={handleRemoveLogo}
                                className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors flex items-center gap-1.5"
                              >
                                <X className="w-3 h-3 text-rose-600" />
                                Reset to Default Emblem
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
                              Click to choose an image from your computer or phone (PNG, JPG, WEBP, SVG)
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
                                    m.status === 'void'
                                      ? 'bg-slate-100 text-slate-500 border border-slate-300 line-through'
                                      : m.status === 'green'
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : m.status === 'orange'
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                                  }`}
                                >
                                  <span
                                    className={`w-2 h-2 rounded-full ${
                                      m.status === 'void'
                                        ? 'bg-slate-400'
                                        : m.status === 'green'
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

                                  <button
                                    onClick={() => setDeleteModalMember(m)}
                                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 border border-rose-200 inline-flex items-center gap-1 text-xs font-semibold transition"
                                    title="Delete or Void Member"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
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

        {/* Member Control, Voiding & Deletion Confirmation Modal */}
        {deleteModalMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800">
              <div className="p-6">
                <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Member Control & Registry Removal
                </h3>
                <p className="text-xs text-slate-600 mt-2">
                  You are managing member <strong className="text-slate-900">{deleteModalMember.full_name}</strong> (ID:{' '}
                  <span className="font-mono text-amber-800 font-bold">{deleteModalMember.member_number}</span>). Choose how you would like to proceed:
                </p>

                <div className="mt-5 space-y-3">
                  <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-xs">
                    <div className="font-bold text-amber-900 flex items-center gap-1.5">
                      <Ban className="w-4 h-4 text-amber-700" />
                      Option 1: Mark as VOID
                    </div>
                    <p className="text-amber-800 mt-1">
                      Deactivates the member's account and revokes their lookup access while keeping historical records.
                    </p>
                    <button
                      type="button"
                      onClick={handleConfirmVoidMember}
                      disabled={isDeletingMember}
                      className="mt-3 w-full py-2 px-3 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs transition cursor-pointer"
                    >
                      {isDeletingMember ? 'Processing...' : 'Mark Account as VOID'}
                    </button>
                  </div>

                  <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-xs">
                    <div className="font-bold text-rose-900 flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      Option 2: Delete Permanently
                    </div>
                    <p className="text-rose-800 mt-1">
                      Completely removes this member, all contributions, and receipts from Google Firestore and local storage. This action cannot be undone.
                    </p>
                    <button
                      type="button"
                      onClick={handleConfirmDeleteMember}
                      disabled={isDeletingMember}
                      className="mt-3 w-full py-2 px-3 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs transition cursor-pointer"
                    >
                      {isDeletingMember ? 'Deleting...' : 'Delete Member Permanently'}
                    </button>
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setDeleteModalMember(null)}
                    disabled={isDeletingMember}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
