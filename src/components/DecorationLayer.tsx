// src/components/DecorationLayer.tsx
'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import type { StickerPlacementLocal, StickyNoteLocal, StickerAssetLocal } from '@/lib/db';
import {
  obtenerPlacementsLocal,
  colocarStickerLocal,
  moverStickerLocal,
  actualizarTransformStickerLocal,
  quitarStickerLocal,
  urlParaSticker,
  subirStickersPendientes,
} from '@/lib/stickersLocal';
import {
  obtenerNotasLocal,
  actualizarNotaLocal,
  eliminarNotaLocal,
  subirNotasPendientes,
} from '@/lib/notesLocal';

type Props = {
  calendarioOwnerId: string;
  colocadoPorUserId: string;
  targetMes: string;
  editable: boolean;
  stickerAssets: StickerAssetLocal[];
  refreshTick: number;
  arrastreDesdeTray: { assetId: string; x: number; y: number } | null;
  onArrastreDesdeTrayTerminado: () => void;
};

const COLORES_NOTA = ['#fef3c7', '#fecaca', '#bfdbfe', '#bbf7d0', '#e9d5ff'];
const RADIO_BASURERO = 45; // px alrededor del centro del basurero que cuentan como "soltar ahí"

export default function DecorationLayer({
  calendarioOwnerId,
  colocadoPorUserId,
  targetMes,
  editable,
  stickerAssets,
  refreshTick,
  arrastreDesdeTray,
  onArrastreDesdeTrayTerminado,
}: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const basureroRef = useRef<HTMLDivElement>(null);
  const [placements, setPlacements] = useState<StickerPlacementLocal[]>([]);
  const [notas, setNotas] = useState<StickyNoteLocal[]>([]);
  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [sobreBasurero, setSobreBasurero] = useState(false);
  const [fantasma, setFantasma] = useState<{ url: string; x: number; y: number } | null>(null);

  const arrastrando = useRef<{ tipo: 'sticker' | 'nota'; id: string; nuevo?: boolean } | null>(null);
  const girando = useRef<{ tipo: 'sticker' | 'nota'; id: string; centroX: number; centroY: number } | null>(null);

  const cargar = useCallback(async () => {
    const [todosPlacements, todasNotas] = await Promise.all([
      obtenerPlacementsLocal(calendarioOwnerId),
      obtenerNotasLocal(calendarioOwnerId, 'mes', targetMes),
    ]);
    setPlacements(todosPlacements.filter((p) => p.target_type === 'mes' && p.target_mes === targetMes));
    setNotas(todasNotas);
  }, [calendarioOwnerId, targetMes]);

  useEffect(() => {
    cargar();
  }, [cargar, refreshTick]);

  function assetDe(placement: StickerPlacementLocal) {
    return stickerAssets.find((a) => a.id === placement.sticker_asset_id);
  }

  function posDesde(clientX: number, clientY: number) {
    const rect = contenedorRef.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50 };
    return {
      x: Math.min(97, Math.max(3, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.min(97, Math.max(3, ((clientY - rect.top) / rect.height) * 100)),
    };
  }

  function estaSobreBasurero(clientX: number, clientY: number) {
    const rect = basureroRef.current?.getBoundingClientRect();
    if (!rect) return false;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.hypot(clientX - cx, clientY - cy) < RADIO_BASURERO;
  }

  // --- Iniciar arrastre de algo YA colocado en el calendario ---
  function iniciarArrastre(tipo: 'sticker' | 'nota', id: string) {
    if (!editable) return;
    arrastrando.current = { tipo, id };
    setSeleccionId(id);
  }

  // --- Iniciar arrastre desde la bandeja (crea el sticker al soltar) ---
  useEffect(() => {
    if (!arrastreDesdeTray) return;
    const asset = stickerAssets.find((a) => a.id === arrastreDesdeTray.assetId);
    if (asset) setFantasma({ url: urlParaSticker(asset), x: arrastreDesdeTray.x, y: arrastreDesdeTray.y });
  }, [arrastreDesdeTray, stickerAssets]);

  function mover(clientX: number, clientY: number) {
    if (fantasma) {
      setFantasma((f) => (f ? { ...f, x: clientX, y: clientY } : f));
      setSobreBasurero(false);
      return;
    }
    if (girando.current) {
      const { tipo, id, centroX, centroY } = girando.current;
      const angulo = (Math.atan2(clientY - centroY, clientX - centroX) * 180) / Math.PI + 90;
      if (tipo === 'sticker') {
        setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, rotacion: angulo } : p)));
      } else {
        setNotas((prev) => prev.map((n) => (n.id === id ? { ...n, rotacion: angulo } : n)));
      }
      return;
    }
    if (!arrastrando.current) return;
    const { x, y } = posDesde(clientX, clientY);
    const { tipo, id } = arrastrando.current;
    if (tipo === 'sticker') {
      setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, pos_x: x, pos_y: y } : p)));
    } else {
      setNotas((prev) => prev.map((n) => (n.id === id ? { ...n, pos_x: x, pos_y: y } : n)));
    }
    setSobreBasurero(estaSobreBasurero(clientX, clientY));
  }

  async function soltar(clientX: number, clientY: number) {
    // Soltando algo recién arrastrado desde la bandeja → se coloca donde cayó
    if (fantasma) {
      const asset = stickerAssets.find((a) => a.id === arrastreDesdeTray?.assetId);
      if (asset) {
        const { x, y } = posDesde(clientX, clientY);
        await colocarStickerLocal({
          calendarioOwnerId,
          colocadoPorUserId,
          stickerAssetId: asset.id,
          targetType: 'mes',
          targetMes,
          posX: x,
          posY: y,
        });
        await cargar();
        subirStickersPendientes().catch((err) => console.error(err));
      }
      setFantasma(null);
      onArrastreDesdeTrayTerminado();
      return;
    }

    if (girando.current) {
      const { tipo, id } = girando.current;
      girando.current = null;
      if (tipo === 'sticker') {
        const p = placements.find((pl) => pl.id === id);
        if (p) {
          await actualizarTransformStickerLocal(id, { rotacion: p.rotacion });
          subirStickersPendientes().catch((err) => console.error(err));
        }
      } else {
        const n = notas.find((nn) => nn.id === id);
        if (n) {
          await actualizarNotaLocal(id, { rotacion: n.rotacion });
          subirNotasPendientes().catch((err) => console.error(err));
        }
      }
      return;
    }

    if (!arrastrando.current) return;
    const { tipo, id } = arrastrando.current;
    arrastrando.current = null;

    if (sobreBasurero) {
      setSobreBasurero(false);
      if (tipo === 'sticker') {
        setPlacements((prev) => prev.filter((p) => p.id !== id));
        await quitarStickerLocal(id);
        subirStickersPendientes().catch((err) => console.error(err));
      } else {
        setNotas((prev) => prev.filter((n) => n.id !== id));
        await eliminarNotaLocal(id);
        subirNotasPendientes().catch((err) => console.error(err));
      }
      setSeleccionId(null);
      return;
    }

    if (tipo === 'sticker') {
      const p = placements.find((pl) => pl.id === id);
      if (p) {
        await moverStickerLocal(id, p.pos_x, p.pos_y);
        subirStickersPendientes().catch((err) => console.error(err));
      }
    } else {
      const n = notas.find((nn) => nn.id === id);
      if (n) {
        await actualizarNotaLocal(id, { pos_x: n.pos_x, pos_y: n.pos_y });
        subirNotasPendientes().catch((err) => console.error(err));
      }
    }
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      mover(e.clientX, e.clientY);
    }
    function onUp(e: PointerEvent) {
      soltar(e.clientX, e.clientY);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placements, notas, fantasma, sobreBasurero]);

  function iniciarGiro(tipo: 'sticker' | 'nota', id: string, elemento: HTMLElement) {
    if (!editable) return;
    const rect = elemento.getBoundingClientRect();
    girando.current = { tipo, id, centroX: rect.left + rect.width / 2, centroY: rect.top + rect.height / 2 };
    setSeleccionId(id);
  }

  async function handleEscalar(id: string, delta: number) {
    const p = placements.find((pl) => pl.id === id);
    if (!p) return;
    const nuevaEscala = Math.min(3, Math.max(0.4, p.escala + delta));
    setPlacements((prev) => prev.map((pl) => (pl.id === id ? { ...pl, escala: nuevaEscala } : pl)));
    await actualizarTransformStickerLocal(id, { escala: nuevaEscala });
    subirStickersPendientes().catch((err) => console.error(err));
  }

  async function handleEditarNota(id: string, contenido: string) {
    setNotas((prev) => prev.map((n) => (n.id === id ? { ...n, contenido } : n)));
    await actualizarNotaLocal(id, { contenido });
    subirNotasPendientes().catch((err) => console.error(err));
  }

  async function handleCambiarColorNota(id: string, color: string) {
    setNotas((prev) => prev.map((n) => (n.id === id ? { ...n, color } : n)));
    await actualizarNotaLocal(id, { color });
    subirNotasPendientes().catch((err) => console.error(err));
  }

  const hayAlgoArrastrandose = !!arrastrando.current || !!fantasma;

  return (
    <>
      <div
        ref={contenedorRef}
        className={`pointer-events-none absolute inset-0 ${editable ? 'z-30' : 'z-0'}`}
        onClick={() => setSeleccionId(null)}
      >
        {placements.map((p) => {
          const asset = assetDe(p);
          if (!asset) return null;
          const seleccionado = seleccionId === p.id;
          return (
            <div
              key={p.id}
              className="pointer-events-auto absolute animate-[stickerPop_0.25s_ease-out]"
              style={{
                left: `${p.pos_x}%`,
                top: `${p.pos_y}%`,
                transform: `translate(-50%, -50%) rotate(${p.rotacion}deg) scale(${p.escala})`,
                touchAction: 'none',
                zIndex: seleccionado ? 50 : p.z_index,
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                iniciarArrastre('sticker', p.id);
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <img src={urlParaSticker(asset)} alt={asset.nombre} className="w-16 select-none drop-shadow-md" draggable={false} />
              {editable && seleccionado && (
                <div className="absolute -bottom-9 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white px-2 py-1 shadow-lg">
                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      iniciarGiro('sticker', p.id, e.currentTarget.parentElement!.parentElement as HTMLElement);
                    }}
                    className="cursor-grab select-none text-xs active:cursor-grabbing"
                    title="Arrastra para girar"
                  >
                    🔄
                  </div>
                  <button onClick={() => handleEscalar(p.id, -0.15)} className="text-xs">−</button>
                  <button onClick={() => handleEscalar(p.id, 0.15)} className="text-xs">+</button>
                </div>
              )}
            </div>
          );
        })}

        {notas.map((n) => {
          const seleccionada = seleccionId === n.id;
          return (
            <div
              key={n.id}
              className="pointer-events-auto absolute w-32 animate-[stickerPop_0.25s_ease-out]"
              style={{
                left: `${n.pos_x}%`,
                top: `${n.pos_y}%`,
                transform: `translate(-50%, -50%) rotate(${n.rotacion}deg)`,
                zIndex: seleccionada ? 50 : n.z_index,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Alfiler: único punto de arrastre, funciona escribiendo o no */}
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  iniciarArrastre('nota', n.id);
                }}
                className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 cursor-grab touch-none select-none text-lg active:cursor-grabbing"
                title="Arrastra el alfiler para mover la nota"
              >
                📌
              </div>

              <div className="rounded-lg p-2 pt-4 text-[11px] shadow-md" style={{ backgroundColor: n.color }}>
                {editable ? (
                  <textarea
                    value={n.contenido}
                    onChange={(e) => handleEditarNota(n.id, e.target.value)}
                    onPointerDown={(e) => e.stopPropagation()}
                    placeholder="Escribe algo..."
                    rows={3}
                    className="w-full resize-none bg-transparent text-gray-800 outline-none placeholder:text-gray-500"
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-gray-800">{n.contenido || '(vacía)'}</p>
                )}
              </div>

              {editable && (
                <button
                  onClick={() => setSeleccionId(seleccionada ? null : n.id)}
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] shadow"
                >
                  ⋯
                </button>
              )}

              {editable && seleccionada && (
                <div className="absolute -bottom-9 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white px-2 py-1 shadow-lg">
                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      iniciarGiro('nota', n.id, e.currentTarget.parentElement!.parentElement as HTMLElement);
                    }}
                    className="cursor-grab select-none text-xs active:cursor-grabbing"
                    title="Arrastra para girar"
                  >
                    🔄
                  </div>
                  {COLORES_NOTA.map((c) => (
                    <button
                      key={c}
                      onClick={() => handleCambiarColorNota(n.id, c)}
                      className="h-4 w-4 rounded-full border"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Basurero: solo visible mientras se arrastra algo ya colocado */}
      {editable && !!arrastrando.current === false && hayAlgoArrastrandose && !fantasma && null}
      {editable && (arrastrando.current || fantasma) && (
        <div
          ref={basureroRef}
          className={`fixed bottom-6 left-1/2 z-[60] flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full text-2xl shadow-lg transition-transform ${
            sobreBasurero ? 'scale-125 bg-red-500' : 'bg-gray-700'
          }`}
        >
          🗑️
        </div>
      )}

      {/* Fantasma: sigue el dedo mientras arrastras desde la bandeja */}
      {fantasma && (
        <img
          src={fantasma.url}
          alt=""
          className="pointer-events-none fixed z-[70] w-16 opacity-80 drop-shadow-lg"
          style={{ left: fantasma.x, top: fantasma.y, transform: 'translate(-50%, -50%)' }}
        />
      )}
    </>
  );
}