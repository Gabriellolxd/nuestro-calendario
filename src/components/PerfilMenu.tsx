// src/components/PerfilMenu.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { LogOut, Link2, Droplet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ThemeSwitcher from './ThemeSwitcher';

export default function PerfilMenu() {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function manejarClickFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener('mousedown', manejarClickFuera);
    return () => document.removeEventListener('mousedown', manejarClickFuera);
  }, []);

  async function handleCerrarSesion() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="relative" ref={contenedorRef}>
      <button
        onClick={() => setAbierto((a) => !a)}
        className="h-9 w-9 overflow-hidden rounded-full ring-2 ring-[var(--color-gold)] shadow-sm transition-transform active:scale-95"
        aria-label="Menú de perfil"
      >
        <Image
          src="/perfil.png"
          alt="Perfil"
          width={36}
          height={36}
          className="h-full w-full object-cover"
        />
      </button>

      {abierto && (
        <div className="absolute right-0 top-11 z-50 w-56 animar-entrada overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] py-1 shadow-[var(--shadow-cozy-lg)]">
          <Link
            href="/ciclo"
            onClick={() => setAbierto(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface)]"
          >
            <Droplet size={16} className="text-[var(--color-primary)]" />
            Ciclo menstrual
          </Link>

          <Link
            href="/vincular"
            onClick={() => setAbierto(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface)]"
          >
            <Link2 size={16} className="text-[var(--color-primary)]" />
            Compartir calendario
          </Link>

          <div className="my-1 border-t border-[var(--color-border)]" />
          <ThemeSwitcher />
          <div className="my-1 border-t border-[var(--color-border)]" />

          <button
            onClick={handleCerrarSesion}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[var(--color-danger)] transition-colors hover:bg-[var(--color-primary-soft)]"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}