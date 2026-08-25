// src/components/ToastNotificacion.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { Bell, X } from 'lucide-react';

type Props = {
  titulo: string;
  onClose: () => void;
};

export default function ToastNotificacion({ titulo, onClose }: Props) {
  const [brillo, setBrillo] = useState(true);
  const [offsetX, setOffsetX] = useState(0);
  const [saliendo, setSaliendo] = useState(false);
  const inicioArrastre = useRef<number | null>(null);

  useEffect(() => {
    const tBrillo = setTimeout(() => setBrillo(false), 1800);
    const tCierre = setTimeout(() => cerrarConAnimacion(), 7000);
    return () => { clearTimeout(tBrillo); clearTimeout(tCierre); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cerrarConAnimacion() {
    setSaliendo(true);
    setTimeout(onClose, 250);
  }

  function onPointerDown(e: React.PointerEvent) {
    inicioArrastre.current = e.clientX;
  }
  function onPointerMove(e: React.PointerEvent) {
    if (inicioArrastre.current === null) return;
    setOffsetX(e.clientX - inicioArrastre.current);
  }
  function onPointerUp() {
    if (inicioArrastre.current === null) return;
    inicioArrastre.current = null;
    if (Math.abs(offsetX) > 80) {
      setOffsetX(offsetX > 0 ? 400 : -400);
      cerrarConAnimacion();
    } else {
      setOffsetX(0);
    }
  }

  return (
    <div
      className="fixed left-1/2 top-4 z-[100] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2"
      style={{
        transform: `translateX(calc(-50% + ${offsetX}px))`,
        opacity: saliendo ? 0 : Math.max(0.15, 1 - Math.abs(offsetX) / 300),
        transition: inicioArrastre.current === null ? 'transform 0.25s ease-out, opacity 0.25s ease-out' : 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div
        className="panel-madera flex items-center gap-3 border-2 p-3 transition-shadow duration-[1500ms]"
        style={{
          borderColor: brillo ? 'var(--color-gold)' : 'var(--color-border)',
          boxShadow: brillo ? '0 0 0 4px rgba(217,164,65,0.35), var(--sombra-panel-suave)' : 'var(--sombra-panel-suave)',
        }}
      >
        <span className="insignia-icono h-9 w-9 flex-shrink-0" style={{ borderColor: 'var(--color-primary)', backgroundColor: 'var(--color-primary-soft)' }}>
          <Bell size={16} className="text-[var(--color-primary)]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Sucediendo ahora</p>
          <p className="truncate text-sm font-semibold text-[var(--color-text)]">{titulo}</p>
        </div>
        <button onClick={cerrarConAnimacion} className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}