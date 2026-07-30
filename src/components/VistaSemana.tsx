// src/components/VistaSemana.tsx
'use client';

import { format, es, isSameDay, ahoraEcuador } from '@/lib/dates';
import type { Ocurrencia } from '@/lib/recurrence';
import TimelineColumna, { ALTURA_HORA } from './TimelineColumna';

type Props = {
  dias: Date[];
  diaResaltado: Date | null;
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
  const hoy = ahoraEcuador();

  return (
    <div className="flex bg-[var(--color-bg-elevated)]">
      <div className="w-12 flex-shrink-0 border-r border-[var(--color-border)]/60 bg-[var(--color-surface)]/40">
        <div className="h-14 border-b-2 border-[var(--color-border)]" />
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

      <div className="grid flex-1 grid-cols-7">
        {dias.map((dia, i) => {
          const ocDia = ocurrencias.filter((oc) => isSameDay(oc.hora_inicio, dia));
          const esHoy = isSameDay(dia, hoy);
          const esSeleccionado = diaResaltado ? isSameDay(dia, diaResaltado) : false;

          return (
            <div
              key={dia.toISOString()}
              className={`border-l border-[var(--color-border)]/60 ${i === 0 ? 'border-l-0' : ''} ${
                esSeleccionado && !esHoy ? 'bg-[var(--color-primary-soft)]/50' : ''
              }`}
            >
              <div className="flex h-14 flex-col items-center justify-center gap-0.5 border-b-2 border-[var(--color-border)] bg-[var(--color-surface)]/40 text-xs">
                <span className="font-hand text-[13px] font-bold capitalize text-[var(--color-text-muted)]">
                  {format(dia, 'EEE', { locale: es })}
                </span>
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                    esHoy
                      ? 'bg-[var(--color-primary)] text-[var(--color-text-inverse)]'
                      : esSeleccionado
                      ? 'border-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'text-[var(--color-text)]'
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