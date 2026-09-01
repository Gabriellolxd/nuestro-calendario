// src/components/StickerBook.tsx
'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Upload, X, Trash2, AlertTriangle } from 'lucide-react';
import type { StickerVisual } from '@/lib/stickersLocal';
import { eliminarStickerLocal, subirStickersPendientes } from '@/lib/stickersLocal';
import { playSound } from '@/lib/soundManager';
import { STICKERS_PREDEFINIDOS } from '@/lib/stickersPredefinidos';
import { eliminacionAjenaEstaActiva } from '@/lib/adminMode';

const POR_LADO = 6;

type Props = {
  stickers: StickerVisual[];
  userId: string;
  oculto: boolean;
  onAbrirLibreria: () => void;
  onIniciarArrastreDesdeTray: (assetId: string, clientX: number, clientY: number) => void;
  onStickerEliminado: () => void;
};

export default function StickerBook({
  stickers,
  userId,
  oculto,
  onAbrirLibreria,
  onIniciarArrastreDesdeTray,
  onStickerEliminado,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [spread, setSpread] = useState(0);
  const [modoEliminar, setModoEliminar] = useState(false);
  const [avisoNoPermitido, setAvisoNoPermitido] = useState(false);
  const [confirmar, setConfirmar] = useState<StickerVisual | null>(null);
  const [montado, setMontado] = useState(false);

  useState(() => setMontado(true));

  const porSpread = POR_LADO * 2;
  const totalSpreads = Math.max(1, Math.ceil(stickers.length / porSpread));
  const inicio = spread * porSpread;
  const paginaIzq = stickers.slice(inicio, inicio + POR_LADO);
  const paginaDer = stickers.slice(inicio + POR_LADO, inicio + porSpread);

  function toggleAbierto() {
    playSound(abierto ? 'cerrar_libro' : 'abrir_libro');
    setModoEliminar(false);
    setAbierto((a) => !a);
  }

  function toggleModoEliminar() {
    playSound('click');
    setModoEliminar((m) => !m);
    setAvisoNoPermitido(false);
  }

  function pasarPagina(dir: 1 | -1) {
    playSound('pasar_pagina');
    setSpread((s) => Math.min(totalSpreads - 1, Math.max(0, s + dir)));
  }

  function handleClickStickerEnModoEliminar(sticker: StickerVisual) {
    const esPredefinidoDelManifiesto = sticker.esPredefinido; // los del manifiesto nunca se pueden borrar, sean tuyos o no
    const puedeSaltarseRestriccionDeDueno = eliminacionAjenaEstaActiva();
    if (esPredefinidoDelManifiesto || (!puedeSaltarseRestriccionDeDueno && sticker.ownerUserId !== userId)) {
      setAvisoNoPermitido(true);
      setTimeout(() => setAvisoNoPermitido(false), 2200);
      return;
    }
    setConfirmar(sticker);
  }

  async function confirmarEliminacion() {
    if (!confirmar) return;
    await eliminarStickerLocal(confirmar.id);
    playSound('eliminar');
    subirStickersPendientes().catch((err) => console.error(err));
    setConfirmar(null);
    onStickerEliminado();
  }

  function celda(sticker: StickerVisual | undefined, key: string) {
    if (!sticker) return <div key={key} className="aspect-square rounded-lg bg-black/5" />;

    if (modoEliminar) {
      return (
        <button
          key={sticker.id}
          onClick={() => handleClickStickerEnModoEliminar(sticker)}
          className="group relative aspect-square w-full rounded-lg bg-[#f4e9d4] p-1.5 transition-transform active:scale-95"
        >
          <img
            src={sticker.url}
            alt={sticker.nombre}
            className="h-full w-full object-contain transition-opacity group-hover:opacity-20"
            draggable={false}
          />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <Trash2 size={20} className="text-[var(--color-danger)]" strokeWidth={2.5} />
          </span>
        </button>
      );
    }

    return (
      <img
        key={sticker.id}
        src={sticker.url}
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
    <>
      <div
        className="fixed bottom-0 z-40 transition-all duration-300"
        style={{
          left: 10,
          transform: oculto ? 'translateY(130%)' : abierto ? 'translateY(0%)' : 'translateY(calc(100% - 40px))',
          opacity: oculto ? 0 : 1,
          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <button
          onClick={toggleAbierto}
          className="textura-cuero relative flex h-10 w-32 items-center justify-center gap-1.5 rounded-t-2xl border-2 border-b-0 border-[var(--color-wood-dark)] shadow-[0_-3px_10px_rgba(0,0,0,0.25)]"
          style={{ backgroundColor: 'var(--color-leather)' }}
        >
          <BookOpen size={14} className="text-[#f2dfae]" />
          <span className="font-display text-xs font-bold tracking-wide text-[#f2dfae]">Mis Stickers</span>
        </button>

        <div
          className="textura-cuero w-[min(84vw,340px)] overflow-hidden rounded-t-2xl border-2 border-t-0 border-[var(--color-wood-dark)]"
          style={{ backgroundColor: 'var(--color-leather)' }}
        >
          <div className="flex items-center justify-between px-3 pt-2">
            <button
              onClick={toggleModoEliminar}
              className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                modoEliminar ? 'bg-[var(--color-danger)] text-white' : 'bg-black/15 text-[#f2dfae]'
              }`}
              aria-label="Eliminar stickers"
              title="Eliminar stickers de tu librería"
            >
              <Trash2 size={13} />
            </button>
            <span className="font-display text-[11px] text-[#f2dfae]/80">pág. {spread + 1}/{totalSpreads}</span>
            <button onClick={onAbrirLibreria} className="flex items-center gap-1 rounded-full bg-black/15 px-2.5 py-1 text-[10px] font-medium text-[#f2dfae]">
              <Upload size={11} /> Subir
            </button>
          </div>

          {modoEliminar && (
            <p className="animar-entrada mx-3 mt-2 rounded-lg bg-black/20 px-2.5 py-1.5 text-center text-[10px] font-medium text-[#f2dfae]">
              {avisoNoPermitido
                ? 'No puedes eliminar este sticker (no es tuyo o es predefinido)'
                : 'Selecciona un sticker para eliminarlo de tu libreta'}
            </p>
          )}

          <div key={spread} className="animar-entrada relative mx-3 my-2 grid grid-cols-2 gap-2 rounded-xl border-2 border-[var(--color-wood-dark)] bg-[#f4e9d4] p-2.5">
            <div className="grid grid-cols-3 gap-1.5 border-r border-dashed border-[var(--color-wood-dark)]/30 pr-2">
              {Array.from({ length: POR_LADO }).map((_, i) => celda(paginaIzq[i], `izq-${i}`))}
            </div>
            <div className="grid grid-cols-3 gap-1.5 pl-1">
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
            <button onClick={toggleAbierto} className="rounded-full bg-black/15 p-1.5 text-[#f2dfae]">
              <X size={13} />
            </button>
          </div>
        </div>
      </div>

      {montado && confirmar && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[var(--color-wood-dark)]/60 px-4" onClick={() => setConfirmar(null)}>
          <div className="panel-madera w-full max-w-xs animar-entrada p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <AlertTriangle size={28} className="mx-auto mb-2 text-[var(--color-danger)]" />
            <img src={confirmar.url} alt="" className="mx-auto mb-2 h-14 w-14 object-contain" />
            <p className="mb-4 text-sm font-semibold text-[var(--color-text)]">¿Enserio deseas eliminarlo?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmar(null)} className="flex-1 rounded-xl border-2 border-[var(--color-border)] py-2 text-sm text-[var(--color-text-muted)]">
                No
              </button>
              <button onClick={confirmarEliminacion} className="boton-tallado flex-1 rounded-xl bg-[var(--color-danger)] py-2 text-sm font-semibold text-white">
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}