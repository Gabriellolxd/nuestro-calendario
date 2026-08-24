// src/lib/globalUiSounds.ts
'use client';

import { playSound } from './soundManager';

let attached = false;
let ultimoHover = 0;

// Delegación global: cualquier <button> de la app suena al hacer clic
// (y opcionalmente al pasar el mouse en escritorio). Se adjunta una sola
// vez para toda la sesión. Agrega data-no-sfx a un botón puntual si
// alguna vez quieres que NO suene (ej. algo que ya tiene su propio sonido
// específico y sonaría duplicado).
export function attachGlobalUiSounds() {
  if (attached || typeof window === 'undefined') return;
  attached = true;

  document.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement)?.closest('button, [role="button"]');
    if (target && !target.hasAttribute('data-no-sfx')) {
      playSound('click');
    }
  });

  document.addEventListener('pointerover', (e) => {
    const evento = e as PointerEvent;
    if (evento.pointerType === 'touch') return; // sin "hover" real en táctil
    const target = (e.target as HTMLElement)?.closest('button, [role="button"]');
    if (!target || target.hasAttribute('data-no-sfx')) return;
    const ahora = Date.now();
    if (ahora - ultimoHover < 150) return; // evita ráfaga al pasar rápido por varios botones seguidos
    ultimoHover = ahora;
    playSound('hover');
  });
}