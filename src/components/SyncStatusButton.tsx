// src/components/SyncStatusButton.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useCalendarioActivo } from '@/lib/CalendarioActivoContext';
import { formatDistanceToNowStrict } from 'date-fns';
import { es } from '@/lib/dates';
import { obtenerUltimoErrorSync, suscribirseAErrorSync } from '@/lib/syncErrorStore';

const TITULO_POR_ESTADO: Record<string, string> = {
  idle: 'Sincronizado',
  syncing: 'Sincronizando...',
  offline: 'Sin conexión — se sincronizará al reconectar',
  error: 'Error al sincronizar — mantén presionado para ver detalles',
};

export default function SyncStatusButton() {
  const { estadoSync, ultimaSync, sincronizarAhora } = useCalendarioActivo();
  const [error, setError] = useState<string | null>(obtenerUltimoErrorSync());
  const [mostrarError, setMostrarError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => suscribirseAErrorSync(setError), []);

  const titulo =
    estadoSync === 'idle' && ultimaSync
      ? `Sincronizado ${formatDistanceToNowStrict(ultimaSync, { addSuffix: true, locale: es })}`
      : TITULO_POR_ESTADO[estadoSync];

  function iniciarPresionLarga() {
    timerRef.current = setTimeout(() => {
      if (error) setMostrarError(true);
    }, 500);
  }
  function cancelarPresionLarga() {
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  return (
    <div className="relative">
      <button
        onClick={() => sincronizarAhora()}
        onPointerDown={iniciarPresionLarga}
        onPointerUp={cancelarPresionLarga}
        onPointerLeave={cancelarPresionLarga}
        title={titulo}
        className="relative flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-surface)]"
      >
        {estadoSync === 'syncing' && <RefreshCw size={17} className="animate-spin text-[var(--color-text-muted)]" />}
        {estadoSync === 'offline' && <CloudOff size={17} className="text-[var(--color-text-muted)]" />}
        {estadoSync === 'error' && <AlertTriangle size={17} className="text-[var(--color-danger)]" />}
        {estadoSync === 'idle' && (
          <span className="relative">
            <Cloud size={17} className="text-[var(--color-sage)]" />
            <CheckCircle2 size={11} className="absolute -bottom-0.5 -right-1 rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-success)]" />
          </span>
        )}
      </button>

      {mostrarError && error && (
        <div
          className="absolute right-0 top-10 z-50 w-64 animar-entrada rounded-xl border-2 border-[var(--color-danger)] bg-[var(--color-bg-elevated)] p-3 text-xs text-[var(--color-text)] shadow-[var(--sombra-panel-suave)]"
          onClick={() => setMostrarError(false)}
        >
          <p className="mb-1 font-semibold text-[var(--color-danger)]">Detalle del error</p>
          <p className="break-words">{error}</p>
          <p className="mt-2 text-[10px] text-[var(--color-text-muted)]">Toca para cerrar</p>
        </div>
      )}
    </div>
  );
}