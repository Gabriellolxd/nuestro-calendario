// src/app/(app)/ciclo/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCalendarioActivo } from '@/lib/CalendarioActivoContext';
import { getDeviceId } from '@/lib/device';
import {
  obtenerCycleLogsLocal,
  crearCycleLogLocal,
  actualizarCycleLogLocal,
  eliminarCycleLogLocal,
  obtenerPrediccionCacheLocal,
  recalcularYGuardarPrediccion,
} from '@/lib/localData';
import { subirCambiosPendientes } from '@/lib/sync';
import { getMonthGrid, isSameMonth, isSameDay, format, es, ahoraEcuador } from '@/lib/dates';
import { addMonths, subMonths } from 'date-fns';
import { calcularFaseDia, ICONOS_FASE, NOMBRES_FASE, type FaseDia, type CycleLogInput } from '@/lib/cyclePrediction';
import type { CycleLogLocal, CyclePredictionCacheLocal } from '@/lib/db';
import CicloDiaModal from '@/components/CicloDiaModal';

function fechaAISO(dia: Date): string {
  return format(dia, 'yyyy-MM-dd');
}

function fechaLegible(iso: string, patron = 'd MMM yyyy'): string {
  return format(new Date(iso + 'T00:00:00'), patron, { locale: es });
}

export default function CicloPage() {
  const { calendarioActivo, cargando: cargandoContexto } = useCalendarioActivo();
  const ownerId = calendarioActivo?.ownerId ?? null;
  const esEspectador = calendarioActivo?.rol === 'espectador';
  const router = useRouter();

  const [fechaAncla, setFechaAncla] = useState(ahoraEcuador());
  const [logs, setLogs] = useState<CycleLogLocal[]>([]);
  const [prediccion, setPrediccion] = useState<CyclePredictionCacheLocal | undefined>(undefined);
  const [diaEditando, setDiaEditando] = useState<CycleLogLocal | null>(null);
  const [procesando, setProcesando] = useState(false);

  const cargarTodo = useCallback(async () => {
    if (!ownerId) return;
    const [logsLocal, cache] = await Promise.all([
      obtenerCycleLogsLocal(ownerId),
      obtenerPrediccionCacheLocal(ownerId),
    ]);
    setLogs(logsLocal);
    setPrediccion(cache);
  }, [ownerId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial al montar/cambiar de calendario
    cargarTodo();
  }, [cargarTodo]);

  const logsInput: CycleLogInput[] = logs.map((l) => ({
    period_start: l.period_start,
    period_end: l.period_end,
    luteal_length_manual: l.luteal_length_manual,
  }));

  const prediccionParaFases = prediccion
    ? {
        avgCycleLength: prediccion.avg_cycle_length,
        lutealLength: prediccion.luteal_length,
        ventanaEnsanchada: prediccion.ventana_ensanchada,
        avgPeriodDuration: prediccion.avg_period_duration,
      }
    : null;

  function fasePorDia(dia: Date): FaseDia {
    return calcularFaseDia(fechaAISO(dia), logsInput, prediccionParaFases);
  }

  function logExistenteEnDia(dia: Date): CycleLogLocal | undefined {
    const str = fechaAISO(dia);
    return logs.find((l) => str >= l.period_start && str <= (l.period_end ?? l.period_start));
  }

  async function handleClickDia(dia: Date) {
    if (esEspectador || procesando || !ownerId) return;
    const existente = logExistenteEnDia(dia);
    if (existente) {
      setDiaEditando(existente);
      return;
    }

    setProcesando(true);
    try {
      const deviceId = getDeviceId();
      const ahora = new Date().toISOString();
      const fechaStr = fechaAISO(dia);
      await crearCycleLogLocal({
        id: crypto.randomUUID(),
        user_id: ownerId,
        period_start: fechaStr,
        period_end: fechaStr,
        luteal_length_manual: null,
        symptoms: [],
        notes: null,
        device_id: deviceId,
        change_uuid: crypto.randomUUID(),
        client_updated_at: ahora,
        deleted_at: null,
      });
      await recalcularYGuardarPrediccion(ownerId);
      await cargarTodo();
      subirCambiosPendientes().catch((err) => console.error('Error sincronizando:', err));
    } finally {
      setProcesando(false);
    }
  }

  async function handleGuardarDia(cambios: { symptoms: string[]; notes: string | null; luteal_length_manual: number | null }) {
    if (!diaEditando || !ownerId) return;
    const deviceId = getDeviceId();
    const ahora = new Date().toISOString();
    await actualizarCycleLogLocal(diaEditando.id, {
      ...cambios,
      device_id: deviceId,
      change_uuid: crypto.randomUUID(),
      client_updated_at: ahora,
    });
    await recalcularYGuardarPrediccion(ownerId);
    await cargarTodo();
    subirCambiosPendientes().catch((err) => console.error('Error sincronizando:', err));
  }

  async function handleEliminarDia() {
    if (!diaEditando || !ownerId) return;
    const deviceId = getDeviceId();
    await eliminarCycleLogLocal(diaEditando.id, deviceId);
    await recalcularYGuardarPrediccion(ownerId);
    await cargarTodo();
    subirCambiosPendientes().catch((err) => console.error('Error sincronizando:', err));
  }

  if (cargandoContexto || !ownerId) {
    return <p className="p-8 text-center text-gray-400">Cargando...</p>;
  }

  const dias = getMonthGrid(fechaAncla);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.push('/calendario')} className="rounded-full px-2 py-1 text-gray-500 hover:bg-gray-100">
            ←
          </button>
          <h1 className="flex-1 text-base font-semibold text-gray-800">
            🩸 Ciclo menstrual {calendarioActivo?.rol !== 'propio' && `— ${calendarioActivo?.label}`}
          </h1>
        </div>
        <div className="flex items-center justify-between px-4 pb-2">
          <button onClick={() => setFechaAncla((f) => subMonths(f, 1))} className="rounded-full px-3 py-1 text-gray-500 hover:bg-gray-100">
            ←
          </button>
          <span className="text-sm font-semibold capitalize text-gray-800">{format(fechaAncla, 'MMMM yyyy', { locale: es })}</span>
          <button onClick={() => setFechaAncla((f) => addMonths(f, 1))} className="rounded-full px-3 py-1 text-gray-500 hover:bg-gray-100">
            →
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 py-3">
        {esEspectador && (
          <p className="mb-3 rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-500">
            👁️ Modo solo lectura — no puedes marcar ni editar días de este calendario.
          </p>
        )}

        {prediccion ? (
          <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-gray-700">Predicción actual</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] text-gray-400">Próximo periodo</p>
                <p className="font-medium text-pink-600">{fechaLegible(prediccion.next_period_predicted, 'd MMM')}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400">Ovulación estimada</p>
                <p className="font-medium text-amber-600">{fechaLegible(prediccion.ovulation_predicted, 'd MMM')}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400">Duración promedio</p>
                <p className="font-medium text-gray-700">{Math.round(prediccion.avg_cycle_length)} días</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400">Ventana fértil</p>
                <p className="font-medium text-gray-700">
                  {fechaLegible(prediccion.fertile_window_start, 'd MMM')} – {fechaLegible(prediccion.fertile_window_end, 'd MMM')}
                </p>
              </div>
            </div>
            {prediccion.es_estimado && (
              <p className="mt-3 rounded-lg bg-blue-50 px-2 py-1.5 text-[11px] text-blue-700">
                📊 Estimado con un promedio general — marca un periodo más para calcularlo con tus propios datos.
              </p>
            )}
            {prediccion.ventana_ensanchada && (
              <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
                Ciclo irregular detectado — la ventana fértil se ensanchó automáticamente.
              </p>
            )}
          </div>
        ) : (
          <div className="mb-4 rounded-2xl bg-white p-4 text-center shadow-sm">
            <p className="text-sm text-gray-500">Toca el primer día de tu periodo en el calendario para empezar.</p>
          </div>
        )}

        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-gray-400">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {dias.map((dia) => {
              const dentroDelMes = isSameMonth(dia, fechaAncla);
              const esHoy = isSameDay(dia, ahoraEcuador());
              const logDia = logExistenteEnDia(dia);
              const fase = fasePorDia(dia);

              let claseCirculo = 'text-gray-700 hover:bg-gray-100';
              if (logDia) claseCirculo = 'bg-pink-500 text-white font-semibold';

              return (
                <button
                  key={dia.toISOString()}
                  onClick={() => handleClickDia(dia)}
                  disabled={esEspectador}
                  title={fase ? NOMBRES_FASE[fase.fase] : undefined}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-full text-xs transition-colors ${
                    dentroDelMes ? '' : 'opacity-30'
                  } ${esHoy && !logDia ? 'ring-2 ring-pink-400' : ''} ${claseCirculo}`}
                >
                  <span>{format(dia, 'd')}</span>
                  {!logDia && fase && <span className="absolute -bottom-0.5 text-[9px]">{ICONOS_FASE[fase.fase]}</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-gray-500">
            <span>🩸 Registrado</span>
            <span>{ICONOS_FASE.periodo_predicho} Predicho</span>
            <span>{ICONOS_FASE.ventana_fertil} Fértil</span>
            <span>{ICONOS_FASE.ovulacion} Ovulación</span>
          </div>
        </div>
      </div>

      {diaEditando && (
        <CicloDiaModal
          log={diaEditando}
          onClose={() => setDiaEditando(null)}
          onGuardar={handleGuardarDia}
          onEliminar={handleEliminarDia}
        />
      )}
    </div>
  );
}