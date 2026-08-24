// src/app/(app)/calendario/page.tsx
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Palette, StickyNote as StickyNoteIcon, Droplet, Sprout, Heart, Egg, Moon } from 'lucide-react';
import PerfilMenu from '@/components/PerfilMenu';
import SelectorCalendario from '@/components/SelectorCalendario';
import { useCalendarioActivo } from '@/lib/CalendarioActivoContext';
import {
  getMonthGrid,
  getWeekGrid,
  isSameMonth,
  isSameDay,
  format,
  es,
  startOfWeek,
  endOfWeek,
  ahoraEcuador,
} from '@/lib/dates';
import EventoModal from '@/components/EventoModal';
import DetalleDiaModal from '@/components/DetalleDiaModal';
import VistaDia from '@/components/VistaDia';
import VistaSemana from '@/components/VistaSemana';
import SelectorFechaModal from '@/components/SelectorFechaModal';
import { addMonths, subMonths, addDays, addWeeks, subWeeks, startOfDay, endOfDay } from 'date-fns';
import { proyectarEventos, type EventoBase, type Excepcion, type Ocurrencia } from '@/lib/recurrence';
import {
  obtenerEventosLocal,
  obtenerExcepcionesLocal,
  obtenerCycleLogsLocal,
  obtenerPrediccionCacheLocal,
} from '@/lib/localData';
import ConflictosBadge from '@/components/ConflictosBadge';
import { calcularFaseDia, type FaseDia } from '@/lib/cyclePrediction';
import type { CycleLogLocal, CyclePredictionCacheLocal } from '@/lib/db';
import { solicitarPermisoNotificaciones, reprogramarNotificacionesDeUsuario } from '@/lib/notifications';import SyncStatusButton from '@/components/SyncStatusButton';
import DecorationLayer from '@/components/DecorationLayer';
import StickerLibraryModal from '@/components/StickerLibraryModal';
import { obtenerStickersLocal, colocarStickerLocal, subirStickersPendientes, descargarStickersDesdeNube } from '@/lib/stickersLocal';
import { crearNotaLocal, subirNotasPendientes, descargarNotasDesdeNube } from '@/lib/notesLocal';
import type { StickerAssetLocal } from '@/lib/db';
import StickerBook from '@/components/StickerBook';
import NotesStack from '@/components/NotesStack';
import MusicButton from '@/components/MusicButton';
import { registrarStickersPredefinidos } from '@/lib/stickersLocal';
import { playSound } from '@/lib/soundManager';
import PantallaCarga from '@/components/PantallaCarga';
import BannerSinConexion from '@/components/BannerSinConexion';

const MAX_CHIPS_MES = 4;

type Vista = 'mes' | 'semana' | 'dia';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// Representación visual de cada fase del ciclo — ícono SVG + color del
// sistema de diseño, usado tanto para el indicador en la celda del día
// como para el título accesible.
const FASE_VISUAL: Record<string, { Icono: typeof Droplet; color: string; nombre: string }> = {
  periodo: { Icono: Droplet, color: 'var(--color-primary)', nombre: 'Periodo' },
  periodo_predicho: { Icono: Droplet, color: 'var(--color-primary-soft)', nombre: 'Periodo (predicho)' },
  folicular: { Icono: Sprout, color: 'var(--color-sage)', nombre: 'Fase folicular' },
  ventana_fertil: { Icono: Heart, color: 'var(--color-gold)', nombre: 'Ventana fértil' },
  ovulacion: { Icono: Egg, color: 'var(--color-gold)', nombre: 'Ovulación' },
  fase_lutea: { Icono: Moon, color: 'var(--color-wood)', nombre: 'Fase lútea' },
};

export default function CalendarioPage() {
  const { userId, calendarioActivo, cargando: cargandoContexto, opciones, primerSyncCompleto } = useCalendarioActivo();  const ownerId = calendarioActivo?.ownerId ?? null;
  const esEspectador = calendarioActivo?.rol === 'espectador';

  const [vista, setVista] = useState<Vista>('mes');
  const [fechaAncla, setFechaAncla] = useState(ahoraEcuador());
  const [diaSeleccionadoUsuario, setDiaSeleccionadoUsuario] = useState<Date | null>(null);
  const [eventosBase, setEventosBase] = useState<EventoBase[]>([]);
  const [ocurrencias, setOcurrencias] = useState<Ocurrencia[]>([]);
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date | null>(null);
  const [ocurrenciaEditando, setOcurrenciaEditando] = useState<Ocurrencia | null>(null);
  const [horaDefault, setHoraDefault] = useState<{ inicio: string; fin: string } | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [detalleDia, setDetalleDia] = useState<{ fecha: Date; ocurrencias: Ocurrencia[] } | null>(null);
  const [cycleLogs, setCycleLogs] = useState<CycleLogLocal[]>([]);
  const [prediccionCiclo, setPrediccionCiclo] = useState<CyclePredictionCacheLocal | undefined>(undefined);
  const [mostrarSelectorFecha, setMostrarSelectorFecha] = useState(false);
  const [arrastreTray, setArrastreTray] = useState<{ assetId: string; x: number; y: number } | null>(null);

  const [modoDecorar, setModoDecorar] = useState(false);
  const [mostrarLibreriaStickers, setMostrarLibreriaStickers] = useState(false);
  const [stickerAssets, setStickerAssets] = useState<StickerAssetLocal[]>([]);
  const [decoTick, setDecoTick] = useState(0);

  const diasMes = getMonthGrid(fechaAncla);
  const diasSemana = getWeekGrid(fechaAncla);
  const inicioSwipe = useRef<{ x: number; y: number } | null>(null);
  
  const [arrastreDecoActivo, setArrastreDecoActivo] = useState(false);

  let rangoInicio: Date;
  let rangoFin: Date;
  if (vista === 'mes') {
    rangoInicio = startOfDay(diasMes[0]);
    rangoFin = endOfDay(diasMes[diasMes.length - 1]);
  } else if (vista === 'semana') {
    rangoInicio = startOfDay(diasSemana[0]);
    rangoFin = endOfDay(diasSemana[diasSemana.length - 1]);
  } else {
    rangoInicio = startOfDay(fechaAncla);
    rangoFin = endOfDay(fechaAncla);
  }

  const rangoInicioMs = rangoInicio.getTime();
  const rangoFinMs = rangoFin.getTime();

  const cargarEventos = useCallback(async () => {
    if (!ownerId) return;
    const eventos = await obtenerEventosLocal(ownerId);
    setEventosBase(eventos);
    const ids = eventos.map((e) => e.id);
    const excepciones = await obtenerExcepcionesLocal(ids);
    setOcurrencias(proyectarEventos(eventos, excepciones, rangoInicio, rangoFin));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, rangoInicioMs, rangoFinMs]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial al montar/cambiar de calendario
    cargarEventos();
  }, [cargarEventos]);

  const cargarCiclo = useCallback(async () => {
    if (!ownerId) return;
    const [logs, cache] = await Promise.all([
      obtenerCycleLogsLocal(ownerId),
      obtenerPrediccionCacheLocal(ownerId),
    ]);
    setCycleLogs(logs);
    setPrediccionCiclo(cache);
  }, [ownerId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del ciclo al montar/cambiar de calendario
    cargarCiclo();
  }, [cargarCiclo]);

  const { syncTick } = useCalendarioActivo();

  useEffect(() => {
    if (!ownerId) return;

    async function recargarTrasSync() {
      cargarEventos();
      cargarCiclo();
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga datos locales después de cada ciclo de sync
    recargarTrasSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncTick, ownerId]);

  // Recalcula notificaciones de TODOS los calendarios a los que tienes
  // acceso (propio + compartidos), no solo el que tienes abierto ahora.
  useEffect(() => {
    if (!userId || opciones.length === 0) return;
    reprogramarNotificacionesDeUsuario(opciones).catch((err) =>
      console.error('Error reprogramando notificaciones:', err)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncTick, userId, opciones.length]);

  useEffect(() => {
    if (!ownerId || !userId) return;
    const ids = [userId, ownerId].filter((v, i, arr) => arr.indexOf(v) === i);
    registrarStickersPredefinidos(userId).then(() => {
      obtenerStickersLocal(ids).then(setStickerAssets);
    });
    descargarStickersDesdeNube(ids, ownerId);
    descargarNotasDesdeNube(ownerId);
  }, [userId, ownerId, syncTick]);

  useEffect(() => {
    solicitarPermisoNotificaciones();
  }, []);

  function navegarAFecha(fechaSeleccionada: Date) {
    setFechaAncla(fechaSeleccionada);
    setDiaSeleccionadoUsuario(fechaSeleccionada);
  }

  function abrirModalParaCrear(dia: Date) {
    if (esEspectador) return;
    const horaActual = ahoraEcuador().getHours();
    const horaFinNum = Math.min(horaActual + 1, 23);
    setDiaSeleccionado(dia);
    setOcurrenciaEditando(null);
    setHoraDefault({
      inicio: `${pad(horaActual)}:00`,
      fin: horaActual === 23 ? '23:59' : `${pad(horaFinNum)}:00`,
    });
    setMostrarModal(true);
  }

  function abrirModalParaCrearHora(dia: Date, hora: number) {
    if (esEspectador) return;
    const horaFinNum = Math.min(hora + 1, 23);
    setDiaSeleccionado(dia);
    setOcurrenciaEditando(null);
    setHoraDefault({
      inicio: `${pad(hora)}:00`,
      fin: hora === 23 ? '23:59' : `${pad(horaFinNum)}:00`,
    });
    setMostrarModal(true);
  }

  function abrirModalParaEditar(oc: Ocurrencia) {
    playSound('click');
    setDiaSeleccionado(oc.hora_inicio);
    setOcurrenciaEditando(oc);
    setHoraDefault(null);
    setMostrarModal(true);
    setDetalleDia(null);
  }

  function abrirDetalle(fecha: Date, ocs: Ocurrencia[]) {
    setDetalleDia({ fecha, ocurrencias: ocs });
  }

  const eventoOriginalDeEdicion = ocurrenciaEditando
    ? eventosBase.find((ev) => ev.id === ocurrenciaEditando.eventoId) ?? null
    : null;

  function irAnterior() {
    if (vista === 'mes') setFechaAncla((f) => subMonths(f, 1));
    else if (vista === 'semana') setFechaAncla((f) => subWeeks(f, 1));
    else setFechaAncla((f) => addDays(f, -1));
  }

  function irSiguiente() {
    if (vista === 'mes') setFechaAncla((f) => addMonths(f, 1));
    else if (vista === 'semana') setFechaAncla((f) => addWeeks(f, 1));
    else setFechaAncla((f) => addDays(f, 1));
  }

  const UMBRAL_SWIPE_PX = 50;
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeTransicion, setSwipeTransicion] = useState(false);
  const arrastreHorizontalRef = useRef(false);
  const decoDragRef = useRef(false);

  function manejarSwipeInicio(e: React.TouchEvent) {
    if (decoDragRef.current) return;
    const t = e.touches[0];
    inicioSwipe.current = { x: t.clientX, y: t.clientY };
    arrastreHorizontalRef.current = false;
  }

  function manejarSwipeMove(e: React.TouchEvent) {
    if (decoDragRef.current || !inicioSwipe.current) return;
    const t = e.touches[0];
    const dx = t.clientX - inicioSwipe.current.x;
    const dy = t.clientY - inicioSwipe.current.y;
    if (!arrastreHorizontalRef.current) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) arrastreHorizontalRef.current = true;
      else return;
    }
    setSwipeOffset(dx);
  }

  function manejarSwipeFin(e: React.TouchEvent) {
    if (decoDragRef.current) { inicioSwipe.current = null; return; }
    if (!inicioSwipe.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - inicioSwipe.current.x;
    inicioSwipe.current = null;
    arrastreHorizontalRef.current = false;

    if (Math.abs(dx) < UMBRAL_SWIPE_PX) {
      setSwipeTransicion(true);
      setSwipeOffset(0);
      setTimeout(() => setSwipeTransicion(false), 200);
      return;
    }

    const ancho = window.innerWidth;
    setSwipeTransicion(true);
    setSwipeOffset(dx > 0 ? ancho : -ancho);
    setTimeout(() => {
      if (dx > 0) irAnterior();
      else irSiguiente();
      setSwipeTransicion(false);
      setSwipeOffset(dx > 0 ? -40 : 40);
      requestAnimationFrame(() => {
        setSwipeTransicion(true);
        setSwipeOffset(0);
      });
    }, 200);
  }

  function tituloEncabezado(): string {
    if (vista === 'mes') return format(fechaAncla, 'MMMM yyyy', { locale: es });
    if (vista === 'semana') {
      const inicio = startOfWeek(fechaAncla, { weekStartsOn: 1 });
      const fin = endOfWeek(fechaAncla, { weekStartsOn: 1 });
      return `${format(inicio, 'd MMM')} – ${format(fin, 'd MMM yyyy')}`;
    }
    return format(fechaAncla, "EEEE d 'de' MMMM", { locale: es });
  }

  const prediccionParaFases = prediccionCiclo
    ? {
        avgCycleLength: prediccionCiclo.avg_cycle_length,
        avgPeriodDuration: prediccionCiclo.avg_period_duration,
        lutealLength: prediccionCiclo.luteal_length,
        ventanaEnsanchada: prediccionCiclo.ventana_ensanchada,
      }
    : null;

  const logsParaFases = cycleLogs.map((l) => ({
    period_start: l.period_start,
    period_end: l.period_end,
    luteal_length_manual: l.luteal_length_manual,
  }));

  function obtenerFasePorFecha(dia: Date): FaseDia {
    return calcularFaseDia(format(dia, 'yyyy-MM-dd'), logsParaFases, prediccionParaFases);
  }

  if (cargandoContexto || !userId || !ownerId || !primerSyncCompleto) {
    return <PantallaCarga />;
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-24 textura-cozy">
      <BannerSinConexion />
      <div className="sticky top-0 z-40 border-b-[3px] border-[var(--color-wood-dark)] bg-[var(--color-bg-elevated)]">
        <div className="relative flex items-center justify-between px-4 py-2">
          <MusicButton />

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 placa flex items-center gap-2 px-2 py-1.5">
            <button
              onClick={irAnterior}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--color-text-inverse)]/80 hover:text-[var(--color-text-inverse)]"
              aria-label="Anterior"
            >
              <ChevronLeft size={16} strokeWidth={3} />
            </button>
            <button
              onClick={() => setMostrarSelectorFecha(true)}
              className="flex items-center gap-2 px-2"
              title="Seleccionar fecha"
            >
              <span className="font-display text-sm font-semibold capitalize tracking-wide">
                {tituloEncabezado()}
              </span>
            </button>
            <button
              onClick={irSiguiente}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--color-text-inverse)]/80 hover:text-[var(--color-text-inverse)]"
              aria-label="Siguiente"
            >
              <ChevronRight size={16} strokeWidth={3} />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <SyncStatusButton />
            <ConflictosBadge
              onResuelto={() => {
                cargarEventos();
                cargarCiclo();
              }}
            />
            <PerfilMenu />
          </div>
        </div>

        {mostrarSelectorFecha && (
          <SelectorFechaModal
            fechaSeleccionada={fechaAncla}
            vista={vista}
            onSeleccionar={navegarAFecha}
            onCerrar={() => setMostrarSelectorFecha(false)}
          />
        )}

        <div className="flex justify-center gap-1 px-4 pb-3 pt-1">
          {(['dia', 'semana', 'mes'] as Vista[]).map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`cinta px-5 py-1.5 text-xs font-semibold capitalize transition-all hover:-translate-y-0.5 hover:brightness-95 ${
                vista === v
                  ? 'bg-[var(--color-primary)] text-[var(--color-text-inverse)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <SelectorCalendario />
      </div>

      <div
        className="px-2 pt-2"
        onTouchStart={manejarSwipeInicio}
        onTouchMove={manejarSwipeMove}
        onTouchEnd={manejarSwipeFin}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: swipeTransicion ? 'transform 0.2s ease-out' : 'none',
        }}
      >
        {vista === 'mes' && ownerId && (
          <div className="relative">
            <div className="panel-madera overflow-hidden">
              <VistaMes
                dias={diasMes}
                mesActual={fechaAncla}
                diaResaltado={diaSeleccionadoUsuario}
                ocurrencias={ocurrencias}
                fasePorDia={obtenerFasePorFecha}
                onCrear={modoDecorar ? () => {} : abrirModalParaCrear}
                onEditar={abrirModalParaEditar}
                onDetalle={abrirDetalle}
              />
            </div>
            <DecorationLayer
              calendarioOwnerId={ownerId}
              colocadoPorUserId={userId!}
              targetMes={format(fechaAncla, 'yyyy-MM')}
              editable={!esEspectador}
              stickerAssets={stickerAssets}
              refreshTick={decoTick}
              arrastreDesdeTray={arrastreTray}
              onArrastreDesdeTrayTerminado={() => {
                setArrastreTray(null);
                setDecoTick((t) => t + 1);
              }}
              onArrastreActivoChange={setArrastreDecoActivo}
              decoDragRef={decoDragRef}
            />
          </div>
        )}

        {vista === 'semana' && (
          <div className="panel-madera overflow-hidden">
            <VistaSemana
              dias={diasSemana}
              diaResaltado={diaSeleccionadoUsuario}
              ocurrencias={ocurrencias}
              onSeleccionar={abrirModalParaEditar}
              onDetalle={(ocs) => abrirDetalle(ocs[0].hora_inicio, ocs)}
              onCrearHora={abrirModalParaCrearHora}
            />
          </div>
        )}

        {vista === 'dia' && (
          <div className="panel-madera overflow-hidden">
            <VistaDia
              fecha={fechaAncla}
              ocurrencias={ocurrencias}
              onSeleccionar={abrirModalParaEditar}
              onDetalle={(ocs) => abrirDetalle(ocs[0].hora_inicio, ocs)}
              onCrearHora={abrirModalParaCrearHora}
              onCambiarFecha={setFechaAncla}
            />
          </div>
        )}
      </div>

      {!esEspectador && (
        <button
          onClick={() => abrirModalParaCrear(vista === 'mes' ? ahoraEcuador() : fechaAncla)}
          className="boton-tallado fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary)] text-[var(--color-text-inverse)]"          aria-label="Nuevo evento"
        >
          <Plus size={26} strokeWidth={2.5} />
        </button>
      )}

      {!esEspectador && vista === 'mes' && (
        <>
          <StickerBook
            stickers={stickerAssets}
            oculto={arrastreDecoActivo}
            onAbrirLibreria={() => setMostrarLibreriaStickers(true)}
            onIniciarArrastreDesdeTray={(assetId, x, y) => setArrastreTray({ assetId, x, y })}
          />
          <NotesStack
            oculto={arrastreDecoActivo}
            onCrearNota={async () => {
              if (!userId || !ownerId) return;
              await crearNotaLocal({
                calendarioOwnerId: ownerId,
                colocadoPorUserId: userId,
                targetType: 'mes',
                targetMes: format(fechaAncla, 'yyyy-MM'),
              });
              setDecoTick((t) => t + 1);
              subirNotasPendientes().catch((err) => console.error(err));
            }}
          />
        </>
      )}

      {mostrarLibreriaStickers && userId && ownerId && (
        <StickerLibraryModal
          userId={userId}
          idsCalendariosVisibles={[userId, ownerId].filter((v, i, arr) => arr.indexOf(v) === i)}
          onClose={() => setMostrarLibreriaStickers(false)}
          onElegirParaColocar={async (assetId) => {
            await colocarStickerLocal({
              calendarioOwnerId: ownerId,
              colocadoPorUserId: userId,
              stickerAssetId: assetId,
              targetType: 'mes',
              targetMes: format(fechaAncla, 'yyyy-MM'),
            });
            setDecoTick((t) => t + 1);
            subirStickersPendientes().catch((err) => console.error(err));
            setMostrarLibreriaStickers(false);
          }}
        />
      )}

      {detalleDia && (
        <DetalleDiaModal
          fecha={detalleDia.fecha}
          ocurrencias={detalleDia.ocurrencias}
          onSeleccionar={abrirModalParaEditar}
          onClose={() => setDetalleDia(null)}
        />
      )}

      {mostrarModal && diaSeleccionado && (
        <EventoModal
          fecha={diaSeleccionado}
          userId={ownerId}
          soloLectura={esEspectador}
          edicion={
            ocurrenciaEditando && eventoOriginalDeEdicion
              ? { ocurrencia: ocurrenciaEditando, eventoOriginal: eventoOriginalDeEdicion }
              : undefined
          }
          horaInicioDefault={horaDefault?.inicio}
          horaFinDefault={horaDefault?.fin}
          onClose={() => setMostrarModal(false)}
          onGuardado={cargarEventos}
        />
      )}
    </div>
  );
}

function VistaMes({
  dias,
  mesActual,
  diaResaltado,
  ocurrencias,
  fasePorDia,
  onCrear,
  onEditar,
  onDetalle,
}: {
  dias: Date[];
  mesActual: Date;
  diaResaltado: Date | null;
  ocurrencias: Ocurrencia[];
  fasePorDia: (dia: Date) => FaseDia;
  onCrear: (dia: Date) => void;
  onEditar: (oc: Ocurrencia) => void;
  onDetalle: (fecha: Date, ocs: Ocurrencia[]) => void;
}) {
  function ocurrenciasDelDia(dia: Date): Ocurrencia[] {
    return ocurrencias
      .filter((oc) => isSameDay(oc.hora_inicio, dia))
      .sort((a, b) => a.hora_inicio.getTime() - b.hora_inicio.getTime());
  }

  return (
    <>
      <div className="grid grid-cols-7 border-b-2 border-[var(--color-border)] bg-[var(--color-surface)] text-center text-[11px] font-bold uppercase tracking-wide text-[var(--color-wood-dark)]">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {dias.map((dia, i) => {
          const ocDia = ocurrenciasDelDia(dia);
          const hayOverflow = ocDia.length > MAX_CHIPS_MES;
          const chipsVisibles = hayOverflow ? ocDia.slice(0, MAX_CHIPS_MES - 1) : ocDia;
          const ocultos = hayOverflow ? ocDia.slice(MAX_CHIPS_MES - 1) : [];

          const dentroDelMes = isSameMonth(dia, mesActual);
          const esHoy = isSameDay(dia, ahoraEcuador());
          const esSeleccionado = diaResaltado ? isSameDay(dia, diaResaltado) : false;
          const fase = fasePorDia(dia);
          const visualFase = fase ? FASE_VISUAL[fase.fase] : null;

          return (
            <div
              key={dia.toISOString()}
              onClick={() => onCrear(dia)}
              className={`relative flex min-h-[100px] cursor-pointer flex-col border-b border-r border-[var(--color-border)]/60 p-1.5 transition-colors ${
                dentroDelMes ? 'bg-[var(--color-bg-elevated)]' : 'bg-[var(--color-surface)]/40 opacity-50'
              } ${esSeleccionado && !esHoy ? 'bg-[var(--color-primary-soft)]' : ''} ${(i + 1) % 7 === 0 ? 'border-r-0' : ''}`}
            >
              {esHoy && (
                <div className="pointer-events-none absolute inset-1 rounded-lg bg-[var(--color-gold-soft)]" style={{ boxShadow: '0 0 12px 2px rgba(217,164,65,0.35)' }} />
              )}

              <div className="relative z-10 flex items-center justify-between">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    esHoy
                      ? 'bg-[var(--color-primary)] text-[var(--color-text-inverse)]'
                      : esSeleccionado
                      ? 'border-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'text-[var(--color-text)]'
                  }`}
                >
                  {format(dia, 'd')}
                </span>

                {visualFase && (
                  <span
                    title={visualFase.nombre}
                    className="insignia-icono h-5 w-5"
                    style={{ borderColor: visualFase.color, backgroundColor: `${visualFase.color}22` }}
                  >
                    <visualFase.Icono size={11} style={{ color: visualFase.color }} strokeWidth={2.5} />
                  </span>
                )}
              </div>

              <div className="relative z-10 mt-1 flex flex-1 flex-col gap-0.5">
                {chipsVisibles.map((oc, idx) => (
                  <div
                    key={`${oc.eventoId}-${oc.fecha.toISOString()}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditar(oc);
                    }}
                    className="flex flex-1 min-h-0 items-center overflow-hidden rounded-md px-1.5 text-[9px] font-semibold text-white shadow-sm"
                    style={{ backgroundColor: oc.hex_color, transform: `rotate(${idx % 2 === 0 ? -0.6 : 0.6}deg)` }}
                  >
                    <span className="truncate">{oc.titulo}</span>
                  </div>
                ))}

                {hayOverflow && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onDetalle(dia, ocultos);
                    }}
                    className="flex flex-1 min-h-0 items-center justify-center rounded-md bg-[var(--color-surface)] text-[9px] font-semibold text-[var(--color-text-muted)]"
                  >
                    +{ocultos.length} más
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}