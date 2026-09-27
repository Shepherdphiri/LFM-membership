import React, { useState, useEffect, useRef } from 'react';
import { Branch, ChurchSettings, Member } from '../types';
import { fetchBranches, registerMember } from '../services/api';
import {
  Search,
  UserPlus,
  ArrowRight,
  Church,
  Phone,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  QrCode,
  Download,
  Camera,
  Upload,
  Trash2,
  Lock,
  Building2,
  DollarSign,
} from 'lucide-react';
import { playGentleChime } from '../utils/notifications';
import { generateQRCodeDataURL } from '../utils/qrcode';
import { DigitalIDCardModal } from './DigitalIDCardModal';

interface MemberLookupProps {
  onLookup: (memberNumber: string) => void;
  isLoading: boolean;
  errorMessage: string | null;
  churchSettings?: ChurchSettings;
}

export const MemberLookup: React.FC<MemberLookupProps> = ({
  onLookup,
  isLoading,
  errorMessage,
  churchSettings,
}) => {
  // Two modes: 'lookup' or 'register'
  const [mode, setMode] = useState<'lookup' | 'register'>('lookup');

  // Lookup state
  const [memberIdInput, setMemberIdInput] = useState('');

  // First-time Registration state
  const [title, setTitle] = useState('Brother');
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<number | ''>('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [hasKingdomInvestment, setHasKingdomInvestment] = useState(false);
  const [kingdomInvestmentAmount, setKingdomInvestmentAmount] = useState('50');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [generatedMemberNumber, setGeneratedMemberNumber] = useState<string | null>(null);
  const [generatedQR, setGeneratedQR] = useState<string>('');
  const [registeredMemberObj, setRegisteredMemberObj] = useState<Member | null>(null);
  const [isDigitalCardOpen, setIsDigitalCardOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const churchName = churchSettings?.church_name || 'GracePoint Church';
  const churchTagline = churchSettings?.tagline || 'Church Stewardship & Member Records Portal';
  const logoUrl = churchSettings?.logo_url;

  // Load admin-defined branches
  useEffect(() => {
    setBranchesLoading(true);
    fetchBranches()
      .then((data) => {
        setBranches(data);
        if (data.length > 0) {
          setSelectedBranchId(data[0].id);
        }
      })
      .catch((err) => console.error('Failed to load branches:', err))
      .finally(() => setBranchesLoading(false));
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setRegError('Please upload an image file (JPG, PNG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize to maximum 320x320 for light footprint in PDF and storage
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 320;
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

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setPhotoUrl(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (memberIdInput.trim()) {
      onLookup(memberIdInput.trim().toUpperCase());
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !surname.trim() || !phone.trim() || !selectedBranchId) {
      setRegError('Please complete all required registration fields.');
      return;
    }

    setRegistering(true);
    setRegError(null);

    try {
      const res = await registerMember({
        title,
        name: firstName.trim(),
        surname: surname.trim(),
        phone: phone.trim(),
        branchId: Number(selectedBranchId),
        photoUrl: photoUrl || undefined,
        hasMonthlyDues: true, // Compulsory!
        hasKingdomInvestment,
        kingdomInvestmentAmount: hasKingdomInvestment ? parseFloat(kingdomInvestmentAmount) || 0 : 0,
      });

      playGentleChime();
      setGeneratedMemberNumber(res.memberNumber);

      // Generate scannable QR Code for the new Membership ID
      const qr = await generateQRCodeDataURL(res.memberNumber);
      setGeneratedQR(qr);

      // Find selected branch to build preview member object
      const branch = branches.find((b) => b.id === Number(selectedBranchId));
      setRegisteredMemberObj({
        id: 0,
        member_number: res.memberNumber,
        title,
        first_name: firstName.trim(),
        surname: surname.trim(),
        full_name: `${firstName.trim()} ${surname.trim()}`,
        phone: phone.trim(),
        photo_url: photoUrl || undefined,
        branch_id: Number(selectedBranchId),
        branch_name: branch?.name,
        branch_code: branch?.code,
        currency_symbol: branch?.currency_symbol || '$',
        currency_code: branch?.currency_code || 'USD',
        join_date: new Date().toISOString().split('T')[0],
        monthly_due_amount: branch?.default_monthly_due || 20,
        has_monthly_dues: 1,
        has_kingdom_investment: hasKingdomInvestment ? 1 : 0,
        kingdom_investment_amount: hasKingdomInvestment ? parseFloat(kingdomInvestmentAmount) || 0 : 0,
        status: 'orange',
        created_at: new Date().toISOString(),
      });
    } catch (err: any) {
      setRegError(err.message || 'Registration failed.');
    } finally {
      setRegistering(false);
    }
  };

  const handleCopyGeneratedId = () => {
    if (!generatedMemberNumber) return;
    navigator.clipboard.writeText(generatedMemberNumber);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleProceedToDashboard = () => {
    if (generatedMemberNumber) {
      onLookup(generatedMemberNumber);
    }
  };

  const selectedBranch = branches.find((b) => b.id === Number(selectedBranchId));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12 space-y-6">
      {/* Church Branding Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={churchName}
              className="h-16 w-16 object-contain rounded-xl border border-slate-700 bg-slate-900 p-1"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-amber-500 shadow-sm">
              <Church className="w-7 h-7" />
            </div>
          )}
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 font-serif tracking-tight">
          {churchName}
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 font-medium">
          {churchTagline}
        </p>
      </div>

      {/* Main Card with the two options: Enter Member ID OR Register */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden">
        {/* Toggle Bar: Enter Member ID vs Register */}
        <div className="grid grid-cols-2 p-1 bg-slate-950 border-b border-slate-800">
          <button
            type="button"
            onClick={() => {
              setMode('lookup');
              setGeneratedMemberNumber(null);
            }}
            className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition ${
              mode === 'lookup'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-4 h-4" />
            Enter Member ID
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('register');
              setGeneratedMemberNumber(null);
            }}
            className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition ${
              mode === 'register'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Register
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-7">
          {mode === 'lookup' ? (
            /* OPTION 1: ENTER MEMBER ID */
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-slate-100">Member ID Access</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter your assigned Member ID to view your progress, digital ID card, and church events.
                </p>
              </div>

              <form onSubmit={handleLookupSubmit} className="space-y-4">
                <div>
                  <label htmlFor="memberId" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Membership ID Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Search className="w-4 h-4 text-slate-400" />
                    </div>
                    <input
                      id="memberId"
                      type="text"
                      value={memberIdInput}
                      onChange={(e) => setMemberIdInput(e.target.value.toUpperCase())}
                      placeholder="e.g. MS-1001 or HRE-1001"
                      className="w-full pl-10 pr-24 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono font-bold text-sm placeholder:text-slate-600 focus:outline-none focus:border-amber-500 uppercase"
                      required
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !memberIdInput.trim()}
                      className="absolute right-1 top-1 bottom-1 px-4 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition disabled:opacity-40 flex items-center gap-1"
                    >
                      {isLoading ? (
                        <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full"></span>
                      ) : (
                        <>
                          <span>View</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </form>
            </div>
          ) : (
            /* OPTION 2: FIRST TIME REGISTRATION */
            <div>
              {generatedMemberNumber ? (
                /* Registration Success Screen with Generated QR Code & Digital ID Card Preview */
                <div className="text-center py-4 space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-950 border border-emerald-700 text-emerald-400 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-100">Registration Complete</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Your branch Membership ID and scannable QR Code have been generated:
                    </p>
                  </div>

                  {/* ID & QR Code Card */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-700 max-w-sm mx-auto text-center space-y-3">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Generated Member ID & Scannable QR
                    </span>

                    <div className="flex items-center justify-center gap-2">
                      <span className="font-mono font-bold text-2xl text-amber-400">
                        {generatedMemberNumber}
                      </span>
                      <button
                        onClick={handleCopyGeneratedId}
                        className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                        title="Copy Member ID"
                      >
                        {copiedId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* QR Code Container */}
                    {generatedQR && (
                      <div className="flex flex-col items-center justify-center pt-1">
                        <div className="p-2.5 bg-white rounded-xl shadow-md border border-slate-200">
                          <img
                            src={generatedQR}
                            alt={`QR for ${generatedMemberNumber}`}
                            className="w-32 h-32 object-contain"
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1.5 font-mono">
                          Unique QR Code generated for {generatedMemberNumber}
                        </span>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500 pt-1">
                      Save this ID or download your Digital ID card below to access the church portal anytime.
                    </p>

                    {/* Button to open digital PDF ID preview */}
                    <button
                      type="button"
                      onClick={() => setIsDigitalCardOpen(true)}
                      className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-400 font-bold text-xs transition flex items-center justify-center gap-1.5"
                    >
                      <QrCode className="w-4 h-4" />
                      Preview & Download Digital ID Card
                    </button>
                  </div>

                  <button
                    onClick={handleProceedToDashboard}
                    className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5"
                  >
                    <span>Proceed to Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                /* The Registration Form */
                <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs">
                  <div>
                    <h3 className="text-base font-semibold text-slate-100">Member Registration</h3>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Please enter your details, upload your member photo, and confirm your stewardship commitments.
                    </p>
                  </div>

                  {regError && (
                    <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{regError}</span>
                    </div>
                  )}

                  {/* Profile Image Upload */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                    <label className="block font-semibold text-slate-300">
                      Member Profile Photo (For Digital ID Card)
                    </label>
                    
                    <div className="flex items-center gap-4">
                      {photoUrl ? (
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-amber-500 shadow-md shrink-0">
                          <img
                            src={photoUrl}
                            alt="Uploaded member preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-700 flex flex-col items-center justify-center text-slate-500 shrink-0">
                          <Camera className="w-6 h-6 text-slate-400" />
                          <span className="text-[9px] mt-0.5 text-slate-500">Photo</span>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImageChange}
                            accept="image/*"
                            className="hidden"
                            id="member-photo-upload"
                          />
                          <label
                            htmlFor="member-photo-upload"
                            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-semibold transition"
                          >
                            <Upload className="w-3.5 h-3.5 text-amber-400" />
                            {photoUrl ? 'Change Photo' : 'Upload Image'}
                          </label>

                          {photoUrl && (
                            <button
                              type="button"
                              onClick={handleRemovePhoto}
                              className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800 text-rose-300 transition"
                              title="Remove photo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Clear front-facing picture. This will appear on your digital ID card & church profile.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Title
                    </label>
                    <select
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs sm:text-sm focus:outline-none focus:border-amber-500"
                    >
                      <option value="Brother">Brother</option>
                      <option value="Sister">Sister</option>
                      <option value="Pastor">Pastor</option>
                      <option value="Deacon">Deacon</option>
                      <option value="Deaconess">Deaconess</option>
                      <option value="Elder">Elder</option>
                      <option value="Evangelist">Evangelist</option>
                      <option value="Mr">Mr</option>
                      <option value="Mrs">Mrs</option>
                      <option value="Ms">Ms</option>
                      <option value="Dr">Dr</option>
                    </select>
                  </div>

                  {/* Name and Surname */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        placeholder="First name"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs sm:text-sm focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">
                        Surname *
                      </label>
                      <input
                        type="text"
                        value={surname}
                        onChange={(e) => setSurname(e.target.value)}
                        required
                        placeholder="Surname"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs sm:text-sm focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Phone number */}
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                        <Phone className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        placeholder="Phone number"
                        className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs sm:text-sm focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Church branch (chosen from branches defined by admin) */}
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Church Branch *
                    </label>
                    {branchesLoading ? (
                      <div className="py-2 text-slate-500 text-xs">Loading branches...</div>
                    ) : (
                      <select
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                        required
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs sm:text-sm focus:outline-none focus:border-amber-500"
                      >
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.code} • {b.currency_symbol} {b.currency_code})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* STEWARDSHIP COMMITMENTS: Monthly Dues (Compulsory) & Kingdom Investment (Optional) */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                        Stewardship Commitments
                      </span>
                      <span className="text-[10px] text-slate-400">Choose commitments</span>
                    </div>

                    {/* 1. Monthly Dues (Compulsory) */}
                    <div className="p-3 rounded-lg bg-slate-900 border border-amber-500/30 flex items-start gap-3">
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          checked={true}
                          disabled={true}
                          readOnly
                          className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700 accent-amber-500 cursor-not-allowed"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-100 flex items-center gap-1.5">
                            <span>Monthly Membership Dues</span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              Compulsory
                            </span>
                          </label>
                          <span className="font-mono font-bold text-amber-400">
                            {selectedBranch ? `${selectedBranch.currency_symbol}${selectedBranch.default_monthly_due.toFixed(2)}/mo` : '$20.00/mo'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Mandatory core membership contribution for church branch upkeep and pastoral administration.
                        </p>
                      </div>
                    </div>

                    {/* 2. Kingdom Investment (Optional) */}
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2.5">
                      <div className="flex items-start gap-3">
                        <div className="pt-0.5">
                          <input
                            id="kingdom-investment-check"
                            type="checkbox"
                            checked={hasKingdomInvestment}
                            onChange={(e) => setHasKingdomInvestment(e.target.checked)}
                            className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700 accent-amber-500 cursor-pointer"
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <label htmlFor="kingdom-investment-check" className="font-bold text-slate-100 cursor-pointer flex items-center gap-1.5">
                              <span>Kingdom Investments</span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                                Optional
                              </span>
                            </label>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Voluntary stewardship partner contributions toward church building projects, media wings, and missions outreach.
                          </p>
                        </div>
                      </div>

                      {hasKingdomInvestment && (
                        <div className="pt-2 pl-7 border-t border-slate-800/80 flex items-center gap-2">
                          <label className="text-[11px] text-slate-300 font-semibold whitespace-nowrap">
                            Target Pledge ({selectedBranch ? selectedBranch.currency_symbol : '$'}):
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="5"
                            value={kingdomInvestmentAmount}
                            onChange={(e) => setKingdomInvestmentAmount(e.target.value)}
                            placeholder="e.g. 50"
                            className="w-28 px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono font-bold text-xs focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={registering}
                      className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {registering ? (
                        <span className="animate-spin inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full"></span>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          Register & Generate Member ID & QR Code
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Digital ID Card Preview Modal */}
      <DigitalIDCardModal
        isOpen={isDigitalCardOpen}
        onClose={() => setIsDigitalCardOpen(false)}
        member={registeredMemberObj}
        churchSettings={churchSettings}
        qrDataUrl={generatedQR}
      />
    </div>
  );
};
