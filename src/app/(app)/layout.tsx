// src/app/(app)/layout.tsx
import { CalendarioActivoProvider } from '@/lib/CalendarioActivoContext';
import WebNotificationsWatcher from '@/components/WebNotificationsWatcher';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CalendarioActivoProvider>
      {children}
      <WebNotificationsWatcher />
    </CalendarioActivoProvider>
  );
}