import React from 'react';
import { Contribution, Member, ChurchSettings } from '../types';
import { X, CheckCircle, Printer, Church, ShieldCheck } from 'lucide-react';

interface ReceiptModalProps {
  contribution: Contribution | null;
  member: Member;
  churchSettings?: ChurchSettings;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ contribution, member, churchSettings, onClose }) => {
  if (!contribution) return null;

  const churchName = churchSettings?.church_name || 'GracePoint Church';
  const logoUrl = churchSettings?.logo_url;

  const handlePrint = () => {
    window.print();
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'membership_fee':
        return 'Monthly Membership Dues';
      case 'kingdom_investment':
        return 'Kingdom Investment & Expansion';
      default:
        return 'Special Offering';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-750 rounded-xl shadow-xl overflow-hidden text-slate-100">
        {/* Top brand header */}
        <div className="bg-slate-950 border-b border-slate-800 p-5 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
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
              <div>
                <h3 className="font-bold text-base text-slate-100 tracking-tight">{churchName}</h3>
                <p className="text-xs text-slate-400">Official Contribution Receipt</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Receipt Body */}
        <div className="p-6 space-y-6">
          <div className="text-center py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 mb-1">
              <CheckCircle className="w-5 h-5" />
            </div>
            <p className="text-xs uppercase tracking-wider font-semibold text-emerald-400">Payment Verified & Certified</p>
            <p className="text-3xl font-extrabold text-slate-100 mt-1">
              {member.currency_symbol || '$'}{contribution.amount.toFixed(2)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{getCategoryLabel(contribution.category)}</p>
          </div>

          <div className="space-y-3 bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 text-sm">
            <div className="flex justify-between items-center py-1 border-b border-slate-700/40">
              <span className="text-slate-400">Receipt Number</span>
              <span className="font-mono font-bold text-amber-400">{contribution.receipt_no}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-700/40">
              <span className="text-slate-400">Contributor Name</span>
              <span className="font-semibold text-slate-200">{member.full_name}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-700/40">
              <span className="text-slate-400">Membership ID</span>
              <span className="font-mono font-semibold text-slate-200">{member.member_number}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-700/40">
              <span className="text-slate-400">Date Received</span>
              <span className="text-slate-200">{contribution.date}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-700/40">
              <span className="text-slate-400">Payment Method</span>
              <span className="text-slate-200">{contribution.payment_method}</span>
            </div>
            {contribution.for_month && (
              <div className="flex justify-between items-center py-1 border-b border-slate-700/40">
                <span className="text-slate-400">Contribution Period</span>
                <span className="text-slate-200">{contribution.for_month}</span>
              </div>
            )}
            {contribution.notes && (
              <div className="py-1">
                <span className="text-slate-400 text-xs block mb-1">Notes / Purpose</span>
                <span className="text-slate-300 text-xs italic bg-slate-900/60 p-2 rounded block">
                  {contribution.notes}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
            <ShieldCheck className="w-5 h-5 shrink-0 text-amber-400" />
            <p>
              This transaction is verified and officially recorded in the church ledger for member standing and stewardship records.
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>
          <button
            onClick={onClose}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold transition shadow-lg shadow-amber-500/20"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
