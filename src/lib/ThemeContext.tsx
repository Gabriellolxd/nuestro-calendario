// src/lib/ThemeContext.tsx
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type ModoTema = 'claro' | 'oscuro' | 'personalizado';

export type ColoresPersonalizados = {
  primary: string;
  wood: string;
  gold: string;
  sage: string;
  bg: string;
};

const STORAGE_KEY_MODO = 'nc_theme_modo';
const STORAGE_KEY_COLORES = 'nc_theme_colores_personalizados';

const COLORES_DEFAULT: ColoresPersonalizados = {
  primary: '#c1694f',
  wood: '#6f4e37',
  gold: '#d4a574',
  sage: '#7c8f5c',
  bg: '#fbf3e7',
};

type ContextoTema = {
  modo: ModoTema;
  cambiarModo: (m: ModoTema) => void;
  colores: ColoresPersonalizados;
  actualizarColorPersonalizado: (clave: keyof ColoresPersonalizados, valor: string) => void;
};

const Contexto = createContext<ContextoTema | null>(null);

function aplicarPersonalizado(colores: ColoresPersonalizados) {
  const root = document.documentElement;
  root.style.setProperty('--color-primary', colores.primary);
  root.style.setProperty('--color-wood', colores.wood);
  root.style.setProperty('--color-gold', colores.gold);
  root.style.setProperty('--color-sage', colores.sage);
  root.style.setProperty('--color-bg', colores.bg);
}

function limpiarPersonalizado() {
  const root = document.documentElement;
  ['--color-primary', '--color-wood', '--color-gold', '--color-sage', '--color-bg'].forEach((v) =>
    root.style.removeProperty(v)
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [modo, setModo] = useState<ModoTema>('claro');
  const [colores, setColores] = useState<ColoresPersonalizados>(COLORES_DEFAULT);

  useEffect(() => {
    const modoGuardado = localStorage.getItem(STORAGE_KEY_MODO) as ModoTema | null;
    const coloresGuardados = localStorage.getItem(STORAGE_KEY_COLORES);
    const modoInicial = modoGuardado ?? 'claro';
    const coloresIniciales = coloresGuardados ? JSON.parse(coloresGuardados) : COLORES_DEFAULT;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura la preferencia guardada al montar (localStorage no es reactivo)
    setModo(modoInicial);
    setColores(coloresIniciales);

    document.documentElement.setAttribute('data-theme', modoInicial === 'oscuro' ? 'dark' : 'light');
    if (modoInicial === 'personalizado') aplicarPersonalizado(coloresIniciales);
  }, []);

  const cambiarModo = useCallback((m: ModoTema) => {
    setModo(m);
    localStorage.setItem(STORAGE_KEY_MODO, m);
    document.documentElement.setAttribute('data-theme', m === 'oscuro' ? 'dark' : 'light');
    if (m === 'personalizado') {
      aplicarPersonalizado(colores);
    } else {
      limpiarPersonalizado();
    }
  }, [colores]);

  const actualizarColorPersonalizado = useCallback((clave: keyof ColoresPersonalizados, valor: string) => {
    setColores((prev) => {
      const nuevos = { ...prev, [clave]: valor };
      localStorage.setItem(STORAGE_KEY_COLORES, JSON.stringify(nuevos));
      if (modo === 'personalizado') aplicarPersonalizado(nuevos);
      return nuevos;
    });
  }, [modo]);

  return (
    <Contexto.Provider value={{ modo, cambiarModo, colores, actualizarColorPersonalizado }}>
      {children}
    </Contexto.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return ctx;
}