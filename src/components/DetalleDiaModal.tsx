// src/components/DetalleDiaModal.tsx
'use client';

import { format } from '@/lib/dates';
import type { Ocurrencia } from '@/lib/recurrence';

type Props = {
  fecha: Date;
  ocurrencias: Ocurrencia[];
  onSeleccionar: (oc: Ocurrencia) => void;
  onClose: () => void;
};

export default function DetalleDiaModal({ fecha, ocurrencias, onSeleccionar, onClose }: Props) {
  const ordenadas = [...ocurrencias].sort(
    (a, b) => a.hora_inicio.getTime() - b.hora_inicio.getTime()
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-wood-dark)]/50 px-4"
      onClick={onClose}
    >
      <div
        className="panel-madera w-full max-w-sm animar-entrada p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display mb-3 text-base font-semibold capitalize text-[var(--color-text)]">
          {format(fecha, "d 'de' MMMM")}
        </h2>

        <div className="flex flex-col gap-2">
          {ordenadas.map((oc) => (
            <button
              key={`${oc.eventoId}-${oc.fecha.toISOString()}`}
              onClick={() => onSeleccionar(oc)}
              className="flex items-center gap-2.5 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2.5 text-left shadow-[0_2px_0_var(--color-border)] transition-transform hover:-translate-y-0.5"
            >
              <span
                className="h-3.5 w-3.5 flex-shrink-0 rounded-full border border-black/10"
                style={{ backgroundColor: oc.hex_color }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--color-text)]">{oc.titulo}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {format(oc.hora_inicio, 'HH:mm')} – {format(oc.hora_fin, 'HH:mm')}
                </p>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl border-2 border-[var(--color-border)] py-2 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}