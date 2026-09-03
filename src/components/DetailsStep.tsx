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
        <p className="mb-5 text-sm text-marble/55">
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
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-marble/55">
              Comentarios <span className="text-marble/30 normal-case">(opcional)</span>
            </label>
            <textarea
              value={form.comments}
              onChange={(e) => setForm({ ...form, comments: e.target.value })}
              rows={3}
              placeholder="¿Alguna preferencia o indicación para tu cita?"
              className="w-full resize-none rounded-xl border border-marble/10 bg-marble/[0.04] px-4 py-3 text-sm text-marble placeholder:text-marble/30 transition-colors focus:border-wood/50 focus:bg-marble/[0.06] focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="fixed inset-x-0 bottom-0 z-30 glass-panel px-5 pb-6 pt-4">
          <button
            type="submit"
            disabled={submitting || !isValid}
            className={`flex w-full items-center justify-center gap-2 rounded-full py-4 text-sm font-semibold uppercase tracking-wider transition-all duration-200 ${
              isValid && !submitting
                ? 'bg-marble text-ink hover:bg-white active:scale-[0.98]'
                : 'bg-marble/10 text-marble/30'
            }`}
          >
            {submitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
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
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-marble/55">
        {label}
      </label>
      <div
        className={`flex items-center gap-3 rounded-xl border bg-marble/[0.04] px-4 py-3 transition-colors focus-within:border-wood/50 focus-within:bg-marble/[0.06] ${
          error ? 'border-red-400/30' : 'border-marble/10'
        }`}
      >
        <span className="text-marble/40">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full bg-transparent text-sm text-marble placeholder:text-marble/30 focus:outline-none"
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}
