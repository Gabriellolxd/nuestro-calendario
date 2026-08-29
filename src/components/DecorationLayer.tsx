// src/components/DecorationLayer.tsx
'use client';

import { useRef, useState, useEffect, useCallback, type MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, RotateCw, ArrowDownRight, Loader2 } from 'lucide-react';
import type { StickerPlacementLocal, StickyNoteLocal } from '@/lib/db';
import type { StickerVisual } from '@/lib/stickersLocal';
import { format } from '@/lib/dates';
import {
  obtenerPlacementsLocal,
  colocarStickerLocal,
  actualizarTransformStickerLocal,
  quitarStickerLocal,
  subirStickersPendientes,
  migrarPlacementADia,
} from '@/lib/stickersLocal';
import {
  obtenerNotasParaDias,
  obtenerTodasLasNotasLocal,
  actualizarNotaLocal,
  eliminarNotaLocal,
  subirNotasPendientes,
  migrarNotaADia,
} from '@/lib/notesLocal';
import { PALETA_COLORES } from '@/lib/colors';
import { playSound } from '@/lib/soundManager';

type Props = {
  calendarioOwnerId: string;
  colocadoPorUserId: string;
  dias: Date[];
  mesActual: Date;
  editable: boolean;
  stickerAssets: StickerVisual[];
  refreshTick: number;
  arrastreDesdeTray: { assetId: string; x: number; y: number } | null;
  onArrastreDesdeTrayTerminado: () => void;
  onArrastreActivoChange?: (activo: boolean) => void;
  decoDragRef?: MutableRefObject<boolean>;
};

const RADIO_BASURERO = 50;
const UMBRAL_CLICK_PX = 6;
const COLUMNAS = 7;

const ESCALA_STICKER_WEB = 1.0;
const ESCALA_NOTA_WEB = 0.8;
const MULTIPLICADOR_MOVIL = 2;

const SENSIBILIDAD_PENDULO = 0.015;
const AMORTIGUACION_PENDULO = 0.94;
const RIGIDEZ_PENDULO = 0.05;

type ModoInteraccion = 'ninguno' | 'arrastrando' | 'girando' | 'escalando';

function filasDeLaGrilla(dias: Date[]): number {
  return Math.max(1, Math.ceil(dias.length / COLUMNAS));
}

function celdaParaFecha(dias: Date[], fechaISO: string) {
  const idx = dias.findIndex((d) => format(d, 'yyyy-MM-dd') === fechaISO);
  if (idx === -1) return null;
  const filas = filasDeLaGrilla(dias);
  return { col: idx % COLUMNAS, row: Math.floor(idx / COLUMNAS), filas };
}

function posicionAbsoluta(dias: Date[], targetDia: string | null, posXCelda: number, posYCelda: number) {
  if (!targetDia) return null;
  const celda = celdaParaFecha(dias, targetDia);
  if (!celda) return null;
  const { col, row, filas } = celda;
  return {
    leftPct: ((col + posXCelda / 100) / COLUMNAS) * 100,
    topPct: ((row + posYCelda / 100) / filas) * 100,
  };
}

function diaYCeldaDesdeAbsoluta(dias: Date[], xPctAbs: number, yPctAbs: number) {
  const filas = filasDeLaGrilla(dias);
  const col = Math.min(COLUMNAS - 1, Math.max(0, Math.floor((xPctAbs / 100) * COLUMNAS)));
  const row = Math.min(filas - 1, Math.max(0, Math.floor((yPctAbs / 100) * filas)));
  const idx = row * COLUMNAS + col;
  const dia = dias[idx];
  if (!dia) return null;
  const posXCelda = Math.min(94, Math.max(6, ((xPctAbs / 100) * COLUMNAS - col) * 100));
  const posYCelda = Math.min(94, Math.max(6, ((yPctAbs / 100) * filas - row) * 100));
  return { fechaISO: format(dia, 'yyyy-MM-dd'), posXCelda, posYCelda };
}

export default function DecorationLayer({
  calendarioOwnerId,
  colocadoPorUserId,
  dias,
  mesActual,
  editable,
  stickerAssets,
  refreshTick,
  arrastreDesdeTray,
  onArrastreDesdeTrayTerminado,
  onArrastreActivoChange,
  decoDragRef,
}: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const basureroRef = useRef<HTMLDivElement>(null);
  const [placements, setPlacements] = useState<StickerPlacementLocal[]>([]);
  const [notas, setNotas] = useState<StickyNoteLocal[]>([]);
  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [sobreBasurero, setSobreBasurero] = useState(false);
  const [fantasma, setFantasma] = useState<{ url: string; x: number; y: number } | null>(null);
  const [modoInteraccion, setModoInteraccion] = useState<ModoInteraccion>('ninguno');
  const [montado, setMontado] = useState(false);
  const [dragVisual, setDragVisual] = useState<{ id: string; xPct: number; yPct: number } | null>(null);
  const [cellWidthPx, setCellWidthPx] = useState(56);
  const [esMovil, setEsMovil] = useState(false);
  // Ids de stickers cuya imagen ya terminó de cargar — hasta que esto
  // pase, se muestra un spinner en vez del sticker, y el "pop" de
  // aparición solo se dispara una vez que la imagen está lista de verdad.
  const [imgsCargados, setImgsCargados] = useState<Set<string>>(new Set());

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!contenedorRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setCellWidthPx(w / COLUMNAS);
    });
    obs.observe(contenedorRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEsMovil(mq.matches);
    const handler = (e: MediaQueryListEvent) => setEsMovil(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Bloquea la selección de texto de la página mientras se está girando
  // o escalando un sticker/nota con el mouse — sin esto, arrastrar el
  // dedito de rotar/agrandar seleccionaba el texto de alrededor.
  useEffect(() => {
    const bloquear = modoInteraccion === 'girando' || modoInteraccion === 'escalando';
    document.body.style.userSelect = bloquear ? 'none' : '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document.body.style as any).webkitUserSelect = bloquear ? 'none' : '';
    return () => {
      document.body.style.userSelect = '';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (document.body.style as any).webkitUserSelect = '';
    };
  }, [modoInteraccion]);

  const gestoPendiente = useRef<{ tipo: 'sticker' | 'nota'; id: string; startX: number; startY: number } | null>(null);
  const arrastrando = useRef<{ tipo: 'sticker' | 'nota'; id: string } | null>(null);
  const girando = useRef<{ tipo: 'sticker' | 'nota'; id: string; centroX: number; centroY: number } | null>(null);

  const [anguloBalanceo, setAnguloBalanceo] = useState(0);
  const [pivoteRelativo, setPivoteRelativo] = useState<{ xPct: number; yPct: number }>({ xPct: 50, yPct: 50 });
  const posAnterior = useRef<{ x: number; y: number; tiempo: number } | null>(null);
  const velocidadAngular = useRef(0);
  const anguloActualRef = useRef(0);
  const animFrameId = useRef<number | null>(null);
  const escalando = useRef<{ id: string; centroX: number; centroY: number; distanciaInicial: number; escalaInicial: number } | null>(null);
  const dosDedos = useRef<{
    tipo: 'sticker' | 'nota'; id: string;
    distanciaInicial: number; anguloInicial: number;
    escalaInicial: number; rotacionInicial: number;
  } | null>(null);

  // Recuerda para qué calendario se cargó por última vez — sirve para
  // detectar un cambio de calendario y limpiar de inmediato, ANTES de
  // esperar la consulta nueva. Esto es lo que arregla el "sticker
  // duplicado temporal": sin esto, mientras la consulta nueva estaba en
  // curso, se seguían viendo en pantalla los stickers del calendario
  // anterior (el de tu pareja) por un instante.
  const ownerAnteriorRef = useRef<string | null>(null);

  const diasISO = dias.map((d) => format(d, 'yyyy-MM-dd'));

  const cargar = useCallback(async () => {
    if (ownerAnteriorRef.current !== calendarioOwnerId) {
      setPlacements([]);
      setNotas([]);
      setImgsCargados(new Set());
      ownerAnteriorRef.current = calendarioOwnerId;
    }

    const mesActualStr = format(mesActual, 'yyyy-MM');

    const todosPlacements = await obtenerPlacementsLocal(calendarioOwnerId);
    const legacyPlacements = todosPlacements.filter((p) => p.target_type === 'mes' && p.target_mes === mesActualStr);
    for (const legacy of legacyPlacements) {
      const destino = diaYCeldaDesdeAbsoluta(dias, legacy.pos_x, legacy.pos_y);
      if (destino) await migrarPlacementADia(legacy.id, destino.fechaISO, destino.posXCelda, destino.posYCelda);
    }

    const todasLasNotas = await obtenerTodasLasNotasLocal(calendarioOwnerId);
    const legacyNotas = todasLasNotas.filter((n) => n.target_type === 'mes' && n.target_mes === mesActualStr);
    for (const legacy of legacyNotas) {
      const destino = diaYCeldaDesdeAbsoluta(dias, legacy.pos_x, legacy.pos_y);
      if (destino) await migrarNotaADia(legacy.id, destino.fechaISO, destino.posXCelda, destino.posYCelda);
    }

    if (legacyPlacements.length > 0 || legacyNotas.length > 0) {
      subirStickersPendientes().catch(() => {});
      subirNotasPendientes().catch(() => {});
    }

    const [placementsFinal, notasFinal] = await Promise.all([
      obtenerPlacementsLocal(calendarioOwnerId),
      obtenerNotasParaDias(calendarioOwnerId, diasISO),
    ]);
    setPlacements(placementsFinal.filter((p) => p.target_type === 'dia' && p.target_dia && diasISO.includes(p.target_dia)));
    setNotas(notasFinal);
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  }, [calendarioOwnerId, diasISO.join(','), format(mesActual, 'yyyy-MM')]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga decoraciones al montar, cambiar de mes/calendario, o tras un sync
    cargar();
  }, [cargar, refreshTick]);

  useEffect(() => {
    if (!arrastreDesdeTray) return;
    const asset = stickerAssets.find((a) => a.id === arrastreDesdeTray.assetId);
    if (asset) {
      if (decoDragRef) decoDragRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- inicia el "fantasma" al arrastrar desde la bandeja externa
      setFantasma({ url: asset.url, x: arrastreDesdeTray.x, y: arrastreDesdeTray.y });
    }
  }, [arrastreDesdeTray, stickerAssets, decoDragRef]);

  useEffect(() => {
    onArrastreActivoChange?.(modoInteraccion !== 'ninguno' || !!fantasma);
  }, [modoInteraccion, fantasma, onArrastreActivoChange]);

  function assetDe(placement: StickerPlacementLocal) {
    return stickerAssets.find((a) => a.id === placement.sticker_asset_id);
  }

  function marcarCargado(id: string) {
    setImgsCargados((prev) => {
      if (prev.has(id)) return prev;
      const nuevo = new Set(prev);
      nuevo.add(id);
      return nuevo;
    });
  }

  function posDesdeAbs(clientX: number, clientY: number) {
    const rect = contenedorRef.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50 };
    return {
      x: Math.min(99, Math.max(1, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.min(99, Math.max(1, ((clientY - rect.top) / rect.height) * 100)),
    };
  }

  function centroEnPantallaDeItem(targetDia: string | null, posXCelda: number, posYCelda: number) {
    const rect = contenedorRef.current?.getBoundingClientRect();
    const abs = posicionAbsoluta(dias, targetDia, posXCelda, posYCelda);
    if (!rect || !abs) return { x: 0, y: 0 };
    return { x: rect.left + (abs.leftPct / 100) * rect.width, y: rect.top + (abs.topPct / 100) * rect.height };
  }

  function estaSobreBasurero(clientX: number, clientY: number) {
    const rect = basureroRef.current?.getBoundingClientRect();
    if (!rect) return false;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.hypot(clientX - cx, clientY - cy) < RADIO_BASURERO;
  }

  function onPointerDownItem(tipo: 'sticker' | 'nota', id: string, e: React.PointerEvent) {
    if (!editable) return;
    if (decoDragRef) decoDragRef.current = true;
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const xPct = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
      const yPct = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
      setPivoteRelativo({ xPct, yPct });
    }

    gestoPendiente.current = { tipo, id, startX: e.clientX, startY: e.clientY };
  }

  function iniciarGiro(tipo: 'sticker' | 'nota', id: string) {
    if (!editable) return;
    if (decoDragRef) decoDragRef.current = true;
    const item = tipo === 'sticker' ? placements.find((p) => p.id === id) : notas.find((n) => n.id === id);
    if (!item) return;
    const { x, y } = centroEnPantallaDeItem(item.target_dia, item.pos_x, item.pos_y);
    girando.current = { tipo, id, centroX: x, centroY: y };
    setModoInteraccion('girando');
  }

  function iniciarEscala(id: string, clientX: number, clientY: number) {
    if (!editable) return;
    if (decoDragRef) decoDragRef.current = true;
    const p = placements.find((pl) => pl.id === id);
    if (!p) return;
    const { x, y } = centroEnPantallaDeItem(p.target_dia, p.pos_x, p.pos_y);
    const distanciaInicial = Math.max(1, Math.hypot(clientX - x, clientY - y));
    escalando.current = { id, centroX: x, centroY: y, distanciaInicial, escalaInicial: p.escala };
    setModoInteraccion('escalando');
  }

  const iniciarAnimacionFisica = useCallback(() => {
    if (animFrameId.current !== null) return;

    const loopFisica = () => {
      const fuerzaResorte = -RIGIDEZ_PENDULO * anguloActualRef.current;
      velocidadAngular.current = (velocidadAngular.current + fuerzaResorte) * AMORTIGUACION_PENDULO;
      anguloActualRef.current += velocidadAngular.current;

      setAnguloBalanceo(anguloActualRef.current);

      if (Math.abs(velocidadAngular.current) > 0.01 || Math.abs(anguloActualRef.current) > 0.01) {
        animFrameId.current = requestAnimationFrame(loopFisica);
      } else {
        animFrameId.current = null;
        anguloActualRef.current = 0;
        setAnguloBalanceo(0);
      }
    };

    animFrameId.current = requestAnimationFrame(loopFisica);
  }, []);

  function mover(clientX: number, clientY: number) {
    if (fantasma) {
      setFantasma((f) => (f ? { ...f, x: clientX, y: clientY } : f));
      setSobreBasurero(estaSobreBasurero(clientX, clientY));
      return;
    }
    if (girando.current) {
      const { tipo, id, centroX, centroY } = girando.current;
      const angulo = (Math.atan2(-(clientX - centroX), clientY - centroY) * 180) / Math.PI;
      if (tipo === 'sticker') setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, rotacion: angulo } : p)));
      else setNotas((prev) => prev.map((n) => (n.id === id ? { ...n, rotacion: angulo } : n)));
      return;
    }
    if (escalando.current) {
      const { id, centroX, centroY, distanciaInicial, escalaInicial } = escalando.current;
      const distancia = Math.hypot(clientX - centroX, clientY - centroY);
      const nuevaEscala = Math.min(3, Math.max(0.4, escalaInicial * (distancia / distanciaInicial)));
      setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, escala: nuevaEscala } : p)));
      return;
    }
    if (gestoPendiente.current && !arrastrando.current) {
      const { startX, startY } = gestoPendiente.current;
      if (Math.hypot(clientX - startX, clientY - startY) < UMBRAL_CLICK_PX) return;
      arrastrando.current = { tipo: gestoPendiente.current.tipo, id: gestoPendiente.current.id };
      setModoInteraccion('arrastrando');
      // eslint-disable-next-line react-hooks/purity
      posAnterior.current = { x: clientX, y: clientY, tiempo: performance.now() };
      playSound(gestoPendiente.current.tipo === 'nota' ? 'agarrar_nota' : 'agarrar');
    }
    if (!arrastrando.current) return;

    // eslint-disable-next-line react-hooks/purity
    const ahora = performance.now();
    if (posAnterior.current) {
      const dt = Math.max(1, ahora - posAnterior.current.tiempo);
      const dx = clientX - posAnterior.current.x;
      const velX = dx / dt;

      const impulso = velX * SENSIBILIDAD_PENDULO * 15;
      velocidadAngular.current += impulso;
      iniciarAnimacionFisica();
    }
    posAnterior.current = { x: clientX, y: clientY, tiempo: ahora };

    const { x, y } = posDesdeAbs(clientX, clientY);
    setDragVisual({ id: arrastrando.current.id, xPct: x, yPct: y });
    setSobreBasurero(estaSobreBasurero(clientX, clientY));
  }

  async function soltar(clientX: number, clientY: number) {
    try {
      posAnterior.current = null;

      if (fantasma) {
        const cancelado = sobreBasurero;
        const asset = stickerAssets.find((a) => a.id === arrastreDesdeTray?.assetId);
        if (asset && !cancelado) {
          const { x, y } = posDesdeAbs(clientX, clientY);
          const destino = diaYCeldaDesdeAbsoluta(dias, x, y);
          if (destino) {
            await colocarStickerLocal({
              calendarioOwnerId, colocadoPorUserId, stickerAssetId: asset.id,
              targetType: 'dia', targetDia: destino.fechaISO,
              posX: destino.posXCelda, posY: destino.posYCelda,
            });
            playSound('pop');
            await cargar();
            subirStickersPendientes().catch(() => {});
          }
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
          if (p) { await actualizarTransformStickerLocal(id, { rotacion: p.rotacion }); subirStickersPendientes().catch(() => {}); }
        } else {
          const n = notas.find((nn) => nn.id === id);
          if (n) { await actualizarNotaLocal(id, { rotacion: n.rotacion }); subirNotasPendientes().catch(() => {}); }
        }
        return;
      }

      if (escalando.current) {
        const { id } = escalando.current;
        escalando.current = null;
        setModoInteraccion('ninguno');
        const p = placements.find((pl) => pl.id === id);
        if (p) { await actualizarTransformStickerLocal(id, { escala: p.escala }); subirStickersPendientes().catch(() => {}); }
        return;
      }

      if (gestoPendiente.current) {
        const { id } = gestoPendiente.current;
        const fueArrastre = !!arrastrando.current;
        gestoPendiente.current = null;
        if (!fueArrastre) { setSeleccionId(id); return; }
      }

      if (!arrastrando.current) return;
      const { tipo, id } = arrastrando.current;
      arrastrando.current = null;
      setModoInteraccion('ninguno');
      const posicionFinal = dragVisual;
      setDragVisual(null);

      if (sobreBasurero) {
        setSobreBasurero(false);
        playSound('eliminar');
        if (tipo === 'sticker') {
          setPlacements((prev) => prev.filter((p) => p.id !== id));
          await quitarStickerLocal(id);
          subirStickersPendientes().catch(() => {});
        } else {
          setNotas((prev) => prev.filter((n) => n.id !== id));
          await eliminarNotaLocal(id);
          subirNotasPendientes().catch(() => {});
        }
        setSeleccionId(null);
        return;
      }

      if (!posicionFinal) return;
      const destino = diaYCeldaDesdeAbsoluta(dias, posicionFinal.xPct, posicionFinal.yPct);
      if (!destino) return;

      playSound('pegar');
      if (tipo === 'sticker') {
        await migrarPlacementADia(id, destino.fechaISO, destino.posXCelda, destino.posYCelda);
        setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, target_dia: destino.fechaISO, pos_x: destino.posXCelda, pos_y: destino.posYCelda } : p)));
        subirStickersPendientes().catch(() => {});
      } else {
        await migrarNotaADia(id, destino.fechaISO, destino.posXCelda, destino.posYCelda);
        setNotas((prev) => prev.map((n) => (n.id === id ? { ...n, target_dia: destino.fechaISO, pos_x: destino.posXCelda, pos_y: destino.posYCelda } : n)));
        subirNotasPendientes().catch(() => {});
      }
    } finally {
      if (decoDragRef) decoDragRef.current = false;
    }
  }

  useEffect(() => {
    function onMove(e: PointerEvent) { mover(e.clientX, e.clientY); }
    function onUp(e: PointerEvent) { soltar(e.clientX, e.clientY); }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placements, notas, fantasma, sobreBasurero, dragVisual]);

  useEffect(() => {
    function midpoint(t1: Touch, t2: Touch) {
      return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
    }

    function onTouchStartGlobal(e: TouchEvent) {
      if (!editable || e.touches.length !== 2) return;
      const activo = gestoPendiente.current || arrastrando.current;
      if (!activo) return;
      e.preventDefault();

      const { tipo, id } = activo;
      gestoPendiente.current = null;
      arrastrando.current = null;

      const item = tipo === 'sticker' ? placements.find((p) => p.id === id) : notas.find((n) => n.id === id);
      if (!item) return;

      const t1 = e.touches[0], t2 = e.touches[1];
      const mid = midpoint(t1, t2);
      dosDedos.current = {
        tipo, id,
        distanciaInicial: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
        anguloInicial: Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX),
        escalaInicial: tipo === 'sticker' ? (item as StickerPlacementLocal).escala : 1,
        rotacionInicial: item.rotacion,
      };
      const { x, y } = posDesdeAbs(mid.x, mid.y);
      setDragVisual({ id, xPct: x, yPct: y });
      if (decoDragRef) decoDragRef.current = true;
      setSeleccionId(id);
      setModoInteraccion(tipo === 'sticker' ? 'escalando' : 'girando');
    }

    function onTouchMoveGlobal(e: TouchEvent) {
      if (!dosDedos.current || e.touches.length < 2) return;
      e.preventDefault();
      const { tipo, id, distanciaInicial, anguloInicial, escalaInicial, rotacionInicial } = dosDedos.current;
      const t1 = e.touches[0], t2 = e.touches[1];
      const nuevaDistancia = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const nuevoAngulo = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
      const nuevaRotacion = rotacionInicial + ((nuevoAngulo - anguloInicial) * 180) / Math.PI;

      const mid = midpoint(t1, t2);
      const { x, y } = posDesdeAbs(mid.x, mid.y);
      setDragVisual({ id, xPct: x, yPct: y });

      if (tipo === 'sticker') {
        const nuevaEscala = Math.min(3, Math.max(0.4, escalaInicial * (nuevaDistancia / distanciaInicial)));
        setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, escala: nuevaEscala, rotacion: nuevaRotacion } : p)));
      } else {
        setNotas((prev) => prev.map((n) => (n.id === id ? { ...n, rotacion: nuevaRotacion } : n)));
      }
    }

    async function onTouchEndGlobal(e: TouchEvent) {
      if (!dosDedos.current || e.touches.length >= 2) return;
      const { tipo, id } = dosDedos.current;
      dosDedos.current = null;
      setModoInteraccion('ninguno');
      if (decoDragRef) decoDragRef.current = false;
      playSound('pegar');

      const posicionFinal = dragVisual;
      setDragVisual(null);
      const destino = posicionFinal ? diaYCeldaDesdeAbsoluta(dias, posicionFinal.xPct, posicionFinal.yPct) : null;

      if (tipo === 'sticker') {
        const p = placements.find((pl) => pl.id === id);
        if (p) {
          if (destino) {
            await migrarPlacementADia(id, destino.fechaISO, destino.posXCelda, destino.posYCelda);
            setPlacements((prev) => prev.map((pl) => (pl.id === id ? { ...pl, target_dia: destino.fechaISO, pos_x: destino.posXCelda, pos_y: destino.posYCelda } : pl)));
          }
          await actualizarTransformStickerLocal(id, { escala: p.escala, rotacion: p.rotacion });
          subirStickersPendientes().catch(() => {});
        }
      } else {
        const n = notas.find((nn) => nn.id === id);
        if (n) {
          if (destino) {
            await migrarNotaADia(id, destino.fechaISO, destino.posXCelda, destino.posYCelda);
            setNotas((prev) => prev.map((nn) => (nn.id === id ? { ...nn, target_dia: destino.fechaISO, pos_x: destino.posXCelda, pos_y: destino.posYCelda } : nn)));
          }
          await actualizarNotaLocal(id, { rotacion: n.rotacion });
          subirNotasPendientes().catch(() => {});
        }
      }
    }

    window.addEventListener('touchstart', onTouchStartGlobal, { passive: false });
    window.addEventListener('touchmove', onTouchMoveGlobal, { passive: false });
    window.addEventListener('touchend', onTouchEndGlobal);
    window.addEventListener('touchcancel', onTouchEndGlobal);
    return () => {
      window.removeEventListener('touchstart', onTouchStartGlobal);
      window.removeEventListener('touchmove', onTouchMoveGlobal);
      window.removeEventListener('touchend', onTouchEndGlobal);
      window.removeEventListener('touchcancel', onTouchEndGlobal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placements, notas, editable]);

  useEffect(() => {
    function onGlobalPointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-deco-item]')) setSeleccionId(null);
    }
    window.addEventListener('pointerdown', onGlobalPointerDown);
    return () => window.removeEventListener('pointerdown', onGlobalPointerDown);
  }, []);

  async function handleEditarNota(id: string, contenido: string) {
    setNotas((prev) => prev.map((n) => (n.id === id ? { ...n, contenido } : n)));
    await actualizarNotaLocal(id, { contenido });
    subirNotasPendientes().catch(() => {});
  }

  async function handleCambiarColorNota(id: string, color: string) {
    setNotas((prev) => prev.map((n) => (n.id === id ? { ...n, color } : n)));
    await actualizarNotaLocal(id, { color });
    subirNotasPendientes().catch(() => {});
  }

  const mostrarBasurero = editable && (modoInteraccion === 'arrastrando' || !!fantasma);
  const factorDispositivo = esMovil ? MULTIPLICADOR_MOVIL : 1;
  const anchoSticker = Math.round(cellWidthPx * ESCALA_STICKER_WEB * factorDispositivo);
  const anchoNota = Math.round(cellWidthPx * ESCALA_NOTA_WEB * factorDispositivo);

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
          const arrastrandoEste = dragVisual?.id === p.id;
          const abs = arrastrandoEste
            ? { leftPct: dragVisual!.xPct, topPct: dragVisual!.yPct }
            : posicionAbsoluta(dias, p.target_dia, p.pos_x, p.pos_y);
          if (!abs) return null;
          const anguloTotal = arrastrandoEste ? p.rotacion + anguloBalanceo : p.rotacion;
          const cargado = imgsCargados.has(p.id);

          return (
            <div
              key={p.id}
              className="pointer-events-none absolute"
              style={{ left: `${abs.leftPct}%`, top: `${abs.topPct}%`, zIndex: seleccionado ? 50 : p.z_index }}
            >
              <div
                data-deco-item
                className={`pointer-events-auto relative ${cargado ? 'animate-[stickerPop_0.25s_ease-out]' : ''}`}
                style={{
                  transform: `translate(-50%, -50%) rotate(${anguloTotal}deg) scale(${arrastrandoEste || seleccionado ? p.escala * 1.1 : p.escala})`,
                  transformOrigin: arrastrandoEste ? `${pivoteRelativo.xPct}% ${pivoteRelativo.yPct}%` : 'center center',
                  touchAction: 'none',
                  transition: modoInteraccion === 'ninguno' && !arrastrandoEste ? 'transform 0.15s ease-out' : 'none',
                }}
                onPointerDown={(e) => onPointerDownItem('sticker', p.id, e)}
                onClick={(e) => e.stopPropagation()}
              >
                {!cargado && (
                  <div
                    className="flex items-center justify-center"
                    style={{ width: anchoSticker, height: anchoSticker }}
                  >
                    <Loader2 size={Math.max(14, anchoSticker * 0.4)} className="animate-spin text-[var(--color-text-muted)]" />
                  </div>
                )}
                <img
                  src={asset.url}
                  alt={asset.nombre}
                  onLoad={() => marcarCargado(p.id)}
                  style={{ width: anchoSticker, display: cargado ? 'block' : 'none' }}
                  className="select-none drop-shadow-md"
                  draggable={false}
                />
                {editable && seleccionado && !arrastrandoEste && cargado && (
                  <>
                    <div
                      onPointerDown={(e) => { e.stopPropagation(); iniciarEscala(p.id, e.clientX, e.clientY); }}
                      className="absolute -bottom-1.5 -right-1.5 hidden h-6 w-6 cursor-nwse-resize select-none items-center justify-center rounded-full border-2 border-[var(--color-bg-elevated)] bg-[var(--color-primary)] text-[var(--color-text-inverse)] shadow-[var(--sombra-panel-suave)] transition-transform hover:scale-110 sm:flex"
                      style={{ transform: `scale(${1 / (p.escala * 1.1)})` }}
                      title="Arrastra para agrandar o achicar"
                    >
                      <ArrowDownRight size={12} strokeWidth={2.75} />
                    </div>
                    <div
                      onPointerDown={(e) => { e.stopPropagation(); iniciarGiro('sticker', p.id); }}
                      className="absolute -top-1.5 -left-1.5 hidden h-6 w-6 cursor-grab select-none items-center justify-center rounded-full border-2 border-[var(--color-bg-elevated)] bg-[var(--color-wood)] text-[var(--color-text-inverse)] shadow-[var(--sombra-panel-suave)] transition-transform hover:scale-110 active:cursor-grabbing sm:flex"
                      style={{ transform: `scale(${1 / (p.escala * 1.1)})` }}
                      title="Arrastra para girar"
                    >
                      <RotateCw size={12} strokeWidth={2.75} />
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {notas.map((n) => {
          const seleccionada = seleccionId === n.id;
          const arrastrandoEste = dragVisual?.id === n.id;
          const abs = arrastrandoEste
            ? { leftPct: dragVisual!.xPct, topPct: dragVisual!.yPct }
            : posicionAbsoluta(dias, n.target_dia, n.pos_x, n.pos_y);
          if (!abs) return null;
          const anguloTotal = arrastrandoEste ? n.rotacion + anguloBalanceo : n.rotacion;

          return (
            <div
              key={n.id}
              className="pointer-events-none absolute"
              style={{ left: `${abs.leftPct}%`, top: `${abs.topPct}%`, width: anchoNota, zIndex: seleccionada ? 50 : n.z_index }}
            >
              <div
                data-deco-item
                className="pointer-events-auto relative animate-[stickerPop_0.25s_ease-out]"
                style={{
                  transform: `translate(-50%, -50%) rotate(${anguloTotal}deg) scale(${arrastrandoEste || seleccionada ? 1.08 : 1})`,
                  transformOrigin: arrastrandoEste ? `${pivoteRelativo.xPct}% ${pivoteRelativo.yPct}%` : 'center center',
                  touchAction: 'none',
                  transition: modoInteraccion === 'ninguno' && !arrastrandoEste ? 'transform 0.15s ease-out' : 'none',
                }}
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
                  className="rounded-lg p-2 pt-4 text-[10px] shadow-md"
                  style={{ backgroundColor: n.color }}
                  onClick={(e) => { e.stopPropagation(); if (editable) setSeleccionId(n.id); }}
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

              {editable && seleccionada && !arrastrandoEste && (
                <div
                  data-deco-item
                  className="pointer-events-auto absolute left-1/2 top-20 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-full bg-white px-2 py-1 shadow-lg"
                  style={{ width: 150 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onPointerDown={(e) => { e.stopPropagation(); iniciarGiro('nota', n.id); }}
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
                    <div className="h-4 w-4 rounded-full" style={{ background: 'conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)' }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {montado && createPortal(
        <>
          {mostrarBasurero && (
            <div ref={basureroRef} className="fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-1.5">
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-full border-2 shadow-xl transition-all duration-200 ${
                  sobreBasurero ? 'scale-125 border-[var(--color-danger)] bg-[var(--color-danger)]' : 'border-[var(--color-wood-dark)] bg-[var(--color-bg-elevated)]'
                }`}
              >
                <Trash2 size={26} strokeWidth={2.2} className={sobreBasurero ? 'text-white' : 'text-[var(--color-text-muted)]'} />
              </div>
              {sobreBasurero && (
                <span className="animar-entrada rounded-full bg-[var(--color-danger)] px-2.5 py-0.5 text-[10px] font-semibold text-white shadow">
                  Suelta para eliminar
                </span>
              )}
            </div>
          )}
          {fantasma && (
            <img
              src={fantasma.url}
              alt=""
              className="pointer-events-none fixed z-[110] w-16 opacity-80 drop-shadow-lg"
              style={{ left: fantasma.x, top: fantasma.y, transform: 'translate(-50%, -50%)' }}
            />
          )}
        </>,
        document.body
      )}
    </>
  );
}