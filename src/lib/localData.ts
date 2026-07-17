// src/lib/localData.ts
import { db, type EventoLocal, type ExcepcionLocal } from './db';
import { supabase } from './supabase';
import type { EventoBase, Excepcion } from './recurrence';

function estaOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

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
// Cada escritura marca origen_offline según el estado de conexión en
// el momento exacto de guardar — es lo que el motor de sync usa para
// decidir si debe forzar un conflicto sin importar el tiempo transcurrido.

export async function crearEventoLocal(
  evento: Omit<EventoLocal, 'created_at' | 'synced' | 'origen_offline'>
) {
  await db.events.put({
    ...evento,
    origen_offline: estaOffline() ? 1 : 0,
    created_at: new Date().toISOString(),
    synced: 0,
  });
}

export async function actualizarEventoLocal(id: string, cambios: Partial<EventoLocal>) {
  const filasActualizadas = await db.events.update(id, {
    ...cambios,
    origen_offline: estaOffline() ? 1 : 0,
    synced: 0,
  });
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
    origen_offline: estaOffline() ? 1 : 0,
    synced: 0,
  });
  if (filasActualizadas === 0) {
    throw new Error('No se pudo eliminar el evento en la base local (0 filas afectadas).');
  }
}

export async function upsertExcepcionLocal(
  excepcion: Omit<ExcepcionLocal, 'synced' | 'origen_offline'>
) {
  await db.event_exceptions.put({
    ...excepcion,
    origen_offline: estaOffline() ? 1 : 0,
    synced: 0,
  });
}

// ---------- DESCARGA INICIAL (pull desde Supabase) ----------

export async function descargarDesdeNube(userId: string) {
  // IDs de entidades que SIGUEN en conflicto sin resolver: estas se dejan
  // intactas durante el pull (el usuario debe decidir en el modal). Todo
  // lo demás marcado synced:2 que YA NO aparece aquí significa que se
  // resolvió (en este dispositivo u otro) — se sobreescribe con la
  // versión definitiva del servidor.
  const { data: conflictosSinResolver } = await supabase
    .from('sync_conflicts')
    .select('entity_type, entity_id')
    .eq('resolved', false);

  const idsEventosEnConflicto = new Set(
    (conflictosSinResolver ?? []).filter((c) => c.entity_type === 'event').map((c) => c.entity_id)
  );
  const idsExcepcionesEnConflicto = new Set(
    (conflictosSinResolver ?? []).filter((c) => c.entity_type === 'event_exception').map((c) => c.entity_id)
  );

  const { data: eventosNube, error: errEventos } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', userId);

  if (errEventos) throw errEventos;

  if (eventosNube && eventosNube.length > 0) {
    const idsNube = eventosNube.map((e) => e.id);
    const localesExistentes = await db.events.where('id').anyOf(idsNube).toArray();

    const protegidosIds = new Set(
      localesExistentes
        .filter((e) => e.synced === 0 || (e.synced === 2 && idsEventosEnConflicto.has(e.id)))
        .map((e) => e.id)
    );

    const paraGuardar = eventosNube
      .filter((e) => !protegidosIds.has(e.id))
      .map((e) => ({ ...e, synced: 1, origen_offline: 0 }));

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
      const protegidosExcIds = new Set(
        localesExc
          .filter((ex) => ex.synced === 0 || (ex.synced === 2 && idsExcepcionesEnConflicto.has(ex.id)))
          .map((ex) => ex.id)
      );

      const excParaGuardar = excepcionesNube
        .filter((ex) => !protegidosExcIds.has(ex.id))
        .map((ex) => ({ ...ex, synced: 1, origen_offline: 0 }));

      if (excParaGuardar.length > 0) {
        await db.event_exceptions.bulkPut(excParaGuardar);
      }
    }
  }

  await db.meta.put({ clave: 'ultima_descarga', valor: new Date().toISOString() });
}