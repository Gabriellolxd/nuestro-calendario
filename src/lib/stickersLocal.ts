// src/lib/stickersLocal.ts
import { db, type StickerAssetLocal, type StickerPlacementLocal, type StickerTargetType } from './db';
import { supabase } from './supabase';
import { procesarStickerConBorde } from './stickerBorder';
import { STICKERS_PREDEFINIDOS } from './stickersPredefinidos';

function estaOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

function urlPublica(path: string): string {
  const { data } = supabase.storage.from('stickers').getPublicUrl(path);
  return data.publicUrl;
}

export function urlParaSticker(asset: StickerAssetLocal): string {
  if (asset.storage_path) return urlPublica(asset.storage_path);
  if (asset.blob) return URL.createObjectURL(asset.blob);
  return '';
}

export type StickerVisual = {
  id: string;
  nombre: string;
  url: string;
  esPredefinido: boolean;
  ownerUserId: string | null;
};

export async function limpiarStickersPredefinidosLocales() {
  const todos = await db.sticker_assets.toArray();
  const viejos = todos.filter((s) => s.es_predefinido);
  if (viejos.length === 0) return;
  await db.sticker_assets.bulkDelete(viejos.map((s) => s.id));
}

export async function obtenerStickersDisponibles(userIds: string[]): Promise<StickerVisual[]> {
  const predefinidos: StickerVisual[] = STICKERS_PREDEFINIDOS.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    url: p.archivo,
    esPredefinido: true,
    ownerUserId: null,
  }));

  const personalizados = await obtenerStickersLocal(userIds);
  const personalizadosVisual: StickerVisual[] = personalizados.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    url: urlParaSticker(s),
    esPredefinido: false,
    ownerUserId: s.owner_user_id,
  }));

  return [...predefinidos, ...personalizadosVisual];
}

export async function crearStickerLocal(userId: string, archivo: File, nombre: string): Promise<StickerAssetLocal> {
  const blobProcesado = await procesarStickerConBorde(archivo);
  const nuevo: StickerAssetLocal = {
    id: crypto.randomUUID(),
    owner_user_id: userId,
    nombre,
    storage_path: null,
    es_predefinido: false,
    blob: blobProcesado,
    client_updated_at: new Date().toISOString(),
    deleted_at: null,
    synced: 0,
  };
  await db.sticker_assets.put(nuevo);
  return nuevo;
}

export async function eliminarStickerLocal(id: string) {
  await db.sticker_assets.update(id, {
    deleted_at: new Date().toISOString(),
    synced: 0,
  });
}

// Ya no filtramos por dueño: lo que hay en Dexie es exactamente lo que
// las consultas de red (abajo) decidieron que era legítimo traer — no
// hace falta volver a filtrar aquí, y filtrar de más era justo la causa
// del bug de "no veo los stickers de mi pareja en mi propio calendario".
export async function obtenerStickersLocal(userIds: string[]): Promise<StickerAssetLocal[]> {
  const todos = await db.sticker_assets.toArray();
  return todos.filter((s) => s.deleted_at === null && !s.es_predefinido);
}

export async function colocarStickerLocal(datos: {
  calendarioOwnerId: string;
  colocadoPorUserId: string;
  stickerAssetId: string;
  targetType: StickerTargetType;
  targetMes?: string | null;
  targetDia?: string | null;
  targetEventId?: string | null;
  posX?: number;
  posY?: number;
}): Promise<StickerPlacementLocal> {
  const nuevo: StickerPlacementLocal = {
    id: crypto.randomUUID(),
    calendario_owner_id: datos.calendarioOwnerId,
    colocado_por_user_id: datos.colocadoPorUserId,
    sticker_asset_id: datos.stickerAssetId,
    target_type: datos.targetType,
    target_mes: datos.targetMes ?? null,
    target_dia: datos.targetDia ?? null,
    target_event_id: datos.targetEventId ?? null,
    pos_x: datos.posX ?? 50,
    pos_y: datos.posY ?? 50,
    rotacion: 0,
    escala: 1,
    z_index: 1,
    client_updated_at: new Date().toISOString(),
    deleted_at: null,
    synced: 0,
  };
  await db.sticker_placements.put(nuevo);
  return nuevo;
}

export async function moverStickerLocal(id: string, posX: number, posY: number) {
  await db.sticker_placements.update(id, {
    pos_x: posX,
    pos_y: posY,
    client_updated_at: new Date().toISOString(),
    synced: 0,
  });
}

export async function actualizarTransformStickerLocal(
  id: string,
  cambios: { rotacion?: number; escala?: number; z_index?: number }
) {
  await db.sticker_placements.update(id, {
    ...cambios,
    client_updated_at: new Date().toISOString(),
    synced: 0,
  });
}

export async function quitarStickerLocal(id: string) {
  await db.sticker_placements.update(id, {
    deleted_at: new Date().toISOString(),
    synced: 0,
  });
}

export async function obtenerPlacementsLocal(calendarioOwnerId: string): Promise<StickerPlacementLocal[]> {
  const todos = await db.sticker_placements.where('calendario_owner_id').equals(calendarioOwnerId).toArray();
  return todos.filter((p) => p.deleted_at === null);
}

export async function migrarPlacementADia(id: string, targetDia: string, posX: number, posY: number) {
  await db.sticker_placements.update(id, {
    target_type: 'dia',
    target_dia: targetDia,
    target_mes: null,
    pos_x: posX,
    pos_y: posY,
    client_updated_at: new Date().toISOString(),
    synced: 0,
  });
}

export async function subirStickersPendientes() {
  if (estaOffline()) return;

  const assetsPendientes = await db.sticker_assets.where('synced').equals(0).toArray();
  for (const asset of assetsPendientes) {
    if (asset.es_predefinido) continue;
    try {
      if (asset.deleted_at) {
        if (asset.storage_path) {
          await supabase.storage.from('stickers').remove([asset.storage_path]);
        }
        await supabase.from('sticker_assets').delete().eq('id', asset.id);
        await db.sticker_assets.delete(asset.id);
        continue;
      }

      let path = asset.storage_path;
      if (!path && asset.blob) {
        path = `${asset.owner_user_id}/${asset.id}.png`;
        const { error: uploadError } = await supabase.storage
          .from('stickers')
          .upload(path, asset.blob, { contentType: 'image/png', upsert: true });
        if (uploadError) throw uploadError;
      }
      if (!path) continue;

      const { error: upsertError } = await supabase.from('sticker_assets').upsert({
        id: asset.id,
        owner_user_id: asset.owner_user_id,
        nombre: asset.nombre,
        storage_path: path,
        es_predefinido: false,
      });
      if (upsertError) throw upsertError;

      await db.sticker_assets.update(asset.id, { storage_path: path, synced: 1 });
    } catch (err) {
      console.error('Error subiendo sticker asset:', err);
    }
  }

  const placementsPendientes = await db.sticker_placements.where('synced').equals(0).toArray();
  for (const p of placementsPendientes) {
    try {
      if (p.deleted_at) {
        await supabase.from('sticker_placements').delete().eq('id', p.id);
        await db.sticker_placements.delete(p.id);
        continue;
      }
      const { error } = await supabase.from('sticker_placements').upsert({
        id: p.id,
        calendario_owner_id: p.calendario_owner_id,
        colocado_por_user_id: p.colocado_por_user_id,
        sticker_asset_id: p.sticker_asset_id,
        target_type: p.target_type,
        target_mes: p.target_mes,
        target_dia: p.target_dia,
        target_event_id: p.target_event_id,
        pos_x: p.pos_x,
        pos_y: p.pos_y,
        rotacion: p.rotacion,
        escala: p.escala,
        z_index: p.z_index,
      });
      if (error) throw error;
      await db.sticker_placements.update(p.id, { synced: 1 });
    } catch (err) {
      console.error('Error subiendo sticker placement:', err);
    }
  }
}

export async function descargarStickersDesdeNube(
  userIds: string[],
  calendarioOwnerId: string,
  selfUserId: string
) {
  if (estaOffline()) return;

  try {
    // 1) Librería para elegir: tus propios stickers + los de cualquier
    // persona vinculada (para poder pegarlos, aunque aún no estén
    // colocados en ningún calendario).
    const { data: assetsLibreria } = await supabase
      .from('sticker_assets')
      .select('*')
      .in('owner_user_id', userIds)
      .eq('es_predefinido', false);

    // 2) Placements de este calendario.
    const { data: placementsNube } = await supabase
      .from('sticker_placements')
      .select('*')
      .eq('calendario_owner_id', calendarioOwnerId);

    // 3) Assets REALMENTE usados en este calendario, sin filtrar por
    // dueño — esto es lo que garantiza que se vea un sticker de tu
    // pareja pegado en TU calendario, sin importar la dirección del
    // vínculo entre ustedes.
    const idsAssetsUsados = Array.from(
      new Set((placementsNube ?? []).map((p) => p.sticker_asset_id))
    ).filter((id) => !id.startsWith('predef-'));

    let assetsDePlacements: StickerAssetLocal[] = [];
    if (idsAssetsUsados.length > 0) {
      const { data } = await supabase.from('sticker_assets').select('*').in('id', idsAssetsUsados);
      assetsDePlacements = (data ?? []) as StickerAssetLocal[];
    }

    const combinados = new Map<string, StickerAssetLocal>();
    for (const a of assetsLibreria ?? []) combinados.set(a.id, a);
    for (const a of assetsDePlacements) combinados.set(a.id, a);
    const assetsRemotos = Array.from(combinados.values());

    const locales = await db.sticker_assets.toArray();
    const protegidos = new Set(locales.filter((a) => a.synced === 0).map((a) => a.id));

    const paraGuardar = assetsRemotos
      .filter((a) => !protegidos.has(a.id))
      .map((a) => ({ ...a, blob: null, synced: 1, client_updated_at: new Date().toISOString(), deleted_at: null }));
    if (paraGuardar.length > 0) await db.sticker_assets.bulkPut(paraGuardar);

    // Reconciliación de borrados: SOLO para tus propios assets. Nunca
    // borramos localmente algo de otra persona por su sola ausencia en
    // esta consulta — su ausencia puede deberse solo a que esta vez no
    // se volvió a pedir, no a que se haya borrado de verdad. Esto era
    // justo lo que causaba el "aparece un instante y desaparece".
    const misLocales = locales.filter((a) => a.owner_user_id === selfUserId && !a.es_predefinido);
    const idsLibreriaRemota = new Set((assetsLibreria ?? []).map((a) => a.id));
    const huerfanosPropios = misLocales.filter(
      (a) => !protegidos.has(a.id) && !idsLibreriaRemota.has(a.id)
    );
    if (huerfanosPropios.length > 0) {
      await db.sticker_assets.bulkDelete(huerfanosPropios.map((a) => a.id));
    }

    // ---------- PLACEMENTS (igual que antes) ----------
    const placementsRemotos = placementsNube ?? [];
    const idsPlacementsRemotos = new Set(placementsRemotos.map((p) => p.id));

    const placementsLocales = await db.sticker_placements
      .where('calendario_owner_id')
      .equals(calendarioOwnerId)
      .toArray();
    const protegidosPlacements = new Set(placementsLocales.filter((p) => p.synced === 0).map((p) => p.id));

    const huerfanosPlacements = placementsLocales.filter(
      (p) => !protegidosPlacements.has(p.id) && !idsPlacementsRemotos.has(p.id)
    );
    if (huerfanosPlacements.length > 0) {
      await db.sticker_placements.bulkDelete(huerfanosPlacements.map((p) => p.id));
    }

    const placementsParaGuardar = placementsRemotos
      .filter((p) => !protegidosPlacements.has(p.id))
      .map((p) => ({ ...p, synced: 1, client_updated_at: new Date().toISOString(), deleted_at: null }));
    if (placementsParaGuardar.length > 0) await db.sticker_placements.bulkPut(placementsParaGuardar);
  } catch (err) {
    console.error('Error descargando stickers:', err);
  }
}

export async function limpiarTodosLosStickersDelCalendario(calendarioOwnerId: string) {
  const todos = await obtenerPlacementsLocal(calendarioOwnerId);
  for (const p of todos) {
    await quitarStickerLocal(p.id);
  }
  await subirStickersPendientes();
}