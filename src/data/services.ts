import { supabase } from '@/lib/supabase';
import type { Service, Barber } from '@/types';

export async function fetchServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) return [];
  return (data as Service[]) ?? [];
}

export async function fetchAllServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) return [];
  return (data as Service[]) ?? [];
}

export async function fetchBarbers(): Promise<Barber[]> {
  const { data, error } = await supabase
    .from('barbers')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) return [];
  return (data as Barber[]) ?? [];
}

export async function fetchAllBarbers(): Promise<Barber[]> {
  const { data, error } = await supabase
    .from('barbers')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) return [];
  return (data as Barber[]) ?? [];
}

export function getBarberById(barbers: Barber[], id: string): Barber | undefined {
  return barbers.find((b) => b.id === id);
}

export const WHATSAPP_NUMBER = '+34614922082';
export const INSTAGRAM_HANDLE = 'barberiaadrianmillan_';
export const INSTAGRAM_URL = `https://instagram.com/${INSTAGRAM_HANDLE}`;
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}`;

export const SALON_LAT = 37.2664;
export const SALON_LNG = -6.9424;
export const SALON_ADDRESS = 'Calle Palacio 13, 21001 Huelva';
export const SALON_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${SALON_LAT},${SALON_LNG}`;

export const OPENING_HOURS = [
  { day: 'Lunes', hours: '9:30 – 13:30 · 16:30 – 20:30' },
  { day: 'Martes', hours: '9:30 – 13:30 · 16:30 – 20:30' },
  { day: 'Miércoles', hours: '9:30 – 13:30 · 16:30 – 20:30' },
  { day: 'Jueves', hours: '9:30 – 13:30 · 16:30 – 20:30' },
  { day: 'Viernes', hours: '9:30 – 13:30 · 16:30 – 20:30' },
  { day: 'Sábado', hours: '9:30 – 13:30' },
  { day: 'Domingo', hours: 'Cerrado' },
];
