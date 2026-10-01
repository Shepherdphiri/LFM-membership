import React, { useState, useEffect, useCallback } from 'react';
import { MemberDashboardData, ChurchSettings } from './types';
import { lookupMember, fetchChurchSettings, triggerCloudSync } from './services/api';
import { Header } from './components/Header';
import { MemberLookup } from './components/MemberLookup';
import { MemberDashboard } from './components/MemberDashboard';
import { NotificationDrawer } from './components/NotificationDrawer';
import { AdminPortal } from './components/AdminPortal';
import { Church } from 'lucide-react';

export default function App() {
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(() => {
    return localStorage.getItem('grace_current_member_id') || null;
  });

  const [churchSettings, setChurchSettings] = useState<ChurchSettings | null>(null);
  const [dashboardData, setDashboardData] = useState<MemberDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);

  // Fetch church branding & profile
  const loadChurchSettings = useCallback(async () => {
    try {
      const settings = await fetchChurchSettings();
      setChurchSettings(settings);
    } catch (e) {
      console.error('Failed to load church settings:', e);
    }
  }, []);

  useEffect(() => {
    loadChurchSettings();
    triggerCloudSync().catch(() => {});
  }, [loadChurchSettings]);

  // Fetch member profile by unique ID
  const fetchMember = useCallback(async (idToFetch: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await lookupMember(idToFetch);
      setDashboardData(data);
      if (data.settings) {
        setChurchSettings(data.settings);
      }
      setCurrentMemberId(data.member.member_number);
      localStorage.setItem('grace_current_member_id', data.member.member_number);
    } catch (err: any) {
      setError(err.message || 'Member account not found.');
      setDashboardData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Real-time listener for cross-device Firestore updates
  useEffect(() => {
    const handleStoreUpdated = () => {
      loadChurchSettings();
      if (currentMemberId) {
        fetchMember(currentMemberId);
      }
    };
    window.addEventListener('church_store_updated', handleStoreUpdated);
    return () => window.removeEventListener('church_store_updated', handleStoreUpdated);
  }, [loadChurchSettings, currentMemberId, fetchMember]);

  // Initial load if an ID was previously stored or in URL query parameters
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get('id') || params.get('member') || params.get('code') || params.get('admin');
      if (urlId) {
        const clean = urlId.trim().toUpperCase();
        if (['2026', 'ADMIN', 'ADMIN-2026', '*2026#', 'TRUE', 'MASTER'].includes(clean)) {
          setIsAdminOpen(true);
          return;
        }
        fetchMember(clean);
        return;
      }
    }

    if (currentMemberId) {
      fetchMember(currentMemberId);
    }
  }, [fetchMember, currentMemberId]);

  const handleLookup = (id: string) => {
    const clean = id.trim().toUpperCase();
    // Master Codes: entering 2026, ADMIN, ADMIN-2026, or *2026# directly opens Admin Portal
    if (['2026', 'ADMIN', 'ADMIN-2026', '*2026#', 'MASTER', 'PASS'].includes(clean)) {
      setError(null);
      setIsAdminOpen(true);
      return;
    }
    fetchMember(id);
  };

  const handleSwitchMember = () => {
    setDashboardData(null);
    setError(null);
    localStorage.removeItem('grace_current_member_id');
  };

  const handleRefresh = () => {
    if (currentMemberId) {
      fetchMember(currentMemberId);
    }
    loadChurchSettings();
  };

  const unreadCount = dashboardData ? dashboardData.notifications.filter((n) => !n.is_read).length : 0;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans selection:bg-amber-600 selection:text-white">
      {/* Header with Church Logo & Traffic Light Indicator */}
      <Header
        member={dashboardData ? dashboardData.member : null}
        status={dashboardData ? dashboardData.status : undefined}
        statusReason={dashboardData ? dashboardData.statusReason : undefined}
        churchSettings={churchSettings || undefined}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        unreadNotificationsCount={unreadCount}
        onSwitchMember={handleSwitchMember}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {loading && !dashboardData ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-3">
            <span className="animate-spin inline-block w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full"></span>
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold text-slate-700">Verifying Member Account</h3>
              <p className="text-xs text-slate-500">Loading records from church database...</p>
            </div>
          </div>
        ) : dashboardData ? (
          <MemberDashboard
            data={dashboardData}
            onRefresh={handleRefresh}
            onSwitchMember={handleSwitchMember}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
          />
        ) : (
          <MemberLookup
            onLookup={handleLookup}
            isLoading={loading}
            errorMessage={error}
            churchSettings={churchSettings || undefined}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 mt-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-600">
            <Church className="w-4 h-4 text-amber-700" />
            <span className="font-semibold text-slate-800">
              {churchSettings?.church_name || 'Living Faith Membership Portal'}
            </span>
            <span>•</span>
            <span className="text-slate-500">
              {churchSettings?.tagline || 'Living Faith International Assemblies • Stewardship & Member Records'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-slate-500">
            {churchSettings?.address && <span>{churchSettings.address}</span>}
            <span>•</span>
            <span className="text-slate-700 font-medium">Developed by Shepherd Zisper Phiri</span>
            <span>•</span>
            <button
              type="button"
              onClick={() => setIsAdminOpen(true)}
              className="text-slate-400 hover:text-slate-600 font-mono text-[11px] transition cursor-pointer select-none focus:outline-none"
              title="2026"
            >
              2026
            </button>
          </div>
        </div>
      </footer>

      {/* Slide-over Notifications */}
      <NotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={dashboardData ? dashboardData.notifications : []}
        member={dashboardData ? dashboardData.member : null}
        onRefresh={handleRefresh}
      />

      {/* Admin Portal Modal */}
      <AdminPortal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        onSettingsUpdated={handleRefresh}
      />
    </div>
  );
}
