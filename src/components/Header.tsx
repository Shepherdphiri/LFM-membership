import React, { useState } from 'react';
import { TrafficLightStatus, Member, ChurchSettings } from '../types';
import { Church, Lock, Bell, HelpCircle, CheckCircle, AlertTriangle, AlertCircle, ChevronDown, X } from 'lucide-react';

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

  const churchName = churchSettings?.church_name || 'Living Faith Membership Portal';
  const tagline = churchSettings?.tagline || 'Membership & Stewardship Portal';
  const logoUrl = churchSettings?.logo_url;

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-slate-900 border-b border-slate-800 text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Left: Brand / Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={onSwitchMember}
              className="flex items-center gap-3 text-left focus:outline-none"
            >
              {logoUrl && !logoUrl.includes('example.com') ? (
                <img
                  src={logoUrl}
                  alt={churchName}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/living-faith-logo.svg'; }}
                  className="w-10 h-10 rounded-lg object-contain bg-slate-800 border border-slate-700 p-0.5"
                />
              ) : (
                <img
                  src="/living-faith-logo.svg"
                  alt={churchName}
                  className="w-10 h-10 rounded-lg object-contain bg-slate-800 border border-slate-700 p-0.5"
                />
              )}
              <div className="hidden xs:block">
                <h1 className="font-bold text-base text-white font-serif tracking-tight leading-tight">
                  {churchName}
                </h1>
                <p className="text-[11px] text-slate-300 font-medium">
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
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 hover:text-white hover:bg-slate-700 transition"
              >
                <span className="font-mono text-amber-300 font-bold">{member.member_number}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}

            {/* Notification Bell */}
            <button
              onClick={onOpenNotifications}
              className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-slate-950">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* TRAFFIC LIGHT STATUS INDICATOR (Clean, human, non-neon) */}
            {status && (
              <button
                onClick={() => setShowStatusModal(true)}
                className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                  status === 'green'
                    ? 'bg-emerald-800/80 border-emerald-600 text-emerald-100 hover:bg-emerald-700/80'
                    : status === 'orange'
                    ? 'bg-amber-800/80 border-amber-600 text-amber-100 hover:bg-amber-700/80'
                    : 'bg-rose-800/80 border-rose-600 text-rose-100 hover:bg-rose-700/80'
                }`}
                title="Account Standing Indicator - Click for details"
              >
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${
                    status === 'green'
                      ? 'bg-emerald-300'
                      : status === 'orange'
                      ? 'bg-amber-300'
                      : 'bg-rose-300'
                  }`}
                ></span>

                <span className="hidden sm:inline uppercase tracking-wider text-[11px] font-bold">
                  {status === 'green' ? 'Green Light' : status === 'orange' ? 'Orange Light' : 'Red Light'}
                </span>
              </button>
            )}

            {/* Traffic Light Status Indicator (Hidden Admin button as requested) */}
          </div>
        </div>
      </header>

      {/* Traffic Light Detail Explanation Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-6 text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-amber-700" />
                Standing Status System
              </h3>
              <button
                onClick={() => setShowStatusModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div
                className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                  status === 'green'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : status === 'orange'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {status === 'green' ? (
                  <CheckCircle className="w-6 h-6 text-emerald-700 shrink-0" />
                ) : status === 'orange' ? (
                  <AlertTriangle className="w-6 h-6 text-amber-700 shrink-0" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-rose-700 shrink-0" />
                )}
                <div>
                  <h4 className="font-bold text-sm">
                    {status === 'green'
                      ? 'Current: Green Light (Up to Date)'
                      : status === 'orange'
                      ? 'Current: Orange Light (Dues Due)'
                      : 'Current: Red Light (Overdue / Inactive)'}
                  </h4>
                  <p className="text-xs mt-1 leading-relaxed text-slate-600">
                    {statusReason || 'Status calculated automatically from your contribution ledger.'}
                  </p>
                </div>
              </div>

              {/* Status rules breakdown */}
              <div className="space-y-2.5 text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                  How Traffic Light Indicators Work:
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-600 shrink-0"></span>
                  <div>
                    <strong className="text-emerald-900">Green Light:</strong> Membership dues are fully paid for the current month.
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-amber-600 shrink-0"></span>
                  <div>
                    <strong className="text-amber-900">Orange Light:</strong> Prior month was paid, but current month dues are pending payment.
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-rose-600 shrink-0"></span>
                  <div>
                    <strong className="text-rose-900">Red Light:</strong> Membership dues are unpaid for 2 or more consecutive months.
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowStatusModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </>
  );
};
