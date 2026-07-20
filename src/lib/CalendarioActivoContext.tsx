// src/lib/CalendarioActivoContext.tsx
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabase';
import { ensureDeviceRegistered } from './device';
import { obtenerCalendariosDisponibles, type CalendarioDisponible } from './vinculos';

const STORAGE_KEY = 'nc_calendario_activo_owner_id';

type ContextoCalendario = {
  userId: string | null;
  calendarioActivo: CalendarioDisponible | null;
  opciones: CalendarioDisponible[];
  seleccionarCalendario: (ownerId: string) => void;
  cargando: boolean;
};

const Contexto = createContext<ContextoCalendario | null>(null);

export function CalendarioActivoProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [opciones, setOpciones] = useState<CalendarioDisponible[]>([]);
  const [calendarioActivo, setCalendarioActivo] = useState<CalendarioDisponible | null>(null);
  const [cargando, setCargando] = useState(true);
  const router = useRouter();

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

  return (
    <Contexto.Provider value={{ userId, calendarioActivo, opciones, seleccionarCalendario, cargando }}>
      {children}
    </Contexto.Provider>
  );
}

export function useCalendarioActivo() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useCalendarioActivo debe usarse dentro de CalendarioActivoProvider');
  return ctx;
}