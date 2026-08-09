// src/lib/useNotificacionesWeb.ts
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { calcularProximasNotificaciones, type NotificacionProxima } from './webNotifications';

const INTERVALO_MS = 20_000;
const TOLERANCIA_MS = 20_000;

export function useNotificacionesWeb(ownerIds: string[]) {
  const [toast, setToast] = useState<NotificacionProxima | null>(null);
  const disparadasRef = useRef<Set<string>>(new Set());
  const audioDesbloqueadoRef = useRef(false);

  // El navegador exige al menos una interacción del usuario antes de
  // permitir reproducir audio con sonido — se "desbloquea" con el primer
  // toque/clic/tecla en cualquier parte de la app.
  useEffect(() => {
    function desbloquear() {
      audioDesbloqueadoRef.current = true;
      window.removeEventListener('pointerdown', desbloquear);
      window.removeEventListener('keydown', desbloquear);
    }
    window.addEventListener('pointerdown', desbloquear);
    window.addEventListener('keydown', desbloquear);
    return () => {
      window.removeEventListener('pointerdown', desbloquear);
      window.removeEventListener('keydown', desbloquear);
    };
  }, []);

  const revisar = useCallback(async () => {
    if (Capacitor.isNativePlatform()) return;
    if (ownerIds.length === 0) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

    try {
      const proximas = await calcularProximasNotificaciones(ownerIds);
      const ahora = Date.now();

      for (const n of proximas) {
        if (disparadasRef.current.has(n.id)) continue;
        const diff = ahora - n.hora.getTime();
        if (diff >= 0 && diff <= TOLERANCIA_MS) {
          disparadasRef.current.add(n.id);
          setToast(n);

          if (audioDesbloqueadoRef.current) {
            try {
              const audio = new Audio(`/sonidos/${n.tono}.mp3`);
              audio.volume = 0.7;
              await audio.play();
            } catch (err) {
              console.error('No se pudo reproducir el sonido de notificación:', err);
            }
          } else {
            console.warn('Sonido de notificación omitido: el navegador aún no permite audio (falta interacción del usuario).');
          }
          break;
        }
      }
    } catch (err) {
      console.error('Error revisando notificaciones web:', err);
    }
  }, [ownerIds]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    revisar();
    const intervalo = setInterval(revisar, INTERVALO_MS);

    // Al volver a la pestaña (minimizada, cambio de app en el celular),
    // revisa de inmediato en vez de esperar al próximo tick del intervalo.
    function alCambiarVisibilidad() {
      if (document.visibilityState === 'visible') revisar();
    }
    document.addEventListener('visibilitychange', alCambiarVisibilidad);

    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, [revisar]);

  return { toast, cerrarToast: () => setToast(null) };
}