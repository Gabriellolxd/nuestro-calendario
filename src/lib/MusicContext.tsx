// src/lib/MusicContext.tsx
'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { PISTAS_MUSICA } from './musicTracks';
import { playSound } from './soundManager';
import { attachGlobalUiSounds } from './globalUiSounds';

type Ctx = {
  silenciado: boolean;
  volumen: number;
  pistaActual: string | null;
  alternarSilencio: () => void;
  cambiarVolumen: (v: number) => void;
  siguienteCancion: () => void;
};

const MusicContext = createContext<Ctx | null>(null);
const KEY_MUTE = 'nc_musica_silenciada';
const KEY_VOL = 'nc_musica_volumen';

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ordenRef = useRef<number[]>([]);
  const indiceRef = useRef(0);
  const desbloqueadoRef = useRef(false);
  const [silenciado, setSilenciado] = useState(false);
  const [volumen, setVolumen] = useState(0.4);
  const [pistaActual, setPistaActual] = useState<string | null>(null);

  useEffect(() => {
    try {
      const m = localStorage.getItem(KEY_MUTE);
      const v = localStorage.getItem(KEY_VOL);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (m !== null) setSilenciado(m === '1');
      if (v !== null) setVolumen(Number(v));
    } catch {}
  }, []);

  const barajar = useCallback(() => {
    const idx = PISTAS_MUSICA.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    ordenRef.current = idx;
    indiceRef.current = 0;
  }, []);

  const reproducirSiguiente = useCallback(() => {
    if (PISTAS_MUSICA.length === 0) return;
    if (ordenRef.current.length === 0 || indiceRef.current >= ordenRef.current.length) barajar();
    const pista = PISTAS_MUSICA[ordenRef.current[indiceRef.current]];
    indiceRef.current += 1;
    if (!pista) return;

    if (!audioRef.current) {
      audioRef.current = new Audio();
      // eslint-disable-next-line react-hooks/immutability
      audioRef.current.addEventListener('ended', () => reproducirSiguiente());
      audioRef.current.addEventListener('error', () => reproducirSiguiente());
    }
    audioRef.current.src = pista.archivo;
    audioRef.current.volume = volumen;
    audioRef.current.play().catch(() => {});
    setPistaActual(pista.nombre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volumen]);

  useEffect(() => {
    attachGlobalUiSounds();

    function iniciar() {
      if (desbloqueadoRef.current) return;
      desbloqueadoRef.current = true;
      window.removeEventListener('pointerdown', iniciar);
      window.removeEventListener('keydown', iniciar);
      playSound('inicio');
      if (!silenciado) setTimeout(() => reproducirSiguiente(), 900);
    }
    window.addEventListener('pointerdown', iniciar);
    window.addEventListener('keydown', iniciar);
    return () => {
      window.removeEventListener('pointerdown', iniciar);
      window.removeEventListener('keydown', iniciar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volumen;
    try { localStorage.setItem(KEY_VOL, String(volumen)); } catch {}
  }, [volumen]);

  useEffect(() => {
    try { localStorage.setItem(KEY_MUTE, silenciado ? '1' : '0'); } catch {}
    if (!audioRef.current) return;
    if (silenciado) {
      audioRef.current.pause();
    } else if (desbloqueadoRef.current) {
      if (audioRef.current.src) audioRef.current.play().catch(() => {});
      else reproducirSiguiente();
    }
  }, [silenciado, reproducirSiguiente]);

  return (
    <MusicContext.Provider
      value={{
        silenciado,
        volumen,
        pistaActual,
        alternarSilencio: () => setSilenciado((s) => !s),
        cambiarVolumen: (v) => setVolumen(Math.min(1, Math.max(0, v))),
        siguienteCancion: () => reproducirSiguiente(),
      }}
    >
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useMusic debe usarse dentro de MusicProvider');
  return ctx;
}