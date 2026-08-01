// src/components/NotificacionesCalendariosModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { useCalendarioActivo } from '@/lib/CalendarioActivoContext';
import { obtenerCalendariosSilenciados, alternarSilencio } from '@/lib/notificationPrefs';
import { reprogramarNotificacionesDeUsuario } from '@/lib/notifications';

type Props = { onClose: () => void };

export default function NotificacionesCalendariosModal({ onClose }: Props) {
  const { opciones } = useCalendarioActivo();
  const [silenciados, setSilenciados] = useState<string[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSilenciados(obtenerCalendariosSilenciados());
  }, []);

  function handleToggle(ownerId: string) {
    const nuevos = alternarSilencio(ownerId);
    setSilenciados(nuevos);
    reprogramarNotificacionesDeUsuario(opciones).catch((err) =>
      console.error('Error reprogramando notificaciones:', err)
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-wood-dark)]/50 px-4" onClick={onClose}>
      <div className="panel-madera w-full max-w-sm animar-entrada p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-[var(--color-text)]">Notificaciones</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]">
            <X size={16} />
          </button>
        </div>
        <p className="mb-3 text-xs text-[var(--color-text-muted)]">Elige de qué calendarios quieres recibir avisos.</p>

        <div className="flex flex-col gap-2">
          {opciones.map((op) => {
            const silenciado = silenciados.includes(op.ownerId);
            return (
              <button
                key={op.ownerId}
                onClick={() => handleToggle(op.ownerId)}
                className="flex items-center justify-between rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2.5 transition-colors hover:bg-[var(--color-surface)]"
              >
                <span className="text-sm text-[var(--color-text)]">{op.label}</span>
                {silenciado ? (
                  <BellOff size={18} className="text-[var(--color-text-muted)]" />
                ) : (
                  <Bell size={18} className="text-[var(--color-primary)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}