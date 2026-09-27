import React, { useState } from 'react';
import { TrafficLightStatus, Member, ChurchSettings } from '../types';
import { Church, Lock, Bell, HelpCircle, CheckCircle, AlertTriangle, AlertCircle, ChevronDown } from 'lucide-react';

interface HeaderProps {
  member: Member | null;
  status?: TrafficLightStatus;
  statusReason?: string;
  churchSettings?: ChurchSettings;
  onOpenAdmin: () => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount: number;
  onSwitchMember: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  member,
  status,
  statusReason,
  churchSettings,
  onOpenAdmin,
  onOpenNotifications,
  unreadNotificationsCount,
  onSwitchMember,
}) => {
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);

  const churchName = churchSettings?.church_name || 'GracePoint Church';
  const tagline = churchSettings?.tagline || 'Membership & Stewardship';
  const logoUrl = churchSettings?.logo_url;

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Left: Brand / Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={onSwitchMember}
              className="flex items-center gap-3 text-left focus:outline-none"
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={churchName}
                  className="w-10 h-10 rounded-lg object-contain bg-slate-900 border border-slate-700 p-0.5"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-amber-500">
                  <Church className="w-5 h-5" />
                </div>
              )}
              <div className="hidden xs:block">
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-base text-slate-100 font-serif tracking-tight leading-tight">
                    {churchName}
                  </h1>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  {tagline}
                </p>
              </div>
            </button>
          </div>

          {/* Right Actions: Member Switch, Notifications, Traffic Light Indicator & Admin */}
          <div className="flex items-center gap-2 sm:gap-3">
            {member && (
              <button
                onClick={onSwitchMember}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 hover:text-white hover:border-slate-600 transition"
              >
                <span className="font-mono text-amber-400 font-semibold">{member.member_number}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}

            {/* Notification Bell */}
            <button
              onClick={onOpenNotifications}
              className="relative p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-900 bg-slate-950 border border-slate-800 transition"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-slate-950">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* TRAFFIC LIGHT STATUS INDICATOR (Top Right Requirement) */}
            {status && (
              <button
                onClick={() => setShowStatusModal(true)}
                className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                  status === 'green'
                    ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300'
                    : status === 'orange'
                    ? 'bg-amber-950/60 border-amber-600 text-amber-300'
                    : 'bg-rose-950/60 border-rose-600 text-rose-300'
                }`}
                title="Account Standing Indicator - Click for details"
              >
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${
                    status === 'green'
                      ? 'bg-emerald-400'
                      : status === 'orange'
                      ? 'bg-amber-400'
                      : 'bg-rose-500'
                  }`}
                ></span>

                <span className="hidden sm:inline uppercase tracking-wider text-[11px]">
                  {status === 'green' ? 'Green Light' : status === 'orange' ? 'Orange Light' : 'Red Light'}
                </span>
              </button>
            )}

            {/* Admin Portal Toggle */}
            <button
              onClick={onOpenAdmin}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          </div>
        </div>
      </header>

      {/* Traffic Light Detail Explanation Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-amber-400" />
                Standing Status System
              </h3>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-semibold"
              >
                Close
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div
                className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                  status === 'green'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                    : status === 'orange'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                }`}
              >
                {status === 'green' ? (
                  <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
                ) : status === 'orange' ? (
                  <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
                )}
                <div>
                  <h4 className="font-bold text-sm">
                    {status === 'green'
                      ? 'Current: Green Light (Up to Date)'
                      : status === 'orange'
                      ? 'Current: Orange Light (Dues Due)'
                      : 'Current: Red Light (Overdue / Inactive)'}
                  </h4>
                  <p className="text-xs opacity-90 mt-1 leading-relaxed">
                    {statusReason || 'Status calculated automatically from your contribution ledger.'}
                  </p>
                </div>
              </div>

              {/* Status rules breakdown */}
              <div className="space-y-2.5 text-xs text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                  How Traffic Light Indicators Work:
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0"></span>
                  <div>
                    <strong className="text-emerald-400">Green Light:</strong> Membership fees are fully paid for the current month and contributions are up to date.
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0"></span>
                  <div>
                    <strong className="text-amber-400">Orange Light:</strong> Prior month was paid, but current month dues ($25.00) are pending payment.
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0"></span>
                  <div>
                    <strong className="text-rose-400">Red Light:</strong> Membership dues are unpaid for 2 or more consecutive months, requiring pastoral stewardship follow-up.
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowStatusModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </>
  );
};
