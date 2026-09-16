import { useState, useEffect, useCallback } from 'react';
import type { Customer } from '@/types';
import { Search, Users, Phone, Mail, MessageSquare, ChevronRight, PhoneCall } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CustomerDetailModal } from '@/components/admin/CustomerDetailModal';
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

  useEffect(() => { onRefresh(); }, [onRefresh]);

  const filtered = useCallback(
    () => {
      const q = search.toLowerCase().trim();
      if (!q) return customers;
      return customers.filter((c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q)
      );
    },
    [customers, search]
  )();

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" label="Cargando clientes…" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-2 rounded-xl glass-card px-3 py-2.5">
        <Search className="h-4 w-4 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, teléfono o email..."
          className="w-full bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl glass-card px-5 py-12 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-500">No hay clientes registrados.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((c) => (
            <div
              key={c.user_id || c.phone}
              onClick={() => setSelectedCustomer(c)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedCustomer(c); }}
              className="group cursor-pointer rounded-2xl glass-card p-4 transition-all duration-200 hover:border-gold/30 hover:bg-white/[0.04] hover:shadow-lg hover:shadow-gold/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl gold-gradient font-display text-sm font-bold text-black shadow-md shadow-gold/10 group-hover:scale-105 transition-transform">
                    {c.full_name ? c.full_name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white group-hover:text-gold transition-colors">{c.full_name}</p>
                      {c.user_id && (
                        <span className="rounded-full bg-gold/10 px-1.5 py-0.5 text-[0.6rem] font-semibold text-gold border border-gold/20">
                          Google
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <Phone className="h-3 w-3 text-zinc-500" />
                      <span>{c.phone}</span>
                    </div>
                    {c.email && (
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <Mail className="h-3 w-3 text-zinc-500" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    )}
                    {c.comments && (
                      <div className="flex items-start gap-1.5 text-xs text-zinc-400">
                        <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-zinc-500" />
                        <span className="line-clamp-2">{c.comments}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Direct quick action buttons + chevron */}
                <div className="flex items-center gap-1.5 shrink-0 self-center">
                  <a
                    href={getWhatsAppUrl(c.phone, `¡Hola ${c.full_name}! Te escribimos de Peluquería Adrián...`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="WhatsApp"
                    aria-label={`WhatsApp con ${c.full_name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:scale-105 transition-all"
                  >
                    <WhatsAppIcon className="h-4 w-4 fill-current" />
                  </a>
                  <a
                    href={getCallUrl(c.phone)}
                    onClick={(e) => e.stopPropagation()}
                    title="Llamar"
                    aria-label={`Llamar a ${c.full_name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 hover:scale-105 transition-all"
                  >
                    <PhoneCall className="h-3.5 w-3.5" />
                  </a>
                  <div className="pl-1 text-zinc-500 group-hover:text-gold group-hover:translate-x-0.5 transition-all">
                    <ChevronRight className="h-4 w-4" />
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
    </div>
  );
}
