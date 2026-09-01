// src/components/OpcionesExtraModal.tsx
'use client';

import { useState } from 'react';
import { X, Sticker, StickyNote, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useCalendarioActivo } from '@/lib/CalendarioActivoContext';
import { limpiarTodosLosStickersDelCalendario } from '@/lib/stickersLocal';
import { limpiarTodasLasNotasDelCalendario } from '@/lib/notesLocal';
import { intentarActivarEliminacionAjena, desactivarEliminacionAjena, eliminacionAjenaEstaActiva } from '@/lib/adminMode';
import { playSound } from '@/lib/soundManager';

type Props = { onClose: () => void };

export default function OpcionesExtraModal({ onClose }: Props) {
  const { calendarioActivo } = useCalendarioActivo();
  const [activo, setActivo] = useState(eliminacionAjenaEstaActiva());
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  async function handleLimpiarStickers() {
    if (!calendarioActivo) return;
    if (!confirm('¿Seguro que quieres eliminar TODOS los stickers pegados en este calendario? Esto no se puede deshacer.')) return;
    setProcesando(true);
    await limpiarTodosLosStickersDelCalendario(calendarioActivo.ownerId);
    playSound('eliminar');
    setProcesando(false);
    setMensaje('Stickers eliminados. Cambia de mes o recarga para verlo reflejado.');
  }

  async function handleLimpiarNotas() {
    if (!calendarioActivo) return;
    if (!confirm('¿Seguro que quieres eliminar TODAS las notas de este calendario? Esto no se puede deshacer.')) return;
    setProcesando(true);
    await limpiarTodasLasNotasDelCalendario(calendarioActivo.ownerId);
    playSound('eliminar');
    setProcesando(false);
    setMensaje('Notas eliminadas. Cambia de mes o recarga para verlo reflejado.');
  }

  function handleToggleAdmin() {
    if (activo) {
      desactivarEliminacionAjena();
      setActivo(false);
      return;
    }
    const contrasena = prompt('Contraseña de administrador:');
    if (contrasena === null) return;
    const ok = intentarActivarEliminacionAjena(contrasena);
    if (ok) {
      setActivo(true);
    } else {
      alert('Contraseña incorrecta.');
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--color-wood-dark)]/50 px-4" onClick={onClose}>
      <div className="panel-madera w-full max-w-sm animar-entrada p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-[var(--color-text)]">Opciones extra</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2.5">
          <button
            onClick={handleLimpiarStickers}
            disabled={procesando}
            className="flex w-full items-center gap-2.5 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3 text-left text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface)] disabled:opacity-50"
          >
            <Sticker size={17} className="text-[var(--color-danger)]" />
            Limpiar stickers de este calendario
          </button>

          <button
            onClick={handleLimpiarNotas}
            disabled={procesando}
            className="flex w-full items-center gap-2.5 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3 text-left text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface)] disabled:opacity-50"
          >
            <StickyNote size={17} className="text-[var(--color-danger)]" />
            Limpiar notas de este calendario
          </button>

          <button
            onClick={handleToggleAdmin}
            className={`flex w-full items-center gap-2.5 rounded-xl border-2 px-4 py-3 text-left text-sm transition-colors ${
              activo
                ? 'border-[var(--color-danger)] bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
                : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)] hover:bg-[var(--color-surface)]'
            }`}
          >
            {activo ? <ShieldAlert size={17} /> : <ShieldCheck size={17} className="text-[var(--color-primary)]" />}
            {activo ? 'Eliminación de stickers ajenos: ACTIVA' : 'Activar eliminación de stickers ajenos'}
          </button>

          {activo && (
            <p className="rounded-lg bg-[var(--color-gold-soft)] px-3 py-2 text-[11px] text-[var(--color-wood-dark)]">
              Solo funciona en calendarios donde tienes rol de Editor. Se desactiva sola al cerrar la app.
            </p>
          )}

          {mensaje && (
            <p className="rounded-lg bg-[var(--color-sage-soft)] px-3 py-2 text-xs text-[var(--color-wood-dark)]">{mensaje}</p>
          )}
        </div>
      </div>
    </div>
  );
}