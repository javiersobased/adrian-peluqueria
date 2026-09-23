import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { StepHeader } from '@/components/ServiceStep';
import { UserIcon, CheckIcon } from '@/components/icons';
import { supabase } from '@/lib/supabase';
import { tenantFrom } from '@/lib/tenant';
import { getPendingBooking } from '@/lib/pendingBooking';
import type { BookingForm } from '@/types';
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  type Country,
  validatePhoneNumber,
  formatDigitsForDisplay,
  detectCountryFromInput,
} from '@/lib/countries';
import { Search, ChevronDown, X, Sparkles, AlertCircle, Clock, Mail } from 'lucide-react';

const DRAFT_KEY = 'amm_client_details_draft';

interface DetailsStepProps {
  onBack: () => void;
  onSubmit: (form: BookingForm) => void;
  submitting: boolean;
  error: string | null;
}

export function DetailsStep({ onBack, onSubmit, submitting, error }: DetailsStepProps) {
  const [firstName, setFirstName] = useState(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) return JSON.parse(saved).firstName || '';
    } catch {}
    return '';
  });
  const [lastName, setLastName] = useState(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) return JSON.parse(saved).lastName || '';
    } catch {}
    return '';
  });
  const [selectedCountry, setSelectedCountry] = useState<Country>(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.countryCode) {
          const match = COUNTRIES.find((c) => c.code === parsed.countryCode);
          if (match) return match;
        }
      }
    } catch {}
    return DEFAULT_COUNTRY;
  });
  const [nationalNumber, setNationalNumber] = useState(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) return JSON.parse(saved).nationalNumber || '';
    } catch {}
    return '';
  });
  const [comments, setComments] = useState(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) return JSON.parse(saved).comments || '';
    } catch {}
    return '';
  });
  const [marketingAccepted, setMarketingAccepted] = useState(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.marketingAccepted === 'boolean') return parsed.marketingAccepted;
      }
      return localStorage.getItem('marketing_accepted') === 'true';
    } catch {}
    return false;
  });
  const [honeypot, setHoneypot] = useState('');
  const isSubmittingRef = useRef(false);

  // Sincronizar borrador local en sessionStorage para no perder datos si el usuario cambia de horario
  useEffect(() => {
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          firstName,
          lastName,
          nationalNumber,
          comments,
          marketingAccepted,
          countryCode: selectedCountry.code,
        })
      );
    } catch {}
  }, [firstName, lastName, nationalNumber, comments, marketingAccepted, selectedCountry]);

  const [touched, setTouched] = useState<{
    firstName?: boolean;
    lastName?: boolean;
    phone?: boolean;
  }>({});

  const [prefilledFromGoogle, setPrefilledFromGoogle] = useState(false);
  const [phoneAutofilled, setPhoneAutofilled] = useState(false);
  const [showConfirmationNotice, setShowConfirmationNotice] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Sincronizar el ref de envío con el estado submitting
  useEffect(() => {
    if (!submitting) {
      isSubmittingRef.current = false;
    }
  }, [submitting]);

  // Load user details from Google OAuth or Customers / Previous Bookings / Pending storage
  useEffect(() => {
    (async () => {
      let foundPhone: string | null = null;

      // 1. Check Google Auth Session first
      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;

        if (user) {
          const meta = user.user_metadata || {};
          let gFirst = (meta.given_name as string) || '';
          let gLast = (meta.family_name as string) || '';

          // If no separate given/family name, parse full_name or name
          if (!gFirst && !gLast) {
            const rawFull = (meta.full_name || meta.name || '') as string;
            if (rawFull.trim()) {
              const parts = rawFull.trim().split(/\s+/);
              gFirst = parts[0] || '';
              gLast = parts.slice(1).join(' ') || '';
            }
          }

          if (gFirst || gLast) {
            setFirstName(gFirst);
            setLastName(gLast);
            setPrefilledFromGoogle(true);
          }

          // Consultar última reserva y perfil de cliente para autorellenar teléfono
          try {
            const { data: lastBooking } = await tenantFrom('bookings')
              .select('phone, full_name')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            const { data: custRecord } = await tenantFrom('customers')
              .select('phone, full_name, comments')
              .eq('user_id', user.id)
              .maybeSingle();

            foundPhone = lastBooking?.phone || custRecord?.phone || null;

            if (custRecord?.comments) {
              setComments((prev: string) => prev || custRecord.comments || '');
            }
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }

      // 2. Check pending booking draft if present
      const pending = getPendingBooking();
      if (pending) {
        if (pending.full_name) {
          const parts = pending.full_name.trim().split(/\s+/);
          setFirstName((prev: string) => prev || parts[0] || '');
          setLastName((prev: string) => prev || parts.slice(1).join(' ') || '');
        }
        if (pending.phone) {
          foundPhone = pending.phone;
        }
        if (pending.comments) {
          setComments((prev: string) => prev || pending.comments || '');
        }
      }

      // 3. Si encontramos un teléfono de su propia cita previa o perfil autenticado, autorellenarlo
      if (foundPhone) {
        setNationalNumber((prev: string) => {
          if (prev) return prev;
          const detected = detectCountryFromInput(foundPhone!);
          if (detected) {
            setSelectedCountry(detected.country);
            return formatDigitsForDisplay(detected.country.code, detected.nationalNumber);
          }
          const digits = foundPhone!.replace(/\D/g, '');
          return formatDigitsForDisplay('ES', digits);
        });
        setPhoneAutofilled(true);
        setShowConfirmationNotice(true);
      }
    })();
  }, []);

  // Handle phone input with intelligent country detection if pasted with prefix
  const handlePhoneChange = useCallback((raw: string) => {
    // If the user pastes an international number (+351 912..., +34..., 0033...)
    const detected = detectCountryFromInput(raw);
    if (detected) {
      setSelectedCountry(detected.country);
      setNationalNumber(formatDigitsForDisplay(detected.country.code, detected.nationalNumber));
      return;
    }

    // Otherwise format national digits for the currently selected country
    const digitsOnly = raw.replace(/\D/g, '');
    const formatted = formatDigitsForDisplay(selectedCountry.code, digitsOnly);
    setNationalNumber(formatted);
  }, [selectedCountry]);

  // Validation
  const phoneValidation = useMemo(
    () => validatePhoneNumber(selectedCountry, nationalNumber),
    [selectedCountry, nationalNumber]
  );

  const errors = useMemo(() => {
    return {
      firstName: firstName.trim().length < 2 ? 'Introduce tu nombre' : '',
      lastName: lastName.trim().length < 2 ? 'Introduce tus apellidos' : '',
      phone: phoneValidation.error || '',
    };
  }, [firstName, lastName, phoneValidation.error]);

  const isValid = !errors.firstName && !errors.lastName && phoneValidation.isValid;

  const isSlotConflict = useMemo(() => {
    if (!error) return false;
    const lower = error.toLowerCase();
    return (
      lower.includes('horario') ||
      lower.includes('disponible') ||
      lower.includes('solapa') ||
      lower.includes('ocupado') ||
      lower.includes('reservado') ||
      lower.includes('ya está')
    );
  }, [error]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Trampa invisible para bots automáticos
    if (honeypot) {
      console.warn('[Security] Detección de bot por honeypot');
      return;
    }
    // Evitar envíos concurrentes por doble clic o pulsación rápida
    if (isSubmittingRef.current || submitting) return;

    setTouched({ firstName: true, lastName: true, phone: true });
    if (!isValid) return;

    isSubmittingRef.current = true;
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const combinedFullName = `${trimmedFirst} ${trimmedLast}`.trim();

    onSubmit({
      firstName: trimmedFirst,
      lastName: trimmedLast,
      fullName: combinedFullName,
      phone: phoneValidation.formattedE164,
      comments: comments.trim(),
      marketingAccepted,
    });
  };

  // Filtered countries for the modal
  const filteredCountries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col animate-slide-in overflow-hidden">
      <div className="flex flex-col h-full w-full max-w-xl mx-auto sm:my-auto sm:max-h-[94vh] sm:rounded-3xl sm:border sm:border-white/10 sm:bg-zinc-950/80 sm:backdrop-blur-xl sm:shadow-2xl overflow-hidden">
        <StepHeader title="Tus datos" subtitle="Paso 4 de 4" onBack={onBack} />

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        {/* Campo trampa anti-spam (invisible para humanos, rellenado por bots) */}
        <div
          className="sr-only"
          aria-hidden="true"
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, width: 0 }}
        >
          <label htmlFor="b_security_code">Security Code</label>
          <input
            id="b_security_code"
            type="text"
            name="b_security_code"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <div data-lenis-prevent className="flex-1 overflow-y-auto px-4 py-2 sm:px-5 sm:py-3 space-y-2.5">
          {prefilledFromGoogle ? (
            <div className="flex items-center gap-2 rounded-xl border border-gold/20 bg-gold/10 px-3 py-1.5 text-[0.7rem] text-gold">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-gold" />
              <span>
                Nombre autocompletado de Google. Puedes editarlo libremente.
              </span>
            </div>
          ) : (
            <p className="text-xs text-zinc-400">
              Introduce tus datos de contacto para confirmar tu reserva en Adrián Millán Peluquería.
            </p>
          )}

          {/* Nombre y Apellidos divididos en dos campos */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Field
              label="Nombre"
              icon={<UserIcon className="h-4 w-4" />}
              value={firstName}
              onChange={(v) => {
                setFirstName(v);
                setTouched((t) => ({ ...t, firstName: true }));
              }}
              onBlur={() => setTouched((t) => ({ ...t, firstName: true }))}
              error={touched.firstName ? errors.firstName : ''}
              type="text"
              autoComplete="given-name"
            />

            <Field
              label="Apellidos"
              icon={<UserIcon className="h-4 w-4" />}
              value={lastName}
              onChange={(v) => {
                setLastName(v);
                setTouched((t) => ({ ...t, lastName: true }));
              }}
              onBlur={() => setTouched((t) => ({ ...t, lastName: true }))}
              error={touched.lastName ? errors.lastName : ''}
              type="text"
              autoComplete="family-name"
            />
          </div>

          {/* Aviso de confirmación de datos autorellenados */}
          {showConfirmationNotice && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-gold/40 bg-gold/10 p-3 text-xs text-zinc-200 animate-fade-in">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gold text-xs">¿Son estos datos correctos?</p>
                <p className="mt-0.5 text-[0.7rem] text-zinc-300 leading-relaxed">
                  Hemos autorellenado tu número de teléfono con el de tu última reserva. Puedes modificarlo libremente si ha cambiado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmationNotice(false)}
                className="text-zinc-400 hover:text-white p-0.5 transition-colors"
                title="Cerrar aviso"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Teléfono con selector de país internacional */}
          <div>
            <label className="mb-1 block text-[0.65rem] font-medium uppercase tracking-wider text-zinc-500">
              Número de teléfono
            </label>
            <div
              className={`flex items-center rounded-xl glass-card transition-colors focus-within:border-gold/30 ${
                touched.phone && errors.phone ? 'border-red-500/30' : ''
              }`}
            >
              {/* Botón selector de país */}
              <button
                type="button"
                onClick={() => setShowCountryModal(true)}
                className="flex items-center gap-1.5 border-r border-white/10 px-3 py-2.5 text-xs font-medium text-white transition-colors hover:bg-white/5 active:scale-95 shrink-0"
                title="Cambiar prefijo internacional"
              >
                <span className="text-lg leading-none">{selectedCountry.flag}</span>
                <span className="font-mono text-xs font-semibold text-zinc-300">
                  {selectedCountry.dialCode}
                </span>
                <ChevronDown className="h-3 w-3 text-zinc-500" />
              </button>

              {/* Input para el número nacional */}
              <div className="flex flex-1 items-center px-3 py-2.5">
                <input
                  type="tel"
                  value={nationalNumber}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                  autoComplete="tel-national"
                  className="w-full bg-transparent font-mono text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                />
              </div>
            </div>
            {touched.phone && errors.phone ? (
              <p className="mt-1 text-xs text-red-400">{errors.phone}</p>
            ) : (
              <p className="mt-1 text-[0.65rem] text-zinc-500">
                Se guardará como: <span className="font-mono text-zinc-400">{phoneValidation.formattedE164 || `${selectedCountry.dialCode} ...`}</span>
              </p>
            )}
          </div>

          {/* Comentarios opcionales */}
          <div>
            <label className="mb-1 block text-[0.65rem] font-medium uppercase tracking-wider text-zinc-500">
              Comentarios <span className="text-zinc-600 normal-case">(opcional)</span>
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={2}
              placeholder="¿Alguna preferencia o indicación para tu cita?"
              className="w-full resize-none rounded-xl glass-card px-3 py-2 text-xs sm:text-sm text-white placeholder:text-zinc-600 transition-colors focus:border-gold/30 focus:outline-none"
            />
          </div>

          {/* Casilla de consentimiento para correos comerciales y aviso de confirmación */}
          <div className="space-y-2 pt-1">
            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 cursor-pointer select-none transition-all hover:bg-white/[0.06] hover:border-gold/30">
              <input
                type="checkbox"
                checked={marketingAccepted}
                onChange={(e) => setMarketingAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-gold accent-amber-500 focus:ring-gold/30 shrink-0"
              />
              <span className="text-xs text-zinc-300 leading-snug">
                Deseo recibir correos comerciales con novedades, ofertas y promociones exclusivas de Adrián Millán.
              </span>
            </label>

            <div className="flex items-center gap-2 px-1 text-[0.7rem] text-zinc-400">
              <Mail className="h-3.5 w-3.5 text-gold shrink-0" />
              <span>El correo de confirmación de tu cita siempre se enviará automáticamente.</span>
            </div>
          </div>

          {error && (
            isSlotConflict ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200 animate-fade-in space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-amber-300">Horario ya no disponible</p>
                    <p className="text-[0.75rem] text-zinc-300 mt-0.5 leading-relaxed">{error}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onBack}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 py-2.5 px-3 text-xs font-bold text-amber-300 transition-all active:scale-95"
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>Elegir otro horario disponible</span>
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {error}
              </div>
            )
          )}
        </div>

        <div className="sticky bottom-0 z-30 mt-auto glass-panel px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="submit"
            disabled={submitting || !isValid}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3 sm:py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all duration-300 ${
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

      {/* Modal / Selector de país con buscador */}
      {showCountryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-md animate-fade-in"
            onClick={() => setShowCountryModal(false)}
          />
          <div className="relative flex max-h-[85vh] w-full max-w-sm flex-col rounded-3xl border border-gold/20 bg-zinc-900/95 p-5 shadow-2xl backdrop-blur-xl animate-scale-in">
            {/* Cabecera */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-display text-base font-bold text-white">Selecciona tu país</h3>
              <button
                type="button"
                onClick={() => setShowCountryModal(false)}
                className="rounded-full p-1 text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Buscador rápido */}
            <div className="my-3 flex items-center gap-2.5 rounded-2xl bg-white/5 px-3.5 py-2.5 border border-white/10">
              <Search className="h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar país o prefijo..."
                autoFocus
                className="w-full bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Lista de países */}
            <div data-lenis-prevent className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[50vh]">
              {filteredCountries.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-500">
                  No se encontraron países que coincidan con tu búsqueda.
                </p>
              ) : (
                filteredCountries.map((country) => {
                  const isSelected = country.code === selectedCountry.code;
                  return (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => {
                        setSelectedCountry(country);
                        setShowCountryModal(false);
                        setSearchQuery('');
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                        isSelected
                          ? 'border border-gold/40 bg-gold/15 text-white font-semibold'
                          : 'hover:bg-white/5 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl leading-none">{country.flag}</span>
                        <span className="text-sm">{country.name}</span>
                      </div>
                      <span className="font-mono text-xs text-zinc-400">{country.dialCode}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
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
      <label className="mb-1 block text-[0.65rem] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </label>
      <div
        className={`flex items-center gap-2.5 rounded-xl glass-card px-3 py-2.5 transition-colors focus-within:border-gold/30 ${
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
          className="w-full bg-transparent text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none"
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
