/**
 * Generates a clean WhatsApp link for a given phone number and optional prefilled message
 */
export function getWhatsAppUrl(phone: string, text?: string): string {
  if (!phone) return '#';
  let clean = phone.replace(/\D/g, '');
  if (!clean) return '#';

  // If phone has 9 digits and starts with 6, 7, 8 or 9, assume Spanish national number (+34)
  if (clean.length === 9 && /^[6789]/.test(clean)) {
    clean = `34${clean}`;
  }

  const base = `https://wa.me/${clean}`;
  if (text) {
    return `${base}?text=${encodeURIComponent(text)}`;
  }
  return base;
}

/**
 * Generates a clean tel: link for phone dialing
 */
export function getCallUrl(phone: string): string {
  if (!phone) return '#';
  const clean = phone.replace(/[^\d+]/g, '');
  return `tel:${clean}`;
}
