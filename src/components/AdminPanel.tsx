import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { AdminNotifications } from '@/components/admin/AdminNotifications';
import {
  Inbox,
  Bell,
  CalendarDays,
  Clock,
  PlusCircle,
  SlidersHorizontal,
  Scissors,
  Users,
  Search,
  X,
  LogOut,
  Menu,
  ArrowLeft,
  RotateCw,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Sun,
  Moon,
  ExternalLink,
  Plus,
  Check,
  type LucideIcon,
} from 'lucide-react';
import { InstallAppButton } from '@/components/InstallAppButton';
import { setActivePwaContext } from '@/lib/pwaContext';
import { toISO, isBlockExpired } from '@/lib/schedule';

interface AdminPanelProps {
  userRole: UserRole;
  onSignOut: () => void;
  onGoPublic: () => void;
}

export type AdminTab =
  | 'today'
  | 'notifications'
  | 'agenda'
  | 'manual'
  | 'availability'
  | 'services'
  | 'staff'
  | 'schedule'
  | 'customers'
  | 'profile';

interface NavItem {
  id: AdminTab;
  label: string;
  icon: LucideIcon;
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
  const [unreadNotifsCount, setUnreadNotifsCount] = useState<number>(0);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [isLightMode, setIsLightMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('light-mode');
    }
    return false;
  });

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showBarberSelector, setShowBarberSelector] = useState(false);

  const isAdmin = userRole.role === 'admin' && userRole.status === 'verified';

  useEffect(() => {
    setActivePwaContext('admin');
  }, []);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('admin_sidebar_collapsed', next ? 'true' : 'false');
      } catch {}
      return next;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setIsLightMode((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('light-mode', next);
      try {
        localStorage.setItem('adrian_theme', next ? 'light' : 'dark');
      } catch {}
      return next;
    });
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    setShowProfileMenu(false);
  }, []);

  const reloadBarbers = useCallback(async () => {
    const data = await fetchAllBarbers();
    setBarbers(data);
  }, []);

  useEffect(() => {
    reloadBarbers();
  }, [reloadBarbers]);

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

    let query = supabase
      .from('bookings')
      .select('*')
      .order('booking_date', { ascending: true })
      .order('booking_time', { ascending: true });
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
    let query = supabase
      .from('barber_blocks')
      .select('*')
      .order('created_at', { ascending: false });
    if (selectedBarber !== 'all') query = query.eq('barber', selectedBarber);
    const { data } = await query;
    const rawBlocks = (data as BarberBlock[]) ?? [];

    const d = new Date();
    const curIso = toISO(d);
    const curTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const expiredIds = rawBlocks
      .filter((b) => isBlockExpired(b, curIso, curTime))
      .map((b) => b.id);
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
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    const rawCustomers = (data as Customer[]) ?? [];
    setCustomers(
      rawCustomers.filter(
        (c) => !c.email || !TEST_EMAILS.includes(c.email.toLowerCase().trim())
      )
    );
  }, [isAdmin]);

  const fetchUnreadNotifs = useCallback(async () => {
    try {
      let q = supabase
        .from('booking_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('read', false);
      if (selectedBarber !== 'all') {
        q = q.eq('barber', selectedBarber);
      }
      const { count } = await q;
      setUnreadNotifsCount(count ?? 0);
    } catch {
      // ignore
    }
  }, [selectedBarber]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchBookings(), fetchBlocks(), fetchCustomers(), fetchUnreadNotifs()]);
    setLoading(false);
  }, [fetchBookings, fetchBlocks, fetchCustomers, fetchUnreadNotifs]);

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

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-bookings-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchBookings();
        fetchUnreadNotifs();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_notifications' }, () => {
        fetchUnreadNotifs();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barber_blocks' }, () => fetchBlocks())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barber_vacations' }, () => fetchBlocks())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barber_schedules' }, () => fetchBlocks())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBookings, fetchBlocks, fetchUnreadNotifs]);

  // Periodic purge of expired blocks
  useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date();
      const curIso = toISO(d);
      const curTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

      setBlocks((prev) => {
        const expiredBlockIds = prev
          .filter((b) => isBlockExpired(b, curIso, curTime))
          .map((b) => b.id);
        if (expiredBlockIds.length > 0) {
          supabase.from('barber_blocks').delete().in('id', expiredBlockIds).then(() => {});
          return prev.filter((b) => !expiredBlockIds.includes(b.id));
        }
        return prev;
      });
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Main menu items (under "Menu" header)
  const menuItems: NavItem[] = useMemo(
    () => [
      { id: 'agenda', label: 'Agenda Completa', icon: Clock },
      { id: 'manual', label: 'Cita Manual', icon: PlusCircle },
      { id: 'availability', label: 'Horarios y Bloqueos', icon: SlidersHorizontal, adminOnly: true },
      { id: 'schedule', label: 'Horarios Semanales', icon: CalendarDays, adminOnly: true },
      { id: 'customers', label: 'Clientes', icon: Users },
      { id: 'services', label: 'Servicios', icon: Scissors, adminOnly: true },
      { id: 'staff', label: 'Personal', icon: Users, adminOnly: true },
    ],
    []
  );

  const filteredMenuItems = useMemo(() => {
    const allowed = menuItems.filter((item) => (isAdmin ? true : !item.adminOnly));
    if (!search.trim()) return allowed;
    const q = search.toLowerCase().trim();
    return allowed.filter((item) => item.label.toLowerCase().includes(q));
  }, [menuItems, isAdmin, search]);

  const activeBarber = barbers.find((b) => b.id === selectedBarber) ?? null;
  const todayCount = bookings.filter(
    (b) => b.booking_date === toISO(new Date()) && b.status !== 'cancelled'
  ).length;

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
    setShowBarberSelector(false);
  }, []);

  const panelTitle = isAdmin ? 'Panel de Administración' : 'Panel de Barbero';

  // Resolved barber profile for the bottom profile button
  const currentProfileBarber = useMemo(() => {
    if (activeBarber) return activeBarber;
    if (userRole.barber_id) {
      const found = barbers.find((b) => b.id === userRole.barber_id);
      if (found) return found;
    }
    // Fallback: Adrián Millán
    const adrian = barbers.find((b) => b.id === 'adrian');
    if (adrian) return adrian;
    return barbers[0] || null;
  }, [activeBarber, userRole.barber_id, barbers]);

  const profileDisplayName = currentProfileBarber?.name || (isAdmin ? 'Adrián Millán' : 'Mi Perfil');
  const profileRoleSubtitle = isAdmin ? 'Administrador' : currentProfileBarber?.role || 'Barbero';

  return (
    <div
      data-lenis-prevent
      className="flex min-h-screen md:h-screen md:max-h-screen md:overflow-hidden w-full overflow-x-hidden bg-zinc-950 text-zinc-200 animate-fade-in"
    >
      {/* =========================================================================
          DESKTOP SIDEBAR (EXPANDED OR COLLAPSED RAIL)
          ========================================================================= */}
      <aside
        className={`fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-white/5 bg-zinc-900/80 backdrop-blur-xl transition-all duration-300 ease-in-out md:flex ${
          isCollapsed ? 'w-18' : 'w-64'
        }`}
      >
        {/* Header: Logo + Title + Collapse Toggle */}
        <div className="flex h-14 items-center justify-between px-3 border-b border-white/5">
          <div
            onClick={() => handleNav('today')}
            className={`flex items-center gap-2.5 cursor-pointer min-w-0 transition-opacity ${
              isCollapsed ? 'justify-center w-full' : ''
            }`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl gold-gradient font-display text-xs font-black text-black shadow-md shadow-gold/20">
              AM
            </div>
            {!isCollapsed && (
              <span className="font-display text-sm font-bold text-white tracking-tight truncate">
                Adrián Millán
              </span>
            )}
          </div>

          {!isCollapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              title="Colapsar menú lateral"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Search Bar (Quick search) */}
        {!isCollapsed ? (
          <div className="px-3 pt-3 pb-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Quick search"
                aria-label="Buscar sección"
                className="w-full rounded-xl border border-white/5 bg-black/40 py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-zinc-500 focus:border-gold/40 focus:outline-none transition-colors"
              />
            </div>
          </div>
        ) : (
          <div className="flex justify-center pt-2 pb-1">
            <button
              onClick={toggleCollapsed}
              title="Expandir menú lateral"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Scrollable Navigation Area */}
        <div data-lenis-prevent className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-4 no-scrollbar">
          {/* Top Quick Links: Inbox & Notifications */}
          <div className="space-y-1">
            {/* Inbox (Citas de Hoy) */}
            <button
              onClick={() => handleNav('today')}
              title={isCollapsed ? `Citas de hoy (${todayCount})` : undefined}
              className={`group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all ${
                tab === 'today'
                  ? 'bg-gold/15 text-gold border border-gold/30 shadow-sm'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              <div className="relative flex items-center justify-center shrink-0">
                <Inbox className="h-4 w-4" />
                {isCollapsed && todayCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gold text-[0.55rem] font-black text-black">
                    {todayCount > 9 ? '9+' : todayCount}
                  </span>
                )}
              </div>
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left">Inbox</span>
                  <span
                    className={`rounded-full px-2 py-0.2 text-[0.65rem] font-bold ${
                      tab === 'today'
                        ? 'bg-gold/25 text-gold'
                        : 'bg-white/10 text-zinc-300'
                    }`}
                  >
                    {todayCount}
                  </span>
                </>
              )}
            </button>

            {/* Notifications */}
            <button
              onClick={() => handleNav('notifications')}
              title={isCollapsed ? `Notificaciones (${unreadNotifsCount})` : undefined}
              className={`group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all ${
                tab === 'notifications'
                  ? 'bg-gold/15 text-gold border border-gold/30 shadow-sm'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              <div className="relative flex items-center justify-center shrink-0">
                <Bell className="h-4 w-4" />
                {isCollapsed && unreadNotifsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[0.55rem] font-black text-white animate-pulse">
                    {unreadNotifsCount > 9 ? '9+' : unreadNotifsCount}
                  </span>
                )}
              </div>
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left">Notifications</span>
                  {unreadNotifsCount > 0 && (
                    <span className="rounded-full bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.2 text-[0.65rem] font-bold">
                      {unreadNotifsCount > 15 ? '15+' : unreadNotifsCount}
                    </span>
                  )}
                </>
              )}
            </button>
          </div>

          {/* Section: Menu */}
          <div>
            {!isCollapsed && (
              <p className="px-2.5 pb-1 text-[0.65rem] font-bold uppercase tracking-wider text-zinc-500">
                Menu
              </p>
            )}
            <div className="space-y-0.5">
              {filteredMenuItems.map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-xs font-medium transition-all ${
                      active
                        ? 'bg-gold/15 text-gold font-semibold border border-gold/30'
                        : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                    } ${isCollapsed ? 'justify-center px-0' : ''}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                    {!isCollapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Callout Card (Inspired by "Current plan: Pro trial" in screenshot) */}
          {!isCollapsed ? (
            <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/10 via-white/[0.02] to-transparent p-3 shadow-md">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl gold-gradient text-black">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[0.65rem] font-bold text-gold uppercase tracking-wider">Adrián Millán</p>
                  <p className="text-xs font-bold text-white truncate">Salón Activo</p>
                </div>
              </div>
              <p className="text-[0.7rem] text-zinc-400 leading-snug">
                {todayCount} citas programadas para hoy.
              </p>
              <button
                onClick={() => handleNav('manual')}
                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl gold-gradient py-1.5 text-xs font-bold text-black transition-all hover:brightness-110 active:scale-95 shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Nueva Cita Manual</span>
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={() => handleNav('manual')}
                title="Nueva Cita Manual"
                className="flex h-9 w-9 items-center justify-center rounded-xl gold-gradient text-black shadow-md transition-all hover:scale-105 active:scale-95"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Secondary Utilities List */}
          <div className="pt-2 border-t border-white/5 space-y-0.5">
            {/* Filter by Barber */}
            <div className="relative">
              <button
                onClick={() => setShowBarberSelector((prev) => !prev)}
                title={isCollapsed ? `Filtro: ${activeBarber?.name || 'Todos'}` : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-colors ${
                  isCollapsed ? 'justify-center px-0' : ''
                }`}
              >
                <SlidersHorizontal className="h-4 w-4 shrink-0" />
                {!isCollapsed && (
                  <span className="flex-1 text-left truncate">
                    {selectedBarber === 'all' ? 'Todos los barberos' : activeBarber?.name || 'Barbero'}
                  </span>
                )}
              </button>

              {/* Barber selector popup */}
              {showBarberSelector && !isCollapsed && (
                <div className="mt-1 mb-2 rounded-xl border border-white/10 bg-zinc-900/95 p-1.5 shadow-xl backdrop-blur-xl">
                  <button
                    onClick={() => handleSelectBarber('all')}
                    className={`w-full text-left px-2 py-1 text-xs rounded-lg flex items-center justify-between ${
                      selectedBarber === 'all' ? 'bg-gold/15 text-gold font-bold' : 'text-zinc-300 hover:bg-white/5'
                    }`}
                  >
                    <span>Todos los barberos</span>
                    {selectedBarber === 'all' && <Check className="h-3 w-3" />}
                  </button>
                  {barbers.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => handleSelectBarber(b.id)}
                      className={`w-full text-left px-2 py-1 text-xs rounded-lg flex items-center justify-between ${
                        selectedBarber === b.id ? 'bg-gold/15 text-gold font-bold' : 'text-zinc-300 hover:bg-white/5'
                      }`}
                    >
                      <span>{b.name}</span>
                      {selectedBarber === b.id && <Check className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dark mode / Light mode toggle */}
            <button
              onClick={toggleTheme}
              title={isCollapsed ? (isLightMode ? 'Modo Oscuro' : 'Modo Claro') : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-colors ${
                isCollapsed ? 'justify-center px-0' : ''
              }`}
            >
              {isLightMode ? (
                <Moon className="h-4 w-4 shrink-0" />
              ) : (
                <Sun className="h-4 w-4 shrink-0" />
              )}
              {!isCollapsed && (
                <span className="flex-1 text-left">
                  {isLightMode ? 'Modo oscuro' : 'Modo claro'}
                </span>
              )}
            </button>

            {/* Reload page */}
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              title={isCollapsed ? 'Actualizar agenda' : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-colors ${
                isCollapsed ? 'justify-center px-0' : ''
              }`}
            >
              <RotateCw className={`h-4 w-4 shrink-0 ${refreshing ? 'animate-spin text-gold' : ''}`} />
              {!isCollapsed && <span className="flex-1 text-left">Actualizar</span>}
            </button>

            {/* Go to public website */}
            <button
              onClick={onGoPublic}
              title={isCollapsed ? 'Volver a la web' : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-white/5 hover:text-gold transition-colors ${
                isCollapsed ? 'justify-center px-0' : ''
              }`}
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span className="flex-1 text-left">Ver web pública</span>}
            </button>
          </div>
        </div>

        {/* =========================================================================
            BOTTOM FOOTER PROFILE ITEM (Mi Perfil de Barbero - Incluido para Adrián)
            ========================================================================= */}
        <div className="relative border-t border-white/5 p-2 bg-zinc-950/40">
          <button
            onClick={() => handleNav('profile')}
            title={isCollapsed ? `${profileDisplayName} (${profileRoleSubtitle})` : undefined}
            className={`flex w-full items-center gap-2.5 rounded-xl p-2 transition-all duration-200 ${
              tab === 'profile'
                ? 'bg-gold/15 text-gold border border-gold/30'
                : 'hover:bg-white/5 text-zinc-300'
            } ${isCollapsed ? 'justify-center p-1' : ''}`}
          >
            {/* User Avatar */}
            {currentProfileBarber?.photo_url ? (
              <img
                src={currentProfileBarber.photo_url}
                alt={profileDisplayName}
                className="h-8 w-8 rounded-full object-cover ring-1 ring-gold/30 shrink-0"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full gold-gradient font-display text-[0.65rem] font-bold text-black shadow-sm">
                {currentProfileBarber?.initials || 'AM'}
              </div>
            )}

            {/* Name + Role Subtitle */}
            {!isCollapsed && (
              <>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-xs font-bold text-white truncate">{profileDisplayName}</p>
                  <p className="text-[10px] text-zinc-400 truncate">{profileRoleSubtitle}</p>
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowProfileMenu((prev) => !prev);
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 transition-colors"
                >
                  <ChevronsUpDown className="h-3.5 w-3.5 shrink-0" />
                </div>
              </>
            )}
          </button>

          {/* Profile options popover */}
          {showProfileMenu && !isCollapsed && (
            <div className="absolute bottom-16 left-2 right-2 rounded-2xl border border-white/10 bg-zinc-900/95 p-1.5 shadow-2xl backdrop-blur-xl animate-scale-in">
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  handleNav('profile');
                }}
                className="w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-zinc-200 hover:bg-white/5 hover:text-gold flex items-center gap-2 transition-colors"
              >
                <Scissors className="h-3.5 w-3.5" />
                <span>Mi Perfil de Barbero</span>
              </button>
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  onSignOut();
                }}
                className="w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors border-t border-white/5 mt-1 pt-1"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* =========================================================================
          MOBILE DRAWER SIDEBAR (SLIDE IN)
          ========================================================================= */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300"
            onClick={closeSidebar}
          />
          <div className="absolute left-0 top-0 h-full w-72 border-r border-white/5 bg-zinc-900/95 backdrop-blur-xl transition-transform duration-300 ease-out animate-slide-in-left flex flex-col">
            <div className="flex h-14 items-center justify-between px-4 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl gold-gradient font-display text-xs font-black text-black">
                  AM
                </div>
                <span className="font-display text-sm font-bold text-white">Adrián Millán</span>
              </div>
              <button
                onClick={closeSidebar}
                aria-label="Cerrar menú"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-zinc-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quick search input */}
            <div className="px-3 pt-3 pb-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Quick search"
                  className="w-full rounded-xl border border-white/5 bg-black/40 py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Mobile Nav items */}
            <div data-lenis-prevent className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
              <div className="space-y-1">
                <button
                  onClick={() => handleNav('today')}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold ${
                    tab === 'today' ? 'bg-gold/15 text-gold' : 'text-zinc-400 hover:bg-white/5'
                  }`}
                >
                  <Inbox className="h-4 w-4" />
                  <span className="flex-1 text-left">Inbox (Citas de Hoy)</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.2 text-[0.65rem] font-bold">
                    {todayCount}
                  </span>
                </button>

                <button
                  onClick={() => handleNav('notifications')}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold ${
                    tab === 'notifications' ? 'bg-gold/15 text-gold' : 'text-zinc-400 hover:bg-white/5'
                  }`}
                >
                  <Bell className="h-4 w-4" />
                  <span className="flex-1 text-left">Notificaciones</span>
                  {unreadNotifsCount > 0 && (
                    <span className="rounded-full bg-red-500/20 text-red-300 px-2 py-0.2 text-[0.65rem] font-bold">
                      {unreadNotifsCount}
                    </span>
                  )}
                </button>
              </div>

              <div>
                <p className="px-2.5 pb-1 text-[0.65rem] font-bold uppercase tracking-wider text-zinc-500">
                  Menu
                </p>
                <div className="space-y-0.5">
                  {filteredMenuItems.map((item) => {
                    const Icon = item.icon;
                    const active = tab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNav(item.id)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium ${
                          active ? 'bg-gold/15 text-gold font-semibold' : 'text-zinc-400 hover:bg-white/5'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 text-left truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Mobile Footer Profile */}
            <div className="border-t border-white/5 p-3 bg-zinc-950/50">
              <button
                onClick={() => handleNav('profile')}
                className={`flex w-full items-center gap-3 rounded-xl p-2 ${
                  tab === 'profile' ? 'bg-gold/15 text-gold' : 'text-zinc-300 hover:bg-white/5'
                }`}
              >
                {currentProfileBarber?.photo_url ? (
                  <img
                    src={currentProfileBarber.photo_url}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full gold-gradient font-display text-[0.65rem] font-bold text-black">
                    {currentProfileBarber?.initials || 'AM'}
                  </div>
                )}
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-xs font-bold text-white truncate">{profileDisplayName}</p>
                  <p className="text-[10px] text-zinc-400">Mi Perfil de Barbero</p>
                </div>
                <ChevronsUpDown className="h-3.5 w-3.5 text-zinc-400" />
              </button>
              <button
                onClick={onSignOut}
                className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-red-400 hover:bg-red-500/10"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MAIN CONTENT VIEW AREA
          ========================================================================= */}
      <main
        className={`flex-1 w-full min-w-0 max-w-full overflow-x-hidden transition-all duration-300 ease-in-out md:h-screen md:max-h-screen md:flex md:flex-col md:overflow-hidden ${
          isCollapsed ? 'md:ml-18' : 'md:ml-64'
        }`}
      >
        {/* Mobile Header Bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/5 bg-zinc-900/80 px-4 py-3 backdrop-blur-xl md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-zinc-300"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[0.6rem] uppercase tracking-[0.2em] text-gold">{panelTitle}</p>
            <h2 className="font-display text-base font-bold text-white truncate">
              {tab === 'today'
                ? 'Citas de Hoy'
                : tab === 'notifications'
                ? 'Notificaciones'
                : tab === 'profile'
                ? 'Mi Perfil de Barbero'
                : menuItems.find((n) => n.id === tab)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <InstallAppButton appName="Admin Adrián Millán" compact />
            <button
              onClick={() => handleManualRefresh()}
              disabled={refreshing}
              aria-label="Recargar"
              title="Recargar página (F5 / Ctrl+R)"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-zinc-300 hover:text-gold transition-colors"
            >
              <RotateCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-gold' : ''}`} />
            </button>
            <button
              onClick={onGoPublic}
              aria-label="Volver a la web"
              title="Volver a la web"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-zinc-300 hover:text-gold transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Desktop Top Header Bar */}
        <header className="sticky top-0 z-20 hidden items-center justify-between border-b border-white/5 bg-zinc-950/60 px-6 py-3 backdrop-blur-xl md:flex md:shrink-0">
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.2em] text-gold">{panelTitle}</p>
            <h1 className="font-display text-2xl font-bold text-white">
              {tab === 'today'
                ? 'Citas de Hoy'
                : tab === 'notifications'
                ? 'Centro de Notificaciones'
                : tab === 'profile'
                ? 'Mi Perfil de Barbero'
                : menuItems.find((n) => n.id === tab)?.label}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Active barber indicator badge */}
            {activeBarber ? (
              <div className="flex items-center gap-2.5 rounded-full glass-card px-3 py-1.5">
                {activeBarber.photo_url ? (
                  <img
                    src={activeBarber.photo_url}
                    alt=""
                    className="h-6 w-6 rounded-full object-cover ring-1 ring-gold/30"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full gold-gradient font-display text-[0.6rem] font-bold text-black">
                    {activeBarber.initials}
                  </div>
                )}
                <span className="text-xs font-semibold text-zinc-300">{activeBarber.name}</span>
              </div>
            ) : (
              <span className="rounded-full glass-card px-3 py-1.5 text-xs font-medium text-zinc-400">
                Todos los barberos
              </span>
            )}

            <InstallAppButton appName="Admin Adrián Millán" compact />

            <button
              onClick={() => handleManualRefresh()}
              disabled={refreshing}
              aria-label="Recargar página entera"
              title="Recargar página entera del navegador (F5 / Ctrl+R)"
              className="flex items-center gap-1.5 rounded-full glass-card px-3 py-1.5 text-xs font-medium text-zinc-300 transition-all hover:text-gold hover:border-gold/30 active:scale-95 disabled:opacity-50"
            >
              <RotateCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-gold' : ''}`} />
              <span className="hidden lg:inline">Actualizar</span>
            </button>

            <button
              onClick={onGoPublic}
              aria-label="Volver a la web"
              title="Volver a la web pública"
              className="flex items-center gap-1.5 rounded-full glass-card px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:text-gold"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Volver a la web</span>
            </button>
          </div>
        </header>

        {/* Dynamic Tab Body Container */}
        <div className="w-full min-w-0 px-2.5 py-3 sm:px-4 md:px-6 md:py-3.5 md:flex-1 md:overflow-y-auto flex flex-col">
          <div className="admin-embed w-full min-w-0 flex-1 flex flex-col rounded-2xl p-3 sm:rounded-3xl sm:p-4 md:p-5 min-h-full">
            {tab === 'today' && (
              <AdminToday bookings={bookings} loading={loading} onRefresh={refresh} />
            )}

            {tab === 'notifications' && (
              <AdminNotifications
                barbers={barbers}
                selectedBarber={selectedBarber}
                onRefreshBookings={refresh}
                onNavigateToAgenda={(date) => {
                  handleNav('agenda');
                }}
              />
            )}

            {tab === 'agenda' && (
              <AdminAgenda bookings={bookings} loading={loading} onRefresh={refresh} />
            )}

            {tab === 'manual' && (
              <AdminManualBooking onCreated={refresh} />
            )}

            {tab === 'profile' && (
              <AdminProfile userRole={userRole} onBarberUpdated={reloadBarbers} />
            )}

            {tab === 'availability' && isAdmin && (
              <AdminAvailability blocks={blocks} onRefresh={refresh} />
            )}

            {tab === 'services' && isAdmin && (
              <AdminServices />
            )}

            {tab === 'staff' && isAdmin && (
              <AdminStaff />
            )}

            {tab === 'schedule' && isAdmin && (
              <AdminStaffSchedule />
            )}

            {tab === 'customers' && (isAdmin || userRole.role === 'barber') && (
              <AdminCustomers customers={customers} loading={loading} onRefresh={refresh} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
