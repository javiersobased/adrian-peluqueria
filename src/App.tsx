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
import { useState, useEffect, useCallback, useRef } from 'react';
import { checkAuth, type AdminRole } from '@/lib/auth';
import { getPendingBooking, clearPendingBooking, savePendingBooking } from '@/lib/pendingBooking';
import { insertBooking } from '@/lib/bookings';
import type { BookingForm } from '@/types';

type View = 'public' | 'admin';

function App() {
  const booking = useBooking();
  const auth = useAuth();
  const [view, setView] = useState<View>('public');
  const [adminRole, setAdminRole] = useState<AdminRole>('admin');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [resumingBooking, setResumingBooking] = useState(false);
  const resumedRef = useRef(false);

  useEffect(() => {
    const localAuth = checkAuth();
    if (localAuth.isBarber && localAuth.role) {
      setAdminRole(localAuth.role);
      setView('admin');
    }
  }, []);

  // After signInWithOAuth, Google redirects the whole page away and back, so
  // this runs on the fresh page load once Supabase has resolved the session.
  // If there was a booking waiting on login, finish it automatically here.
  useEffect(() => {
    if (auth.loading || !auth.user || resumedRef.current) return;
    const pending = getPendingBooking();
    if (!pending) return;

    resumedRef.current = true;
    clearPendingBooking();
    setResumingBooking(true);
    setShowLoginModal(false);

    insertBooking(pending, auth.user.id)
      .then((saved) => {
        booking.applyExternalConfirmation(saved);
      })
      .catch(() => {
        // Nothing lost: the customer is now logged in, so a manual retry
        // from the confirm button will go straight through next time.
      })
      .finally(() => setResumingBooking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading, auth.user]);

  const goPublic = () => {
    setView('public');
  };

  const goAdmin = (role: AdminRole) => {
    setAdminRole(role);
    setView('admin');
  };

  const handleGoogleSignIn = useCallback(async () => {
    setSigningIn(true);
    await auth.signInWithGoogle();
    // Page navigates away to Google here; setSigningIn(false) never runs
    // because this component unmounts on redirect.
  }, [auth]);

  const handleDetailsSubmit = useCallback(
    async (form: BookingForm) => {
      if (auth.user) {
        await booking.submitBooking(form, auth.user.id);
        return;
      }
      // Not logged in: stash the booking and ask for Google sign-in first.
      const payload = booking.buildPayload(form);
      if (!payload) return;
      savePendingBooking(payload);
      setShowLoginModal(true);
    },
    [auth.user, booking]
  );

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

      <div className="relative z-10 mx-auto max-w-app">
        {view === 'admin' && <AdminPanel role={adminRole} onBack={goPublic} />}

        {view === 'public' && booking.step === 'landing' && (
          <Landing onBook={booking.startBooking} onAdmin={goAdmin} user={auth.user} onSignOut={auth.signOut} />
        )}

        {view === 'public' && booking.step === 'barber' && (
          <BarberStep onBack={booking.goBack} onSelect={booking.selectBarber} />
        )}

        {view === 'public' && booking.step === 'service' && (
          <ServiceStep onBack={booking.goBack} onSelect={booking.selectService} />
        )}

        {view === 'public' && booking.step === 'datetime' && booking.barber && (
          <DateTimeStep barber={booking.barber} onBack={booking.goBack} onContinue={booking.selectDateTime} />
        )}

        {view === 'public' && booking.step === 'details' && (
          <DetailsStep
            onBack={booking.goBack}
            onSubmit={handleDetailsSubmit}
            submitting={booking.submitting}
            error={booking.error}
          />
        )}

        {view === 'public' && booking.step === 'success' && booking.confirmation && (
          <SuccessStep booking={booking.confirmation} onHome={booking.reset} />
        )}
      </div>

      {view === 'public' && <FloatingButtons />}

      {showLoginModal && (
        <LoginModal
          onGoogleSignIn={handleGoogleSignIn}
          onClose={() => setShowLoginModal(false)}
          signingIn={signingIn}
        />
      )}

      {resumingBooking && (
        <div className="fixed inset-0 z-[95] flex flex-col items-center justify-center gap-3 bg-black/80 backdrop-blur-md">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          <p className="text-sm text-zinc-300">Confirmando tu reserva…</p>
        </div>
      )}
    </div>
  );
}

export default App;
