// src/components/StickerBook.tsx
'use client';

import { useState } from 'react';
import { BookOpen, Upload, X } from 'lucide-react';
import type { StickerAssetLocal } from '@/lib/db';
import { urlParaSticker } from '@/lib/stickersLocal';
import { playSound } from '@/lib/soundManager';

const POR_LADO = 6;

type Props = {
  stickers: StickerAssetLocal[];
  oculto: boolean;
  onAbrirLibreria: () => void;
  onIniciarArrastreDesdeTray: (assetId: string, clientX: number, clientY: number) => void;
};

export default function StickerBook({ stickers, oculto, onAbrirLibreria, onIniciarArrastreDesdeTray }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [spread, setSpread] = useState(0);

  const porSpread = POR_LADO * 2;
  const totalSpreads = Math.max(1, Math.ceil(stickers.length / porSpread));
  const inicio = spread * porSpread;
  const paginaIzq = stickers.slice(inicio, inicio + POR_LADO);
  const paginaDer = stickers.slice(inicio + POR_LADO, inicio + porSpread);

  function toggleAbierto() {
    playSound(abierto ? 'cerrar_libro' : 'abrir_libro');
    setAbierto((a) => !a);
  }

  function pasarPagina(dir: 1 | -1) {
    playSound('pasar_pagina');
    setSpread((s) => Math.min(totalSpreads - 1, Math.max(0, s + dir)));
  }

  function celda(sticker: StickerAssetLocal | undefined, key: string) {
    if (!sticker) return <div key={key} className="aspect-square rounded-lg bg-black/5" />;
    return (
      <img
        key={sticker.id}
        src={urlParaSticker(sticker)}
        alt={sticker.nombre}
        draggable={false}
        onPointerDown={(e) => {
          e.preventDefault();
          playSound('agarrar');
          onIniciarArrastreDesdeTray(sticker.id, e.clientX, e.clientY);
        }}
        className="aspect-square w-full cursor-grab touch-none select-none rounded-lg bg-[#f4e9d4] object-contain p-1.5 shadow-sm active:cursor-grabbing"
      />
    );
  }

  return (
    <div
      className="fixed bottom-0 left-[38%] z-40 -translate-x-1/2 transition-all duration-300"
      style={{
        transform: oculto ? 'translate(-50%, 130%)' : abierto ? 'translate(-50%, 0%)' : 'translate(-50%, calc(100% - 40px))',
        opacity: oculto ? 0 : 1,
        transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <button
        onClick={toggleAbierto}
        className="textura-cuero relative mx-auto flex h-10 w-40 items-center justify-center gap-1.5 rounded-t-2xl border-2 border-b-0 border-[var(--color-wood-dark)] shadow-[0_-3px_10px_rgba(0,0,0,0.25)]"
        style={{ backgroundColor: 'var(--color-leather)' }}
      >
        <BookOpen size={14} className="text-[var(--color-gold-soft)]" />
        <span className="font-display text-xs font-bold tracking-wide text-[var(--color-gold-soft)]">Mis Stickers</span>
      </button>

      <div
        className="textura-cuero mx-auto w-[92vw] max-w-md overflow-hidden rounded-t-2xl border-2 border-t-0 border-[var(--color-wood-dark)]"
        style={{ backgroundColor: 'var(--color-leather)' }}
      >
        <div className="flex items-center justify-between px-3 pt-2">
          <span className="font-display text-[11px] text-[var(--color-gold-soft)]/80">pág. {spread + 1}/{totalSpreads}</span>
          <button onClick={onAbrirLibreria} className="flex items-center gap-1 rounded-full bg-black/15 px-2.5 py-1 text-[10px] font-medium text-[var(--color-gold-soft)]">
            <Upload size={11} /> Subir
          </button>
        </div>

        <div key={spread} className="animar-entrada relative mx-3 my-2 grid grid-cols-2 gap-3 rounded-xl border-2 border-[var(--color-wood-dark)] bg-[#f4e9d4] p-3">
          <div className="grid grid-cols-3 gap-2 border-r border-dashed border-[var(--color-wood-dark)]/30 pr-3">
            {Array.from({ length: POR_LADO }).map((_, i) => celda(paginaIzq[i], `izq-${i}`))}
          </div>
          <div className="grid grid-cols-3 gap-2 pl-1">
            {Array.from({ length: POR_LADO }).map((_, i) => celda(paginaDer[i], `der-${i}`))}
          </div>

          {spread > 0 && (
            <button
              onClick={() => pasarPagina(-1)}
              className="absolute bottom-1 left-1 h-6 w-6"
              style={{ clipPath: 'polygon(0 100%, 100% 100%, 0 0)', background: 'linear-gradient(135deg, #e2cfa5, #b9995f)' }}
              aria-label="Página anterior"
            />
          )}
          {spread < totalSpreads - 1 && (
            <button
              onClick={() => pasarPagina(1)}
              className="absolute bottom-1 right-1 h-6 w-6"
              style={{ clipPath: 'polygon(100% 100%, 0 100%, 100% 0)', background: 'linear-gradient(225deg, #e2cfa5, #b9995f)' }}
              aria-label="Página siguiente"
            />
          )}
        </div>

        <div className="flex justify-center pb-2">
          <button onClick={toggleAbierto} className="rounded-full bg-black/15 p-1.5 text-[var(--color-gold-soft)]">
            <X size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}