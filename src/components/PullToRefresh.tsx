// src/components/PullToRefresh.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';

const UMBRAL_RECARGA_PX = 70;
const MAX_ARRASTRE_PX = 110;

export default function PullToRefresh() {
  const [distancia, setDistancia] = useState(0);
  const [recargando, setRecargando] = useState(false);
  const inicioY = useRef<number | null>(null);
  const activo = useRef(false);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 4) return;
      const target = e.target as HTMLElement | null;
      if (!target || !target.closest('[data-ptr-zone]')) return;
      inicioY.current = e.touches[0].clientY;
      activo.current = true;
    }

    function onTouchMove(e: TouchEvent) {
      if (!activo.current || inicioY.current === null || recargando) return;
      const dy = e.touches[0].clientY - inicioY.current;
      if (dy <= 0) { setDistancia(0); return; }
      if (window.scrollY > 4) { activo.current = false; setDistancia(0); return; }
      e.preventDefault();
      setDistancia(Math.min(MAX_ARRASTRE_PX, dy * 0.5));
    }

    function onTouchEnd() {
      if (!activo.current) return;
      activo.current = false;
      inicioY.current = null;
      setDistancia((actual) => {
        if (actual >= UMBRAL_RECARGA_PX) {
          setRecargando(true);
          setTimeout(() => window.location.reload(), 350);
          return UMBRAL_RECARGA_PX;
        }
        return 0;
      });
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [recargando]);

  const progreso = Math.min(1, distancia / UMBRAL_RECARGA_PX);
  if (distancia === 0 && !recargando) return null;

  return (
    <div
      className="fixed left-1/2 top-3 z-[200] flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border-2 border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[var(--sombra-panel-suave)]"
      style={{ opacity: progreso, transform: `translate(-50%, ${Math.min(distancia, UMBRAL_RECARGA_PX) - 44}px)` }}
    >
      <RotateCw
        size={20}
        className={recargando ? 'animate-spin text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}
        style={!recargando ? { transform: `rotate(${progreso * 360}deg)` } : undefined}
      />
    </div>
  );
}