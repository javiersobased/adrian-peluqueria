import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Customer } from '@/types';
import { Search, Users, Phone, Mail, MessageSquare, ChevronRight, PhoneCall, Megaphone } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CustomerDetailModal } from '@/components/admin/CustomerDetailModal';
import { PromotionalCampaignModal } from '@/components/admin/PromotionalCampaignModal';
import { getWhatsAppUrl, getCallUrl } from '@/lib/phoneActions';
import { WhatsAppIcon } from '@/components/icons';

interface AdminCustomersProps {
  customers: Customer[];
  loading: boolean;
  onRefresh: () => void;
}

export function AdminCustomers({ customers, loading, onRefresh }: AdminCustomersProps) {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showPromoModal, setShowPromoModal] = useState(false);

  useEffect(() => { onRefresh(); }, [onRefresh]);

  const deduplicatedCustomers = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const c of customers) {
      const cleanPhone = (c.phone || '').trim().replace(/\s+/g, '');
      const key = cleanPhone && cleanPhone.length >= 6 ? cleanPhone : (c.email?.toLowerCase().trim() || c.user_id);
      if (!map.has(key)) {
        map.set(key, c);
      } else {
        const existing = map.get(key)!;
        // Prefer record with valid personal email
        if (!existing.email && c.email) {
          map.set(key, c);
        }
      }
    }
    return Array.from(map.values());
  }, [customers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return deduplicatedCustomers;
    return deduplicatedCustomers.filter((c) =>
      c.full_name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q)
    );
  }, [deduplicatedCustomers, search]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" label="Cargando clientes…" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl w-full min-w-0 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl glass-card px-3 py-2.5">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono o email..."
            className="w-full bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
          />
        </div>

        <button
          onClick={() => setShowPromoModal(true)}
          className="flex items-center justify-center gap-2 rounded-xl gold-gradient px-4 py-2.5 text-xs font-semibold text-black transition-all hover:brightness-110 active:scale-95 shadow-lg shadow-gold/10 shrink-0"
        >
          <Megaphone className="h-4 w-4" />
          <span>Campaña Promocional</span>
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl glass-card px-5 py-12 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-500">No hay clientes registrados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {filtered.map((c) => (
            <div
              key={c.user_id || c.phone}
              onClick={() => setSelectedCustomer(c)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedCustomer(c); }}
              className="group cursor-pointer rounded-2xl glass-card p-3 sm:p-4 transition-all duration-200 hover:border-gold/30 hover:bg-white/[0.04] hover:shadow-lg hover:shadow-gold/5"
            >
              <div className="flex items-center justify-between gap-2.5 sm:gap-3">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl gold-gradient font-display text-sm font-bold text-black shadow-md shadow-gold/10 group-hover:scale-105 transition-transform">
                    {c.full_name ? c.full_name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <p className="text-sm font-bold text-white group-hover:text-gold transition-colors truncate">{c.full_name}</p>
                      {c.user_id && (
                        <span className="rounded-full bg-gold/10 px-1.5 py-0.5 text-[0.6rem] font-semibold text-gold border border-gold/20 shrink-0">
                          Google
                        </span>
                      )}
                      {c.marketing_accepted && (
                        <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[0.6rem] font-semibold text-emerald-400 border border-emerald-500/20 shrink-0" title="Consentimiento de promociones aceptado">
                          Promo Sí
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400 min-w-0">
                      <Phone className="h-3 w-3 text-zinc-500 shrink-0" />
                      <span className="truncate">{c.phone}</span>
                    </div>
                    {c.email && (
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400 min-w-0">
                        <Mail className="h-3 w-3 text-zinc-500 shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    )}
                    {c.comments && (
                      <div className="flex items-start gap-1.5 text-xs text-zinc-400 min-w-0">
                        <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-zinc-500" />
                        <span className="line-clamp-1 sm:line-clamp-2 truncate">{c.comments}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Direct quick action buttons + chevron */}
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 self-center">
                  <a
                    href={getWhatsAppUrl(c.phone, `¡Hola ${c.full_name}! Te escribimos de Peluquería Adrián...`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="WhatsApp"
                    aria-label={`WhatsApp con ${c.full_name}`}
                    className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:scale-105 transition-all"
                  >
                    <WhatsAppIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current" />
                  </a>
                  <a
                    href={getCallUrl(c.phone)}
                    onClick={(e) => e.stopPropagation()}
                    title="Llamar"
                    aria-label={`Llamar a ${c.full_name}`}
                    className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 hover:scale-105 transition-all"
                  >
                    <PhoneCall className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </a>
                  <div className="pl-0.5 sm:pl-1 text-zinc-500 group-hover:text-gold group-hover:translate-x-0.5 transition-all">
                    <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Customer Detail / History Modal */}
      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}

      {/* Promotional Campaign Modal */}
      <PromotionalCampaignModal
        isOpen={showPromoModal}
        onClose={() => setShowPromoModal(false)}
      />
    </div>
  );
}
