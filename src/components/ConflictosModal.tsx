// src/components/ConflictosModal.tsx
'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { format, es, utcToEcuador } from '@/lib/dates';
import {
  obtenerConflictosPendientes,
  resolverConflicto,
  type ConflictoConDetalles,
} from '@/lib/sync';

type Props = {
  onClose: () => void;
  onResuelto: () => void;
};

const RECURRENCIA_LABELS: Record<string, string> = {
  none: 'No se repite',
  daily: 'Cada día',
  weekly: 'Cada semana',
  monthly: 'Cada mes',
  yearly: 'Cada año',
};

const CAMPOS_CICLO: Array<[string, string]> = [
  ['period_start', 'Inicio del periodo'],
  ['period_end', 'Fin del periodo'],
  ['luteal_length_manual', 'Duración fase lútea'],
  ['notes', 'Notas'],
];

type Fila = {
  icono: string;
  etiqueta: string;
  local: string;
  servidor: string;
  diferente: boolean;
  colorLocal?: string;
  colorServidor?: string;
};

function horaLegible(iso: string | null): string {
  if (!iso) return '—';
  return format(utcToEcuador(iso), 'HH:mm');
}

function construirFilas(tipo: 'event' | 'event_exception' | 'cycle_log', local: any, servidor: any): Fila[] {
  if (tipo === 'cycle_log') {
    const filasBase = CAMPOS_CICLO.map(([campo, etiqueta]) => ({
      icono: campo === 'notes' ? '🗒️' : '🩸',
      etiqueta,
      local: local[campo] != null && local[campo] !== '' ? String(local[campo]) : '—',
      servidor: servidor[campo] != null && servidor[campo] !== '' ? String(servidor[campo]) : '—',
      diferente: local[campo] !== servidor[campo],
    }));
    const sintomasLocal = (local.symptoms ?? []).join(', ') || '—';
    const sintomasServidor = (servidor.symptoms ?? []).join(', ') || '—';
    filasBase.push({
      icono: '🩺',
      etiqueta: 'Síntomas',
      local: sintomasLocal,
      servidor: sintomasServidor,
      diferente: sintomasLocal !== sintomasServidor,
    });
    return filasBase.filter((f) => f.diferente);
  }
  
  if (tipo === 'event') {
    const horarioLocal = `${horaLegible(local.hora_inicio)} – ${horaLegible(local.hora_fin)}`;
    const horarioServidor = `${horaLegible(servidor.hora_inicio)} – ${horaLegible(servidor.hora_fin)}`;
    return [
      { icono: '📝', etiqueta: 'Título', local: local.titulo ?? '—', servidor: servidor.titulo ?? '—', diferente: local.titulo !== servidor.titulo },
      { icono: '🗒️', etiqueta: 'Descripción', local: local.descripcion ?? '(sin descripción)', servidor: servidor.descripcion ?? '(sin descripción)', diferente: local.descripcion !== servidor.descripcion },
      { icono: '🎨', etiqueta: 'Color', local: local.hex_color, servidor: servidor.hex_color, diferente: local.hex_color !== servidor.hex_color, colorLocal: local.hex_color, colorServidor: servidor.hex_color },
      { icono: '🕐', etiqueta: 'Horario', local: horarioLocal, servidor: horarioServidor, diferente: horarioLocal !== horarioServidor },
      { icono: '🔁', etiqueta: 'Repetición', local: RECURRENCIA_LABELS[local.tipo_recurrencia] ?? local.tipo_recurrencia, servidor: RECURRENCIA_LABELS[servidor.tipo_recurrencia] ?? servidor.tipo_recurrencia, diferente: local.tipo_recurrencia !== servidor.tipo_recurrencia },
      { icono: '🗑️', etiqueta: 'Eliminado', local: local.deleted_at ? 'Sí' : 'No', servidor: servidor.deleted_at ? 'Sí' : 'No', diferente: !!local.deleted_at !== !!servidor.deleted_at },
    ].filter((f) => f.diferente); // solo mostramos lo que realmente hay que decidir
  }

  // event_exception
  const horarioLocal = `${horaLegible(local.nueva_hora_inicio)} – ${horaLegible(local.nueva_hora_fin)}`;
  const horarioServidor = `${horaLegible(servidor.nueva_hora_inicio)} – ${horaLegible(servidor.nueva_hora_fin)}`;
  return [
    { icono: '📝', etiqueta: 'Título', local: local.nuevo_titulo ?? '(sin cambio)', servidor: servidor.nuevo_titulo ?? '(sin cambio)', diferente: local.nuevo_titulo !== servidor.nuevo_titulo },
    { icono: '🎨', etiqueta: 'Color', local: local.nuevo_hex_color ?? '(sin cambio)', servidor: servidor.nuevo_hex_color ?? '(sin cambio)', diferente: local.nuevo_hex_color !== servidor.nuevo_hex_color, colorLocal: local.nuevo_hex_color ?? undefined, colorServidor: servidor.nuevo_hex_color ?? undefined },
    { icono: '🕐', etiqueta: 'Horario', local: horarioLocal, servidor: horarioServidor, diferente: horarioLocal !== horarioServidor },
    { icono: '🚫', etiqueta: 'Cancelado esta vez', local: local.is_cancelled ? 'Sí' : 'No', servidor: servidor.is_cancelled ? 'Sí' : 'No', diferente: !!local.is_cancelled !== !!servidor.is_cancelled },
  ].filter((f) => f.diferente);
}

function tituloEvento(c: ConflictoConDetalles): string {
  if (c.entity_type === 'cycle_log') {
    const fecha = c.datos_locales.period_start ?? c.datos_servidor.period_start;
    return `Ciclo — periodo del ${fecha}`;
  }
  return (
    c.datos_locales.titulo ??
    c.datos_locales.nuevo_titulo ??
    c.datos_servidor.titulo ??
    c.datos_servidor.nuevo_titulo ??
    'Evento'
  );
}

function TarjetaVersion({
  etiquetaDispositivo,
  timestamp,
  esOffline,
  esMasReciente,
  filas,
  ladoValor,
  onElegir,
  cargando,
}: {
  etiquetaDispositivo: string;
  timestamp: string;
  esOffline: boolean | null; // null = "servidor" (ya sincronizada, no aplica)
  esMasReciente: boolean;
  filas: Fila[];
  ladoValor: 'local' | 'servidor';
  onElegir: () => void;
  cargando: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col rounded-xl border border-gray-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-gray-800">{etiquetaDispositivo}</span>
        {esMasReciente && (
          <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-medium text-pink-600">
            Más reciente
          </span>
        )}
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
          {esOffline === null ? '☁️ En la nube' : esOffline ? '📴 Sin conexión' : '🌐 Con conexión'}
        </span>
      </div>

      <p className="mb-2 text-[10px] text-gray-400">
        {formatDistanceToNowStrict(utcToEcuador(timestamp), { addSuffix: true, locale: es })}
        {' · '}
        {format(utcToEcuador(timestamp), 'd MMM, HH:mm')} (hora Ecuador)
      </p>

      <div className="flex flex-1 flex-col gap-1.5">
        {filas.map((f) => {
          const valor = ladoValor === 'local' ? f.local : f.servidor;
          const color = ladoValor === 'local' ? f.colorLocal : f.colorServidor;
          return (
            <div key={f.etiqueta} className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1">
              <span className="text-xs">{f.icono}</span>
              <span className="text-[10px] font-medium text-gray-500">{f.etiqueta}:</span>
              {color && (
                <span
                  className="h-3 w-3 flex-shrink-0 rounded-full border border-black/10"
                  style={{ backgroundColor: color }}
                />
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={onElegir}
        disabled={cargando}
        className="mt-3 w-full rounded-lg bg-pink-500 py-2 text-xs font-semibold text-white hover:bg-pink-600 disabled:opacity-50"
      >
        ✓ Quedarme con esta versión
      </button>
    </div>
  );
}

export default function ConflictosModal({ onClose, onResuelto }: Props) {
  const [conflictos, setConflictos] = useState<ConflictoConDetalles[]>([]);
  const [cargando, setCargando] = useState(true);
  const [resolviendoId, setResolviendoId] = useState<string | null>(null);

  useEffect(() => {
    obtenerConflictosPendientes()
      .then(setConflictos)
      .finally(() => setCargando(false));
  }, []);

  async function handleElegir(conflicto: ConflictoConDetalles, eleccion: 'local' | 'servidor') {
    setResolviendoId(conflicto.id);
    try {
      await resolverConflicto(conflicto, eleccion);
      setConflictos((prev) => prev.filter((c) => c.id !== conflicto.id));
      onResuelto();
    } catch (err) {
      console.error('Error resolviendo conflicto:', err);
    } finally {
      setResolviendoId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-base font-semibold text-gray-800">
          Conflictos pendientes {conflictos.length > 0 && `(${conflictos.length})`}
        </h2>
        <p className="mb-4 text-xs text-gray-400">Elige con cuál versión te quieres quedar en cada caso.</p>

        {cargando && <p className="text-sm text-gray-400">Cargando...</p>}
        {!cargando && conflictos.length === 0 && (
          <p className="text-sm text-gray-400">No hay conflictos pendientes 🎉</p>
        )}

        <div className="flex flex-col gap-5">
          {conflictos.map((c) => {
            const filas = construirFilas(c.entity_type, c.datos_locales, c.datos_servidor);
            const localEsMasReciente = new Date(c.local_updated_at) > new Date(c.server_updated_at);

            return (
              <div key={c.id} className="rounded-2xl bg-gray-50 p-3">
                <p className="mb-2 px-1 text-sm font-semibold text-gray-700">📅 {tituloEvento(c)}</p>
                {filas.length === 0 && (
                  <p className="mb-2 rounded-lg bg-gray-100 px-2 py-1.5 text-[11px] text-gray-500">
                    No se detectaron diferencias visibles — cualquiera de las dos versiones es equivalente.
                  </p>
                )}
                <div className="flex gap-2">
                  <TarjetaVersion
                    etiquetaDispositivo={c.device_local?.label ?? 'Este dispositivo'}
                    timestamp={c.local_updated_at}
                    esOffline={c.local_origen_offline}
                    esMasReciente={localEsMasReciente}
                    filas={filas}
                    ladoValor="local"
                    onElegir={() => handleElegir(c, 'local')}
                    cargando={resolviendoId === c.id}
                  />
                  <TarjetaVersion
                    etiquetaDispositivo={c.device_servidor?.label ?? 'Otro dispositivo'}
                    timestamp={c.server_updated_at}
                    esOffline={null}
                    esMasReciente={!localEsMasReciente}
                    filas={filas}
                    ladoValor="servidor"
                    onElegir={() => handleElegir(c, 'servidor')}
                    cargando={resolviendoId === c.id}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={onClose} className="mt-5 w-full rounded-lg border border-gray-300 py-2 text-sm text-gray-600">
          Cerrar
        </button>
      </div>
    </div>
  );
}