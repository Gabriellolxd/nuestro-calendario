// src/components/PantallaCarga.tsx
'use client';

type Props = {
  mensaje?: string;
};

export default function PantallaCarga({ mensaje = 'Cargando Nuestro Calendario' }: Props) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-pink-50 to-white">
      <div className="relative flex h-28 w-28 items-center justify-center">
        {/* Anillo giratorio */}
        <svg className="absolute inset-0 h-full w-full animate-spin" viewBox="0 0 100 100" style={{ animationDuration: '1.4s' }}>
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="#f9a8d4"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="70 200"
          />
        </svg>
        {/* Logo centrado */}
        <img
          src="/icon.png"
          alt="Nuestro Calendario"
          className="h-16 w-16 rounded-full object-cover shadow-sm"
        />
      </div>

      <p className="animate-pulse text-sm font-medium text-gray-500">{mensaje}</p>
    </div>
  );
}