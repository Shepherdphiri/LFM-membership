import React from 'react';
import { Contribution, Member, ChurchSettings } from '../types';
import { X, CheckCircle, Printer, Church } from 'lucide-react';

interface ReceiptModalProps {
  contribution: Contribution | null;
  member: Member;
  churchSettings?: ChurchSettings;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ contribution, member, churchSettings, onClose }) => {
  if (!contribution) return null;

  const churchName = churchSettings?.church_name || 'Living Faith Membership Portal';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden text-slate-800">
        {/* Top brand header */}
        <div className="bg-slate-900 border-b border-slate-800 p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={churchName}
                  className="w-10 h-10 rounded-lg object-contain bg-slate-800 border border-slate-700 p-0.5"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400">
                  <Church className="w-5 h-5" />
                </div>
              )}
              <div>
                <h3 className="font-bold text-base text-white tracking-tight">{churchName}</h3>
                <p className="text-xs text-slate-300">Official Contribution Receipt</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Receipt Body */}
        <div className="p-6 space-y-5 bg-slate-50">
          <div className="text-center py-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 mb-1">
              <CheckCircle className="w-5 h-5" />
            </div>
            <p className="text-xs uppercase tracking-wider font-bold text-emerald-800">Payment Verified & Certified</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1 font-mono">
              {member.currency_symbol || '$'}{contribution.amount.toFixed(2)}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">{getCategoryLabel(contribution.category)}</p>
          </div>

          <div className="space-y-2.5 bg-white p-4 rounded-xl border border-slate-200 text-xs sm:text-sm">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Receipt Number</span>
              <span className="font-mono font-bold text-amber-800">{contribution.receipt_no}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Contributor Name</span>
              <span className="font-semibold text-slate-900">{member.full_name}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Membership ID</span>
              <span className="font-mono font-semibold text-slate-800">{member.member_number}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Date Received</span>
              <span className="text-slate-800">{contribution.date}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Payment Method</span>
              <span className="text-slate-800">{contribution.payment_method}</span>
            </div>
            {contribution.for_month && (
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Month Covered</span>
                <span className="font-semibold text-slate-800">{contribution.for_month}</span>
              </div>
            )}
            {contribution.notes && (
              <div className="flex justify-between items-center py-1.5">
                <span className="text-slate-500">Notes</span>
                <span className="text-slate-700 italic">{contribution.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-slate-200 p-4 px-6 flex justify-between items-center">
          <span className="text-[11px] text-slate-500">Authorized Church Record</span>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
