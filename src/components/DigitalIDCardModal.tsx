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

  const churchName = churchSettings?.church_name || 'Living Faith Membership Portal';
  const logoUrl = churchSettings?.logo_url;
  const seniorPastor = churchSettings?.senior_pastor || 'Senior Pastor';
  const branchName = member.branch_name || member.branch_code || 'Lilongwe Branch (Malawi)';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-slate-800 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 border-b border-slate-800 p-4 px-5 flex items-center justify-between shrink-0 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Digital Church Membership ID</h3>
              <p className="text-xs text-slate-300">Card Preview & QR Code Verification</p>
            </div>
          </div>

          {/* Mode Switcher: Card View vs PDF Document Preview */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition ${
                  viewMode === 'card'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
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
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                PDF Preview
              </button>
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

        {/* Modal Body: Card Preview or PDF Iframe */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 bg-slate-50">
          {/* Mobile view switch */}
          <div className="sm:hidden flex items-center justify-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`flex-1 py-1.5 text-center rounded-md font-semibold transition ${
                viewMode === 'card' ? 'bg-slate-900 text-white' : 'text-slate-600'
              }`}
            >
              Card View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('pdf')}
              className={`flex-1 py-1.5 text-center rounded-md font-semibold transition ${
                viewMode === 'pdf' ? 'bg-slate-900 text-white' : 'text-slate-600'
              }`}
            >
              PDF Document
            </button>
          </div>

          {viewMode === 'card' ? (
            /* PHYSICAL CARD DESIGN */
            <div className="max-w-lg mx-auto bg-white border border-slate-300 rounded-2xl p-5 sm:p-6 shadow-md relative overflow-hidden text-slate-800">
              {/* Top church navy bar */}
              <div className="absolute top-0 inset-x-0 h-2 bg-slate-900"></div>

              {/* Card Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 pt-1">
                <div className="flex items-center gap-2.5">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={churchName}
                      className="w-10 h-10 rounded-lg object-contain bg-slate-50 border border-slate-200 p-0.5"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 shrink-0">
                      <Church className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 font-serif leading-tight">
                      {churchName}
                    </h4>
                    <span className="text-[10px] text-amber-800 uppercase tracking-wider font-bold block">
                      Membership Identification
                    </span>
                  </div>
                </div>

                {/* Status Badge */}
                <div
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                    member.status === 'green'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  {member.status === 'green'
                    ? 'Active Member'
                    : 'Verified Member'}
                </div>
              </div>

              {/* Card Content: Details & QR Code */}
              <div className="py-4 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
                {/* Member Details */}
                <div className="space-y-2 flex-1 w-full sm:w-auto">
                  <div className="flex items-center gap-3">
                    {member.photo_url ? (
                      <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-300 shadow-xs shrink-0">
                        <img
                          src={member.photo_url}
                          alt={member.full_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-center text-amber-800 font-bold text-lg shrink-0 font-mono">
                        {member.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h5 className="font-bold text-base text-slate-900 leading-snug">
                        {member.title ? `${member.title} ` : ''}
                        {member.full_name}
                      </h5>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {member.member_number}
                        </span>
                        <button
                          onClick={handleCopyId}
                          className="p-1 rounded text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200"
                          title="Copy ID"
                        >
                          {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 text-xs text-slate-600 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Branch: <strong className="text-slate-900">{branchName}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Phone: {member.phone}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Joined: {member.join_date}</span>
                    </div>
                  </div>
                </div>

                {/* QR Code */}
                {qrDataUrl && (
                  <div className="flex flex-col items-center justify-center p-2.5 bg-slate-50 border border-slate-200 rounded-xl shrink-0">
                    <img
                      src={qrDataUrl}
                      alt={`QR code for ${member.member_number}`}
                      className="w-24 h-24 sm:w-28 sm:h-28 object-contain"
                    />
                    <span className="text-[9px] font-mono text-slate-500 mt-1 uppercase font-semibold">
                      Official ID QR
                    </span>
                  </div>
                )}
              </div>

              {/* Card Footer Signature Area */}
              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-2 text-[10px] text-slate-500">
                <div>
                  <span className="block font-bold text-slate-700">{seniorPastor}</span>
                  <span>Senior Pastor & Overseer</span>
                </div>
                <div className="text-center font-medium text-[9px] text-slate-400">
                  Developed by Shepherd Zisper Phiri
                </div>
                <div className="text-right">
                  <span className="block font-mono text-slate-700 font-semibold">{member.member_number}</span>
                  <span>Department of Membership</span>
                </div>
              </div>
            </div>
          ) : (
            /* EMBEDDED PDF PREVIEW */
            <div className="max-w-xl mx-auto">
              <div className="w-full h-80 sm:h-96 rounded-xl overflow-hidden border border-slate-200 bg-white">
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
              <div className="mt-2 text-[11px] text-slate-500 text-center flex items-center gap-1.5 justify-center">
                <FileText className="w-3.5 h-3.5 text-amber-700" />
                Direct Digital PDF ID rendering with embedded verification QR code
              </div>
            </div>
          )}

          {/* Verification Notice */}
          <p className="text-xs text-center text-slate-500">
            This digital ID contains your unique QR code used for church check-in and official member verification.
          </p>
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-white border-t border-slate-200 p-4 px-5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>

            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm"
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
