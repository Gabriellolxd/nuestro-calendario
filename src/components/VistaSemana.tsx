// src/components/VistaSemana.tsx
'use client';

import { format, es, isSameDay } from '@/lib/dates';
import type { Ocurrencia } from '@/lib/recurrence';
import TimelineColumna, { ALTURA_HORA } from './TimelineColumna';

type Props = {
  dias: Date[];
  // Día actualmente seleccionado/anclado (el que se eligió en el selector
  // de fecha o al navegar): se resalta distinto del día de hoy.
  diaResaltado: Date;
  ocurrencias: Ocurrencia[];
  onSeleccionar: (oc: Ocurrencia) => void;
  onDetalle: (ocurrencias: Ocurrencia[]) => void;
  onCrearHora: (dia: Date, hora: number) => void;
};

export default function VistaSemana({
  dias,
  diaResaltado,
  ocurrencias,
  onSeleccionar,
  onDetalle,
  onCrearHora,
}: Props) {
  const hoy = new Date();

  return (
    <div className="flex bg-white">
      <div className="w-14 flex-shrink-0">
        <div className="h-10" />
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={h}
            className="pr-2 text-right text-[10px] text-gray-400"
            style={{ height: ALTURA_HORA }}
          >
            {String(h).padStart(2, '0')}:00
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7">
        {dias.map((dia) => {
          const ocDia = ocurrencias.filter((oc) => isSameDay(oc.hora_inicio, dia));
          const esHoy = isSameDay(dia, hoy);
          const esSeleccionado = isSameDay(dia, diaResaltado);

          return (
            <div
              key={dia.toISOString()}
              className={`border-l border-gray-100 ${
                esSeleccionado && !esHoy ? 'bg-pink-50/60' : ''
              }`}
            >
              <div className="flex h-10 flex-col items-center justify-center text-xs text-gray-500">
                <span className="capitalize">{format(dia, 'EEE', { locale: es })}</span>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                    esHoy
                      ? 'bg-pink-500 text-white'
                      : esSeleccionado
                      ? 'border-2 border-pink-400 font-semibold text-pink-600'
                      : 'text-gray-700'
                  }`}
                >
                  {format(dia, 'd')}
                </span>
              </div>
              <TimelineColumna
                ocurrencias={ocDia}
                esHoy={esHoy}
                onSeleccionar={onSeleccionar}
                onDetalle={onDetalle}
                onCrearHora={(hora) => onCrearHora(dia, hora)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}