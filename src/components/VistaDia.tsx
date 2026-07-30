// src/components/VistaDia.tsx
'use client';

import { format, es, isSameDay, ahoraEcuador } from '@/lib/dates';
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
}: Props) {
  const ocDia = ocurrencias.filter((oc) => isSameDay(oc.hora_inicio, fecha));
  const esHoy = isSameDay(fecha, ahoraEcuador());

  return (
    <div className="bg-[var(--color-bg-elevated)]">
      <div className="flex items-center justify-center gap-2 border-b-2 border-[var(--color-border)] bg-[var(--color-surface)]/40 py-2">
        <span className="font-hand text-lg font-bold capitalize text-[var(--color-text-muted)]">
          {format(fecha, "EEEE", { locale: es })}
        </span>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
            esHoy ? 'bg-[var(--color-primary)] text-[var(--color-text-inverse)]' : 'text-[var(--color-text)]'
          }`}
        >
          {format(fecha, 'd')}
        </span>
      </div>

      <div className="flex">
        <div className="w-12 flex-shrink-0 border-r border-[var(--color-border)]/60 bg-[var(--color-surface)]/40">
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              className="pr-1.5 text-right text-[10px] font-medium text-[var(--color-text-muted)]"
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