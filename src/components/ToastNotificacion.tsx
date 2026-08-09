// src/components/ToastNotificacion.tsx
'use client';

import { useEffect } from 'react';
import { Bell, X } from 'lucide-react';

type Props = {
  titulo: string;
  onClose: () => void;
};

export default function ToastNotificacion({ titulo, onClose }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, 7000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed left-1/2 top-4 z-[100] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 animar-entrada">
      <div className="panel-madera flex items-center gap-3 border-2 border-[var(--color-gold)] p-3">
        <span className="insignia-icono h-9 w-9 flex-shrink-0" style={{ borderColor: 'var(--color-primary)', backgroundColor: 'var(--color-primary-soft)' }}>
          <Bell size={16} className="text-[var(--color-primary)]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Tienes un evento próximo</p>
          <p className="truncate text-sm font-semibold text-[var(--color-text)]">{titulo}</p>
        </div>
        <button onClick={onClose} className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}