// src/components/StickerLibraryModal.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import {
  obtenerStickersLocal,
  crearStickerLocal,
  eliminarStickerLocal,
  urlParaSticker,
  subirStickersPendientes,
} from '../lib/stickersLocal';
import { STICKERS_PREDEFINIDOS } from '../lib/stickersPredefinidos';
import type { StickerAssetLocal } from '../lib/db';

type Props = {
  userId: string;
  idsCalendariosVisibles: string[]; // tu id + el de tu pareja si está vinculada
  onElegirParaColocar?: (assetId: string) => void;
  onClose: () => void;
};

export default function StickerLibraryModal({ userId, idsCalendariosVisibles, onClose, onElegirParaColocar }: Props) {  
  const [stickers, setStickers] = useState<StickerAssetLocal[]>([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function cargar() {
    const locales = await obtenerStickersLocal(idsCalendariosVisibles);
    setStickers(locales);
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
        const continuar = confirm(
          'Esta imagen no tiene fondo transparente — el borde blanco va a salir como un cuadrado en vez de seguir la forma. ¿Quieres subirla igual?'
        );
        if (!continuar) {
          if (inputRef.current) inputRef.current.value = '';
          return;
        }
      }
    } else {
      const continuar = confirm(
        'Este formato (JPG u otro) no soporta transparencia — el borde blanco va a salir como un cuadrado en vez de seguir la forma. ¿Quieres subirla igual?'
      );
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

  async function handleEliminar(sticker: StickerAssetLocal) {
    if (sticker.owner_user_id !== userId) return;
    await eliminarStickerLocal(sticker.id);
    await cargar();
    subirStickersPendientes().catch((err) => console.error('Error sincronizando borrado:', err));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-base font-semibold text-gray-800">🎨 Mis stickers (prueba)</h2>

        <input ref={inputRef} type="file" accept="image/*" onChange={handleArchivo} className="hidden" id="input-sticker" />
        <label
          htmlFor="input-sticker"
          className="mb-4 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-pink-300 py-4 text-sm text-pink-500 hover:bg-pink-50"
        >
          {subiendo ? 'Procesando...' : '+ Subir nuevo sticker'}
        </label>

        {cargando && <p className="text-sm text-gray-400">Cargando...</p>}

        {STICKERS_PREDEFINIDOS.length > 0 && (
          <>
            <p className="mb-2 text-xs font-medium text-gray-500">Predefinidos</p>
            <div className="mb-4 grid grid-cols-4 gap-2">
              {STICKERS_PREDEFINIDOS.map((s) => (
                <div key={s.id} className="rounded-lg p-1">
                  <img src={s.archivo} alt={s.nombre} className="aspect-square w-full object-contain" />
                </div>
              ))}
            </div>
          </>
        )}

        <p className="mb-2 text-xs font-medium text-gray-500">Tu librería ({stickers.length})</p>
        <div className="grid grid-cols-4 gap-2">
          {stickers.map((s) => (
            <div key={s.id} className="relative">
              <button
                onClick={() => (onElegirParaColocar ? onElegirParaColocar(s.id) : undefined)}
                className="w-full rounded-lg p-1 hover:bg-gray-100"
              >
                <img src={urlParaSticker(s)} alt={s.nombre} className="aspect-square w-full object-contain" />
              </button>
              {s.owner_user_id === userId && (
                <button
                  onClick={() => handleEliminar(s)}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white"
                  aria-label="Eliminar"
                >
                  ×
                </button>
              )}
              {s.synced === 0 && (
                <span className="absolute bottom-0 left-0 rounded bg-amber-400 px-1 text-[8px] text-white">
                  pendiente
                </span>
              )}
            </div>
          ))}
        </div>

        <button onClick={onClose} className="mt-5 w-full rounded-lg border border-gray-300 py-2 text-sm text-gray-600">
          Cerrar
        </button>
      </div>
    </div>
  );
}
