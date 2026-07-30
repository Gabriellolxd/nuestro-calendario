// src/app/vincular/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, Link2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function VincularPage() {
  const [miCodigo, setMiCodigo] = useState('');
  const [codigoInput, setCodigoInput] = useState('');
  const [rol, setRol] = useState<'editor' | 'espectador'>('editor');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function cargarPerfil() {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      if (!uid) return;
      setUserId(uid);

      const { data: perfil } = await supabase
        .from('profiles')
        .select('codigo_vinculacion')
        .eq('id', uid)
        .single();

      if (perfil) setMiCodigo(perfil.codigo_vinculacion);
    }
    cargarPerfil();
  }, []);

  async function handleVincular(e: React.FormEvent) {
    e.preventDefault();
    setMensaje('');
    setCargando(true);

    try {
      if (!userId) throw new Error('No hay sesión activa.');

      const { data: encontrados, error: rpcError } = await supabase
        .rpc('buscar_por_codigo', { codigo: codigoInput.trim().toUpperCase() });

      if (rpcError) throw rpcError;
      if (!encontrados || encontrados.length === 0) {
        setMensaje('No se encontró ningún usuario con ese código.');
        return;
      }

      const parejaId = encontrados[0].id;

      if (parejaId === userId) {
        setMensaje('Ese es tu propio código 😅');
        return;
      }

      const { error: insertError } = await supabase
        .from('permisos_compartidos')
        .insert({ owner_user_id: userId, grantee_user_id: parejaId, role: rol });

      if (insertError) throw insertError;

      setMensaje('¡Cuentas vinculadas! Ya puede ver tu calendario.');
      setCodigoInput('');
    } catch (err: unknown) {
      setMensaje((err as Error).message ?? 'Ocurrió un error al vincular.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-10 textura-cozy">
      <div className="panel-madera w-full max-w-sm animar-entrada p-8">
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => router.push('/calendario')}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface)]"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="font-display text-[var(--color-text)]">
            Volver
          </h2>
        </div>
        <div className="insignia-icono mx-auto mb-3 h-12 w-12">
          <Link2 size={20} className="text-[var(--color-primary)]" strokeWidth={2.2} />
        </div>
        <h1 className="font-display text-center text-2xl font-semibold text-[var(--color-text)]">
          Comparte tu calendario
        </h1>

        {/* Notitas manuales en vez del párrafo explicativo */}
        <div className="my-8 flex items-center justify-center gap-8 py-2">
          <div
            className="w-40 -rotate-5 rounded-lg border-2 border-[var(--color-border)] bg-[var(--color-gold-soft)] p-2 text-center"
            style={{ boxShadow: 'var(--sombra-panel-suave)' }}
          >
            <p className="font-hand text-[17px] leading-tight text-[var(--color-wood-dark)]">
              <strong>¿Quieres compartir tu calendario?</strong> 
            </p>
            <p className="font-hand text-[17px] leading-tight text-[var(--color-wood-dark)]">
              ¡Pega aquí el código de esa persona!
            </p>
          </div>
          <div
            className="w-40 rotate-5 rounded-lg border-2 border-[var(--color-border)] bg-[var(--color-sage-soft)] p-2 text-center"
            style={{ boxShadow: 'var(--sombra-panel-suave)' }}
          >
            <p className="font-hand text-[17px] leading-tight text-[var(--color-wood-dark)]">
              <strong>¿Quieres ver otro calendario?</strong>  
            </p>
            <p className="font-hand text-[17px] leading-tight text-[var(--color-wood-dark)]">
              ¡Mándale tu código a esa persona!
            </p>
          </div>
        </div>

        <div className="placa mx-auto mb-6 flex w-fit items-center gap-2 px-4 py-2">
          <span className="text-xs text-[var(--color-text-inverse)]/70">Tu código</span>
          <span className="font-display font-mono text-sm font-bold tracking-wider">
            {miCodigo || '...'}
          </span>
        </div>

        <form onSubmit={handleVincular} className="space-y-4">
          <input
            type="text"
            placeholder="Código de tu pareja (USER-1234)"
            value={codigoInput}
            onChange={(e) => setCodigoInput(e.target.value)}
            required
            className="w-full rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-2.5 uppercase text-[var(--color-text)] outline-none transition-colors placeholder:normal-case placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)]"
          />

          <div className="flex gap-2">
            <label
              className={`cinta flex-1 cursor-pointer px-3 py-2 text-center text-xs font-semibold transition-colors ${
                rol === 'editor'
                  ? 'bg-[var(--color-primary)] text-[var(--color-text-inverse)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'
              }`}
            >
              <input
                type="radio"
                className="sr-only"
                checked={rol === 'editor'}
                onChange={() => setRol('editor')}
              />
              Editor
            </label>
            <label
              className={`cinta flex-1 cursor-pointer px-3 py-2 text-center text-xs font-semibold transition-colors ${
                rol === 'espectador'
                  ? 'bg-[var(--color-primary)] text-[var(--color-text-inverse)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'
              }`}
            >
              <input
                type="radio"
                className="sr-only"
                checked={rol === 'espectador'}
                onChange={() => setRol('espectador')}
              />
              Espectador
            </label>
          </div>

          {mensaje && (
            <p className="rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-center text-sm text-[var(--color-text)]">
              {mensaje}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="boton-tallado w-full rounded-xl bg-[var(--color-primary)] py-2.5 font-semibold text-[var(--color-text-inverse)] transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            {cargando ? 'Vinculando...' : 'Vincular'}
          </button>
        </form>
      </div>
    </div>
  );
}