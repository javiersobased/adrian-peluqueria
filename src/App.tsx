import { useBooking } from '@/hooks/useBooking';
import { useAuth } from '@/hooks/useAuth';
import { Landing } from '@/components/Landing';
import { BarberStep } from '@/components/BarberStep';
import { ServiceStep } from '@/components/ServiceStep';
import { DateTimeStep } from '@/components/DateTimeStep';
import { DetailsStep } from '@/components/DetailsStep';
import { SuccessStep } from '@/components/SuccessStep';
import { FloatingButtons } from '@/components/FloatingButtons';
import { AdminPanel } from '@/components/AdminPanel';
import { LoginModal } from '@/components/LoginModal';
import { MyBookings } from '@/components/MyBookings';
import { Catalog } from '@/components/Catalog';
import { Gallery } from '@/components/Gallery';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { SavedBooking } from '@/types';
import { getPendingBooking, clearPendingBooking, savePendingBooking } from '@/lib/pendingBooking';
import { createBooking } from '@/lib/bookings';
import { setActivePwaContext } from '@/lib/pwaContext';
import { supabase } from '@/lib/supabase';
import { ScreenLoader } from '@/components/ui/LoadingSpinner';

type View = 'public' | 'admin' | 'my-bookings' | 'catalog' | 'gallery';

function App() {
  const booking = useBooking();
  const auth = useAuth();
  const [view, setView] = useState<View>('public');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginPurpose, setLoginPurpose] = useState<'booking' | 'general'>('general');
  const [signingIn, setSigningIn] = useState(false);
  const [resumingBooking, setResumingBooking] = useState(false);
  const resumedRef = useRef(false);
  const roleCheckedRef = useRef(false);

  // Detect hash changes for direct linking (#admin, #galeria, #catalogo, #mis-citas)
  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash.toLowerCase();
      if (h === '#admin') {
        setView('admin');
      } else if (h === '#galeria' || h === '#gallery' || h === '#cortes') {
        setView('gallery');
      } else if (h === '#catalogo' || h === '#tienda' || h === '#productos') {
        setView('catalog');
      } else if (h === '#mis-citas' || h === '#citas') {
        setView('my-bookings');
      } else if (h === '#inicio' || h === '' || h === '#') {
        setView('public');
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Set PWA context based on current view
  useEffect(() => {
    if (view === 'admin') {
      setActivePwaContext('admin');
    } else {
      setActivePwaContext('booking');
    }
  }, [view]);

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

  // Restore pending booking after login redirect
  useEffect(() => {
    if (auth.loading || resumedRef.current) return;
    const pending = getPendingBooking();
    if (!pending || !auth.user) return;

    resumedRef.current = true;
    setResumingBooking(true);
    setShowLoginModal(false);

    (async () => {
      try {
        // Ensure Supabase session token is fully attached
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          await new Promise((r) => setTimeout(r, 300));
        }

        const { booking: saved, error } = await createBooking(pending);
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
        await booking.restorePending(pending);
        setView('public');
      } finally {
        setResumingBooking(false);
      }
    })();
  }, [auth.loading, auth.user, booking]);

  const goPublic = useCallback(() => {
    if (window.location.hash && window.location.hash !== '#') {
      history.pushState(null, '', window.location.pathname);
    }
    setView('public');
  }, []);

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

  // Admin panel is full-screen, no width constraint
  if (view === 'admin' && isVerifiedStaff) {
    return (
      <AdminPanel
        userRole={auth.role!}
        onSignOut={async () => { await auth.signOut(); setView('public'); }}
        onGoPublic={goPublic}
      />
    );
  }

  // Catalog view — same fluid layout as public
  if (view === 'catalog') {
    return (
      <div className="relative min-h-screen bg-ink text-zinc-200">
        <div className="fixed inset-0 -z-20">
          <img
            src="https://images.pexels.com/photos/7195803/pexels-photo-7195803.jpeg?auto=compress&cs=tinysrgb&w=1260&h=1680"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/85" />
          <div className="absolute inset-0 backdrop-blur-xl" />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-5xl">
          <Catalog onBack={goPublic} />
        </div>
      </div>
    );
  }

  // My bookings portal — fluid width
  if (view === 'my-bookings') {
    return (
      <div className="relative min-h-screen bg-ink text-zinc-200">
        <div className="fixed inset-0 -z-20">
          <img
            src="https://images.pexels.com/photos/7195803/pexels-photo-7195803.jpeg?auto=compress&cs=tinysrgb&w=1260&h=1680"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/85" />
          <div className="absolute inset-0 backdrop-blur-xl" />
        </div>
        <div className="relative z-10">
          <MyBookings onBack={goPublic} userEmail={auth.user?.email} />
        </div>
      </div>
    );
  }

  // Haircuts Gallery view
  if (view === 'gallery') {
    return (
      <div className="relative min-h-screen bg-ink text-zinc-200">
        <div className="fixed inset-0 -z-20">
          <img
            src="https://images.pexels.com/photos/7195803/pexels-photo-7195803.jpeg?auto=compress&cs=tinysrgb&w=1260&h=1680"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/85" />
          <div className="absolute inset-0 backdrop-blur-xl" />
        </div>
        <div className="relative z-10">
          <Gallery
            onBack={goPublic}
            onBook={() => {
              goPublic();
              booking.startBooking();
            }}
            userRole={auth.role}
            userEmail={auth.user?.email}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-ink text-zinc-200">
      <div className="fixed inset-0 -z-20">
        <img
          src="https://images.pexels.com/photos/7195803/pexels-photo-7195803.jpeg?auto=compress&cs=tinysrgb&w=1260&h=1680"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/85" />
        <div className="absolute inset-0 backdrop-blur-xl" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl">
        {booking.step === 'landing' && (
          <Landing
            onBook={booking.startBooking}
            onSignIn={handleGeneralLogin}
            onGoToPanel={goAdmin}
            user={auth.user}
            role={auth.role}
            onSignOut={auth.signOut}
            onGoToMyBookings={auth.user ? goMyBookings : undefined}
            onGoToCatalog={goCatalog}
            onGoToGallery={goGallery}
          />
        )}

        {booking.step === 'barber' && (
          <BarberStep onBack={booking.goBack} onSelect={booking.selectBarber} />
        )}

        {booking.step === 'service' && (
          <ServiceStep onBack={booking.goBack} onSelect={booking.selectService} />
        )}

        {booking.step === 'datetime' && booking.barber && (
          <DateTimeStep barber={booking.barber} onBack={booking.goBack} onContinue={booking.selectDateTime} />
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
          <SuccessStep booking={booking.confirmation} onHome={booking.reset} />
        )}
      </div>

      {booking.step === 'landing' && view === 'public' && <FloatingButtons />}



      {showLoginModal && (
        <LoginModal
          onGoogleSignIn={handleGoogleSignIn}
          onClose={() => setShowLoginModal(false)}
          signingIn={signingIn}
          purpose={loginPurpose}
        />
      )}

      {resumingBooking && (
        <ScreenLoader message="Confirmando tu reserva…" />
      )}
    </div>
  );
}

export default App;
