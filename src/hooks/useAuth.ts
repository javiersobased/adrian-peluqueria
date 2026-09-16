import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const MASTER_ADMIN_EMAILS = [
    'franciscojavierfarinapadilla@gmail.com',
    'adrian.millan.peguero@hotmail.com',
  ];

  const fetchRole = useCallback(async (_uid: string, email?: string | null) => {
    const cleanEmail = email?.toLowerCase().trim();
    if (!cleanEmail) {
      setRole({ role: null, status: null, barber_id: null, email: null });
      return;
    }

    // 1. Master Admins: unconditional and permanent admin access
    if (MASTER_ADMIN_EMAILS.includes(cleanEmail)) {
      setRole({ role: 'admin', status: 'verified', barber_id: null, email: cleanEmail });
      return;
    }

    // 2. Barbers: Check if this email is assigned to an active barber in the team
    try {
      const { data: barber } = await supabase
        .from('barbers')
        .select('id, name, google_email')
        .eq('active', true)
        .ilike('google_email', cleanEmail)
        .maybeSingle();

      if (barber) {
        setRole({ role: 'barber', status: 'verified', barber_id: barber.id, email: cleanEmail });
        return;
      }
    } catch {
      // ignore
    }

    // 3. Fallback to RPC only if returned role is 'barber' and linked to an active barber
    try {
      const { data } = await supabase.rpc('get_my_role');
      if (
        data &&
        (data as UserRole).role === 'barber' &&
        (data as UserRole).status === 'verified' &&
        (data as UserRole).barber_id
      ) {
        setRole(data as UserRole);
        return;
      }
    } catch {
      // ignore
    }

    // 4. Any other email (e.g. old test accounts like javierjunior1917@gmail.com) has ZERO access to the panel
    setRole({ role: null, status: null, barber_id: null, email: cleanEmail });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        fetchRole(data.session.user.id, data.session.user.email);
      } else {
        setRole({ role: null, status: null, barber_id: null, email: null });
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id, session.user.email);
      } else {
        setRole({ role: null, status: null, barber_id: null, email: null });
      }
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, [fetchRole]);

  const signInWithGoogle = useCallback(async () => {
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const redirectTo = isLocalhost ? window.location.origin : 'https://www.adrianmillan.es';

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setRole({ role: null, status: null, barber_id: null, email: null });
  }, []);

  const refreshRole = useCallback(async () => {
    if (user) await fetchRole(user.id, user.email);
  }, [user, fetchRole]);

  return { user, role, loading, signInWithGoogle, signOut, refreshRole };
}
