const KEY = 'am_pending_booking';

export interface PendingBookingPayload {
  service: string;
  service_price: number;
  barber: string;
  booking_date: string;
  booking_time: string;
  full_name: string;
  phone: string;
  comments: string | null;
}

export function savePendingBooking(payload: PendingBookingPayload) {
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch { /* ignore */ }
}

export function getPendingBooking(): PendingBookingPayload | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingBookingPayload) : null;
  } catch {
    return null;
  }
}

export function clearPendingBooking() {
  try {
    localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}
