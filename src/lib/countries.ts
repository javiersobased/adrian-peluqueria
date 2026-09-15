export interface Country {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
  placeholder: string;
  minDigits: number;
  maxDigits: number;
}

export const COUNTRIES: Country[] = [
  { name: 'España', code: 'ES', dialCode: '+34', flag: '🇪🇸', placeholder: '612 345 678', minDigits: 9, maxDigits: 9 },
  { name: 'Portugal', code: 'PT', dialCode: '+351', flag: '🇵🇹', placeholder: '912 345 678', minDigits: 9, maxDigits: 9 },
  { name: 'Francia', code: 'FR', dialCode: '+33', flag: '🇫🇷', placeholder: '6 12 34 56 78', minDigits: 9, maxDigits: 9 },
  { name: 'Reino Unido', code: 'GB', dialCode: '+44', flag: '🇬🇧', placeholder: '7911 123456', minDigits: 10, maxDigits: 11 },
  { name: 'Alemania', code: 'DE', dialCode: '+49', flag: '🇩🇪', placeholder: '151 23456789', minDigits: 10, maxDigits: 11 },
  { name: 'Marruecos', code: 'MA', dialCode: '+212', flag: '🇲🇦', placeholder: '612 345 678', minDigits: 9, maxDigits: 9 },
  { name: 'Italia', code: 'IT', dialCode: '+39', flag: '🇮🇹', placeholder: '312 345 6789', minDigits: 9, maxDigits: 10 },
  { name: 'Países Bajos', code: 'NL', dialCode: '+31', flag: '🇳🇱', placeholder: '6 12345678', minDigits: 9, maxDigits: 9 },
  { name: 'Bélgica', code: 'BE', dialCode: '+32', flag: '🇧🇪', placeholder: '470 12 34 56', minDigits: 9, maxDigits: 9 },
  { name: 'Suiza', code: 'CH', dialCode: '+41', flag: '🇨🇭', placeholder: '78 123 45 67', minDigits: 9, maxDigits: 9 },
  { name: 'Irlanda', code: 'IE', dialCode: '+353', flag: '🇮🇪', placeholder: '87 123 4567', minDigits: 9, maxDigits: 9 },
  { name: 'Rumanía', code: 'RO', dialCode: '+40', flag: '🇷🇴', placeholder: '712 345 678', minDigits: 9, maxDigits: 9 },
  { name: 'Polonia', code: 'PL', dialCode: '+48', flag: '🇵🇱', placeholder: '512 345 678', minDigits: 9, maxDigits: 9 },
  { name: 'Suecia', code: 'SE', dialCode: '+46', flag: '🇸🇪', placeholder: '70 123 45 67', minDigits: 9, maxDigits: 10 },
  { name: 'Noruega', code: 'NO', dialCode: '+47', flag: '🇳🇴', placeholder: '412 34 567', minDigits: 8, maxDigits: 8 },
  { name: 'Dinamarca', code: 'DK', dialCode: '+45', flag: '🇩🇰', placeholder: '20 12 34 56', minDigits: 8, maxDigits: 8 },
  { name: 'Ucrania', code: 'UA', dialCode: '+380', flag: '🇺🇦', placeholder: '50 123 4567', minDigits: 9, maxDigits: 9 },
  { name: 'Estados Unidos', code: 'US', dialCode: '+1', flag: '🇺🇸', placeholder: '(555) 123-4567', minDigits: 10, maxDigits: 10 },
  { name: 'Canadá', code: 'CA', dialCode: '+1', flag: '🇨🇦', placeholder: '(555) 123-4567', minDigits: 10, maxDigits: 10 },
  { name: 'México', code: 'MX', dialCode: '+52', flag: '🇲🇽', placeholder: '55 1234 5678', minDigits: 10, maxDigits: 10 },
  { name: 'Argentina', code: 'AR', dialCode: '+54', flag: '🇦🇷', placeholder: '9 11 1234-5678', minDigits: 10, maxDigits: 11 },
  { name: 'Colombia', code: 'CO', dialCode: '+57', flag: '🇨🇴', placeholder: '300 123 4567', minDigits: 10, maxDigits: 10 },
  { name: 'Chile', code: 'CL', dialCode: '+56', flag: '🇨🇱', placeholder: '9 1234 5678', minDigits: 9, maxDigits: 9 },
  { name: 'Perú', code: 'PE', dialCode: '+51', flag: '🇵🇪', placeholder: '912 345 678', minDigits: 9, maxDigits: 9 },
  { name: 'Venezuela', code: 'VE', dialCode: '+58', flag: '🇻🇪', placeholder: '412 1234567', minDigits: 10, maxDigits: 10 },
  { name: 'Ecuador', code: 'EC', dialCode: '+593', flag: '🇪🇨', placeholder: '99 123 4567', minDigits: 9, maxDigits: 9 },
  { name: 'Uruguay', code: 'UY', dialCode: '+598', flag: '🇺🇾', placeholder: '94 123 456', minDigits: 8, maxDigits: 8 },
  { name: 'Brasil', code: 'BR', dialCode: '+55', flag: '🇧🇷', placeholder: '11 91234-5678', minDigits: 10, maxDigits: 11 },
  { name: 'Andorra', code: 'AD', dialCode: '+376', flag: '🇦🇩', placeholder: '312 345', minDigits: 6, maxDigits: 6 },
  { name: 'Gibraltar', code: 'GI', dialCode: '+350', flag: '🇬🇮', placeholder: '54012345', minDigits: 8, maxDigits: 8 },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // España (+34)

// Obvious spam and fake sequences
const FAKE_SEQUENCES = [
  '123456789',
  '987654321',
  '012345678',
  '876543210',
  '12345678',
  '87654321',
  '00000000',
  '11111111',
  '22222222',
  '33333333',
  '44444444',
  '55555555',
  '66666666',
  '77777777',
  '88888888',
  '99999999',
];

export interface ValidationResult {
  isValid: boolean;
  error: string | null;
  cleanDigits: string;
  formattedE164: string;
}

/**
 * Validate national phone number according to country rules and anti-spam protection
 */
export function validatePhoneNumber(country: Country, rawNationalNumber: string): ValidationResult {
  let clean = rawNationalNumber.replace(/\D/g, '');
  
  if (!clean) {
    return {
      isValid: false,
      error: 'Introduce tu número de teléfono',
      cleanDigits: '',
      formattedE164: '',
    };
  }

  // If user included leading 0 in European/international number, strip leading 0
  if (country.dialCode !== '+34' && clean.startsWith('0') && clean.length > country.minDigits) {
    clean = clean.substring(1);
  }

  // 1. Anti-spam / Fake number check
  // Repetitive single digits (e.g. 666666666, 000000000)
  if (/^(\d)\1+$/.test(clean)) {
    return {
      isValid: false,
      error: 'Introduce un número de teléfono real válido',
      cleanDigits: clean,
      formattedE164: '',
    };
  }

  // Known sequential test patterns
  if (FAKE_SEQUENCES.some((seq) => clean.includes(seq))) {
    return {
      isValid: false,
      error: 'Introduce un número de teléfono real válido',
      cleanDigits: clean,
      formattedE164: '',
    };
  }

  // 2. Specific validation by country
  if (country.code === 'ES') {
    // Spanish phone: must have exactly 9 digits and start with 6, 7, 8 or 9
    if (clean.length !== 9) {
      return {
        isValid: false,
        error: `El teléfono español debe tener 9 dígitos (has escrito ${clean.length})`,
        cleanDigits: clean,
        formattedE164: '',
      };
    }
    if (!/^[6789]/.test(clean)) {
      return {
        isValid: false,
        error: 'El teléfono debe empezar por 6, 7, 8 ó 9',
        cleanDigits: clean,
        formattedE164: '',
      };
    }
  } else if (country.code === 'PT') {
    // Portugal: 9 digits, starting with 9, 2 or 3
    if (clean.length !== 9) {
      return {
        isValid: false,
        error: `El teléfono portugués debe tener 9 dígitos (has escrito ${clean.length})`,
        cleanDigits: clean,
        formattedE164: '',
      };
    }
    if (!/^[923]/.test(clean)) {
      return {
        isValid: false,
        error: 'El teléfono portugués debe comenzar por 9 o 2',
        cleanDigits: clean,
        formattedE164: '',
      };
    }
  } else if (country.code === 'FR') {
    // France: 9 digits without leading 0
    if (clean.length !== 9) {
      return {
        isValid: false,
        error: `El teléfono francés debe tener 9 dígitos (has escrito ${clean.length})`,
        cleanDigits: clean,
        formattedE164: '',
      };
    }
  } else if (country.code === 'GB') {
    // UK: 10 or 11 digits
    if (clean.length < 10 || clean.length > 11) {
      return {
        isValid: false,
        error: 'El teléfono británico debe tener entre 10 y 11 dígitos',
        cleanDigits: clean,
        formattedE164: '',
      };
    }
  } else if (country.code === 'MA') {
    // Morocco: 9 digits, usually starting with 5, 6, 7
    if (clean.length !== 9) {
      return {
        isValid: false,
        error: 'El teléfono marroquí debe tener 9 dígitos',
        cleanDigits: clean,
        formattedE164: '',
      };
    }
  } else {
    // General international length check
    if (clean.length < country.minDigits) {
      return {
        isValid: false,
        error: `Faltan dígitos para ${country.name} (mínimo ${country.minDigits})`,
        cleanDigits: clean,
        formattedE164: '',
      };
    }
    if (clean.length > country.maxDigits) {
      return {
        isValid: false,
        error: `Demasiados dígitos para ${country.name} (máximo ${country.maxDigits})`,
        cleanDigits: clean,
        formattedE164: '',
      };
    }
  }

  // Format cleanly as E.164: e.g. +34 612 345 678
  const formattedE164 = `${country.dialCode} ${formatDigitsForDisplay(country.code, clean)}`;

  return {
    isValid: true,
    error: null,
    cleanDigits: clean,
    formattedE164,
  };
}

/**
 * Format raw digits for friendly UI display
 */
export function formatDigitsForDisplay(countryCode: string, digits: string): string {
  if (!digits) return '';
  if (countryCode === 'ES' || countryCode === 'PT' || countryCode === 'MA') {
    const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter(Boolean);
    return parts.join(' ');
  }
  if (countryCode === 'FR') {
    const p1 = digits.slice(0, 1);
    const p2 = digits.slice(1, 3);
    const p3 = digits.slice(3, 5);
    const p4 = digits.slice(5, 7);
    const p5 = digits.slice(7, 9);
    return [p1, p2, p3, p4, p5].filter(Boolean).join(' ');
  }
  if (countryCode === 'US' || countryCode === 'CA') {
    const p1 = digits.slice(0, 3);
    const p2 = digits.slice(3, 6);
    const p3 = digits.slice(6, 10);
    return [p1, p2, p3].filter(Boolean).join(' ');
  }
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

/**
 * Detect country and extract national digits if a user pastes a full phone with prefix
 */
export function detectCountryFromInput(raw: string): { country: Country; nationalNumber: string } | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('+') && !trimmed.startsWith('00')) {
    return null;
  }

  const normalized = trimmed.startsWith('00') ? '+' + trimmed.slice(2) : trimmed;

  const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  for (const c of sorted) {
    if (normalized.startsWith(c.dialCode)) {
      const rest = normalized.slice(c.dialCode.length).replace(/\D/g, '');
      return { country: c, nationalNumber: rest };
    }
  }

  return null;
}
