// src/lib/sync.ts
import { db } from './db';
import { supabase } from './supabase';
import { recalcularYGuardarPrediccion } from './localData';

type EntityType = 'event' | 'event_exception' | 'cycle_log';

type ResultadoSync = {
  id: string;
  entity_type: EntityType;
  estado: 'aplicado' | 'duplicado' | 'conflicto' | 'error';
  mensaje?: string;
};

function paraEnviar<T extends { synced: number }>(fila: T) {
  const { synced, ...resto } = fila;
  return resto;
}

function tablaLocalPara(tipo: EntityType) {
  if (tipo === 'event') return db.events;
  if (tipo === 'event_exception') return db.event_exceptions;
  return db.cycle_logs;
}

function tablaRemotaPara(tipo: EntityType) {
  if (tipo === 'event') return 'events';
  if (tipo === 'event_exception') return 'event_exceptions';
  return 'cycle_logs';
}

export async function subirCambiosPendientes(): Promise<{ huboConflictos: boolean }> {
  const eventosPendientes = await db.events.where('synced').equals(0).toArray();
  const excepcionesPendientes = await db.event_exceptions.where('synced').equals(0).toArray();
  const cycleLogsPendientes = await db.cycle_logs.where('synced').equals(0).toArray();

  if (
    eventosPendientes.length === 0 &&
    excepcionesPendientes.length === 0 &&
    cycleLogsPendientes.length === 0
  ) {
    return { huboConflictos: false };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { huboConflictos: false };

  const cambios = [
    ...eventosPendientes.map((e) => ({ entity_type: 'event' as const, data: paraEnviar(e) })),
    ...excepcionesPendientes.map((ex) => ({ entity_type: 'event_exception' as const, data: paraEnviar(ex) })),
    ...cycleLogsPendientes.map((c) => ({ entity_type: 'cycle_log' as const, data: paraEnviar(c) })),
  ];

  // user_id real de cada cycle_log pendiente (puede ser el tuyo o el de tu
  // pareja, si eres Editor de su calendario) — se usa después del push
  // para recalcular la predicción de la persona correcta, no solo la tuya.
  const userIdPorCycleLogId = new Map(cycleLogsPendientes.map((c) => [c.id, c.user_id]));

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  const res = await fetch(`${apiBase}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ cambios }),
  });

  if (!res.ok) throw new Error('Error al sincronizar con el servidor.');

  const { resultados }: { resultados: ResultadoSync[] } = await res.json();
  let huboConflictos = false;
  const usuariosARecalcular = new Set<string>();

  for (const r of resultados) {
    const tablaLocal = tablaLocalPara(r.entity_type);
    if (r.estado === 'aplicado' || r.estado === 'duplicado') {
      await tablaLocal.update(r.id, { synced: 1 });
      if (r.entity_type === 'cycle_log') {
        const uid = userIdPorCycleLogId.get(r.id);
        if (uid) usuariosARecalcular.add(uid);
      }
    } else if (r.estado === 'conflicto') {
      await tablaLocal.update(r.id, { synced: 2 });
      huboConflictos = true;
    } else if (r.estado === 'error') {
      console.error(`Error sincronizando ${r.entity_type} ${r.id}:`, r.mensaje);
    }
  }

  for (const uid of usuariosARecalcular) {
    await recalcularYGuardarPrediccion(uid);
  }

  return { huboConflictos };
}

// ---------- Resolución de conflictos ----------

export type ConflictoConDetalles = {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  device_id_local: string;
  datos_locales: Record<string, any>;
  local_updated_at: string;
  local_origen_offline: boolean;
  device_id_servidor: string;
  datos_servidor: Record<string, any>;
  server_updated_at: string;
  device_local?: { label: string } | null;
  device_servidor?: { label: string } | null;
};

export async function obtenerConflictosPendientes(): Promise<ConflictoConDetalles[]> {
  const { data, error } = await supabase
    .from('sync_conflicts')
    .select(
      '*, device_local:devices!sync_conflicts_device_id_local_fkey(label), device_servidor:devices!sync_conflicts_device_id_servidor_fkey(label)'
    )
    .eq('resolved', false)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as ConflictoConDetalles[];
}

export async function resolverConflicto(conflicto: ConflictoConDetalles, eleccion: 'local' | 'servidor') {
  const tabla = tablaRemotaPara(conflicto.entity_type);
  const datosGanadores = eleccion === 'local' ? conflicto.datos_locales : conflicto.datos_servidor;
  const deviceGanador = eleccion === 'local' ? conflicto.device_id_local : conflicto.device_id_servidor;
  const ahora = new Date().toISOString();

  const datosFinales = {
    ...datosGanadores,
    device_id: deviceGanador,
    change_uuid: crypto.randomUUID(),
    client_updated_at: ahora,
  };
  delete (datosFinales as any).synced;

  const { error: updError } = await supabase.from(tabla).upsert(datosFinales, { onConflict: 'id' });
  if (updError) throw updError;

  const { error: resError } = await supabase
    .from('sync_conflicts')
    .update({ resolved: true, resolved_version: eleccion })
    .eq('id', conflicto.id);
  if (resError) throw resError;

  const tablaLocal = tablaLocalPara(conflicto.entity_type);
  await tablaLocal.put({ ...datosFinales, synced: 1, origen_offline: 0 } as any);

  if (conflicto.entity_type === 'cycle_log') {
    await recalcularYGuardarPrediccion((datosFinales as any).user_id);
  }
}