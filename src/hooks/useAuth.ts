import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = useCallback(async (uid: string) => {
    const { data } = await supabase.rpc('get_my_role');
    if (data) {
      setRole(data as UserRole);
    } else {
      setRole({ role: null, status: null, barber_id: null, email: null });
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        fetchRole(data.session.user.id);
      } else {
        setRole({ role: null, status: null, barber_id: null, email: null });
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id);
      } else {
        setRole({ role: null, status: null, barber_id: null, email: null });
      }
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, [fetchRole]);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setRole({ role: null, status: null, barber_id: null, email: null });
  }, []);

  const refreshRole = useCallback(async () => {
    if (user) await fetchRole(user.id);
  }, [user, fetchRole]);

  return { user, role, loading, signInWithGoogle, signOut, refreshRole };
}
