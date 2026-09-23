import { supabase } from '@/lib/supabase';

// Un origen sirve a un único negocio: BusinessProvider lo fija antes de renderizar la app.
let currentBusinessId: string | null = null;

export function setCurrentBusinessId(id: string): void {
  currentBusinessId = id;
}

export function getCurrentBusinessId(): string {
  if (!currentBusinessId) throw new Error('El negocio aún no está resuelto');
  return currentBusinessId;
}

function withBusiness(values: object | object[], businessId: string) {
  return Array.isArray(values)
    ? values.map((row) => ({ ...row, business_id: businessId }))
    : { ...values, business_id: businessId };
}

// Acceso a tablas de aplicación siempre acotado al negocio actual. RLS sigue siendo la autoridad;
// esto evita mezclar datos en la UI y garantiza que toda escritura lleve business_id.
export function tenantFrom(table: string) {
  const businessId = getCurrentBusinessId();
  const query = supabase.from(table);
  return {
    select<Columns extends string = '*'>(columns?: Columns, options?: Parameters<typeof query.select>[1]) {
      return query.select<Columns>(columns, options).eq('business_id', businessId);
    },
    insert(values: object | object[], options?: Parameters<typeof query.insert>[1]) {
      return query.insert(withBusiness(values, businessId), options);
    },
    upsert(values: object | object[], options?: Parameters<typeof query.upsert>[1]) {
      return query.upsert(withBusiness(values, businessId), options);
    },
    update(values: object, options?: Parameters<typeof query.update>[1]) {
      return query.update(values, options).eq('business_id', businessId);
    },
    delete(options?: Parameters<typeof query.delete>[0]) {
      return query.delete(options).eq('business_id', businessId);
    },
  };
}

export function tenantRealtimeFilter(): string {
  return `business_id=eq.${getCurrentBusinessId()}`;
}

export function tenantStoragePath(fileName: string): string {
  return `businesses/${getCurrentBusinessId()}/${fileName}`;
}
