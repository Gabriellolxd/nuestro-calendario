// src/components/VincularModal.tsx
'use client';

import { useEffect, useState } from 'react';
import { X, Link2, Copy, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCalendarioActivo } from '@/lib/CalendarioActivoContext';
import { playSound } from '@/lib/soundManager';

type Props = { onClose: () => void };

export default function VincularModal({ onClose }: Props) {
  const { userId, recargarCalendarios } = useCalendarioActivo();
  const [miCodigo, setMiCodigo] = useState('');
  const [codigoInput, setCodigoInput] = useState('');
  const [rol, setRol] = useState<'editor' | 'espectador'>('editor');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    async function cargarPerfil() {
      if (!userId) return;
      const { data: perfil } = await supabase.from('profiles').select('codigo_vinculacion').eq('id', userId).single();
      if (perfil) setMiCodigo(perfil.codigo_vinculacion);
    }
    cargarPerfil();
  }, [userId]);

  function copiarCodigo() {
    navigator.clipboard?.writeText(miCodigo).then(() => {
      playSound('click');
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    });
  }

  async function handleVincular(e: React.FormEvent) {
    e.preventDefault();
    setMensaje('');
    setCargando(true);

    try {
      if (!userId) throw new Error('No hay sesión activa.');
      const { data: encontrados, error: rpcError } = await supabase.rpc('buscar_por_codigo', {
        codigo: codigoInput.trim().toUpperCase(),
      });
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

      playSound('inicio');
      setMensaje('¡Cuentas vinculadas! Ya puede ver tu calendario.');
      setCodigoInput('');
      await recargarCalendarios();
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : 'Ocurrió un error al vincular.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--color-wood-dark)]/50 px-4" onClick={onClose}>
      <div className="panel-madera w-full max-w-sm animar-entrada p-8" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <div className="insignia-icono h-11 w-11">
            <Link2 size={19} className="text-[var(--color-primary)]" strokeWidth={2.2} />
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]">
            <X size={17} />
          </button>
        </div>

        <h1 className="font-display mb-4 text-xl font-semibold text-[var(--color-text)]">Comparte tu calendario</h1>

        <button
          onClick={copiarCodigo}
          className="placa mx-auto mb-6 flex w-fit items-center gap-2 px-4 py-2"
        >
          <span className="text-xs text-[var(--color-text-inverse)]/70">Tu código</span>
          <span className="font-display font-mono text-sm font-bold tracking-wider">{miCodigo || '...'}</span>
          {copiado ? <Check size={14} className="text-[var(--color-success)]" /> : <Copy size={14} className="text-[var(--color-text-inverse)]/70" />}
        </button>

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
                rol === 'editor' ? 'bg-[var(--color-primary)] text-[var(--color-text-inverse)]' : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'
              }`}
            >
              <input type="radio" className="sr-only" checked={rol === 'editor'} onChange={() => setRol('editor')} />
              Editor
            </label>
            <label
              className={`cinta flex-1 cursor-pointer px-3 py-2 text-center text-xs font-semibold transition-colors ${
                rol === 'espectador' ? 'bg-[var(--color-primary)] text-[var(--color-text-inverse)]' : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'
              }`}
            >
              <input type="radio" className="sr-only" checked={rol === 'espectador'} onChange={() => setRol('espectador')} />
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
            className="boton-tallado w-full rounded-xl bg-[var(--color-primary)] py-2.5 font-semibold text-[var(--color-text-inverse)] disabled:opacity-50"
          >
            {cargando ? 'Vinculando...' : 'Vincular'}
          </button>
        </form>
      </div>
    </div>
  );
}