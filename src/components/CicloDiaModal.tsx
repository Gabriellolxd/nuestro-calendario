// src/components/CicloDiaModal.tsx
'use client';

import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { format, es } from '@/lib/dates';
import type { CycleLogLocal } from '@/lib/db';

const SINTOMAS_DISPONIBLES = [
  'Cólicos', 'Dolor de cabeza', 'Hinchazón', 'Cambios de humor', 'Fatiga', 'Acné', 'Sensibilidad', 'Antojos',
];

type Props = {
  log: CycleLogLocal;
  onClose: () => void;
  onGuardar: (cambios: { symptoms: string[]; notes: string | null; luteal_length_manual: number | null }) => Promise<void>;
  onEliminar: () => Promise<void>;
};

export default function CicloDiaModal({ log, onClose, onGuardar, onEliminar }: Props) {
  const [sintomas, setSintomas] = useState<string[]>(log.symptoms ?? []);
  const [notas, setNotas] = useState(log.notes ?? '');
  //Esta linea de abajo se deberia quitar pq no se usa. Pero no he topado todavia para no dañar nada de la logica
  const [luteal] = useState(log.luteal_length_manual ? String(log.luteal_length_manual) : '');
  const [cargando, setCargando] = useState(false);

  function alternar(s: string) {
    setSintomas((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function guardar() {
    setCargando(true);
    try {
      await onGuardar({ symptoms: sintomas, notes: notas || null, luteal_length_manual: luteal ? Number(luteal) : null });
      onClose();
    } finally {
      setCargando(false);
    }
  }

  async function eliminar() {
    setCargando(true);
    try {
      await onEliminar();
      onClose();
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-wood-dark)]/50 px-4" onClick={onClose}>
      <div className="panel-madera flex max-h-[85vh] w-full max-w-sm animar-entrada flex-col p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold capitalize text-[var(--color-text)]">
            {format(new Date(log.period_start + 'T00:00:00'), 'd MMMM yyyy', { locale: es })}
          </h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]">
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Síntomas</label>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {SINTOMAS_DISPONIBLES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => alternar(s)}
                className={`rounded-full border-2 px-3 py-1 text-xs font-medium transition-colors ${
                  sintomas.includes(s)
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-text-inverse)]'
                    : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Notas</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            className="mb-3 w-full rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
          />
        </div>

        <div className="mt-3 flex flex-shrink-0 gap-2 border-t-2 border-[var(--color-border)] pt-3">
          <button
            onClick={eliminar}
            disabled={cargando}
            className="flex items-center justify-center rounded-xl border-2 border-[var(--color-danger)]/40 px-4 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 disabled:opacity-50"
            aria-label="Quitar marca"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={guardar}
            disabled={cargando}
            className="boton-tallado flex-1 rounded-xl bg-[var(--color-primary)] py-2 text-sm font-semibold text-[var(--color-text-inverse)] disabled:opacity-50"
          >
            {cargando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}