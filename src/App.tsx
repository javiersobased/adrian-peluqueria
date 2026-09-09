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
import { getPendingBooking, clearPendingBooking, savePendingBooking } from '@/lib/pendingBooking';
import { createBooking, fetchBookingById } from '@/lib/bookings';
import { hasAdmin, claimAdmin } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { SavedBooking } from '@/types';

type View = 'public' | 'admin';

function App() {
  const booking = useBooking();
  const auth = useAuth();
  const [view, setView] = useState<View>('public');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginPurpose, setLoginPurpose] = useState<'booking' | 'general'>('general');
  const [signingIn, setSigningIn] = useState(false);
  const [resumingBooking, setResumingBooking] = useState(false);
  const [needsAdminBootstrap, setNeedsAdminBootstrap] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const resumedRef = useRef(false);
  const roleCheckedRef = useRef(false);

  // PWA: if there's a verified staff session on load, go straight to the panel
  useEffect(() => {
    if (auth.loading || roleCheckedRef.current) return;
    roleCheckedRef.current = true;

    if (auth.user && auth.role?.status === 'verified' && auth.role?.role) {
      setView('admin');
    }
  }, [auth.loading, auth.user, auth.role]);

  // Check if admin bootstrap is needed
  useEffect(() => {
    if (auth.loading || !auth.user) return;
    hasAdmin().then((exists) => {
      if (!exists && auth.role?.role !== 'admin') {
        setNeedsAdminBootstrap(true);
      }
    });
  }, [auth.loading, auth.user, auth.role]);

  // After Google redirect: if there was a pending booking, finish it
  useEffect(() => {
    if (auth.loading || !auth.user || resumedRef.current) return;
    const pending = getPendingBooking();
    if (!pending) return;

    resumedRef.current = true;
    clearPendingBooking();
    setResumingBooking(true);
    setShowLoginModal(false);

    (async () => {
      try {
        const { id, error } = await createBooking(pending);
        if (error) throw new Error(error);
        const saved = await fetchBookingById(id);
        booking.applyExternalConfirmation(saved as SavedBooking);
      } catch {
        // Customer is now logged in; a manual retry will work
      } finally {
        setResumingBooking(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading, auth.user]);

  const goPublic = useCallback(() => {
    setView('public');
  }, []);

  const goAdmin = useCallback(() => {
    setView('admin');
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    setSigningIn(true);
    await auth.signInWithGoogle();
  }, [auth]);

  const handleGeneralLogin = useCallback(() => {
    setLoginPurpose('general');
    setShowLoginModal(true);
  }, []);

  const handleAdminBootstrap = useCallback(async () => {
    setBootstrapping(true);
    const { error } = await claimAdmin();
    if (error) {
      alert(error);
    } else {
      setNeedsAdminBootstrap(false);
      await auth.refreshRole();
      setView('admin');
    }
    setBootstrapping(false);
  }, [auth]);

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
        {view === 'admin' && isVerifiedStaff && (
          <AdminPanel userRole={auth.role!} onSignOut={async () => { await auth.signOut(); setView('public'); }} />
        )}

        {view === 'public' && booking.step === 'landing' && (
          <Landing
            onBook={booking.startBooking}
            onSignIn={handleGeneralLogin}
            onGoToPanel={goAdmin}
            user={auth.user}
            role={auth.role}
            onSignOut={auth.signOut}
          />
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

      {/* Admin bootstrap prompt */}
      {needsAdminBootstrap && auth.user && !isVerifiedStaff && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
          <div className="relative w-full max-w-sm rounded-3xl border border-gold/20 bg-zinc-900/90 p-6 shadow-2xl backdrop-blur-xl animate-scale-in text-center">
            <h3 className="mb-2 font-display text-xl font-bold text-white">Configurar administrador</h3>
            <p className="mb-5 text-sm leading-relaxed text-zinc-400">
              No hay ningún administrador configurado todavía. ¿Quieres convertir tu cuenta en el administrador principal?
            </p>
            <button
              onClick={handleAdminBootstrap}
              disabled={bootstrapping}
              className="flex w-full items-center justify-center gap-2 rounded-full gold-gradient py-3.5 text-sm font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            >
              {bootstrapping ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : null}
              Hacerme administrador
            </button>
            <button
              onClick={() => setNeedsAdminBootstrap(false)}
              className="mt-3 w-full rounded-full px-4 py-2 text-xs font-medium text-zinc-500 transition-colors hover:text-white"
            >
              Ahora no
            </button>
          </div>
        </div>
      )}

      {showLoginModal && (
        <LoginModal
          onGoogleSignIn={handleGoogleSignIn}
          onClose={() => setShowLoginModal(false)}
          signingIn={signingIn}
          purpose={loginPurpose}
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
