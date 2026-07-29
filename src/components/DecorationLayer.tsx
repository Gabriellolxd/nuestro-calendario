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
import { PALETA_COLORES } from '@/lib/colors';

type Props = {
  calendarioOwnerId: string;
  colocadoPorUserId: string;
  targetMes: string;
  editable: boolean; // ahora significa "tiene permiso" (no Espectador), no "modo decorar activo"
  stickerAssets: StickerAssetLocal[];
  refreshTick: number;
  arrastreDesdeTray: { assetId: string; x: number; y: number } | null;
  onArrastreDesdeTrayTerminado: () => void;
};

const RADIO_BASURERO = 45;
const UMBRAL_CLICK_PX = 6; // menos que esto = clic; más = arrastre

type ModoInteraccion = 'ninguno' | 'arrastrando' | 'girando' | 'escalando';

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
  const [modoInteraccion, setModoInteraccion] = useState<ModoInteraccion>('ninguno');

  // Gesto que todavía no se sabe si terminará siendo clic o arrastre.
  const gestoPendiente = useRef<{ tipo: 'sticker' | 'nota'; id: string; startX: number; startY: number } | null>(null);
  const arrastrando = useRef<{ tipo: 'sticker' | 'nota'; id: string } | null>(null);
  const girando = useRef<{ tipo: 'sticker' | 'nota'; id: string; centroX: number; centroY: number } | null>(null);
  const escalando = useRef<{
    id: string;
    centroX: number;
    centroY: number;
    distanciaInicial: number;
    escalaInicial: number;
  } | null>(null);

  const cargar = useCallback(async () => {
    const [todosPlacements, todasNotas] = await Promise.all([
      obtenerPlacementsLocal(calendarioOwnerId),
      obtenerNotasLocal(calendarioOwnerId, 'mes', targetMes),
    ]);
    setPlacements(todosPlacements.filter((p) => p.target_type === 'mes' && p.target_mes === targetMes));
    setNotas(todasNotas);
  }, [calendarioOwnerId, targetMes]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga decoraciones al montar o tras un sync
    cargar();
  }, [cargar, refreshTick]);

  useEffect(() => {
    if (!arrastreDesdeTray) return;
    const asset = stickerAssets.find((a) => a.id === arrastreDesdeTray.assetId);
    if (asset) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- inicia el "fantasma" que sigue al dedo al arrastrar desde la bandeja externa
      setFantasma({ url: urlParaSticker(asset), x: arrastreDesdeTray.x, y: arrastreDesdeTray.y });
    }
  }, [arrastreDesdeTray, stickerAssets]);

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

  function centroEnPantalla(posX: number, posY: number) {
    const rect = contenedorRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: rect.left + (posX / 100) * rect.width, y: rect.top + (posY / 100) * rect.height };
  }

  function estaSobreBasurero(clientX: number, clientY: number) {
    const rect = basureroRef.current?.getBoundingClientRect();
    if (!rect) return false;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.hypot(clientX - cx, clientY - cy) < RADIO_BASURERO;
  }

  // Se llama al presionar sobre un sticker o el alfiler de una nota. NO
  // decide todavía si es clic o arrastre — eso se resuelve en base al
  // movimiento acumulado antes de soltar.
  function onPointerDownItem(tipo: 'sticker' | 'nota', id: string, e: React.PointerEvent) {
    if (!editable) return;
    e.stopPropagation();
    gestoPendiente.current = { tipo, id, startX: e.clientX, startY: e.clientY };
  }

  function iniciarGiro(tipo: 'sticker' | 'nota', id: string) {
    if (!editable) return;
    const item = tipo === 'sticker' ? placements.find((p) => p.id === id) : notas.find((n) => n.id === id);
    if (!item) return;
    const { x, y } = centroEnPantalla(item.pos_x, item.pos_y);
    girando.current = { tipo, id, centroX: x, centroY: y };
    setModoInteraccion('girando');
  }

  function iniciarEscala(id: string, clientX: number, clientY: number) {
    if (!editable) return;
    const p = placements.find((pl) => pl.id === id);
    if (!p) return;
    const { x, y } = centroEnPantalla(p.pos_x, p.pos_y);
    const distanciaInicial = Math.max(1, Math.hypot(clientX - x, clientY - y));
    escalando.current = { id, centroX: x, centroY: y, distanciaInicial, escalaInicial: p.escala };
    setModoInteraccion('escalando');
  }

  function mover(clientX: number, clientY: number) {
    if (fantasma) {
      setFantasma((f) => (f ? { ...f, x: clientX, y: clientY } : f));
      setSobreBasurero(estaSobreBasurero(clientX, clientY));
      return;
    }
    if (girando.current) {
      const { tipo, id, centroX, centroY } = girando.current;
      const dx = clientX - centroX;
      const dy = clientY - centroY;
      const angulo = (Math.atan2(-dx, dy) * 180) / Math.PI;
      if (tipo === 'sticker') {
        setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, rotacion: angulo } : p)));
      } else {
        setNotas((prev) => prev.map((n) => (n.id === id ? { ...n, rotacion: angulo } : n)));
      }
      return;
    }
    if (escalando.current) {
      const { id, centroX, centroY, distanciaInicial, escalaInicial } = escalando.current;
      const distancia = Math.hypot(clientX - centroX, clientY - centroY);
      const nuevaEscala = Math.min(3, Math.max(0.4, escalaInicial * (distancia / distanciaInicial)));
      setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, escala: nuevaEscala } : p)));
      return;
    }

    // Todavía no se sabe si es clic o arrastre: medir distancia acumulada.
    if (gestoPendiente.current && !arrastrando.current) {
      const { startX, startY } = gestoPendiente.current;
      const distancia = Math.hypot(clientX - startX, clientY - startY);
      if (distancia < UMBRAL_CLICK_PX) return; // aún podría ser un clic, no mover nada todavía
      arrastrando.current = { tipo: gestoPendiente.current.tipo, id: gestoPendiente.current.id };
      setModoInteraccion('arrastrando');
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
    if (fantasma) {
      const cancelado = sobreBasurero;
      const asset = stickerAssets.find((a) => a.id === arrastreDesdeTray?.assetId);
      if (asset && !cancelado) {
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
      setSobreBasurero(false);
      onArrastreDesdeTrayTerminado();
      return;
    }

    if (girando.current) {
      const { tipo, id } = girando.current;
      girando.current = null;
      setModoInteraccion('ninguno');
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

    if (escalando.current) {
      const { id } = escalando.current;
      escalando.current = null;
      setModoInteraccion('ninguno');
      const p = placements.find((pl) => pl.id === id);
      if (p) {
        await actualizarTransformStickerLocal(id, { escala: p.escala });
        subirStickersPendientes().catch((err) => console.error(err));
      }
      return;
    }

    // Resolver si el gesto fue clic (sin arrastre real) o un arrastre.
    if (gestoPendiente.current) {
      const { id } = gestoPendiente.current;
      const fueArrastre = !!arrastrando.current;
      gestoPendiente.current = null;

      if (!fueArrastre) {
        // Clic puro: abre el menú de edición, no mueve nada.
        setSeleccionId(id);
        return;
      }
    }

    if (!arrastrando.current) return;
    const { tipo, id } = arrastrando.current;
    arrastrando.current = null;
    setModoInteraccion('ninguno');

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

  const mostrarBasurero = editable && (modoInteraccion === 'arrastrando' || !!fantasma);

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
              className="pointer-events-none absolute"
              style={{ left: `${p.pos_x}%`, top: `${p.pos_y}%`, zIndex: seleccionado ? 50 : p.z_index }}
            >
              <div
                className="pointer-events-auto relative animate-[stickerPop_0.25s_ease-out]"
                style={{
                  transform: `translate(-50%, -50%) rotate(${p.rotacion}deg) scale(${p.escala})`,
                  touchAction: 'none',
                }}
                onPointerDown={(e) => onPointerDownItem('sticker', p.id, e)}
                onClick={(e) => e.stopPropagation()}
              >
                <img src={urlParaSticker(asset)} alt={asset.nombre} className="w-16 select-none drop-shadow-md" draggable={false} />
                {editable && seleccionado && (
                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      iniciarEscala(p.id, e.clientX, e.clientY);
                    }}
                    className="absolute -bottom-1 -right-1 flex h-5 w-5 cursor-nwse-resize items-center justify-center rounded-full bg-white text-[10px] shadow"
                    title="Arrastra para agrandar o achicar"
                  >
                    ↘
                  </div>
                )}
              </div>

              {editable && seleccionado && (
                <div
                  className="pointer-events-auto absolute left-1/2 top-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white px-2 py-1 shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      iniciarGiro('sticker', p.id);
                    }}
                    className="cursor-grab select-none text-xs active:cursor-grabbing"
                    title="Arrastra para girar"
                  >
                    🔄
                  </button>
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
              className="pointer-events-none absolute w-32"
              style={{ left: `${n.pos_x}%`, top: `${n.pos_y}%`, zIndex: seleccionada ? 50 : n.z_index }}
            >
              <div
                className="pointer-events-auto relative animate-[stickerPop_0.25s_ease-out]"
                style={{ transform: `translate(-50%, -50%) rotate(${n.rotacion}deg)` }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  onPointerDown={(e) => onPointerDownItem('nota', n.id, e)}
                  className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 cursor-grab touch-none select-none text-lg active:cursor-grabbing"
                  title="Arrastra el alfiler para mover la nota"
                >
                  📌
                </div>
                <div
                  className="rounded-lg p-2 pt-4 text-[11px] shadow-md"
                  style={{ backgroundColor: n.color }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (editable) setSeleccionId(n.id);
                  }}
                >
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
              </div>

              {editable && seleccionada && (
                <div
                  className="pointer-events-auto absolute left-1/2 top-24 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-full bg-white px-2 py-1 shadow-lg"
                  style={{ width: 160 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      iniciarGiro('nota', n.id);
                    }}
                    className="cursor-grab select-none text-xs active:cursor-grabbing"
                    title="Arrastra para girar"
                  >
                    🔄
                  </button>
                  {PALETA_COLORES.slice(0, 6).map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => handleCambiarColorNota(n.id, c.hex)}
                      className="h-4 w-4 flex-shrink-0 rounded-full border border-black/10"
                      style={{ backgroundColor: c.hex }}
                      title={c.nombre}
                    />
                  ))}
                  <div className="relative h-4 w-4 flex-shrink-0">
                    <input
                      type="color"
                      value={n.color}
                      onChange={(e) => handleCambiarColorNota(n.id, e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                    <div
                      className="h-4 w-4 rounded-full"
                      style={{ background: 'conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)' }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {mostrarBasurero && (
        <div
          ref={basureroRef}
          className={`fixed bottom-6 left-1/2 z-[60] flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full text-2xl shadow-lg transition-transform ${
            sobreBasurero ? 'scale-125 bg-red-500' : 'bg-gray-700'
          }`}
        >
          🗑️
        </div>
      )}

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