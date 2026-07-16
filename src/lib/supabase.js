// src/lib/supabase.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan las variables de entorno de Supabase en .env.local');
}

// Preferencia de "recordarme": se guarda SIEMPRE en localStorage (es solo
// el string 'true'/'false', no el token de sesión). Por defecto, si no hay
// preferencia guardada todavía, se recuerda la sesión (casilla marcada
// por defecto, tal como pediste).
const PREF_KEY = 'nc_recordarme';

function storageElegido() {
  if (typeof window === 'undefined') return undefined;
  const recordar = localStorage.getItem(PREF_KEY);
  return recordar === 'false' ? window.sessionStorage : window.localStorage;
}

// Adaptador de storage que usa Supabase para guardar el token de sesión.
// Se evalúa en cada llamada (no queda fijo al crear el cliente), así que
// respeta el cambio de preferencia entre un login y otro.
const storageAdaptativo = {
  getItem: (key) => storageElegido()?.getItem(key) ?? null,
  setItem: (key, value) => storageElegido()?.setItem(key, value),
  removeItem: (key) => storageElegido()?.removeItem(key),
};

export function setPreferenciaRecordarme(recordar) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREF_KEY, String(recordar));
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: storageAdaptativo,
    persistSession: true,
    autoRefreshToken: true,
  },
});