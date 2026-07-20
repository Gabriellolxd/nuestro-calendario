// src/components/SelectorCalendario.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useCalendarioActivo } from '@/lib/CalendarioActivoContext';

const ROL_LABEL: Record<string, string> = {
  propio: '',
  editor: 'Editor',
  espectador: 'Solo lectura',
};

export default function SelectorCalendario() {
  const { calendarioActivo, opciones, seleccionarCalendario } = useCalendarioActivo();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  // Si aún no hay ningún calendario vinculado, no mostramos el selector.
  if (opciones.length <= 1 || !calendarioActivo) return null;

  return (
    <div className="relative flex justify-center bg-white px-4 pb-2" ref={ref}>
      <button
        onClick={() => setAbierto((a) => !a)}
        className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
      >
        📅 {calendarioActivo.label}
        {calendarioActivo.rol !== 'propio' && (
          <span className="rounded-full bg-pink-100 px-1.5 text-[10px] text-pink-600">
            {ROL_LABEL[calendarioActivo.rol]}
          </span>
        )}
        <span className="text-[10px] text-gray-400">▾</span>
      </button>

      {abierto && (
        <div className="absolute top-9 z-50 w-56 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-black/5">
          {opciones.map((op) => (
            <button
              key={op.ownerId}
              onClick={() => {
                seleccionarCalendario(op.ownerId);
                setAbierto(false);
              }}
              className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                op.ownerId === calendarioActivo.ownerId ? 'bg-pink-50 font-medium text-pink-600' : 'text-gray-700'
              }`}
            >
              <span className="truncate">{op.label}</span>
              {op.rol !== 'propio' && (
                <span className="ml-2 flex-shrink-0 text-[10px] text-gray-400">{ROL_LABEL[op.rol]}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}