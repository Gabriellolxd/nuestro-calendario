// src/app/(app)/ciclo/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Droplet, Sparkles, Egg, CalendarHeart, Sprout, Heart, Moon } from 'lucide-react';
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
import { calcularFaseDia, NOMBRES_FASE, type FaseDia, type CycleLogInput } from '@/lib/cyclePrediction';
import type { CycleLogLocal, CyclePredictionCacheLocal } from '@/lib/db';
import CicloDiaModal from '@/components/CicloDiaModal';
import PantallaCarga from '@/components/PantallaCarga';
import { playSound } from '@/lib/soundManager';

function fechaAISO(dia: Date): string {
  return format(dia, 'yyyy-MM-dd');
}

function fechaLegible(iso: string, patron = 'd MMM yyyy'): string {
  return format(new Date(iso + 'T00:00:00'), patron, { locale: es });
}

export default function CicloPage() {
  const { calendarioActivo, cargando: cargandoContexto, primerSyncCompleto } = useCalendarioActivo();
  const ownerId = calendarioActivo?.ownerId ?? null;
  const esEspectador = calendarioActivo?.rol === 'espectador';
  const router = useRouter();

  const [fechaAncla, setFechaAncla] = useState(ahoraEcuador());
  const [logs, setLogs] = useState<CycleLogLocal[]>([]);
  const [prediccion, setPrediccion] = useState<CyclePredictionCacheLocal | undefined>(undefined);
  const [diaEditando, setDiaEditando] = useState<CycleLogLocal | null>(null);
  const [procesando, setProcesando] = useState(false);

  // color rojo "cozy" para menstruación (no toca globals.css)
  const ROJO_PERIODO = '#c2453a';
  const ROJO_PERIODO_SOMBRA = '#93342b';

  const FASE_ICONO: Record<string, { Icono: typeof Droplet; color: string }> = {
    periodo: { Icono: Droplet, color: ROJO_PERIODO },
    periodo_predicho: { Icono: Droplet, color: ROJO_PERIODO },
    folicular: { Icono: Sprout, color: 'var(--color-sage)' },
    ventana_fertil: { Icono: Heart, color: 'var(--color-gold)' },
    ovulacion: { Icono: Egg, color: 'var(--color-gold)' },
    fase_lutea: { Icono: Moon, color: 'var(--color-wood)' },
  };

  const cargarTodo = useCallback(async () => {
    if (!ownerId) return;
    const [logsLocal, cache] = await Promise.all([
      obtenerCycleLogsLocal(ownerId),
      obtenerPrediccionCacheLocal(ownerId),
    ]);
    setLogs(logsLocal);
    setPrediccion(cache);
  }, [ownerId]);

  const { syncTick } = useCalendarioActivo();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial y tras cada ciclo de sync
    cargarTodo();
  }, [cargarTodo, syncTick]);

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
      playSound('periodo');
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
    playSound('eliminar');
    const deviceId = getDeviceId();
    await eliminarCycleLogLocal(diaEditando.id, deviceId);
    await recalcularYGuardarPrediccion(ownerId);
    await cargarTodo();
    subirCambiosPendientes().catch((err) => console.error('Error sincronizando:', err));
  }

  if (cargandoContexto || !ownerId || !primerSyncCompleto) {
    return <PantallaCarga />;
  }

  const dias = getMonthGrid(fechaAncla);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-24 textura-cozy">
      <div className="sticky top-0 z-40 border-b-[3px] border-[var(--color-wood-dark)] bg-[var(--color-bg-elevated)]">
        <div className="flex items-center gap-3 px-4 py-2">
          <button
            onClick={() => router.push('/calendario')}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"
          >
            <ChevronLeft size={18} />
          </button>
          <h1 className="font-display flex flex-1 items-center gap-1.5 text-base font-semibold text-[var(--color-text)]">
            <Droplet size={16} className="text-[var(--color-primary)]" />
            Ciclo {calendarioActivo?.rol !== 'propio' && `— ${calendarioActivo?.label}`}
          </h1>
        </div>

        <div className="relative flex items-center justify-center px-4 pb-3">
          <div className="placa flex items-center gap-2 px-2 py-1.5">
            <button
              onClick={() => setFechaAncla((f) => subMonths(f, 1))}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--color-text-inverse)]/80 hover:text-[var(--color-text-inverse)]"
            >
              <ChevronLeft size={16} strokeWidth={3} />
            </button>
            <span className="font-display px-1 text-sm font-semibold capitalize tracking-wide">
              {format(fechaAncla, 'MMMM yyyy', { locale: es })}
            </span>
            <button
              onClick={() => setFechaAncla((f) => addMonths(f, 1))}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--color-text-inverse)]/80 hover:text-[var(--color-text-inverse)]"
            >
              <ChevronRight size={16} strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-3 py-3">
        {esEspectador && (
          <p className="mb-3 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
            👁 Modo solo lectura — no puedes marcar ni editar días de este calendario.
          </p>
        )}

        {prediccion ? (
          <div className="panel-madera mb-4 p-4">
            <p className="font-hand mb-2 text-lg font-bold text-[var(--color-text-muted)]">Predicción actual</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[var(--color-primary-soft)] p-2.5">
                <p className="mb-0.5 flex items-center gap-1 text-[10px] font-medium text-[var(--color-wood-dark)]">
                  <Droplet size={11} /> Próximo periodo
                </p>
                <p className="font-display text-sm font-bold text-[var(--color-primary)]">
                  {fechaLegible(prediccion.next_period_predicted, 'd MMM')}
                </p>
              </div>
              <div className="rounded-xl bg-[var(--color-gold-soft)] p-2.5">
                <p className="mb-0.5 flex items-center gap-1 text-[10px] font-medium text-[var(--color-wood-dark)]">
                  <Egg size={11} /> Ovulación
                </p>
                <p className="font-display text-sm font-bold text-[var(--color-wood-dark)]">
                  {fechaLegible(prediccion.ovulation_predicted, 'd MMM')}
                </p>
              </div>
              <div className="rounded-xl bg-[var(--color-surface)] p-2.5">
                <p className="mb-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">Duración promedio</p>
                <p className="font-display text-sm font-bold text-[var(--color-text)]">
                  {Math.round(prediccion.avg_cycle_length)} días
                </p>
              </div>
              <div className="rounded-xl bg-[var(--color-sage-soft)] p-2.5">
                <p className="mb-0.5 flex items-center gap-1 text-[10px] font-medium text-[var(--color-wood-dark)]">
                  <CalendarHeart size={11} /> Ventana fértil
                </p>
                <p className="font-display text-xs font-bold text-[var(--color-wood-dark)]">
                  {fechaLegible(prediccion.fertile_window_start, 'd MMM')} – {fechaLegible(prediccion.fertile_window_end, 'd MMM')}
                </p>
              </div>
            </div>
            {prediccion.es_estimado && (
              <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-[var(--color-surface)] px-2.5 py-1.5 text-[11px] text-[var(--color-text-muted)]">
                <Sparkles size={12} />
                Estimado con un promedio general — marca un periodo más para calcularlo con tus propios datos.
              </p>
            )}
            {prediccion.ventana_ensanchada && (
              <p className="mt-2 rounded-lg bg-[var(--color-gold-soft)] px-2.5 py-1.5 text-[11px] text-[var(--color-wood-dark)]">
                Ciclo irregular detectado — la ventana fértil se ensanchó automáticamente.
              </p>
            )}
          </div>
        ) : (
          <div className="panel-madera mb-4 p-6 text-center">
            <Droplet size={28} className="mx-auto mb-2 text-[var(--color-primary-soft)]" />
            <p className="font-hand text-lg text-[var(--color-text-muted)]">
              Toca el primer día de tu periodo en el calendario para empezar.
            </p>
          </div>
        )}

        <div className="panel-madera overflow-hidden">
          <div className="grid grid-cols-7 border-b-2 border-[var(--color-border)] bg-[var(--color-surface)] text-center text-[10px] font-bold uppercase text-[var(--color-wood-dark)]">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
              <div key={i} className="py-1.5">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 p-2">
            {dias.map((dia) => {
              const dentroDelMes = isSameMonth(dia, fechaAncla);
              const esHoy = isSameDay(dia, ahoraEcuador());
              const logDia = logExistenteEnDia(dia);
              const fase = fasePorDia(dia);
              const visualFase = fase ? FASE_ICONO[fase.fase] : null;

              let claseCirculo = 'text-[var(--color-text)] hover:bg-[var(--color-surface)]';
              let estiloCirculo: React.CSSProperties = {};
              if (logDia) {
                claseCirculo = 'font-bold text-[var(--color-text-inverse)]';
                estiloCirculo = { backgroundColor: ROJO_PERIODO, boxShadow: `0 2px 0 ${ROJO_PERIODO_SOMBRA}` };
              }

              return (
                <button
                  key={dia.toISOString()}
                  data-no-sfx
                  onClick={() => handleClickDia(dia)}
                  disabled={esEspectador}
                  title={fase ? NOMBRES_FASE[fase.fase] : undefined}
                  style={estiloCirculo}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-full text-xs transition-transform active:scale-90 ${
                    dentroDelMes ? '' : 'opacity-30'
                  } ${esHoy && !logDia ? 'ring-2 ring-[var(--color-gold)]' : ''} ${claseCirculo}`}
                >
                  <span>{format(dia, 'd')}</span>
                  {!logDia && visualFase && (
                    <span className="absolute -bottom-0.5">
                      <visualFase.Icono size={9} style={{ color: visualFase.color }} strokeWidth={2.5} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 border-t-2 border-dashed border-[var(--color-border)] px-3 py-2.5 text-[10px] text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1">
              <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ROJO_PERIODO }} />
              Registrado
            </span>
            <span className="flex items-center gap-1"><Droplet size={11} style={{ color: ROJO_PERIODO }} /> Predicho</span>
            <span className="flex items-center gap-1"><Heart size={11} className="text-[var(--color-gold)]" /> Fértil</span>
            <span className="flex items-center gap-1"><Egg size={11} className="text-[var(--color-gold)]" /> Ovulación</span>
            <span className="flex items-center gap-1"><Sprout size={11} className="text-[var(--color-sage)]" /> Folicular</span>
            <span className="flex items-center gap-1"><Moon size={11} className="text-[var(--color-wood)]" /> Lútea</span>
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