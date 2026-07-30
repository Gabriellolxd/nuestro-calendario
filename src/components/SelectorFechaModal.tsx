// src/components/SelectorFechaModal.tsx
'use client';

import { useState } from 'react';
import { addMonths, subMonths, startOfMonth, isSameWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getMonthGrid, isSameMonth, isSameDay, format, es, ahoraEcuador } from '@/lib/dates';

type Vista = 'mes' | 'semana' | 'dia';

interface SelectorFechaModalProps {
  fechaSeleccionada: Date;
  vista: Vista;
  onSeleccionar: (fecha: Date) => void;
  onCerrar: () => void;
}

export default function SelectorFechaModal({
  fechaSeleccionada,
  vista,
  onSeleccionar,
  onCerrar,
}: SelectorFechaModalProps) {
  const [mesVisible, setMesVisible] = useState<Date>(() => startOfMonth(fechaSeleccionada));

  const dias = getMonthGrid(mesVisible);
  const hoy = ahoraEcuador();

  function irMesAnterior() {
    setMesVisible((m) => subMonths(m, 1));
  }

  function irMesSiguiente() {
    setMesVisible((m) => addMonths(m, 1));
  }

  function seleccionarHoy() {
    onSeleccionar(hoy);
    onCerrar();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-wood-dark)]/50 backdrop-blur-sm px-4"
      onClick={onCerrar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel-madera w-full max-w-xs animar-entrada p-4"
      >
        <div className="placa mb-3 flex items-center justify-between px-2 py-1.5">
          <button
            onClick={irMesAnterior}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-text-inverse)]/80 hover:text-[var(--color-text-inverse)]"
            aria-label="Mes anterior"
          >
            <ChevronLeft size={16} strokeWidth={3} />
          </button>
          <span className="font-display text-sm font-semibold capitalize tracking-wide text-[var(--color-text-inverse)]">
            {format(mesVisible, 'MMMM yyyy', { locale: es })}
          </span>
          <button
            onClick={irMesSiguiente}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-text-inverse)]/80 hover:text-[var(--color-text-inverse)]"
            aria-label="Mes siguiente"
          >
            <ChevronRight size={16} strokeWidth={3} />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-bold uppercase text-[var(--color-text-muted)]">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
            <div key={`${d}-${i}`} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1 text-center text-sm">
          {dias.map((dia) => {
            const dentroDelMes = isSameMonth(dia, mesVisible);
            const esHoy = isSameDay(dia, hoy);
            const esSeleccionado = isSameDay(dia, fechaSeleccionada);
            const enSemanaSeleccionada =
              vista === 'semana' && isSameWeek(dia, fechaSeleccionada, { weekStartsOn: 1 });

            return (
              <button
                key={dia.toISOString()}
                onClick={() => {
                  onSeleccionar(dia);
                  onCerrar();
                }}
                className={[
                  'mx-auto flex h-8 w-8 items-center justify-center font-semibold transition-colors',
                  !dentroDelMes ? 'text-[var(--color-text-muted)] opacity-40' : 'text-[var(--color-text)]',
                  esSeleccionado
                    ? 'rounded-full bg-[var(--color-primary)] text-[var(--color-text-inverse)]'
                    : esHoy
                    ? 'rounded-full border-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                    : enSemanaSeleccionada
                    ? 'rounded-md bg-[var(--color-primary-soft)] hover:brightness-95'
                    : 'rounded-full hover:bg-[var(--color-primary-soft)]',
                ].join(' ')}
              >
                {format(dia, 'd')}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex justify-center border-t-2 border-dashed border-[var(--color-border)] pt-3">
          <button
            onClick={seleccionarHoy}
            className="font-hand text-lg font-bold text-[var(--color-primary)] hover:brightness-90"
          >
            → Ir a hoy
          </button>
        </div>
      </div>
    </div>
  );
}