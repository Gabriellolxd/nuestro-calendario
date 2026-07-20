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
  period_start: string; // 'yyyy-MM-dd'
  period_end: string | null;
  luteal_length_manual: number | null;
  symptoms: string[];
  notes: string | null;
  device_id: string;
  change_uuid: string;
  client_updated_at: string;
  deleted_at: string | null;
  created_at: string;
  synced: number; // 0 pendiente, 1 confirmado, 2 en conflicto (mismo patrón que events)
  origen_offline: number;
}

export interface CyclePredictionCacheLocal {
  user_id: string;
  avg_cycle_length: number;
  std_dev_cycle: number;
  luteal_length: number;
  ventana_ensanchada: boolean;
  next_period_predicted: string; // 'yyyy-MM-dd'
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

class NuestroCalendarioDB extends Dexie {
  events!: Table<EventoLocal, string>;
  event_exceptions!: Table<ExcepcionLocal, string>;
  meta!: Table<MetaLocal, string>;
  cycle_logs!: Table<CycleLogLocal, string>;
  cycle_predictions_cache!: Table<CyclePredictionCacheLocal, string>;

  constructor() {
    super('nuestro-calendario');

    this.version(1).stores({
      events: 'id, user_id, deleted_at, synced, client_updated_at',
      event_exceptions:
        'id, event_base_id, fecha_excepcion, deleted_at, synced, [event_base_id+fecha_excepcion]',
      meta: 'clave',
    });

    // v2: módulo del ciclo (Fase 9). Dexie exige repetir las tablas que
    // no cambian, o las borraría al migrar — por eso events/exceptions/meta
    // aparecen otra vez aquí, sin cambios.
    this.version(2).stores({
      events: 'id, user_id, deleted_at, synced, client_updated_at',
      event_exceptions:
        'id, event_base_id, fecha_excepcion, deleted_at, synced, [event_base_id+fecha_excepcion]',
      meta: 'clave',
      cycle_logs: 'id, user_id, deleted_at, synced, client_updated_at, period_start',
      cycle_predictions_cache: 'user_id',
    });
  }
}

export const db = new NuestroCalendarioDB();