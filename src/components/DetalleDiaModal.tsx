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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-sm font-semibold text-gray-800">
          Eventos — {format(fecha, 'd MMM yyyy')}
        </h2>

        <div className="flex flex-col gap-1.5">
          {ordenadas.map((oc) => (
            <button
              key={`${oc.eventoId}-${oc.fecha.toISOString()}`}
              onClick={() => onSeleccionar(oc)}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left hover:bg-gray-50"
            >
              <span
                className="h-3 w-3 flex-shrink-0 rounded-full"
                style={{ backgroundColor: oc.hex_color }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-gray-800">{oc.titulo}</p>
                <p className="text-xs text-gray-400">
                  {format(oc.hora_inicio, 'HH:mm')} – {format(oc.hora_fin, 'HH:mm')}
                </p>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-gray-300 py-2 text-sm text-gray-600"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}