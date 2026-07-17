// src/lib/sync.ts
import { db } from './db';
import { supabase } from './supabase';

type ResultadoSync = {
  id: string;
  entity_type: 'event' | 'event_exception';
  estado: 'aplicado' | 'duplicado' | 'conflicto' | 'error';
  mensaje?: string;
};

function paraEnviar<T extends { synced: number }>(fila: T) {
  const { synced, ...resto } = fila;
  return resto;
}

export async function subirCambiosPendientes(userId: string): Promise<{ huboConflictos: boolean }> {
  // Solo se reintenta lo REALMENTE pendiente (synced: 0). Lo que ya está
  // en conflicto (synced: 2) no se reenvía solo — espera a que alguien
  // lo resuelva en el modal, o a que el pull detecte que ya se resolvió
  // en otro dispositivo.
  const eventosPendientes = await db.events.where('synced').equals(0).toArray();
  const excepcionesPendientes = await db.event_exceptions.where('synced').equals(0).toArray();

  if (eventosPendientes.length === 0 && excepcionesPendientes.length === 0) {
    return { huboConflictos: false };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { huboConflictos: false };

  const cambios = [
    ...eventosPendientes.map((e) => ({ entity_type: 'event' as const, data: paraEnviar(e) })),
    ...excepcionesPendientes.map((ex) => ({ entity_type: 'event_exception' as const, data: paraEnviar(ex) })),
  ];

  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ cambios }),
  });

  if (!res.ok) throw new Error('Error al sincronizar con el servidor.');

  const { resultados }: { resultados: ResultadoSync[] } = await res.json();
  let huboConflictos = false;

  for (const r of resultados) {
    const tablaLocal = r.entity_type === 'event' ? db.events : db.event_exceptions;
    if (r.estado === 'aplicado' || r.estado === 'duplicado') {
      await tablaLocal.update(r.id, { synced: 1 });
    } else if (r.estado === 'conflicto') {
      await tablaLocal.update(r.id, { synced: 2 }); // deja de reintentarse solo
      huboConflictos = true;
    } else if (r.estado === 'error') {
      console.error(`Error sincronizando ${r.entity_type} ${r.id}:`, r.mensaje);
    }
  }

  return { huboConflictos };
}

// ---------- Resolución de conflictos ----------

export type ConflictoConDetalles = {
  id: string;
  entity_type: 'event' | 'event_exception';
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
  const tabla = conflicto.entity_type === 'event' ? 'events' : 'event_exceptions';
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

  const tablaLocal = conflicto.entity_type === 'event' ? db.events : db.event_exceptions;
  await tablaLocal.put({ ...datosFinales, synced: 1, origen_offline: 0 } as any);
}