// src/components/BannerSinConexion.tsx
'use client';

import { WifiOff } from 'lucide-react';
import { useCalendarioActivo } from '@/lib/CalendarioActivoContext';

export default function BannerSinConexion() {
  const { sinConexionInicial } = useCalendarioActivo();
  if (!sinConexionInicial) return null;

  return (
    <div className="flex items-center gap-2 border-b-2 border-[var(--color-gold)] bg-[var(--color-gold-soft)] px-4 py-2 text-xs text-[var(--color-wood-dark)]">
      <WifiOff size={14} className="flex-shrink-0" />
      No se ha podido iniciar sesión — tus cambios no se sincronizarán hasta que haya internet, pero la app sigue funcionando con lo que ya tienes guardado.
    </div>
  );
}