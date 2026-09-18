export interface Service {
  id: string;
  name: string;
  price: number;
  duration: string;
  duration_minutes?: number | null;
  icon: string;
  sort_order: number;
  active: boolean;
}

export interface BookedInterval {
  booking_time: string;
  service?: string | null;
  duration_minutes?: number | null;
}

export interface Barber {
  id: string;
  name: string;
  role: string;
  initials: string;
  photo_url: string | null;
  active: boolean;
  sort_order: number;
  google_email?: string | null;
  admin_emails?: string[] | null;
}

export interface BookingForm {
  firstName?: string;
  lastName?: string;
  fullName: string;
  phone: string;
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
  email: string | null;
  comments: string | null;
  status: string;
  created_at: string;
  user_id: string | null;
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

export type StaffRole = 'admin' | 'barber';
export type StaffStatus = 'pending' | 'verified' | 'rejected';

export interface StaffMember {
  email: string;
  full_name: string | null;
  role: StaffRole;
  barber_id: string | null;
  status: StaffStatus;
  created_at: string;
}

export interface Customer {
  user_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  comments: string | null;
  created_at: string;
  updated_at: string;
  marketing_accepted?: boolean | null;
}

export interface UserRole {
  role: StaffRole | null;
  status: StaffStatus | null;
  barber_id: string | null;
  email: string | null;
}

export interface StoreCategory {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface StoreProduct {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface GalleryPhoto {
  id: string;
  image_url: string;
  title?: string | null;
  barber_id?: string | null;
  created_at: string;
}
