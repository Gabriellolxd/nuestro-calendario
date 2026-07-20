// src/app/(app)/layout.tsx
import { CalendarioActivoProvider } from '@/lib/CalendarioActivoContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <CalendarioActivoProvider>{children}</CalendarioActivoProvider>;
}