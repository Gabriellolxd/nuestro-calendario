// src/lib/soundManager.ts
'use client';

const CACHE: Record<string, HTMLAudioElement> = {};
const BASE = '/sonidos/ui/';

function obtenerAudio(nombre: string): HTMLAudioElement {
  if (!CACHE[nombre]) {
    const audio = new Audio(`${BASE}${nombre}.mp3`);
    audio.preload = 'auto';
    CACHE[nombre] = audio;
  }
  return CACHE[nombre];
}

let sfxHabilitado = true;
try {
  sfxHabilitado = typeof window !== 'undefined' && localStorage.getItem('nc_sfx_habilitado') !== '0';
} catch {}

export function setSfxHabilitado(valor: boolean) {
  sfxHabilitado = valor;
  try { localStorage.setItem('nc_sfx_habilitado', valor ? '1' : '0'); } catch {}
}

export function sfxEstaHabilitado(): boolean {
  return sfxHabilitado;
}

// Reproduce un efecto de interfaz. Si el archivo específico falla o no
// existe, intenta un sonido genérico de respaldo; si ese tampoco existe,
// queda en silencio total sin lanzar ningún error visible.
export function playSound(nombre: string) {
  if (typeof window === 'undefined' || !sfxHabilitado) return;
  try {
    const audio = obtenerAudio(nombre).cloneNode(true) as HTMLAudioElement;
    audio.volume = 0.55;
    audio.play().catch(() => {
      if (nombre === 'click') return;
      try {
        const respaldo = obtenerAudio('click').cloneNode(true) as HTMLAudioElement;
        respaldo.volume = 0.4;
        respaldo.play().catch(() => {});
      } catch {}
    });
  } catch {
    // nunca debe romper la app
  }
}