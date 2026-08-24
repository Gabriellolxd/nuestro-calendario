// src/components/NotesStack.tsx
'use client';

import { useState } from 'react';
import { StickyNote } from 'lucide-react';
import { playSound } from '@/lib/soundManager';

type Props = {
  oculto: boolean;
  onCrearNota: () => void;
};

const COLORES_PILA = ['#bfdbfe', '#fecaca','#fef3c7' ];

export default function NotesStack({ oculto, onCrearNota }: Props) {
  const [hover, setHover] = useState(false);

  function handleClick() {
    playSound('sacar_nota');
    onCrearNota();
    setTimeout(() => playSound('alfiler'), 250);
  }

  return (
    <div
      className="fixed bottom-0 left-[62%] z-40 -translate-x-1/2 transition-all duration-300"
      style={{
        transform: oculto ? 'translateY(130%)' : hover ? 'translateY(-10px)' : 'translateY(60%)',
        opacity: oculto ? 0 : 1,
        transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button onClick={handleClick} className="relative flex h-20 w-16 flex-col items-center" aria-label="Sacar una nota">
        {COLORES_PILA.map((c, i) => (
          <div
            key={i}
            className="absolute h-14 w-14 rounded-lg border border-black/10 shadow-md"
            style={{ backgroundColor: c, bottom: i * 6, transform: `rotate(${(i - 1) * 4}deg)`, zIndex: i }}
          />
        ))}
        <span className="absolute -top-6 flex items-center gap-1 rounded-full bg-[var(--color-bg-elevated)] px-2 py-0.5 text-[9px] font-medium text-[var(--color-text-muted)] shadow-sm">
          <StickyNote size={10} /> Notas
        </span>
      </button>
    </div>
  );
}