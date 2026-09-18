import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllBarbers } from '@/data/services';
import type { SavedBooking, BarberBlock, Barber, Customer, UserRole } from '@/types';
import { AdminToday } from '@/components/admin/AdminToday';
import { AdminAgenda } from '@/components/admin/AdminAgenda';
import { AdminManualBooking } from '@/components/admin/AdminManualBooking';
import { AdminAvailability } from '@/components/admin/AdminAvailability';
import { AdminServices } from '@/components/admin/AdminServices';
import { AdminStaff } from '@/components/admin/AdminStaff';
import { AdminStaffSchedule } from '@/components/admin/AdminStaffSchedule';
import { AdminCustomers } from '@/components/admin/AdminCustomers';
import { AdminProfile } from '@/components/admin/AdminProfile';
import {
  CalendarDays, Clock, PlusCircle, SlidersHorizontal, Scissors, Users,
  Search, X, LogOut, Menu, ArrowLeft, RotateCw, UserCircle2, type LucideIcon,
} from 'lucide-react';
import { InstallAppButton } from '@/components/InstallAppButton';
import { setActivePwaContext } from '@/lib/pwaContext';
import { notify } from '@/lib/notify';
import { toISO, isBlockExpired } from '@/lib/schedule';

const CATEGORIES = ['Principal', 'Control', 'Gestión'];

interface AdminPanelProps {
  userRole: UserRole;
  onSignOut: () => void;
  onGoPublic: () => void;
}

type AdminTab = 'today' | 'agenda' | 'manual' | 'availability' | 'services' | 'staff' | 'schedule' | 'customers' | 'profile';

interface NavItem {
  id: AdminTab;
  label: string;
  icon: LucideIcon;
  category: string;
  adminOnly?: boolean;
  barberOnly?: boolean;
}

export const TEST_EMAILS = [
  'javijunior2018@gmail.com',
  'franciscojavierfarinapadilla@gmail.com',
  'javiersobased@gmail.com',
];

export function AdminPanel({ userRole, onSignOut, onGoPublic }: AdminPanelProps) {
  const [tab, setTab] = useState<AdminTab>(() => {
    try {
      const saved = sessionStorage.getItem('admin_active_tab') as AdminTab;
      if (saved && saved !== ('store' as any)) return saved;
    } catch {}
    return 'today';
  });
  const [selectedBarber, setSelectedBarber] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('admin_selected_barber');
      if (saved) return saved;
    } catch {}
    return 'all';
  });
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [bookings, setBookings] = useState<SavedBooking[]>([]);
  const [blocks, setBlocks] = useState<BarberBlock[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');

  const isAdmin = userRole.role === 'admin' && userRole.status === 'verified';

  useEffect(() => { setActivePwaContext('admin'); }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const reloadBarbers = useCallback(async () => {
    const data = await fetchAllBarbers();
    setBarbers(data);
  }, []);

  useEffect(() => { reloadBarbers(); }, [reloadBarbers]);

  useEffect(() => {
    if (!isAdmin && userRole.barber_id) {
      setSelectedBarber(userRole.barber_id);
    }
  }, [isAdmin, userRole.barber_id]);

  const fetchBookings = useCallback(async () => {
    if (isAdmin) {
      try {
        for (const email of TEST_EMAILS) {
          await supabase.from('bookings').delete().ilike('email', email);
        }
      } catch (err) {
        console.warn('Error purgando citas de prueba:', err);
      }
    }

    let query = supabase.from('bookings').select('*').order('booking_date', { ascending: true }).order('booking_time', { ascending: true });
    if (selectedBarber !== 'all') query = query.eq('barber', selectedBarber);
    const { data } = await query;
    const rawList = (data as SavedBooking[]) ?? [];
    const filtered = rawList.filter((b) => {
      if (!b.email) return true;
      return !TEST_EMAILS.includes(b.email.toLowerCase().trim());
    });

    setBookings(filtered);
  }, [selectedBarber, isAdmin]);

  const fetchBlocks = useCallback(async () => {
    let query = supabase.from('barber_blocks').select('*').order('created_at', { ascending: false });
    if (selectedBarber !== 'all') query = query.eq('barber', selectedBarber);
    const { data } = await query;
    const rawBlocks = (data as BarberBlock[]) ?? [];

    const d = new Date();
    const curIso = toISO(d);
    const curTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const expiredIds = rawBlocks.filter((b) => isBlockExpired(b, curIso, curTime)).map((b) => b.id);
    if (expiredIds.length > 0) {
      supabase.from('barber_blocks').delete().in('id', expiredIds).then(() => {});
    }

    setBlocks(rawBlocks.filter((b) => !isBlockExpired(b, curIso, curTime)));
  }, [selectedBarber]);

  const fetchCustomers = useCallback(async () => {
    if (isAdmin) {
      try {
        for (const email of TEST_EMAILS) {
          await supabase.from('customers').delete().ilike('email', email);
        }
      } catch (err) {
        console.warn('Error purgando clientes de prueba:', err);
      }
    }
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    const rawCustomers = (data as Customer[]) ?? [];
    setCustomers(rawCustomers.filter((c) => !c.email || !TEST_EMAILS.includes(c.email.toLowerCase().trim())));
  }, [isAdmin]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchBookings(), fetchBlocks()]);
    if (isAdmin) {
      await fetchCustomers();
    }
    setLoading(false);
  }, [fetchBookings, fetchBlocks, fetchCustomers, isAdmin]);

  const handleManualRefresh = useCallback(() => {
    try {
      sessionStorage.setItem('admin_active_tab', tab);
      sessionStorage.setItem('admin_selected_barber', selectedBarber);
    } catch {}
    if (window.location.hash !== '#admin') {
      window.location.hash = '#admin';
    }
    setRefreshing(true);
    window.location.reload();
  }, [tab, selectedBarber]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r')) {
        e.preventDefault();
        handleManualRefresh();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleManualRefresh]);

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

  // Auto-purga periódica cada 15s de bloqueos pasados
  useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date();
      const curIso = toISO(d);
      const curTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

      // Purgar bloqueos pasados de la base de datos y de la vista
      setBlocks((prev) => {
        const expiredBlockIds = prev.filter((b) => isBlockExpired(b, curIso, curTime)).map((b) => b.id);
        if (expiredBlockIds.length > 0) {
          supabase.from('barber_blocks').delete().in('id', expiredBlockIds).then(() => {});
          return prev.filter((b) => !expiredBlockIds.includes(b.id));
        }
        return prev;
      });
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const allNavItems: NavItem[] = [
    { id: 'today', label: 'Citas de Hoy', icon: CalendarDays, category: 'Principal' },
    { id: 'manual', label: 'Cita Manual', icon: PlusCircle, category: 'Principal' },
    { id: 'agenda', label: 'Agenda Completa', icon: Clock, category: 'Principal' },
    { id: 'profile', label: 'Mi Perfil', icon: UserCircle2, category: 'Principal', barberOnly: true },
    { id: 'availability', label: 'Horarios y Bloqueos', icon: SlidersHorizontal, category: 'Control', adminOnly: true },
    { id: 'schedule', label: 'Horarios Semanales', icon: Clock, category: 'Control', adminOnly: true },
    { id: 'customers', label: 'Clientes', icon: Users, category: 'Gestión', adminOnly: true },
    { id: 'services', label: 'Servicios', icon: Scissors, category: 'Gestión', adminOnly: true },
    { id: 'staff', label: 'Personal', icon: Users, category: 'Gestión', adminOnly: true },
  ];

  const navItems = allNavItems.filter((n) => (isAdmin ? !n.barberOnly : !n.adminOnly));
  const filteredNav = navItems.filter((n) => n.label.toLowerCase().includes(search.toLowerCase()));
  const activeBarber = barbers.find((b) => b.id === selectedBarber) ?? null;
  const todayCount = bookings.filter((b) => b.booking_date === toISO(new Date()) && b.status !== 'cancelled').length;

  const handleNav = (id: AdminTab) => {
    setTab(id);
    closeSidebar();
    try {
      sessionStorage.setItem('admin_active_tab', id);
    } catch {}
  };

  const handleSelectBarber = useCallback((id: string) => {
    setSelectedBarber(id);
    try {
      sessionStorage.setItem('admin_selected_barber', id);
    } catch {}
  }, []);

  const panelTitle = isAdmin ? 'Panel de Administración' : 'Panel de Barbero';

  return (
    <div data-lenis-prevent className="flex min-h-screen md:h-screen md:max-h-screen md:overflow-hidden w-full overflow-x-hidden bg-zinc-950 text-zinc-200 animate-fade-in">
      {/* Icon Dock — desktop only */}
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
        <button onClick={onGoPublic} className="flex h-11 w-11 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-gold/10 hover:text-gold" title="Volver a la web">
          <ArrowLeft className="h-5 w-5" strokeWidth={1.8} />
        </button>
        <button onClick={onSignOut} className="flex h-11 w-11 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400" title="Cerrar sesión">
          <LogOut className="h-5 w-5" strokeWidth={1.8} />
        </button>
      </div>

      {/* Desktop Sidebar */}
      <div className="fixed left-16 top-0 z-30 hidden h-screen w-64 flex-col border-r border-white/5 bg-zinc-900/60 backdrop-blur-xl md:flex">
        <SidebarContent barbers={barbers} selectedBarber={selectedBarber} setSelectedBarber={handleSelectBarber}
          activeBarber={activeBarber} search={search} setSearch={setSearch} tab={tab} onNav={handleNav}
          filteredNav={filteredNav} todayCount={todayCount} onSignOut={onSignOut} isAdmin={isAdmin} panelTitle={panelTitle} />
      </div>

      {/* Mobile sidebar — smooth slide-in from left */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300" onClick={closeSidebar} />
          <div className="absolute left-0 top-0 h-full w-72 border-r border-white/5 bg-zinc-900/95 backdrop-blur-xl transition-transform duration-300 ease-out animate-slide-in-left">
            <button onClick={closeSidebar} className="absolute right-3 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-zinc-400">
              <X className="h-4 w-4" />
            </button>
            <SidebarContent barbers={barbers} selectedBarber={selectedBarber} setSelectedBarber={handleSelectBarber}
              activeBarber={activeBarber} search={search} setSearch={setSearch} tab={tab} onNav={handleNav}
              filteredNav={filteredNav} todayCount={todayCount} onSignOut={onSignOut} isAdmin={isAdmin} panelTitle={panelTitle} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 w-full min-w-0 max-w-full overflow-x-hidden md:ml-80 md:h-screen md:max-h-screen md:flex md:flex-col md:overflow-hidden">
        {/* Mobile header — only "Volver a la web" button */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/5 bg-zinc-900/80 px-4 py-4 backdrop-blur-xl md:hidden">
          <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menú" className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-zinc-300">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[0.6rem] uppercase tracking-[0.2em] text-gold">{panelTitle}</p>
            <h2 className="font-display text-lg font-bold leading-tight text-white truncate">{navItems.find((n) => n.id === tab)?.label}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <InstallAppButton appName="Admin Adrián Millán" className="mr-1" compact />
            <button
              onClick={() => handleManualRefresh()}
              disabled={refreshing}
              aria-label="Recargar página entera"
              title="Recargar página entera del navegador (F5 / Ctrl+R)"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-zinc-300 transition-all hover:bg-gold/10 hover:text-gold active:scale-95 disabled:opacity-50"
            >
              <RotateCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-gold' : ''}`} />
            </button>
            <button onClick={onGoPublic} aria-label="Volver a la web" title="Volver a la web" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-zinc-300 transition-colors hover:bg-gold/10 hover:text-gold">
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Desktop header — only "Volver a la web" button */}
        <header className="sticky top-0 z-20 hidden items-center justify-between border-b border-white/5 bg-zinc-950/60 px-6 py-3.5 backdrop-blur-xl md:flex md:shrink-0">
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.2em] text-gold">{panelTitle}</p>
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
            <InstallAppButton appName="Admin Adrián Millán" compact />
            <button
              onClick={() => handleManualRefresh()}
              disabled={refreshing}
              aria-label="Recargar página entera"
              title="Recargar página entera del navegador (F5 / Ctrl+R)"
              className="flex items-center gap-2 rounded-full glass-card px-3 py-2 text-xs font-medium text-zinc-300 transition-all hover:text-gold hover:border-gold/30 active:scale-95 disabled:opacity-50"
            >
              <RotateCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-gold' : ''}`} />
              <span className="hidden lg:inline">Actualizar</span>
            </button>
            <button onClick={onGoPublic} aria-label="Volver a la web" title="Volver a la web" className="flex items-center gap-2 rounded-full glass-card px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:text-gold">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden lg:inline">Volver a la web</span>
            </button>
          </div>
        </header>

        <div className="w-full min-w-0 px-2.5 py-3 sm:px-4 md:px-6 md:py-3.5 md:flex-1 md:overflow-y-auto flex flex-col">
          <div className="admin-embed w-full min-w-0 flex-1 flex flex-col rounded-2xl p-3 sm:rounded-3xl sm:p-4 md:p-5 min-h-full">
          {tab === 'today' && <AdminToday bookings={bookings} loading={loading} onRefresh={refresh} />}
          {tab === 'agenda' && <AdminAgenda bookings={bookings} loading={loading} onRefresh={refresh} />}
          {tab === 'manual' && <AdminManualBooking onCreated={refresh} />}
          {tab === 'profile' && !isAdmin && <AdminProfile userRole={userRole} onBarberUpdated={reloadBarbers} />}
          {tab === 'availability' && isAdmin && <AdminAvailability blocks={blocks} onRefresh={refresh} />}
          {tab === 'services' && isAdmin && <AdminServices />}
          {tab === 'staff' && isAdmin && <AdminStaff />}
          {tab === 'schedule' && isAdmin && <AdminStaffSchedule />}
          {tab === 'customers' && isAdmin && <AdminCustomers customers={customers} loading={loading} onRefresh={refresh} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarContent({
  barbers, selectedBarber, setSelectedBarber, activeBarber, search, setSearch, tab, onNav, filteredNav, todayCount, onSignOut, isAdmin, panelTitle,
}: {
  barbers: Barber[]; selectedBarber: string; setSelectedBarber: (id: string) => void;
  activeBarber: Barber | null; search: string; setSearch: (s: string) => void; tab: AdminTab;
  onNav: (id: AdminTab) => void; filteredNav: NavItem[]; todayCount: number; onSignOut: () => void; isAdmin: boolean; panelTitle: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/5 p-5">
        <p className="mb-3 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-zinc-500">{panelTitle}</p>
        {isAdmin ? (
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setSelectedBarber('all')} className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${selectedBarber === 'all' ? 'bg-gold/15 text-gold' : 'bg-white/5 text-zinc-500 hover:text-zinc-300'}`}>Todos</button>
            {barbers.map((b) => (
              <button key={b.id} onClick={() => setSelectedBarber(b.id)} className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${selectedBarber === b.id ? 'bg-gold/15 text-gold' : 'bg-white/5 text-zinc-500 hover:text-zinc-300'}`}>{b.name}</button>
            ))}
          </div>
        ) : activeBarber ? (
          <div className="flex items-center gap-2.5 rounded-2xl glass-card p-2.5">
            {activeBarber.photo_url ? (
              <img src={activeBarber.photo_url} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-gold/30" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full gold-gradient font-display text-xs font-bold text-black">{activeBarber.initials}</div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{activeBarber.name}</p>
              <p className="text-[10px] text-zinc-400">Barbero en servicio</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="px-5 py-3">
        <div className="flex items-center gap-2 rounded-xl glass-card px-3 py-2">
          <Search className="h-4 w-4 text-zinc-500" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar sección..." className="w-full bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none" />
        </div>
      </div>

      <nav data-lenis-prevent className="flex-1 overflow-y-auto px-3 pb-4">
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
        <button onClick={onSignOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-400 transition-all hover:bg-red-500/10 hover:text-red-400">
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.8} />
          <span className="font-medium">Cerrar sesión</span>
        </button>
      </div>
    </div>
  );
}
