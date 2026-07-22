// src/lib/vinculos.ts
import { supabase } from './supabase';

export type RolCalendario = 'propio' | 'editor' | 'espectador';

export type CalendarioDisponible = {
  ownerId: string;
  rol: RolCalendario;
  label: string;
};

type FilaVinculo = {
  owner_user_id: string;
  role: string;
  profiles: { email: string } | null;
};

export async function obtenerCalendariosDisponibles(userId: string): Promise<CalendarioDisponible[]> {
  const resultado: CalendarioDisponible[] = [
    { ownerId: userId, rol: 'propio', label: 'Mi calendario' },
  ];

  const { data, error } = await supabase
    .from('permisos_compartidos')
    .select('owner_user_id, role, profiles:profiles!permisos_compartidos_owner_user_id_fkey(email)')
    .eq('grantee_user_id', userId);

  if (error) {
    console.error('Error cargando calendarios vinculados:', error.message);
    return resultado;
  }

  const filas = (data ?? []) as unknown as FilaVinculo[];

  for (const fila of filas) {
    const email = fila.profiles?.email ?? 'Calendario vinculado';
    resultado.push({
      ownerId: fila.owner_user_id,
      rol: fila.role === 'editor' ? 'editor' : 'espectador',
      label: email,
    });
  }

  return resultado;
}