// src/components/StickerTray.tsx
'use client';

import { useState } from 'react';
import type { StickerAssetLocal } from '@/lib/db';
import { urlParaSticker } from '@/lib/stickersLocal';

const POR_PAGINA = 6;

type Props = {
  stickers: StickerAssetLocal[];
  onAbrirLibreria: () => void;
  onIniciarArrastreDesdeTray: (assetId: string, clientX: number, clientY: number) => void;
};

export default function StickerTray({ stickers, onAbrirLibreria, onIniciarArrastreDesdeTray }: Props) {
  const [pagina, setPagina] = useState(0);
  const totalPaginas = Math.max(1, Math.ceil(stickers.length / POR_PAGINA));
  const visibles = stickers.slice(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl border-t border-gray-200 bg-white/95 px-3 pb-3 pt-2 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur">
      <div className="mb-1 flex items-center justify-between">
        <button
          onClick={() => setPagina((p) => Math.max(0, p - 1))}
          disabled={pagina === 0}
          className="px-2 text-gray-400 disabled:opacity-20"
        >
          ‹
        </button>
        <span className="text-[11px] text-gray-400">
          Arrastra un sticker al calendario · pág. {pagina + 1}/{totalPaginas}
        </span>
        <button
          onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
          disabled={pagina >= totalPaginas - 1}
          className="px-2 text-gray-400 disabled:opacity-20"
        >
          ›
        </button>
      </div>

      <div key={pagina} className="grid animate-[pageTurn_0.2s_ease-out] grid-cols-6 gap-2">
        {visibles.map((s) => (
          <img
            key={s.id}
            src={urlParaSticker(s)}
            alt={s.nombre}
            draggable={false}
            onPointerDown={(e) => {
              e.preventDefault();
              onIniciarArrastreDesdeTray(s.id, e.clientX, e.clientY);
            }}
            className="aspect-square w-full cursor-grab touch-none select-none rounded-lg bg-gray-50 object-contain p-1 active:cursor-grabbing"
          />
        ))}
        {Array.from({ length: POR_PAGINA - visibles.length }).map((_, i) => (
          <button
            key={`vacio-${i}`}
            onClick={onAbrirLibreria}
            className="flex aspect-square w-full items-center justify-center rounded-lg border-2 border-dashed border-gray-200 text-gray-300"
          >
            +
          </button>
        ))}
      </div>
    </div>
  );
}