import React, { useState, useEffect } from 'react';
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
  Sparkles,
} from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'branches' | 'members' | 'events' | 'reports' | 'broadcast'>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<AdminMemberListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Church Settings & Logo State
  const [churchNameInput, setChurchNameInput] = useState('GracePoint Church');
  const [churchTaglineInput, setChurchTaglineInput] = useState('International Assemblies • Stewardship & Member Records');
  const [churchLogoInput, setChurchLogoInput] = useState('');
  const [churchAddressInput, setChurchAddressInput] = useState('1240 Kingdom Way, Central Cathedral Campus');
  const [churchPhoneInput, setChurchPhoneInput] = useState('+1 (555) 234-5678');
  const [churchEmailInput, setChurchEmailInput] = useState('office@gracepointchurch.org');
  const [churchPastorInput, setChurchPastorInput] = useState('Pastor David Sterling');
  const [churchTaxIdInput, setChurchTaxIdInput] = useState('CH-TAX-8921-EX');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsToast, setSettingsToast] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');

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
        branchId: branchFilter === 'all' ? undefined : parseInt(branchFilter),
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
          setChurchNameInput(churchData.church_name || 'GracePoint Church');
          setChurchTaglineInput(churchData.tagline || '');
          setChurchLogoInput(churchData.logo_url || '');
          setChurchAddressInput(churchData.address || '');
          setChurchPhoneInput(churchData.phone || '');
          setChurchEmailInput(churchData.email || '');
          setChurchPastorInput(churchData.senior_pastor || '');
          setChurchTaxIdInput(churchData.tax_id || '');
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
        setBranchToast(`New branch ${branchName} created with currency ${branchCurrencySymbol} (${branchCurrencyCode}).`);
      }

      setIsBranchModalOpen(false);
      setRefreshTrigger((prev) => prev + 1);
      playGentleChime();
      setTimeout(() => setBranchToast(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to save branch');
    }
  };

  // Monthly Dues Ticking: Toggle a specific month
  const handleToggleMonth = async (m: AdminMemberListItem, monthKey: string) => {
    if (!token) return;
    const currentPaid = m.paid_months?.includes(monthKey);
    setUpdatingMonthKey(`${m.id}-${monthKey}`);

    try {
      const res = await toggleAdminMemberMonth(token, m.id, monthKey, !currentPaid);

      // Update in local members list immediately
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

      // If dues modal is open for this member, update it as well
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

      const monthObj = MONTHS_2026.find((x) => x.key === monthKey);
      setDuesToast(
        `${m.full_name}: ${monthObj?.name || monthKey} marked ${
          res.isPaid ? 'PAID' : 'UNPAID'
        }. Standing: ${res.newStatus.toUpperCase()}`
      );
      playGentleChime();
      setTimeout(() => setDuesToast(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update dues month.');
    } finally {
      setUpdatingMonthKey(null);
    }
  };

  // Mark all months up to current month (e.g. 2026-09)
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

      setDuesToast(`${m.full_name}: All months through ${throughMonth} marked PAID. Status: ${res.newStatus.toUpperCase()}`);
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

  const handleDeleteEvent = async (eventId: number) => {
    if (!token) return;
    if (!window.confirm('Delete this event?')) return;
    try {
      await deleteAdminEvent(token, eventId);
      setEventToast('Event deleted.');
      setRefreshTrigger((prev) => prev + 1);
      setTimeout(() => setEventToast(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete event');
    }
  };

  // Church Settings & Logo Save
  const handleSaveChurchSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !churchNameInput.trim()) return;

    setSettingsSaving(true);
    setSettingsToast(null);

    try {
      await updateAdminChurchSettings(token, {
        church_name: churchNameInput.trim(),
        tagline: churchTaglineInput.trim(),
        logo_url: churchLogoInput.trim(),
        address: churchAddressInput.trim(),
        phone: churchPhoneInput.trim(),
        email: churchEmailInput.trim(),
        senior_pastor: churchPastorInput.trim(),
        tax_id: churchTaxIdInput.trim(),
      });

      setSettingsToast('Church profile and logo configuration updated successfully.');
      playGentleChime();
      onSettingsUpdated?.();
      setTimeout(() => setSettingsToast(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to update church settings');
    } finally {
      setSettingsSaving(false);
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
      tax_id: churchTaxIdInput,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 h-[94vh] flex flex-col">
        {/* Top Header */}
        <div className="bg-slate-950 border-b border-slate-800 p-4 sm:px-6 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-100">Church Administration & Member Records</h3>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                  ADMIN ONLY
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {token ? `Authenticated as ${adminUser?.name || 'Pastor Sterling'}` : 'Password Protected'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {token && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Toast for Dues / Actions */}
        {duesToast && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shrink-0 shadow-md">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
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
          <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
            <div className="w-full max-w-md bg-slate-950/80 border border-slate-800 p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center shadow-lg shadow-amber-500/10">
                  <Lock className="w-7 h-7" />
                </div>
                <h4 className="text-xl font-bold text-slate-100">Church Administrator Sign In</h4>
                <p className="text-xs text-slate-400">
                  Manage branches, dues months ticking, member statuses, and announcements.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    {loginError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
                  <span className="font-semibold text-amber-400 block mb-1">Pre-configured Demo Credentials:</span>
                  <div className="font-mono text-[11px] text-slate-300 space-y-0.5">
                    <div>User: <span className="text-amber-300">admin</span></div>
                    <div>Pass: <span className="text-amber-300">GraceChurch2026!</span></div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  {loginLoading ? 'Authenticating...' : 'Sign In to Administration'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* AUTHENTICATED ADMIN DASHBOARD */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Admin Tabs */}
            <div className="flex border-b border-slate-800 overflow-x-auto scrollbar-none bg-slate-950 px-4 shrink-0">
              {[
                { id: 'overview', label: 'Overview', icon: ShieldCheck },
                { id: 'settings', label: 'Church Details & Logo', icon: Church },
                { id: 'branches', label: `Branches & Currencies (${branches.length})`, icon: Building },
                { id: 'members', label: `Members & Dues Ticking (${members.length})`, icon: Users },
                { id: 'events', label: `Church Events (${adminEvents.length})`, icon: Calendar },
                { id: 'reports', label: 'Statements', icon: FileText },
                { id: 'broadcast', label: 'Announcements', icon: Megaphone },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition ${
                      activeTab === tab.id
                        ? 'border-amber-500 text-amber-400 bg-slate-900/50'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && stats && (
                <div className="space-y-6">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[11px] text-slate-400 uppercase font-semibold block">Total Registered</span>
                      <span className="text-2xl font-bold font-mono text-slate-100 mt-1 block">{stats.membersCount}</span>
                      <span className="text-[10px] text-slate-500">Across {stats.branchesCount} church branches</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30">
                      <span className="text-[11px] text-emerald-400 uppercase font-semibold block flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        Green Light
                      </span>
                      <span className="text-2xl font-bold font-mono text-emerald-300 mt-1 block">{stats.greenCount}</span>
                      <span className="text-[10px] text-slate-500">Up to date on dues</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30">
                      <span className="text-[11px] text-amber-400 uppercase font-semibold block flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                        Orange Light
                      </span>
                      <span className="text-2xl font-bold font-mono text-amber-300 mt-1 block">{stats.orangeCount}</span>
                      <span className="text-[10px] text-slate-500">Current dues pending</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-rose-500/30">
                      <span className="text-[11px] text-rose-400 uppercase font-semibold block flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                        Red Light
                      </span>
                      <span className="text-2xl font-bold font-mono text-rose-300 mt-1 block">{stats.redCount}</span>
                      <span className="text-[10px] text-slate-500">2+ months overdue</span>
                    </div>
                  </div>

                  {/* Branches Summary */}
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                        <Building className="w-4 h-4 text-amber-400" />
                        Church Branches & Currencies
                      </h4>
                      <button
                        onClick={() => setActiveTab('branches')}
                        className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
                      >
                        Manage Branches →
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {branches.map((b) => (
                        <div key={b.id} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-200">{b.name}</span>
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                              {b.code}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-2">
                            <span>Currency: <strong className="text-slate-200">{b.currency_symbol} {b.currency_code}</strong></span>
                            <span>•</span>
                            <span>Due: {b.currency_symbol}{b.default_monthly_due.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Overdue Pastoral Attention */}
                  {stats.overdueMembers.length > 0 && (
                    <div className="p-5 rounded-2xl bg-slate-950 border border-rose-500/30 space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-rose-400" />
                        <h4 className="font-bold text-sm text-slate-100">
                          Members Requiring Pastoral Stewardship Follow-Up ({stats.overdueMembers.length})
                        </h4>
                      </div>

                      <div className="divide-y divide-slate-800">
                        {stats.overdueMembers.map((m) => (
                          <div key={m.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`w-2.5 h-2.5 rounded-full ${
                                  m.status === 'red' ? 'bg-rose-500 animate-pulse' : 'bg-amber-400'
                                }`}
                              ></span>
                              <span className="font-bold text-slate-200">{m.full_name}</span>
                              <span className="font-mono text-amber-400">({m.member_number})</span>
                              <span className="text-slate-500">• {m.branch_name}</span>
                            </div>
                            <button
                              onClick={() => {
                                const found = members.find((x) => x.id === m.id);
                                if (found) setDuesModalMember(found);
                              }}
                              className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-[11px] font-semibold"
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
                <div className="max-w-3xl mx-auto bg-slate-950 border border-slate-800 p-6 rounded-2xl space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                      <h4 className="font-bold text-base text-slate-100 flex items-center gap-2">
                        <Church className="w-5 h-5 text-amber-400" />
                        Church Profile & Digital Brand Settings
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Update the church branding, official logo, senior pastor, and contact info displayed on statements and digital ID cards.
                      </p>
                    </div>
                  </div>

                  {settingsToast && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                      {settingsToast}
                    </div>
                  )}

                  <form onSubmit={handleSaveChurchSettings} className="space-y-4 text-xs">
                    <div>
                      <label className="block font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Church Full Name *
                      </label>
                      <input
                        type="text"
                        value={churchNameInput}
                        onChange={(e) => setChurchNameInput(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-serif"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Tagline / Subtitle
                      </label>
                      <input
                        type="text"
                        value={churchTaglineInput}
                        onChange={(e) => setChurchTaglineInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Church Logo (URL or Data URI)
                      </label>
                      <div className="flex gap-3 items-center">
                        <input
                          type="text"
                          value={churchLogoInput}
                          onChange={(e) => setChurchLogoInput(e.target.value)}
                          placeholder="https://... or data:image/png;base64,..."
                          className="flex-1 px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-xs"
                        />
                        {churchLogoInput && (
                          <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 p-0.5 shrink-0 overflow-hidden flex items-center justify-center">
                            <img src={churchLogoInput} alt="Preview" className="w-full h-full object-contain" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Senior Pastor / Minister
                        </label>
                        <input
                          type="text"
                          value={churchPastorInput}
                          onChange={(e) => setChurchPastorInput(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Official Church Contact Phone
                        </label>
                        <input
                          type="text"
                          value={churchPhoneInput}
                          onChange={(e) => setChurchPhoneInput(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Official Office Email
                        </label>
                        <input
                          type="email"
                          value={churchEmailInput}
                          onChange={(e) => setChurchEmailInput(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Church Reg / Tax ID Number
                        </label>
                        <input
                          type="text"
                          value={churchTaxIdInput}
                          onChange={(e) => setChurchTaxIdInput(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Cathedral / Office Physical Address
                      </label>
                      <input
                        type="text"
                        value={churchAddressInput}
                        onChange={(e) => setChurchAddressInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={settingsSaving}
                      className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      {settingsSaving ? 'Saving Changes...' : 'Save Church Details & Logo'}
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 3: BRANCHES & CURRENCIES */}
              {activeTab === 'branches' && (
                <div className="space-y-4">
                  {branchToast && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
                      <span>{branchToast}</span>
                      <button onClick={() => setBranchToast(null)}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div>
                      <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                        <Building className="w-4 h-4 text-amber-400" />
                        Church Branches & Currency Configuration
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Define church branches and specify the local currency (USD, ZAR, GBP, etc.) used for dues. Member IDs are automatically prefixed with the branch code.
                      </p>
                    </div>

                    <button
                      onClick={handleOpenCreateBranch}
                      className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-md shadow-amber-500/20"
                    >
                      <Plus className="w-4 h-4" />
                      Add New Church Branch
                    </button>
                  </div>

                  {/* Branches Table */}
                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold">
                        <tr>
                          <th className="p-3.5">Branch Name</th>
                          <th className="p-3.5">ID Prefix Code</th>
                          <th className="p-3.5">Branch Currency</th>
                          <th className="p-3.5">Default Monthly Due</th>
                          <th className="p-3.5">Members</th>
                          <th className="p-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-200">
                        {branches.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-900/40">
                            <td className="p-3.5 font-bold text-slate-100">{b.name}</td>
                            <td className="p-3.5 font-mono text-amber-400 font-bold">{b.code}</td>
                            <td className="p-3.5 font-semibold text-slate-300">
                              <span className="font-mono text-amber-400 mr-1">{b.currency_symbol}</span>
                              {b.currency_code}
                            </td>
                            <td className="p-3.5 font-mono">
                              {b.currency_symbol}{b.default_monthly_due.toFixed(2)}
                            </td>
                            <td className="p-3.5 text-slate-400">{b.member_count || 0}</td>
                            <td className="p-3.5 text-right">
                              <button
                                onClick={() => handleOpenEditBranch(b)}
                                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold inline-flex items-center gap-1"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-amber-400" />
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

              {/* TAB 4: MEMBERS DIRECTORY & MONTHLY DUES TICKING */}
              {activeTab === 'members' && (
                <div className="space-y-4">
                  {/* Banner instructions */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CalendarCheck2 className="w-5 h-5 text-amber-400" />
                        <h4 className="font-bold text-sm text-slate-100">
                          2026 Monthly Dues Coverage — Instant Status Update
                        </h4>
                      </div>
                      <p className="text-xs text-slate-400">
                        Admin can simply <strong>tick the months covered/paid</strong> by clicking on any month below. Status (🟢 Green, 🟠 Orange, 🔴 Red) updates immediately without re-entering payment forms!
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Paid
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-700"></span> Unpaid
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
                          className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      <select
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                        className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="all">All Statuses</option>
                        <option value="green">🟢 Green</option>
                        <option value="orange">🟠 Orange</option>
                        <option value="red">🔴 Red</option>
                      </select>
                    </div>
                  </div>

                  {/* Members Table with In-line Dues Ticking */}
                  <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950 shadow-sm">
                    <table className="w-full text-left text-xs min-w-[780px]">
                      <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold">
                        <tr>
                          <th className="p-3.5">Standing</th>
                          <th className="p-3.5">Member</th>
                          <th className="p-3.5">Branch & Dues</th>
                          <th className="p-3.5">2026 Dues Paid Months (Click to Tick / Toggle)</th>
                          <th className="p-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-200">
                        {members.map((m) => {
                          const paidList = m.paid_months || [];
                          return (
                            <tr key={m.id} className="hover:bg-slate-900/40">
                              {/* Standing Badge */}
                              <td className="p-3.5 align-middle">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    m.status === 'green'
                                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                      : m.status === 'orange'
                                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                      : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                  }`}
                                >
                                  <span
                                    className={`w-2 h-2 rounded-full ${
                                      m.status === 'green'
                                        ? 'bg-emerald-400'
                                        : m.status === 'orange'
                                        ? 'bg-amber-400'
                                        : 'bg-rose-500'
                                    }`}
                                  ></span>
                                  {m.status}
                                </span>
                              </td>

                              {/* Member Identity & Photo */}
                              <td className="p-3.5 align-middle">
                                <div className="flex items-center gap-2.5">
                                  {m.photo_url ? (
                                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-amber-500/40 shrink-0">
                                      <img src={m.photo_url} alt={m.full_name} className="w-full h-full object-cover" />
                                    </div>
                                  ) : (
                                    <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center font-bold text-amber-400 shrink-0 text-xs">
                                      {m.full_name
                                        .split(' ')
                                        .map((n) => n[0])
                                        .join('')
                                        .slice(0, 2)}
                                    </div>
                                  )}

                                  <div>
                                    <div className="font-bold text-slate-100 flex items-center gap-1.5">
                                      <span>{m.title ? `${m.title} ` : ''}{m.full_name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                                      <span className="text-amber-400 font-bold">{m.member_number}</span>
                                      <span>•</span>
                                      <span>{m.phone}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Branch & Due Amount */}
                              <td className="p-3.5 align-middle">
                                <div className="font-semibold text-slate-300">{m.branch_name}</div>
                                <div className="text-[11px] text-slate-400">
                                  Compulsory:{' '}
                                  <strong className="text-slate-200 font-mono">
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
                                          className={`px-1.5 py-1 rounded text-[10px] font-bold transition flex items-center gap-0.5 border ${
                                            isPaid
                                              ? 'bg-emerald-950 text-emerald-300 border-emerald-700 hover:bg-rose-950/80 hover:text-rose-300 hover:border-rose-700'
                                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-emerald-950/60 hover:text-emerald-300 hover:border-emerald-700'
                                          } ${isUpdating ? 'opacity-40 animate-pulse' : ''}`}
                                        >
                                          {isPaid ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : null}
                                          <span>{mo.short}</span>
                                        </button>
                                      );
                                    })}
                                  </div>

                                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                    <span>
                                      <strong>{paidList.length}</strong> of 12 months covered
                                    </span>
                                    <span>•</span>
                                    <button
                                      type="button"
                                      onClick={() => handleMarkThroughCurrentMonth(m, '2026-09')}
                                      className="text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2"
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
                                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 inline-flex items-center gap-1 text-[11px] font-semibold"
                                    title="Open Full Dues Modal"
                                  >
                                    <CalendarCheck2 className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Dues</span>
                                  </button>

                                  <button
                                    onClick={() => handleOpenMemberIDCard(m)}
                                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 inline-flex items-center gap-1 text-xs font-semibold"
                                    title="Digital ID Card & QR Code"
                                  >
                                    <QrCode className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => handleExportMemberPDF(m)}
                                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                                    title="Export Statement PDF"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: CHURCH EVENTS */}
              {activeTab === 'events' && (
                <div className="space-y-4">
                  {eventToast && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
                      <span>{eventToast}</span>
                      <button onClick={() => setEventToast(null)}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div>
                      <h4 className="font-bold text-sm text-slate-100">Scheduled Services & Church Events</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Events display on user dashboards with dates and locations.</p>
                    </div>

                    <button
                      onClick={handleOpenCreateEvent}
                      className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Add Event
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {adminEvents.map((ev) => (
                      <div key={ev.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                            {ev.category}
                          </span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleOpenEditEvent(ev)} className="p-1 hover:text-slate-200 text-slate-400">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteEvent(ev.id)} className="p-1 hover:text-rose-300 text-rose-400">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <h5 className="font-bold text-sm text-slate-100">{ev.title}</h5>
                        <div className="text-xs text-slate-400 space-y-0.5">
                          <div className="flex items-center gap-1.5 text-slate-300 font-mono">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span>{ev.start_date}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{ev.location}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 6: STATEMENTS & CERTIFIED EXPORTS */}
              {activeTab === 'reports' && (
                <div className="space-y-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <h4 className="font-bold text-sm text-slate-100">Export Certified Statements</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Download official PDF stewardship and contribution statements with QR code verification for any registered church member:
                    </p>
                  </div>

                  <div className="space-y-2">
                    {members.map((m) => (
                      <div key={m.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2.5 h-2.5 rounded-full ${
                              m.status === 'green' ? 'bg-emerald-400' : m.status === 'orange' ? 'bg-amber-400' : 'bg-rose-500'
                            }`}
                          ></div>
                          <div>
                            <span className="font-bold text-slate-200">{m.full_name}</span>
                            <span className="font-mono text-amber-400 ml-2">({m.member_number})</span>
                            <span className="text-slate-500 ml-2">• {m.branch_name}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleExportMemberPDF(m)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download Statement PDF
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 7: ANNOUNCEMENTS */}
              {activeTab === 'broadcast' && (
                <div className="max-w-2xl mx-auto bg-slate-950 border border-slate-800 p-6 rounded-2xl space-y-4 text-xs">
                  <h4 className="font-bold text-base text-slate-100 flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-amber-400" />
                    Broadcast Church Announcement
                  </h4>

                  {broadcastSuccess && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300">
                      {broadcastSuccess}
                    </div>
                  )}

                  <form onSubmit={handleSendBroadcast} className="space-y-3">
                    <div>
                      <label className="block font-bold uppercase text-slate-400 mb-1">Target</label>
                      <select
                        value={broadcastTarget}
                        onChange={(e) => setBroadcastTarget(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm"
                      >
                        <option value="all">📢 All Church Members</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id.toString()}>
                            {m.full_name} ({m.member_number})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold uppercase text-slate-400 mb-1">Title</label>
                      <input
                        type="text"
                        value={broadcastTitle}
                        onChange={(e) => setBroadcastTitle(e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase text-slate-400 mb-1">Message</label>
                      <textarea
                        rows={3}
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-slate-100 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <CalendarCheck2 className="w-5 h-5 text-amber-400" />
                  <div>
                    <h4 className="font-bold text-base">{duesModalMember.full_name}</h4>
                    <span className="text-xs text-amber-400 font-mono font-bold">
                      {duesModalMember.member_number} • {duesModalMember.branch_name}
                    </span>
                  </div>
                </div>
                <button onClick={() => setDuesModalMember(null)}>
                  <X className="w-5 h-5 text-slate-400 hover:text-slate-200" />
                </button>
              </div>

              {/* Status & Details */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Current Standing</span>
                  <span
                    className={`inline-flex items-center gap-1 font-bold uppercase mt-0.5 ${
                      duesModalMember.status === 'green'
                        ? 'text-emerald-400'
                        : duesModalMember.status === 'orange'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        duesModalMember.status === 'green'
                          ? 'bg-emerald-400'
                          : duesModalMember.status === 'orange'
                          ? 'bg-amber-400'
                          : 'bg-rose-500'
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
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Compulsory Monthly Due</span>
                  <span className="font-mono font-bold text-slate-100 text-sm">
                    {duesModalMember.currency_symbol}
                    {duesModalMember.monthly_due_amount.toFixed(2)}/mo
                  </span>
                </div>
              </div>

              {/* Fast Action */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400">Click any month to toggle covered status:</span>
                <button
                  type="button"
                  onClick={() => handleMarkThroughCurrentMonth(duesModalMember, '2026-09')}
                  className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
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
                          ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                      } ${isUpdating ? 'opacity-40 animate-pulse' : ''}`}
                    >
                      <span className="text-xs font-bold">{mo.short}</span>
                      <div className="flex items-center gap-1 text-[10px]">
                        {isPaid ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="font-semibold text-emerald-300">Paid</span>
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
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Create / Edit Branch & Currency */}
        {isBranchModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-slate-100 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h4 className="font-bold text-base flex items-center gap-2">
                  <Building className="w-5 h-5 text-amber-400" />
                  {editingBranch ? 'Edit Church Branch & Currency' : 'Add New Church Branch'}
                </h4>
                <button onClick={() => setIsBranchModalOpen(false)}>
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSaveBranch} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">Branch Name *</label>
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    required
                    placeholder="e.g. Lusaka Miracle Center"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold uppercase text-slate-400 mb-1">
                      Branch ID Code Prefix *
                    </label>
                    <input
                      type="text"
                      value={branchCode}
                      onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
                      required
                      placeholder="e.g. LUS or NYC"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm font-mono uppercase"
                    />
                    <span className="text-[10px] text-slate-500">Member IDs will be LUS-1001, etc.</span>
                  </div>

                  <div>
                    <label className="block font-bold uppercase text-slate-400 mb-1">
                      Currency Symbol *
                    </label>
                    <input
                      type="text"
                      value={branchCurrencySymbol}
                      onChange={(e) => setBranchCurrencySymbol(e.target.value)}
                      required
                      placeholder="$, R, £, K, €"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold uppercase text-slate-400 mb-1">
                      Currency Code (ISO)
                    </label>
                    <input
                      type="text"
                      value={branchCurrencyCode}
                      onChange={(e) => setBranchCurrencyCode(e.target.value.toUpperCase())}
                      required
                      placeholder="USD, ZAR, GBP, ZMW"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase text-slate-400 mb-1">
                      Default Monthly Due
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={branchDefaultDue}
                      onChange={(e) => setBranchDefaultDue(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">Branch Address / City</label>
                  <input
                    type="text"
                    value={branchAddress}
                    onChange={(e) => setBranchAddress(e.target.value)}
                    placeholder="e.g. 100 Independence Avenue, Lusaka"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBranchModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-slate-100 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h4 className="font-bold text-base flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-400" />
                  {editingEvent ? 'Edit Event' : 'Schedule Church Event'}
                </h4>
                <button onClick={() => setIsEventModalOpen(false)}>
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSaveEvent} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">Title *</label>
                  <input
                    type="text"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold uppercase text-slate-400 mb-1">Category</label>
                    <select
                      value={eventCategory}
                      onChange={(e) => setEventCategory(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm"
                    >
                      <option value="service">Worship Service</option>
                      <option value="revival">Revival Night</option>
                      <option value="event">Conference / Summit</option>
                      <option value="volunteer">Community Outreach</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold uppercase text-slate-400 mb-1">Location / Venue *</label>
                    <input
                      type="text"
                      value={eventLocation}
                      onChange={(e) => setEventLocation(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">Start Date & Time *</label>
                  <input
                    type="text"
                    value={eventStart}
                    onChange={(e) => setEventStart(e.target.value)}
                    required
                    placeholder="YYYY-MM-DD HH:MM (e.g. 2026-10-04 09:30)"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={eventDesc}
                    onChange={(e) => setEventDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEventModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
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
            tax_id: churchTaxIdInput,
            updated_at: '',
          }}
          qrDataUrl={cardModalQR}
        />
      </div>
    </div>
  );
};
