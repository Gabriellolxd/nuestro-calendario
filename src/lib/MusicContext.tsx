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
const KEY_VOL = 'nc_musica_volumen';

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ordenRef = useRef<number[]>([]);
  const indiceRef = useRef(0);
  // La app SIEMPRE arranca en silencio — el usuario decide si quiere
  // música tocando el ícono. Es la única fuente de verdad: no hay ningún
  // otro camino de código que intente iniciar el audio por su cuenta.
  const [silenciado, setSilenciado] = useState(true);
  const [volumen, setVolumen] = useState(0.4);
  const [pistaActual, setPistaActual] = useState<string | null>(null);

  useEffect(() => {
    attachGlobalUiSounds();
    try {
      const v = localStorage.getItem(KEY_VOL);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura el volumen guardado al montar (localStorage no es reactivo)
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

  const reproducirSiguienteRef = useRef<() => void>(() => {});

  const reproducirSiguiente = useCallback(() => {
    if (PISTAS_MUSICA.length === 0) return;
    if (ordenRef.current.length === 0 || indiceRef.current >= ordenRef.current.length) barajar();
    const pista = PISTAS_MUSICA[ordenRef.current[indiceRef.current]];
    indiceRef.current += 1;
    if (!pista) return;

    if (!audioRef.current) {
      audioRef.current = new Audio();
      // Se llama a través del ref (no directamente a reproducirSiguiente)
      // para evitar la auto-referencia dentro del propio useCallback —
      // el ref siempre apunta a la versión más reciente de la función.
      audioRef.current.addEventListener('ended', () => reproducirSiguienteRef.current());
      audioRef.current.addEventListener('error', () => reproducirSiguienteRef.current());
    }
    audioRef.current.src = pista.archivo;
    audioRef.current.volume = volumen;
    audioRef.current.play().catch(() => {
      // El navegador rechazó reproducir — reflejamos la realidad en el
      // ícono en vez de dejarlo mintiendo.
      setSilenciado(true);
    });
    setPistaActual(pista.nombre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volumen]);

  useEffect(() => {
    reproducirSiguienteRef.current = reproducirSiguiente;
  }, [reproducirSiguiente]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volumen;
    try { localStorage.setItem(KEY_VOL, String(volumen)); } catch {}
  }, [volumen]);

  // Único lugar que decide play/pause — reacciona SOLO al estado
  // `silenciado`, así el ícono y el audio nunca pueden desincronizarse.
  useEffect(() => {
    if (silenciado) {
      audioRef.current?.pause();
      return;
    }
    if (!audioRef.current || !audioRef.current.src) {
      reproducirSiguiente();
    } else {
      audioRef.current.play().catch(() => setSilenciado(true));
    }
  }, [silenciado, reproducirSiguiente]);

  return (
    <MusicContext.Provider
      value={{
        silenciado,
        volumen,
        pistaActual,
        alternarSilencio: () => {
          playSound('click');
          setSilenciado((s) => !s);
        },
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