// src/components/VistaDia.tsx
'use client';

import { format, isSameDay } from '@/lib/dates';
import type { Ocurrencia } from '@/lib/recurrence';
import TimelineColumna, { ALTURA_HORA } from './TimelineColumna';

type Props = {
  fecha: Date;
  ocurrencias: Ocurrencia[];
  onSeleccionar: (oc: Ocurrencia) => void;
  onDetalle: (ocurrencias: Ocurrencia[]) => void;
  onCrearHora: (dia: Date, hora: number) => void;
  onCambiarFecha: (fecha: Date) => void;
};

export default function VistaDia({
  fecha,
  ocurrencias,
  onSeleccionar,
  onDetalle,
  onCrearHora,
  onCambiarFecha,
}: Props) {
  const ocDia = ocurrencias.filter((oc) => isSameDay(oc.hora_inicio, fecha));
  const esHoy = isSameDay(fecha, new Date());

  return (
    <div className="bg-white">
      

      <div className="flex">
        <div className="w-14 flex-shrink-0">
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

        <div className="flex-1">
          <TimelineColumna
            ocurrencias={ocDia}
            esHoy={esHoy}
            onSeleccionar={onSeleccionar}
            onDetalle={onDetalle}
            onCrearHora={(hora) => onCrearHora(fecha, hora)}
          />
        </div>
      </div>
    </div>
  );
}