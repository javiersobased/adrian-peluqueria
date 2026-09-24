import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentBusinessId, tenantFrom, tenantRealtimeFilter } from '@/lib/tenant';
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
  CalendarRange,
  CalendarPlus,
  CalendarOff,
  CalendarClock,
  Contact2,
  IdCard,
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
  Globe,
  Plus,
  Check,
  UserCircle2,
  type LucideIcon,
} from 'lucide-react';
import { InstallAppButton } from '@/components/InstallAppButton';
import { setActivePwaContext } from '@/lib/pwaContext';
import { useBusiness } from '@/context/BusinessContext';
import type { FeatureKey } from '@/lib/features';
import { toISO, isBlockExpired } from '@/lib/schedule';
import { isDeveloper, getDeveloperProfile, isSuperAdminEmail, isMasterAdminEmail } from '@/lib/auth';

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
  // Módulo del plan que habilita la sección (el servidor lo aplica igualmente en RLS).
  requires?: FeatureKey;
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
  const [showMobileProfileMenu, setShowMobileProfileMenu] = useState(false);

  const business = useBusiness();
  const isAdmin = userRole.role === 'admin' && userRole.status === 'verified';

  useEffect(() => {
    setActivePwaContext('admin', business);
  }, [business]);

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
    setShowMobileProfileMenu(false);
  }, []);

  const reloadBarbers = useCallback(async () => {
    const data = await fetchAllBarbers();
    setBarbers(data);
  }, []);

  useEffect(() => {
    reloadBarbers();
  }, [reloadBarbers]);

  // Sync profile changes immediately when modified in AdminProfile
  useEffect(() => {
    const handleProfileUpdated = () => {
      reloadBarbers();
    };
    window.addEventListener('barber_profile_updated', handleProfileUpdated);
    return () => window.removeEventListener('barber_profile_updated', handleProfileUpdated);
  }, [reloadBarbers]);

  // Auto-fetch developer profile from database on mount if dev
  useEffect(() => {
    if (isDeveloper(userRole.email) || userRole.barber_id === 'franciscojavier' || isSuperAdminEmail(userRole.email)) {
      tenantFrom('barbers')
        .select('*')
        .eq('id', 'franciscojavier')
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            if (data.photo_url) {
              localStorage.setItem('barber_photo_franciscojavier', data.photo_url);
              localStorage.setItem('barber_photo_francisco_javier', data.photo_url);
            }
            if (data.name) {
              localStorage.setItem('barber_name_franciscojavier', data.name);
            }
            reloadBarbers();
          }
        });
    }
  }, [userRole.email, userRole.barber_id, reloadBarbers]);

  useEffect(() => {
    if (!isAdmin && userRole.barber_id && !isDeveloper(userRole.email) && !isSuperAdminEmail(userRole.email)) {
      setSelectedBarber(userRole.barber_id);
    }
  }, [isAdmin, userRole.barber_id, userRole.email]);

  const fetchBookings = useCallback(async () => {
    const query = tenantFrom('bookings')
      .select('*')
      .order('booking_date', { ascending: true })
      .order('booking_time', { ascending: true });

    const { data } = await query;
    const rawList = (data as SavedBooking[]) ?? [];
    const filtered = rawList.filter((b) => {
      if (!b.email) return true;
      return !TEST_EMAILS.includes(b.email.toLowerCase().trim());
    });

    setBookings(filtered);
  }, []);

  const fetchBlocks = useCallback(async () => {
    const query = tenantFrom('barber_blocks')
      .select('*')
      .order('created_at', { ascending: false });

    const { data } = await query;
    const rawBlocks = (data as BarberBlock[]) ?? [];

    const d = new Date();
    const curIso = toISO(d);
    const curTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const expiredIds = rawBlocks
      .filter((b) => isBlockExpired(b, curIso, curTime))
      .map((b) => b.id);
    if (expiredIds.length > 0) {
      tenantFrom('barber_blocks').delete().in('id', expiredIds).then(() => {});
    }

    setBlocks(rawBlocks.filter((b) => !isBlockExpired(b, curIso, curTime)));
  }, []);

  const fetchCustomers = useCallback(async () => {
    const { data } = await tenantFrom('customers')
      .select('*')
      .order('created_at', { ascending: false });
    const rawCustomers = (data as Customer[]) ?? [];
    setCustomers(
      rawCustomers.filter(
        (c) => !c.email || !TEST_EMAILS.includes(c.email.toLowerCase().trim())
      )
    );
  }, []);

  const fetchUnreadNotifs = useCallback(async () => {
    try {
      const todayISO = toISO(new Date());

      // Auto-purge past notifications whose scheduled day has passed
      try {
        await tenantFrom('booking_notifications')
          .delete()
          .lt('booking_date', todayISO);

        await tenantFrom('booking_notifications')
          .delete()
          .is('booking_date', null)
          .lt('old_date', todayISO);
      } catch {}

      let q = tenantFrom('booking_notifications')
        .select('id, booking_date, old_date')
        .eq('read', false);
      if (!isAdmin && userRole.barber_id) {
        q = q.eq('barber', userRole.barber_id);
      }
      const { data } = await q;
      const validCount = (data || []).filter((n: any) => {
        const appointmentDate = n.booking_date || n.old_date;
        return !appointmentDate || appointmentDate >= todayISO;
      }).length;
      setUnreadNotifsCount(validCount);
    } catch {
      // ignore
    }
  }, [isAdmin, userRole.barber_id]);

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
      .channel(`admin-bookings-${getCurrentBusinessId()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: tenantRealtimeFilter() }, () => {
        fetchBookings();
        fetchUnreadNotifs();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_notifications', filter: tenantRealtimeFilter() }, () => {
        fetchUnreadNotifs();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barber_blocks', filter: tenantRealtimeFilter() }, () => fetchBlocks())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barber_vacations', filter: tenantRealtimeFilter() }, () => fetchBlocks())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barber_schedules', filter: tenantRealtimeFilter() }, () => fetchBlocks())
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
          tenantFrom('barber_blocks').delete().in('id', expiredBlockIds).then(() => {});
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
      { id: 'agenda', label: 'Agenda Completa', icon: CalendarRange },
      { id: 'manual', label: 'Cita Manual', icon: CalendarPlus, requires: 'allow_manual_booking' },
      { id: 'availability', label: 'Horarios y Bloqueos', icon: CalendarOff, adminOnly: true },
      { id: 'schedule', label: 'Horarios Semanales', icon: CalendarClock, adminOnly: true },
      { id: 'customers', label: 'Clientes', icon: Contact2 },
      { id: 'services', label: 'Servicios', icon: Scissors, adminOnly: true },
      { id: 'staff', label: 'Personal', icon: IdCard, adminOnly: true },
    ],
    []
  );

  const filteredMenuItems = useMemo(() => {
    const allowed = menuItems.filter(
      (item) => (isAdmin || !item.adminOnly) && (!item.requires || business.features[item.requires]),
    );
    if (!search.trim()) return allowed;
    const q = search.toLowerCase().trim();
    return allowed.filter((item) => item.label.toLowerCase().includes(q));
  }, [menuItems, isAdmin, search, business.features]);

  const activeBarber = barbers.find((b) => b.id === selectedBarber) ?? null;
  const todayCount = useMemo(() => {
    const todayISO = toISO(new Date());
    return bookings.filter((b) => {
      if (b.booking_date !== todayISO || b.status === 'cancelled') return false;
      if (selectedBarber && selectedBarber !== 'all') {
        return b.barber === selectedBarber;
      }
      return true;
    }).length;
  }, [bookings, selectedBarber]);

  // Francisco Javier is the super admin — hidden from public but has full control
  const isSuperAdmin = isSuperAdminEmail(userRole.email);

  const totalSalonTodayCount = useMemo(() => {
    const todayISO = toISO(new Date());
    return bookings.filter(
      (b) => b.booking_date === todayISO && b.status !== 'cancelled'
    ).length;
  }, [bookings]);

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
    setShowProfileMenu(false);
    setShowMobileProfileMenu(false);
  }, []);

  const panelTitle = isSuperAdmin
    ? 'Super Administrador'
    : isAdmin
    ? 'Panel de Administración'
    : 'Panel de Barbero';

  const isDevUser = isDeveloper(userRole.email) || userRole.barber_id === 'franciscojavier' || isSuperAdmin;
  const isAdrianAdmin = (userRole.role === 'admin' || isMasterAdminEmail(userRole.email)) && !isDevUser;
  const canSwitchBarberProfiles = isDevUser || isAdrianAdmin;

  // Resolved barber profile for the bottom profile button
  const currentProfileBarber = useMemo(() => {
    if (isDevUser) {
      if (selectedBarber && selectedBarber !== 'all' && selectedBarber !== 'franciscojavier') {
        const found = barbers.find((b) => b.id === selectedBarber);
        if (found) return found;
      }
      return getDeveloperProfile();
    }
    if (isAdrianAdmin) {
      if (selectedBarber && selectedBarber !== 'all') {
        const found = barbers.find((b) => b.id === selectedBarber);
        if (found) return found;
      }
      const adrian = barbers.find((b) => b.id === 'adrian');
      if (adrian) return adrian;
    }
    // Regular barber: only their own linked profile
    if (userRole.barber_id) {
      const found = barbers.find((b) => b.id === userRole.barber_id);
      if (found) return found;
    }
    return barbers[0] || null;
  }, [isDevUser, isAdrianAdmin, selectedBarber, userRole.barber_id, barbers]);

  const profileDisplayName = isDevUser
    ? selectedBarber && selectedBarber !== 'all' && selectedBarber !== 'franciscojavier'
      ? activeBarber?.name || 'Barbero'
      : getDeveloperProfile().name
    : isAdrianAdmin
    ? selectedBarber && selectedBarber !== 'all'
      ? activeBarber?.name || 'Barbero'
      : 'Adrián Millán'
    : currentProfileBarber?.name || userRole.full_name || 'Mi Perfil';

  const profileRoleSubtitle = isDevUser
    ? 'Desarrollador'
    : isAdrianAdmin ? 'Administrador' : currentProfileBarber?.role || 'Barbero';

  const profileFilterSubtitle = canSwitchBarberProfiles
    ? isDevUser
      ? selectedBarber === 'all'
        ? 'Desarrollador · Todo el salón'
        : `Vista: ${activeBarber?.name || selectedBarber}`
      : selectedBarber === 'all'
      ? 'Administrador · Todo el salón'
      : `Vista: ${activeBarber?.name || selectedBarber}`
    : 'Barbero Profesional';

  const effectiveProfileTargetId = useMemo(() => {
    if (canSwitchBarberProfiles) {
      if (selectedBarber && selectedBarber !== 'all') {
        return selectedBarber;
      }
      return isDevUser ? 'franciscojavier' : 'adrian';
    }
    return userRole.barber_id || 'adrian';
  }, [canSwitchBarberProfiles, selectedBarber, isDevUser, userRole.barber_id]);

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
        <div data-lenis-prevent className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-2 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
          {/* Top Quick Links: Inbox & Notifications */}
          <div className="space-y-0.5">
            {/* Inbox (Citas de Hoy) */}
            <button
              onClick={() => handleNav('today')}
              title={isCollapsed ? `Citas de hoy (${todayCount})` : undefined}
              className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all ${
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
                  <span className="flex-1 text-left">Citas de hoy</span>
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
              className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all ${
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
                  <span className="flex-1 text-left">Notificaciones</span>
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
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all ${
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
        </div>

        {/* =========================================================================
            BOTTOM ACTIONS & UTILITIES (Directamente encima del perfil)
            ========================================================================= */}
        <div className="shrink-0 p-1.5 border-t border-white/5 bg-zinc-950/40">
          <div className="space-y-0.5">
            {/* Dark mode / Light mode toggle */}
            <button
              onClick={toggleTheme}
              title={isCollapsed ? (isLightMode ? 'Modo Oscuro' : 'Modo Claro') : undefined}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-[0.72rem] text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-colors ${
                isCollapsed ? 'justify-center px-0' : ''
              }`}
            >
              {isLightMode ? (
                <Moon className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <Sun className="h-3.5 w-3.5 shrink-0" />
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
              className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-[0.72rem] text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-colors ${
                isCollapsed ? 'justify-center px-0' : ''
              }`}
            >
              <RotateCw className={`h-3.5 w-3.5 shrink-0 ${refreshing ? 'animate-spin text-gold' : ''}`} />
              {!isCollapsed && <span className="flex-1 text-left">Actualizar</span>}
            </button>

            {/* Go to public website */}
            <button
              onClick={onGoPublic}
              title={isCollapsed ? 'Volver a la web' : undefined}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-[0.72rem] text-zinc-400 hover:bg-white/5 hover:text-gold transition-colors ${
                isCollapsed ? 'justify-center px-0' : ''
              }`}
            >
              <Globe className="h-3.5 w-3.5 shrink-0" />
              {!isCollapsed && <span className="flex-1 text-left">Ver web pública</span>}
            </button>
          </div>
        </div>

        {/* =========================================================================
            BOTTOM FOOTER PROFILE ITEM (Con Selector de Barbero Integrado)
            ========================================================================= */}
        <div className="relative border-t border-white/10 p-2.5 sm:p-3 bg-zinc-950/85 shrink-0">
          <button
            onClick={() => setShowProfileMenu((prev) => !prev)}
            title={isCollapsed ? `${profileDisplayName} (${profileFilterSubtitle})` : undefined}
            className={`group flex w-full items-center gap-3.5 rounded-2xl p-2.5 transition-all duration-200 ${
              showProfileMenu
                ? 'bg-white/10 ring-1 ring-gold/40 text-white'
                : tab === 'profile'
                ? 'bg-gold/15 text-gold border border-gold/30'
                : 'hover:bg-white/5 text-zinc-200'
            } ${isCollapsed ? 'justify-center p-1.5' : ''}`}
          >
            {/* User Avatar - Larger size h-12 w-12 */}
            <div className="relative shrink-0">
              {currentProfileBarber?.photo_url ? (
                <img
                  src={currentProfileBarber.photo_url}
                  alt={profileDisplayName}
                  className={`${
                    isCollapsed ? 'h-11 w-11' : 'h-12 w-12 sm:h-13 sm:w-13'
                  } rounded-full object-cover ring-2 ring-gold/40 shadow-lg shadow-black/40`}
                />
              ) : (
                <div
                  className={`flex ${
                    isCollapsed ? 'h-11 w-11' : 'h-12 w-12 sm:h-13 sm:w-13'
                  } items-center justify-center rounded-full gold-gradient font-display text-sm font-black text-black shadow-lg shadow-black/40`}
                >
                  {currentProfileBarber?.initials || 'AM'}
                </div>
              )}
              {selectedBarber !== 'all' && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold ring-2 ring-zinc-950 shadow-sm">
                  <Scissors className="h-2.5 w-2.5 text-black" />
                </span>
              )}
            </div>

            {/* Name + Role / Active Filter Subtitle */}
            {!isCollapsed && (
              <>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[15px] font-bold text-white truncate leading-tight group-hover:text-gold transition-colors tracking-tight">
                    {profileDisplayName}
                  </p>
                  <p className="text-xs text-zinc-400 font-medium truncate leading-tight mt-1">
                    {profileFilterSubtitle}
                  </p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-zinc-400 group-hover:text-gold group-hover:bg-gold/10 transition-colors shrink-0">
                  <ChevronsUpDown className="h-4.5 w-4.5" />
                </div>
              </>
            )}
          </button>

          {/* Profile & Barber Selector Popover */}
          {showProfileMenu && (
            <>
              {/* Click-outside backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowProfileMenu(false)}
              />

              <div
                className={`absolute bottom-full mb-2 z-50 rounded-2xl border border-white/10 bg-zinc-900/98 p-2 shadow-2xl backdrop-blur-2xl animate-scale-in ${
                  isCollapsed ? 'left-16 w-64' : 'left-2.5 right-2.5'
                }`}
              >
                {/* Section: Barber Selector (Only for Adrián as admin or Francisco as dev) */}
                {canSwitchBarberProfiles && (
                  <div className="mb-2">
                    <p className="px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-zinc-400">
                      Filtrar por Barbero
                    </p>
                    <div className="space-y-0.5">
                      <button
                        onClick={() => handleSelectBarber('all')}
                        className={`w-full rounded-xl px-2.5 py-2 text-xs font-semibold flex items-center justify-between transition-colors ${
                          selectedBarber === 'all'
                            ? 'bg-gold/15 text-gold border border-gold/30'
                            : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Users className="h-4 w-4 text-zinc-400 shrink-0" />
                          <span>Todos los barberos</span>
                        </div>
                        {selectedBarber === 'all' && <Check className="h-3.5 w-3.5 text-gold shrink-0" />}
                      </button>

                      {isDevUser && (
                        <button
                          onClick={() => handleSelectBarber('franciscojavier')}
                          className={`w-full rounded-xl px-2.5 py-2 text-xs font-semibold flex items-center justify-between transition-colors ${
                            selectedBarber === 'franciscojavier'
                              ? 'bg-gold/15 text-gold border border-gold/30'
                              : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {getDeveloperProfile().photo_url ? (
                              <img
                                src={getDeveloperProfile().photo_url!}
                                alt=""
                                className="h-5 w-5 rounded-full object-cover ring-1 ring-gold/30 shrink-0"
                              />
                            ) : (
                              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full gold-gradient text-[0.55rem] font-bold text-black">
                                FJ
                              </div>
                            )}
                            <span className="truncate">Francisco Javier (Desarrollador)</span>
                          </div>
                          {selectedBarber === 'franciscojavier' && (
                            <Check className="h-3.5 w-3.5 text-gold shrink-0" />
                          )}
                        </button>
                      )}

                      {barbers.map((b) => {
                        const isSelected = selectedBarber === b.id;
                        return (
                          <button
                            key={b.id}
                            onClick={() => handleSelectBarber(b.id)}
                            className={`w-full rounded-xl px-2.5 py-2 text-xs font-semibold flex items-center justify-between transition-colors ${
                              isSelected
                                ? 'bg-gold/15 text-gold border border-gold/30'
                                : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {b.photo_url ? (
                                <img
                                  src={b.photo_url}
                                  alt=""
                                  className="h-5 w-5 rounded-full object-cover ring-1 ring-gold/30 shrink-0"
                                />
                              ) : (
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full gold-gradient text-[0.55rem] font-bold text-black">
                                  {b.initials}
                                </div>
                              )}
                              <span className="truncate">{b.name}</span>
                            </div>
                            {isSelected && <Check className="h-3.5 w-3.5 text-gold shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {canSwitchBarberProfiles && <div className="my-1.5 border-t border-white/5" />}

                {/* Section: Profile & Sign Out */}
                <div className="space-y-0.5">
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      handleNav('profile');
                    }}
                    className={`w-full rounded-xl px-2.5 py-2 text-xs font-semibold flex items-center gap-2.5 transition-colors ${
                      tab === 'profile'
                        ? 'bg-gold/15 text-gold border border-gold/30'
                        : 'text-zinc-300 hover:bg-white/5 hover:text-gold'
                    }`}
                  >
                    <UserCircle2 className="h-4 w-4 shrink-0 text-gold" />
                    <span>Mi Perfil de Barbero</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      onSignOut();
                    }}
                    className="w-full rounded-xl px-2.5 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 flex items-center gap-2.5 transition-colors"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              </div>
            </>
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
          <div className="absolute left-0 top-0 h-[100dvh] w-72 max-w-[85vw] border-r border-white/10 bg-zinc-950/98 backdrop-blur-2xl transition-transform duration-300 ease-out animate-slide-in-left flex flex-col overflow-hidden shadow-2xl">
            <div className="flex h-14 shrink-0 items-center justify-between px-4 border-b border-white/5">
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
            <div className="shrink-0 px-3 pt-3 pb-1">
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
            <div data-lenis-prevent className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-4 no-scrollbar">
              <div className="space-y-1">
                <button
                  onClick={() => handleNav('today')}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold ${
                    tab === 'today' ? 'bg-gold/15 text-gold' : 'text-zinc-400 hover:bg-white/5'
                  }`}
                >
                  <Inbox className="h-4 w-4" />
                  <span className="flex-1 text-left">Citas de hoy</span>
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

              {/* Mobile Secondary Utilities (Doble fila limpia al final del menú scrolleable) */}
              <div className="pt-2 border-t border-white/5 space-y-0.5">
                <button
                  onClick={toggleTheme}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-colors"
                >
                  {isLightMode ? <Moon className="h-4 w-4 shrink-0" /> : <Sun className="h-4 w-4 shrink-0" />}
                  <span className="flex-1 text-left">{isLightMode ? 'Modo oscuro' : 'Modo claro'}</span>
                </button>
                <button
                  onClick={() => {
                    handleManualRefresh();
                    closeSidebar();
                  }}
                  disabled={refreshing}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-colors"
                >
                  <RotateCw className={`h-4 w-4 shrink-0 ${refreshing ? 'animate-spin text-gold' : ''}`} />
                  <span className="flex-1 text-left">Actualizar agenda</span>
                </button>
                <button
                  onClick={() => {
                    onGoPublic();
                    closeSidebar();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-zinc-400 hover:bg-white/5 hover:text-gold transition-colors"
                >
                  <Globe className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">Ver web pública</span>
                </button>
              </div>
            </div>

            {/* Mobile Footer Profile (Fijo abajo, con safe-area padding y selector flotante hacia arriba) */}
            <div className="relative border-t border-white/10 p-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-zinc-950/95 shrink-0">
              <button
                onClick={() => setShowMobileProfileMenu((prev) => !prev)}
                className={`group flex w-full items-center gap-3.5 rounded-2xl p-2.5 transition-all duration-200 ${
                  showMobileProfileMenu
                    ? 'bg-white/10 ring-1 ring-gold/40 text-white'
                    : tab === 'profile'
                    ? 'bg-gold/15 text-gold border border-gold/30'
                    : 'text-zinc-200 hover:bg-white/5'
                }`}
              >
                <div className="relative shrink-0">
                  {currentProfileBarber?.photo_url ? (
                    <img
                      src={currentProfileBarber.photo_url}
                      alt=""
                      className="h-12 w-12 sm:h-13 sm:w-13 rounded-full object-cover ring-2 ring-gold/40 shadow-lg shadow-black/40"
                    />
                  ) : (
                    <div className="flex h-12 w-12 sm:h-13 sm:w-13 items-center justify-center rounded-full gold-gradient font-display text-sm font-black text-black shadow-lg shadow-black/40">
                      {currentProfileBarber?.initials || 'AM'}
                    </div>
                  )}
                  {selectedBarber !== 'all' && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold ring-2 ring-zinc-950 shadow-sm">
                      <Scissors className="h-2.5 w-2.5 text-black" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[15px] font-bold text-white truncate leading-tight group-hover:text-gold transition-colors tracking-tight">
                    {profileDisplayName}
                  </p>
                  <p className="text-xs text-zinc-400 font-medium truncate leading-tight mt-1">
                    {profileFilterSubtitle}
                  </p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-zinc-400 group-hover:text-gold group-hover:bg-gold/10 transition-colors shrink-0">
                  <ChevronsUpDown className="h-4.5 w-4.5" />
                </div>
              </button>

              {/* Mobile Profile & Barber Selector popover (Se abre HACIA ARRIBA con backdrop) */}
              {showMobileProfileMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMobileProfileMenu(false)}
                  />
                  <div className="absolute bottom-full left-2.5 right-2.5 mb-2 z-50 rounded-2xl border border-white/10 bg-zinc-900/98 p-2 shadow-2xl backdrop-blur-2xl animate-scale-in max-h-[60vh] overflow-y-auto">
                    {canSwitchBarberProfiles && (
                      <div className="mb-2">
                        <p className="px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-zinc-400">
                          Filtrar por Barbero
                        </p>
                        <div className="space-y-0.5">
                          <button
                            onClick={() => {
                              handleSelectBarber('all');
                              setShowMobileProfileMenu(false);
                              closeSidebar();
                            }}
                            className={`w-full rounded-xl px-2.5 py-2 text-xs font-semibold flex items-center justify-between transition-colors ${
                              selectedBarber === 'all'
                                ? 'bg-gold/15 text-gold border border-gold/30'
                                : 'text-zinc-300 hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <Users className="h-4 w-4 text-zinc-400 shrink-0" />
                              <span>Todos los barberos</span>
                            </div>
                            {selectedBarber === 'all' && <Check className="h-3.5 w-3.5 text-gold shrink-0" />}
                          </button>

                          {isDevUser && (
                            <button
                              onClick={() => {
                                handleSelectBarber('franciscojavier');
                                setShowMobileProfileMenu(false);
                                closeSidebar();
                              }}
                              className={`w-full rounded-xl px-2.5 py-2 text-xs font-semibold flex items-center justify-between transition-colors ${
                                selectedBarber === 'franciscojavier'
                                  ? 'bg-gold/15 text-gold border border-gold/30'
                                  : 'text-zinc-300 hover:bg-white/5'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {getDeveloperProfile().photo_url ? (
                                  <img
                                    src={getDeveloperProfile().photo_url!}
                                    alt=""
                                    className="h-5 w-5 rounded-full object-cover ring-1 ring-gold/30 shrink-0"
                                  />
                                ) : (
                                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full gold-gradient text-[0.55rem] font-bold text-black">
                                    FJ
                                  </div>
                                )}
                                <span className="truncate">Francisco Javier (Desarrollador)</span>
                              </div>
                              {selectedBarber === 'franciscojavier' && (
                                <Check className="h-3.5 w-3.5 text-gold shrink-0" />
                              )}
                            </button>
                          )}

                          {barbers.map((b) => (
                            <button
                              key={b.id}
                              onClick={() => {
                                handleSelectBarber(b.id);
                                setShowMobileProfileMenu(false);
                                closeSidebar();
                              }}
                              className={`w-full rounded-xl px-2.5 py-2 text-xs font-semibold flex items-center justify-between transition-colors ${
                                selectedBarber === b.id
                                  ? 'bg-gold/15 text-gold border border-gold/30'
                                  : 'text-zinc-300 hover:bg-white/5'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {b.photo_url ? (
                                  <img src={b.photo_url} alt="" className="h-5 w-5 rounded-full object-cover ring-1 ring-gold/30 shrink-0" />
                                ) : (
                                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full gold-gradient text-[0.55rem] font-bold text-black">
                                    {b.initials}
                                  </div>
                                )}
                                <span className="truncate">{b.name}</span>
                              </div>
                              {selectedBarber === b.id && <Check className="h-3.5 w-3.5 text-gold shrink-0" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {canSwitchBarberProfiles && <div className="my-1.5 border-t border-white/5" />}
                    <button
                      onClick={() => {
                        setShowMobileProfileMenu(false);
                        closeSidebar();
                        handleNav('profile');
                      }}
                      className={`w-full rounded-xl px-2.5 py-2 text-left text-xs font-semibold flex items-center gap-2.5 transition-colors ${
                        tab === 'profile'
                          ? 'bg-gold/15 text-gold border border-gold/30'
                          : 'text-zinc-200 hover:bg-white/5 hover:text-gold'
                      }`}
                    >
                      <UserCircle2 className="h-4 w-4 text-gold shrink-0" />
                      <span>Mi Perfil de Barbero</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowMobileProfileMenu(false);
                        closeSidebar();
                        onSignOut();
                      }}
                      className="w-full rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-red-400 hover:bg-red-500/10 flex items-center gap-2.5 mt-1 transition-colors"
                    >
                      <LogOut className="h-4 w-4 shrink-0" />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                </>
              )}
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
            <div className="flex items-center gap-1.5">
              <p className="text-[0.6rem] uppercase tracking-[0.2em] text-gold">{panelTitle}</p>
              {selectedBarber !== 'all' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 text-gold border border-gold/30 px-1.5 py-0.2 text-[0.6rem] font-bold">
                  {barbers.find((b) => b.id === selectedBarber)?.name || 'Barbero'}
                </span>
              )}
            </div>
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
        <header className="sticky top-0 z-20 hidden items-center justify-between border-b border-white/5 bg-zinc-950/60 px-6 py-2.5 backdrop-blur-xl md:flex md:shrink-0 gap-4">
          <div className="flex items-center gap-4 lg:gap-6 min-w-0">
            <div className="shrink-0">
              <p className="text-[0.6rem] uppercase tracking-[0.2em] text-gold">{panelTitle}</p>
              <h1 className="font-display text-xl lg:text-2xl font-bold text-white whitespace-nowrap">
                {tab === 'today'
                  ? 'Citas de Hoy'
                  : tab === 'notifications'
                  ? 'Centro de Notificaciones'
                  : tab === 'profile'
                  ? 'Mi Perfil de Barbero'
                  : menuItems.find((n) => n.id === tab)?.label}
              </h1>
            </div>

            {/* In "Citas de hoy": Barber Filter Bar placed immediately to the right of "Citas de hoy" title */}
            {tab === 'today' && barbers.length > 0 && (
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-900/90 border border-white/5 shadow-inner overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => handleSelectBarber('all')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold transition-all shrink-0 ${
                    selectedBarber === 'all'
                      ? 'bg-gold/20 text-gold border border-gold/40 shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Todo el salón</span>
                  <span className="rounded-full bg-black/40 px-1.5 py-0.2 text-[0.65rem] font-bold">
                    {totalSalonTodayCount}
                  </span>
                </button>

                {barbers.map((b) => {
                  const todayISO = toISO(new Date());
                  const count = bookings.filter(
                    (x) => x.booking_date === todayISO && x.status !== 'cancelled' && x.barber === b.id
                  ).length;
                  const isSelected = selectedBarber === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleSelectBarber(b.id)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold transition-all shrink-0 ${
                        isSelected
                          ? 'bg-gold/20 text-gold border border-gold/40 shadow-sm'
                          : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      {b.photo_url ? (
                        <img src={b.photo_url} alt="" className="h-3.5 w-3.5 rounded-full object-cover shrink-0" />
                      ) : (
                        <Scissors className="h-3 w-3 shrink-0" />
                      )}
                      <span>{b.name}</span>
                      <span className="rounded-full bg-black/40 px-1.5 py-0.2 text-[0.65rem] font-bold">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Active barber indicator badge - hide when tab === 'today' because the filter bar is already on top! */}
            {tab !== 'today' && (
              activeBarber ? (
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
              )
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
        <div className="w-full min-w-0 px-2 sm:px-4 md:px-5 md:py-3 md:flex-1 md:min-h-0 flex flex-col md:overflow-hidden pb-3 md:pb-4">
          <div className="admin-embed w-full min-w-0 flex-1 min-h-0 flex flex-col rounded-2xl p-3 sm:rounded-3xl sm:p-4 md:p-5 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 shadow-2xl relative">
            {tab === 'today' && (
              <AdminToday
                bookings={bookings}
                loading={loading}
                onRefresh={refresh}
                currentBarber={currentProfileBarber}
                selectedBarber={selectedBarber}
                onSelectBarber={handleSelectBarber}
                userRole={userRole}
              />
            )}

            {tab === 'notifications' && (
              <AdminNotifications
                barbers={barbers}
                selectedBarber={selectedBarber}
                onSelectBarber={handleSelectBarber}
                onRefreshBookings={refresh}
                onNavigateToAgenda={(date) => {
                  handleNav('agenda');
                }}
              />
            )}

            {tab === 'agenda' && (
              <AdminAgenda bookings={bookings} loading={loading} onRefresh={refresh} />
            )}

            {tab === 'manual' && business.features.allow_manual_booking && (
              <AdminManualBooking onCreated={refresh} />
            )}

            {tab === 'profile' && (
              <AdminProfile
                userRole={userRole}
                targetBarberId={effectiveProfileTargetId}
                onBarberUpdated={reloadBarbers}
              />
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
