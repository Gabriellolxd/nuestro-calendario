// src/components/EventoModal.tsx
'use client';
import { useState, useRef } from 'react';
import { ecuadorToUtc } from '@/lib/dates';
import { getDeviceId } from '@/lib/device';
import { PALETA_COLORES } from '@/lib/colors';
import { format } from 'date-fns';
import { X, Trash2, Repeat, Bell, StickyNote } from 'lucide-react';
import type { EventoBase, Ocurrencia, TipoRecurrencia } from '@/lib/recurrence';
import {
  crearEventoLocal,
  actualizarEventoLocal,
  eliminarEventoLocal,
  upsertExcepcionLocal,
} from '@/lib/localData';
import { subirCambiosPendientes } from '@/lib/sync';
import {
  programarNotificacionEvento,
  cancelarNotificacionEvento,
  programarNotificacionExcepcion,
  cancelarNotificacionExcepcion,
} from '@/lib/notifications';

type ModoEdicion = {
  ocurrencia: Ocurrencia;
  eventoOriginal: EventoBase;
};

type Props = {
  fecha: Date;
  userId: string;
  edicion?: ModoEdicion;
  horaInicioDefault?: string;
  horaFinDefault?: string;
  soloLectura?: boolean;
  onClose: () => void;
  onGuardado: () => void;
};

export default function EventoModal({
  fecha,
  userId,
  edicion,
  horaInicioDefault,
  horaFinDefault,
  soloLectura = false,
  onClose,
  onGuardado,
}: Props) {
  const esEdicion = !!edicion;
  const esRecurrente = edicion ? edicion.eventoOriginal.tipo_recurrencia !== 'none' : false;

  const [titulo, setTitulo] = useState(edicion?.ocurrencia.titulo ?? '');
  const [descripcion, setDescripcion] = useState(edicion?.eventoOriginal.descripcion ?? '');
  const [fechaEditable, setFechaEditable] = useState(
    format(edicion?.ocurrencia.fecha ?? fecha, 'yyyy-MM-dd')
  );
  const [horaInicio, setHoraInicio] = useState(
    edicion ? format(edicion.ocurrencia.hora_inicio, 'HH:mm') : horaInicioDefault ?? '09:00'
  );
  const [horaFin, setHoraFin] = useState(
    edicion ? format(edicion.ocurrencia.hora_fin, 'HH:mm') : horaFinDefault ?? '10:00'
  );
  const [color, setColor] = useState(edicion?.ocurrencia.hex_color ?? PALETA_COLORES[0].hex);
  const [tipoRecurrencia, setTipoRecurrencia] = useState<TipoRecurrencia>(
    edicion?.eventoOriginal.tipo_recurrencia ?? 'none'
  );
  const [minutosAviso, setMinutosAviso] = useState(edicion?.eventoOriginal.minutos_aviso ?? 5);
  const [alcance, setAlcance] = useState<'unica' | 'serie'>('unica');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const colorInputRef = useRef<HTMLInputElement>(null);
  const esColorPredefinido = PALETA_COLORES.some((c) => c.hex.toLowerCase() === color.toLowerCase());

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (horaFin <= horaInicio) {
      setError('La hora de fin debe ser después de la hora de inicio.');
      return;
    }

    setCargando(true);
    try {
      const deviceId = getDeviceId();
      const ahora = new Date().toISOString();
      const nuevaHoraInicioUtc = ecuadorToUtc(fechaEditable, horaInicio);
      const nuevaHoraFinUtc = ecuadorToUtc(fechaEditable, horaFin);

      if (!edicion) {
        const nuevoId = crypto.randomUUID();
        await crearEventoLocal({
          id: nuevoId,
          user_id: userId,
          titulo,
          descripcion: descripcion || null,
          hex_color: color,
          hora_inicio: nuevaHoraInicioUtc,
          hora_fin: nuevaHoraFinUtc,
          tipo_recurrencia: tipoRecurrencia,
          regla_recurrencia: null,
          minutos_aviso: minutosAviso,
          device_id: deviceId,
          change_uuid: crypto.randomUUID(),
          client_updated_at: ahora,
          deleted_at: null,
        });
        await programarNotificacionEvento({
          id: nuevoId,
          titulo,
          descripcion: descripcion || null,
          hex_color: color,
          hora_inicio: nuevaHoraInicioUtc,
          hora_fin: nuevaHoraFinUtc,
          tipo_recurrencia: tipoRecurrencia,
          minutos_aviso: minutosAviso,
        });
      } else if (!esRecurrente || alcance === 'serie') {
        await actualizarEventoLocal(edicion.eventoOriginal.id, {
          titulo,
          descripcion: descripcion || null,
          hex_color: color,
          hora_inicio: nuevaHoraInicioUtc,
          hora_fin: nuevaHoraFinUtc,
          tipo_recurrencia: tipoRecurrencia,
          minutos_aviso: minutosAviso,
          device_id: deviceId,
          change_uuid: crypto.randomUUID(),
          client_updated_at: ahora,
        });
        await programarNotificacionEvento({
          id: edicion.eventoOriginal.id,
          titulo,
          descripcion: descripcion || null,
          hex_color: color,
          hora_inicio: nuevaHoraInicioUtc,
          hora_fin: nuevaHoraFinUtc,
          tipo_recurrencia: tipoRecurrencia,
          minutos_aviso: minutosAviso,
        });
      } else {
        const fechaClave = format(edicion.ocurrencia.fecha, 'yyyy-MM-dd');
        const excepcionId = edicion.ocurrencia.exceptionId ?? crypto.randomUUID();

        await upsertExcepcionLocal({
          id: excepcionId,
          event_base_id: edicion.eventoOriginal.id,
          fecha_excepcion: fechaClave,
          nuevo_titulo: titulo,
          nuevo_hex_color: color,
          nueva_hora_inicio: nuevaHoraInicioUtc,
          nueva_hora_fin: nuevaHoraFinUtc,
          is_cancelled: false,
          device_id: deviceId,
          change_uuid: crypto.randomUUID(),
          client_updated_at: ahora,
          deleted_at: null,
        });

        await programarNotificacionExcepcion(
          {
            id: excepcionId,
            event_base_id: edicion.eventoOriginal.id,
            fecha_excepcion: fechaClave,
            nuevo_titulo: titulo,
            nuevo_hex_color: color,
            nueva_hora_inicio: nuevaHoraInicioUtc,
            nueva_hora_fin: nuevaHoraFinUtc,
            is_cancelled: false,
          },
          edicion.eventoOriginal
        );
      }

      onGuardado();
      onClose();
      subirCambiosPendientes().catch((err) => console.error('Error sincronizando:', err));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el evento.');
    } finally {
      setCargando(false);
    }
  }

  async function handleEliminar() {
    if (!edicion) return;
    setError('');
    setCargando(true);
    try {
      const deviceId = getDeviceId();
      const ahora = new Date().toISOString();

      if (!esRecurrente || alcance === 'serie') {
        await eliminarEventoLocal(edicion.eventoOriginal.id, deviceId);
        await cancelarNotificacionEvento(edicion.eventoOriginal.id);
      } else {
        const fechaClave = format(edicion.ocurrencia.fecha, 'yyyy-MM-dd');
        const excepcionId = edicion.ocurrencia.exceptionId ?? crypto.randomUUID();

        await upsertExcepcionLocal({
          id: excepcionId,
          event_base_id: edicion.eventoOriginal.id,
          fecha_excepcion: fechaClave,
          nuevo_titulo: null,
          nuevo_hex_color: null,
          nueva_hora_inicio: null,
          nueva_hora_fin: null,
          is_cancelled: true,
          device_id: deviceId,
          change_uuid: crypto.randomUUID(),
          client_updated_at: ahora,
          deleted_at: null,
        });

        await cancelarNotificacionExcepcion(excepcionId);
      }

      onGuardado();
      onClose();
      subirCambiosPendientes().catch((err) => console.error('Error sincronizando:', err));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el evento.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-wood-dark)]/50 px-4">
      <div className="panel-madera flex max-h-[90vh] w-full max-w-md animar-entrada flex-col p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-[var(--color-text)]">
            {esEdicion ? 'Editar evento' : 'Nuevo evento'}
          </h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
        <p className="font-hand -mt-3 mb-4 text-base text-[var(--color-text-muted)]">
          {format(fecha, 'd MMM yyyy')}
        </p>

        <form onSubmit={handleGuardar} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <fieldset disabled={soloLectura} className="space-y-3.5">
              <input
                type="text"
                placeholder="Título"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
                className="w-full rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
              />

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)]">
                  <StickyNote size={13} />
                  Nota del evento
                </label>
                <textarea
                  placeholder="Escribe algo sobre este evento..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                  rows={2}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Fecha</label>
                <input
                  type="date"
                  value={fechaEditable}
                  onChange={(e) => setFechaEditable(e.target.value)}
                  className="w-full rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Inicio</label>
                  <input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    className="w-full rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Fin</label>
                  <input
                    type="time"
                    value={horaFin}
                    onChange={(e) => setHoraFin(e.target.value)}
                    className="w-full rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Color</label>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {PALETA_COLORES.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setColor(c.hex)}
                      className={`h-8 w-8 rounded-full border-2 border-black/10 transition-transform active:scale-95 ${
                        color.toLowerCase() === c.hex.toLowerCase() ? 'ring-2 ring-offset-2 ring-[var(--color-primary)] scale-105' : ''
                      }`}
                      style={{ backgroundColor: c.hex }}
                      aria-label={c.nombre}
                    />
                  ))}

                  <div className="relative h-8 w-8">
                    <input
                      ref={colorInputRef}
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                    <button
                      type="button"
                      onClick={() => colorInputRef.current?.click()}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-black/10 transition-transform active:scale-95 ${
                        !esColorPredefinido ? 'ring-2 ring-offset-2 ring-[var(--color-primary)] scale-105' : ''
                      }`}
                      style={{
                        background: esColorPredefinido
                          ? 'conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)'
                          : color,
                      }}
                      aria-label="Color personalizado"
                    >
                      {!esColorPredefinido && <span className="h-2 w-2 rounded-full bg-white shadow-sm" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)]">
                  <Repeat size={13} />
                  Repetir
                </label>
                <select
                  value={tipoRecurrencia}
                  onChange={(e) => setTipoRecurrencia(e.target.value as TipoRecurrencia)}
                  disabled={esRecurrente && alcance === 'unica'}
                  className="w-full rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
                >
                  <option value="none">No se repite</option>
                  <option value="daily">Cada día</option>
                  <option value="weekly">Cada semana</option>
                  <option value="monthly">Cada mes</option>
                  <option value="yearly">Cada año</option>
                </select>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)]">
                  <Bell size={13} />
                  Avisar antes
                </label>
                <select
                  value={minutosAviso}
                  onChange={(e) => setMinutosAviso(Number(e.target.value))}
                  className="w-full rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                >
                  <option value={0}>Al momento del evento</option>
                  <option value={5}>5 minutos antes</option>
                  <option value={10}>10 minutos antes</option>
                  <option value={30}>30 minutos antes</option>
                  <option value={60}>1 hora antes</option>
                  <option value={1440}>1 día antes</option>
                </select>
              </div>

              {esRecurrente && (
                <div className="rounded-xl border-2 border-dashed border-[var(--color-gold)] bg-[var(--color-gold-soft)] p-3">
                  <p className="mb-2 text-xs font-medium text-[var(--color-wood-dark)]">
                    Este evento se repite. ¿Qué quieres modificar?
                  </p>
                  <div className="flex gap-4 text-sm text-[var(--color-text)]">
                    <label className="flex items-center gap-1.5">
                      <input type="radio" checked={alcance === 'unica'} onChange={() => setAlcance('unica')} />
                      Solo esta fecha
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="radio" checked={alcance === 'serie'} onChange={() => setAlcance('serie')} />
                      Toda la serie
                    </label>
                  </div>
                </div>
              )}
            </fieldset>

            {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}

            {soloLectura && (
              <p className="mt-3 rounded-xl bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
                👁 Modo solo lectura — no tienes permiso de edición sobre este calendario.
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-shrink-0 gap-2 border-t-2 border-[var(--color-border)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border-2 border-[var(--color-border)] py-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"
            >
              {soloLectura ? 'Cerrar' : 'Cancelar'}
            </button>
            {!soloLectura && esEdicion && (
              <button
                type="button"
                onClick={handleEliminar}
                disabled={cargando}
                className="flex items-center justify-center rounded-xl border-2 border-[var(--color-danger)]/40 px-4 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 disabled:opacity-50"
                aria-label="Eliminar"
              >
                <Trash2 size={16} />
              </button>
            )}
            {!soloLectura && (
              <button
                type="submit"
                disabled={cargando}
                className="boton-tallado flex-1 rounded-xl bg-[var(--color-primary)] py-2 font-semibold text-[var(--color-text-inverse)] disabled:opacity-50"
              >
                {cargando ? 'Guardando...' : 'Guardar'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}