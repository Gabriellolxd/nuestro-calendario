// src/lib/db.ts
import Dexie, { type Table } from 'dexie';
import type { TipoRecurrencia } from './recurrence';

export interface EventoLocal {
  id: string;
  user_id: string;
  titulo: string;
  descripcion: string | null;
  hex_color: string;
  hora_inicio: string;
  hora_fin: string;
  tipo_recurrencia: TipoRecurrencia;
  regla_recurrencia: string | null;
  device_id: string;
  change_uuid: string;
  client_updated_at: string;
  deleted_at: string | null;
  created_at: string;
  synced: number;
  origen_offline: number;
  minutos_aviso: number;
}

export interface ExcepcionLocal {
  id: string;
  event_base_id: string;
  fecha_excepcion: string;
  nuevo_titulo: string | null;
  nuevo_hex_color: string | null;
  nueva_hora_inicio: string | null;
  nueva_hora_fin: string | null;
  is_cancelled: boolean;
  device_id: string;
  change_uuid: string;
  client_updated_at: string;
  deleted_at: string | null;
  synced: number;
  origen_offline: number;
}

export interface CycleLogLocal {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string | null;
  luteal_length_manual: number | null;
  symptoms: string[];
  notes: string | null;
  device_id: string;
  change_uuid: string;
  client_updated_at: string;
  deleted_at: string | null;
  created_at: string;
  synced: number;
  origen_offline: number;
}

export interface CyclePredictionCacheLocal {
  user_id: string;
  avg_cycle_length: number;
  std_dev_cycle: number;
  luteal_length: number;
  ventana_ensanchada: boolean;
  next_period_predicted: string;
  ovulation_predicted: string;
  fertile_window_start: string;
  fertile_window_end: string;
  updated_at: string;
  avg_period_duration: number;
  es_estimado: boolean;
}

export interface MetaLocal {
  clave: string;
  valor: string;
}

export interface StickerAssetLocal {
  id: string;
  owner_user_id: string;
  nombre: string;
  storage_path: string | null;
  es_predefinido: boolean;
  blob: Blob | null;
  client_updated_at: string;
  deleted_at: string | null;
  synced: number;
}

export type StickerTargetType = 'mes' | 'dia' | 'evento';

export interface StickerPlacementLocal {
  id: string;
  calendario_owner_id: string;
  colocado_por_user_id: string;
  sticker_asset_id: string;
  target_type: StickerTargetType;
  target_mes: string | null;
  target_dia: string | null;
  target_event_id: string | null;
  pos_x: number;
  pos_y: number;
  rotacion: number;
  escala: number;
  z_index: number;
  client_updated_at: string;
  deleted_at: string | null;
  synced: number;
}

export interface StickyNoteLocal {
  id: string;
  calendario_owner_id: string;
  colocado_por_user_id: string;
  target_type: StickerTargetType;
  target_mes: string | null;
  target_dia: string | null;
  target_event_id: string | null;
  contenido: string;
  color: string;
  pos_x: number;
  pos_y: number;
  rotacion: number;
  z_index: number;
  client_updated_at: string;
  deleted_at: string | null;
  synced: number;
}

class NuestroCalendarioDB extends Dexie {
  events!: Table<EventoLocal, string>;
  event_exceptions!: Table<ExcepcionLocal, string>;
  meta!: Table<MetaLocal, string>;
  cycle_logs!: Table<CycleLogLocal, string>;
  cycle_predictions_cache!: Table<CyclePredictionCacheLocal, string>;
  sticker_assets!: Table<StickerAssetLocal, string>;
  sticker_placements!: Table<StickerPlacementLocal, string>;
  sticky_notes!: Table<StickyNoteLocal, string>;

  constructor() {
    super('nuestro-calendario');

    this.version(1).stores({
      events: 'id, user_id, deleted_at, synced, client_updated_at',
      event_exceptions:
        'id, event_base_id, fecha_excepcion, deleted_at, synced, [event_base_id+fecha_excepcion]',
      meta: 'clave',
    });

    this.version(2).stores({
      events: 'id, user_id, deleted_at, synced, client_updated_at',
      event_exceptions:
        'id, event_base_id, fecha_excepcion, deleted_at, synced, [event_base_id+fecha_excepcion]',
      meta: 'clave',
      cycle_logs: 'id, user_id, deleted_at, synced, client_updated_at, period_start',
      cycle_predictions_cache: 'user_id',
    });

    this.version(3).stores({
      events: 'id, user_id, deleted_at, synced, client_updated_at',
      event_exceptions:
        'id, event_base_id, fecha_excepcion, deleted_at, synced, [event_base_id+fecha_excepcion]',
      meta: 'clave',
      cycle_logs: 'id, user_id, deleted_at, synced, client_updated_at, period_start',
      cycle_predictions_cache: 'user_id',
      sticker_assets: 'id, owner_user_id, deleted_at, synced',
      sticker_placements:
        'id, calendario_owner_id, target_type, target_mes, target_dia, target_event_id, deleted_at, synced',
    });

    // v4: notas arrastrables (Fase 13.6 base)
    this.version(4).stores({
      events: 'id, user_id, deleted_at, synced, client_updated_at',
      event_exceptions:
        'id, event_base_id, fecha_excepcion, deleted_at, synced, [event_base_id+fecha_excepcion]',
      meta: 'clave',
      cycle_logs: 'id, user_id, deleted_at, synced, client_updated_at, period_start',
      cycle_predictions_cache: 'user_id',
      sticker_assets: 'id, owner_user_id, deleted_at, synced',
      sticker_placements:
        'id, calendario_owner_id, target_type, target_mes, target_dia, target_event_id, deleted_at, synced',
      sticky_notes:
        'id, calendario_owner_id, target_type, target_mes, target_dia, target_event_id, deleted_at, synced',
    });
  }
}

export const db = new NuestroCalendarioDB();