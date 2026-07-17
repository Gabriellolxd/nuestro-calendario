// src/lib/supabaseAdmin.ts
// SOLO para uso dentro de rutas API (código que corre en el servidor).
// NUNCA importar esto desde un componente 'use client' — la service_role
// key ignora RLS por completo y jamás debe llegar al navegador.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Faltan las variables de entorno de Supabase (service role) en .env.local');
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});