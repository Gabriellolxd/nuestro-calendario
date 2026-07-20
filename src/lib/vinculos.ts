// src/lib/vinculos.ts
import { supabase } from './supabase';

export type RolCalendario = 'propio' | 'editor' | 'espectador';

export type CalendarioDisponible = {
  ownerId: string;
  rol: RolCalendario;
  label: string;
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

  for (const fila of data ?? []) {
    const email = (fila as any).profiles?.email ?? 'Calendario vinculado';
    resultado.push({
      ownerId: fila.owner_user_id,
      rol: fila.role === 'editor' ? 'editor' : 'espectador',
      label: email,
    });
  }

  return resultado;
}