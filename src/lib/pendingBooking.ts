import { LEGACY_BUSINESS } from '@/lib/business';
import { getCurrentBusinessId } from '@/lib/tenant';

const KEY = 'am_pending_booking';
const VERSION = 2;

export interface PendingBookingPayload {
  service: string;
  service_price: number;
  barber: string;
  booking_date: string;
  booking_time: string;
  full_name: string;
  phone: string;
  comments: string | null;
  marketing_accepted?: boolean;
}

interface StoredPendingBooking {
  v: typeof VERSION;
  businessId: string;
  payload: PendingBookingPayload;
}

export function savePendingBooking(payload: PendingBookingPayload) {
  try {
    const stored: StoredPendingBooking = { v: VERSION, businessId: getCurrentBusinessId(), payload };
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch { /* ignore */ }
}

// Un borrador solo se reanuda en el negocio que lo creó; los de otro negocio se descartan.
export function getPendingBooking(): PendingBookingPayload | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const businessId = getCurrentBusinessId();

    if (parsed?.v === VERSION) {
      const stored = parsed as StoredPendingBooking;
      if (stored.businessId === businessId) return stored.payload;
    } else if (parsed && typeof parsed === 'object' && businessId === LEGACY_BUSINESS.id) {
      // Formato v1 (sin negocio): solo pudo crearse en el tenant heredado.
      return parsed as PendingBookingPayload;
    }

    localStorage.removeItem(KEY);
    return null;
  } catch {
    return null;
  }
}

export function clearPendingBooking() {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem('amm_client_details_draft');
  } catch { /* ignore */ }
}
