import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useBooking } from '@/hooks/useBooking';
import { useAuth } from '@/hooks/useAuth';
import { landingFor } from '@/themes/layouts/registry';
import { useBusiness } from '@/context/BusinessContext';
import { isLegacyBusiness } from '@/lib/business';
import { pageTitle, type PageKey } from '@/lib/documentHead';
import { BarberStep } from '@/components/BarberStep';
import { ServiceStep } from '@/components/ServiceStep';
import { DateTimeStep } from '@/components/DateTimeStep';
import { DetailsStep } from '@/components/DetailsStep';
import { SuccessStep } from '@/components/SuccessStep';
import { FloatingButtons } from '@/components/FloatingButtons';
import { AppBackdrop } from '@/components/AppBackdrop';
import { LoginModal } from '@/components/LoginModal';
import { TermsModal } from '@/components/TermsModal';
import type { SavedBooking } from '@/types';
import { getPendingBooking, clearPendingBooking, savePendingBooking } from '@/lib/pendingBooking';
import { createBooking } from '@/lib/bookings';
import { setActivePwaContext } from '@/lib/pwaContext';
import { supabase } from '@/lib/supabase';
import { ScreenLoader } from '@/components/ui/LoadingSpinner';
import { hasAcceptedTerms, acceptUserTerms } from '@/lib/terms';
import { initOneSignal, syncOneSignalUser } from '@/lib/onesignal';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { AdminErrorBoundary } from '@/components/AdminErrorBoundary';
import { ThemeDemoBar } from '@/components/ThemeDemoBar';

const AdminPanel = lazyWithRetry(() => import('@/components/AdminPanel').then(m => ({ default: m.AdminPanel })), 'AdminPanel');
const Catalog = lazyWithRetry(() => import('@/components/Catalog').then(m => ({ default: m.Catalog })), 'Catalog');
const Gallery = lazyWithRetry(() => import('@/components/Gallery').then(m => ({ default: m.Gallery })), 'Gallery');
const MyBookings = lazyWithRetry(() => import('@/components/MyBookings').then(m => ({ default: m.MyBookings })), 'MyBookings');

type View = 'public' | 'admin' | 'my-bookings' | 'catalog' | 'gallery';

function App() {
  const business = useBusiness();
  const isLegacy = isLegacyBusiness(business);
  const LandingLayout = landingFor(business);
  const { has_store: hasStore, has_gallery: hasGallery } = business.features;
  const booking = useBooking();
  const auth = useAuth();
  const [view, setView] = useState<View>('public');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginPurpose, setLoginPurpose] = useState<'booking' | 'general'>('general');
  const [signingIn, setSigningIn] = useState(false);
  const [resumingBooking, setResumingBooking] = useState(false);
  const resumedRef = useRef(false);
  const roleCheckedRef = useRef(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [savingTerms, setSavingTerms] = useState(false);

  // Initialize OneSignal on mount
  // El app id de OneSignal pertenece al tenant heredado; otros negocios no reutilizan su canal push.
  useEffect(() => {
    if (isLegacy) initOneSignal();
  }, [isLegacy]);

  // Sync OneSignal user identity and tags (role, barber_id, marketing_accepted)
  useEffect(() => {
    if (isLegacy && !auth.loading) {
      syncOneSignalUser(auth.user, auth.role);
    }
  }, [isLegacy, auth.user, auth.role, auth.loading]);

  // Detect hash, path, and subdomain changes for direct linking (#admin, #mis-citas, citas.adrianmillan.es)
  useEffect(() => {
    const handleNavigation = () => {
      const h = window.location.hash.toLowerCase();
      const path = window.location.pathname.toLowerCase();
      const host = window.location.hostname.toLowerCase();

      // 1. Direct subdomain support: citas.adrianmillan.es, admin.adrianmillan.es, reserva.adrianmillan.es
      if (host.startsWith('citas.')) {
        setView('my-bookings');
        return;
      }
      if (host.startsWith('admin.')) {
        setView('admin');
        if (!auth.loading && !auth.user) {
          setLoginPurpose('general');
          setShowLoginModal(true);
        }
        return;
      }
      if (host.startsWith('reserva.') || host.startsWith('reservar.') || host.startsWith('reservas.')) {
        setView('public');
        booking.startBooking();
        return;
      }

      // 2. Direct booking link: /reserva, /reservar, /reservas, #reserva, #reservar, #reservas, #/reserva
      if (
        path === '/reserva' ||
        path === '/reservar' ||
        path === '/reservas' ||
        path === '/booking' ||
        h === '#reserva' ||
        h === '#reservar' ||
        h === '#reservas' ||
        h === '#booking' ||
        h === '#/reserva' ||
        h === '#/reservar' ||
        h === '#/reservas'
      ) {
        setView('public');
        booking.startBooking();
        return;
      }

      // 3. Direct paths or hash linking
      if (h === '#admin' || path === '/admin' || h === '#/admin') {
        setView('admin');
        if (!auth.loading && !auth.user) {
          setLoginPurpose('general');
          setShowLoginModal(true);
        }
      } else if (h === '#galeria' || h === '#gallery' || h === '#cortes' || path === '/galeria') {
        setView('gallery');
      } else if (h === '#catalogo' || h === '#tienda' || h === '#productos' || path === '/catalogo' || path === '/tienda') {
        setView('catalog');
      } else if (h === '#mis-citas' || h === '#citas' || path === '/citas' || path === '/mis-citas' || h === '#/mis-citas') {
        setView('my-bookings');
      } else if (h === '#inicio' || h === '' || h === '#') {
        setView('public');
        if (path !== '/reserva' && path !== '/reservas' && path !== '/reservar') {
          booking.reset();
        }
      }
    };

    handleNavigation();
    window.addEventListener('hashchange', handleNavigation);
    window.addEventListener('popstate', handleNavigation);
    return () => {
      window.removeEventListener('hashchange', handleNavigation);
      window.removeEventListener('popstate', handleNavigation);
    };
  }, [auth.loading, auth.user, booking.startBooking, booking.reset]);

  // If loading finishes and user is on #admin but not logged in, prompt login
  useEffect(() => {
    if (auth.loading) return;
    const isSpecialAdminRoute = window.location.hash.toLowerCase() === '#admin' || window.location.pathname.toLowerCase() === '/admin';
    if (isSpecialAdminRoute && !auth.user) {
      setLoginPurpose('general');
      setShowLoginModal(true);
    }
  }, [auth.loading, auth.user]);

  // Dynamic document.title for SEO and UX
  useEffect(() => {
    let page: PageKey = 'home';
    if (view === 'admin' || view === 'catalog' || view === 'gallery' || view === 'my-bookings') {
      page = view;
    } else if (booking.step !== 'landing') {
      page = booking.step;
    }
    document.title = pageTitle(business, page);
  }, [business, view, booking.step]);

  useEffect(() => {
    if (auth.loading || roleCheckedRef.current) return;
    roleCheckedRef.current = true;

    // Do NOT navigate to admin if the user was in the middle of a booking
    const hasPending = Boolean(getPendingBooking());
    if (auth.user && auth.role?.status === 'verified' && auth.role?.role && !hasPending) {
      if (window.location.hash === '#admin') {
        setView('admin');
      }
    }
  }, [auth.loading, auth.role, auth.user]);

  // Check if logged in user has accepted legal terms
  useEffect(() => {
    if (auth.loading) return;
    if (auth.user && !hasAcceptedTerms(auth.user)) {
      setShowTermsModal(true);
    } else {
      setShowTermsModal(false);
    }
  }, [auth.loading, auth.user]);

  const executePendingBooking = useCallback(
    async (pendingPayload: any) => {
      resumedRef.current = true;
      setResumingBooking(true);
      setShowLoginModal(false);

      try {
        // Ensure Supabase session token is fully attached
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          await new Promise((r) => setTimeout(r, 300));
        }

        const { booking: saved, error } = await createBooking(pendingPayload);
        if (error) throw new Error(error);
        if (saved) {
          clearPendingBooking();
          setView('public');
          booking.applyExternalConfirmation(saved as SavedBooking);
        } else {
          throw new Error('No se recibió la confirmación de la cita');
        }
      } catch (err) {
        console.error('Error al reanudar reserva tras login:', err);
        // If automatic creation hit an issue, restore the user's booking step and details
        await booking.restorePending(pendingPayload);
        setView('public');
      } finally {
        setResumingBooking(false);
      }
    },
    [booking]
  );

  // Restore pending booking after login redirect only if terms are accepted
  useEffect(() => {
    if (auth.loading || resumedRef.current) return;
    const pending = getPendingBooking();
    if (!pending || !auth.user) return;

    if (!hasAcceptedTerms(auth.user)) {
      setShowTermsModal(true);
      return;
    }

    executePendingBooking(pending);
  }, [auth.loading, auth.user, executePendingBooking]);

  const handleAcceptTerms = useCallback(
    async (options: { marketingAccepted: boolean }) => {
      if (!auth.user) return;
      setSavingTerms(true);
      try {
        await acceptUserTerms(auth.user, options);
        setShowTermsModal(false);

        // If there was a pending booking, execute it now!
        const pending = getPendingBooking();
        if (pending && !resumedRef.current) {
          await executePendingBooking(pending);
        }
      } finally {
        setSavingTerms(false);
      }
    },
    [auth.user, executePendingBooking]
  );

  const handleTermsSignOut = useCallback(async () => {
    clearPendingBooking();
    setShowTermsModal(false);
    await auth.signOut();
    setView('public');
  }, [auth]);

  const goPublic = useCallback(() => {
    if (window.location.hash && window.location.hash !== '#') {
      history.pushState(null, '', window.location.pathname);
    }
    setView('public');
  }, []);

  const goBooking = useCallback(() => {
    if (typeof window !== 'undefined' && window.location.hostname.startsWith('citas.')) {
      window.location.href = 'https://www.adrianmillan.es/#reservas';
      return;
    }
    window.location.hash = '#reservas';
    setView('public');
    booking.startBooking();
  }, [booking]);

  const handleServiceBack = useCallback(() => {
    // Limpiar el hash #reservas o ruta /reservas al volver a la landing
    if (window.location.hash && (window.location.hash.toLowerCase().includes('reserva') || window.location.hash === '#reservas')) {
      history.pushState(null, '', window.location.pathname.replace(/\/reservas?/, '') || '/');
    } else if (window.location.pathname.toLowerCase().includes('/reserva')) {
      history.pushState(null, '', '/');
    }
    booking.goBack();
  }, [booking]);

  const goAdmin = useCallback(() => {
    window.location.hash = '#admin';
    setView('admin');
  }, []);

  const goMyBookings = useCallback(() => {
    window.location.hash = '#mis-citas';
    setView('my-bookings');
  }, []);

  const goCatalog = useCallback(() => {
    window.location.hash = '#catalogo';
    setView('catalog');
  }, []);

  const goGallery = useCallback(() => {
    window.location.hash = '#galeria';
    setView('gallery');
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    setSigningIn(true);
    await auth.signInWithGoogle();
  }, [auth]);

  const handleGeneralLogin = useCallback(() => {
    setLoginPurpose('general');
    setShowLoginModal(true);
  }, []);


  const handleDetailsSubmit = useCallback(
    async (form: { fullName: string; phone: string; comments: string }) => {
      if (auth.user) {
        await booking.submitBooking(form);
        return;
      }
      const payload = booking.buildPayload(form);
      if (!payload) return;
      savePendingBooking(payload);
      setLoginPurpose('booking');
      setShowLoginModal(true);
    },
    [auth.user, booking]
  );

  const isVerifiedStaff = auth.role?.role && auth.role?.status === 'verified';

  // Solo en desarrollo (Vite elimina la rama en producción): ?devAdmin previsualiza la maquetación
  // del panel sin sesión, para revisar la marca blanca de cada variante. RLS no devuelve datos.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('devAdmin')) {
    return (
      <Suspense fallback={<ScreenLoader message="Cargando panel de gestión..." />}>
        <AdminPanel
          userRole={{ role: 'admin', status: 'verified', barber_id: null, email: 'preview@localhost' }}
          onSignOut={async () => {}}
          onGoPublic={goPublic}
        />
      </Suspense>
    );
  }

  // Admin panel is full-screen, no width constraint
  if (view === 'admin' && isVerifiedStaff) {
    return (
      <AdminErrorBoundary onGoPublic={goPublic}>
        <Suspense fallback={<ScreenLoader message="Cargando panel de gestión..." />}>
          <AdminPanel
            userRole={auth.role!}
            onSignOut={async () => { await auth.signOut(); setView('public'); }}
            onGoPublic={goPublic}
          />
        </Suspense>
      </AdminErrorBoundary>
    );
  }

  // Catalog view — same fluid layout as public
  // Tienda y galería solo existen si el plan del negocio las incluye.
  if (view === 'catalog' && hasStore) {
    return (
      <div className="relative min-h-screen bg-ink text-zinc-200">
        <AppBackdrop />
        <div className="relative z-10 mx-auto w-full max-w-5xl">
          <Suspense fallback={<ScreenLoader message="Cargando catálogo..." />}>
            <Catalog onBack={goPublic} userRole={auth.role} />
          </Suspense>
        </div>
      </div>
    );
  }

  // My bookings portal — fluid width
  if (view === 'my-bookings') {
    return (
      <div className="relative min-h-screen bg-ink text-zinc-200">
        <AppBackdrop />
        <div className="relative z-10">
          <Suspense fallback={<ScreenLoader message="Cargando tus citas..." />}>
            <MyBookings
              onBack={goPublic}
              onBook={goBooking}
              userEmail={auth.user?.email}
              userId={auth.user?.id}
              onSignOut={async () => {
                await auth.signOut();
                goPublic();
              }}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  // Haircuts Gallery view
  if (view === 'gallery' && hasGallery) {
    return (
      <div className="relative min-h-screen bg-ink text-zinc-200">
        <AppBackdrop />
        <div className="relative z-10">
          <Suspense fallback={<ScreenLoader message="Cargando galería..." />}>
            <Gallery
              onBack={goPublic}
              onBook={() => {
                goPublic();
                booking.startBooking();
              }}
              userRole={auth.role}
              userEmail={auth.user?.email}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-ink text-zinc-200">
      <AppBackdrop />

      <div className="relative z-10 mx-auto w-full max-w-7xl">
        {booking.step === 'landing' && (
          <Suspense fallback={<ScreenLoader message="Cargando…" />}>
            <LandingLayout
              onBook={goBooking}
              onSignIn={handleGeneralLogin}
              onGoToPanel={goAdmin}
              user={auth.user}
              role={auth.role}
              onSignOut={auth.signOut}
              onGoToMyBookings={auth.user ? goMyBookings : undefined}
              onGoToCatalog={hasStore ? goCatalog : undefined}
              onGoToGallery={hasGallery ? goGallery : undefined}
              onSelectService={(service) => {
                // pushState no dispara hashchange: evita que el manejador de #reservas reinicie la reserva.
                history.pushState(null, '', '#reservas');
                booking.selectService(service);
              }}
            />
          </Suspense>
        )}

        {booking.step === 'barber' && (
          <BarberStep onBack={booking.goBack} onSelect={booking.selectBarber} />
        )}

        {booking.step === 'service' && (
          <ServiceStep onBack={handleServiceBack} onSelect={booking.selectService} />
        )}

        {booking.step === 'datetime' && booking.barber && (
          <DateTimeStep barber={booking.barber} service={booking.service} onBack={booking.goBack} onContinue={booking.selectDateTime} />
        )}

        {booking.step === 'details' && (
          <DetailsStep
            onBack={booking.goBack}
            onSubmit={handleDetailsSubmit}
            submitting={booking.submitting}
            error={booking.error}
          />
        )}

        {booking.step === 'success' && booking.confirmation && (
          <SuccessStep
            booking={booking.confirmation}
            onHome={() => {
              if (window.location.hash && window.location.hash.toLowerCase().includes('reserva')) {
                history.pushState(null, '', window.location.pathname.replace(/\/reservas?/, '') || '/');
              }
              booking.reset();
            }}
          />
        )}
      </div>

      {booking.step === 'landing' && view === 'public' && isLegacy && business.layoutKey === 'classic' && <FloatingButtons />}

      <ThemeDemoBar />



      {showLoginModal && (
        <LoginModal
          onGoogleSignIn={handleGoogleSignIn}
          onClose={() => setShowLoginModal(false)}
          signingIn={signingIn}
          purpose={loginPurpose}
        />
      )}

      {showTermsModal && (
        <TermsModal
          onAccept={handleAcceptTerms}
          onSignOut={handleTermsSignOut}
          saving={savingTerms}
        />
      )}

      {resumingBooking && (
        <ScreenLoader message="Confirmando tu reserva…" />
      )}
    </div>
  );
}

export default App;
