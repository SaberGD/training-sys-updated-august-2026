/**
 * Utility functions for robust string, email, and phone sanitization across the application.
 * Solves keyboard quirks, mobile copy-paste artifacts, RTL/LTR marks, Arabic digits,
 * full-width characters, non-breaking spaces, and hidden Unicode zero-width characters.
 */

// Mapping of Arabic-Indic and Eastern Arabic digits to standard ASCII digits
const DIGIT_MAP: { [key: string]: string } = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

/**
 * Normalizes all numbers (Arabic-Indic, Persian, full-width) to standard English ASCII numbers (0-9)
 */
export function normalizeDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  return str.replace(/[٠-٩۰-۹]/g, char => DIGIT_MAP[char] || char);
}

/**
 * Strips zero-width characters, directional marks (LTR/RTL), and non-standard whitespaces.
 */
export function stripHiddenChars(input: string | null | undefined): string {
  if (!input) return '';
  return String(input)
    // NFKC normalization turns compatibility chars (full-width Latin/symbols) into regular ASCII
    .normalize('NFKC')
    // Remove zero-width spaces, BOM, joiners
    .replace(/[\u200B-\u200D\uFEFF\u2060\u00AD]/g, '')
    // Remove directional marks (LTR, RTL, pop directional, isolate)
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    // Replace non-breaking space & other Unicode spaces with standard space
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');
}

/**
 * Deep sanitization for email addresses.
 * Cleans:
 * - Mobile keyboard quirks (full-width ＠, full-width dots ．)
 * - Leading/trailing and embedded whitespace
 * - Arabic digits in email username/domain
 * - Hidden Unicode markers
 * - Case normalization
 */
export function sanitizeEmail(email: string | null | undefined): string {
  if (!email) return '';
  
  let cleaned = stripHiddenChars(email);
  cleaned = normalizeDigits(cleaned);

  // Replace full-width @ and dots or Arabic commas
  cleaned = cleaned
    .replace(/[\uFF20\uFE6B]/g, '@')
    .replace(/[\uFF0E\u3002\u06D4]/g, '.')
    .replace(/[\u2010-\u2015\u2212]/g, '-'); // Unicode hyphens to ASCII hyphen

  // Remove ALL whitespace from within the email
  cleaned = cleaned.replace(/\s+/g, '');

  return cleaned.toLowerCase().trim();
}

/**
 * Deep sanitization for general text inputs (Names, notes, codes).
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  let cleaned = stripHiddenChars(text);
  // Collapse multiple spaces into single space and trim
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Deep sanitization for phone numbers.
 * Converts Arabic digits, strips special chars, keeps + and digits.
 */
export function sanitizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  let cleaned = stripHiddenChars(phone);
  cleaned = normalizeDigits(cleaned);
  // Remove non-digit and non-plus characters
  return cleaned.replace(/[^\d+]/g, '').trim();
}

/**
 * Deep sanitization for student ID numbers and passwords
 */
export function sanitizeCredentials(value: string | null | undefined): string {
  if (!value) return '';
  let cleaned = stripHiddenChars(value);
  cleaned = normalizeDigits(cleaned);
  return cleaned.trim();
}
