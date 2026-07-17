// src/components/EventoModal.tsx
'use client';
import { useState, useRef } from 'react';
import {
  crearEventoLocal,
  actualizarEventoLocal,
  eliminarEventoLocal,
  upsertExcepcionLocal,
} from '@/lib/localData';
import { ecuadorToUtc } from '@/lib/dates';
import { getDeviceId } from '@/lib/device';
import { PALETA_COLORES } from '@/lib/colors';
import { format } from 'date-fns';
import type { EventoBase, Ocurrencia, TipoRecurrencia } from '@/lib/recurrence';
import { subirCambiosPendientes } from '@/lib/sync';

type ModoEdicion = {
  ocurrencia: Ocurrencia;
  eventoOriginal: EventoBase;
};

type Props = {
  fecha: Date;
  userId: string;
  edicion?: ModoEdicion;
  horaInicioDefault?: string; // ej. "14:00", solo aplica al crear
  horaFinDefault?: string; // ej. "15:00", solo aplica al crear
  onClose: () => void;
  onGuardado: () => void;
};

export default function EventoModal({
  fecha,
  userId,
  edicion,
  horaInicioDefault,
  horaFinDefault,
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
        await crearEventoLocal({
          id: crypto.randomUUID(),
          user_id: userId,
          titulo,
          descripcion: descripcion || null,
          hex_color: color,
          hora_inicio: nuevaHoraInicioUtc,
          hora_fin: nuevaHoraFinUtc,
          tipo_recurrencia: tipoRecurrencia,
          regla_recurrencia: null,
          device_id: deviceId,
          change_uuid: crypto.randomUUID(),
          client_updated_at: ahora,
          deleted_at: null,
        });
      } else if (!esRecurrente || alcance === 'serie') {
        await actualizarEventoLocal(edicion.eventoOriginal.id, {
          titulo,
          descripcion: descripcion || null,
          hex_color: color,
          hora_inicio: nuevaHoraInicioUtc,
          hora_fin: nuevaHoraFinUtc,
          tipo_recurrencia: tipoRecurrencia,
          device_id: deviceId,
          change_uuid: crypto.randomUUID(),
          client_updated_at: ahora,
        });
      } else {
        const fechaClave = format(edicion.ocurrencia.fecha, 'yyyy-MM-dd');
        await upsertExcepcionLocal({
          id: edicion.ocurrencia.exceptionId ?? crypto.randomUUID(),
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
      }

      onGuardado();
      onClose();
      subirCambiosPendientes(userId).catch((err) => console.error('Error sincronizando:', err));
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
      } else {
        const fechaClave = format(edicion.ocurrencia.fecha, 'yyyy-MM-dd');
        await upsertExcepcionLocal({
          id: edicion.ocurrencia.exceptionId ?? crypto.randomUUID(),
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
      }

      onGuardado();
      onClose();
      subirCambiosPendientes(userId).catch((err) => console.error('Error sincronizando:', err));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el evento.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">
          {esEdicion ? 'Editar evento' : 'Nuevo evento'} — {format(fecha, 'd MMM yyyy')}
        </h2>

        <form onSubmit={handleGuardar} className="space-y-3">
          <input
            type="text"
            placeholder="Título"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />

          <textarea
            placeholder="Descripción (opcional)"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            rows={2}
          />

          <div>
            <label className="text-xs text-gray-500">Fecha</label>
            <input
              type="date"
              value={fechaEditable}
              onChange={(e) => setFechaEditable(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500">Inicio</label>
              <input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500">Fin</label>
              <input
                type="time"
                value={horaFin}
                onChange={(e) => setHoraFin(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Color</label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {PALETA_COLORES.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  className={`h-8 w-8 rounded-full transition-transform active:scale-95 ${
                    color.toLowerCase() === c.hex.toLowerCase() ? 'ring-2 ring-offset-2 ring-gray-800 scale-105' : ''
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
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform active:scale-95 ${
                    !esColorPredefinido ? 'ring-2 ring-offset-2 ring-gray-800 scale-105' : ''
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
            <label className="text-xs text-gray-500">Repetir</label>
            <select
              value={tipoRecurrencia}
              onChange={(e) => setTipoRecurrencia(e.target.value as TipoRecurrencia)}
              disabled={esRecurrente && alcance === 'unica'}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100"
            >
              <option value="none">No se repite</option>
              <option value="daily">Cada día</option>
              <option value="weekly">Cada semana</option>
              <option value="monthly">Cada mes</option>
              <option value="yearly">Cada año</option>
            </select>
          </div>

          {esRecurrente && (
            <div className="rounded-lg bg-pink-50 p-3">
              <p className="mb-2 text-xs font-medium text-gray-600">
                Este evento se repite. ¿Qué quieres modificar?
              </p>
              <div className="flex gap-4 text-sm text-gray-700">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={alcance === 'unica'} onChange={() => setAlcance('unica')} />
                  Solo esta fecha
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={alcance === 'serie'} onChange={() => setAlcance('serie')} />
                  Toda la serie
                </label>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 py-2 text-gray-600"
            >
              Cancelar
            </button>
            {esEdicion && (
              <button
                type="button"
                onClick={handleEliminar}
                disabled={cargando}
                className="flex-1 rounded-lg border border-red-300 py-2 text-red-500 hover:bg-red-50 disabled:opacity-50"
              >
                Eliminar
              </button>
            )}
            <button
              type="submit"
              disabled={cargando}
              className="flex-1 rounded-lg bg-pink-500 py-2 font-medium text-white hover:bg-pink-600 disabled:opacity-50"
            >
              {cargando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}