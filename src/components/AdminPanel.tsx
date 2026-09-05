import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllBarbers } from '@/data/services';
import type { SavedBooking, BarberBlock, Barber } from '@/types';
import { AdminToday } from '@/components/admin/AdminToday';
import { AdminAgenda } from '@/components/admin/AdminAgenda';
import { AdminManualBooking } from '@/components/admin/AdminManualBooking';
import { AdminAvailability } from '@/components/admin/AdminAvailability';
import { AdminServices } from '@/components/admin/AdminServices';
import { AdminStaff } from '@/components/admin/AdminStaff';
import { AdminStaffSchedule } from '@/components/admin/AdminStaffSchedule';
import AnimatedContent from '@/components/reactbits/AnimatedContent';
import { logout, canAccessServices, canAccessStaff, canAccessSettings, updatePassword, type AdminRole } from '@/lib/auth';
import {
  CalendarDays, Clock, PlusCircle, SlidersHorizontal, Scissors, Users,
  ArrowLeft, Search, Settings, X, LogOut, KeyRound, type LucideIcon,
} from 'lucide-react';

interface AdminPanelProps {
  role: AdminRole;
  onBack: () => void;
}

type AdminTab = 'today' | 'agenda' | 'manual' | 'availability' | 'services' | 'staff' | 'schedule' | 'settings';

interface NavItem {
  id: AdminTab;
  label: string;
  icon: LucideIcon;
  category: string;
  restricted?: boolean;
}

export function AdminPanel({ role, onBack }: AdminPanelProps) {
  const [tab, setTab] = useState<AdminTab>('today');
  const [bookings, setBookings] = useState<SavedBooking[]>([]);
  const [blocks, setBlocks] = useState<BarberBlock[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchAllBarbers().then((b) => setBarbers(b)); }, []);

  const fetchBookings = useCallback(async () => {
    let query = supabase.from('bookings').select('*').neq('status', 'cancelled').order('booking_date', { ascending: true }).order('booking_time', { ascending: true });
    if (selectedBarber !== 'all') query = query.eq('barber', selectedBarber);
    const { data } = await query;
    setBookings((data as SavedBooking[]) ?? []);
  }, [selectedBarber]);

  const fetchBlocks = useCallback(async () => {
    let query = supabase.from('barber_blocks').select('*').order('created_at', { ascending: false });
    if (selectedBarber !== 'all') query = query.eq('barber', selectedBarber);
    const { data } = await query;
    setBlocks((data as BarberBlock[]) ?? []);
  }, [selectedBarber]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchBookings(), fetchBlocks()]);
    setLoading(false);
  }, [fetchBookings, fetchBlocks]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => fetchBookings())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barber_blocks' }, () => fetchBlocks())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barber_vacations' }, () => fetchBlocks())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barber_schedules' }, () => fetchBlocks())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchBookings, fetchBlocks]);

  const allNavItems: NavItem[] = [
    { id: 'today', label: 'Citas de Hoy', icon: CalendarDays, category: 'Principal' },
    { id: 'manual', label: 'Cita Manual', icon: PlusCircle, category: 'Principal' },
    { id: 'agenda', label: 'Agenda Completa', icon: Clock, category: 'Principal' },
    { id: 'availability', label: 'Horarios y Bloqueos', icon: SlidersHorizontal, category: 'Control' },
    { id: 'schedule', label: 'Horarios Semanales', icon: Clock, category: 'Control' },
    { id: 'services', label: 'Servicios', icon: Scissors, category: 'Gestión', restricted: true },
    { id: 'staff', label: 'Personal', icon: Users, category: 'Gestión', restricted: true },
    { id: 'settings', label: 'Ajustes', icon: Settings, category: 'Gestión', restricted: true },
  ];

  const navItems = allNavItems.filter((n) => !n.restricted || (n.id === 'services' && canAccessServices(role)) || (n.id === 'staff' && canAccessStaff(role)) || (n.id === 'settings' && canAccessSettings(role)));
  const CATEGORIES = ['Principal', 'Control', 'Gestión'];
  const filteredNav = navItems.filter((n) => n.label.toLowerCase().includes(search.toLowerCase()));
  const activeBarber = barbers.find((b) => b.id === selectedBarber) ?? null;
  const todayCount = bookings.filter((b) => b.booking_date === new Date().toISOString().slice(0, 10)).length;

  const handleNav = (id: AdminTab) => { setTab(id); setSidebarOpen(false); };

  const handleLogout = () => {
    logout();
    onBack();
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-200 animate-fade-in">
      {/* Icon Dock */}
      <div className="fixed left-0 top-0 z-40 hidden h-screen w-16 flex-col items-center border-r border-white/5 bg-zinc-900/80 py-5 backdrop-blur-xl md:flex">
        <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl gold-gradient font-display text-sm font-bold text-black">AM</div>
        <nav className="flex flex-1 flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button key={item.id} onClick={() => handleNav(item.id)}
                className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 ${active ? 'bg-gold/15 text-gold' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}
                title={item.label}>
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </button>
            );
          })}
        </nav>
        <button onClick={handleLogout} className="flex h-11 w-11 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400" title="Cerrar sesión">
          <LogOut className="h-5 w-5" strokeWidth={1.8} />
        </button>
      </div>

      {/* Desktop Sidebar */}
      <div className="fixed left-16 top-0 z-30 hidden h-screen w-64 flex-col border-r border-white/5 bg-zinc-900/60 backdrop-blur-xl md:flex">
        <SidebarContent barbers={barbers} selectedBarber={selectedBarber} setSelectedBarber={setSelectedBarber}
          activeBarber={activeBarber} search={search} setSearch={setSearch} tab={tab} onNav={handleNav}
          filteredNav={filteredNav} todayCount={todayCount} onLogout={handleLogout} role={role} />
      </div>

      {/* Mobile sidebar with AnimatedContent */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <AnimatedContent distance={300} direction="horizontal" reverse={false} duration={0.4} ease="power3.out" initialOpacity={0} animateOpacity={true} threshold={0} className="absolute left-0 top-0 h-full">
            <div className="h-full w-72 border-r border-white/5 bg-zinc-900/95 backdrop-blur-xl">
              <button onClick={() => setSidebarOpen(false)} className="absolute right-3 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-zinc-400">
                <X className="h-4 w-4" />
              </button>
              <SidebarContent barbers={barbers} selectedBarber={selectedBarber} setSelectedBarber={setSelectedBarber}
                activeBarber={activeBarber} search={search} setSearch={setSearch} tab={tab} onNav={handleNav}
                filteredNav={filteredNav} todayCount={todayCount} onLogout={handleLogout} role={role} />
            </div>
          </AnimatedContent>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 md:ml-80">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/5 bg-zinc-900/80 px-4 py-4 backdrop-blur-xl md:hidden">
          <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menú" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-zinc-300">
            <Settings className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <p className="text-[0.6rem] uppercase tracking-[0.2em] text-gold">Gestión</p>
            <h2 className="font-display text-lg font-bold leading-tight text-white">{navItems.find((n) => n.id === tab)?.label}</h2>
          </div>
          <button onClick={handleLogout} aria-label="Cerrar sesión" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-zinc-300">
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        {/* Desktop header */}
        <header className="sticky top-0 z-20 hidden items-center justify-between border-b border-white/5 bg-zinc-950/60 px-8 py-5 backdrop-blur-xl md:flex">
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.2em] text-gold">Panel de administración</p>
            <h1 className="font-display text-2xl font-bold text-white">{navItems.find((n) => n.id === tab)?.label}</h1>
          </div>
          <div className="flex items-center gap-3">
            {activeBarber ? (
              <div className="flex items-center gap-2.5 rounded-full glass-card px-3 py-1.5">
                {activeBarber.photo_url ? (
                  <img src={activeBarber.photo_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full gold-gradient font-display text-[0.6rem] font-bold text-black">{activeBarber.initials}</div>
                )}
                <span className="text-sm font-medium text-zinc-300">{activeBarber.name}</span>
              </div>
            ) : (
              <span className="rounded-full glass-card px-3 py-1.5 text-sm font-medium text-zinc-400">Todos los barberos</span>
            )}
            <button onClick={handleLogout} className="flex h-9 w-9 items-center justify-center rounded-full glass-card text-zinc-400 transition-colors hover:text-red-400" title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="px-4 py-6 md:px-8 md:py-8">
          {tab === 'today' && <AdminToday bookings={bookings} loading={loading} onRefresh={refresh} />}
          {tab === 'agenda' && <AdminAgenda bookings={bookings} loading={loading} onRefresh={refresh} />}
          {tab === 'manual' && <AdminManualBooking onCreated={refresh} />}
          {tab === 'availability' && <AdminAvailability blocks={blocks} onRefresh={refresh} />}
          {tab === 'services' && canAccessServices(role) && <AdminServices />}
          {tab === 'staff' && canAccessStaff(role) && <AdminStaff />}
          {tab === 'schedule' && <AdminStaffSchedule />}
          {tab === 'settings' && canAccessSettings(role) && <AdminSettings />}
        </div>
      </div>
    </div>
  );
}

function SidebarContent({
  barbers, selectedBarber, setSelectedBarber, activeBarber, search, setSearch, tab, onNav, filteredNav, todayCount, onLogout, role,
}: {
  barbers: Barber[]; selectedBarber: string; setSelectedBarber: (id: string) => void;
  activeBarber: Barber | null; search: string; setSearch: (s: string) => void; tab: AdminTab;
  onNav: (id: AdminTab) => void; filteredNav: NavItem[]; todayCount: number; onLogout: () => void; role: AdminRole;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/5 p-5">
        <p className="mb-3 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-zinc-500">Perfil activo</p>
        <div className="flex items-center gap-3 rounded-2xl glass-card p-3">
          {activeBarber?.photo_url ? (
            <img src={activeBarber.photo_url} alt="" className="h-11 w-11 rounded-xl object-cover ring-1 ring-white/10" />
          ) : activeBarber ? (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl gold-gradient font-display text-sm font-bold text-black">{activeBarber.initials}</div>
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-zinc-500"><Users className="h-5 w-5" /></div>
          )}
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-bold text-white">{activeBarber?.name ?? 'Todos'}</p>
            <p className="truncate text-xs text-zinc-500">{role === 'adrian' ? 'Acceso total' : 'Acceso limitado'}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button onClick={() => setSelectedBarber('all')} className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${selectedBarber === 'all' ? 'bg-gold/15 text-gold' : 'bg-white/5 text-zinc-500 hover:text-zinc-300'}`}>Todos</button>
          {barbers.map((b) => (
            <button key={b.id} onClick={() => setSelectedBarber(b.id)} className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${selectedBarber === b.id ? 'bg-gold/15 text-gold' : 'bg-white/5 text-zinc-500 hover:text-zinc-300'}`}>{b.name}</button>
          ))}
        </div>
      </div>

      <div className="px-5 py-3">
        <div className="flex items-center gap-2 rounded-xl glass-card px-3 py-2">
          <Search className="h-4 w-4 text-zinc-500" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar sección..." className="w-full bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none" />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {CATEGORIES.map((cat) => {
          const items = filteredNav.filter((n) => n.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat} className="mb-4">
              <p className="mb-1.5 px-2 text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-zinc-600">{cat}</p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = tab === item.id;
                  const count = item.id === 'today' ? todayCount : undefined;
                  return (
                    <button key={item.id} onClick={() => onNav(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all ${active ? 'bg-gold/10 text-gold' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}>
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                      <span className="flex-1 font-medium">{item.label}</span>
                      {count !== undefined && count > 0 && <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-bold ${active ? 'bg-gold/20 text-gold' : 'bg-white/10 text-zinc-400'}`}>{count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/5 p-3">
        <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-400 transition-all hover:bg-red-500/10 hover:text-red-400">
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.8} />
          <span className="font-medium">Cerrar sesión</span>
        </button>
      </div>
    </div>
  );
}

function AdminSettings() {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [targetRole, setTargetRole] = useState<'adrian' | 'admin'>('admin');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) {
      setMessage({ type: 'error', text: 'Las contraseñas no coinciden.' });
      return;
    }
    if (newPass.length < 4) {
      setMessage({ type: 'error', text: 'La contraseña debe tener al menos 4 caracteres.' });
      return;
    }
    const { updatePassword } = require('@/lib/auth');
    const ok = updatePassword(targetRole, oldPass, newPass);
    if (ok) {
      setMessage({ type: 'success', text: 'Contraseña actualizada correctamente.' });
      setOldPass(''); setNewPass(''); setConfirmPass('');
    } else {
      setMessage({ type: 'error', text: 'La contraseña actual es incorrecta.' });
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-5 flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-gold" />
        <h3 className="font-display text-xl font-bold text-white">Gestión de contraseñas</h3>
      </div>
      <form onSubmit={handleChange} className="rounded-3xl glass-card p-5 space-y-4">
        <div>
          <label className="mb-1.5 block text-xs text-zinc-500">Cambiar contraseña de</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setTargetRole('admin')} className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-all ${targetRole === 'admin' ? 'gold-gradient text-black' : 'glass-card text-zinc-400 hover:text-white'}`}>Usuario general</button>
            <button type="button" onClick={() => setTargetRole('adrian')} className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-all ${targetRole === 'adrian' ? 'gold-gradient text-black' : 'glass-card text-zinc-400 hover:text-white'}`}>Adrián</button>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-zinc-500">Contraseña actual</label>
          <input type="password" value={oldPass} onChange={(e) => setOldPass(e.target.value)} placeholder="Contraseña actual" className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/30 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-zinc-500">Nueva contraseña</label>
          <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Nueva contraseña" className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/30 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-zinc-500">Confirmar nueva contraseña</label>
          <input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} placeholder="Repite la nueva contraseña" className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/30 focus:outline-none" />
        </div>
        {message && (
          <div className={`rounded-xl px-4 py-3 text-sm ${message.type === 'success' ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border border-red-500/20 bg-red-500/10 text-red-400'}`}>{message.text}</div>
        )}
        <button type="submit" disabled={!oldPass || !newPass || !confirmPass} className={`flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold uppercase tracking-wider transition-all ${oldPass && newPass && confirmPass ? 'gold-gradient text-black hover:brightness-110 active:scale-[0.98]' : 'bg-white/5 text-zinc-600'}`}>
          <KeyRound className="h-4 w-4" />Actualizar contraseña
        </button>
      </form>
    </div>
  );
}
