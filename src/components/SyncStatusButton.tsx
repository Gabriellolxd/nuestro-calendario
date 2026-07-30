// src/components/SyncStatusButton.tsx
'use client';

import { Cloud, CloudOff, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useCalendarioActivo } from '@/lib/CalendarioActivoContext';
import { formatDistanceToNowStrict } from 'date-fns';
import { es } from '@/lib/dates';

const TITULO_POR_ESTADO: Record<string, string> = {
  idle: 'Sincronizado',
  syncing: 'Sincronizando...',
  offline: 'Sin conexión — se sincronizará al reconectar',
  error: 'Error al sincronizar — toca para reintentar',
};

export default function SyncStatusButton() {
  const { estadoSync, ultimaSync, sincronizarAhora } = useCalendarioActivo();

  const titulo =
    estadoSync === 'idle' && ultimaSync
      ? `Sincronizado ${formatDistanceToNowStrict(ultimaSync, { addSuffix: true, locale: es })}`
      : TITULO_POR_ESTADO[estadoSync];

  return (
    <button
      onClick={() => sincronizarAhora()}
      title={titulo}
      className="relative flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-surface)]"
    >
      {estadoSync === 'syncing' && <RefreshCw size={17} className="animate-spin text-[var(--color-text-muted)]" />}
      {estadoSync === 'offline' && <CloudOff size={17} className="text-[var(--color-text-muted)]" />}
      {estadoSync === 'error' && <AlertTriangle size={17} className="text-[var(--color-danger)]" />}
      {estadoSync === 'idle' && (
        <span className="relative">
          <Cloud size={17} className="text-[var(--color-sage)]" />
          <CheckCircle2
            size={11}
            className="absolute -bottom-0.5 -right-1 rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-success)]"
          />
        </span>
      )}
    </button>
  );
}