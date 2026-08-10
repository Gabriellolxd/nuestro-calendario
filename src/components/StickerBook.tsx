// src/components/StickerBook.tsx
'use client';

import { useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Upload, StickyNote, X } from 'lucide-react';
import type { StickerAssetLocal } from '@/lib/db';
import { urlParaSticker } from '@/lib/stickersLocal';

const POR_LADO = 6;

type Props = {
  stickers: StickerAssetLocal[];
  onAbrirLibreria: () => void;
  onAgregarNota: () => void;
  onIniciarArrastreDesdeTray: (assetId: string, clientX: number, clientY: number) => void;
  onCerrarModoDecorar: () => void;
};

export default function StickerBook({
  stickers,
  onAbrirLibreria,
  onAgregarNota,
  onIniciarArrastreDesdeTray,
  onCerrarModoDecorar,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [spread, setSpread] = useState(0);

  const porSpread = POR_LADO * 2;
  const totalSpreads = Math.max(1, Math.ceil(stickers.length / porSpread));
  const inicio = spread * porSpread;
  const paginaIzq = stickers.slice(inicio, inicio + POR_LADO);
  const paginaDer = stickers.slice(inicio + POR_LADO, inicio + porSpread);

  function celda(sticker: StickerAssetLocal | undefined, key: string) {
    if (!sticker) {
      return <div key={key} className="aspect-square rounded-lg bg-black/5" />;
    }
    return (
      <img
        key={sticker.id}
        src={urlParaSticker(sticker)}
        alt={sticker.nombre}
        draggable={false}
        onPointerDown={(e) => {
          e.preventDefault();
          onIniciarArrastreDesdeTray(sticker.id, e.clientX, e.clientY);
        }}
        className="aspect-square w-full cursor-grab touch-none select-none rounded-lg bg-[#f4e9d4] object-contain p-1.5 shadow-sm active:cursor-grabbing"
      />
    );
  }

  return (
    <>
      {/* Pestaña de cuero, siempre visible mientras el modo decorar está activo */}
      <button
        onClick={() => setAbierto((a) => !a)}
        className="fixed bottom-0 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-t-2xl border-2 border-b-0 px-5 py-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.2)]"
        style={{ backgroundColor: 'var(--color-leather, #5c3a2e)', borderColor: 'var(--color-wood-dark)' }}
      >
        <BookOpen size={16} className="text-[var(--color-gold-soft)]" />
        <span className="font-hand text-lg font-bold text-[var(--color-gold-soft)]">Stickers</span>
      </button>

      {/* Libreta desplegable */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[45] transition-transform duration-300 ease-out"
        style={{ transform: abierto ? 'translateY(0)' : 'translateY(100%)' }}
      >
        <div className="mx-auto w-full max-w-md rounded-t-3xl border-2 border-b-0 border-[var(--color-wood-dark)] shadow-[0_-8px_24px_rgba(0,0,0,0.3)]" style={{ backgroundColor: 'var(--color-leather, #5c3a2e)' }}>
          {/* Portada / header de la libreta */}
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <button
              onClick={onAgregarNota}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/15 text-[var(--color-gold-soft)]"
              aria-label="Agregar nota"
            >
              <StickyNote size={16} />
            </button>
            <span className="font-display text-sm font-semibold text-[var(--color-gold-soft)]">Mi libreta de stickers</span>
            <button
              onClick={() => { setAbierto(false); onCerrarModoDecorar(); }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/15 text-[var(--color-gold-soft)]"
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </div>

          {/* Páginas */}
          <div
            key={spread}
            className="mx-3 mb-3 grid grid-cols-2 gap-3 rounded-2xl border-2 border-[var(--color-wood-dark)] bg-[#f4e9d4] p-3 animar-entrada"
          >
            <div className="grid grid-cols-3 gap-2 border-r border-dashed border-[var(--color-wood-dark)]/30 pr-3">
              {Array.from({ length: POR_LADO }).map((_, i) => celda(paginaIzq[i], `izq-${i}`))}
            </div>
            <div className="grid grid-cols-3 gap-2 pl-1">
              {Array.from({ length: POR_LADO }).map((_, i) => celda(paginaDer[i], `der-${i}`))}
            </div>
          </div>

          {/* Navegación de páginas + subir nuevo */}
          <div className="flex items-center justify-between px-4 pb-4">
            <button
              onClick={() => setSpread((s) => Math.max(0, s - 1))}
              disabled={spread === 0}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/15 text-[var(--color-gold-soft)] disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={onAbrirLibreria}
              className="flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1.5 text-xs font-medium text-[var(--color-gold-soft)]"
            >
              <Upload size={13} />
              Agregar sticker
            </button>
            <button
              onClick={() => setSpread((s) => Math.min(totalSpreads - 1, s + 1))}
              disabled={spread >= totalSpreads - 1}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/15 text-[var(--color-gold-soft)] disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}