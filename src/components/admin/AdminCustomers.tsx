import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Customer } from '@/types';
import { Search, Users, Phone, Mail, MessageSquare } from 'lucide-react';

interface AdminCustomersProps {
  customers: Customer[];
  loading: boolean;
  onRefresh: () => void;
}

export function AdminCustomers({ customers, loading, onRefresh }: AdminCustomersProps) {
  const [search, setSearch] = useState('');

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
    return <div className="flex justify-center py-20"><span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-gold" /></div>;
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
            <div key={c.user_id} className="rounded-2xl glass-card p-4 transition-colors hover:border-gold/15">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl gold-gradient font-display text-sm font-bold text-black">
                  {c.full_name ? c.full_name.charAt(0).toUpperCase() : '?'}
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="text-sm font-bold text-white">{c.full_name}</p>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
