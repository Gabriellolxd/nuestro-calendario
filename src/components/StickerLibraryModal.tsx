// src/components/StickerLibraryModal.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { X, Upload, Trash2 } from 'lucide-react';
import {
  obtenerStickersDisponibles,
  crearStickerLocal,
  eliminarStickerLocal,
  subirStickersPendientes,
} from '@/lib/stickersLocal';
import type { StickerVisual } from '@/lib/stickersLocal';

type Props = {
  userId: string;
  idsCalendariosVisibles: string[];
  onClose: () => void;
  onElegirParaColocar?: (assetId: string) => void;
};

export default function StickerLibraryModal({ userId, idsCalendariosVisibles, onClose, onElegirParaColocar }: Props) {
  const [stickers, setStickers] = useState<StickerVisual[]>([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function cargar() {
    const disponibles = await obtenerStickersDisponibles(idsCalendariosVisibles);
    setStickers(disponibles);
    setCargando(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    const esPng = archivo.type === 'image/png' || archivo.type === 'image/webp';
    if (esPng) {
      const { tieneTransparencia } = await import('@/lib/stickerBorder');
      const transparente = await tieneTransparencia(archivo);
      if (!transparente) {
        const continuar = confirm('Esta imagen no tiene fondo transparente — el borde blanco saldrá cuadrado. ¿Subirla igual?');
        if (!continuar) {
          if (inputRef.current) inputRef.current.value = '';
          return;
        }
      }
    } else {
      const continuar = confirm('Este formato no soporta transparencia — el borde saldrá cuadrado. ¿Subirla igual?');
      if (!continuar) {
        if (inputRef.current) inputRef.current.value = '';
        return;
      }
    }

    setSubiendo(true);
    try {
      await crearStickerLocal(userId, archivo, archivo.name.replace(/\.[^.]+$/, ''));
      await cargar();
      subirStickersPendientes().catch((err) => console.error('Error subiendo sticker:', err));
    } catch (err) {
      console.error('Error creando sticker:', err);
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleEliminar(sticker: StickerVisual) {
    if (sticker.esPredefinido || sticker.ownerUserId !== userId) return;
    await eliminarStickerLocal(sticker.id);
    await cargar();
    subirStickersPendientes().catch((err) => console.error('Error sincronizando:', err));
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--color-wood-dark)]/50 px-4" onClick={onClose}>
      <div className="panel-madera flex max-h-[80vh] w-full max-w-md animar-entrada flex-col p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-[var(--color-text)]">Mis stickers</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]">
            <X size={16} />
          </button>
        </div>

        <input ref={inputRef} type="file" accept="image/*" onChange={handleArchivo} className="hidden" id="input-sticker" />
        <label
          htmlFor="input-sticker"
          className="mb-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-primary)] py-4 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
        >
          <Upload size={16} />
          {subiendo ? 'Procesando...' : 'Subir nuevo sticker'}
        </label>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {cargando && <p className="text-sm text-[var(--color-text-muted)]">Cargando...</p>}
          <div className="grid grid-cols-4 gap-2">
            {stickers.map((s) => (
              <div key={s.id} className="relative">
                <button
                  onClick={() => onElegirParaColocar?.(s.id)}
                  className="w-full rounded-lg border-2 border-transparent p-1 hover:border-[var(--color-border)] hover:bg-[var(--color-surface)]"
                >
                  <img src={s.url} alt={s.nombre} className="aspect-square w-full object-contain" />
                </button>
                {!s.esPredefinido && s.ownerUserId === userId && (
                  <button
                    onClick={() => handleEliminar(s)}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-danger)] text-[10px] text-white"
                    aria-label="Eliminar"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}