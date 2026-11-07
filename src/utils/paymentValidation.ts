/**
 * PCI DSS v4.0 Compliant Client-Side Validation & Masking Helpers.
 * Raw card numbers and CVVs are validated in memory solely to verify checksums
 * before immediate server-side tokenization; they are never stored in browser
 * storage or database records.
 */

export type DetectedCardNetwork = 'Visa' | 'Mastercard' | 'RuPay' | 'Amex' | 'Card';

export function stripDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatCardNumber(value: string): string {
  const digits = stripDigits(value).slice(0, 19);
  const groups = digits.match(/.{1,4}/g);
  return groups ? groups.join(' ') : digits;
}

export function formatExpiry(value: string): string {
  const digits = stripDigits(value).slice(0, 4);
  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
  }
  return digits;
}

export function detectCardNetwork(cardNumber: string): DetectedCardNetwork {
  const digits = stripDigits(cardNumber);
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  if (/^(60|6521|6522|508[5-9]|81|82)/.test(digits)) return 'RuPay';
  return 'Card';
}

export function validateLuhnChecksum(cardNumber: string): boolean {
  const digits = stripDigits(cardNumber);
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export function validateCardExpiry(expiry: string): boolean {
  const match = /^(\d{2})\/(\d{2})$/.exec(expiry.trim());
  if (!match) return false;
  const month = parseInt(match[1], 10);
  const year = 2000 + parseInt(match[2], 10);
  if (month < 1 || month > 12) return false;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;
  return true;
}

export function validateCvv(cvv: string, network: DetectedCardNetwork): boolean {
  const digits = stripDigits(cvv);
  if (network === 'Amex') return digits.length === 4;
  return digits.length === 3;
}

export function validateUpiId(vpa: string): boolean {
  return /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z0-9]{2,32}$/.test(vpa.trim());
}

export const POPULAR_INDIAN_BANKS = [
  { code: 'HDFC', name: 'HDFC Bank', badge: 'Instant NetBanking' },
  { code: 'ICICI', name: 'ICICI Bank', badge: 'Instant NetBanking' },
  { code: 'SBI', name: 'State Bank of India', badge: 'YONO / Corporate' },
  { code: 'AXIS', name: 'Axis Bank', badge: 'Instant NetBanking' },
  { code: 'KOTAK', name: 'Kotak Mahindra Bank', badge: 'Kotak NetBanking' },
  { code: 'YESB', name: 'Yes Bank', badge: 'Retail NetBanking' },
] as const;

export const DIGITAL_WALLETS = [
  { id: 'Paytm Wallet', name: 'Paytm Wallet & Postpaid', subtitle: 'Instant linked balance & UPI Lite' },
  { id: 'Amazon Pay', name: 'Amazon Pay Balance', subtitle: 'Zero-fee instant wallet settlement' },
  { id: 'PhonePe Wallet', name: 'PhonePe Wallet', subtitle: 'One-tap encrypted authorization' },
  { id: 'Mobikwik', name: 'MobiKwik / Zip', subtitle: 'Wallet & Pay Later' },
] as const;
