// src/app/login/page.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ensureDeviceRegistered } from '@/lib/device';
import { setPreferenciaRecordarme } from '@/lib/supabase';

export default function LoginPage() {
  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [recordarme, setRecordarme] = useState(true); // marcada por defecto
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);
    setPreferenciaRecordarme(recordarme);

    try {
        const { data, error: authError } =
            modo === 'login'
            ? await supabase.auth.signInWithPassword({ email, password })
            : await supabase.auth.signUp({ email, password });

        if (authError) throw authError;

        // Si no hay sesión activa, es porque falta confirmar el correo.
        // No intentamos nada más hasta que sí haya sesión real.
        if (!data.session) {
            setError('Cuenta creada. Revisa tu correo y confirma antes de iniciar sesión.');
            setCargando(false);
            return;
        }

        await ensureDeviceRegistered(data.session.user.id);
        router.push('/calendario');
        } catch (err) {
        const mensaje = err instanceof Error ? err.message : 'Ocurrió un error.';
        setError(mensaje);
        } finally {
        setCargando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-semibold text-gray-800">
          {modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
          />

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={recordarme}
              onChange={(e) => setRecordarme(e.target.checked)}
            />
            Recordar mi sesión en este dispositivo
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-lg bg-pink-500 py-2 font-medium text-white transition hover:bg-pink-600 disabled:opacity-50"
          >
            {cargando ? 'Cargando...' : modo === 'login' ? 'Entrar' : 'Registrarme'}
          </button>
        </form>

        <button
          onClick={() => setModo(modo === 'login' ? 'registro' : 'login')}
          className="mt-4 w-full text-center text-sm text-gray-500 hover:underline"
        >
          {modo === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </div>
    </div>
  );
}