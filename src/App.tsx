import { useBooking } from '@/hooks/useBooking';
import { Landing } from '@/components/Landing';
import { BarberStep } from '@/components/BarberStep';
import { ServiceStep } from '@/components/ServiceStep';
import { DateTimeStep } from '@/components/DateTimeStep';
import { DetailsStep } from '@/components/DetailsStep';
import { SuccessStep } from '@/components/SuccessStep';
import { FloatingButtons } from '@/components/FloatingButtons';
import { AdminPanel } from '@/components/AdminPanel';
import { useState, useEffect } from 'react';

type View = 'public' | 'admin';

function getRouteFromHash(): View {
  return window.location.hash === '#admin' ? 'admin' : 'public';
}

function App() {
  const booking = useBooking();
  const [view, setView] = useState<View>(getRouteFromHash());

  useEffect(() => {
    const onHashChange = () => setView(getRouteFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const goPublic = () => {
    window.location.hash = '';
    setView('public');
  };

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
        {view === 'admin' && <AdminPanel onBack={goPublic} />}

        {view === 'public' && booking.step === 'landing' && (
          <Landing onBook={booking.startBooking} onAdmin={() => { window.location.hash = 'admin'; setView('admin'); }} />
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
            onSubmit={booking.submitBooking}
            submitting={booking.submitting}
            error={booking.error}
          />
        )}

        {view === 'public' && booking.step === 'success' && booking.confirmation && (
          <SuccessStep booking={booking.confirmation} onHome={booking.reset} />
        )}
      </div>

      {view === 'public' && <FloatingButtons />}
    </div>
  );
}

export default App;
