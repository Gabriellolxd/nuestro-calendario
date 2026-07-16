// src/lib/localData.ts
import { db, type EventoLocal, type ExcepcionLocal } from './db';
import { supabase } from './supabase';
import type { EventoBase, Excepcion } from './recurrence';

// ---------- LECTURA (usada por page.tsx) ----------

export async function obtenerEventosLocal(userId: string): Promise<EventoBase[]> {
  const filas = await db.events
    .where('user_id')
    .equals(userId)
    .filter((e) => e.deleted_at === null)
    .toArray();

  return filas.map((e) => ({
    id: e.id,
    titulo: e.titulo,
    descripcion: e.descripcion,
    hex_color: e.hex_color,
    hora_inicio: e.hora_inicio,
    hora_fin: e.hora_fin,
    tipo_recurrencia: e.tipo_recurrencia,
  }));
}

export async function obtenerExcepcionesLocal(eventIds: string[]): Promise<Excepcion[]> {
  if (eventIds.length === 0) return [];
  const filas = await db.event_exceptions
    .where('event_base_id')
    .anyOf(eventIds)
    .filter((ex) => ex.deleted_at === null)
    .toArray();

  return filas.map((ex) => ({
    id: ex.id,
    event_base_id: ex.event_base_id,
    fecha_excepcion: ex.fecha_excepcion,
    nuevo_titulo: ex.nuevo_titulo,
    nuevo_hex_color: ex.nuevo_hex_color,
    nueva_hora_inicio: ex.nueva_hora_inicio,
    nueva_hora_fin: ex.nueva_hora_fin,
    is_cancelled: ex.is_cancelled,
  }));
}

// ---------- ESCRITURA (usada por EventoModal.tsx) ----------

export async function crearEventoLocal(evento: Omit<EventoLocal, 'created_at' | 'synced'>) {
  await db.events.put({ ...evento, created_at: new Date().toISOString(), synced: 0 });
}

export async function actualizarEventoLocal(id: string, cambios: Partial<EventoLocal>) {
  const filasActualizadas = await db.events.update(id, { ...cambios, synced: 0 });
  if (filasActualizadas === 0) {
    throw new Error('No se pudo actualizar el evento en la base local (0 filas afectadas).');
  }
}

export async function eliminarEventoLocal(id: string, deviceId: string) {
  const ahora = new Date().toISOString();
  const filasActualizadas = await db.events.update(id, {
    deleted_at: ahora,
    device_id: deviceId,
    change_uuid: crypto.randomUUID(),
    client_updated_at: ahora,
    synced: 0,
  });
  if (filasActualizadas === 0) {
    throw new Error('No se pudo eliminar el evento en la base local (0 filas afectadas).');
  }
}

export async function upsertExcepcionLocal(excepcion: Omit<ExcepcionLocal, 'synced'>) {
  await db.event_exceptions.put({ ...excepcion, synced: 0 });
}

// ---------- DESCARGA INICIAL (pull desde Supabase; el push real es Fase 7) ----------

export async function descargarDesdeNube(userId: string) {
  const { data: eventosNube, error: errEventos } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', userId);

  if (errEventos) throw errEventos;

  if (eventosNube && eventosNube.length > 0) {
    const idsNube = eventosNube.map((e) => e.id);
    const localesExistentes = await db.events.where('id').anyOf(idsNube).toArray();
    // No pisamos filas que tienen cambios locales aún no subidos (synced: 0).
    // Esto es un parche de seguridad, no el motor de sync real — eso es la Fase 7.
    const pendientesIds = new Set(
      localesExistentes.filter((e) => e.synced === 0).map((e) => e.id)
    );

    const paraGuardar = eventosNube
      .filter((e) => !pendientesIds.has(e.id))
      .map((e) => ({ ...e, synced: 1 }));

    if (paraGuardar.length > 0) {
      await db.events.bulkPut(paraGuardar);
    }
  }

  const ids = (eventosNube ?? []).map((e) => e.id);
  if (ids.length > 0) {
    const { data: excepcionesNube, error: errExc } = await supabase
      .from('event_exceptions')
      .select('*')
      .in('event_base_id', ids);

    if (errExc) throw errExc;

    if (excepcionesNube && excepcionesNube.length > 0) {
      const idsExcNube = excepcionesNube.map((ex) => ex.id);
      const localesExc = await db.event_exceptions.where('id').anyOf(idsExcNube).toArray();
      const pendientesExcIds = new Set(
        localesExc.filter((ex) => ex.synced === 0).map((ex) => ex.id)
      );

      const excParaGuardar = excepcionesNube
        .filter((ex) => !pendientesExcIds.has(ex.id))
        .map((ex) => ({ ...ex, synced: 1 }));

      if (excParaGuardar.length > 0) {
        await db.event_exceptions.bulkPut(excParaGuardar);
      }
    }
  }

  await db.meta.put({ clave: 'ultima_descarga', valor: new Date().toISOString() });
}