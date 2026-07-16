// src/components/TimelineColumna.tsx
'use client';

import { useEffect, useState } from 'react';
import { toZonedTime } from 'date-fns-tz';
import { APP_TIMEZONE } from '@/lib/dates';
import type { Ocurrencia } from '@/lib/recurrence';
import { construirSegmentos } from '@/lib/blocks';

const ALTURA_HORA = 56;
const ALTURA_TOTAL = ALTURA_HORA * 24;
const ALTURA_MINIMA_TITULO = 16; // debajo de esto no cabe texto legible

// Cada cuánto se refresca la línea de "hora actual" (ms)
const INTERVALO_ACTUALIZACION_MS = 30_000;

type Props = {
  ocurrencias: Ocurrencia[];
  // Indica si esta columna corresponde al día de hoy: solo entonces
  // se dibuja la línea de hora actual.
  esHoy: boolean;
  onSeleccionar: (oc: Ocurrencia) => void;
  onDetalle: (ocurrencias: Ocurrencia[]) => void;
  onCrearHora: (hora: number) => void;
};

function minutosDesdeMedianoche(ms: number): number {
  const fecha = new Date(ms);
  return fecha.getHours() * 60 + fecha.getMinutes();
}

export default function TimelineColumna({ ocurrencias, esHoy, onSeleccionar, onDetalle, onCrearHora }: Props) {
  const segmentos = construirSegmentos(ocurrencias);

  // Hora actual en la zona horaria de Ecuador (America/Guayaquil),
  // independientemente de en qué zona horaria esté el dispositivo del usuario.
  const [ahoraEcuador, setAhoraEcuador] = useState(() => toZonedTime(new Date(), APP_TIMEZONE));

  useEffect(() => {
    if (!esHoy) return;
    const intervalo = setInterval(() => {
      setAhoraEcuador(toZonedTime(new Date(), APP_TIMEZONE));
    }, INTERVALO_ACTUALIZACION_MS);
    return () => clearInterval(intervalo);
  }, [esHoy]);

  const topHoraActual = esHoy
    ? ((ahoraEcuador.getHours() * 60 + ahoraEcuador.getMinutes()) / 60) * ALTURA_HORA
    : null;

  function manejarClickFondo(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hora = Math.min(23, Math.max(0, Math.floor(y / ALTURA_HORA)));
    onCrearHora(hora);
  }

  return (
    <div
      className="relative cursor-pointer border-l border-gray-100"
      style={{ height: ALTURA_TOTAL }}
      onClick={manejarClickFondo}
    >
      {Array.from({ length: 24 }, (_, h) => (
        <div
          key={h}
          className="pointer-events-none absolute left-0 right-0 border-t border-gray-100"
          style={{ top: h * ALTURA_HORA }}
        />
      ))}

      {segmentos.map((seg) => {
        const top = (minutosDesdeMedianoche(seg.inicioMs) / 60) * ALTURA_HORA;
        const alturaCruda = ((seg.finMs - seg.inicioMs) / 60000 / 60) * ALTURA_HORA;
        const altura = Math.max(alturaCruda, 6);
        const soloUno = seg.ocurrencias.length === 1;

        return (
          <div
            key={seg.id}
            onClick={(e) => {
              e.stopPropagation();
              soloUno ? onSeleccionar(seg.ocurrencias[0]) : onDetalle(seg.ocurrencias);
            }}
            className="absolute left-1 right-1 flex cursor-pointer items-center justify-between overflow-hidden rounded-sm px-1.5 text-[10px] font-medium text-white shadow-sm"
            style={{ top, height: altura, backgroundColor: seg.color }}
          >
            {altura >= ALTURA_MINIMA_TITULO && (
              <span className="truncate">
                {soloUno ? seg.ocurrencias[0].titulo : `${seg.ocurrencias.length} eventos`}
              </span>
            )}
            {!soloUno && (
              <span className="flex-shrink-0 rounded-full bg-black/30 px-1">
                {seg.ocurrencias.length}
              </span>
            )}
          </div>
        );
      })}

      {/* Línea de hora actual en tiempo real (solo en la columna de hoy) */}
      {esHoy && topHoraActual !== null && (
        <div
          className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
          style={{ top: topHoraActual }}
        >
          <div className="-ml-[3px] h-[7px] w-[7px] flex-shrink-0 rounded-full bg-red-500" />
          <div className="h-[2px] flex-1 bg-red-500" />
        </div>
      )}
    </div>
  );
}

export { ALTURA_HORA, ALTURA_TOTAL };