// src/components/PasswordInput.tsx
'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
};

export default function PasswordInput({ value, onChange, placeholder = 'Contraseña', required, minLength }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {visible ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
      <input
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        className="w-full rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-elevated)] py-2 pl-9 pr-3 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
      />
    </div>
  );
}