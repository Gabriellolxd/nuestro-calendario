// src/components/SelectorCalendario.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
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

  if (opciones.length <= 1 || !calendarioActivo) return null;

  return (
    <div className="relative flex justify-center pb-3" ref={ref}>
      <button
        onClick={() => setAbierto((a) => !a)}
        className="flex items-center gap-1.5 rounded-full border-2 border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-primary-soft)]"
      >
        <CalendarDays size={13} className="text-[var(--color-primary)]" />
        {calendarioActivo.label}
        {calendarioActivo.rol !== 'propio' && (
          <span className="rounded-full bg-[var(--color-gold-soft)] px-1.5 text-[10px] text-[var(--color-wood-dark)]">
            {ROL_LABEL[calendarioActivo.rol]}
          </span>
        )}
        <ChevronDown size={12} className="text-[var(--color-text-muted)]" />
      </button>

      {abierto && (
        <div className="animar-entrada absolute top-9 z-50 w-56 overflow-hidden rounded-2xl border-2 border-[var(--color-border)] bg-[var(--color-bg-elevated)] py-1 shadow-[var(--sombra-panel-suave)]">
          {opciones.map((op) => (
            <button
              key={op.ownerId}
              onClick={() => {
                seleccionarCalendario(op.ownerId);
                setAbierto(false);
              }}
              className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors hover:bg-[var(--color-surface)] ${
                op.ownerId === calendarioActivo.ownerId
                  ? 'bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]'
                  : 'text-[var(--color-text)]'
              }`}
            >
              <span className="truncate">{op.label}</span>
              {op.rol !== 'propio' && (
                <span className="ml-2 flex-shrink-0 text-[10px] text-[var(--color-text-muted)]">{ROL_LABEL[op.rol]}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}