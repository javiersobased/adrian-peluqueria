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
import { fetchAllBarbers } from '@/data/services';
import type { SavedBooking, Barber } from '@/types';
import { X, Scissors, Check, User } from 'lucide-react';
import { getPendingBooking, clearPendingBooking, savePendingBooking } from '@/lib/pendingBooking';
import { createBooking, fetchBookingById } from '@/lib/bookings';
import { hasAdmin, claimAdmin, registerBarber } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

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
  const [showBarberRequest, setShowBarberRequest] = useState(false);
  const [barberList, setBarberList] = useState<Barber[]>([]);
  const [barberRequestName, setBarberRequestName] = useState('');
  const [barberRequestSelected, setBarberRequestSelected] = useState('');
  const [barberRequestSubmitting, setBarberRequestSubmitting] = useState(false);
  const [barberRequestError, setBarberRequestError] = useState<string | null>(null);
  const [barberRequestSuccess, setBarberRequestSuccess] = useState(false);
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

  const handleBarberRequestOpen = useCallback(async () => {
    setShowBarberRequest(true);
    setBarberRequestError(null);
    setBarberRequestSuccess(false);
    if (barberList.length === 0) {
      const barbers = await fetchAllBarbers();
      setBarberList(barbers);
      if (barbers.length > 0) setBarberRequestSelected(barbers[0].id);
    }
  }, [barberList]);

  const handleBarberRequestSubmit = useCallback(async () => {
    if (!auth.user || !barberRequestName.trim() || !barberRequestSelected) return;
    setBarberRequestSubmitting(true);
    setBarberRequestError(null);
    const { error } = await registerBarber(auth.user.email ?? '', barberRequestName.trim(), barberRequestSelected);
    setBarberRequestSubmitting(false);
    if (error) {
      setBarberRequestError('No se pudo enviar la solicitud. Es posible que ya exista.');
    } else {
      setBarberRequestSuccess(true);
    }
  }, [auth.user, barberRequestName, barberRequestSelected]);

  const isVerifiedStaff = auth.role?.role && auth.role?.status === 'verified';
  const noRoleLogged = auth.user && !auth.role?.role && !needsAdminBootstrap;

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
          <AdminPanel userRole={auth.role!} onSignOut={async () => { await auth.signOut(); setView('public'); }} onGoPublic={goPublic} />
        )}

        {view === 'public' && booking.step === 'landing' && (
          <Landing
            onBook={booking.startBooking}
            onSignIn={handleGeneralLogin}
            onGoToPanel={goAdmin}
            user={auth.user}
            role={auth.role}
            onSignOut={auth.signOut}
            onBarberRequest={noRoleLogged ? handleBarberRequestOpen : undefined}
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

      {showBarberRequest && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center px-6" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowBarberRequest(false)} />
          <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-900/90 p-6 shadow-2xl backdrop-blur-xl animate-scale-in">
            <button onClick={() => setShowBarberRequest(false)} aria-label="Cerrar" className="absolute right-4 top-4 text-zinc-500 transition-colors hover:text-white">
              <X className="h-5 w-5" />
            </button>

            {barberRequestSuccess ? (
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15">
                  <Check className="h-6 w-6 text-emerald-400" />
                </div>
                <h3 className="mb-2 font-display text-lg font-bold text-white">Solicitud enviada</h3>
                <p className="mb-5 text-sm leading-relaxed text-zinc-400">Un administrador debe verificarte antes de que puedas acceder al panel.</p>
                <button onClick={() => setShowBarberRequest(false)} className="flex w-full items-center justify-center rounded-full gold-gradient py-3 text-sm font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-[0.98]">
                  Entendido
                </button>
              </div>
            ) : (
              <>
                <div className="mb-5 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl gold-gradient">
                    <Scissors className="h-6 w-6 text-black" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-white">Solicitar acceso de barbero</h3>
                  <p className="mt-1.5 text-xs text-zinc-500">Rellena tus datos y un administrador te verificará.</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">Nombre completo</label>
                    <div className="flex items-center gap-2 rounded-xl glass-card px-3 py-2.5 focus-within:border-gold/30">
                      <User className="h-4 w-4 text-zinc-500" />
                      <input
                        type="text"
                        value={barberRequestName}
                        onChange={(e) => setBarberRequestName(e.target.value)}
                        placeholder="Tu nombre"
                        className="w-full bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">Perfil de barbero</label>
                    <select
                      value={barberRequestSelected}
                      onChange={(e) => setBarberRequestSelected(e.target.value)}
                      className="w-full rounded-xl glass-card px-3 py-2.5 text-sm text-white focus:border-gold/30 focus:outline-none"
                    >
                      {barberList.map((b) => (
                        <option key={b.id} value={b.id} className="bg-zinc-900">{b.name}</option>
                      ))}
                    </select>
                  </div>

                  {barberRequestError && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">{barberRequestError}</div>
                  )}

                  <button
                    onClick={handleBarberRequestSubmit}
                    disabled={!barberRequestName.trim() || !barberRequestSelected || barberRequestSubmitting}
                    className={`flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold uppercase tracking-wider transition-all ${
                      barberRequestName.trim() && barberRequestSelected && !barberRequestSubmitting
                        ? 'gold-gradient text-black hover:brightness-110 active:scale-[0.98]'
                        : 'bg-white/5 text-zinc-600'
                    }`}
                  >
                    {barberRequestSubmitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : null}
                    Enviar solicitud
                  </button>
                </div>
              </>
            )}
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
