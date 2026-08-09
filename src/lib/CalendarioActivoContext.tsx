// src/lib/CalendarioActivoContext.tsx
'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabase';
import { ensureDeviceRegistered } from './device';
import { obtenerCalendariosDisponibles, type CalendarioDisponible } from './vinculos';
import { subirCambiosPendientes } from './sync';
import { descargarDesdeNube } from './localData';

const STORAGE_KEY = 'nc_calendario_activo_owner_id';
const INTERVALO_SYNC_MS = 45_000;

export type EstadoSync = 'idle' | 'syncing' | 'offline' | 'error';

type ContextoCalendario = {
  userId: string | null;
  calendarioActivo: CalendarioDisponible | null;
  opciones: CalendarioDisponible[];
  seleccionarCalendario: (ownerId: string) => void;
  cargando: boolean;
  estadoSync: EstadoSync;
  ultimaSync: Date | null;
  syncTick: number; // se incrementa tras cada intento de sync — las páginas lo usan como señal para recargar sus datos locales
  sincronizarAhora: () => Promise<void>;
  primerSyncCompleto: boolean;
};

const Contexto = createContext<ContextoCalendario | null>(null);

export function CalendarioActivoProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [opciones, setOpciones] = useState<CalendarioDisponible[]>([]);
  const [calendarioActivo, setCalendarioActivo] = useState<CalendarioDisponible | null>(null);
  const [cargando, setCargando] = useState(true);
  const [estadoSync, setEstadoSync] = useState<EstadoSync>('idle');
  const [ultimaSync, setUltimaSync] = useState<Date | null>(null);
  const [syncTick, setSyncTick] = useState(0);
  const router = useRouter(); 
  const [primerSyncCompleto, setPrimerSyncCompleto] = useState(false);

  // Evita sync solapados si el usuario toca el botón varias veces seguidas
  // o si dos disparadores (intervalo + visibilitychange) coinciden.
  const sincronizandoRef = useRef(false);

  const cargarOpciones = useCallback(async (uid: string) => {
    const disponibles = await obtenerCalendariosDisponibles(uid);
    setOpciones(disponibles);

    const guardadoId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    const recuperado = disponibles.find((c) => c.ownerId === guardadoId);
    setCalendarioActivo(recuperado ?? disponibles[0]);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.push('/login');
        return;
      }
      const uid = data.session.user.id;
      try {
        await ensureDeviceRegistered(uid);
      } catch (err) {
        console.error('Error registrando dispositivo:', err);
      }
      setUserId(uid);
      await cargarOpciones(uid);
      setCargando(false);
    });
  }, [router, cargarOpciones]);

  function seleccionarCalendario(ownerId: string) {
    const encontrado = opciones.find((o) => o.ownerId === ownerId);
    if (!encontrado) return;
    setCalendarioActivo(encontrado);
    localStorage.setItem(STORAGE_KEY, ownerId);
  }

  const sincronizarAhora = useCallback(async () => {
    if (!calendarioActivo || sincronizandoRef.current) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setEstadoSync('offline');
      return;
    }

    sincronizandoRef.current = true;
    setEstadoSync('syncing');
    try {
      await subirCambiosPendientes();
      await descargarDesdeNube(calendarioActivo.ownerId);
      setUltimaSync(new Date());
      setEstadoSync('idle');
    } catch (err) {
      console.error('Error sincronizando:', err);
      setEstadoSync('error');
    } finally {
      sincronizandoRef.current = false;
      setSyncTick((t) => t + 1);
      setPrimerSyncCompleto(true); // aunque falle, no queremos bloquear la app para siempre
    }
  }, [calendarioActivo]);

  // Sync al montar (cuando ya se sabe qué calendario está activo) y cada
  // vez que cambia el calendario activo (ej. cambias de "mi calendario" al
  // de tu pareja).
  useEffect(() => {
    if (!calendarioActivo) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dispara el motor de sync al tener calendario activo
    sincronizarAhora();
  }, [calendarioActivo, sincronizarAhora]);

  // Disparadores automáticos: intervalo mientras hay internet, al
  // recuperar conexión, y al volver a primer plano (pestaña/app).
  useEffect(() => {
    const intervalo = setInterval(() => {
      if (navigator.onLine) sincronizarAhora();
    }, INTERVALO_SYNC_MS);

    function alVolverOnline() {
      sincronizarAhora();
    }
    function alCambiarVisibilidad() {
      if (document.visibilityState === 'visible') sincronizarAhora();
    }

    window.addEventListener('online', alVolverOnline);
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    window.addEventListener('focus', alCambiarVisibilidad);

    return () => {
      clearInterval(intervalo);
      window.removeEventListener('online', alVolverOnline);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      window.removeEventListener('focus', alCambiarVisibilidad);
    };
  }, [sincronizarAhora]);

  return (
    <Contexto.Provider
      value={{
        userId,
        calendarioActivo,
        opciones,
        seleccionarCalendario,
        cargando,
        estadoSync,
        ultimaSync,
        syncTick,
        sincronizarAhora,
        primerSyncCompleto,
      }}
    >
      {children}
    </Contexto.Provider>
  );
}

export function useCalendarioActivo() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useCalendarioActivo debe usarse dentro de CalendarioActivoProvider');
  return ctx;
}