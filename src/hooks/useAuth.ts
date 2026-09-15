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
    if (cleanEmail && MASTER_ADMIN_EMAILS.includes(cleanEmail)) {
      setRole({ role: 'admin', status: 'verified', barber_id: null, email: cleanEmail });
      return;
    }
    try {
      const { data } = await supabase.rpc('get_my_role');
      if (data && (data as UserRole).role) {
        setRole(data as UserRole);
      } else {
        setRole({ role: null, status: null, barber_id: null, email: cleanEmail || null });
      }
    } catch {
      setRole({ role: null, status: null, barber_id: null, email: cleanEmail || null });
    }
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
