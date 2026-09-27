import React, { useState, useEffect } from 'react';
import { Member, ChurchSettings } from '../types';
import { generateDigitalIDCardPDF, getDigitalIDCardPDFDataUri } from '../utils/pdfGenerator';
import {
  X,
  Download,
  Printer,
  Copy,
  Check,
  Church,
  ShieldCheck,
  QrCode,
  Calendar,
  Phone,
  Building2,
  FileText,
  CreditCard,
} from 'lucide-react';

interface DigitalIDCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  churchSettings?: ChurchSettings;
  qrDataUrl?: string;
}

export const DigitalIDCardModal: React.FC<DigitalIDCardModalProps> = ({
  isOpen,
  onClose,
  member,
  churchSettings,
  qrDataUrl,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'pdf'>('card');
  const [pdfDataUri, setPdfDataUri] = useState<string>('');

  useEffect(() => {
    if (isOpen && member) {
      try {
        const uri = getDigitalIDCardPDFDataUri(member, churchSettings, qrDataUrl);
        setPdfDataUri(uri);
      } catch (err) {
        console.error('Failed to generate PDF data URI:', err);
      }
    }
  }, [isOpen, member, churchSettings, qrDataUrl]);

  if (!isOpen || !member) return null;

  const churchName = churchSettings?.church_name || 'GracePoint Church';
  const logoUrl = churchSettings?.logo_url;
  const seniorPastor = churchSettings?.senior_pastor || 'Pastor David Sterling';
  const branchName = member.branch_name || member.branch_code || 'Main Sanctuary';

  const handleCopyId = () => {
    navigator.clipboard.writeText(member.member_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPDF = () => {
    generateDigitalIDCardPDF(member, churchSettings, qrDataUrl);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-950 border-b border-slate-800 p-4 px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-amber-500">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Digital Church Membership ID</h3>
              <p className="text-xs text-slate-400">Card Preview & QR Code Verification</p>
            </div>
          </div>

          {/* Mode Switcher: Card View vs PDF Document Preview */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition ${
                  viewMode === 'card'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                Card View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('pdf')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition ${
                  viewMode === 'pdf'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                PDF Preview
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-850 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Card Preview or PDF Iframe */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Mobile view switch */}
          <div className="sm:hidden flex items-center justify-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`flex-1 py-1.5 text-center rounded-md font-semibold transition ${
                viewMode === 'card' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              Card View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('pdf')}
              className={`flex-1 py-1.5 text-center rounded-md font-semibold transition ${
                viewMode === 'pdf' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              PDF Document
            </button>
          </div>

          {viewMode === 'card' ? (
            /* PHYSICAL CARD DESIGN */
            <div className="max-w-lg mx-auto bg-slate-950 border-2 border-slate-700 rounded-2xl p-5 shadow-2xl relative overflow-hidden text-slate-100">
              {/* Top decorative gold bar */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-amber-500"></div>

              {/* Card Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={churchName}
                      className="w-10 h-10 rounded-lg object-contain bg-slate-900 border border-slate-700 p-0.5"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-amber-500 shrink-0">
                      <Church className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-sm text-slate-100 font-serif leading-tight">
                      {churchName}
                    </h4>
                    <span className="text-[10px] text-amber-400/90 uppercase tracking-wider font-semibold block">
                      Membership Identification
                    </span>
                  </div>
                </div>

                {/* Status Badge */}
                <div
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                    member.status === 'green'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : member.status === 'orange'
                      ? 'bg-amber-950 text-amber-400 border border-amber-800'
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}
                >
                  {member.status === 'green'
                    ? 'Active'
                    : member.status === 'orange'
                    ? 'Dues Pending'
                    : 'Overdue'}
                </div>
              </div>

              {/* Card Content: Details & QR Code */}
              <div className="py-4 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
                {/* Member Details */}
                <div className="space-y-2 flex-1 w-full sm:w-auto">
                  <div className="flex items-center gap-3">
                    {member.photo_url ? (
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-amber-500/40 shadow shrink-0">
                        <img
                          src={member.photo_url}
                          alt={member.full_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-900 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-lg shrink-0 font-mono">
                        {member.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h5 className="font-bold text-base text-slate-100 leading-snug">
                        {member.title ? `${member.title} ` : ''}
                        {member.full_name}
                      </h5>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs font-mono font-bold text-amber-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {member.member_number}
                        </span>
                        <button
                          onClick={handleCopyId}
                          className="p-1 rounded text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800"
                          title="Copy ID"
                        >
                          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 text-xs text-slate-300 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Branch: <strong className="text-slate-200">{branchName}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Phone: {member.phone}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Member Since: {member.join_date || '2026'}</span>
                    </div>
                  </div>
                </div>

                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center shrink-0 p-2.5 bg-white rounded-xl shadow-md border border-slate-200">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`QR Code for ${member.member_number}`}
                      className="w-28 h-28 object-contain"
                    />
                  ) : (
                    <div className="w-28 h-28 flex items-center justify-center text-slate-400 bg-slate-100 rounded text-xs">
                      Generating...
                    </div>
                  )}
                  <span className="text-[10px] font-mono font-bold text-slate-900 mt-1">
                    {member.member_number}
                  </span>
                  <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">
                    Scan to Verify
                  </span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                  Authorised by {seniorPastor}
                </span>
                <span>Official Assembly Record</span>
              </div>
            </div>
          ) : (
            /* EXACT PDF DOCUMENT PREVIEW */
            <div className="w-full bg-slate-950 rounded-xl border border-slate-800 p-2 flex flex-col items-center">
              <div className="w-full h-80 sm:h-96 rounded-lg overflow-hidden border border-slate-850 bg-slate-900">
                {pdfDataUri ? (
                  <iframe
                    src={`${pdfDataUri}#toolbar=0&navpanes=0`}
                    title="Digital Membership PDF ID Preview"
                    className="w-full h-full border-none"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                    Generating Digital PDF ID Document...
                  </div>
                )}
              </div>
              <div className="mt-2 text-[11px] text-slate-400 text-center flex items-center gap-1.5 justify-center">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                Direct Digital PDF ID rendering with embedded verification QR code
              </div>
            </div>
          )}

          {/* Verification Notice */}
          <p className="text-xs text-center text-slate-400">
            This digital ID contains your unique QR code used for church check-in, assembly attendance verification, and official identification.
          </p>
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-slate-950 border-t border-slate-800 p-4 px-5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>

            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-sm"
            >
              <Download className="w-4 h-4" />
              Download PDF ID Card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
