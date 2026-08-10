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

// Genera un string con forma de UUID v4 válida (para la columna `uuid` de
// Postgres) de forma DETERMINISTA a partir de un texto — mismo texto
// siempre da el mismo id, sin necesidad de guardar nada aparte. No es
// criptográficamente aleatorio, pero no necesita serlo: solo necesita
// sintaxis válida y ser estable entre sesiones/dispositivos.
function idDeterministaUUID(seed: string): string {
  let hash = 0;
  const partes: string[] = [];
  let texto = seed;
  while (partes.join('').length < 32) {
    hash = 0;
    for (let i = 0; i < texto.length; i++) {
      hash = (hash * 31 + texto.charCodeAt(i) + partes.length) | 0;
    }
    partes.push(Math.abs(hash).toString(16).padStart(8, '0'));
    texto = texto + hash;
  }
  const hex = partes.join('').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// URL para mostrar un sticker: los predefinidos usan una ruta pública
// directa (/stickers/algo.png desde /public), los subidos por el usuario
// usan Supabase Storage, y los que aún no se subieron usan el blob local.
export function urlParaSticker(asset: StickerAssetLocal): string {
  if (asset.es_predefinido && asset.storage_path) return asset.storage_path;
  if (asset.storage_path) return urlPublica(asset.storage_path);
  if (asset.blob) return URL.createObjectURL(asset.blob);
  return '';
}

// Registra (una sola vez, de forma idempotente) los stickers predefinidos
// como parte de la librería REAL del usuario — así viajan exactamente
// por el mismo camino que cualquier sticker subido a mano: mismo id
// estable, misma tabla, mismo mecanismo de sync. Se llama al abrir la app.
export async function registrarStickersPredefinidos(userId: string) {
  for (const predef of STICKERS_PREDEFINIDOS) {
    const id = idDeterministaUUID(`${userId}-${predef.id}`);
    const existente = await db.sticker_assets.get(id);
    if (existente) continue;

    await db.sticker_assets.put({
      id,
      owner_user_id: userId,
      nombre: predef.nombre,
      storage_path: predef.archivo,
      es_predefinido: true,
      blob: null,
      client_updated_at: new Date().toISOString(),
      deleted_at: null,
      synced: 0,
    });
  }
  subirStickersPendientes().catch((err) => console.error('Error registrando stickers predefinidos:', err));
}

// ---------- CREAR (funciona offline: procesa el borde y guarda el blob localmente) ----------

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

export async function obtenerStickersLocal(userIds: string[]): Promise<StickerAssetLocal[]> {
  const todos = await db.sticker_assets.toArray();
  return todos
    .filter((s) => s.deleted_at === null && userIds.includes(s.owner_user_id))
    .sort((a, b) => (a.es_predefinido === b.es_predefinido ? 0 : a.es_predefinido ? 1 : -1));
}

// ---------- COLOCAR (placements) ----------

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

// ---------- SYNC ----------

export async function subirStickersPendientes() {
  if (estaOffline()) return;

  const assetsPendientes = await db.sticker_assets.where('synced').equals(0).toArray();
  for (const asset of assetsPendientes) {
    try {
      if (asset.deleted_at) {
        if (asset.storage_path && !asset.es_predefinido) {
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
        es_predefinido: asset.es_predefinido,
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

export async function descargarStickersDesdeNube(userIds: string[], calendarioOwnerId: string) {
  if (estaOffline()) return;

  try {
    const { data: assetsNube } = await supabase.from('sticker_assets').select('*').in('owner_user_id', userIds);
    if (assetsNube) {
      const idsNube = assetsNube.map((a) => a.id);
      const locales = await db.sticker_assets.where('id').anyOf(idsNube).toArray();
      const protegidos = new Set(locales.filter((a) => a.synced === 0).map((a) => a.id));
      const paraGuardar = assetsNube
        .filter((a) => !protegidos.has(a.id))
        .map((a) => ({ ...a, blob: null, synced: 1, client_updated_at: new Date().toISOString(), deleted_at: null }));
      if (paraGuardar.length > 0) await db.sticker_assets.bulkPut(paraGuardar);
    }

    const { data: placementsNube } = await supabase
      .from('sticker_placements')
      .select('*')
      .eq('calendario_owner_id', calendarioOwnerId);
    if (placementsNube) {
      const idsNube = placementsNube.map((p) => p.id);
      const locales = await db.sticker_placements.where('id').anyOf(idsNube).toArray();
      const protegidos = new Set(locales.filter((p) => p.synced === 0).map((p) => p.id));
      const paraGuardar = placementsNube
        .filter((p) => !protegidos.has(p.id))
        .map((p) => ({ ...p, synced: 1, client_updated_at: new Date().toISOString(), deleted_at: null }));
      if (paraGuardar.length > 0) await db.sticker_placements.bulkPut(paraGuardar);
    }
  } catch (err) {
    console.error('Error descargando stickers:', err);
  }
}