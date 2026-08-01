// src/lib/notificationsRemoto.ts
// Trae eventos/excepciones directo de Supabase (no de Dexie) para poder
// calcular notificaciones de CUALQUIER calendario al que tengas acceso,
// no solo el que tienes activo en pantalla en este momento.
import { supabase } from './supabase';
import type { EventoBase, Excepcion } from './recurrence';

export async function obtenerEventosYExcepcionesRemoto(
  ownerId: string
): Promise<{ eventos: EventoBase[]; excepciones: Excepcion[] }> {
  const { data: eventosData, error: errEventos } = await supabase
    .from('events')
    .select('id, titulo, descripcion, hex_color, hora_inicio, hora_fin, tipo_recurrencia, minutos_aviso')
    .eq('user_id', ownerId)
    .is('deleted_at', null);

  if (errEventos) {
    console.error('Error obteniendo eventos remotos para notificaciones:', errEventos.message);
    return { eventos: [], excepciones: [] };
  }

  const eventos = (eventosData ?? []) as EventoBase[];
  const ids = eventos.map((e) => e.id);
  let excepciones: Excepcion[] = [];

  if (ids.length > 0) {
    const { data: excData, error: errExc } = await supabase
      .from('event_exceptions')
      .select('id, event_base_id, fecha_excepcion, nuevo_titulo, nuevo_hex_color, nueva_hora_inicio, nueva_hora_fin, is_cancelled')
      .in('event_base_id', ids)
      .is('deleted_at', null);

    if (!errExc) excepciones = (excData ?? []) as Excepcion[];
  }

  return { eventos, excepciones };
}