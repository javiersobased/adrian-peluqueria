import { useState } from 'react';
import { StepHeader } from '@/components/ServiceStep';
import { UserIcon, PhoneIcon, MailIcon, CheckIcon } from '@/components/icons';
import type { BookingForm } from '@/types';

const SPANISH_PHONE_REGEX = /^(\+34\s?|0034\s?)?[6789]\d{2}(\s?\d{2}){3}$/;

interface DetailsStepProps {
  onBack: () => void;
  onSubmit: (form: BookingForm) => void;
  submitting: boolean;
  error: string | null;
}

export function DetailsStep({ onBack, onSubmit, submitting, error }: DetailsStepProps) {
  const [form, setForm] = useState<BookingForm>({
    fullName: '',
    phone: '',
    email: '',
    comments: '',
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const errors = {
    fullName: form.fullName.trim().length < 2 ? 'Introduce tu nombre completo' : '',
    phone: !SPANISH_PHONE_REGEX.test(form.phone.trim()) ? 'Introduce un teléfono español válido (612 345 678)' : '',
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ? 'Introduce un correo válido' : '',
  };

  const isValid = !errors.fullName && !errors.phone && !errors.email;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ fullName: true, phone: true, email: true });
    if (isValid) onSubmit(form);
  };

  const showErr = (field: keyof typeof errors) => touched[field] && errors[field];

  return (
    <div className="min-h-screen animate-slide-in">
      <StepHeader title="Tus datos" subtitle="Paso 4 de 4" onBack={onBack} />

      <form onSubmit={handleSubmit} className="px-5 pb-32">
        <p className="mb-6 text-sm text-zinc-400">
          Necesitamos algunos datos para confirmar tu reserva. Nos pondremos en contacto contigo si fuera necesario.
        </p>

        <div className="space-y-4">
          <Field
            label="Nombre completo"
            icon={<UserIcon className="h-4 w-4" />}
            value={form.fullName}
            onChange={(v) => setForm({ ...form, fullName: v })}
            onBlur={() => setTouched({ ...touched, fullName: true })}
            error={showErr('fullName') ? errors.fullName : ''}
            placeholder="Ej. Adrián Millán"
            type="text"
            autoComplete="name"
          />
          <Field
            label="Número de teléfono"
            icon={<PhoneIcon className="h-4 w-4" />}
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
            onBlur={() => setTouched({ ...touched, phone: true })}
            error={showErr('phone') ? errors.phone : ''}
            placeholder="Ej. 612 345 678 o +34 612 345 678"
            type="tel"
            autoComplete="tel"
          />
          <Field
            label="Correo electrónico"
            icon={<MailIcon className="h-4 w-4" />}
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
            onBlur={() => setTouched({ ...touched, email: true })}
            error={showErr('email') ? errors.email : ''}
            placeholder="tucorreo@email.com"
            type="email"
            autoComplete="email"
          />

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Comentarios <span className="text-zinc-600 normal-case">(opcional)</span>
            </label>
            <textarea
              value={form.comments}
              onChange={(e) => setForm({ ...form, comments: e.target.value })}
              rows={3}
              placeholder="¿Alguna preferencia o indicación para tu cita?"
              className="w-full resize-none rounded-2xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 transition-colors focus:border-gold/30 focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="fixed inset-x-0 bottom-0 z-30 glass-panel px-5 pb-6 pt-4">
          <button
            type="submit"
            disabled={submitting || !isValid}
            className={`flex w-full items-center justify-center gap-2 rounded-full py-4 text-sm font-bold uppercase tracking-wider transition-all duration-300 ${
              isValid && !submitting
                ? 'gold-gradient text-black hover:brightness-110 active:scale-[0.98] gold-glow'
                : 'bg-white/5 text-zinc-600'
            }`}
          >
            {submitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                Confirmando...
              </>
            ) : (
              <>
                <CheckIcon className="h-4 w-4" />
                Confirmar reserva
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  icon,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  type,
  autoComplete,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  error?: string;
  placeholder?: string;
  type: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </label>
      <div
        className={`flex items-center gap-3 rounded-2xl glass-card px-4 py-3.5 transition-colors focus-within:border-gold/30 ${
          error ? 'border-red-500/30' : ''
        }`}
      >
        <span className="text-zinc-500">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
