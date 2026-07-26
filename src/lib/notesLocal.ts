// src/lib/notesLocal.ts
import { db, type StickyNoteLocal, type StickerTargetType } from './db';
import { supabase } from './supabase';

function estaOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

export async function crearNotaLocal(datos: {
  calendarioOwnerId: string;
  colocadoPorUserId: string;
  targetType: StickerTargetType;
  targetMes?: string | null;
  targetDia?: string | null;
  targetEventId?: string | null;
  posX?: number;
  posY?: number;
  color?: string;
}): Promise<StickyNoteLocal> {
  const nueva: StickyNoteLocal = {
    id: crypto.randomUUID(),
    calendario_owner_id: datos.calendarioOwnerId,
    colocado_por_user_id: datos.colocadoPorUserId,
    target_type: datos.targetType,
    target_mes: datos.targetMes ?? null,
    target_dia: datos.targetDia ?? null,
    target_event_id: datos.targetEventId ?? null,
    contenido: '',
    color: datos.color ?? '#fef3c7',
    pos_x: datos.posX ?? 50,
    pos_y: datos.posY ?? 50,
    rotacion: (Math.random() * 8 - 4), // pequeña inclinación aleatoria, se ve más "pegado a mano"
    z_index: 1,
    client_updated_at: new Date().toISOString(),
    deleted_at: null,
    synced: 0,
  };
  await db.sticky_notes.put(nueva);
  return nueva;
}

export async function actualizarNotaLocal(id: string, cambios: Partial<StickyNoteLocal>) {
  await db.sticky_notes.update(id, {
    ...cambios,
    client_updated_at: new Date().toISOString(),
    synced: 0,
  });
}

export async function eliminarNotaLocal(id: string) {
  await db.sticky_notes.update(id, {
    deleted_at: new Date().toISOString(),
    synced: 0,
  });
}

export async function obtenerNotasLocal(calendarioOwnerId: string, targetType: StickerTargetType, targetKey: string | null): Promise<StickyNoteLocal[]> {
  const todas = await db.sticky_notes.where('calendario_owner_id').equals(calendarioOwnerId).toArray();
  return todas.filter((n) => {
    if (n.deleted_at !== null) return false;
    if (n.target_type !== targetType) return false;
    if (targetType === 'mes') return n.target_mes === targetKey;
    if (targetType === 'dia') return n.target_dia === targetKey;
    if (targetType === 'evento') return n.target_event_id === targetKey;
    return false;
  });
}

export async function subirNotasPendientes() {
  if (estaOffline()) return;
  const pendientes = await db.sticky_notes.where('synced').equals(0).toArray();
  for (const n of pendientes) {
    try {
      if (n.deleted_at) {
        await supabase.from('sticky_notes').delete().eq('id', n.id);
        await db.sticky_notes.delete(n.id);
        continue;
      }
      const { error } = await supabase.from('sticky_notes').upsert({
        id: n.id,
        calendario_owner_id: n.calendario_owner_id,
        colocado_por_user_id: n.colocado_por_user_id,
        target_type: n.target_type,
        target_mes: n.target_mes,
        target_dia: n.target_dia,
        target_event_id: n.target_event_id,
        contenido: n.contenido,
        color: n.color,
        pos_x: n.pos_x,
        pos_y: n.pos_y,
        rotacion: n.rotacion,
        z_index: n.z_index,
      });
      if (error) throw error;
      await db.sticky_notes.update(n.id, { synced: 1 });
    } catch (err) {
      console.error('Error subiendo nota:', err);
    }
  }
}

export async function descargarNotasDesdeNube(calendarioOwnerId: string) {
  if (estaOffline()) return;
  try {
    const { data } = await supabase.from('sticky_notes').select('*').eq('calendario_owner_id', calendarioOwnerId);
    if (!data) return;
    const idsNube = data.map((n) => n.id);
    const locales = await db.sticky_notes.where('id').anyOf(idsNube).toArray();
    const protegidos = new Set(locales.filter((n) => n.synced === 0).map((n) => n.id));
    const paraGuardar = data
      .filter((n) => !protegidos.has(n.id))
      .map((n) => ({ ...n, synced: 1, client_updated_at: new Date().toISOString(), deleted_at: null }));
    if (paraGuardar.length > 0) await db.sticky_notes.bulkPut(paraGuardar);
  } catch (err) {
    console.error('Error descargando notas:', err);
  }
}