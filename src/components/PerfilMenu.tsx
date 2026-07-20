// src/components/PerfilMenu.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

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
        className="h-9 w-9 overflow-hidden rounded-full ring-2 ring-white shadow-sm transition-transform active:scale-95"
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
        <div className="absolute right-0 top-11 z-50 w-48 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-black/5">
          <Link
            href="/ciclo"
            onClick={() => setAbierto(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <span className="text-base">🩸</span>
            Ciclo menstrual
          </Link>
          
          <button
            onClick={handleCerrarSesion}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}