// src/app/vincular/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function VincularPage() {
  const [miCodigo, setMiCodigo] = useState('');
  const [codigoInput, setCodigoInput] = useState('');
  const [rol, setRol] = useState<'editor' | 'espectador'>('editor');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-md">
        <h1 className="mb-2 text-center text-2xl font-semibold text-gray-800">Comparte tu calendario</h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          Tu código: <span className="font-mono font-semibold text-pink-500">{miCodigo || '...'}</span>
        </p>

        <form onSubmit={handleVincular} className="space-y-4">
          <input
            type="text"
            placeholder="Código de tu pareja (USER-1234)"
            value={codigoInput}
            onChange={(e) => setCodigoInput(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 uppercase focus:outline-none focus:ring-2 focus:ring-pink-400"
          />

          <div className="flex gap-4 text-sm text-gray-600">
            <label className="flex items-center gap-2">
              <input type="radio" checked={rol === 'editor'} onChange={() => setRol('editor')} />
              Editor (puede modificar)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={rol === 'espectador'} onChange={() => setRol('espectador')} />
              Espectador (solo ve)
            </label>
          </div>

          {mensaje && <p className="text-sm text-gray-700">{mensaje}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-lg bg-pink-500 py-2 font-medium text-white transition hover:bg-pink-600 disabled:opacity-50"
          >
            {cargando ? 'Vinculando...' : 'Vincular'}
          </button>
        </form>
      </div>
    </div>
  );
}