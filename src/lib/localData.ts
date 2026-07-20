// src/lib/localData.ts
import {
  db,
  type EventoLocal,
  type ExcepcionLocal,
  type CycleLogLocal,
  type CyclePredictionCacheLocal,
} from './db';
import { supabase } from './supabase';
import type { EventoBase, Excepcion } from './recurrence';
import { calcularPrediccion, type CycleLogInput } from './cyclePrediction';

function estaOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

// ---------- EVENTOS: LECTURA ----------

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
    minutos_aviso: e.minutos_aviso,
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

// ---------- EVENTOS: ESCRITURA ----------

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

// ---------- CICLO MENSTRUAL: LECTURA ----------

export async function obtenerCycleLogsLocal(userId: string): Promise<CycleLogLocal[]> {
  const filas = await db.cycle_logs
    .where('user_id')
    .equals(userId)
    .filter((c) => c.deleted_at === null)
    .toArray();
  return filas.sort((a, b) => a.period_start.localeCompare(b.period_start));
}

export async function obtenerPrediccionCacheLocal(
  userId: string
): Promise<CyclePredictionCacheLocal | undefined> {
  return db.cycle_predictions_cache.get(userId);
}

// ---------- CICLO MENSTRUAL: ESCRITURA ----------

export async function crearCycleLogLocal(
  log: Omit<CycleLogLocal, 'created_at' | 'synced' | 'origen_offline'>
) {
  await db.cycle_logs.put({
    ...log,
    origen_offline: estaOffline() ? 1 : 0,
    created_at: new Date().toISOString(),
    synced: 0,
  });
}

export async function actualizarCycleLogLocal(id: string, cambios: Partial<CycleLogLocal>) {
  const filasActualizadas = await db.cycle_logs.update(id, {
    ...cambios,
    origen_offline: estaOffline() ? 1 : 0,
    synced: 0,
  });
  if (filasActualizadas === 0) {
    throw new Error('No se pudo actualizar el registro del ciclo (0 filas afectadas).');
  }
}

export async function eliminarCycleLogLocal(id: string, deviceId: string) {
  const ahora = new Date().toISOString();
  const filasActualizadas = await db.cycle_logs.update(id, {
    deleted_at: ahora,
    device_id: deviceId,
    change_uuid: crypto.randomUUID(),
    client_updated_at: ahora,
    origen_offline: estaOffline() ? 1 : 0,
    synced: 0,
  });
  if (filasActualizadas === 0) {
    throw new Error('No se pudo eliminar el registro del ciclo (0 filas afectadas).');
  }
}

// Recalcula la predicción desde los cycle_logs locales y la guarda en
// caché (local + Supabase). Solo se llama cuando cambian los datos del
// ciclo (crear/editar/eliminar, o al terminar un sync) — requisito 6:
// "solo se recalcula cuando llega un nuevo registro sincronizado".
export async function recalcularYGuardarPrediccion(userId: string) {
  const logs = await obtenerCycleLogsLocal(userId);
  const logsInput: CycleLogInput[] = logs.map((l) => ({
    period_start: l.period_start,
    period_end: l.period_end,
    luteal_length_manual: l.luteal_length_manual,
  }));

  const prediccion = calcularPrediccion(logsInput);

  if (!prediccion) {
    await db.cycle_predictions_cache.delete(userId);
    await supabase.from('cycle_predictions_cache').delete().eq('user_id', userId).then(
      () => {},
      () => {}
    );
    return;
  }

  const cache: CyclePredictionCacheLocal = {
    user_id: userId,
    avg_cycle_length: prediccion.avgCycleLength,
    std_dev_cycle: prediccion.stdDevCycle,
    luteal_length: prediccion.lutealLength,
    avg_period_duration: prediccion.avgPeriodDuration,
    es_estimado: prediccion.esEstimado,
    ventana_ensanchada: prediccion.ventanaEnsanchada,
    next_period_predicted: prediccion.nextPeriodPredicted,
    ovulation_predicted: prediccion.ovulationPredicted,
    fertile_window_start: prediccion.fertileWindowStart,
    fertile_window_end: prediccion.fertileWindowEnd,
    updated_at: new Date().toISOString(),
  };

  await db.cycle_predictions_cache.put(cache);

  // Fire-and-forget: si no hay internet, el cálculo local ya quedó
  // disponible igual; se reintenta en el próximo recálculo.
  supabase
    .from('cycle_predictions_cache')
    .upsert(
      {
        user_id: userId,
        avg_cycle_length: prediccion.avgCycleLength,
        std_dev_cycle: prediccion.stdDevCycle,
        next_period_predicted: prediccion.nextPeriodPredicted,
        ovulation_predicted: prediccion.ovulationPredicted,
        fertile_window_start: prediccion.fertileWindowStart,
        fertile_window_end: prediccion.fertileWindowEnd,
      },
      { onConflict: 'user_id' }
    )
    .then(
      () => {},
      (err) => console.error('Error subiendo caché de predicción:', err)
    );
}

// ---------- DESCARGA INICIAL (pull desde Supabase) ----------

export async function descargarDesdeNube(userId: string) {
  const { data: conflictosSinResolver } = await supabase
    .from('sync_conflicts')
    .select('entity_type, entity_id')
    .eq('resolved', false);

  const idsEnConflictoPorTipo = (tipo: string) =>
    new Set((conflictosSinResolver ?? []).filter((c) => c.entity_type === tipo).map((c) => c.entity_id));

  const idsEventosEnConflicto = idsEnConflictoPorTipo('event');
  const idsExcepcionesEnConflicto = idsEnConflictoPorTipo('event_exception');
  const idsCycleLogsEnConflicto = idsEnConflictoPorTipo('cycle_log');

  // --- eventos ---
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
    if (paraGuardar.length > 0) await db.events.bulkPut(paraGuardar);
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
      if (excParaGuardar.length > 0) await db.event_exceptions.bulkPut(excParaGuardar);
    }
  }

  // --- ciclo menstrual ---
  const { data: cycleLogsNube, error: errCiclo } = await supabase
    .from('cycle_logs')
    .select('*')
    .eq('user_id', userId);
  if (errCiclo) throw errCiclo;

  let huboCambiosDeCiclo = false;

  if (cycleLogsNube && cycleLogsNube.length > 0) {
    const idsNube = cycleLogsNube.map((c) => c.id);
    const localesExistentes = await db.cycle_logs.where('id').anyOf(idsNube).toArray();
    const protegidosIds = new Set(
      localesExistentes
        .filter((c) => c.synced === 0 || (c.synced === 2 && idsCycleLogsEnConflicto.has(c.id)))
        .map((c) => c.id)
    );
    const paraGuardar = cycleLogsNube
      .filter((c) => !protegidosIds.has(c.id))
      .map((c) => ({ ...c, synced: 1, origen_offline: 0 }));
    if (paraGuardar.length > 0) {
      await db.cycle_logs.bulkPut(paraGuardar);
      huboCambiosDeCiclo = true;
    }
  }

  if (huboCambiosDeCiclo) {
    await recalcularYGuardarPrediccion(userId);
  }

  await db.meta.put({ clave: 'ultima_descarga', valor: new Date().toISOString() });
}