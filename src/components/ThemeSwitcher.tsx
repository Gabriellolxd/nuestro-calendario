// src/components/ThemeSwitcher.tsx
'use client';

import { Sun, Moon, Palette } from 'lucide-react';
import { useTheme, type ModoTema } from '@/lib/ThemeContext';

const OPCIONES: { modo: ModoTema; label: string; Icono: typeof Sun }[] = [
  { modo: 'claro', label: 'Claro', Icono: Sun },
  { modo: 'oscuro', label: 'Oscuro', Icono: Moon },
  { modo: 'personalizado', label: 'Personalizado', Icono: Palette },
];

export default function ThemeSwitcher() {
  const { modo, cambiarModo, colores, actualizarColorPersonalizado } = useTheme();

  return (
    <div className="px-4 py-3">
      <p className="mb-2 text-xs font-medium text-[var(--color-text-muted)]">Apariencia</p>
      <div className="flex gap-1.5">
        {OPCIONES.map(({ modo: m, label, Icono }) => (
          <button
            key={m}
            onClick={() => cambiarModo(m)}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[10px] transition-colors ${
              modo === m
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]'
            }`}
          >
            <Icono size={16} />
            {label}
          </button>
        ))}
      </div>

      {modo === 'personalizado' && (
        <div className="mt-3 grid grid-cols-5 gap-2 animar-entrada">
          {(['primary', 'wood', 'gold', 'sage', 'bg'] as const).map((clave) => (
            <label key={clave} className="flex flex-col items-center gap-1">
              <input
                type="color"
                value={colores[clave]}
                onChange={(e) => actualizarColorPersonalizado(clave, e.target.value)}
                className="h-7 w-7 cursor-pointer rounded-full border border-[var(--color-border)]"
              />
              <span className="text-[8px] capitalize text-[var(--color-text-muted)]">{clave}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}