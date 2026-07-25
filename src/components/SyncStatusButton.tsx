// src/components/SyncStatusButton.tsx
'use client';

import { useCalendarioActivo } from '@/lib/CalendarioActivoContext';
import { formatDistanceToNowStrict } from 'date-fns';
import { es } from '@/lib/dates';

const ICONO_POR_ESTADO: Record<string, string> = {
  idle: '☁️',
  syncing: '↻',
  offline: '📴',
  error: '⚠️',
};

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
      className="flex h-8 w-8 items-center justify-center rounded-full text-sm hover:bg-gray-100"
    >
      <span className={estadoSync === 'syncing' ? 'inline-block animate-spin' : ''}>
        {ICONO_POR_ESTADO[estadoSync]}
      </span>
    </button>
  );
}