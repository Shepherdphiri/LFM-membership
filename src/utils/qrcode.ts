import QRCode from 'qrcode';

/**
 * Generate a clean, high-resolution QR code data URL (PNG)
 * for a member's unique Membership ID.
 */
export async function generateQRCodeDataURL(memberId: string): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(memberId.trim().toUpperCase(), {
      width: 400,
      margin: 1,
      color: {
        dark: '#0f172a', // slate-900
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
    return dataUrl;
  } catch (err) {
    console.error('Error generating QR code:', err);
    // Fallback simple 1x1 transparent png if generation fails
    return '';
  }
}
