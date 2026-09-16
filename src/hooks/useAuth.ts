import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = useCallback(async (_uid: string, email?: string | null) => {
    const cleanEmail = email?.toLowerCase().trim();
    if (!cleanEmail) {
      setRole({ role: null, status: null, barber_id: null, email: null });
      return;
    }

    // 1. Master Admins: unconditional and permanent admin access
    const MASTER_ADMINS = [
      'adrian.millan.peguero@hotmail.com',
      'adrianmillanpeguero1994@hotmail.com',
      'franciscojavierfarinapadilla@gmail.com',
    ];

    if (MASTER_ADMINS.includes(cleanEmail)) {
      setRole({ role: 'admin', status: 'verified', barber_id: 'adrian', email: cleanEmail });
      return;
    }

    // 2. Check staff table for verified admin or barber role
    try {
      const { data: staffMember } = await supabase
        .from('staff')
        .select('role, status, barber_id, email')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (staffMember && staffMember.status === 'verified') {
        setRole({
          role: staffMember.role,
          status: 'verified',
          barber_id: staffMember.role === 'admin' ? (staffMember.barber_id || 'adrian') : staffMember.barber_id,
          email: cleanEmail,
        });
        return;
      }
    } catch {
      // ignore
    }

    // 3. Check if this email is in Adrián's profile (admin_emails or google_email)
    try {
      const { data: adrianBarber } = await supabase
        .from('barbers')
        .select('id, name, google_email, admin_emails')
        .eq('id', 'adrian')
        .maybeSingle();

      if (adrianBarber) {
        const adrianEmails: string[] = [];
        if (adrianBarber.google_email) {
          adrianEmails.push(adrianBarber.google_email.toLowerCase().trim());
        }
        if (Array.isArray(adrianBarber.admin_emails)) {
          adrianBarber.admin_emails.forEach((em: string) => {
            if (em) adrianEmails.push(em.toLowerCase().trim());
          });
        }
        if (adrianEmails.includes(cleanEmail)) {
          setRole({ role: 'admin', status: 'verified', barber_id: 'adrian', email: cleanEmail });
          return;
        }
      }
    } catch {
      // ignore
    }

    // 4. Regular Barbers: Check if this email is assigned to an active barber (excluding adrian)
    try {
      const { data: barber } = await supabase
        .from('barbers')
        .select('id, name, google_email')
        .eq('active', true)
        .neq('id', 'adrian')
        .ilike('google_email', cleanEmail)
        .maybeSingle();

      if (barber) {
        setRole({ role: 'barber', status: 'verified', barber_id: barber.id, email: cleanEmail });
        return;
      }
    } catch {
      // ignore
    }

    // 5. Fallback to RPC
    try {
      const { data } = await supabase.rpc('get_my_role');
      if (
        data &&
        (data as UserRole).role &&
        (data as UserRole).status === 'verified'
      ) {
        setRole(data as UserRole);
        return;
      }
    } catch {
      // ignore
    }

    // 6. Any other email has ZERO access to the panel
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
