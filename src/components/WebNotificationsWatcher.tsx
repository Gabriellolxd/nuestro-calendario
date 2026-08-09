// src/components/WebNotificationsWatcher.tsx
'use client';

import { useCalendarioActivo } from '@/lib/CalendarioActivoContext';
import { useNotificacionesWeb } from '@/lib/useNotificacionesWeb';
import ToastNotificacion from './ToastNotificacion';

export default function WebNotificationsWatcher() {
  const { opciones } = useCalendarioActivo();
  const ownerIds = opciones.map((o) => o.ownerId);
  const { toast, cerrarToast } = useNotificacionesWeb(ownerIds);

  if (!toast) return null;
  return <ToastNotificacion titulo={toast.titulo} onClose={cerrarToast} />;
}