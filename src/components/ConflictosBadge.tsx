// src/components/ConflictosBadge.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import ConflictosModal from './ConflictosModal';

type Props = {
  onResuelto: () => void;
};

export default function ConflictosBadge({ onResuelto }: Props) {
  const [cantidad, setCantidad] = useState(0);
  const [abierto, setAbierto] = useState(false);

  const cargarCantidad = useCallback(async () => {
    const { count } = await supabase
      .from('sync_conflicts')
      .select('id', { count: 'exact', head: true })
      .eq('resolved', false);
    setCantidad(count ?? 0);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del contador al montar
    cargarCantidad();
  }, [cargarCantidad]);

  if (cantidad === 0 && !abierto) return null;

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-200"
      >
        ⚠ {cantidad}
      </button>
      {abierto && (
        <ConflictosModal
          onClose={() => setAbierto(false)}
          onResuelto={() => {
            cargarCantidad();
            onResuelto();
          }}
        />
      )}
    </>
  );
}