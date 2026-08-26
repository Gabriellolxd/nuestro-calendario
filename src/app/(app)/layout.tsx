// src/app/(app)/layout.tsx
import { CalendarioActivoProvider } from '@/lib/CalendarioActivoContext';
import WebNotificationsWatcher from '@/components/WebNotificationsWatcher';
import PullToRefresh from '@/components/PullToRefresh';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CalendarioActivoProvider>
      {children}
      <WebNotificationsWatcher />
      <PullToRefresh />
    </CalendarioActivoProvider>
  );
}