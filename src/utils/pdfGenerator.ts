import { jsPDF } from 'jspdf';
import { Member, Contribution, ChurchSettings } from '../types';

/**
 * Generate official Stewardship & Dues Statement documentation PDF (A4 format)
 * with embedded QR code.
 */
export function generateMemberStatementPDF(
  member: Member,
  contributions: Contribution[],
  summary: {
    totalDues: number;
    totalKingdomInvestment: number;
    totalSpecial?: number;
    totalAllTime: number;
    currentYearTotal: number;
  },
  monthTitle: string = 'September 2026',
  churchSettings?: ChurchSettings,
  qrDataUrl?: string
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  const churchName = (churchSettings?.church_name || 'Living Faith Membership Portal').toUpperCase();
  const address = churchSettings?.address || 'Living Faith Cathedral Campus, Lilongwe, Malawi';
  const phone = churchSettings?.phone || '+265 99 123 4567';
  const email = churchSettings?.email || 'office@livingfaithportal.org';

  // Header Background bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 42, 'F');

  // Gold accent line
  doc.setFillColor(217, 119, 6); // amber-600
  doc.rect(0, 42, pageWidth, 2.5, 'F');

  // Church Name & Brand
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(churchName, 15, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Department of Stewardship & Member Records`, 15, y + 6);
  doc.text(`${address} • Tel: ${phone} • ${email}`, 15, y + 11);

  // Document Title Pill
  doc.setFillColor(245, 158, 11); // Amber
  doc.roundedRect(pageWidth - 75, 12, 60, 20, 2, 2, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('STEWARDSHIP RECORD', pageWidth - 72, 20);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${monthTitle}`, pageWidth - 72, 26);

  y = 55;

  const curr = member.currency_symbol || '$';
  const branchName = member.branch_name || member.branch_code || 'Main Sanctuary';

  // Member Identification Card Block (with QR Code on right)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, y, pageWidth - 30, 36, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('MEMBER IDENTIFICATION & STATUS', 20, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  
  doc.text(`Full Name:`, 20, y + 15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${member.title ? member.title + ' ' : ''}${member.full_name}`, 45, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Unique ID:`, 20, y + 22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(217, 119, 6);
  doc.text(`${member.member_number}`, 45, y + 22);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Church Branch:`, 20, y + 29);
  doc.setTextColor(15, 23, 42);
  doc.text(`${branchName}`, 48, y + 29);

  // Right column details
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Join Date:`, 95, y + 15);
  doc.setTextColor(15, 23, 42);
  doc.text(`${member.join_date || 'N/A'}`, 118, y + 15);

  doc.setTextColor(71, 85, 105);
  doc.text(`Standing:`, 95, y + 22);
  
  // Status pill in PDF
  if (member.status === 'green') {
    doc.setFillColor(16, 185, 129);
    doc.setTextColor(255, 255, 255);
    doc.roundedRect(118, y + 18, 38, 5.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('CURRENT / GOOD', 120, y + 22);
  } else if (member.status === 'orange') {
    doc.setFillColor(245, 158, 11);
    doc.setTextColor(255, 255, 255);
    doc.roundedRect(118, y + 18, 35, 5.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('DUES PENDING', 120, y + 22);
  } else {
    doc.setFillColor(239, 68, 68);
    doc.setTextColor(255, 255, 255);
    doc.roundedRect(118, y + 18, 35, 5.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('OVERDUE / FLAG', 120, y + 22);
  }

  // Embed Member QR Code inside ID block if provided
  if (qrDataUrl) {
    const qrSize = 26;
    const qrX = pageWidth - 46;
    const qrY = y + 4;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, 1, 1, 'FD');
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('SCAN TO VERIFY', qrX + 3.5, qrY + qrSize + 3);
  }

  y = 100;

  // Financial Contribution Summary Boxes
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('STEWARDSHIP CONTRIBUTION SUMMARY', 15, y);

  y += 5;
  const boxWidth = (pageWidth - 30 - 9) / 4;

  const boxes = [
    { title: 'MONTHLY DUES', amount: summary.totalDues, color: [241, 245, 249], textColor: [15, 23, 42] },
    { title: 'KINGDOM INVEST', amount: summary.totalKingdomInvestment, color: [241, 245, 249], textColor: [15, 23, 42] },
    { title: 'SPECIAL OFFERINGS', amount: summary.totalSpecial || 0, color: [241, 245, 249], textColor: [15, 23, 42] },
    { title: 'YEAR TOTAL (2026)', amount: summary.currentYearTotal, color: [254, 243, 199], textColor: [180, 83, 9] },
  ];

  boxes.forEach((box, i) => {
    const x = 15 + i * (boxWidth + 3);
    doc.setFillColor(box.color[0], box.color[1], box.color[2]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, boxWidth, 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(box.title, x + 4, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(box.textColor[0], box.textColor[1], box.textColor[2]);
    doc.text(`${curr}${box.amount.toFixed(2)}`, x + 4, y + 16);
  });

  y += 30;

  // Itemized Contributions Ledger
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('ITEMIZED CONTRIBUTION LEDGER', 15, y);

  y += 5;

  // Table Header
  doc.setFillColor(30, 41, 59);
  doc.rect(15, y, pageWidth - 30, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('DATE', 18, y + 5.5);
  doc.text('RECEIPT NO', 42, y + 5.5);
  doc.text('CATEGORY', 80, y + 5.5);
  doc.text('METHOD', 125, y + 5.5);
  doc.text(`AMOUNT (${curr})`, pageWidth - 35, y + 5.5);

  y += 8;

  // Table Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  const displayList = contributions.slice(0, 12);
  displayList.forEach((c, index) => {
    const isEven = index % 2 === 0;
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y, pageWidth - 30, 7, 'F');
    }

    doc.setTextColor(51, 65, 85);
    doc.text(c.date, 18, y + 5);
    doc.text(c.receipt_no, 42, y + 5);

    let catLabel = c.category.toUpperCase().replace('_', ' ');
    if (c.category === 'kingdom_investment') catLabel = 'KINGDOM INVEST.';
    if (c.category === 'membership_fee') catLabel = 'MEMBERSHIP DUE';
    doc.text(catLabel, 80, y + 5);

    doc.text(c.payment_method || 'Offline Treasury', 125, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${curr}${c.amount.toFixed(2)}`, pageWidth - 35, y + 5);
    doc.setFont('helvetica', 'normal');

    y += 7;
  });

  if (contributions.length === 0) {
    doc.setTextColor(148, 163, 184);
    doc.text('No contributions recorded for this period.', 18, y + 5);
    y += 8;
  }

  y += 8;

  // Assembly Statement Notice
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(15, y, pageWidth - 30, 18, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text('OFFICIAL CHURCH STEWARDSHIP & MEMBER STANDING RECORD', 18, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `This document certifies voluntary church stewardship contributions and monthly dues received by church administration for ${member.full_name}.`,
    18,
    y + 9.5
  );
  doc.text(
    `Official record of active partnership and good standing at ${churchSettings?.church_name || 'Living Faith Membership Portal'}. Verified offline through treasury receipts.`,
    18,
    y + 13.5
  );

  y += 22;

  // Signatures
  doc.setDrawColor(203, 213, 225);
  doc.line(20, y + 10, 80, y + 10);
  doc.line(pageWidth - 80, y + 10, pageWidth - 20, y + 10);

  const seniorPastor = churchSettings?.senior_pastor || 'Pastor David Sterling';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(seniorPastor, 20, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.text('Senior Pastor & Overseer', 20, y + 18);

  doc.setFont('helvetica', 'bold');
  doc.text('Church Administration', pageWidth - 80, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.text('Treasury & Membership Records', pageWidth - 80, y + 18);

  // Save/Download
  const safeName = member.full_name.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Stewardship_Statement_${member.member_number}_${safeName}.pdf`);
}

/**
 * Build the jsPDF instance for a Digital Membership ID Card
 * with official church branding, member details, and scannable QR Code.
 */
export function buildDigitalIDCardDoc(
  member: Member,
  churchSettings?: ChurchSettings,
  qrDataUrl?: string
): jsPDF {
  // 105 x 65 mm (Landscape wallet / badge card)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [105, 65],
  });

  const cardWidth = 105;
  const cardHeight = 65;

  const churchName = (churchSettings?.church_name || 'Living Faith Membership Portal').toUpperCase();
  const branchName = member.branch_name || member.branch_code || 'Lilongwe Branch (Malawi)';
  const pastor = churchSettings?.senior_pastor || 'Senior Pastor';

  // Card Background
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, cardWidth, cardHeight, 'F');

  // Outer border
  doc.setDrawColor(51, 65, 85);
  doc.rect(1, 1, cardWidth - 2, cardHeight - 2, 'S');

  // Header band
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(1, 1, cardWidth - 2, 13, 'F');

  // Gold accent line
  doc.setFillColor(217, 119, 6); // amber-600
  doc.rect(1, 14, cardWidth - 2, 1, 'F');

  // Header Church Title
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.text(churchName, 4, 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(203, 213, 225);
  doc.text('OFFICIAL MEMBERSHIP IDENTIFICATION CARD', 4, 11);

  // Status Badge in header
  if (member.status === 'green') {
    doc.setFillColor(16, 185, 129);
    doc.roundedRect(cardWidth - 24, 4, 20, 6, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.text('ACTIVE MEMBER', cardWidth - 22.5, 8.2);
  } else if (member.status === 'orange') {
    doc.setFillColor(245, 158, 11);
    doc.roundedRect(cardWidth - 24, 4, 20, 6, 1, 1, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.text('DUES PENDING', cardWidth - 22.5, 8.2);
  } else {
    doc.setFillColor(239, 68, 68);
    doc.roundedRect(cardWidth - 24, 4, 20, 6, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.text('INACTIVE / FLAG', cardWidth - 23, 8.2);
  }

  // Left Section: Member Details
  const contentY = 19;

  // Member Photo or Initials Emblem Box
  doc.setFillColor(30, 41, 59);
  doc.setDrawColor(217, 119, 6);
  doc.roundedRect(4, contentY, 15, 15, 1.5, 1.5, 'FD');

  let hasPhoto = false;
  if (member.photo_url && (member.photo_url.startsWith('data:image/') || member.photo_url.startsWith('http'))) {
    try {
      const format = member.photo_url.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(member.photo_url, format, 4, contentY, 15, 15);
      hasPhoto = true;
    } catch {
      hasPhoto = false;
    }
  }

  if (!hasPhoto) {
    const initials = member.full_name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(245, 158, 11);
    doc.text(initials, 8.5, contentY + 10);
  }

  // Full Name & Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`${member.title ? member.title + ' ' : ''}${member.full_name}`, 22, contentY + 4);

  // Unique Member Number (Prominent Gold Mono)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(245, 158, 11); // Amber
  doc.text(`ID: ${member.member_number}`, 22, contentY + 9.5);

  // Church Branch & Phone
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Branch: ${branchName}`, 22, contentY + 14.5);
  doc.text(`Phone: ${member.phone}`, 22, contentY + 18.5);
  doc.text(`Joined: ${member.join_date || '2026'}`, 22, contentY + 22.5);

  // Right Section: QR Code Box
  if (qrDataUrl) {
    const qrSize = 25;
    const qrX = cardWidth - 32;
    const qrY = contentY;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, 1.5, 1.5, 'FD');
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    // Label below QR code
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(245, 158, 11);
    doc.text(member.member_number, qrX + 4.5, qrY + qrSize + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(148, 163, 184);
    doc.text('MEMBER VERIFICATION', qrX + 1.5, qrY + qrSize + 7);
  }

  // Bottom Footer Bar with Signature & Seal
  doc.setFillColor(2, 6, 23); // slate-950
  doc.rect(1, cardHeight - 11, cardWidth - 2, 10, 'F');
  doc.setDrawColor(51, 65, 85);
  doc.line(1, cardHeight - 11, cardWidth - 1, cardHeight - 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Authorised: ${pastor} • Overseer`, 4, cardHeight - 6);
  doc.text(`Valid Church Assembly Record • Keep this card for church services & admissions`, 4, cardHeight - 3);

  return doc;
}

/**
 * Generate and download official Digital Membership ID Card PDF
 */
export function generateDigitalIDCardPDF(
  member: Member,
  churchSettings?: ChurchSettings,
  qrDataUrl?: string
) {
  const doc = buildDigitalIDCardDoc(member, churchSettings, qrDataUrl);
  const safeName = member.full_name.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Member_ID_Card_${member.member_number}_${safeName}.pdf`);
}

/**
 * Get data URI string of the generated Digital ID Card PDF for live in-modal preview
 */
export function getDigitalIDCardPDFDataUri(
  member: Member,
  churchSettings?: ChurchSettings,
  qrDataUrl?: string
): string {
  const doc = buildDigitalIDCardDoc(member, churchSettings, qrDataUrl);
  return doc.output('datauristring');
}
