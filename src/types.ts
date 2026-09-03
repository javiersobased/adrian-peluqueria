export interface Service {
  id: string;
  name: string;
  price: number;
  duration: string;
  icon: string;
  sort_order: number;
  active: boolean;
}

export interface Barber {
  id: string;
  name: string;
  role: string;
  initials: string;
  photo_url: string | null;
  active: boolean;
  sort_order: number;
}

export interface BookingForm {
  fullName: string;
  phone: string;
  email: string;
  comments: string;
}

export interface SavedBooking {
  id: string;
  service: string;
  service_price: number;
  barber: string;
  booking_date: string;
  booking_time: string;
  full_name: string;
  phone: string;
  email: string;
  comments: string | null;
  status: string;
  created_at: string;
}

export type BlockType = 'day_off' | 'weekly_off' | 'slot_block' | 'time_range';

export interface BarberBlock {
  id: string;
  barber: string;
  block_type: BlockType;
  block_date: string | null;
  weekday: number | null;
  block_time: string | null;
  block_start_time: string | null;
  block_end_time: string | null;
  note: string | null;
  created_at: string;
}

export interface BarberSchedule {
  id: string;
  barber: string;
  weekday: number;
  is_working: boolean;
  morning_start: string | null;
  morning_end: string | null;
  afternoon_start: string | null;
  afternoon_end: string | null;
}

export interface BarberVacation {
  id: string;
  barber: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  created_at: string;
}
