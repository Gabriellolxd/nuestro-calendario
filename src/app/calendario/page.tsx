// src/app/calendario/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PerfilMenu from '@/components/PerfilMenu';
import { supabase } from '@/lib/supabase';
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
import { obtenerEventosLocal, obtenerExcepcionesLocal, descargarDesdeNube } from '@/lib/localData';
import { ensureDeviceRegistered } from '@/lib/device';
import { subirCambiosPendientes } from '@/lib/sync';
import ConflictosBadge from '@/components/ConflictosBadge';

const MAX_CHIPS_MES = 4;

type Vista = 'mes' | 'semana' | 'dia';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export default function CalendarioPage() {
  const [vista, setVista] = useState<Vista>('mes');
  // fechaAncla cumple doble función: (1) ancla para calcular qué mes/semana
  // mostrar en la grilla, y (2) el día exacto seleccionado por el usuario,
  // que se resalta en las vistas de mes y semana. Por eso navegarAFecha
  // ya NO la redondea a startOfMonth/startOfWeek: eso era lo que perdía
  // el día exacto elegido.
const [fechaAncla, setFechaAncla] = useState(ahoraEcuador());
  const [eventosBase, setEventosBase] = useState<EventoBase[]>([]);
  const [ocurrencias, setOcurrencias] = useState<Ocurrencia[]>([]);
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date | null>(null);
  const [ocurrenciaEditando, setOcurrenciaEditando] = useState<Ocurrencia | null>(null);
  const [horaDefault, setHoraDefault] = useState<{ inicio: string; fin: string } | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [detalleDia, setDetalleDia] = useState<{ fecha: Date; ocurrencias: Ocurrencia[] } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  // Selector de fecha personalizado (reemplaza el <input type="date"> nativo)
  const [mostrarSelectorFecha, setMostrarSelectorFecha] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.push('/login');
        return;
      }
      try {
        // Registra el dispositivo aunque la sesión ya venga restaurada
        // (no solo cuando el login se hace manualmente en /login).
        await ensureDeviceRegistered(data.session.user.id);
      } catch (err) {
        console.error('Error registrando dispositivo:', err);
      }
      setUserId(data.session.user.id);
    });
  }, [router]);

  const diasMes = getMonthGrid(fechaAncla);
  const diasSemana = getWeekGrid(fechaAncla);

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

  const cargarEventos = useCallback(async () => {
    if (!userId) return;

    const eventos = await obtenerEventosLocal(userId);
    setEventosBase(eventos);

    const ids = eventos.map((e) => e.id);
    const excepciones = await obtenerExcepcionesLocal(ids);

    setOcurrencias(proyectarEventos(eventos, excepciones, rangoInicio, rangoFin));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, rangoInicio.getTime(), rangoFin.getTime()]);

  useEffect(() => {
    cargarEventos();
  }, [cargarEventos]);

  // Motor de sincronización: sube lo pendiente (synced: 0) y luego
  // descarga los cambios de la nube. El pull ya protege (Fase 6) las
  // filas con synced: 0 que hayan quedado en conflicto sin resolver.
  const sincronizar = useCallback(async () => {
    if (!userId) return;
    try {
      await subirCambiosPendientes(userId);
    } catch (err) {
      console.error('Error subiendo cambios pendientes:', err);
    }
    try {
      await descargarDesdeNube(userId);
    } catch (err) {
      console.error('Error en descarga desde la nube:', err);
    }
    cargarEventos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    sincronizar();
  }, [sincronizar]);

  useEffect(() => {
    window.addEventListener('online', sincronizar);
    return () => window.removeEventListener('online', sincronizar);
  }, [sincronizar]);

  // Navega al día exacto elegido en el selector de fecha (o al presionar
  // "Ir a hoy"). getMonthGrid/getWeekGrid solo necesitan una fecha DENTRO
  // del mes/semana para armar la grilla correcta, así que no hace falta
  // (ni conviene) normalizar a startOfMonth/startOfWeek aquí: eso es justo
  // lo que hacía que se resaltara el primer día en vez del día elegido.
  function navegarAFecha(fechaSeleccionada: Date) {
    setFechaAncla(fechaSeleccionada);
  }

  function abrirModalParaCrear(dia: Date) {
    // Hora actual (Ecuador) en punto (redondeado, sin minutos)
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

  function tituloEncabezado(): string {
    if (vista === 'mes') return format(fechaAncla, 'MMMM yyyy', { locale: es });
    if (vista === 'semana') {
      const inicio = startOfWeek(fechaAncla, { weekStartsOn: 1 });
      const fin = endOfWeek(fechaAncla, { weekStartsOn: 1 });
      return `${format(inicio, 'd MMM')} – ${format(fin, 'd MMM yyyy')}`;
    }
    return format(fechaAncla, "EEEE d 'de' MMMM", { locale: es });
  }

  if (!userId) {
    return <p className="p-8 text-center text-gray-400">Cargando...</p>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* GRUPO ENCABEZADO PRINCIPAL FIJO CON SOMBRA */}
      <div className="sticky top-0 z-40 bg-white shadow-sm">
        {/* Encabezado con fecha clickeable que abre el selector de fecha personalizado */}
        <div className="relative flex items-center justify-between bg-white px-4 py-1">
          {/* 1. Espaciador invisible a la izquierda para equilibrar el menú de perfil de la derecha */}
          <div className="w-[40px]" aria-hidden="true"></div> 

          {/* 2. Contenedor central: agrupa las flechas y la fecha juntas */}
          <div className="flex items-center gap-3">
            <button onClick={irAnterior} className="rounded-full px-3 py-1 text-gray-500 hover:bg-gray-100">
              ←
            </button>

            <button
              onClick={() => setMostrarSelectorFecha(true)}
              className="text-center text-base font-semibold capitalize text-gray-800 hover:text-pink-500 transition-colors"
              title="Seleccionar fecha"
            >
              {tituloEncabezado()}
            </button>

            <button onClick={irSiguiente} className="rounded-full px-3 py-1 text-gray-500 hover:bg-gray-100">
              →
            </button>
          </div>

          {/* 3. Menú de perfil a la derecha */}
          <div className="flex items-center gap-2">
            <ConflictosBadge onResuelto={cargarEventos} />
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

        <div className="flex justify-center gap-1 bg-white px-4 pb-2">
          {(['dia', 'semana', 'mes'] as Vista[]).map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`rounded-full px-4 py-1 text-xs font-medium capitalize ${
                vista === v ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      
      {vista === 'mes' && (
        <VistaMes
          dias={diasMes}
          mesActual={fechaAncla}
          diaResaltado={fechaAncla}
          ocurrencias={ocurrencias}
          onCrear={abrirModalParaCrear}
          onEditar={abrirModalParaEditar}
          onDetalle={abrirDetalle}
        />
      )}

      {vista === 'semana' && (
        <VistaSemana
          dias={diasSemana}
          diaResaltado={fechaAncla}
          ocurrencias={ocurrencias}
          onSeleccionar={abrirModalParaEditar}
          onDetalle={(ocs) => abrirDetalle(ocs[0].hora_inicio, ocs)}
          onCrearHora={abrirModalParaCrearHora}
        />
      )}

      {vista === 'dia' && (
        <VistaDia
          fecha={fechaAncla}
          ocurrencias={ocurrencias}
          onSeleccionar={abrirModalParaEditar}
          onDetalle={(ocs) => abrirDetalle(ocs[0].hora_inicio, ocs)}
          onCrearHora={abrirModalParaCrearHora}
          onCambiarFecha={setFechaAncla}
        />
      )}

      <button
        onClick={() => abrirModalParaCrear(vista === 'mes' ? ahoraEcuador() : fechaAncla)}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-pink-500 text-2xl text-white shadow-lg hover:bg-pink-600"
        aria-label="Nuevo evento"
      >
        +
      </button>

      {detalleDia && (
        <DetalleDiaModal
          fecha={detalleDia.fecha}
          ocurrencias={detalleDia.ocurrencias}
          onSeleccionar={abrirModalParaEditar}
          onClose={() => setDetalleDia(null)}
        />
      )}

      {mostrarModal && diaSeleccionado && userId && (
        <EventoModal
          fecha={diaSeleccionado}
          userId={userId}
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

// ------------------------------------------------------------------
// Vista Mes: sin mezcla de colores por colisión de horario (esa lógica
// vive solo en Día/Semana vía TimelineColumna). Aquí cada evento se
// lista individualmente, ordenado por hora; solo se "acopla" en un
// contador cuando hay MÁS de 4 en el mismo día.
// ------------------------------------------------------------------
function VistaMes({
  dias,
  mesActual,
  diaResaltado,
  ocurrencias,
  onCrear,
  onEditar,
  onDetalle,
}: {
  dias: Date[];
  mesActual: Date;
  // Día exacto elegido por el usuario (vía el selector de fecha o al navegar):
  // se resalta distinto del día de hoy.
  diaResaltado: Date;
  ocurrencias: Ocurrencia[];
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
      <div className="grid grid-cols-7 gap-px bg-white px-1 pt-2 text-center text-xs font-medium text-gray-400">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200 px-1">
        {dias.map((dia) => {
          const ocDia = ocurrenciasDelDia(dia);
          const hayOverflow = ocDia.length > MAX_CHIPS_MES;
          const chipsVisibles = hayOverflow ? ocDia.slice(0, MAX_CHIPS_MES - 1) : ocDia;
          const ocultos = hayOverflow ? ocDia.slice(MAX_CHIPS_MES - 1) : [];

          const dentroDelMes = isSameMonth(dia, mesActual);
          const esHoy = isSameDay(dia, ahoraEcuador());
          const esSeleccionado = isSameDay(dia, diaResaltado);

          return (
            <div
              key={dia.toISOString()}
              onClick={() => onCrear(dia)}
              className={`flex min-h-[96px] cursor-pointer flex-col bg-white p-1 ${
                dentroDelMes ? '' : 'opacity-40'
              } ${esSeleccionado && !esHoy ? 'bg-pink-50/70' : ''}`}
            >
              <span
                className={`self-start text-xs font-medium ${
                  esHoy
                    ? 'flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white'
                    : esSeleccionado
                    ? 'flex h-5 w-5 items-center justify-center rounded-full border-2 border-pink-400 font-semibold text-pink-600'
                    : 'text-gray-600'
                }`}
              >
                {format(dia, 'd')}
              </span>

              <div className="mt-0.5 flex flex-1 flex-col gap-0.5">
                {chipsVisibles.map((oc) => (
                  <div
                    key={`${oc.eventoId}-${oc.fecha.toISOString()}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditar(oc);
                    }}
                    className="flex flex-1 min-h-0 items-center overflow-hidden rounded px-1 text-[9px] font-medium text-white"
                    style={{ backgroundColor: oc.hex_color }}
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
                    className="flex flex-1 min-h-0 items-center justify-center rounded bg-gray-200 text-[9px] font-medium text-gray-600"
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