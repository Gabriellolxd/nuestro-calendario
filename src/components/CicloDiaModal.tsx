// src/components/CicloDiaModal.tsx
'use client';

import { useState } from 'react';
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
  const [luteal, setLuteal] = useState(log.luteal_length_manual ? String(log.luteal_length_manual) : '');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-sm font-semibold capitalize text-gray-800">
          🩸 {format(new Date(log.period_start + 'T00:00:00'), 'd MMMM yyyy', { locale: es })}
        </h2>

        <label className="text-xs text-gray-500">Síntomas</label>
        <div className="mb-3 mt-1 flex flex-wrap gap-1.5">
          {SINTOMAS_DISPONIBLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => alternar(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${sintomas.includes(s) ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {s}
            </button>
          ))}
        </div>

        <label className="text-xs text-gray-500">Notas</label>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />

        <label className="text-xs text-gray-500">Duración fase lútea (opcional, si tienes test de ovulación)</label>
        <input
          type="number"
          min={8}
          max={20}
          value={luteal}
          onChange={(e) => setLuteal(e.target.value)}
          placeholder="Ej. 14"
          className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />

        <div className="flex gap-2">
          <button onClick={eliminar} disabled={cargando} className="flex-1 rounded-lg border border-red-300 py-2 text-sm text-red-500 hover:bg-red-50 disabled:opacity-50">
            Quitar marca
          </button>
          <button onClick={guardar} disabled={cargando} className="flex-1 rounded-lg bg-pink-500 py-2 text-sm font-medium text-white hover:bg-pink-600 disabled:opacity-50">
            {cargando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
        <button onClick={onClose} className="mt-2 w-full rounded-lg border border-gray-300 py-2 text-sm text-gray-600">
          Cerrar
        </button>
      </div>
    </div>
  );
}