// src/app/login/page.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Coffee } from 'lucide-react';
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
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 textura-cozy">
      <div className="panel-madera w-full max-w-sm animar-entrada p-8">
        <div className="insignia-icono mx-auto mb-3 h-12 w-12">
          <Coffee size={22} className="text-[var(--color-primary)]" strokeWidth={2.2} />
        </div>

        <h1 className="font-display text-center text-2xl font-semibold text-[var(--color-text)]">
          {modo === 'login' ? '¡Bienvenida!' : 'Crea tu cuenta'}
        </h1>
        <p className="font-hand mb-6 -mt-0.5 text-center text-lg text-[var(--color-text-muted)]">
          {modo === 'login' ? 'qué bueno verte por aquí' : 'empecemos con lo tuyo'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="email"
              placeholder="Correo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-elevated)] py-2.5 pl-10 pr-4 text-[var(--color-text)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)]"
            />
          </div>

          <div className="relative">
            <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-elevated)] py-2.5 pl-10 pr-4 text-[var(--color-text)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)]"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <input
              type="checkbox"
              checked={recordarme}
              onChange={(e) => setRecordarme(e.target.checked)}
              className="h-4 w-4 rounded accent-[var(--color-primary)]"
            />
            Recordar mi sesión en este dispositivo
          </label>

          {error && (
            <p className="rounded-lg border-2 border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="boton-tallado w-full rounded-xl bg-[var(--color-primary)] py-2.5 font-semibold text-[var(--color-text-inverse)] transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            {cargando ? 'Cargando...' : modo === 'login' ? 'Entrar' : 'Registrarme'}
          </button>
        </form>

        <button
          onClick={() => setModo(modo === 'login' ? 'registro' : 'login')}
          className="mt-4 w-full text-center text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-primary)]"
        >
          {modo === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </div>
    </div>
  );
}