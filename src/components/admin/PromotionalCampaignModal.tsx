import { useState, useEffect } from 'react';
import { Megaphone, X, Send, Users } from 'lucide-react';
import { tenantFrom } from '@/lib/tenant';
import { sendPromotionalCampaign } from '@/lib/notifications';
import { notify } from '@/lib/notify';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ModalPortal } from '@/components/ui/ModalPortal';

interface PromotionalCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PromotionalCampaignModal({ isOpen, onClose }: PromotionalCampaignModalProps) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [ctaText, setCtaText] = useState('Reservar mi Cita');
  const [ctaLink, setCtaLink] = useState('https://www.adrianmillan.es/#citas');
  const [sending, setSending] = useState(false);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  // Load number of opted-in customers
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingCount(true);

    async function fetchAudience() {
      try {
        const { count, error } = await tenantFrom('customers')
          .select('user_id', { count: 'exact', head: true })
          .eq('marketing_accepted', true);

        if (!error && isMounted) {
          setAudienceCount(count ?? 0);
        }
      } catch (e) {
        console.warn('Error fetching audience count:', e);
      } finally {
        if (isMounted) setLoadingCount(false);
      }
    }

    fetchAudience();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      notify.error('Campos obligatorios', 'Por favor ingresa un título y un mensaje para la campaña.');
      return;
    }

    const confirmed = window.confirm(
      `¿Confirmas el envío de esta campaña promocional?\n\nSe enviará una notificación Push y un Email corporativo exclusivamente a los clientes que hayan aceptado comunicaciones comerciales.`
    );
    if (!confirmed) return;

    setSending(true);
    try {
      const result = await sendPromotionalCampaign({
        title: title.trim(),
        message: message.trim(),
        ctaText: ctaText.trim() || 'Reservar Cita',
        ctaLink: ctaLink.trim() || 'https://www.adrianmillan.es/#citas',
      });

      if (result.success) {
        notify.success(
          '¡Campaña enviada!',
          `Notificación Push disparada y ${result.emailsSent} correo(s) enviado(s) a clientes suscritos.`
        );
        setTitle('');
        setMessage('');
        onClose();
      } else {
        notify.error('Error al enviar', result.error || 'No se pudo completar el envío de la campaña.');
      }
    } catch (err: any) {
      notify.error('Error inesperado', err?.message || 'Ocurrió un error.');
    } finally {
      setSending(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose} />
        <div className="relative z-10 my-auto flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl glass-card border border-gold/30 p-4 sm:p-6 shadow-2xl bg-zinc-950/95 text-white animate-scale-in">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3 sm:pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 text-gold border border-gold/20">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-white">Campaña Promocional</h2>
              <p className="text-xs text-zinc-400">Push y Correos para clientes suscritos (cada 2-3 semanas)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={sending}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Legal & Consent Notice */}
        <div className="mt-4 rounded-xl bg-gold/5 border border-gold/20 p-3 text-xs text-zinc-300">
          <div className="flex items-center gap-2 font-medium text-gold mb-1">
            <Users className="h-4 w-4" />
            <span>Audiencia con consentimiento RGPD activo:</span>
          </div>
          <p className="text-zinc-400">
            {loadingCount ? (
              'Consultando clientes suscritos...'
            ) : audienceCount !== null ? (
              <strong className="text-white">{audienceCount} cliente(s)</strong>
            ) : (
              'Todos los clientes con casilla comercial activada'
            )}{' '}
            recibirán esta notificación push y el correo electrónico personalizado.
          </p>
        </div>

        {/* Campaign Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Título o Asunto de la Campaña *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: ¡20% en tu próximo corte! o Novedades de temporada"
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-gold focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Mensaje Principal *
            </label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe el mensaje de la promoción o aviso para tus clientes..."
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-gold focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Texto del Botón (CTA)
              </label>
              <input
                type="text"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="Reservar Cita"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3.5 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-gold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Enlace de Redirección
              </label>
              <input
                type="text"
                value={ctaLink}
                onChange={(e) => setCtaLink(e.target.value)}
                placeholder="https://www.adrianmillan.es/#citas"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3.5 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-gold focus:outline-none"
              />
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="rounded-xl px-4 py-2.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={sending}
              className="flex items-center gap-2 rounded-xl gold-gradient px-5 py-2.5 text-xs font-semibold text-black transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              {sending ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Enviando campaña...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Enviar Campaña</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
}
