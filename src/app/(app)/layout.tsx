// src/app/(app)/layout.tsx
import { CalendarioActivoProvider } from '@/lib/CalendarioActivoContext';
import { MusicProvider } from '@/lib/MusicContext';
import WebNotificationsWatcher from '@/components/WebNotificationsWatcher';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CalendarioActivoProvider>
      <MusicProvider>
        {children}
        <WebNotificationsWatcher />
      </MusicProvider>
    </CalendarioActivoProvider>
  );
}