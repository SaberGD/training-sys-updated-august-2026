/**
 * Utility functions for Saber Group dynamic features.
 */

/**
 * Formats a time string (HH:MM or 12h) to a clean 12-hour format with AM/PM (e.g. 19:00 -> 07:00 PM, 07:00 AM -> 07:00 AM).
 */
export function formatTime12h(timeStr: string | undefined | null): string {
  if (!timeStr) return '-';
  const trimmed = timeStr.trim();
  if (!trimmed) return '-';
  
  const ampmCheck = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm|ص|م|مساءً|صباحاً)?$/i);
  if (ampmCheck) {
    let h = parseInt(ampmCheck[1], 10);
    const m = ampmCheck[2];
    let p = ampmCheck[3] ? ampmCheck[3].toUpperCase() : null;

    if (p === 'ص' || p === 'صباحاً') p = 'AM';
    if (p === 'م' || p === 'مساءً') p = 'PM';

    if (p) {
      if (h === 0) h = 12;
      if (h > 12) h = h % 12;
    } else {
      p = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;
    }

    const formattedHours = h < 10 ? `0${h}` : `${h}`;
    return `${formattedHours}:${m} ${p}`;
  }

  const parts = trimmed.split(':');
  if (parts.length < 2) return trimmed;
  
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].substring(0, 2);
  if (isNaN(hours)) return trimmed;
  
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  
  const formattedHours = hours < 10 ? `0${hours}` : `${hours}`;
  
  return `${formattedHours}:${minutes} ${ampm}`;
}

/**
 * Formats a time string into 12-hour Arabic text (e.g., "06:00 مساءً" or "09:30 صباحاً").
 */
export function formatTime12hArabic(timeStr: string | undefined | null): string {
  const formatted = formatTime12h(timeStr);
  if (formatted === '-') return '-';
  return formatted.replace('PM', 'مساءً').replace('AM', 'صباحاً');
}

/**
 * Parses any time string (24h or 12h AM/PM or ص/م/مساءً/صباحاً) into total minutes from 00:00.
 */
export function parseTimeToMinutes(str: string | undefined | null): number | null {
  if (!str) return null;
  const clean = str.trim();
  if (!clean) return null;

  // Match 12h with AM/PM or ص/م/مساءً/صباحاً
  const ampmMatch = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm|ص|م|مساءً|صباحاً)?$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3] ? ampmMatch[3].toUpperCase() : null;
    if (period) {
      if ((period === 'PM' || period === 'م' || period === 'مساءً') && h < 12) h += 12;
      if ((period === 'AM' || period === 'ص' || period === 'صباحاً') && h === 12) h = 0;
    }
    return h * 60 + m;
  }

  const parts = clean.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h * 60 + m;
  }
  return null;
}

/**
 * Decomposes any time string into 12-hour components: { hour: "06", minute: "00", period: "PM" }
 */
export function timeTo12hParts(timeStr: string | undefined | null, defaultMins: number = 1080): { hour: string; minute: string; period: 'AM' | 'PM' } {
  let mins = parseTimeToMinutes(timeStr);
  if (mins === null || isNaN(mins)) {
    mins = defaultMins;
  }
  let h24 = Math.floor(mins / 60) % 24;
  let m = mins % 60;
  let period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;

  const hour = h12 < 10 ? `0${h12}` : `${h12}`;
  const minute = m < 10 ? `0${m}` : `${m}`;
  return { hour, minute, period };
}

/**
 * Assembles 12-hour components into a 24-hour HH:mm string (e.g. hour="06", minute="00", period="PM" -> "18:00").
 */
export function partsTo24hString(hour: string, minute: string, period: 'AM' | 'PM'): string {
  let h = parseInt(hour, 10) || 12;
  if (period === 'PM' && h < 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  const hStr = h < 10 ? `0${h}` : `${h}`;
  const mNum = parseInt(minute, 10) || 0;
  const mStr = mNum < 10 ? `0${mNum}` : `${mNum}`;
  return `${hStr}:${mStr}`;
}

/**
 * Assembles 12-hour components into a 12-hour HH:mm AM/PM string (e.g. "06:00 PM").
 */
export function partsTo12hString(hour: string, minute: string, period: 'AM' | 'PM'): string {
  let h = parseInt(hour, 10) || 12;
  if (h > 12) h = h % 12;
  if (h === 0) h = 12;
  const hStr = h < 10 ? `0${h}` : `${h}`;
  const mNum = parseInt(minute, 10) || 0;
  const mStr = mNum < 10 ? `0${mNum}` : `${mNum}`;
  return `${hStr}:${mStr} ${period}`;
}

/**
 * Normalizes any phone number input, stripping white spaces, dashes,
 * and smart-matching/injecting Egyptian country code (+20) if missing.
 */
export function normalizePhoneNumber(raw: string | undefined | null): string {
  if (!raw) return '';
  
  // Strip all whitespace-like and punctuation-like formatting (spaces, dashes, parens, dots)
  let cleaned = raw.trim().replace(/[\s\-\(\)\.]/g, '');
  
  if (!cleaned) return '';

  // Handle double zero standard prefix: '002010...' -> '+2010...'
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }

  // If already starts with '+', keep it intact but ensure digits layout
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // Egyptian dynamic cellular detection:
  // Egyptian cellular networks start with '010', '011', '012', '015' (11 digits)
  // Or without leading zero: '10', '11', '12', '15' (10 digits)
  
  const isEgyptCellWithZero = /^01[0125]\d{8}$/.test(cleaned);
  const isEgyptCellWithoutZero = /^1[0125]\d{8}$/.test(cleaned);

  if (isEgyptCellWithZero) {
    // E.g. '01012345678' -> '+201012345678'
    return `+20${cleaned.substring(1)}`;
  }
  
  if (isEgyptCellWithoutZero) {
    // E.g. '1012345678' -> '+201012345678'
    return `+20${cleaned}`;
  }

  // Default international behavior:
  // If number starts with '20' (e.g., '201012345678' - 12 digits), make it '+201012345678'
  if (cleaned.startsWith('20') && cleaned.length >= 11 && cleaned.length <= 13) {
    return `+${cleaned}`;
  }

  // If the number doesn't have '+' but is general (e.g., GCC country like '966...'), 
  // do NOT force Egyptian code if it looks like standard GCC length, just prepend '+'
  if (/^[3-9]\d{9,14}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // Fallback default: If it is short 11 digits/10 digits (non-egypt rules checked, but still egyptian-like)
  // or a standard local phone input without code, assume Egypt (+20) as the country code
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return `+20${cleaned.substring(1)}`;
  } else if (cleaned.length === 10) {
    return `+20${cleaned}`;
  }

  return cleaned;
}

/**
 * Cleans phone number to numeric digits ONLY for external APIs like wa.me
 * e.g., '+20 10 1234 5678' -> '201012345678'
 */
export function getCleanDigitsOnly(phone: string): string {
  const norm = normalizePhoneNumber(phone);
  return norm.replace(/\D/g, ''); // removes '+' and everything else
}

export interface CountryCode {
  code: string;
  name: string;
  flag: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: '+20', name: 'مصر', flag: '🇪🇬' },
  { code: '+966', name: 'السعودية', flag: '🇸🇦' },
  { code: '+971', name: 'الإمارات', flag: '🇦🇪' },
  { code: '+965', name: 'الكويت', flag: '🇰🇼' },
  { code: '+974', name: 'قطر', flag: '🇶🇦' },
  { code: '+968', name: 'عمان', flag: '🇴🇲' },
  { code: '+973', name: 'البحرين', flag: '🇧🇭' },
  { code: '+962', name: 'الأردن', flag: '🇯🇴' },
  { code: '+218', name: 'ليبيا', flag: '🇱🇾' },
  { code: '+249', name: 'السودان', flag: '🇸🇩' },
  { code: '+970', name: 'فلسطين', flag: '🇵🇸' },
  { code: '+967', name: 'اليمن', flag: '🇾🇪' },
  { code: '+964', name: 'العراق', flag: '🇮🇶' },
  { code: '+212', name: 'المغرب', flag: '🇲🇦' },
  { code: '+213', name: 'الجزائر', flag: '🇩🇿' },
  { code: '+216', name: 'تونس', flag: '🇹🇳' },
  { code: '+961', name: 'لبنان', flag: '🇱🇧' },
  { code: '+1', name: 'أمريكا / كندا', flag: '🇺🇸' },
  { code: '+44', name: 'المملكة المتحدة', flag: '🇬🇧' },
];

export interface ParsedPhone {
  countryCode: string;
  localNumber: string;
}

export function parsePhoneAndDetect(raw: string): ParsedPhone {
  if (!raw) return { countryCode: '+20', localNumber: '' };
  
  // Clean spaces, dashes, parentheses
  let cleaned = raw.trim().replace(/[\s\-\(\)\.]/g, '');
  if (!cleaned) return { countryCode: '+20', localNumber: '' };

  // Handle double zero: '002010...' -> '+2010...'
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }

  // Sort country codes by descending length to match longest first
  const sortedCodes = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);

  // 1. If starts with '+'
  if (cleaned.startsWith('+')) {
    for (const c of sortedCodes) {
      if (cleaned.startsWith(c.code)) {
        return { countryCode: c.code, localNumber: cleaned.substring(c.code.length) };
      }
    }
    return { countryCode: '+20', localNumber: cleaned }; // default fallback
  }

  // 2. If it doesn't start with '+', but starts with code digits (e.g., '966512345', '201012345678')
  for (const c of sortedCodes) {
    const codeNoPlus = c.code.substring(1); // '966', '20', etc.
    if (cleaned.startsWith(codeNoPlus)) {
      const remainder = cleaned.substring(codeNoPlus.length);
      // Validate remainder length to make sure it's a valid local number (usually 7 to 11 digits)
      if (remainder.length >= 7 && remainder.length <= 11) {
        if (c.code === '+20') {
          if (/^[1025]\d{9}$/.test(remainder) || /^01[0125]\d{8}$/.test(remainder)) {
            return { countryCode: '+20', localNumber: remainder };
          }
        } else {
          return { countryCode: c.code, localNumber: remainder };
        }
      }
    }
  }

  // 3. Special handling for local Egypt cellular numbers starting with '01' or '1'
  if (/^01[0125]\d{8}$/.test(cleaned)) {
    return { countryCode: '+20', localNumber: cleaned.substring(1) };
  }
  if (/^1[0125]\d{8}$/.test(cleaned)) {
    return { countryCode: '+20', localNumber: cleaned };
  }

  // Default fallback
  return { countryCode: '+20', localNumber: cleaned };
}
