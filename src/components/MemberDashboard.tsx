import React, { useState, useEffect } from 'react';
import { MemberDashboardData, Contribution, ChurchEvent } from '../types';
import {
  FileText,
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Download,
  Copy,
  Check,
  Clock,
  ShieldCheck,
  Building2,
  Heart,
  Award,
  Bell,
  Eye,
  MapPin,
  Church,
  QrCode,
} from 'lucide-react';
import { generateMemberStatementPDF } from '../utils/pdfGenerator';
import { generateQRCodeDataURL } from '../utils/qrcode';
import { ReceiptModal } from './ReceiptModal';
import { DigitalIDCardModal } from './DigitalIDCardModal';

interface MemberDashboardProps {
  data: MemberDashboardData;
  onRefresh: () => void;
  onSwitchMember: () => void;
  onOpenNotifications: () => void;
}

export const MemberDashboard: React.FC<MemberDashboardProps> = ({
  data,
  onRefresh,
  onSwitchMember,
  onOpenNotifications,
}) => {
  const { member, status, statusReason, currencySymbol, summary, contributions, upcomingEvents, notifications, settings, paidMonths } = data;

  const [activeTab, setActiveTab] = useState<'contributions' | 'events'>('contributions');
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isDigitalIdOpen, setIsDigitalIdOpen] = useState<boolean>(false);

  const churchName = settings?.church_name || 'GracePoint Church';

  // Generate scannable QR Code for the member's unique ID
  useEffect(() => {
    if (member?.member_number) {
      generateQRCodeDataURL(member.member_number).then((url) => {
        setQrDataUrl(url);
      });
    }
  }, [member?.member_number]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(member.member_number);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleExportPDF = () => {
    generateMemberStatementPDF(member, contributions, summary, 'September 2026', settings, qrDataUrl);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const coveredCount = paidMonths?.length ?? (summary.currentMonthDuesPaid ? 9 : 8);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Profile Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Member Identity & Quick QR */}
          <div className="flex items-start sm:items-center gap-4">
            {member.photo_url ? (
              <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-amber-500/60 shadow shrink-0">
                <img
                  src={member.photo_url}
                  alt={member.full_name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center text-amber-500 font-bold text-xl shrink-0 font-mono">
                {member.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)}
              </div>
            )}

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-100 font-serif">
                  {member.title ? `${member.title} ` : ''}
                  {member.full_name}
                </h2>

                {/* Standing Light Pill */}
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${
                    status === 'green'
                      ? 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                      : status === 'orange'
                      ? 'bg-amber-950 border border-amber-700 text-amber-300'
                      : 'bg-rose-950 border border-rose-700 text-rose-300'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      status === 'green'
                        ? 'bg-emerald-400'
                        : status === 'orange'
                        ? 'bg-amber-400'
                        : 'bg-rose-500'
                    }`}
                  ></span>
                  {status === 'green'
                    ? 'Up to Date'
                    : status === 'orange'
                    ? 'Dues Pending'
                    : 'Overdue'}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                <div className="flex items-center gap-1 font-mono">
                  <span className="text-slate-500">Member ID:</span>
                  <span className="text-amber-400 font-bold">{member.member_number}</span>
                  <button
                    onClick={handleCopyId}
                    className="p-1 text-slate-400 hover:text-slate-200 rounded transition"
                    title="Copy Member ID"
                  >
                    {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <div>•</div>
                <div className="text-slate-300 font-semibold flex items-center gap-1">
                  <Church className="w-3.5 h-3.5 text-slate-400" />
                  {member.branch_name || member.branch_code || 'Main Sanctuary'}
                </div>
                <div>•</div>
                <div>Currency: <strong className="text-slate-200">{currencySymbol} ({member.currency_code})</strong></div>
                <div>•</div>
                <div>Joined: {member.join_date}</div>
              </div>
            </div>
          </div>

          {/* Actions: Digital ID Card, Statement PDF, Notifications, Change ID */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Digital ID Card with QR Button */}
            <button
              onClick={() => setIsDigitalIdOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-600 font-bold text-xs sm:text-sm transition"
              title="Preview and download your digital membership ID card with QR code"
            >
              <QrCode className="w-4 h-4" />
              Digital ID Card
            </button>

            <button
              onClick={handleExportPDF}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm transition"
            >
              <Download className="w-4 h-4" />
              Statement PDF
            </button>

            <button
              onClick={onOpenNotifications}
              className="relative p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 transition"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={onSwitchMember}
              className="px-3 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Change ID
            </button>
          </div>
        </div>

        {/* Traffic Light Standing Banner Bar & Quick QR Box */}
        <div className="mt-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div
            className={`flex-1 p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
              status === 'green'
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                : status === 'orange'
                ? 'bg-amber-950/40 border-amber-800 text-amber-200'
                : 'bg-rose-950/40 border-rose-800 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {status === 'green' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : status === 'orange' ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="font-semibold">{statusReason}</span>
            </div>

            <div className="text-[11px] text-slate-400">
              Compulsory Due: <strong className="font-mono text-slate-200">{currencySymbol}{member.monthly_due_amount.toFixed(2)}/mo</strong>
            </div>
          </div>

          {/* Quick QR code thumbnail badge */}
          {qrDataUrl && (
            <button
              onClick={() => setIsDigitalIdOpen(true)}
              className="p-2 px-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 flex items-center gap-2.5 transition text-left group shrink-0"
              title="Click to view full digital ID card"
            >
              <div className="w-7 h-7 bg-white rounded p-0.5 shrink-0">
                <img src={qrDataUrl} alt="QR Thumbnail" className="w-full h-full object-contain" />
              </div>
              <div className="text-[11px]">
                <span className="font-mono font-bold text-amber-400 block group-hover:text-amber-300">
                  {member.member_number}
                </span>
                <span className="text-slate-400 text-[10px]">View ID Card & QR →</span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* 4 Financial & Stewardship Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monthly Membership Dues (Compulsory) */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Monthly Dues</span>
            <div className="w-7 h-7 rounded bg-slate-950 border border-slate-800 text-amber-400 flex items-center justify-center">
              <Award className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold text-slate-100 font-mono">
              {currencySymbol}{summary.totalDues.toFixed(2)}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Sept 2026: {summary.currentMonthDuesPaid ? 'Covered / Paid' : `Pending (${currencySymbol}${member.monthly_due_amount.toFixed(2)})`}
            </p>
          </div>
          <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">
            {currencySymbol}{member.monthly_due_amount.toFixed(2)} / month compulsory
          </div>
        </div>

        {/* Kingdom Investment (Optional) */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Kingdom Investment</span>
            <div className="w-7 h-7 rounded bg-slate-950 border border-slate-800 text-slate-300 flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold text-slate-100 font-mono">
              {currencySymbol}{summary.totalKingdomInvestment.toFixed(2)}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Building & Missions Fund
            </p>
          </div>
          <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">
            Partner Stewardship
          </div>
        </div>

        {/* Total Given All-Time */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Stewardship</span>
            <div className="w-7 h-7 rounded bg-slate-950 border border-slate-800 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold text-slate-100 font-mono">
              {currencySymbol}{summary.totalAllTime.toFixed(2)}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Total Recorded Given
            </p>
          </div>
          <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">
            Currency: {member.currency_code}
          </div>
        </div>

        {/* 2026 Dues Standing & Months Covered */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Months Covered (2026)</span>
            <div className="w-7 h-7 rounded bg-slate-950 border border-slate-800 text-amber-400 flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold text-slate-100 font-mono">
              {coveredCount} of 12
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {status === 'green' ? '🟢 Fully Up to Date' : status === 'orange' ? '🟠 Current Month Pending' : '🔴 Dues Overdue'}
            </p>
          </div>
          <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">
            Standing: <span className="font-semibold text-slate-300 uppercase">{status}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area Organized by Dates */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 overflow-x-auto scrollbar-none bg-slate-950">
          <button
            onClick={() => setActiveTab('contributions')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition ${
              activeTab === 'contributions'
                ? 'border-amber-500 text-amber-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Contributions Ledger by Date ({contributions.length})
          </button>

          <button
            onClick={() => setActiveTab('events')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition ${
              activeTab === 'events'
                ? 'border-amber-500 text-amber-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            Upcoming Church Events ({upcomingEvents.length})
          </button>
        </div>

        {/* Tab 1: Financial Contributions Ledger (By Dates) */}
        {activeTab === 'contributions' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Official recorded ledger of payments received by church administration.</span>
              <span className="font-mono">
                Total: <strong className="text-slate-200">{currencySymbol}{summary.totalAllTime.toFixed(2)}</strong>
              </span>
            </div>

            {contributions.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                No contribution dates recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                {contributions.map((c) => (
                  <div
                    key={c.id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-900/50 transition"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded bg-slate-900 border border-slate-800 shrink-0 text-slate-300">
                        <DollarSign className="w-4 h-4" />
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm text-slate-100 capitalize">
                            {c.category === 'membership_fee'
                              ? 'Monthly Membership Due'
                              : c.category === 'kingdom_investment'
                              ? 'Kingdom Investment'
                              : 'Special Offering'}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                            {c.receipt_no}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                            <ShieldCheck className="w-3 h-3" />
                            Verified
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-400">
                          <span className="font-semibold text-slate-300">Date: {c.date}</span>
                          <span>•</span>
                          <span>Method: {c.payment_method}</span>
                          {c.for_month && (
                            <>
                              <span>•</span>
                              <span>Month: {c.for_month}</span>
                            </>
                          )}
                        </div>

                        {c.notes && <p className="text-xs text-slate-500 italic mt-0.5">{c.notes}</p>}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-auto w-full sm:w-auto pt-2 sm:pt-0 border-t border-slate-800 sm:border-0">
                      <span className="text-base font-bold font-mono text-slate-100">
                        {currencySymbol}{c.amount.toFixed(2)}
                      </span>
                      <button
                        onClick={() => setSelectedContribution(c)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold transition"
                      >
                        <Eye className="w-3 h-3" />
                        Receipt
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Upcoming Church Events & Services (By Dates) */}
        {activeTab === 'events' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="text-xs text-slate-400">
              Official schedule of upcoming services, meetings, and activities at {churchName}.
            </div>

            {upcomingEvents.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                No upcoming events scheduled at this time.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {upcomingEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-900 text-amber-400 border border-slate-800">
                          {ev.category}
                        </span>
                      </div>

                      <h4 className="font-bold text-sm text-slate-100">{ev.title}</h4>

                      <div className="space-y-1 text-xs text-slate-400">
                        <div className="flex items-center gap-1.5 text-slate-300 font-mono">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{ev.start_date} {ev.end_date ? `— ${ev.end_date}` : ''}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{ev.location}</span>
                        </div>
                      </div>

                      {ev.description && (
                        <p className="text-xs text-slate-400 leading-relaxed pt-1">
                          {ev.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{ev.target_ministry || 'All Welcome'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Printable Receipt Modal */}
      <ReceiptModal
        contribution={selectedContribution}
        member={member}
        churchSettings={settings}
        onClose={() => setSelectedContribution(null)}
      />

      {/* Digital Membership ID Card Modal */}
      <DigitalIDCardModal
        isOpen={isDigitalIdOpen}
        onClose={() => setIsDigitalIdOpen(false)}
        member={member}
        churchSettings={settings}
        qrDataUrl={qrDataUrl}
      />
    </div>
  );
};
