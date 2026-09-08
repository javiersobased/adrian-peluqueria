const KEY = 'am_pending_booking';

/** Exactly the shape we insert into `bookings`, minus `user_id` (added at insert time). */
export interface PendingBookingPayload {
  service: string;
  service_price: number;
  barber: string;
  booking_date: string;
  booking_time: string;
  full_name: string;
  phone: string;
  email: string;
  comments: string | null;
}

// Google's sign-in redirects the whole page away and back, wiping any React
// state — so the in-progress booking has to survive in localStorage, not memory.
export function savePendingBooking(payload: PendingBookingPayload) {
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* ignore (private mode / storage full) */
  }
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
  } catch {
    /* ignore */
  }
}
