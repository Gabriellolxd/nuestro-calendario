// src/components/MusicButton.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Music, VolumeX, SkipForward } from 'lucide-react';
import { useMusic } from '@/lib/MusicContext';

export default function MusicButton() {
  const { silenciado, volumen, pistaActual, alternarSilencio, cambiarVolumen, siguienteCancion } = useMusic();
  const [mostrarSlider, setMostrarSlider] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fuera(e: PointerEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setMostrarSlider(false);
      }
    }
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, []);

  function iniciarPresionLarga() {
    timerRef.current = setTimeout(() => setMostrarSlider(true), 450);
  }
  function cancelarPresionLarga() {
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  return (
    <div className="relative" ref={contenedorRef}>
      <button
        onClick={() => { if (!mostrarSlider) alternarSilencio(); }}
        onPointerDown={iniciarPresionLarga}
        onPointerUp={cancelarPresionLarga}
        onPointerLeave={cancelarPresionLarga}
        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"
        aria-label="Música de fondo"
      >
        {silenciado ? <VolumeX size={16} /> : <Music size={16} />}
      </button>

      {mostrarSlider && (
        <div
          className="absolute left-0 top-10 z-50 flex w-40 animar-entrada flex-col items-center gap-2 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 shadow-[var(--sombra-panel-suave)]"
          onClick={(e) => e.stopPropagation()}
        >
          {pistaActual && (
            <p className="w-full truncate text-center text-[10px] font-medium text-[var(--color-text-muted)]">
              {pistaActual}
            </p>
          )}
          <input
            type="range" min={0} max={1} step={0.05} value={volumen}
            onChange={(e) => cambiarVolumen(Number(e.target.value))}
            className="w-full accent-[var(--color-primary)]"
          />
          <button
            onClick={siguienteCancion}
            className="flex items-center gap-1.5 rounded-full bg-[var(--color-surface)] px-2.5 py-1 text-[10px] font-medium text-[var(--color-text)]"
          >
            <SkipForward size={11} /> Siguiente canción
          </button>
        </div>
      )}
    </div>
  );
}