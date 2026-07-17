// src/lib/db.ts
import Dexie, { type Table } from 'dexie';
import type { TipoRecurrencia } from './recurrence';

export interface EventoLocal {
  id: string;
  user_id: string;
  titulo: string;
  descripcion: string | null;
  hex_color: string;
  hora_inicio: string; // ISO UTC
  hora_fin: string; // ISO UTC
  tipo_recurrencia: TipoRecurrencia;
  regla_recurrencia: string | null;
  device_id: string;
  change_uuid: string;
  client_updated_at: string;
  deleted_at: string | null;
  created_at: string;
  synced: number; // 0 = pendiente de subir a Supabase, 1 = ya confirmado (usado en Fase 7)
  origen_offline: number; // 1 si el cambio se guardó localmente estando desconectado
}

export interface ExcepcionLocal {
  id: string;
  event_base_id: string;
  fecha_excepcion: string; // 'yyyy-MM-dd'
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
  origen_offline: number; // 1 si el cambio se guardó localmente estando desconectado
}

export interface MetaLocal {
  clave: string;
  valor: string;
}

class NuestroCalendarioDB extends Dexie {
  events!: Table<EventoLocal, string>;
  event_exceptions!: Table<ExcepcionLocal, string>;
  meta!: Table<MetaLocal, string>;

  constructor() {
    super('nuestro-calendario');
    this.version(1).stores({
      events: 'id, user_id, deleted_at, synced, client_updated_at',
      event_exceptions:
        'id, event_base_id, fecha_excepcion, deleted_at, synced, [event_base_id+fecha_excepcion]',
      meta: 'clave',
    });
  }
}

export const db = new NuestroCalendarioDB();